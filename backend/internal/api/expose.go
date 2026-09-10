package api

import (
	"context"
	"fmt"
	"net/http"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
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
// Kubernetes Service backing one resource's "expose" field. Unlike
// handleGetCredentials this isn't wired up for every Kind that has one
// (PostgresCluster, MariaDBCluster, ... all support "expose" too) --
// GrafanaInstance is the only one the portal surfaces this for today.
func (s *Server) handleGetServiceExpose(w http.ResponseWriter, r *http.Request) {
	kind, err := parseKind(r.PathValue("kind"))
	if err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	ns, name := r.PathValue("namespace"), r.PathValue("name")

	var resp ServiceExposeInfo
	switch kind {
	case KindGrafana:
		resp, err = s.grafanaServiceExpose(r.Context(), ns, name)
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

	info := ServiceExposeInfo{Type: string(svc.Spec.Type)}
	if svc.Spec.Type != corev1.ServiceTypeLoadBalancer {
		return info, nil
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
	return info, nil
}

// grafanaServiceName returns the name of the ClusterIP/LoadBalancer Service
// grafana-operator itself creates fronting a Grafana it manages -- see
// grafanaServiceExpose's doc comment for why this is safe to hardcode.
func grafanaServiceName(name string) string {
	return name + "-service"
}
