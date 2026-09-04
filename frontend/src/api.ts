import type {
  ApiError,
  ClusterCreateRequest,
  CustomResource,
  GrafanaCreateRequest,
  Kind,
  MariaDBCreateRequest,
  PostgresCreateRequest,
  PrometheusCreateRequest,
  RabbitMQCreateRequest,
  ValkeyCreateRequest,
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

  createCluster: (body: ClusterCreateRequest) =>
    request<CustomResource>("/api/resources/clusters", {
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

  createRabbitMQ: (body: RabbitMQCreateRequest) =>
    request<CustomResource>("/api/resources/rabbitmqclusters", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  createPrometheus: (body: PrometheusCreateRequest) =>
    request<CustomResource>("/api/resources/prometheusinstances", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

export { RequestError };
