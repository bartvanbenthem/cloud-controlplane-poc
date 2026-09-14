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

// ServiceExposeInfo reports the externally-reachable address of a
// resource's own Service, for kinds created with an "expose" type (see
// buildExpose). Pending is true for a LoadBalancer Service whose cloud
// load-balancer hasn't been provisioned yet -- Kubernetes populates
// status.loadBalancer.ingress asynchronously, so this is a normal,
// expected transient state, not a failure.
type ServiceExposeInfo struct {
	Type      string   `json:"type"`
	Addresses []string `json:"addresses,omitempty"`
	Pending   bool     `json:"pending"`
}

// handleGetServiceExpose reads the externally-reachable address off the
// Kubernetes Service(s) backing one resource's "expose" field. Every kind
// that has one is covered -- see namedServiceExpose and
// mongodbServiceExpose's doc comments for each underlying vendor operator's
// Service naming convention (confirmed against project-easter's own
// adapters, not guessed).
func (s *Server) handleGetServiceExpose(w http.ResponseWriter, r *http.Request) {
	kind, err := parseKind(r.PathValue("kind"))
	if err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	ns, name := r.PathValue("namespace"), r.PathValue("name")
	ctx := r.Context()

	var resp ServiceExposeInfo
	switch kind {
	case KindGrafana:
		resp, err = s.grafanaServiceExpose(ctx, ns, name)
	case KindPostgres:
		resp, err = s.namedServiceExpose(ctx, ns, name+"-external")
	case KindMariaDB:
		resp, err = s.namedServiceExpose(ctx, ns, name)
	case KindRabbitMQ:
		resp, err = s.namedServiceExpose(ctx, ns, name)
	case KindValkey:
		resp, err = s.namedServiceExpose(ctx, ns, name+"-external")
	case KindKafka:
		resp, err = s.namedServiceExpose(ctx, ns, name+"-kafka-external-bootstrap")
	case KindMongoDB:
		resp, err = s.mongodbServiceExpose(ctx, ns, name)
	default:
		writeError(w, http.StatusNotFound, fmt.Errorf("%s Service address is not exposed here", kind))
		return
	}
	if err != nil {
		s.writeK8sError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

// namedServiceExpose reads one Service by name and reports its
// LoadBalancer-assigned address(es), for every "expose" kind whose
// underlying vendor operator (or project-easter itself) creates exactly one
// Service for it:
//   - PostgresCluster: "<name>-external", a CNPG spec.managed.services.
//     additional Service (see internal/cnpg/cnpg.go's BuildManifest in
//     project-easter).
//   - MariaDBCluster / RabbitMQCluster: mariadb-operator's and the RabbitMQ
//     Cluster Operator's own primary/client Service, which both name the
//     same as the CR itself rather than a suffixed name.
//   - ValkeyCluster: "<name>-external", a Service this operator creates
//     directly since valkey-operator's own generated Service is headless
//     (see internal/valkey/valkey.go's ExtraResources).
//   - KafkaCluster: "<name>-kafka-external-bootstrap", Strimzi's own
//     bootstrap Service naming convention for a listener named "external"
//     (see internal/strimzi/strimzi.go's exposedListenerName constant).
func (s *Server) namedServiceExpose(ctx context.Context, ns, svcName string) (ServiceExposeInfo, error) {
	svc, err := s.clients.Clientset.CoreV1().Services(ns).Get(ctx, svcName, metav1.GetOptions{})
	if err != nil {
		return ServiceExposeInfo{}, err
	}
	return serviceExposeInfo(svc), nil
}

// mongodbServiceExpose reads the per-member Services the Percona Server for
// MongoDB Operator creates when replset.expose is enabled -- unlike every
// other kind here, Percona exposes each replica set member on its own
// Service ("<name>-rs0-0", "<name>-rs0-1", ...) rather than one shared
// Service, since MongoDB drivers connect directly to every member. The
// member count comes from the MongoDBCluster's own spec.replicas rather
// than being guessed, and a member Service that doesn't exist yet (still
// being created) is skipped rather than treated as an error.
func (s *Server) mongodbServiceExpose(ctx context.Context, ns, name string) (ServiceExposeInfo, error) {
	cr, err := s.clients.Dynamic.Resource(KindMongoDB.gvr()).Namespace(ns).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return ServiceExposeInfo{}, err
	}
	replicas, _, _ := unstructured.NestedInt64(cr.Object, "spec", "replicas")
	exposeType, _, _ := unstructured.NestedString(cr.Object, "spec", "expose", "type")

	info := ServiceExposeInfo{Type: exposeType}
	for i := int64(0); i < replicas; i++ {
		svc, err := s.clients.Clientset.CoreV1().Services(ns).Get(ctx, fmt.Sprintf("%s-rs0-%d", name, i), metav1.GetOptions{})
		if apierrors.IsNotFound(err) {
			continue
		}
		if err != nil {
			return ServiceExposeInfo{}, err
		}
		member := serviceExposeInfo(svc)
		info.Type = member.Type
		info.Addresses = append(info.Addresses, member.Addresses...)
	}
	info.Pending = exposeType == string(corev1.ServiceTypeLoadBalancer) && len(info.Addresses) == 0
	return info, nil
}

// serviceExposeInfo extracts a ServiceExposeInfo from one live Service --
// shared by every "expose" kind, single- and multi-Service alike.
func serviceExposeInfo(svc *corev1.Service) ServiceExposeInfo {
	info := ServiceExposeInfo{Type: string(svc.Spec.Type)}
	if svc.Spec.Type != corev1.ServiceTypeLoadBalancer {
		return info
	}
	for _, ing := range svc.Status.LoadBalancer.Ingress {
		switch {
		case ing.IP != "":
			info.Addresses = append(info.Addresses, ing.IP)
		case ing.Hostname != "":
			info.Addresses = append(info.Addresses, ing.Hostname)
		}
	}
	info.Pending = len(info.Addresses) == 0
	return info
}

// grafanaServiceExpose reads grafana-operator's own generated Service for
// a GrafanaInstance -- "<name>-service", a fixed, version-stable naming
// convention baked into grafana-operator itself
// (controllers/resources/resources.go's GetGrafanaService:
// fmt.Sprintf("%s-service", cr.Name)), not something project-easter or
// this portal controls.
func (s *Server) grafanaServiceExpose(ctx context.Context, ns, name string) (ServiceExposeInfo, error) {
	svc, err := s.clients.Clientset.CoreV1().Services(ns).Get(ctx, grafanaServiceName(name), metav1.GetOptions{})
	if err != nil {
		return ServiceExposeInfo{}, err
	}
	return serviceExposeInfo(svc), nil
}

// grafanaServiceName returns the name of the ClusterIP/LoadBalancer Service
// grafana-operator itself creates fronting a Grafana it manages -- see
// grafanaServiceExpose's doc comment for why this is safe to hardcode.
func grafanaServiceName(name string) string {
	return name + "-service"
}
