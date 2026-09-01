export type Kind = "servers" | "clusters";

export interface Condition {
  type: string;
  status: string;
  reason?: string;
  message?: string;
  lastTransitionTime?: string;
}

export interface ObjectMeta {
  name: string;
  namespace: string;
  creationTimestamp?: string;
  labels?: Record<string, string>;
  resourceVersion?: string;
  uid?: string;
}

/** A Server or Cluster custom resource as returned by the API — spec/status
 * shape is whatever the stackit-compute-operator writes, so both are kept
 * loosely typed rather than mirrored field-for-field here. */
export interface CustomResource {
  apiVersion: string;
  kind: string;
  metadata: ObjectMeta;
  spec: Record<string, unknown>;
  status?: {
    conditions?: Condition[];
    [key: string]: unknown;
  };
}

export interface ApiError {
  error: string;
}

export interface ServerCreateRequest {
  name: string;
  namespace: string;
  projectId: string;
  region: string;
  machineType: string;
  availabilityZone?: string;
  powerState: "Active" | "Inactive";
  imageId: string;
  bootVolumeSize: number;
  bootVolumePerformanceClass?: string;
  deleteBootVolumeOnTermination: boolean;
  networkId: string;
  keypairName?: string;
  securityGroups: string[];
  userData?: string;
  environment: "dev" | "staging" | "prod";
  team?: string;
}

export interface ClusterCreateRequest {
  name: string;
  namespace: string;
  projectId: string;
  region: string;
  kubernetesVersion: string;
  poolName: string;
  poolMachineType: string;
  poolMachineImageName: string;
  poolMachineImageVersion: string;
  poolAvailabilityZones: string[];
  poolMinimum: number;
  poolMaximum: number;
  poolVolumeSize: number;
  autoUpdateKubernetesVersion: boolean;
  autoUpdateMachineImageVersion: boolean;
  maintenanceStart?: string;
  maintenanceEnd?: string;
  environment: "dev" | "staging" | "prod";
  team?: string;
}
