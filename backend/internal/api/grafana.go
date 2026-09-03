package api

import (
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
	return nil
}

func (r GrafanaRequest) toUnstructured() *unstructured.Unstructured {
	spec := map[string]interface{}{
		"replicas": r.Replicas,
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
