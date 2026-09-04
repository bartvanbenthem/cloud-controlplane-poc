package api

import (
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// RabbitMQRequest is the create payload for a RabbitMQCluster resource —
// project-easter's thin front for a RabbitMQ Cluster Operator
// RabbitmqCluster. Field set mirrors
// api/v1alpha1/rabbitmqcluster_types.go's RabbitMQClusterSpec. Unlike
// Postgres/MariaDB there's no bootstrap-database concept: the operator
// always creates a default vhost/user itself.
type RabbitMQRequest struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`

	Replicas int64  `json:"replicas"`
	Image    string `json:"image,omitempty"`

	StorageSize  string `json:"storageSize"`
	StorageClass string `json:"storageClass,omitempty"`

	RequestsCPU    string `json:"requestsCpu,omitempty"`
	RequestsMemory string `json:"requestsMemory,omitempty"`
	LimitsCPU      string `json:"limitsCpu,omitempty"`
	LimitsMemory   string `json:"limitsMemory,omitempty"`

	IngressHost          string `json:"ingressHost,omitempty"`
	IngressClassName     string `json:"ingressClassName,omitempty"`
	IngressTLSSecretName string `json:"ingressTlsSecretName,omitempty"`
}

func (r *RabbitMQRequest) applyDefaults() {
	if r.Namespace == "" {
		r.Namespace = "default"
	}
	if r.Replicas == 0 {
		r.Replicas = 1
	}
	if r.StorageSize == "" {
		r.StorageSize = "10Gi"
	}
}

func (r RabbitMQRequest) validate() error {
	if err := validateName("name", r.Name); err != nil {
		return err
	}
	if r.Replicas < 1 {
		return fmt.Errorf("replicas must be at least 1")
	}
	if err := requireNonEmpty("storageSize", r.StorageSize); err != nil {
		return err
	}
	if r.IngressHost == "" && (r.IngressClassName != "" || r.IngressTLSSecretName != "") {
		return fmt.Errorf("ingressHost is required when ingress class or TLS secret is set")
	}
	return nil
}

func (r RabbitMQRequest) toUnstructured() *unstructured.Unstructured {
	spec := map[string]interface{}{
		"replicas": r.Replicas,
		"storage": map[string]interface{}{
			"size": r.StorageSize,
		},
	}
	if r.Image != "" {
		spec["image"] = r.Image
	}
	if r.StorageClass != "" {
		spec["storage"].(map[string]interface{})["storageClass"] = r.StorageClass
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
		"kind":       "RabbitMQCluster",
		"metadata": map[string]interface{}{
			"name":      r.Name,
			"namespace": r.Namespace,
		},
		"spec": spec,
	})
	return obj
}
