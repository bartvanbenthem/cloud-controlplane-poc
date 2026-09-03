import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export function DatabaseHome() {
  const [postgresCount, setPostgresCount] = useState<number | null>(null);
  const [valkeyCount, setValkeyCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.list("postgresclusters"), api.list("valkeyclusters")])
      .then(([p, v]) => {
        setPostgresCount(p.length);
        setValkeyCount(v.length);
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  return (
    <>
      <div className="page-header">
        <h2>Database</h2>
      </div>
      <p className="muted" style={{ marginTop: -12, marginBottom: 20 }}>
        Managed database and cache building blocks, via{" "}
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
        <Link to="/database/postgresql" className="category-card">
          <h3>PostgreSQL</h3>
          <p className="muted">CloudNativePG, via project-easter's PostgresCluster</p>
          <div className="category-stats">
            <span>{postgresCount ?? "…"} databases</span>
          </div>
        </Link>

        <Link to="/database/redis" className="category-card">
          <h3>Redis</h3>
          <p className="muted">Valkey, via project-easter's ValkeyCluster</p>
          <div className="category-stats">
            <span>{valkeyCount ?? "…"} caches</span>
          </div>
        </Link>
      </div>
    </>
  );
}
