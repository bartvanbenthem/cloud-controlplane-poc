export type Kind = "clusters" | "postgresclusters" | "valkeyclusters" | "grafanainstances";

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

/** A Cluster/PostgresCluster/ValkeyCluster/GrafanaInstance custom resource
 * as returned by the API — spec/status shape is whatever the owning
 * operator writes, so it's kept loosely typed rather than mirrored
 * field-for-field here. */
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

export interface PostgresCreateRequest {
  name: string;
  namespace: string;
  instances: number;
  image?: string;
  storageSize: string;
  storageClass?: string;
  databaseName: string;
  databaseOwner: string;
  requestsCpu?: string;
  requestsMemory?: string;
  limitsCpu?: string;
  limitsMemory?: string;
}

export interface ValkeyCreateRequest {
  name: string;
  namespace: string;
  shards: number;
  replicas: number;
  image?: string;
  persistenceSize: string;
  persistenceStorageClass?: string;
  requestsCpu?: string;
  requestsMemory?: string;
  limitsCpu?: string;
  limitsMemory?: string;
}

export interface GrafanaCreateRequest {
  name: string;
  namespace: string;
  version?: string;
  replicas: number;
  persistenceSize?: string;
  persistenceStorageClass?: string;
}
