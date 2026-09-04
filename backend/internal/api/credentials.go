package api

import (
	"context"
	"fmt"
	"net/http"

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
// vendor operator writes end-user credentials into, for the four resource
// kinds that have any: CNPG, mariadb-operator, and the RabbitMQ Cluster
// Operator each auto-generate a bootstrap-user password because the
// corresponding paas spec never sets one explicitly (see
// api/v1alpha1/*_types.go's doc comments in project-easter), and
// grafana-operator auto-generates admin credentials unless
// disableDefaultAdminSecret is set (which project-easter never does).
// ValkeyCluster and PrometheusInstance have no credentials to read —
// neither this operator nor the underlying vendor sets up any auth for
// them — so those kinds 404 here.
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
	return CredentialsResponse{Sets: []CredentialSet{{Label: "App user", Fields: fields}}}, nil
}

// mariadbCredentials reads mariadb-operator's auto-generated `<name>-app`
// and `<name>-root` Secrets — MariaDBClusterSpec sets
// passwordSecretKeyRef/rootPasswordSecretKeyRef with generate: true, so
// mariadb-operator creates and manages both itself. Only the password
// lives in either Secret; the app username is the CR's own
// spec.database.owner (mariadb-operator has no separate username key), so
// the CR is fetched too.
func (s *Server) mariadbCredentials(ctx context.Context, ns, name string) (CredentialsResponse, error) {
	obj, err := s.clients.Dynamic.Resource(KindMariaDB.gvr()).Namespace(ns).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return CredentialsResponse{}, err
	}
	owner, _, _ := unstructured.NestedString(obj.Object, "spec", "database", "owner")

	var sets []CredentialSet
	anyFound := false

	if secret, found, err := s.getSecret(ctx, ns, name+"-app"); err != nil {
		return CredentialsResponse{}, err
	} else if found {
		anyFound = true
		fields := []CredentialField{{Label: "Username", Value: owner, Sensitive: false}}
		if cf, ok := secretField(secret, "password", "Password", true); ok {
			fields = append(fields, cf)
		}
		sets = append(sets, CredentialSet{Label: "App user", Fields: fields})
	}

	if secret, found, err := s.getSecret(ctx, ns, name+"-root"); err != nil {
		return CredentialsResponse{}, err
	} else if found {
		anyFound = true
		fields := []CredentialField{{Label: "Username", Value: "root", Sensitive: false}}
		if cf, ok := secretField(secret, "password", "Password", true); ok {
			fields = append(fields, cf)
		}
		sets = append(sets, CredentialSet{Label: "Root user", Fields: fields})
	}

	return CredentialsResponse{Sets: sets, Pending: !anyFound}, nil
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
