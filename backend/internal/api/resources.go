package api

import (
	"fmt"

	"k8s.io/apimachinery/pkg/runtime/schema"
)

// group/version shared by every stackit-compute-operator CRD this portal
// manages. Kept in one place since it appears in every GVR below.
const (
	group   = "compute.sostackit.dev"
	version = "v1alpha1"
)

// Kind is a portal-facing resource kind name (used in URLs, e.g.
// /api/resources/servers) mapped to the CRD's GroupVersionResource.
type Kind string

const (
	KindServer  Kind = "servers"
	KindCluster Kind = "clusters"
)

func (k Kind) valid() bool {
	return k == KindServer || k == KindCluster
}

func (k Kind) gvr() schema.GroupVersionResource {
	return schema.GroupVersionResource{Group: group, Version: version, Resource: string(k)}
}

func parseKind(s string) (Kind, error) {
	k := Kind(s)
	if !k.valid() {
		return "", fmt.Errorf("unknown resource kind %q: must be %q or %q", s, KindServer, KindCluster)
	}
	return k, nil
}
