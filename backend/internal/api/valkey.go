package api

import (
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// ValkeyRequest is the create payload for a ValkeyCluster resource —
// project-easter's thin front for a valkey-operator ValkeyCluster. Field
// set mirrors api/v1alpha1/valkeycluster_types.go's ValkeyClusterSpec.
type ValkeyRequest struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`

	Shards   int64  `json:"shards"`
	Replicas int64  `json:"replicas"`
	Image    string `json:"image,omitempty"`

	PersistenceSize         string `json:"persistenceSize"`
	PersistenceStorageClass string `json:"persistenceStorageClass,omitempty"`

	RequestsCPU    string `json:"requestsCpu,omitempty"`
	RequestsMemory string `json:"requestsMemory,omitempty"`
	LimitsCPU      string `json:"limitsCpu,omitempty"`
	LimitsMemory   string `json:"limitsMemory,omitempty"`
}

func (r *ValkeyRequest) applyDefaults() {
	if r.Namespace == "" {
		r.Namespace = "default"
	}
	if r.Shards == 0 {
		r.Shards = 1
	}
	if r.PersistenceSize == "" {
		r.PersistenceSize = "5Gi"
	}
}

func (r ValkeyRequest) validate() error {
	if err := validateName("name", r.Name); err != nil {
		return err
	}
	if r.Shards < 1 {
		return fmt.Errorf("shards must be at least 1")
	}
	if r.Replicas < 0 {
		return fmt.Errorf("replicas cannot be negative")
	}
	if err := requireNonEmpty("persistenceSize", r.PersistenceSize); err != nil {
		return err
	}
	return nil
}

func (r ValkeyRequest) toUnstructured() *unstructured.Unstructured {
	spec := map[string]interface{}{
		"shards":   r.Shards,
		"replicas": r.Replicas,
		"persistence": map[string]interface{}{
			"size": r.PersistenceSize,
		},
	}
	if r.Image != "" {
		spec["image"] = r.Image
	}
	if r.PersistenceStorageClass != "" {
		spec["persistence"].(map[string]interface{})["storageClass"] = r.PersistenceStorageClass
	}
	if resources := buildResources(r.RequestsCPU, r.RequestsMemory, r.LimitsCPU, r.LimitsMemory); resources != nil {
		spec["resources"] = resources
	}

	obj := &unstructured.Unstructured{}
	obj.SetUnstructuredContent(map[string]interface{}{
		"apiVersion": paasGroup + "/" + paasVersion,
		"kind":       "ValkeyCluster",
		"metadata": map[string]interface{}{
			"name":      r.Name,
			"namespace": r.Namespace,
		},
		"spec": spec,
	})
	return obj
}
