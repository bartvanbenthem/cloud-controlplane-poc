// Package k8s builds the Kubernetes clients the portal uses to talk to the
// API server: a dynamic client for the compute.sostackit.dev CRDs (Server,
// Cluster) and a typed clientset for the small amount of core-API access
// (namespace listing) the UI needs.
package k8s

import (
	"fmt"
	"os"
	"path/filepath"

	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

type Clients struct {
	Dynamic   dynamic.Interface
	Clientset kubernetes.Interface
}

// New resolves a rest.Config the same way kubectl does: in-cluster config
// when running as a pod, falling back to $KUBECONFIG or ~/.kube/config for
// local development.
func New() (*Clients, error) {
	cfg, err := restConfig()
	if err != nil {
		return nil, fmt.Errorf("resolving kubeconfig: %w", err)
	}

	dyn, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return nil, fmt.Errorf("building dynamic client: %w", err)
	}

	cs, err := kubernetes.NewForConfig(cfg)
	if err != nil {
		return nil, fmt.Errorf("building clientset: %w", err)
	}

	return &Clients{Dynamic: dyn, Clientset: cs}, nil
}

func restConfig() (*rest.Config, error) {
	if cfg, err := rest.InClusterConfig(); err == nil {
		return cfg, nil
	}

	kubeconfig := os.Getenv("KUBECONFIG")
	if kubeconfig == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return nil, fmt.Errorf("no in-cluster config and no home dir to find ~/.kube/config: %w", err)
		}
		kubeconfig = filepath.Join(home, ".kube", "config")
	}

	return clientcmd.BuildConfigFromFlags("", kubeconfig)
}
