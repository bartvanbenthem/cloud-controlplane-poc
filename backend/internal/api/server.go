package api

import (
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// ServerRequest is the create payload for a Server resource. Field set and
// validation mirror templates/stackit-server/template.yaml from the
// Backstage POC this portal replaces, so a manifest produced here is
// identical in shape to one that scaffolder used to open a PR for.
type ServerRequest struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	ProjectID string `json:"projectId"`
	Region    string `json:"region"`

	MachineType      string `json:"machineType"`
	AvailabilityZone string `json:"availabilityZone,omitempty"`
	PowerState       string `json:"powerState"`

	ImageID                       string `json:"imageId"`
	BootVolumeSize                int64  `json:"bootVolumeSize"`
	BootVolumePerformanceClass    string `json:"bootVolumePerformanceClass,omitempty"`
	DeleteBootVolumeOnTermination bool   `json:"deleteBootVolumeOnTermination"`

	NetworkID      string   `json:"networkId"`
	KeypairName    string   `json:"keypairName,omitempty"`
	SecurityGroups []string `json:"securityGroups,omitempty"`
	UserData       string   `json:"userData,omitempty"`

	Environment string `json:"environment"`
	Team        string `json:"team,omitempty"`
}

func (r *ServerRequest) applyDefaults() {
	if r.Namespace == "" {
		r.Namespace = "default"
	}
	if r.Region == "" {
		r.Region = "eu01"
	}
	if r.MachineType == "" {
		r.MachineType = "c1.2"
	}
	if r.PowerState == "" {
		r.PowerState = "Active"
	}
	if r.BootVolumeSize == 0 {
		r.BootVolumeSize = 32
	}
	if r.Environment == "" {
		r.Environment = "dev"
	}
}

func (r ServerRequest) validate() error {
	if err := validateName("name", r.Name); err != nil {
		return err
	}
	if err := validateUUID("projectId", r.ProjectID); err != nil {
		return err
	}
	if err := requireNonEmpty("region", r.Region); err != nil {
		return err
	}
	if err := requireNonEmpty("machineType", r.MachineType); err != nil {
		return err
	}
	if r.PowerState != "Active" && r.PowerState != "Inactive" {
		return fmt.Errorf("powerState must be Active or Inactive")
	}
	if err := validateUUID("imageId", r.ImageID); err != nil {
		return err
	}
	if r.BootVolumeSize < 1 {
		return fmt.Errorf("bootVolumeSize must be at least 1")
	}
	if err := validateUUID("networkId", r.NetworkID); err != nil {
		return err
	}
	switch r.Environment {
	case "dev", "staging", "prod":
	default:
		return fmt.Errorf("environment must be dev, staging, or prod")
	}
	return nil
}

func (r ServerRequest) toUnstructured() *unstructured.Unstructured {
	labels := map[string]interface{}{
		"environment": r.Environment,
		"managed-by":  "cloud-controlplane-portal",
	}
	if r.Team != "" {
		labels["team"] = r.Team
	}

	spec := map[string]interface{}{
		"projectId":   r.ProjectID,
		"region":      r.Region,
		"machineType": r.MachineType,
		"imageId":     r.ImageID,
		"networkId":   r.NetworkID,
		"bootVolume": map[string]interface{}{
			"size":                r.BootVolumeSize,
			"deleteOnTermination": r.DeleteBootVolumeOnTermination,
		},
		"labels":     labels,
		"powerState": r.PowerState,
	}
	if r.AvailabilityZone != "" {
		spec["availabilityZone"] = r.AvailabilityZone
	}
	if r.BootVolumePerformanceClass != "" {
		spec["bootVolume"].(map[string]interface{})["performanceClass"] = r.BootVolumePerformanceClass
	}
	if r.KeypairName != "" {
		spec["keypairName"] = r.KeypairName
	}
	if len(r.SecurityGroups) > 0 {
		sgs := make([]interface{}, len(r.SecurityGroups))
		for i, sg := range r.SecurityGroups {
			sgs[i] = sg
		}
		spec["securityGroups"] = sgs
	}
	if r.UserData != "" {
		spec["userData"] = r.UserData
	}

	metaLabels := map[string]interface{}{
		"environment": r.Environment,
	}
	if r.Team != "" {
		metaLabels["team"] = r.Team
	}

	obj := &unstructured.Unstructured{}
	obj.SetUnstructuredContent(map[string]interface{}{
		"apiVersion": group + "/" + version,
		"kind":       "Server",
		"metadata": map[string]interface{}{
			"name":      r.Name,
			"namespace": r.Namespace,
			"labels":    metaLabels,
		},
		"spec": spec,
	})
	return obj
}
