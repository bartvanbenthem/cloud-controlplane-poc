package api

import (
	"fmt"
	"regexp"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

var kubernetesVersionPattern = regexp.MustCompile(`^\d+\.\d+\.\d+$`)

// ClusterRequest is the create payload for a Cluster resource, with a
// single node pool — mirroring templates/stackit-ske-cluster/template.yaml.
// Additional node pools can be added via kubectl/the Kubernetes API once
// the cluster exists; the form only covers what SKE needs at creation.
type ClusterRequest struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	ProjectID string `json:"projectId"`
	Region    string `json:"region"`

	KubernetesVersion string `json:"kubernetesVersion"`

	PoolName                string   `json:"poolName"`
	PoolMachineType         string   `json:"poolMachineType"`
	PoolMachineImageName    string   `json:"poolMachineImageName"`
	PoolMachineImageVersion string   `json:"poolMachineImageVersion"`
	PoolAvailabilityZones   []string `json:"poolAvailabilityZones"`
	PoolMinimum             int64    `json:"poolMinimum"`
	PoolMaximum             int64    `json:"poolMaximum"`
	PoolVolumeSize          int64    `json:"poolVolumeSize"`

	AutoUpdateKubernetesVersion   bool   `json:"autoUpdateKubernetesVersion"`
	AutoUpdateMachineImageVersion bool   `json:"autoUpdateMachineImageVersion"`
	MaintenanceStart              string `json:"maintenanceStart,omitempty"`
	MaintenanceEnd                string `json:"maintenanceEnd,omitempty"`

	Environment string `json:"environment"`
	Team        string `json:"team,omitempty"`
}

func (r *ClusterRequest) applyDefaults() {
	if r.Namespace == "" {
		r.Namespace = "default"
	}
	if r.Region == "" {
		r.Region = "eu01"
	}
	if r.KubernetesVersion == "" {
		r.KubernetesVersion = "1.31.1"
	}
	if r.PoolName == "" {
		r.PoolName = "pool-1"
	}
	if r.PoolMachineType == "" {
		r.PoolMachineType = "c2i.2"
	}
	if r.PoolMachineImageName == "" {
		r.PoolMachineImageName = "flatcar"
	}
	if r.PoolMachineImageVersion == "" {
		r.PoolMachineImageVersion = "4593.2.2"
	}
	if len(r.PoolAvailabilityZones) == 0 {
		r.PoolAvailabilityZones = []string{"eu01-1"}
	}
	if r.PoolMaximum == 0 {
		r.PoolMaximum = 3
	}
	if r.PoolVolumeSize == 0 {
		r.PoolVolumeSize = 32
	}
	if r.MaintenanceStart == "" {
		r.MaintenanceStart = "2024-01-01T02:00:00Z"
	}
	if r.MaintenanceEnd == "" {
		r.MaintenanceEnd = "2024-01-01T04:00:00Z"
	}
	if r.Environment == "" {
		r.Environment = "dev"
	}
}

func (r ClusterRequest) validate() error {
	if err := validateName("name", r.Name); err != nil {
		return err
	}
	if err := validateUUID("projectId", r.ProjectID); err != nil {
		return err
	}
	if err := requireNonEmpty("region", r.Region); err != nil {
		return err
	}
	if !kubernetesVersionPattern.MatchString(r.KubernetesVersion) {
		return fmt.Errorf("kubernetesVersion must look like 1.31.1")
	}
	if len(r.PoolName) == 0 || len(r.PoolName) > 15 {
		return fmt.Errorf("poolName is required and must be 15 characters or fewer")
	}
	if err := requireNonEmpty("poolMachineType", r.PoolMachineType); err != nil {
		return err
	}
	if len(r.PoolAvailabilityZones) == 0 {
		return fmt.Errorf("poolAvailabilityZones must contain at least one zone")
	}
	if r.PoolMinimum < 0 {
		return fmt.Errorf("poolMinimum cannot be negative")
	}
	if r.PoolMaximum < 1 || r.PoolMaximum < r.PoolMinimum {
		return fmt.Errorf("poolMaximum must be at least 1 and at least poolMinimum")
	}
	if r.PoolVolumeSize < 1 {
		return fmt.Errorf("poolVolumeSize must be at least 1")
	}
	switch r.Environment {
	case "dev", "staging", "prod":
	default:
		return fmt.Errorf("environment must be dev, staging, or prod")
	}
	return nil
}

func (r ClusterRequest) toUnstructured() *unstructured.Unstructured {
	azs := make([]interface{}, len(r.PoolAvailabilityZones))
	for i, az := range r.PoolAvailabilityZones {
		azs[i] = az
	}

	spec := map[string]interface{}{
		"projectId":         r.ProjectID,
		"region":            r.Region,
		"kubernetesVersion": r.KubernetesVersion,
		"nodePools": []interface{}{
			map[string]interface{}{
				"name":                  r.PoolName,
				"machineType":           r.PoolMachineType,
				"machineImageName":      r.PoolMachineImageName,
				"machineImageVersion":   r.PoolMachineImageVersion,
				"availabilityZones":     azs,
				"minimum":               r.PoolMinimum,
				"maximum":               r.PoolMaximum,
				"allowSystemComponents": true,
				"volume": map[string]interface{}{
					"size": r.PoolVolumeSize,
				},
			},
		},
		"maintenance": map[string]interface{}{
			"autoUpdateKubernetesVersion":   r.AutoUpdateKubernetesVersion,
			"autoUpdateMachineImageVersion": r.AutoUpdateMachineImageVersion,
			"start":                         r.MaintenanceStart,
			"end":                           r.MaintenanceEnd,
		},
	}

	metaLabels := map[string]interface{}{
		"environment": r.Environment,
	}
	if r.Team != "" {
		metaLabels["team"] = r.Team
	}

	obj := &unstructured.Unstructured{}
	obj.SetUnstructuredContent(map[string]interface{}{
		"apiVersion": stackitGroup + "/" + stackitVersion,
		"kind":       "Cluster",
		"metadata": map[string]interface{}{
			"name":      r.Name,
			"namespace": r.Namespace,
			"labels":    metaLabels,
		},
		"spec": spec,
	})
	return obj
}
