package api

import (
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// MariaDBRequest is the create payload for a MariaDBCluster resource —
// project-easter's thin front for a mariadb-operator MariaDB. Field set
// mirrors api/v1alpha1/mariadbcluster_types.go's MariaDBClusterSpec, which
// reuses the same StorageSpec/DatabaseSpec shape as PostgresClusterSpec.
type MariaDBRequest struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`

	Replicas int64  `json:"replicas"`
	Image    string `json:"image,omitempty"`

	StorageSize  string `json:"storageSize"`
	StorageClass string `json:"storageClass,omitempty"`

	DatabaseName  string `json:"databaseName"`
	DatabaseOwner string `json:"databaseOwner"`

	RequestsCPU    string `json:"requestsCpu,omitempty"`
	RequestsMemory string `json:"requestsMemory,omitempty"`
	LimitsCPU      string `json:"limitsCpu,omitempty"`
	LimitsMemory   string `json:"limitsMemory,omitempty"`

	EnablePodMonitor bool `json:"enablePodMonitor"`

	// ExposeType, when non-empty, changes the type of the underlying
	// MariaDB's own primary Service so it's reachable outside the cluster.
	// One of "LoadBalancer"/"NodePort".
	ExposeType string `json:"exposeType,omitempty"`
}

func (r *MariaDBRequest) applyDefaults() {
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

func (r MariaDBRequest) validate() error {
	if err := validateName("name", r.Name); err != nil {
		return err
	}
	if r.Replicas < 1 {
		return fmt.Errorf("replicas must be at least 1")
	}
	if r.Replicas > 1 && r.Replicas%2 == 0 {
		return fmt.Errorf("replicas must be 1 or an odd number when enabling Galera Cluster")
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

func (r MariaDBRequest) toUnstructured() *unstructured.Unstructured {
	spec := map[string]interface{}{
		"replicas": r.Replicas,
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
		"kind":       "MariaDBCluster",
		"metadata": map[string]interface{}{
			"name":      r.Name,
			"namespace": r.Namespace,
		},
		"spec": spec,
	})
	return obj
}
