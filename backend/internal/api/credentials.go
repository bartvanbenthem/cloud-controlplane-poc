package api

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// CredentialField is one labeled value read out of a vendor-managed Secret.
// Sensitive fields (passwords, connection URIs that embed one) are meant to
// be masked behind a reveal toggle in the UI; everything else (username,
// host, port) is shown plainly.
type CredentialField struct {
	Label     string `json:"label"`
	Value     string `json:"value"`
	Sensitive bool   `json:"sensitive"`
}

// CredentialSet groups the fields read out of one Secret, e.g. "App user"
// or "Root user" — a resource can have more than one (MariaDBCluster has
// both an app and a root user).
type CredentialSet struct {
	Label  string            `json:"label"`
	Fields []CredentialField `json:"fields"`
}

// CredentialsResponse is the /credentials endpoint's response body.
// Pending is true when the resource kind is expected to end up with
// credentials but the vendor operator hasn't written the Secret yet
// (still provisioning) — distinct from the kind having no credentials at
// all, which the endpoint 404s for instead of returning this.
type CredentialsResponse struct {
	Sets    []CredentialSet `json:"sets"`
	Pending bool            `json:"pending"`
}

// handleGetCredentials reads out the Kubernetes Secret(s) the underlying
// vendor operator writes end-user credentials into, for the resource kinds
// that have any: CNPG, mariadb-operator, and the RabbitMQ Cluster Operator
// each auto-generate a bootstrap-user password because the corresponding
// paas spec never sets one explicitly (see api/v1alpha1/*_types.go's doc
// comments in project-easter), grafana-operator auto-generates admin
// credentials unless disableDefaultAdminSecret is set (which
// project-easter never does), and the Percona Server for MongoDB Operator
// always writes its own multi-user secrets.users Secret regardless of what
// MongoDBClusterSpec sets. ValkeyCluster, KafkaCluster,
// PrometheusInstance, and LokiInstance have no credentials to read — none
// of this operator, the underlying vendor, or (for Kafka) any listener auth
// config sets up authentication for them, and LokiInstance's
// objectStorage.secretName references a Secret the caller supplies rather
// than one project-easter generates — so those kinds 404 here.
func (s *Server) handleGetCredentials(w http.ResponseWriter, r *http.Request) {
	kind, err := parseKind(r.PathValue("kind"))
	if err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	ns, name := r.PathValue("namespace"), r.PathValue("name")
	ctx := r.Context()

	var resp CredentialsResponse
	switch kind {
	case KindPostgres:
		resp, err = s.postgresCredentials(ctx, ns, name)
	case KindMariaDB:
		resp, err = s.mariadbCredentials(ctx, ns, name)
	case KindMongoDB:
		resp, err = s.mongodbCredentials(ctx, ns, name)
	case KindRabbitMQ:
		resp, err = s.rabbitmqCredentials(ctx, ns, name)
	case KindGrafana:
		resp, err = s.grafanaCredentials(ctx, ns, name)
	default:
		writeError(w, http.StatusNotFound, fmt.Errorf("%s have no credentials to display", kind))
		return
	}
	if err != nil {
		s.writeK8sError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

// getSecret returns (nil, false, nil) on NotFound rather than an error,
// since "the vendor operator hasn't written this Secret yet" is an
// expected, common state (the resource is still provisioning) — not a
// failure the caller should surface as one.
func (s *Server) getSecret(ctx context.Context, ns, name string) (*corev1.Secret, bool, error) {
	secret, err := s.clients.Clientset.CoreV1().Secrets(ns).Get(ctx, name, metav1.GetOptions{})
	if apierrors.IsNotFound(err) {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, err
	}
	return secret, true, nil
}

func secretField(secret *corev1.Secret, key, label string, sensitive bool) (CredentialField, bool) {
	v, ok := secret.Data[key]
	if !ok || len(v) == 0 {
		return CredentialField{}, false
	}
	return CredentialField{Label: label, Value: string(v), Sensitive: sensitive}, true
}

// rewriteExternalHost swaps CNPG's/the RabbitMQ Cluster Operator's own
// internal Service DNS name -- the "Host" (and, for Postgres, "Connection
// URI") value their Secret carries, only resolvable from pods in this same
// cluster -- for the external LoadBalancer address. Every consumer of these
// credentials is an app on a different Kubernetes cluster (see buildExpose's
// doc comment), so the internal hostname the Secret carries is never
// actually reachable by whoever reads these credentials off the portal. A
// no-op when the LoadBalancer hasn't been assigned an address yet (still
// provisioning) or svcName's Service can't be read -- the internal host
// stays as the best available fallback rather than the field disappearing.
func (s *Server) rewriteExternalHost(ctx context.Context, ns, svcName string, fields []CredentialField) {
	info, err := s.namedServiceExpose(ctx, ns, svcName)
	if err != nil || len(info.Addresses) == 0 {
		return
	}
	external := info.Addresses[0]

	for i, f := range fields {
		switch f.Label {
		case "Host":
			fields[i].Value = external
		case "Connection URI":
			fields[i].Value = rewriteURIHost(f.Value, external)
		}
	}
}

// rewriteURIHost replaces the host in a "scheme://user:pass@host:port/db"
// connection URI with external, keeping the port. CNPG's own uri Secret key
// embeds the namespace-qualified form of its host key ("<cluster>-rw.
// <namespace>", vs. the host key's own bare "<cluster>-rw"), so a plain
// substring replace of the host key's value would only swap the unqualified
// prefix and leave a stray ".<namespace>" glued onto the external address --
// this splices out the whole userinfo-to-port span instead. The rightmost
// "@" is used since a generated password can itself contain "@", which a
// hostname never does; uri is returned unchanged if it doesn't look like a
// "user@host[:port]" URI.
func rewriteURIHost(uri, external string) string {
	at := strings.LastIndex(uri, "@")
	if at < 0 {
		return uri
	}
	rest := uri[at+1:]
	end := strings.IndexAny(rest, ":/")
	if end < 0 {
		end = len(rest)
	}
	return uri[:at+1] + external + rest[end:]
}

// connectionFields builds "Host"/"Port"/"Connection URI" CredentialFields
// from a resource's own external Service, for kinds whose vendor Secret
// carries neither host nor a URI at all (MariaDBCluster) -- unlike CNPG's/
// the RabbitMQ Cluster Operator's own Secrets, which already do (see
// rewriteExternalHost). scheme/user/password/dbPath build the URI the way
// the vendor's own client tooling expects one; dbPath may be empty. The URI
// is built via net/url rather than raw string formatting so a generated
// password containing URI-significant characters (mariadb-operator's own
// passwords can contain "/", which breaks the authority section of a
// hand-formatted URI, confirmed against a live generated password) comes
// out correctly percent-encoded. Returns nil when the LoadBalancer hasn't
// been assigned an address yet, so the caller's fields are left with just
// what the Secret itself carried.
func connectionFields(info ServiceExposeInfo, scheme, user, password, dbPath string) []CredentialField {
	if len(info.Addresses) == 0 {
		return nil
	}
	host := info.Addresses[0]
	fields := []CredentialField{{Label: "Host", Value: host}}
	hostport := host
	if info.Port != 0 {
		fields = append(fields, CredentialField{Label: "Port", Value: strconv.Itoa(int(info.Port))})
		hostport = net.JoinHostPort(host, strconv.Itoa(int(info.Port)))
	}
	uri := url.URL{Scheme: scheme, User: url.UserPassword(user, password), Host: hostport, Path: "/" + dbPath}
	fields = append(fields, CredentialField{Label: "Connection URI", Value: uri.String(), Sensitive: true})
	return fields
}

// mongoConnectionFields builds "Host"/"Port"/"Connection URI" fields for a
// MongoDBCluster from its per-replica-set-member external Services (see
// mongodbServiceExpose) -- a proper MongoDB replica-set connection string
// names every member rather than just one, so a driver can find the primary
// and fail over to a secondary itself. "rs0" mirrors project-easter's own
// internal/psmdb's fixed replset name (MongoDBClusterSpec models exactly
// one, non-sharded replica set -- see mongodbCredentials's doc comment). See
// connectionFields's doc comment for why net/url builds the URI rather than
// raw string formatting.
func mongoConnectionFields(info ServiceExposeInfo, user, password string) []CredentialField {
	if len(info.Addresses) == 0 {
		return nil
	}
	hostports := make([]string, len(info.Addresses))
	for i, addr := range info.Addresses {
		if info.Port != 0 {
			hostports[i] = net.JoinHostPort(addr, strconv.Itoa(int(info.Port)))
		} else {
			hostports[i] = addr
		}
	}
	fields := []CredentialField{{Label: "Host", Value: strings.Join(info.Addresses, ", ")}}
	if info.Port != 0 {
		fields = append(fields, CredentialField{Label: "Port", Value: strconv.Itoa(int(info.Port))})
	}
	uri := url.URL{
		Scheme:   "mongodb",
		User:     url.UserPassword(user, password),
		Host:     strings.Join(hostports, ","),
		Path:     "/admin",
		RawQuery: "replicaSet=rs0&authSource=admin",
	}
	fields = append(fields, CredentialField{Label: "Connection URI", Value: uri.String(), Sensitive: true})
	return fields
}

// postgresCredentials reads CNPG's auto-generated `<name>-app` Secret.
// PostgresClusterSpec's database.owner is passed as
// bootstrap.initdb.owner with no explicit secret ref, which is CNPG's own
// convention for "generate credentials and a same-named `-app` Secret for
// me". enableSuperuserAccess is left at CNPG's default (false as of the
// 1.30.0 CRD this was built against), so there's no separate superuser
// Secret to read.
func (s *Server) postgresCredentials(ctx context.Context, ns, name string) (CredentialsResponse, error) {
	secret, found, err := s.getSecret(ctx, ns, name+"-app")
	if err != nil || !found {
		return CredentialsResponse{Pending: true}, err
	}

	var fields []CredentialField
	for _, f := range []struct {
		key, label string
		sensitive  bool
	}{
		{"username", "Username", false},
		{"password", "Password", true},
		{"dbname", "Database", false},
		{"host", "Host", false},
		{"port", "Port", false},
		{"uri", "Connection URI", true},
	} {
		if cf, ok := secretField(secret, f.key, f.label, f.sensitive); ok {
			fields = append(fields, cf)
		}
	}
	s.rewriteExternalHost(ctx, ns, name+"-external", fields)
	return CredentialsResponse{Sets: []CredentialSet{{Label: "App user", Fields: fields}}}, nil
}

// mariadbCredentials reads mariadb-operator's auto-generated
// `<name>-mariadb-app` and `<name>-mariadb-root` Secrets —
// MariaDBClusterSpec sets passwordSecretKeyRef/rootPasswordSecretKeyRef
// with generate: true, so mariadb-operator creates and manages both
// itself. These names are kind-scoped (not the unscoped `<name>-app`/
// `<name>-root` CNPG defaults to) so a PostgresCluster and a MariaDBCluster
// sharing a CR name in the same namespace can't collide on one Secret —
// see project-easter's internal/mariadb appSecretSuffix/rootSecretSuffix.
// Only the password lives in either Secret; the app username is the CR's
// own spec.database.owner (mariadb-operator has no separate username key),
// so the CR is fetched too. Host/Port/Connection URI come from neither
// Secret nor the CR -- mariadb-operator's own Secrets carry only the
// password -- so they're built from the Service's own external address (see
// connectionFields).
func (s *Server) mariadbCredentials(ctx context.Context, ns, name string) (CredentialsResponse, error) {
	obj, err := s.clients.Dynamic.Resource(KindMariaDB.gvr()).Namespace(ns).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return CredentialsResponse{}, err
	}
	owner, _, _ := unstructured.NestedString(obj.Object, "spec", "database", "owner")
	dbName, _, _ := unstructured.NestedString(obj.Object, "spec", "database", "name")
	// Ignored on error: connectionFields degrades gracefully to nil (no
	// Host/Port/Connection URI fields) on a zero-value ServiceExposeInfo,
	// same as the LoadBalancer-still-provisioning case.
	info, _ := s.namedServiceExpose(ctx, ns, name)

	var sets []CredentialSet
	anyFound := false

	if secret, found, err := s.getSecret(ctx, ns, name+"-mariadb-app"); err != nil {
		return CredentialsResponse{}, err
	} else if found {
		anyFound = true
		fields := []CredentialField{{Label: "Username", Value: owner, Sensitive: false}}
		password := ""
		if cf, ok := secretField(secret, "password", "Password", true); ok {
			fields = append(fields, cf)
			password = cf.Value
		}
		fields = append(fields, CredentialField{Label: "Database", Value: dbName, Sensitive: false})
		fields = append(fields, connectionFields(info, "mysql", owner, password, dbName)...)
		sets = append(sets, CredentialSet{Label: "App user", Fields: fields})
	}

	if secret, found, err := s.getSecret(ctx, ns, name+"-mariadb-root"); err != nil {
		return CredentialsResponse{}, err
	} else if found {
		anyFound = true
		fields := []CredentialField{{Label: "Username", Value: "root", Sensitive: false}}
		password := ""
		if cf, ok := secretField(secret, "password", "Password", true); ok {
			fields = append(fields, cf)
			password = cf.Value
		}
		fields = append(fields, connectionFields(info, "mysql", "root", password, "")...)
		sets = append(sets, CredentialSet{Label: "Root user", Fields: fields})
	}

	return CredentialsResponse{Sets: sets, Pending: !anyFound}, nil
}

// mongodbCredentials reads the Percona Server for MongoDB Operator's
// auto-generated `<name>-psmdb-secrets` Secret — MongoDBClusterSpec never
// sets spec.secrets.users, so Percona generates and manages it itself, with
// several system users inside (see internal/psmdb/psmdb.go's
// secretsUsersSuffix in project-easter). This surfaces the userAdmin one
// (full user/role management), since Mongo has no separate app-user concept
// the way Postgres/MariaDB have via database.owner. Host/Port/Connection URI
// come from the per-member external Services instead (see
// mongoConnectionFields) -- the Secret carries neither.
func (s *Server) mongodbCredentials(ctx context.Context, ns, name string) (CredentialsResponse, error) {
	secret, found, err := s.getSecret(ctx, ns, name+"-psmdb-secrets")
	if err != nil || !found {
		return CredentialsResponse{Pending: true}, err
	}

	var fields []CredentialField
	var user, password string
	for _, f := range []struct {
		key, label string
		sensitive  bool
	}{
		{"MONGODB_USER_ADMIN_USER", "Username", false},
		{"MONGODB_USER_ADMIN_PASSWORD", "Password", true},
	} {
		if cf, ok := secretField(secret, f.key, f.label, f.sensitive); ok {
			fields = append(fields, cf)
			if f.label == "Username" {
				user = cf.Value
			} else {
				password = cf.Value
			}
		}
	}
	// Ignored on error: mongoConnectionFields degrades gracefully to nil on
	// a zero-value ServiceExposeInfo, same as no member Service existing yet.
	if info, err := s.mongodbServiceExpose(ctx, ns, name); err == nil {
		fields = append(fields, mongoConnectionFields(info, user, password)...)
	}
	return CredentialsResponse{Sets: []CredentialSet{{Label: "User admin", Fields: fields}}}, nil
}

// rabbitmqCredentials reads the RabbitMQ Cluster Operator's
// `<name>-default-user` Secret, which it always creates and manages
// itself for the default vhost/user it always provisions — see
// api/v1alpha1/rabbitmqcluster_types.go's doc comment in project-easter.
func (s *Server) rabbitmqCredentials(ctx context.Context, ns, name string) (CredentialsResponse, error) {
	secret, found, err := s.getSecret(ctx, ns, name+"-default-user")
	if err != nil || !found {
		return CredentialsResponse{Pending: true}, err
	}

	var fields []CredentialField
	for _, f := range []struct {
		key, label string
		sensitive  bool
	}{
		{"username", "Username", false},
		{"password", "Password", true},
		{"host", "Host", false},
		{"port", "Port", false},
	} {
		if cf, ok := secretField(secret, f.key, f.label, f.sensitive); ok {
			fields = append(fields, cf)
		}
	}
	s.rewriteExternalHost(ctx, ns, name, fields)
	return CredentialsResponse{Sets: []CredentialSet{{Label: "Default user", Fields: fields}}}, nil
}

// grafanaCredentials reads grafana-operator's auto-generated
// `<name>-admin-credentials` Secret — its own default when
// disableDefaultAdminSecret is left unset, which project-easter never
// sets (see crd-grafana-v5.25.0.yaml's disableDefaultAdminSecret field).
func (s *Server) grafanaCredentials(ctx context.Context, ns, name string) (CredentialsResponse, error) {
	secret, found, err := s.getSecret(ctx, ns, name+"-admin-credentials")
	if err != nil || !found {
		return CredentialsResponse{Pending: true}, err
	}

	var fields []CredentialField
	if cf, ok := secretField(secret, "GF_SECURITY_ADMIN_USER", "Username", false); ok {
		fields = append(fields, cf)
	}
	if cf, ok := secretField(secret, "GF_SECURITY_ADMIN_PASSWORD", "Password", true); ok {
		fields = append(fields, cf)
	}
	return CredentialsResponse{Sets: []CredentialSet{{Label: "Admin user", Fields: fields}}}, nil
}
