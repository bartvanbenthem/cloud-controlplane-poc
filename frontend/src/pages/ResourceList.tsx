import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { CustomResource, Kind } from "../types";
import { StatusBadge } from "../components/StatusBadge";

const POLL_INTERVAL_MS = 5000;

export function ResourceList({
  kind,
  title,
  createPath,
}: {
  kind: Kind;
  title: string;
  createPath: string;
}) {
  const [items, setItems] = useState<CustomResource[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      api
        .list(kind)
        .then((r) => {
          if (!cancelled) {
            setItems(r);
            setError(null);
          }
        })
        .catch((e) => !cancelled && setError(String(e.message ?? e)));

    load();
    const id = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [kind]);

  return (
    <>
      <div className="page-header">
        <h2>{title}</h2>
        <Link className="btn" to={createPath}>
          + New {kind === "servers" ? "Server" : "Cluster"}
        </Link>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {items === null ? (
        <p className="muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="empty-state">
          Nothing here yet. <Link to={createPath}>Create one</Link>.
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
            {items.map((r) => (
              <tr key={`${r.metadata.namespace}/${r.metadata.name}`}>
                <td>
                  <Link to={`/${kind}/${r.metadata.namespace}/${r.metadata.name}`}>
                    {r.metadata.name}
                  </Link>
                </td>
                <td className="muted">{r.metadata.namespace}</td>
                <td className="muted">{summarize(kind, r)}</td>
                <td>
                  <StatusBadge resource={r} />
                </td>
                <td className="muted">{age(r.metadata.creationTimestamp)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function summarize(kind: Kind, r: CustomResource): string {
  const spec = r.spec as Record<string, unknown>;
  if (kind === "servers") {
    return [spec.machineType, spec.region].filter(Boolean).join(" · ");
  }
  return [`k8s ${spec.kubernetesVersion}`, spec.region].filter(Boolean).join(" · ");
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
