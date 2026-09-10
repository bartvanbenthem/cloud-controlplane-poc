package api

import (
	"encoding/json"
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// GrafanaRequest is the create payload for a GrafanaInstance resource —
// project-easter's thin front for a grafana-operator Grafana. Field set
// mirrors api/v1alpha1/grafanainstance_types.go's GrafanaInstanceSpec.
// Persistence is optional: when both persistence fields are empty, no PVC
// is requested and Grafana runs with ephemeral storage.
type GrafanaRequest struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`

	Version  string `json:"version,omitempty"`
	Replicas int64  `json:"replicas"`

	PersistenceSize         string `json:"persistenceSize,omitempty"`
	PersistenceStorageClass string `json:"persistenceStorageClass,omitempty"`

	// LokiRef names the LokiInstance (in this same namespace) this Grafana
	// should get a Loki datasource for. Optional and, unlike PrometheusRef,
	// not implied by naming convention -- a Grafana/Prometheus pair always
	// shares one name (see MonitoringCreate), but a Loki instance doesn't
	// necessarily exist or share that name, so the caller passes it explicitly.
	LokiRef string `json:"lokiRef,omitempty"`

	IngressHost          string `json:"ingressHost,omitempty"`
	IngressClassName     string `json:"ingressClassName,omitempty"`
	IngressTLSSecretName string `json:"ingressTlsSecretName,omitempty"`
}

func (r *GrafanaRequest) applyDefaults() {
	if r.Namespace == "" {
		r.Namespace = "default"
	}
	if r.Replicas == 0 {
		r.Replicas = 1
	}
}

func (r GrafanaRequest) validate() error {
	if err := validateName("name", r.Name); err != nil {
		return err
	}
	if r.Replicas < 0 {
		return fmt.Errorf("replicas cannot be negative")
	}
	if r.IngressHost == "" && (r.IngressClassName != "" || r.IngressTLSSecretName != "") {
		return fmt.Errorf("ingressHost is required when ingress class or TLS secret is set")
	}
	return nil
}

func (r GrafanaRequest) toUnstructured() *unstructured.Unstructured {
	spec := map[string]interface{}{
		"replicas": r.Replicas,
		// project-easter's GrafanaInstanceSpec.prometheusRef is required
		// (no convention-based default) as of its GrafanaInstance CRD
		// update -- the portal only ever creates Grafana/Prometheus
		// instances as a pair sharing one name (see MonitoringCreate), so
		// the referenced PrometheusInstance is always this same name.
		"prometheusRef": r.Name,
	}
	if r.LokiRef != "" {
		spec["lokiRef"] = r.LokiRef
	}
	if r.Version != "" {
		spec["version"] = r.Version
	}
	if r.PersistenceSize != "" {
		persistence := map[string]interface{}{
			"size": r.PersistenceSize,
		}
		if r.PersistenceStorageClass != "" {
			persistence["storageClass"] = r.PersistenceStorageClass
		}
		spec["persistence"] = persistence
	}
	if r.IngressHost != "" {
		spec["ingress"] = buildIngress(r.IngressHost, r.IngressClassName, r.IngressTLSSecretName)
	}

	obj := &unstructured.Unstructured{}
	obj.SetUnstructuredContent(map[string]interface{}{
		"apiVersion": paasGroup + "/" + paasVersion,
		"kind":       "GrafanaInstance",
		"metadata": map[string]interface{}{
			"name":      r.Name,
			"namespace": r.Namespace,
		},
		"spec": spec,
	})
	return obj
}

// GrafanaLokiRefPatch is the payload for PATCH
// /api/resources/grafanainstances/{namespace}/{name} -- the only field an
// existing GrafanaInstance can be edited through, so it's a flat string
// rather than a partial GrafanaRequest. An empty string clears the
// reference (spec.lokiRef is optional, see GrafanaRequest.LokiRef).
type GrafanaLokiRefPatch struct {
	LokiRef string `json:"lokiRef"`
}

// mergePatch builds a JSON Merge Patch (RFC 7386) body for spec.lokiRef --
// a bare `null` removes the field entirely rather than setting it to "",
// since project-easter's LokiRef is `omitempty` and an operator-side zero
// value isn't guaranteed to behave the same as the field being absent.
func (p GrafanaLokiRefPatch) mergePatch() ([]byte, error) {
	var lokiRef interface{}
	if p.LokiRef != "" {
		lokiRef = p.LokiRef
	}
	return json.Marshal(map[string]interface{}{
		"spec": map[string]interface{}{"lokiRef": lokiRef},
	})
}
