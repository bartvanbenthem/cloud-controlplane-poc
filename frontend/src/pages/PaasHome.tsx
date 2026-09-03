import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export function PaasHome() {
  const [postgresCount, setPostgresCount] = useState<number | null>(null);
  const [valkeyCount, setValkeyCount] = useState<number | null>(null);
  const [grafanaCount, setGrafanaCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.list("postgresclusters"),
      api.list("valkeyclusters"),
      api.list("grafanainstances"),
    ])
      .then(([p, v, g]) => {
        setPostgresCount(p.length);
        setValkeyCount(v.length);
        setGrafanaCount(g.length);
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  return (
    <>
      <div className="page-header">
        <h2>PaaS</h2>
      </div>
      <p className="muted" style={{ marginTop: -12, marginBottom: 20 }}>
        KPN PaaS building blocks, managed by their own operators via{" "}
        <a
          href="https://github.com/bartvanbenthem/project-easter"
          target="_blank"
          rel="noreferrer"
        >
          project-easter
        </a>
        .
      </p>
      {error && <div className="error-banner">{error}</div>}

      <div className="category-grid">
        <Link to="/paas/postgresql" className="category-card">
          <h3>PostgreSQL</h3>
          <p className="muted">CloudNativePG, via project-easter's PostgresCluster</p>
          <div className="category-stats">
            <span>{postgresCount ?? "…"} databases</span>
          </div>
        </Link>

        <Link to="/paas/redis" className="category-card">
          <h3>Redis</h3>
          <p className="muted">Valkey, via project-easter's ValkeyCluster</p>
          <div className="category-stats">
            <span>{valkeyCount ?? "…"} caches</span>
          </div>
        </Link>

        <Link to="/paas/monitoring" className="category-card">
          <h3>Monitoring</h3>
          <p className="muted">Grafana, via project-easter's GrafanaInstance</p>
          <div className="category-stats">
            <span>{grafanaCount ?? "…"} instances</span>
          </div>
        </Link>
      </div>
    </>
  );
}
