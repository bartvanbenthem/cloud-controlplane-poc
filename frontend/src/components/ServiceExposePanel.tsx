import { useEffect, useState } from "react";
import { api } from "../api";
import type { CustomResource, Kind, ServiceExposeInfo } from "../types";

/** The resource kinds whose create form offers an "expose" field (see
 * backend/internal/api/expose.go's handleGetServiceExpose for exactly which
 * Service(s) each one reads) — GrafanaInstance is deliberately not listed
 * here, since it has no spec.expose of its own (see GrafanaRequest's doc
 * comment) and is instead handled by GrafanaPublicIpPanel for the rare
 * pre-existing/kubectl-applied instance that still carries one. */
const EXPOSE_KINDS: ReadonlySet<Kind> = new Set([
  "postgresclusters",
  "mariadbclusters",
  "mongodbclusters",
  "valkeyclusters",
  "rabbitmqclusters",
  "kafkaclusters",
]);

export function hasExpose(kind: Kind): boolean {
  return EXPOSE_KINDS.has(kind);
}

/** Shows the external address of a resource's own Service, for a resource
 * created with spec.expose.type: LoadBalancer set — the only exposeType the
 * portal's create forms offer (see each *CreateRequest's exposeType field
 * in types.ts). Renders nothing when the resource isn't exposed. */
export function ServiceExposePanel({
  kind,
  namespace,
  name,
  resource,
}: {
  kind: Kind;
  namespace: string;
  name: string;
  resource: CustomResource;
}) {
  const exposeType = (resource.spec as { expose?: { type?: string } }).expose?.type;
  const [info, setInfo] = useState<ServiceExposeInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (exposeType !== "LoadBalancer") return;
    let cancelled = false;
    const load = () =>
      api
        .getServiceExpose(kind, namespace, name)
        .then((i) => {
          if (cancelled) return;
          setInfo(i);
          setError(null);
        })
        .catch((e) => !cancelled && setError(String(e.message ?? e)));

    load();
    const id = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [kind, exposeType, namespace, name]);

  if (exposeType !== "LoadBalancer") return null;

  return (
    <div className="panel">
      <h3>External Address</h3>
      {error && <div className="error-banner">{error}</div>}
      {!error && !info && <p className="muted">Loading…</p>}
      {!error &&
        info &&
        (info.addresses && info.addresses.length > 0 ? (
          <p>
            <code>
              {info.addresses
                .map((a) => (info.port ? `${a}:${info.port}` : a))
                .join(", ")}
            </code>
          </p>
        ) : (
          <p className="muted">Pending — the LoadBalancer hasn't been assigned an address yet.</p>
        ))}
    </div>
  );
}
