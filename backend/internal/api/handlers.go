// Package api implements the portal's HTTP API: CRUD over the
// compute.sostackit.dev Cluster custom resource via a Kubernetes dynamic
// client, plus a namespace listing used by the create form.
package api

import (
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/types"

	"github.com/bartvanbenthem/cloud-controlplane-poc/backend/internal/k8s"
)

type Server struct {
	clients        *k8s.Clients
	log            *slog.Logger
	grafanaTunnels *grafanaTunnels
}

func NewServer(clients *k8s.Clients, log *slog.Logger) *Server {
	return &Server{clients: clients, log: log, grafanaTunnels: newGrafanaTunnels()}
}

// Register mounts the API's routes onto mux. Kept separate from the
// caller's mux so main can add static-file serving and middleware around
// it without this package knowing about either.
func (s *Server) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /healthz", s.handleHealth)

	mux.HandleFunc("GET /api/namespaces", s.handleListNamespaces)

	mux.HandleFunc("GET /api/volumes", s.handleListVolumes)
	mux.HandleFunc("DELETE /api/volumes/{namespace}/{name}", s.handleDeleteVolume)

	mux.HandleFunc("GET /api/resources/{kind}", s.handleList)
	mux.HandleFunc("POST /api/resources/{kind}", s.handleCreate)
	mux.HandleFunc("GET /api/resources/{kind}/{namespace}/{name}", s.handleGet)
	mux.HandleFunc("PATCH /api/resources/{kind}/{namespace}/{name}", s.handlePatch)
	mux.HandleFunc("DELETE /api/resources/{kind}/{namespace}/{name}", s.handleDelete)
	mux.HandleFunc("GET /api/resources/{kind}/{namespace}/{name}/credentials", s.handleGetCredentials)

	mux.HandleFunc("/grafana/{namespace}/{name}/{rest...}", s.handleGrafanaProxy)
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

// handlePatch edits one already-created resource in place, via a JSON
// Merge Patch against its spec. Unlike handleCreate this isn't wired up
// for every Kind -- only GrafanaInstance's lokiRef is editable through the
// portal today (see MonitoringDetail's Loki-datasource panel), so every
// other kind is rejected outright rather than silently accepting a patch
// it doesn't know how to build.
func (s *Server) handlePatch(w http.ResponseWriter, r *http.Request) {
	kind, err := parseKind(r.PathValue("kind"))
	if err != nil {
		writeError(w, http.StatusNotFound, err)
		return
	}
	ns, name := r.PathValue("namespace"), r.PathValue("name")

	var patch []byte
	switch kind {
	case KindGrafana:
		req := &GrafanaLokiRefPatch{}
		if err := json.NewDecoder(r.Body).Decode(req); err != nil {
			writeError(w, http.StatusBadRequest, errors.New("invalid JSON body"))
			return
		}
		patch, err = req.mergePatch()
		if err != nil {
			writeError(w, http.StatusInternalServerError, err)
			return
		}
	default:
		writeError(w, http.StatusMethodNotAllowed, fmt.Errorf("%s cannot be edited", kind))
		return
	}

	updated, err := s.clients.Dynamic.Resource(kind.gvr()).Namespace(ns).Patch(r.Context(), name, types.MergePatchType, patch, metav1.PatchOptions{})
	if err != nil {
		s.writeK8sError(w, err)
		return
	}
	s.log.Info("patched resource", "kind", kind, "namespace", ns, "name", name)
	writeJSON(w, http.StatusOK, updated.Object)
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
	var bootVolume *unstructured.Unstructured
	switch kind {
	case KindCluster:
		req := &ClusterRequest{}
		if status, err := decodeAndValidate(r, req); err != nil {
			writeError(w, status, err)
			return
		}
		obj = req.toUnstructured()
	case KindServer:
		req := &ServerRequest{}
		if status, err := decodeAndValidate(r, req); err != nil {
			writeError(w, status, err)
			return
		}
		// Created ahead of the Server so spec.bootVolumeRef resolves
		// immediately — see volumeGVR's doc comment in resources.go.
		vol, err := s.clients.Dynamic.Resource(volumeGVR).Namespace(req.Namespace).Create(r.Context(), req.toVolumeUnstructured(), metav1.CreateOptions{})
		if err != nil {
			s.writeK8sError(w, err)
			return
		}
		bootVolume = vol
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
	case KindMariaDB:
		req := &MariaDBRequest{}
		if status, err := decodeAndValidate(r, req); err != nil {
			writeError(w, status, err)
			return
		}
		obj = req.toUnstructured()
	case KindMongoDB:
		req := &MongoDBRequest{}
		if status, err := decodeAndValidate(r, req); err != nil {
			writeError(w, status, err)
			return
		}
		obj = req.toUnstructured()
	case KindRabbitMQ:
		req := &RabbitMQRequest{}
		if status, err := decodeAndValidate(r, req); err != nil {
			writeError(w, status, err)
			return
		}
		obj = req.toUnstructured()
	case KindKafka:
		req := &KafkaRequest{}
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
	case KindPrometheus:
		req := &PrometheusRequest{}
		if status, err := decodeAndValidate(r, req); err != nil {
			writeError(w, status, err)
			return
		}
		obj = req.toUnstructured()
	case KindLoki:
		req := &LokiRequest{}
		if status, err := decodeAndValidate(r, req); err != nil {
			writeError(w, status, err)
			return
		}
		obj = req.toUnstructured()
	}

	created, err := s.clients.Dynamic.Resource(kind.gvr()).Namespace(obj.GetNamespace()).Create(r.Context(), obj, metav1.CreateOptions{})
	if err != nil {
		if bootVolume != nil {
			// Roll back the boot volume created above so a failed Server
			// create doesn't leave an orphaned (billable) one behind.
			if delErr := s.clients.Dynamic.Resource(volumeGVR).Namespace(bootVolume.GetNamespace()).Delete(r.Context(), bootVolume.GetName(), metav1.DeleteOptions{}); delErr != nil {
				s.log.Error("failed to roll back orphaned boot volume", "error", delErr, "volume", bootVolume.GetName())
			}
		}
		s.writeK8sError(w, err)
		return
	}
	s.log.Info("created resource", "kind", kind, "namespace", created.GetNamespace(), "name", created.GetName())
	if kind == KindGrafana {
		scheme := "http"
		if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" {
			scheme = "https"
		}
		go s.provisionGrafanaSubPath(created.GetNamespace(), created.GetName(), scheme, r.Host)
	}
	if bootVolume != nil {
		// Own the boot volume by the Server it backs, so deleting the
		// Server through the portal also garbage-collects the volume
		// (and, via its own finalizer, the underlying STACKIT volume)
		// instead of leaving it orphaned.
		bootVolume.SetOwnerReferences([]metav1.OwnerReference{{
			APIVersion:         stackitGroup + "/" + stackitVersion,
			Kind:               "Server",
			Name:               created.GetName(),
			UID:                created.GetUID(),
			Controller:         boolPtr(true),
			BlockOwnerDeletion: boolPtr(true),
		}})
		if _, err := s.clients.Dynamic.Resource(volumeGVR).Namespace(bootVolume.GetNamespace()).Update(r.Context(), bootVolume, metav1.UpdateOptions{}); err != nil {
			s.log.Error("failed to set boot volume owner reference", "error", err, "volume", bootVolume.GetName())
		}
	}
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

func boolPtr(b bool) *bool {
	return &b
}
