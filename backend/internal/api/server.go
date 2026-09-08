package api

import (
	"fmt"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// ServerRequest is the create payload for a Server (virtual machine)
// resource — mirroring stackit-compute-operator's ServerSpec. It attaches
// to an existing network by ID (NetworkRef isn't exposed here); the boot
// volume is created as a separate Volume resource and attached via
// BootVolumeRef rather than setting ImageID/BootVolume directly on the
// Server, since STACKIT rejects a create that sets both — see volumeGVR's
// doc comment in resources.go.
type ServerRequest struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`
	ProjectID string `json:"projectId"`
	Region    string `json:"region"`

	MachineType      string `json:"machineType"`
	AvailabilityZone string `json:"availabilityZone,omitempty"`
	ImageID          string `json:"imageId"`
	NetworkID        string `json:"networkId"`

	BootVolumeSize int64 `json:"bootVolumeSize,omitempty"`

	KeypairName string `json:"keypairName,omitempty"`
	UserData    string `json:"userData,omitempty"`
	PowerState  string `json:"powerState,omitempty"`

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
	if r.AvailabilityZone == "" {
		r.AvailabilityZone = "eu01-1"
	}
	if r.BootVolumeSize == 0 {
		r.BootVolumeSize = 32
	}
	if r.PowerState == "" {
		r.PowerState = "Active"
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
	if err := requireNonEmpty("availabilityZone", r.AvailabilityZone); err != nil {
		return err
	}
	if err := validateUUID("imageId", r.ImageID); err != nil {
		return err
	}
	if err := validateUUID("networkId", r.NetworkID); err != nil {
		return err
	}
	if r.BootVolumeSize < 1 {
		return fmt.Errorf("bootVolumeSize must be at least 1")
	}
	switch r.PowerState {
	case "Active", "Inactive":
	default:
		return fmt.Errorf("powerState must be Active or Inactive")
	}
	switch r.Environment {
	case "dev", "staging", "prod":
	default:
		return fmt.Errorf("environment must be dev, staging, or prod")
	}
	return nil
}

// bootVolumeName is the name of the Volume resource created to back this
// Server's boot disk.
func (r ServerRequest) bootVolumeName() string {
	return r.Name + "-boot"
}

// toVolumeUnstructured builds the Volume this Server boots from, created
// ahead of the Server itself so bootVolumeRef can resolve immediately.
func (r ServerRequest) toVolumeUnstructured() *unstructured.Unstructured {
	specLabels := map[string]interface{}{
		"environment": r.Environment,
	}
	metaLabels := map[string]interface{}{
		"environment": r.Environment,
	}
	if r.Team != "" {
		specLabels["team"] = r.Team
		metaLabels["team"] = r.Team
	}

	obj := &unstructured.Unstructured{}
	obj.SetUnstructuredContent(map[string]interface{}{
		"apiVersion": stackitGroup + "/" + stackitVersion,
		"kind":       "Volume",
		"metadata": map[string]interface{}{
			"name":      r.bootVolumeName(),
			"namespace": r.Namespace,
			"labels":    metaLabels,
		},
		"spec": map[string]interface{}{
			"projectId":        r.ProjectID,
			"region":           r.Region,
			"availabilityZone": r.AvailabilityZone,
			"size":             r.BootVolumeSize,
			"bootable":         true,
			"source": map[string]interface{}{
				"id":   r.ImageID,
				"type": "image",
			},
			"labels": specLabels,
		},
	})
	return obj
}

func (r ServerRequest) toUnstructured() *unstructured.Unstructured {
	spec := map[string]interface{}{
		"projectId":   r.ProjectID,
		"region":      r.Region,
		"machineType": r.MachineType,
		"networkId":   r.NetworkID,
		"bootVolumeRef": map[string]interface{}{
			"name": r.bootVolumeName(),
		},
		"powerState": r.PowerState,
	}
	if r.AvailabilityZone != "" {
		spec["availabilityZone"] = r.AvailabilityZone
	}
	if r.KeypairName != "" {
		spec["keypairName"] = r.KeypairName
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
		"apiVersion": stackitGroup + "/" + stackitVersion,
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
