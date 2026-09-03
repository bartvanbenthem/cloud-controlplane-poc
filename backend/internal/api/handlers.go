// Package api implements the portal's HTTP API: CRUD over the
// compute.sostackit.dev Cluster custom resource via a Kubernetes dynamic
// client, plus a namespace listing used by the create form.
package api

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/bartvanbenthem/cloud-controlplane-poc/backend/internal/k8s"
)

type Server struct {
	clients *k8s.Clients
	log     *slog.Logger
}

func NewServer(clients *k8s.Clients, log *slog.Logger) *Server {
	return &Server{clients: clients, log: log}
}

// Register mounts the API's routes onto mux. Kept separate from the
// caller's mux so main can add static-file serving and middleware around
// it without this package knowing about either.
func (s *Server) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /healthz", s.handleHealth)

	mux.HandleFunc("GET /api/namespaces", s.handleListNamespaces)

	mux.HandleFunc("GET /api/resources/{kind}", s.handleList)
	mux.HandleFunc("POST /api/resources/{kind}", s.handleCreate)
	mux.HandleFunc("GET /api/resources/{kind}/{namespace}/{name}", s.handleGet)
	mux.HandleFunc("DELETE /api/resources/{kind}/{namespace}/{name}", s.handleDelete)
}

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) handleListNamespaces(w http.ResponseWriter, r *http.Request) {
	list, err := s.clients.Clientset.CoreV1().Namespaces().List(r.Context(), metav1.ListOptions{})
	if err != nil {
		s.writeK8sError(w, err)
		return
	}
	names := make([]string, 0, len(list.Items))
	for _, ns := range list.Items {
		names = append(names, ns.Name)
	}
	writeJSON(w, http.StatusOK, names)
}

func (s *Server) handleList(w http.ResponseWriter, r *http.Request) {
	kind, err := parseKind(r.PathValue("kind"))
	if err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}

	var list *unstructured.UnstructuredList
	if ns := r.URL.Query().Get("namespace"); ns != "" {
		list, err = s.clients.Dynamic.Resource(kind.gvr()).Namespace(ns).List(r.Context(), metav1.ListOptions{})
	} else {
		list, err = s.clients.Dynamic.Resource(kind.gvr()).List(r.Context(), metav1.ListOptions{})
	}
	if err != nil {
		s.writeK8sError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, list.Items)
}

func (s *Server) handleGet(w http.ResponseWriter, r *http.Request) {
	kind, err := parseKind(r.PathValue("kind"))
	if err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	ns, name := r.PathValue("namespace"), r.PathValue("name")

	obj, err := s.clients.Dynamic.Resource(kind.gvr()).Namespace(ns).Get(r.Context(), name, metav1.GetOptions{})
	if err != nil {
		s.writeK8sError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, obj.Object)
}

func (s *Server) handleDelete(w http.ResponseWriter, r *http.Request) {
	kind, err := parseKind(r.PathValue("kind"))
	if err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	ns, name := r.PathValue("namespace"), r.PathValue("name")

	if err := s.clients.Dynamic.Resource(kind.gvr()).Namespace(ns).Delete(r.Context(), name, metav1.DeleteOptions{}); err != nil {
		s.writeK8sError(w, err)
		return
	}
	s.log.Info("deleted resource", "kind", kind, "namespace", ns, "name", name)
	w.WriteHeader(http.StatusNoContent)
}

// createBody is what every kind's *Request type implements: decode target,
// apply defaults, then self-validate.
type createBody interface {
	applyDefaults()
	validate() error
	toUnstructured() *unstructured.Unstructured
}

// decodeAndValidate decodes r's JSON body into dst, applies its defaults,
// and validates it. status is the HTTP status to respond with on failure,
// zero on success.
func decodeAndValidate[T createBody](r *http.Request, dst T) (status int, err error) {
	if err := json.NewDecoder(r.Body).Decode(dst); err != nil {
		return http.StatusBadRequest, errors.New("invalid JSON body")
	}
	dst.applyDefaults()
	if err := dst.validate(); err != nil {
		return http.StatusUnprocessableEntity, err
	}
	return 0, nil
}

func (s *Server) handleCreate(w http.ResponseWriter, r *http.Request) {
	kind, err := parseKind(r.PathValue("kind"))
	if err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}

	var obj *unstructured.Unstructured
	switch kind {
	case KindCluster:
		req := &ClusterRequest{}
		if status, err := decodeAndValidate(r, req); err != nil {
			writeError(w, status, err)
			return
		}
		obj = req.toUnstructured()
	case KindPostgres:
		req := &PostgresRequest{}
		if status, err := decodeAndValidate(r, req); err != nil {
			writeError(w, status, err)
			return
		}
		obj = req.toUnstructured()
	case KindValkey:
		req := &ValkeyRequest{}
		if status, err := decodeAndValidate(r, req); err != nil {
			writeError(w, status, err)
			return
		}
		obj = req.toUnstructured()
	case KindGrafana:
		req := &GrafanaRequest{}
		if status, err := decodeAndValidate(r, req); err != nil {
			writeError(w, status, err)
			return
		}
		obj = req.toUnstructured()
	}

	created, err := s.clients.Dynamic.Resource(kind.gvr()).Namespace(obj.GetNamespace()).Create(r.Context(), obj, metav1.CreateOptions{})
	if err != nil {
		s.writeK8sError(w, err)
		return
	}
	s.log.Info("created resource", "kind", kind, "namespace", created.GetNamespace(), "name", created.GetName())
	writeJSON(w, http.StatusCreated, created.Object)
}

func (s *Server) writeK8sError(w http.ResponseWriter, err error) {
	status := http.StatusInternalServerError
	switch {
	case apierrors.IsNotFound(err):
		status = http.StatusNotFound
	case apierrors.IsAlreadyExists(err):
		status = http.StatusConflict
	case apierrors.IsForbidden(err):
		status = http.StatusForbidden
	case apierrors.IsInvalid(err), apierrors.IsBadRequest(err):
		status = http.StatusUnprocessableEntity
	}
	if status == http.StatusInternalServerError {
		s.log.Error("kubernetes API error", "error", err)
	}
	writeError(w, status, err)
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, err error) {
	writeJSON(w, status, map[string]string{"error": err.Error()})
}
