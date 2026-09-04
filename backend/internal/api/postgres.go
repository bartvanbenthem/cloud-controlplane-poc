package api

import (
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// PostgresRequest is the create payload for a PostgresCluster resource —
// project-easter's thin front for a CloudNativePG Cluster. Field set
// mirrors api/v1alpha1/postgrescluster_types.go's PostgresClusterSpec:
// everything else in the generated CNPG Cluster is left at CNPG's own
// defaults, so there's nothing more to expose here.
type PostgresRequest struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`

	Instances int64  `json:"instances"`
	Image     string `json:"image,omitempty"`

	StorageSize  string `json:"storageSize"`
	StorageClass string `json:"storageClass,omitempty"`

	DatabaseName  string `json:"databaseName"`
	DatabaseOwner string `json:"databaseOwner"`

	RequestsCPU    string `json:"requestsCpu,omitempty"`
	RequestsMemory string `json:"requestsMemory,omitempty"`
	LimitsCPU      string `json:"limitsCpu,omitempty"`
	LimitsMemory   string `json:"limitsMemory,omitempty"`

	EnablePodMonitor bool `json:"enablePodMonitor"`

	// ExposeType, when non-empty, creates an externally-reachable Service
	// for the primary (read-write) endpoint. One of "LoadBalancer"/"NodePort".
	ExposeType string `json:"exposeType,omitempty"`
}

func (r *PostgresRequest) applyDefaults() {
	if r.Namespace == "" {
		r.Namespace = "default"
	}
	if r.Instances == 0 {
		r.Instances = 1
	}
	if r.StorageSize == "" {
		r.StorageSize = "10Gi"
	}
}

func (r PostgresRequest) validate() error {
	if err := validateName("name", r.Name); err != nil {
		return err
	}
	if r.Instances < 1 {
		return fmt.Errorf("instances must be at least 1")
	}
	if err := requireNonEmpty("storageSize", r.StorageSize); err != nil {
		return err
	}
	if err := requireNonEmpty("databaseName", r.DatabaseName); err != nil {
		return err
	}
	if err := requireNonEmpty("databaseOwner", r.DatabaseOwner); err != nil {
		return err
	}
	if r.ExposeType != "" && r.ExposeType != "LoadBalancer" && r.ExposeType != "NodePort" {
		return fmt.Errorf("exposeType must be LoadBalancer or NodePort")
	}
	return nil
}

func (r PostgresRequest) toUnstructured() *unstructured.Unstructured {
	spec := map[string]interface{}{
		"instances": r.Instances,
		"storage": map[string]interface{}{
			"size": r.StorageSize,
		},
		"database": map[string]interface{}{
			"name":  r.DatabaseName,
			"owner": r.DatabaseOwner,
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
	spec["monitoring"] = map[string]interface{}{
		"enablePodMonitor": r.EnablePodMonitor,
	}
	if r.ExposeType != "" {
		spec["expose"] = buildExpose(r.ExposeType)
	}

	obj := &unstructured.Unstructured{}
	obj.SetUnstructuredContent(map[string]interface{}{
		"apiVersion": paasGroup + "/" + paasVersion,
		"kind":       "PostgresCluster",
		"metadata": map[string]interface{}{
			"name":      r.Name,
			"namespace": r.Namespace,
		},
		"spec": spec,
	})
	return obj
}

// buildResources builds a corev1.ResourceRequirements-shaped map from the
// optional CPU/memory strings shared by PostgresRequest and ValkeyRequest,
// or nil if none were set.
func buildResources(requestsCPU, requestsMemory, limitsCPU, limitsMemory string) map[string]interface{} {
	requests := map[string]interface{}{}
	if requestsCPU != "" {
		requests["cpu"] = requestsCPU
	}
	if requestsMemory != "" {
		requests["memory"] = requestsMemory
	}
	limits := map[string]interface{}{}
	if limitsCPU != "" {
		limits["cpu"] = limitsCPU
	}
	if limitsMemory != "" {
		limits["memory"] = limitsMemory
	}

	resources := map[string]interface{}{}
	if len(requests) > 0 {
		resources["requests"] = requests
	}
	if len(limits) > 0 {
		resources["limits"] = limits
	}
	if len(resources) == 0 {
		return nil
	}
	return resources
}

// buildExpose builds a ServiceExposeSpec-shaped map (see
// api/v1alpha1/expose_types.go in project-easter), shared by every kind that
// exposes an "expose" field (PostgresCluster, MariaDBCluster,
// ValkeyCluster).
func buildExpose(exposeType string) map[string]interface{} {
	return map[string]interface{}{
		"type": exposeType,
	}
}
