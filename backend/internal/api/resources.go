package api

import (
	"fmt"
	"sort"
	"strings"

	"k8s.io/apimachinery/pkg/runtime/schema"
)

// API groups/versions for the operators this portal fronts. Kept in one
// place since each appears in both a GVR below and its Request type's
// toUnstructured().
const (
	stackitGroup   = "compute.sostackit.dev"
	stackitVersion = "v1alpha1"

	paasGroup   = "paas.example.com"
	paasVersion = "v1alpha1"
)

// Kind is a portal-facing resource kind name (used in URLs, e.g.
// /api/resources/clusters) mapped to a CRD's GroupVersionResource.
type Kind string

const (
	KindCluster    Kind = "clusters"            // STACKIT SKE — compute.sostackit.dev
	KindServer     Kind = "servers"             // STACKIT Compute Engine (VM) — compute.sostackit.dev
	KindPostgres   Kind = "postgresclusters"    // project-easter — paas.example.com
	KindValkey     Kind = "valkeyclusters"      // project-easter — paas.example.com
	KindMariaDB    Kind = "mariadbclusters"     // project-easter — paas.example.com
	KindMongoDB    Kind = "mongodbclusters"     // project-easter — paas.example.com
	KindRabbitMQ   Kind = "rabbitmqclusters"    // project-easter — paas.example.com
	KindKafka      Kind = "kafkaclusters"       // project-easter — paas.example.com
	KindGrafana    Kind = "grafanainstances"    // project-easter — paas.example.com
	KindPrometheus Kind = "prometheusinstances" // project-easter — paas.example.com
	KindLoki       Kind = "lokiinstances"       // project-easter — paas.example.com
)

var kindGVRs = map[Kind]schema.GroupVersionResource{
	KindCluster:    {Group: stackitGroup, Version: stackitVersion, Resource: string(KindCluster)},
	KindServer:     {Group: stackitGroup, Version: stackitVersion, Resource: string(KindServer)},
	KindPostgres:   {Group: paasGroup, Version: paasVersion, Resource: string(KindPostgres)},
	KindValkey:     {Group: paasGroup, Version: paasVersion, Resource: string(KindValkey)},
	KindMariaDB:    {Group: paasGroup, Version: paasVersion, Resource: string(KindMariaDB)},
	KindMongoDB:    {Group: paasGroup, Version: paasVersion, Resource: string(KindMongoDB)},
	KindRabbitMQ:   {Group: paasGroup, Version: paasVersion, Resource: string(KindRabbitMQ)},
	KindKafka:      {Group: paasGroup, Version: paasVersion, Resource: string(KindKafka)},
	KindGrafana:    {Group: paasGroup, Version: paasVersion, Resource: string(KindGrafana)},
	KindPrometheus: {Group: paasGroup, Version: paasVersion, Resource: string(KindPrometheus)},
	KindLoki:       {Group: paasGroup, Version: paasVersion, Resource: string(KindLoki)},
}

// volumeGVR is the GVR for Volume resources the portal creates internally
// as a Server's boot volume — not a portal-facing Kind (no
// /api/resources/volumes route). STACKIT rejects a Server create that sets
// both spec.imageId and spec.bootVolume (the two ways of specifying a boot
// disk are mutually exclusive), so instead of setting either directly the
// portal creates a dedicated Volume from the requested image/size and has
// the Server reference it via spec.bootVolumeRef — mirroring
// stackit-compute-operator's own recommended Network+Volume+Server
// pattern (config/samples/full_stack-test.yaml) while keeping that
// resource out of the portal's UI.
var volumeGVR = schema.GroupVersionResource{Group: stackitGroup, Version: stackitVersion, Resource: "volumes"}

func (k Kind) valid() bool {
	_, ok := kindGVRs[k]
	return ok
}

func (k Kind) gvr() schema.GroupVersionResource {
	return kindGVRs[k]
}

func parseKind(s string) (Kind, error) {
	k := Kind(s)
	if !k.valid() {
		names := make([]string, 0, len(kindGVRs))
		for kind := range kindGVRs {
			names = append(names, string(kind))
		}
		sort.Strings(names)
		return "", fmt.Errorf("unknown resource kind %q: must be one of %s", s, strings.Join(names, ", "))
	}
	return k, nil
}
