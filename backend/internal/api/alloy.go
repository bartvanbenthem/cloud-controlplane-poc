package api

import (
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// AlloyRequest is the create payload for an AlloyInstance resource —
// project-easter's thin front for the Alloy Operator's Alloy. Field set
// mirrors api/v1alpha1/alloyinstance_types.go's AlloyInstanceSpec:
// lokiInstanceRef is the only thing that has to be supplied — the
// discovery config, relabeling, push endpoint, and namespace-scoped RBAC
// letting Alloy read its own namespace's pods are all derived and wired up
// automatically, so pointing an AlloyInstance at a LokiInstance is enough
// to start seeing labeled logs for that namespace.
type AlloyRequest struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`

	LokiInstanceRef string `json:"lokiInstanceRef"`
	Replicas        int64  `json:"replicas"`
}

func (r *AlloyRequest) applyDefaults() {
	if r.Namespace == "" {
		r.Namespace = "default"
	}
	if r.Replicas == 0 {
		r.Replicas = 1
	}
}

func (r AlloyRequest) validate() error {
	if err := validateName("name", r.Name); err != nil {
		return err
	}
	if err := requireNonEmpty("lokiInstanceRef", r.LokiInstanceRef); err != nil {
		return err
	}
	if r.Replicas < 1 {
		return fmt.Errorf("replicas must be at least 1")
	}
	return nil
}

func (r AlloyRequest) toUnstructured() *unstructured.Unstructured {
	spec := map[string]interface{}{
		"lokiInstanceRef": r.LokiInstanceRef,
		"replicas":        r.Replicas,
	}

	obj := &unstructured.Unstructured{}
	obj.SetUnstructuredContent(map[string]interface{}{
		"apiVersion": paasGroup + "/" + paasVersion,
		"kind":       "AlloyInstance",
		"metadata": map[string]interface{}{
			"name":      r.Name,
			"namespace": r.Namespace,
		},
		"spec": spec,
	})
	return obj
}
