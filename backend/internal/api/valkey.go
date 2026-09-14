package api

import (
	"encoding/json"
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

	EnablePodMonitor bool `json:"enablePodMonitor"`
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
	spec["expose"] = buildExpose()
	spec["monitoring"] = map[string]interface{}{
		"enablePodMonitor": r.EnablePodMonitor,
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

// ValkeyPersistenceSizePatch is the payload for PATCH
// /api/resources/valkeyclusters/{namespace}/{name} -- ValkeyCluster's
// storage field is spec.persistence.size rather than spec.storage.size (see
// ValkeyRequest.PersistenceSize above), so it needs its own patch type
// instead of reusing StorageSizePatch. Increasing it live-resizes the
// underlying PVC(s): crd-valkey-v0.6.0.yaml carries a CEL validation rule
// enforcing persistence.size can only increase
// ("quantity(self.persistence.size).compareTo(quantity(oldSelf.persistence.
// size)) >= 0"), which only makes sense if valkey-operator itself resizes
// the PVCs in place. No project-easter change needed -- see
// StorageSizePatch's doc comment for why.
type ValkeyPersistenceSizePatch struct {
	PersistenceSize string `json:"persistenceSize"`
}

func (p ValkeyPersistenceSizePatch) validate() error {
	return requireNonEmpty("persistenceSize", p.PersistenceSize)
}

func (p ValkeyPersistenceSizePatch) mergePatch() ([]byte, error) {
	return json.Marshal(map[string]interface{}{
		"spec": map[string]interface{}{
			"persistence": map[string]interface{}{"size": p.PersistenceSize},
		},
	})
}
