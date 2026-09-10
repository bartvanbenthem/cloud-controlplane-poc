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

// vendorGrafanaGVR is grafana-operator's own Grafana CRD -- distinct from
// this portal's paas.example.com GrafanaInstance wrapper (KindGrafana).
// The portal otherwise never touches vendor CRDs directly (see
// deploy/02-rbac.yaml's comment); this is a narrow, deliberate exception so
// GrafanaDashboardEmbed's <iframe> (embedding a resource's auto-provisioned
// dashboard inline on its own detail page) can actually render -- Grafana
// refuses to be framed and has no session to present otherwise.
var vendorGrafanaGVR = schema.GroupVersionResource{
	Group:    "grafana.integreatly.org",
	Version:  "v1beta1",
	Resource: "grafanas",
}

const grafanaProvisionTimeout = 60 * time.Second

// provisionGrafanaEmbedding waits for the GrafanaInstance's underlying
// vendor Grafana object to appear (project-easter's controller creates it
// asynchronously after the GrafanaInstance itself), then configures it so
// GrafanaDashboardEmbed's <iframe> -- pointed directly at this instance's
// own Ingress host, since the portal doesn't proxy to Grafana itself --
// can actually render. Runs in a detached goroutine kicked off right after
// GrafanaInstance creation, so the create request itself isn't held open
// waiting on another controller's reconcile loop.
//
// Only called when the GrafanaInstance was created with an ingress host
// (see handleCreate): without one there's no URL for the iframe to embed
// regardless of this config, so there's nothing to provision.
func (s *Server) provisionGrafanaEmbedding(ns, name, ingressHost, tlsSecretName string) {
	ctx, cancel := context.WithTimeout(context.Background(), grafanaProvisionTimeout)
	defer cancel()

	scheme := "http"
	if tlsSecretName != "" {
		scheme = "https"
	}
	rootURL := fmt.Sprintf("%s://%s/", scheme, ingressHost)
	client := s.clients.Dynamic.Resource(vendorGrafanaGVR).Namespace(ns)

	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		obj, err := client.Get(ctx, name, metav1.GetOptions{})
		switch {
		case err == nil:
			if patchErr := setGrafanaEmbedConfig(ctx, client, obj, rootURL); patchErr != nil {
				s.log.Error("configuring grafana embedding", "namespace", ns, "name", name, "error", patchErr)
			} else {
				s.log.Info("configured grafana embedding", "namespace", ns, "name", name, "rootUrl", rootURL)
			}
			return
		case apierrors.IsNotFound(err):
			select {
			case <-ticker.C:
				continue
			case <-ctx.Done():
				s.log.Error("configuring grafana embedding", "namespace", ns, "name", name, "error", "timed out waiting for underlying Grafana object")
				return
			}
		default:
			s.log.Error("configuring grafana embedding", "namespace", ns, "name", name, "error", err)
			return
		}
	}
}

// grafanaResourceClient is the slice of dynamic.ResourceInterface this
// package needs — narrowed so setGrafanaEmbedConfig doesn't have to import
// dynamic.Interface's full surface.
type grafanaResourceClient interface {
	Update(ctx context.Context, obj *unstructured.Unstructured, opts metav1.UpdateOptions, subresources ...string) (*unstructured.Unstructured, error)
}

// setGrafanaEmbedConfig configures the vendor Grafana object's grafana.ini
// (spec.config.<section>.<key> — see the CRD's own free-form schema) so
// GrafanaDashboardEmbed's <iframe> can render this Grafana at its own
// Ingress host:
//   - [server] root_url/serve_from_sub_path: Grafana needs to know its own
//     external URL to generate correct asset/redirect links. It's served
//     at the root of its own Ingress host, not behind any path prefix, so
//     serve_from_sub_path is always false here.
//   - [security] allow_embedding: Grafana sends X-Frame-Options: deny by
//     default, which blocks framing outright regardless of auth.
//   - [auth.anonymous]: Grafana otherwise has no session to render behind
//     the iframe.
//
// Enabling anonymous auth is a property of this Grafana instance itself,
// not of requests routed through any portal proxy — anything that can
// reach this Ingress host directly gets unauthenticated Viewer access, not
// just the portal's own embedded iframe. Accepted here since Viewer is
// read-only, but worth reconsidering before reusing this pattern somewhere
// with a wider audience than a demo.
func setGrafanaEmbedConfig(ctx context.Context, client grafanaResourceClient, obj *unstructured.Unstructured, rootURL string) error {
	fields := []struct{ value, section, key string }{
		{rootURL, "server", "root_url"},
		{"false", "server", "serve_from_sub_path"},
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
