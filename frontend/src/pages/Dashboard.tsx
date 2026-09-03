import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export function Dashboard() {
  const [clusterCount, setClusterCount] = useState<number | null>(null);
  const [paasCount, setPaasCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.list("clusters"),
      api.list("postgresclusters"),
      api.list("valkeyclusters"),
      api.list("grafanainstances"),
    ])
      .then(([clusters, postgres, valkey, grafana]) => {
        setClusterCount(clusters.length);
        setPaasCount(postgres.length + valkey.length + grafana.length);
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  return (
    <>
      <div className="page-header">
        <h2>MultiCloud Dashboard</h2>
      </div>
      {error && <div className="error-banner">{error}</div>}

      <div className="category-grid">
        <Link to="/runtime" className="category-card">
          <h3>Runtime</h3>
          <p className="muted">STACKIT, OpenShift &amp; VMware</p>
          <div className="category-stats">
            <span>{clusterCount ?? "…"} clusters</span>
          </div>
        </Link>

        <Link to="/paas" className="category-card">
          <h3>PaaS</h3>
          <p className="muted">PostgreSQL, Redis &amp; Monitoring</p>
          <div className="category-stats">
            <span>{paasCount ?? "…"} building blocks</span>
          </div>
        </Link>
      </div>
    </>
  );
}
