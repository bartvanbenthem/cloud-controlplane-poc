import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import type { CustomResource } from "../types";
import { StatusBadge } from "../components/StatusBadge";

export function Dashboard() {
  const [servers, setServers] = useState<CustomResource[] | null>(null);
  const [clusters, setClusters] = useState<CustomResource[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.list("servers"), api.list("clusters")])
      .then(([s, c]) => {
        setServers(s);
        setClusters(c);
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  return (
    <>
      <div className="page-header">
        <h2>Dashboard</h2>
      </div>
      {error && <div className="error-banner">{error}</div>}

      <div className="panel">
        <h3>Servers ({servers?.length ?? "…"})</h3>
        {renderSummary(servers, "servers")}
      </div>

      <div className="panel">
        <h3>SKE Clusters ({clusters?.length ?? "…"})</h3>
        {renderSummary(clusters, "clusters")}
      </div>
    </>
  );
}

function renderSummary(items: CustomResource[] | null, kind: "servers" | "clusters") {
  if (items === null) return <p className="muted">Loading…</p>;
  if (items.length === 0) {
    return (
      <p className="empty-state">
        None yet. <Link to={`/${kind}/new`}>Create one</Link>.
      </p>
    );
  }
  return (
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Namespace</th>
          <th>Status</th>
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
            <td>
              <StatusBadge resource={r} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
