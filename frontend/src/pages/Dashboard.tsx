import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export function Dashboard() {
  const [runtimeCount, setRuntimeCount] = useState<number | null>(null);
  const [databaseCount, setDatabaseCount] = useState<number | null>(null);
  const [observabilityCount, setObservabilityCount] = useState<number | null>(null);
  const [messagingCount, setMessagingCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.list("clusters"),
      api.list("servers"),
      api.list("postgresclusters"),
      api.list("valkeyclusters"),
      api.list("mariadbclusters"),
      api.list("grafanainstances"),
      api.list("prometheusinstances"),
      api.list("rabbitmqclusters"),
    ])
      .then(([clusters, servers, postgres, valkey, mariadb, grafana, prometheus, rabbitmq]) => {
        setRuntimeCount(clusters.length + servers.length);
        setDatabaseCount(postgres.length + valkey.length + mariadb.length);
        setObservabilityCount(grafana.length + prometheus.length);
        setMessagingCount(rabbitmq.length);
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
          <p className="muted">Kubernetes &amp; Virtual Machine</p>
          <div className="category-stats">
            <span>{runtimeCount ?? "…"} resources</span>
          </div>
        </Link>

        <Link to="/database" className="category-card">
          <h3>Database</h3>
          <p className="muted">PostgreSQL, Redis &amp; MariaDB</p>
          <div className="category-stats">
            <span>{databaseCount ?? "…"} building blocks</span>
          </div>
        </Link>

        <Link to="/observability" className="category-card">
          <h3>Observability</h3>
          <p className="muted">Monitoring — Grafana &amp; Prometheus</p>
          <div className="category-stats">
            <span>{observabilityCount ?? "…"} instances</span>
          </div>
        </Link>

        <Link to="/messaging" className="category-card">
          <h3>Messaging</h3>
          <p className="muted">RabbitMQ</p>
          <div className="category-stats">
            <span>{messagingCount ?? "…"} brokers</span>
          </div>
        </Link>

        <Link to="/security" className="category-card">
          <h3>Security</h3>
          <p className="muted">Vault &amp; secrets building blocks</p>
          <div className="category-stats">
            <span className="muted">Not integrated yet</span>
          </div>
        </Link>

        <Link to="/developer" className="category-card">
          <h3>Developer</h3>
          <p className="muted">GitOps Instance &amp; Container Registry</p>
          <div className="category-stats">
            <span className="muted">Not integrated yet</span>
          </div>
        </Link>
      </div>
    </>
  );
}
