package api

import (
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// PrometheusRequest is the create payload for a PrometheusInstance resource —
// project-easter's thin front for a Prometheus Operator Prometheus. Field
// set mirrors api/v1alpha1/prometheusinstance_types.go's
// PrometheusInstanceSpec. Storage is optional: when empty, no PVC is
// requested and Prometheus runs with ephemeral storage. The generated
// Prometheus only ever selects ServiceMonitors/PodMonitors/Probes from its
// own namespace — not configurable here, see the vendor spec's own doc
// comment.
type PrometheusRequest struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`

	Version   string `json:"version,omitempty"`
	Replicas  int64  `json:"replicas"`
	Retention string `json:"retention,omitempty"`

	StorageSize  string `json:"storageSize,omitempty"`
	StorageClass string `json:"storageClass,omitempty"`

	RequestsCPU    string `json:"requestsCpu,omitempty"`
	RequestsMemory string `json:"requestsMemory,omitempty"`
	LimitsCPU      string `json:"limitsCpu,omitempty"`
	LimitsMemory   string `json:"limitsMemory,omitempty"`

	IngressHost          string `json:"ingressHost,omitempty"`
	IngressClassName     string `json:"ingressClassName,omitempty"`
	IngressTLSSecretName string `json:"ingressTlsSecretName,omitempty"`
}

func (r *PrometheusRequest) applyDefaults() {
	if r.Namespace == "" {
		r.Namespace = "default"
	}
	if r.Replicas == 0 {
		r.Replicas = 1
	}
}

func (r PrometheusRequest) validate() error {
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

func (r PrometheusRequest) toUnstructured() *unstructured.Unstructured {
	spec := map[string]interface{}{
		"replicas": r.Replicas,
	}
	if r.Version != "" {
		spec["version"] = r.Version
	}
	if r.Retention != "" {
		spec["retention"] = r.Retention
	}
	if r.StorageSize != "" {
		storage := map[string]interface{}{
			"size": r.StorageSize,
		}
		if r.StorageClass != "" {
			storage["storageClass"] = r.StorageClass
		}
		spec["storage"] = storage
	}
	if resources := buildResources(r.RequestsCPU, r.RequestsMemory, r.LimitsCPU, r.LimitsMemory); resources != nil {
		spec["resources"] = resources
	}
	if r.IngressHost != "" {
		spec["ingress"] = buildIngress(r.IngressHost, r.IngressClassName, r.IngressTLSSecretName)
	}

	obj := &unstructured.Unstructured{}
	obj.SetUnstructuredContent(map[string]interface{}{
		"apiVersion": paasGroup + "/" + paasVersion,
		"kind":       "PrometheusInstance",
		"metadata": map[string]interface{}{
			"name":      r.Name,
			"namespace": r.Namespace,
		},
		"spec": spec,
	})
	return obj
}

// buildIngress builds an IngressSpec-shaped map (see
// api/v1alpha1/expose_types.go in project-easter), shared by every kind that
// exposes an "ingress" field (GrafanaInstance, RabbitMQCluster,
// PrometheusInstance).
func buildIngress(host, ingressClassName, tlsSecretName string) map[string]interface{} {
	ingress := map[string]interface{}{
		"host": host,
	}
	if ingressClassName != "" {
		ingress["ingressClassName"] = ingressClassName
	}
	if tlsSecretName != "" {
		ingress["tlsSecretName"] = tlsSecretName
	}
	return ingress
}
