package api

import (
	"context"
	"fmt"
	"time"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// vendorGrafanaGVR is grafana-operator's own Grafana CRD — distinct from
// this portal's paas.example.com GrafanaInstance wrapper (KindGrafana).
// The portal otherwise never touches vendor CRDs directly (see
// deploy/02-rbac.yaml's comment); this is a narrow, deliberate exception
// so a freshly-created instance can be served correctly through
// handleGrafanaProxy's /grafana/{namespace}/{name}/ path (Grafana doesn't
// know it's behind a path-prefixing proxy otherwise, and 404s its own
// assets) and can be embedded inline in the portal's Monitoring detail
// page rather than only linked out to in a new tab (Grafana refuses to be
// framed and has no session to present otherwise — see setGrafanaSubPath).
var vendorGrafanaGVR = schema.GroupVersionResource{
	Group:    "grafana.integreatly.org",
	Version:  "v1beta1",
	Resource: "grafanas",
}

const grafanaProvisionTimeout = 60 * time.Second

// provisionGrafanaSubPath waits for the GrafanaInstance's underlying
// vendor Grafana object to appear (project-easter's controller creates it
// asynchronously after the GrafanaInstance itself), then sets its
// root_url/serve_from_sub_path so it renders correctly behind the
// portal's proxy. Runs in a detached goroutine kicked off right after
// GrafanaInstance creation, so the create request itself isn't held open
// waiting on another controller's reconcile loop.
func (s *Server) provisionGrafanaSubPath(ns, name, scheme, host string) {
	ctx, cancel := context.WithTimeout(context.Background(), grafanaProvisionTimeout)
	defer cancel()

	rootURL := fmt.Sprintf("%s://%s/grafana/%s/%s/", scheme, host, ns, name)
	client := s.clients.Dynamic.Resource(vendorGrafanaGVR).Namespace(ns)

	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		obj, err := client.Get(ctx, name, metav1.GetOptions{})
		switch {
		case err == nil:
			if patchErr := setGrafanaSubPath(ctx, client, obj, rootURL); patchErr != nil {
				s.log.Error("configuring grafana sub-path", "namespace", ns, "name", name, "error", patchErr)
			} else {
				s.log.Info("configured grafana sub-path", "namespace", ns, "name", name, "rootUrl", rootURL)
			}
			return
		case apierrors.IsNotFound(err):
			select {
			case <-ticker.C:
				continue
			case <-ctx.Done():
				s.log.Error("configuring grafana sub-path", "namespace", ns, "name", name, "error", "timed out waiting for underlying Grafana object")
				return
			}
		default:
			s.log.Error("configuring grafana sub-path", "namespace", ns, "name", name, "error", err)
			return
		}
	}
}

// grafanaResourceClient is the slice of dynamic.ResourceInterface this
// package needs — narrowed so setGrafanaSubPath doesn't have to import
// dynamic.Interface's full surface.
type grafanaResourceClient interface {
	Update(ctx context.Context, obj *unstructured.Unstructured, opts metav1.UpdateOptions, subresources ...string) (*unstructured.Unstructured, error)
}

// setGrafanaSubPath configures the vendor Grafana object's grafana.ini
// (spec.config.<section>.<key> — see the CRD's own free-form schema) so it
// serves correctly behind the portal's path-prefixing proxy, and so the
// portal can embed it inline (an <iframe> on MonitoringDetail) instead of
// only linking out to it. Both pieces are needed for that:
//   - [security] allow_embedding: Grafana sends X-Frame-Options: deny by
//     default, which blocks framing outright regardless of auth.
//   - [auth.anonymous]: Grafana otherwise has no session to render behind
//     the iframe — the portal's own Basic Auth gate only covers requests
//     that go through its /grafana/{namespace}/{name}/ proxy, it isn't a
//     Grafana-native session grafana.ini can extend into the frame.
//
// Enabling anonymous auth is a property of this Grafana instance itself,
// not of requests routed through the portal's proxy — so anything in the
// cluster that can reach the instance's Service directly (bypassing the
// portal entirely) also gets unauthenticated Viewer access, not just
// browsers going through the portal's Basic Auth gate. Accepted here
// since Viewer is read-only and these instances have no other network
// exposure unless the optional ingress host is set (see
// MonitoringCreate) — worth reconsidering before reusing this pattern
// somewhere with a wider network reach.
func setGrafanaSubPath(ctx context.Context, client grafanaResourceClient, obj *unstructured.Unstructured, rootURL string) error {
	fields := []struct{ value, section, key string }{
		{rootURL, "server", "root_url"},
		{"true", "server", "serve_from_sub_path"},
		{"true", "security", "allow_embedding"},
		{"true", "auth.anonymous", "enabled"},
		{"Viewer", "auth.anonymous", "org_role"},
	}
	for _, f := range fields {
		if err := unstructured.SetNestedField(obj.Object, f.value, "spec", "config", f.section, f.key); err != nil {
			return err
		}
	}
	_, err := client.Update(ctx, obj, metav1.UpdateOptions{})
	return err
}
