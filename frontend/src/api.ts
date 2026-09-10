import type {
  AlloyCreateRequest,
  ApiError,
  ClusterCreateRequest,
  CredentialsResponse,
  CustomResource,
  GrafanaCreateRequest,
  KafkaCreateRequest,
  Kind,
  LokiCreateRequest,
  MariaDBCreateRequest,
  MongoDBCreateRequest,
  PostgresCreateRequest,
  PrometheusCreateRequest,
  RabbitMQCreateRequest,
  ServerCreateRequest,
  ServiceExposeInfo,
  ValkeyCreateRequest,
  Volume,
} from "./types";

class RequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = (await res.json()) as ApiError;
      if (body.error) message = body.error;
    } catch {
      // body wasn't JSON — fall back to statusText
    }
    throw new RequestError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  listNamespaces: () => request<string[]>("/api/namespaces"),

  list: (kind: Kind, namespace?: string) =>
    request<CustomResource[]>(
      `/api/resources/${kind}${namespace ? `?namespace=${encodeURIComponent(namespace)}` : ""}`,
    ),

  get: (kind: Kind, namespace: string, name: string) =>
    request<CustomResource>(
      `/api/resources/${kind}/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`,
    ),

  remove: (kind: Kind, namespace: string, name: string) =>
    request<void>(
      `/api/resources/${kind}/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`,
      { method: "DELETE" },
    ),

  listVolumes: (namespace?: string) =>
    request<Volume[]>(`/api/volumes${namespace ? `?namespace=${encodeURIComponent(namespace)}` : ""}`),

  deleteVolume: (namespace: string, name: string, force = false) =>
    request<void>(
      `/api/volumes/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}${force ? "?force=true" : ""}`,
      { method: "DELETE" },
    ),

  getCredentials: (kind: Kind, namespace: string, name: string) =>
    request<CredentialsResponse>(
      `/api/resources/${kind}/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/credentials`,
    ),

  getServiceExpose: (kind: Kind, namespace: string, name: string) =>
    request<ServiceExposeInfo>(
      `/api/resources/${kind}/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}/service`,
    ),

  createCluster: (body: ClusterCreateRequest) =>
    request<CustomResource>("/api/resources/clusters", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  createServer: (body: ServerCreateRequest) =>
    request<CustomResource>("/api/resources/servers", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  createPostgres: (body: PostgresCreateRequest) =>
    request<CustomResource>("/api/resources/postgresclusters", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  createValkey: (body: ValkeyCreateRequest) =>
    request<CustomResource>("/api/resources/valkeyclusters", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  createGrafana: (body: GrafanaCreateRequest) =>
    request<CustomResource>("/api/resources/grafanainstances", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  createMariaDB: (body: MariaDBCreateRequest) =>
    request<CustomResource>("/api/resources/mariadbclusters", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  createMongoDB: (body: MongoDBCreateRequest) =>
    request<CustomResource>("/api/resources/mongodbclusters", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  createRabbitMQ: (body: RabbitMQCreateRequest) =>
    request<CustomResource>("/api/resources/rabbitmqclusters", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  createKafka: (body: KafkaCreateRequest) =>
    request<CustomResource>("/api/resources/kafkaclusters", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  createPrometheus: (body: PrometheusCreateRequest) =>
    request<CustomResource>("/api/resources/prometheusinstances", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  createLoki: (body: LokiCreateRequest) =>
    request<CustomResource>("/api/resources/lokiinstances", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  createAlloy: (body: AlloyCreateRequest) =>
    request<CustomResource>("/api/resources/alloyinstances", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  /** Sets or clears (pass "") an existing GrafanaInstance's Loki datasource
   * — the only field editable after creation. See MonitoringCreate for the
   * same field at creation time. */
  patchGrafanaLokiRef: (namespace: string, name: string, lokiRef: string) =>
    request<CustomResource>(
      `/api/resources/grafanainstances/${encodeURIComponent(namespace)}/${encodeURIComponent(name)}`,
      { method: "PATCH", body: JSON.stringify({ lokiRef }) },
    ),
};

export { RequestError };
