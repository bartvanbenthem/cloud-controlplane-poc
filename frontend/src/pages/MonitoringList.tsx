import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { CustomResource } from "../types";
import { StatusBadge } from "../components/StatusBadge";

const POLL_INTERVAL_MS = 5000;

type MonitoringKind = "grafana" | "prometheus";

interface MonitoringItem {
  kind: MonitoringKind;
  resource: CustomResource;
}

function summarize(item: MonitoringItem): string {
  if (item.kind === "grafana") {
    const spec = item.resource.spec as { replicas?: number; version?: string };
    return [`${spec.replicas ?? "?"} replica(s)`, spec.version].filter(Boolean).join(" · ");
  }
  const spec = item.resource.spec as { replicas?: number; retention?: string };
  return [`${spec.replicas ?? "?"} replica(s)`, spec.retention].filter(Boolean).join(" · ");
}

/** Lists both Monitoring resource kinds project-easter fronts —
 * GrafanaInstance and PrometheusInstance — in one table, since they're kept
 * under a single "Monitoring" nav entry rather than split into two pages. */
export function MonitoringList() {
  const [items, setItems] = useState<MonitoringItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      Promise.all([api.list("grafanainstances"), api.list("prometheusinstances")])
        .then(([grafana, prometheus]) => {
          if (cancelled) return;
          const merged: MonitoringItem[] = [
            ...grafana.map((resource) => ({ kind: "grafana" as const, resource })),
            ...prometheus.map((resource) => ({ kind: "prometheus" as const, resource })),
          ].sort((a, b) => a.resource.metadata.name.localeCompare(b.resource.metadata.name));
          setItems(merged);
          setError(null);
        })
        .catch((e) => !cancelled && setError(String(e.message ?? e)));

    load();
    const id = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <>
      <div className="page-header">
        <h2>Monitoring Instances</h2>
        <Link className="btn" to="/observability/monitoring/new">
          + Install Monitoring
        </Link>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {items === null ? (
        <p className="muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="empty-state">
          Nothing here yet. <Link to="/observability/monitoring/new">Install monitoring</Link>.
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Namespace</th>
              <th>Summary</th>
              <th>Status</th>
              <th>Age</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={`${item.kind}/${item.resource.metadata.namespace}/${item.resource.metadata.name}`}>
                <td>
                  <Link
                    to={`/observability/monitoring/${item.kind}/${item.resource.metadata.namespace}/${item.resource.metadata.name}`}
                  >
                    {item.resource.metadata.name}
                  </Link>
                </td>
                <td className="muted">{item.kind === "grafana" ? "Grafana" : "Prometheus"}</td>
                <td className="muted">{item.resource.metadata.namespace}</td>
                <td className="muted">{summarize(item)}</td>
                <td>
                  <StatusBadge resource={item.resource} />
                </td>
                <td className="muted">{age(item.resource.metadata.creationTimestamp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function age(ts?: string): string {
  if (!ts) return "–";
  const ms = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
