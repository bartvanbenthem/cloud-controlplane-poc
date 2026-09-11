import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { CustomResource, Kind } from "../types";
import { StatusBadge } from "./StatusBadge";

/** Shows the Log Collectors (AlloyInstances) shipping to this LokiInstance.
 * Loki and Alloy are many-to-one, not the strict 1:1 pairing Monitoring
 * has between Grafana and Prometheus, so a LokiInstance's collectors are
 * listed here rather than merged into one row/detail — see LoggingList for
 * the matching per-row count. No-op for every other kind. */
export function LogCollectorsPanel({
  kind,
  namespace,
  name,
}: {
  kind: Kind;
  namespace: string;
  name: string;
}) {
  const [collectors, setCollectors] = useState<CustomResource[] | null>(null);

  useEffect(() => {
    if (kind !== "lokiinstances") return;
    let cancelled = false;
    const load = () =>
      api
        .list("alloyinstances", namespace)
        .then((items) => {
          if (!cancelled) {
            setCollectors(items.filter((a) => (a.spec as { lokiInstanceRef?: string }).lokiInstanceRef === name));
          }
        })
        .catch(() => !cancelled && setCollectors([]));

    load();
    const id = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [kind, namespace, name]);

  if (kind !== "lokiinstances" || collectors === null) return null;

  return (
    <div className="panel">
      <h3>Log Collectors</h3>
      {collectors.length === 0 ? (
        <p className="empty-state">
          No Log Collectors ship to this instance yet.{" "}
          <Link to="/observability/logging/shippers/new">Create one</Link>.
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Replicas</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {collectors.map((c) => (
              <tr key={c.metadata.name}>
                <td>
                  <Link to={`/observability/logging/shippers/${namespace}/${c.metadata.name}`}>
                    {c.metadata.name}
                  </Link>
                </td>
                <td className="muted">{(c.spec as { replicas?: number }).replicas ?? "?"}</td>
                <td>
                  <StatusBadge resource={c} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
