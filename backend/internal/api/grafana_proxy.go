package api

import (
	"context"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"sync"
	"time"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/tools/portforward"
	"k8s.io/client-go/transport/spdy"
)

const grafanaTunnelIdleTimeout = 10 * time.Minute

// grafanaTunnels holds live port-forward tunnels to Grafana pods, keyed by
// "namespace/name", so repeated requests to the same instance reuse one
// tunnel instead of opening a new SPDY connection per HTTP request.
type grafanaTunnels struct {
	mu    sync.Mutex
	byKey map[string]*grafanaTunnel
}

type grafanaTunnel struct {
	localAddr string
	stopCh    chan struct{}
	lastUsed  time.Time
}

func newGrafanaTunnels() *grafanaTunnels {
	t := &grafanaTunnels{byKey: map[string]*grafanaTunnel{}}
	go t.reapIdle()
	return t
}

func (t *grafanaTunnels) reapIdle() {
	for range time.Tick(time.Minute) {
		t.mu.Lock()
		for key, tun := range t.byKey {
			if time.Since(tun.lastUsed) > grafanaTunnelIdleTimeout {
				close(tun.stopCh)
				delete(t.byKey, key)
			}
		}
		t.mu.Unlock()
	}
}

// get returns a local address that forwards to the given GrafanaInstance's
// pod, creating (or replacing a dead) tunnel as needed. Reuse is checked
// with a real dial rather than trusting the cached entry, since the
// forwarded pod can disappear (restart, delete/recreate) out from under a
// long-lived tunnel.
func (t *grafanaTunnels) get(s *Server, ctx context.Context, ns, name string) (string, error) {
	key := ns + "/" + name

	t.mu.Lock()
	defer t.mu.Unlock()

	if tun, ok := t.byKey[key]; ok {
		if conn, err := net.DialTimeout("tcp", tun.localAddr, 2*time.Second); err == nil {
			conn.Close()
			tun.lastUsed = time.Now()
			return tun.localAddr, nil
		}
		close(tun.stopCh)
		delete(t.byKey, key)
	}

	addr, stopCh, err := startGrafanaTunnel(s, ctx, ns, name)
	if err != nil {
		return "", err
	}
	t.byKey[key] = &grafanaTunnel{localAddr: addr, stopCh: stopCh, lastUsed: time.Now()}
	return addr, nil
}

// startGrafanaTunnel opens a port-forward to a running Grafana pod through
// the API server's pods/portforward subresource — the same mechanism
// `kubectl port-forward` uses. This deliberately avoids depending on
// cluster-internal Service DNS/networking, which isn't reachable when the
// portal backend runs outside the cluster (e.g. local development), and
// avoids needing an Ingress or NodePort just to view Grafana.
func startGrafanaTunnel(s *Server, ctx context.Context, ns, name string) (addr string, stopCh chan struct{}, err error) {
	pods, err := s.clients.Clientset.CoreV1().Pods(ns).List(ctx, metav1.ListOptions{
		LabelSelector: "app=" + name,
	})
	if err != nil {
		return "", nil, err
	}
	var podName string
	for _, p := range pods.Items {
		if p.Status.Phase == corev1.PodRunning {
			podName = p.Name
			break
		}
	}
	if podName == "" {
		return "", nil, fmt.Errorf("no running Grafana pod found for %s/%s", ns, name)
	}

	restClient := s.clients.Clientset.CoreV1().RESTClient()
	req := restClient.Post().
		Resource("pods").
		Namespace(ns).
		Name(podName).
		SubResource("portforward")

	transport, upgrader, err := spdy.RoundTripperFor(s.clients.Config)
	if err != nil {
		return "", nil, err
	}
	dialer := spdy.NewDialer(upgrader, &http.Client{Transport: transport}, "POST", req.URL())

	stopCh = make(chan struct{})
	readyCh := make(chan struct{})
	fw, err := portforward.New(dialer, []string{"0:3000"}, stopCh, readyCh, io.Discard, io.Discard)
	if err != nil {
		close(stopCh)
		return "", nil, err
	}

	forwardErrCh := make(chan error, 1)
	go func() {
		forwardErrCh <- fw.ForwardPorts()
	}()

	select {
	case <-readyCh:
	case err := <-forwardErrCh:
		return "", nil, fmt.Errorf("port-forward to %s/%s failed: %w", ns, podName, err)
	case <-time.After(10 * time.Second):
		close(stopCh)
		return "", nil, fmt.Errorf("timed out waiting for port-forward to %s/%s", ns, podName)
	}

	ports, err := fw.GetPorts()
	if err != nil || len(ports) == 0 {
		close(stopCh)
		return "", nil, fmt.Errorf("port-forward to %s/%s did not report a local port", ns, podName)
	}

	return fmt.Sprintf("127.0.0.1:%d", ports[0].Local), stopCh, nil
}

// handleGrafanaProxy forwards /grafana/{namespace}/{name}/... to that
// GrafanaInstance's Grafana pod over a tunnel opened through the API
// server (see startGrafanaTunnel) — no Ingress, NodePort, or
// cluster-internal networking required.
//
// The GrafanaInstance existence check keeps this from proxying to
// whatever pod happens to match "app=<name>" in an arbitrary namespace: a
// client can only reach a pod this way if a GrafanaInstance by that exact
// name/namespace is registered with the portal.
func (s *Server) handleGrafanaProxy(w http.ResponseWriter, r *http.Request) {
	ns := r.PathValue("namespace")
	name := r.PathValue("name")

	if _, err := s.clients.Dynamic.Resource(KindGrafana.gvr()).Namespace(ns).Get(r.Context(), name, metav1.GetOptions{}); err != nil {
		s.writeK8sError(w, err)
		return
	}

	addr, err := s.grafanaTunnels.get(s, r.Context(), ns, name)
	if err != nil {
		s.log.Error("grafana tunnel", "namespace", ns, "name", name, "error", err)
		writeError(w, http.StatusBadGateway, fmt.Errorf("could not reach Grafana: %w", err))
		return
	}

	// The request path is forwarded unchanged, not stripped of its
	// /grafana/{namespace}/{name} prefix: provisionGrafanaSubPath configures
	// each instance's serve_from_sub_path to that exact prefix, so Grafana
	// itself expects to see the full path and resolves its own routes
	// against it.
	target := &url.URL{Scheme: "http", Host: addr}
	proxy := httputil.NewSingleHostReverseProxy(target)
	director := proxy.Director
	proxy.Director = func(req *http.Request) {
		director(req)
		req.Host = target.Host
	}
	proxy.ServeHTTP(w, r)
}
