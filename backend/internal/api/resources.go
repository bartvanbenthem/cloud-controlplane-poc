package api

import (
	"fmt"

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
	KindCluster  Kind = "clusters"         // STACKIT SKE — compute.sostackit.dev
	KindPostgres Kind = "postgresclusters" // project-easter — paas.example.com
	KindValkey   Kind = "valkeyclusters"   // project-easter — paas.example.com
	KindGrafana  Kind = "grafanainstances" // project-easter — paas.example.com
)

var kindGVRs = map[Kind]schema.GroupVersionResource{
	KindCluster:  {Group: stackitGroup, Version: stackitVersion, Resource: string(KindCluster)},
	KindPostgres: {Group: paasGroup, Version: paasVersion, Resource: string(KindPostgres)},
	KindValkey:   {Group: paasGroup, Version: paasVersion, Resource: string(KindValkey)},
	KindGrafana:  {Group: paasGroup, Version: paasVersion, Resource: string(KindGrafana)},
}

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
		return "", fmt.Errorf("unknown resource kind %q: must be one of %q, %q, %q, %q",
			s, KindCluster, KindPostgres, KindValkey, KindGrafana)
	}
	return k, nil
}
