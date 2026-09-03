import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export function Dashboard() {
  const [clusterCount, setClusterCount] = useState<number | null>(null);
  const [databaseCount, setDatabaseCount] = useState<number | null>(null);
  const [observabilityCount, setObservabilityCount] = useState<number | null>(null);
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
        setDatabaseCount(postgres.length + valkey.length);
        setObservabilityCount(grafana.length);
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  return (
    <>
      <div className="page-header">
        <h2>CloudNative Control Plane</h2>
      </div>
      {error && <div className="error-banner">{error}</div>}

      <div className="category-grid">
        <Link to="/runtime" className="category-card">
          <h3>Runtime</h3>
          <p className="muted">STACKIT, OpenShift, VMware &amp; AKS</p>
          <div className="category-stats">
            <span>{clusterCount ?? "…"} clusters</span>
          </div>
        </Link>

        <Link to="/database" className="category-card">
          <h3>Database</h3>
          <p className="muted">PostgreSQL &amp; Redis</p>
          <div className="category-stats">
            <span>{databaseCount ?? "…"} building blocks</span>
          </div>
        </Link>

        <Link to="/observability" className="category-card">
          <h3>Observability</h3>
          <p className="muted">Monitoring</p>
          <div className="category-stats">
            <span>{observabilityCount ?? "…"} instances</span>
          </div>
        </Link>

        <Link to="/messaging" className="category-card">
          <h3>Messaging</h3>
          <p className="muted">Message queues &amp; event streaming</p>
          <div className="category-stats">
            <span className="muted">Not integrated yet</span>
          </div>
        </Link>

        <Link to="/network" className="category-card">
          <h3>Network</h3>
          <p className="muted">Networking building blocks</p>
          <div className="category-stats">
            <span className="muted">Not integrated yet</span>
          </div>
        </Link>

        <Link to="/security" className="category-card">
          <h3>Security</h3>
          <p className="muted">Security &amp; secrets building blocks</p>
          <div className="category-stats">
            <span className="muted">Not integrated yet</span>
          </div>
        </Link>
      </div>
    </>
  );
}
