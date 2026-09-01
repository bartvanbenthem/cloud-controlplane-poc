import type {
  ApiError,
  ClusterCreateRequest,
  CustomResource,
  Kind,
  ServerCreateRequest,
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

  createServer: (body: ServerCreateRequest) =>
    request<CustomResource>("/api/resources/servers", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  createCluster: (body: ClusterCreateRequest) =>
    request<CustomResource>("/api/resources/clusters", {
      method: "POST",
      body: JSON.stringify(body),
    }),
};

export { RequestError };
