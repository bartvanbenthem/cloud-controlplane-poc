package api

import (
	"encoding/json"
	"fmt"
)

// ReplicasPatch is the payload for PATCH /api/resources/{kind}/{namespace}/{name}
// for every kind that can be scaled after creation by changing a single
// top-level replica count. The wire field is always "replicas", even for
// PostgresCluster, whose own CRD instead calls it spec.instances (see
// replicaSpecField below) -- the portal's API surface stays uniform, only
// the merge patch built from it differs per kind. Changing it in place is
// each operator's own documented way to scale:
//   - PostgresCluster (spec.instances): CloudNativePG's primary scaling
//     mechanism -- unlike most of a Cluster's other spec fields, this one
//     is designed to be changed at any time.
//   - GrafanaInstance/PrometheusInstance/AlloyInstance (spec.replicas):
//     each operator just forwards this straight onto a Deployment's own
//     replica count, so it's exactly as safe to change live as any plain
//     Deployment's.
//   - RabbitMQCluster (spec.replicas): RabbitMQ Cluster Operator's
//     documented way to grow a cluster (it also handles shrinking, moving
//     quorum-queue leadership off nodes being removed).
//   - MariaDBCluster (spec.replicas): mariadb-operator scales a Galera
//     cluster this way; the odd-node-count rule enforced at create time
//     (see MariaDBRequest.validate) is enforced here too, since Galera
//     still needs an odd count for quorum once more than one node runs.
//   - MongoDBCluster (spec.replicas): Percona Server for MongoDB
//     Operator's documented replica-set scaling mechanism.
//   - ValkeyCluster (spec.replicas): scales replica count per shard; shard
//     count itself (spec.shards) isn't exposed here, since resharding is a
//     heavier operation than this simple in-place count change.
//
// KafkaCluster is deliberately excluded: its replica count lives per
// KafkaNodePool rather than one spec.replicas field (see KafkaRequest's
// doc comment), so a flat patch can't express it safely. ClusterRequest
// and ServerRequest have no replica concept at all.
type ReplicasPatch struct {
	Replicas int64 `json:"replicas"`
}

// replicaSpecField names the actual spec field each replica-patchable Kind
// stores its count under. A Kind absent from this map can't be
// replica-patched at all -- see canPatchReplicas.
var replicaSpecField = map[Kind]string{
	KindPostgres:   "instances",
	KindGrafana:    "replicas",
	KindPrometheus: "replicas",
	KindAlloy:      "replicas",
	KindRabbitMQ:   "replicas",
	KindMariaDB:    "replicas",
	KindMongoDB:    "replicas",
	KindValkey:     "replicas",
}

// replicaMin mirrors the lower bound each Kind's own *Request.validate
// already enforces at create time -- a patch shouldn't be looser or
// stricter about the minimum than creation is.
var replicaMin = map[Kind]int64{
	KindPostgres:   1,
	KindGrafana:    0,
	KindPrometheus: 0,
	KindAlloy:      1,
	KindRabbitMQ:   1,
	KindMariaDB:    1,
	KindMongoDB:    1,
	KindValkey:     0,
}

func canPatchReplicas(kind Kind) bool {
	_, ok := replicaSpecField[kind]
	return ok
}

func (p ReplicasPatch) validate(kind Kind) error {
	if min, ok := replicaMin[kind]; ok && p.Replicas < min {
		return fmt.Errorf("replicas must be at least %d", min)
	}
	if kind == KindMariaDB && p.Replicas > 1 && p.Replicas%2 == 0 {
		return fmt.Errorf("replicas must be 1 or an odd number when enabling Galera Cluster")
	}
	return nil
}

func (p ReplicasPatch) mergePatch(kind Kind) ([]byte, error) {
	field, ok := replicaSpecField[kind]
	if !ok {
		return nil, fmt.Errorf("%s cannot be scaled through this API", kind)
	}
	return json.Marshal(map[string]interface{}{
		"spec": map[string]interface{}{field: p.Replicas},
	})
}
