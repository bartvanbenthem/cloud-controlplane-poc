package api

import (
	"encoding/json"
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
	spec["expose"] = buildExpose()

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

// StorageSizePatch is the payload for PATCH
// /api/resources/{kind}/{namespace}/{name} for every kind whose storage is a
// spec.storage.size field -- PostgresCluster, MariaDBCluster, KafkaCluster,
// RabbitMQCluster, and MongoDBCluster (see toUnstructured on each *Request
// above). Increasing it live-resizes the underlying PVC(s), confirmed per
// vendor:
//   - CNPG: crd-cnpg-v1.30.0.yaml's resizeInUseVolumes, defaulting true,
//     "Changes to this field are automatically reapplied to the created
//     PVCs. Size cannot be decreased."
//   - mariadb-operator: crd-mariadb-operator-*.yaml's own
//     resizeInUseVolumes/waitForVolumeResize.
//   - Strimzi (Kafka): the Cluster Operator resizes storage.size changes on
//     existing PVCs automatically, restarting brokers one at a time --
//     https://strimzi.io/blog/2019/02/28/resizing-persistent-volumes/.
//   - RabbitMQ Cluster Operator: spec.persistence.storage is a documented
//     updatable property; the operator deletes/recreates the StatefulSet
//     and patches the PVCs itself (a past crash-recovery bug in that dance,
//     https://github.com/rabbitmq/cluster-operator/issues/782, was fixed by
//     PR #838, well before the v2.22.5 this was built against).
//   - Percona Server for MongoDB Operator: only resizes PVCs when
//     spec.storageScaling.enableVolumeScaling is set true on the underlying
//     PerconaServerMongoDB CR (off by default -- see
//     docs.percona.com/percona-operator-for-mongodb/1.23.0/debug-storage.html).
//     project-easter's internal/psmdb now sets this unconditionally.
//
// All five require a StorageClass with allowVolumeExpansion: true. No
// project-easter change is needed beyond the Percona flag above -- its
// reconciler already Server-Side-Applies the full desired object,
// storage.size included, on every reconcile (not just at creation), so a
// patch here reaches the underlying vendor object on the next reconcile.
type StorageSizePatch struct {
	StorageSize string `json:"storageSize"`
}

func (p StorageSizePatch) validate() error {
	return requireNonEmpty("storageSize", p.StorageSize)
}

func (p StorageSizePatch) mergePatch() ([]byte, error) {
	return json.Marshal(map[string]interface{}{
		"spec": map[string]interface{}{
			"storage": map[string]interface{}{"size": p.StorageSize},
		},
	})
}

// buildExpose builds a ServiceExposeSpec-shaped map (see
// api/v1alpha1/expose_types.go in project-easter), shared by every kind that
// exposes an "expose" field (PostgresCluster, MariaDBCluster,
// MongoDBCluster, ValkeyCluster, RabbitMQCluster, KafkaCluster). Always
// LoadBalancer: this platform always runs on a cluster that fulfills type
// LoadBalancer automatically (cloud or MetalLB), and every consumer of
// these Services is an app on a different Kubernetes cluster, so there's no
// scenario for ClusterIP-only or NodePort.
func buildExpose() map[string]interface{} {
	return map[string]interface{}{
		"type": "LoadBalancer",
	}
}
