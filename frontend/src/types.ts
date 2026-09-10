export type Kind =
  | "clusters"
  | "servers"
  | "postgresclusters"
  | "valkeyclusters"
  | "mariadbclusters"
  | "mongodbclusters"
  | "rabbitmqclusters"
  | "kafkaclusters"
  | "grafanainstances"
  | "prometheusinstances"
  | "lokiinstances";

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

/** A PersistentVolumeClaim as the Storage/Volumes page shows it. PVCs are
 * a core Kubernetes resource, not one of the operator-fronted Kinds above,
 * so they get their own type and their own /api/volumes endpoints rather
 * than going through /api/resources/{kind}. */
export interface Volume {
  metadata: ObjectMeta;
  spec: {
    accessModes?: string[];
    resources?: { requests?: { storage?: string } };
    storageClassName?: string;
    volumeName?: string;
  };
  status: {
    phase?: string;
    capacity?: { storage?: string };
  };
  /** Whether any Pod currently mounts this PVC. A detached (false) PVC is
   * safe to force-delete if it's stuck Terminating. */
  attached: boolean;
}

export interface CredentialField {
  label: string;
  value: string;
  sensitive: boolean;
}

export interface CredentialSet {
  label: string;
  fields: CredentialField[];
}

/** Response shape for GET .../credentials. `pending` means the vendor
 * operator hasn't written the credentials Secret yet (resource still
 * provisioning) — the endpoint 404s instead for a kind with no
 * credentials at all. */
export interface CredentialsResponse {
  sets: CredentialSet[];
  pending: boolean;
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

export interface ServerCreateRequest {
  name: string;
  namespace: string;
  projectId: string;
  region: string;
  machineType: string;
  availabilityZone?: string;
  imageId: string;
  networkId: string;
  bootVolumeSize: number;
  keypairName?: string;
  userData?: string;
  powerState: "Active" | "Inactive";
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
  enablePodMonitor: boolean;
  exposeType?: "" | "LoadBalancer" | "NodePort";
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
  exposeType?: "" | "LoadBalancer" | "NodePort";
  enablePodMonitor: boolean;
}

export interface GrafanaCreateRequest {
  name: string;
  namespace: string;
  version?: string;
  replicas: number;
  persistenceSize?: string;
  persistenceStorageClass?: string;
  ingressHost?: string;
  ingressClassName?: string;
  ingressTlsSecretName?: string;
}

export interface MariaDBCreateRequest {
  name: string;
  namespace: string;
  replicas: number;
  image?: string;
  storageSize: string;
  storageClass?: string;
  databaseName: string;
  databaseOwner: string;
  requestsCpu?: string;
  requestsMemory?: string;
  limitsCpu?: string;
  limitsMemory?: string;
  enablePodMonitor: boolean;
  exposeType?: "" | "LoadBalancer" | "NodePort";
}

export interface MongoDBCreateRequest {
  name: string;
  namespace: string;
  replicas: number;
  image?: string;
  storageSize: string;
  storageClass?: string;
  requestsCpu?: string;
  requestsMemory?: string;
  limitsCpu?: string;
  limitsMemory?: string;
  enablePodMonitor: boolean;
  exposeType?: "" | "LoadBalancer" | "NodePort";
}

export interface KafkaCreateRequest {
  name: string;
  namespace: string;
  replicas: number;
  version?: string;
  storageSize: string;
  storageClass?: string;
  requestsCpu?: string;
  requestsMemory?: string;
  limitsCpu?: string;
  limitsMemory?: string;
  enablePodMonitor: boolean;
  exposeType?: "" | "LoadBalancer" | "NodePort";
}

export interface RabbitMQCreateRequest {
  name: string;
  namespace: string;
  replicas: number;
  image?: string;
  storageSize: string;
  storageClass?: string;
  requestsCpu?: string;
  requestsMemory?: string;
  limitsCpu?: string;
  limitsMemory?: string;
  ingressHost?: string;
  ingressClassName?: string;
  ingressTlsSecretName?: string;
  enablePodMonitor: boolean;
}

export interface PrometheusCreateRequest {
  name: string;
  namespace: string;
  version?: string;
  replicas: number;
  retention?: string;
  storageSize?: string;
  storageClass?: string;
  requestsCpu?: string;
  requestsMemory?: string;
  limitsCpu?: string;
  limitsMemory?: string;
  ingressHost?: string;
  ingressClassName?: string;
  ingressTlsSecretName?: string;
}

export type LokiSize = "1x.demo" | "1x.pico" | "1x.extra-small" | "1x.small" | "1x.medium";

export interface LokiCreateRequest {
  name: string;
  namespace: string;
  size: LokiSize;
  storageClassName: string;
  objectStorageSecretName: string;
}
