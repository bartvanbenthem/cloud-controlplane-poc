import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { CustomResource } from "../types";

const POLL_INTERVAL_MS = 5000;

interface MonitoringInstance {
  namespace: string;
  name: string;
  grafana?: CustomResource;
  prometheus?: CustomResource;
}

function readyCondition(r?: CustomResource) {
  return r?.status?.conditions?.find((c) => c.type === "Ready");
}

/** Both GrafanaInstance and PrometheusInstance have to be Ready for
 * monitoring to actually work, so the list shows one combined status per
 * instance rather than two independent badges — see MonitoringDetail for
 * why they're also deleted together. */
function CombinedStatusBadge({ instance }: { instance: MonitoringInstance }) {
  if (!instance.grafana || !instance.prometheus) {
    return (
      <span className="badge warn" title="Grafana and Prometheus should always be created together">
        <span className="dot" />
        Incomplete
      </span>
    );
  }

  const grafanaReady = readyCondition(instance.grafana);
  const prometheusReady = readyCondition(instance.prometheus);

  if (!grafanaReady || !prometheusReady) {
    return (
      <span className="badge unknown">
        <span className="dot" />
        Unknown
      </span>
    );
  }

  const bothTrue = grafanaReady.status === "True" && prometheusReady.status === "True";
  const eitherFalse = grafanaReady.status === "False" || prometheusReady.status === "False";
  const cls = bothTrue ? "ok" : eitherFalse ? "err" : "warn";
  const label = bothTrue ? "Ready" : eitherFalse ? "Not Ready" : "Unknown";
  const title = `Grafana: ${grafanaReady.status}${grafanaReady.message ? ` (${grafanaReady.message})` : ""} · Prometheus: ${prometheusReady.status}${prometheusReady.message ? ` (${prometheusReady.message})` : ""}`;

  return (
    <span className={`badge ${cls}`} title={title}>
      <span className="dot" />
      {label}
    </span>
  );
}

function summarize(instance: MonitoringInstance): string {
  const grafanaSpec = instance.grafana?.spec as { replicas?: number } | undefined;
  const prometheusSpec = instance.prometheus?.spec as { replicas?: number; retention?: string } | undefined;
  return [
    grafanaSpec && `Grafana ${grafanaSpec.replicas ?? "?"}`,
    prometheusSpec && `Prometheus ${prometheusSpec.replicas ?? "?"}${prometheusSpec.retention ? ` (${prometheusSpec.retention})` : ""}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Lists Monitoring instances — a GrafanaInstance + PrometheusInstance pair,
 * project-easter's thin fronts for grafana-operator and the Prometheus
 * Operator — merged by namespace/name into one row each, since the two are
 * installed, viewed, and deleted together as a single monitoring stack. */
export function MonitoringList() {
  const [instances, setInstances] = useState<MonitoringInstance[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      Promise.all([api.list("grafanainstances"), api.list("prometheusinstances")])
        .then(([grafana, prometheus]) => {
          if (cancelled) return;
          const byKey = new Map<string, MonitoringInstance>();
          const keyOf = (r: CustomResource) => `${r.metadata.namespace}/${r.metadata.name}`;
          for (const r of grafana) {
            byKey.set(keyOf(r), { namespace: r.metadata.namespace, name: r.metadata.name, grafana: r });
          }
          for (const r of prometheus) {
            const key = keyOf(r);
            const existing = byKey.get(key);
            if (existing) {
              existing.prometheus = r;
            } else {
              byKey.set(key, { namespace: r.metadata.namespace, name: r.metadata.name, prometheus: r });
            }
          }
          const merged = [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
          setInstances(merged);
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

      {instances === null ? (
        <p className="muted">Loading…</p>
      ) : instances.length === 0 ? (
        <p className="empty-state">
          Nothing here yet. <Link to="/observability/monitoring/new">Install monitoring</Link>.
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Namespace</th>
              <th>Summary</th>
              <th>Status</th>
              <th>Age</th>
            </tr>
          </thead>
          <tbody>
            {instances.map((instance) => (
              <tr key={`${instance.namespace}/${instance.name}`}>
                <td>
                  <Link to={`/observability/monitoring/${instance.namespace}/${instance.name}`}>
                    {instance.name}
                  </Link>
                </td>
                <td className="muted">{instance.namespace}</td>
                <td className="muted">{summarize(instance)}</td>
                <td>
                  <CombinedStatusBadge instance={instance} />
                </td>
                <td className="muted">
                  {age((instance.grafana ?? instance.prometheus)?.metadata.creationTimestamp)}
                </td>
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
