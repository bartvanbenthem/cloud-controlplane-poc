import { useEffect, useState } from "react";
import { api } from "../api";
import type { CustomResource, ServiceExposeInfo } from "../types";

/** Shows the external address grafana-operator's own generated Service was
 * assigned, for a GrafanaInstance created with `expose.type: LoadBalancer`
 * (see MonitoringCreate's Expose fieldset). Renders nothing for any other
 * expose type — a ClusterIP/NodePort Service has no public IP to show. */
export function GrafanaPublicIpPanel({
  namespace,
  grafana,
}: {
  namespace: string;
  grafana: CustomResource;
}) {
  const exposeType = (grafana.spec as { expose?: { type?: string } }).expose?.type;
  const [info, setInfo] = useState<ServiceExposeInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (exposeType !== "LoadBalancer") return;
    let cancelled = false;
    const load = () =>
      api
        .getServiceExpose("grafanainstances", namespace, grafana.metadata.name)
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
  }, [exposeType, namespace, grafana.metadata.name]);

  if (exposeType !== "LoadBalancer") return null;

  return (
    <div className="panel">
      <h3>Public IP</h3>
      {error && <div className="error-banner">{error}</div>}
      {!error && !info && <p className="muted">Loading…</p>}
      {!error && info && (
        info.addresses && info.addresses.length > 0 ? (
          <p>
            <code>{info.addresses.join(", ")}</code>
          </p>
        ) : (
          <p className="muted">Pending — the LoadBalancer hasn't been assigned an address yet.</p>
        )
      )}
    </div>
  );
}
