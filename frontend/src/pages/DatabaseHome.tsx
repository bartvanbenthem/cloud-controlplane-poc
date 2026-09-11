import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { LifecycleBadge } from "../components/LifecycleBadge";

export function DatabaseHome() {
  const [postgresCount, setPostgresCount] = useState<number | null>(null);
  const [valkeyCount, setValkeyCount] = useState<number | null>(null);
  const [mariadbCount, setMariadbCount] = useState<number | null>(null);
  const [mongodbCount, setMongodbCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.list("postgresclusters"),
      api.list("valkeyclusters"),
      api.list("mariadbclusters"),
      api.list("mongodbclusters"),
    ])
      .then(([p, v, m, mo]) => {
        setPostgresCount(p.length);
        setValkeyCount(v.length);
        setMariadbCount(m.length);
        setMongodbCount(mo.length);
      })
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  return (
    <>
      <div className="page-header">
        <div className="page-title">
          <h2>Database</h2>
          <LifecycleBadge status="preview" />
        </div>
      </div>
      <p className="page-description">
        Managed, operator-backed databases and caches for your workloads. Pick a technology below
        to provision an instance — all fronted by{" "}
        <a
          href="https://github.com/bartvanbenthem/project-easter"
          target="_blank"
          rel="noreferrer"
        >
          project-easter
        </a>
        's thin CRDs over the underlying operator.
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

        <Link to="/database/mariadb" className="category-card">
          <h3>MariaDB</h3>
          <p className="muted">mariadb-operator, via project-easter's MariaDBCluster</p>
          <div className="category-stats">
            <span>{mariadbCount ?? "…"} databases</span>
          </div>
        </Link>

        <Link to="/database/mongodb" className="category-card">
          <h3>MongoDB</h3>
          <p className="muted">Percona Server for MongoDB, via project-easter's MongoDBCluster</p>
          <div className="category-stats">
            <span>{mongodbCount ?? "…"} databases</span>
          </div>
        </Link>
      </div>
    </>
  );
}
