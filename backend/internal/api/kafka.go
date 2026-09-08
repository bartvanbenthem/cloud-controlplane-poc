package api

import (
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// KafkaRequest is the create payload for a KafkaCluster resource —
// project-easter's thin front for a Strimzi Kafka instance. Field set
// mirrors api/v1alpha1/kafkacluster_types.go's KafkaClusterSpec:
// KRaft-only (no ZooKeeper), a single combined controller+broker
// KafkaNodePool sized by Replicas; dedicated controller/broker pools
// aren't exposed here. No ingress (raw TCP protocol).
type KafkaRequest struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`

	Replicas int64  `json:"replicas"`
	Version  string `json:"version,omitempty"`

	StorageSize  string `json:"storageSize"`
	StorageClass string `json:"storageClass,omitempty"`

	RequestsCPU    string `json:"requestsCpu,omitempty"`
	RequestsMemory string `json:"requestsMemory,omitempty"`
	LimitsCPU      string `json:"limitsCpu,omitempty"`
	LimitsMemory   string `json:"limitsMemory,omitempty"`

	EnablePodMonitor bool `json:"enablePodMonitor"`

	// ExposeType, when non-empty, adds a TLS "external" listener alongside
	// the cluster-internal "plain" one. One of "LoadBalancer"/"NodePort".
	ExposeType string `json:"exposeType,omitempty"`
}

func (r *KafkaRequest) applyDefaults() {
	if r.Namespace == "" {
		r.Namespace = "default"
	}
	if r.Replicas == 0 {
		r.Replicas = 3
	}
	if r.StorageSize == "" {
		r.StorageSize = "100Gi"
	}
}

func (r KafkaRequest) validate() error {
	if err := validateName("name", r.Name); err != nil {
		return err
	}
	if r.Replicas < 1 {
		return fmt.Errorf("replicas must be at least 1")
	}
	if err := requireNonEmpty("storageSize", r.StorageSize); err != nil {
		return err
	}
	if r.ExposeType != "" && r.ExposeType != "LoadBalancer" && r.ExposeType != "NodePort" {
		return fmt.Errorf("exposeType must be LoadBalancer or NodePort")
	}
	return nil
}

func (r KafkaRequest) toUnstructured() *unstructured.Unstructured {
	spec := map[string]interface{}{
		"replicas": r.Replicas,
		"storage": map[string]interface{}{
			"size": r.StorageSize,
		},
	}
	if r.Version != "" {
		spec["version"] = r.Version
	}
	if r.StorageClass != "" {
		spec["storage"].(map[string]interface{})["storageClass"] = r.StorageClass
	}
	if resources := buildResources(r.RequestsCPU, r.RequestsMemory, r.LimitsCPU, r.LimitsMemory); resources != nil {
		spec["resources"] = resources
	}
	spec["monitoring"] = map[string]interface{}{
		"enablePodMonitor": r.EnablePodMonitor,
	}
	if r.ExposeType != "" {
		spec["expose"] = buildExpose(r.ExposeType)
	}

	obj := &unstructured.Unstructured{}
	obj.SetUnstructuredContent(map[string]interface{}{
		"apiVersion": paasGroup + "/" + paasVersion,
		"kind":       "KafkaCluster",
		"metadata": map[string]interface{}{
			"name":      r.Name,
			"namespace": r.Namespace,
		},
		"spec": spec,
	})
	return obj
}
