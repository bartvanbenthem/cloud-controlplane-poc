package api

import (
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// lokiSizes are the Loki Operator's supported deployment scale-out sizes —
// see api/v1alpha1/lokiinstance_types.go's Size field in project-easter.
var lokiSizes = map[string]bool{
	"1x.demo":        true,
	"1x.pico":        true,
	"1x.extra-small": true,
	"1x.small":       true,
	"1x.medium":      true,
}

// LokiRequest is the create payload for a LokiInstance resource —
// project-easter's thin front for a Loki Operator LokiStack. Field set
// mirrors api/v1alpha1/lokiinstance_types.go's LokiInstanceSpec. Unlike
// GrafanaInstance/PrometheusInstance, a LokiStack has no ephemeral-storage
// mode: storageClassName and an S3-compatible object storage Secret are
// both required, and it's sized by a t-shirt size rather than a replica
// count.
type LokiRequest struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`

	Size string `json:"size,omitempty"`

	StorageClassName string `json:"storageClassName"`

	ObjectStorageSecretName string `json:"objectStorageSecretName"`
}

func (r *LokiRequest) applyDefaults() {
	if r.Namespace == "" {
		r.Namespace = "default"
	}
	if r.Size == "" {
		r.Size = "1x.demo"
	}
}

func (r LokiRequest) validate() error {
	if err := validateName("name", r.Name); err != nil {
		return err
	}
	if !lokiSizes[r.Size] {
		return fmt.Errorf("size must be one of 1x.demo, 1x.pico, 1x.extra-small, 1x.small, 1x.medium")
	}
	if err := requireNonEmpty("storageClassName", r.StorageClassName); err != nil {
		return err
	}
	if err := requireNonEmpty("objectStorageSecretName", r.ObjectStorageSecretName); err != nil {
		return err
	}
	return nil
}

func (r LokiRequest) toUnstructured() *unstructured.Unstructured {
	spec := map[string]interface{}{
		"size":             r.Size,
		"storageClassName": r.StorageClassName,
		"objectStorage": map[string]interface{}{
			"secretName": r.ObjectStorageSecretName,
		},
	}

	obj := &unstructured.Unstructured{}
	obj.SetUnstructuredContent(map[string]interface{}{
		"apiVersion": paasGroup + "/" + paasVersion,
		"kind":       "LokiInstance",
		"metadata": map[string]interface{}{
			"name":      r.Name,
			"namespace": r.Namespace,
		},
		"spec": spec,
	})
	return obj
}
