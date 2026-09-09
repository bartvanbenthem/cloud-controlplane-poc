package api

import (
	"fmt"
	"net/http"

	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

// Volume is a PersistentVolumeClaim as the portal's Storage/Volumes page
// shows it: the PVC itself plus whether any Pod currently mounts it.
// PVCs are core resources (no operator fronts them, unlike every other
// Kind in resources.go), so this reads them through the typed clientset
// rather than the dynamic client, and cross-references Pods to compute
// Attached — that's what "detached" means for ForceDelete below.
type Volume struct {
	Metadata metav1.ObjectMeta                  `json:"metadata"`
	Spec     corev1.PersistentVolumeClaimSpec   `json:"spec"`
	Status   corev1.PersistentVolumeClaimStatus `json:"status"`
	Attached bool                               `json:"attached"`
}

// claimsInUse returns the set of "namespace/claimName" pairs referenced by
// any Pod's spec.volumes, regardless of the Pod's phase — a PVC mounted by
// a completed or crashed Pod is still attached until that Pod is gone.
func claimsInUse(pods []corev1.Pod) map[string]bool {
	inUse := make(map[string]bool)
	for _, pod := range pods {
		for _, vol := range pod.Spec.Volumes {
			if vol.PersistentVolumeClaim != nil {
				inUse[pod.Namespace+"/"+vol.PersistentVolumeClaim.ClaimName] = true
			}
		}
	}
	return inUse
}

func (s *Server) handleListVolumes(w http.ResponseWriter, r *http.Request) {
	ns := r.URL.Query().Get("namespace")

	pvcs, err := s.clients.Clientset.CoreV1().PersistentVolumeClaims(ns).List(r.Context(), metav1.ListOptions{})
	if err != nil {
		s.writeK8sError(w, err)
		return
	}
	pods, err := s.clients.Clientset.CoreV1().Pods(ns).List(r.Context(), metav1.ListOptions{})
	if err != nil {
		s.writeK8sError(w, err)
		return
	}
	inUse := claimsInUse(pods.Items)

	volumes := make([]Volume, 0, len(pvcs.Items))
	for _, pvc := range pvcs.Items {
		volumes = append(volumes, Volume{
			Metadata: pvc.ObjectMeta,
			Spec:     pvc.Spec,
			Status:   pvc.Status,
			Attached: inUse[pvc.Namespace+"/"+pvc.Name],
		})
	}
	writeJSON(w, http.StatusOK, volumes)
}

// handleDeleteVolume deletes a PersistentVolumeClaim. Both the plain and
// ?force=true forms are refused unless the PVC is neither Bound nor
// attached to a Pod — a Bound claim is backed by live data and an
// attached one is actively mounted, so either makes deleting (let alone
// force-deleting) it unsafe. ?force=true additionally strips finalizers
// and deletes with a zero grace period, for a PVC stuck Terminating
// because its CSI driver failed to clean up.
func (s *Server) handleDeleteVolume(w http.ResponseWriter, r *http.Request) {
	ns, name := r.PathValue("namespace"), r.PathValue("name")
	force := r.URL.Query().Get("force") == "true"

	pvc, err := s.clients.Clientset.CoreV1().PersistentVolumeClaims(ns).Get(r.Context(), name, metav1.GetOptions{})
	if err != nil {
		s.writeK8sError(w, err)
		return
	}
	pods, err := s.clients.Clientset.CoreV1().Pods(ns).List(r.Context(), metav1.ListOptions{})
	if err != nil {
		s.writeK8sError(w, err)
		return
	}
	attached := claimsInUse(pods.Items)[ns+"/"+name]
	if attached {
		writeError(w, http.StatusConflict, fmt.Errorf("volume %q is still attached to a pod — detach it before deleting", name))
		return
	}
	if pvc.Status.Phase == corev1.ClaimBound {
		writeError(w, http.StatusConflict, fmt.Errorf("volume %q is still bound — only unbound, detached volumes can be deleted", name))
		return
	}

	if !force {
		if err := s.clients.Clientset.CoreV1().PersistentVolumeClaims(ns).Delete(r.Context(), name, metav1.DeleteOptions{}); err != nil {
			s.writeK8sError(w, err)
			return
		}
		s.log.Info("deleted volume", "namespace", ns, "name", name)
		w.WriteHeader(http.StatusNoContent)
		return
	}

	zero := int64(0)
	deleteErr := s.clients.Clientset.CoreV1().PersistentVolumeClaims(ns).Delete(r.Context(), name, metav1.DeleteOptions{GracePeriodSeconds: &zero})
	if deleteErr != nil && !apierrors.IsNotFound(deleteErr) {
		s.writeK8sError(w, deleteErr)
		return
	}

	if len(pvc.Finalizers) > 0 {
		patch := []byte(`{"metadata":{"finalizers":[]}}`)
		if _, err := s.clients.Clientset.CoreV1().PersistentVolumeClaims(ns).Patch(r.Context(), name, types.MergePatchType, patch, metav1.PatchOptions{}); err != nil && !apierrors.IsNotFound(err) {
			s.writeK8sError(w, err)
			return
		}
	}

	s.log.Info("force-deleted volume", "namespace", ns, "name", name)
	w.WriteHeader(http.StatusNoContent)
}
