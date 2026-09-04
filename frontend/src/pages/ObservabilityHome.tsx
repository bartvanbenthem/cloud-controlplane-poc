import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export function ObservabilityHome() {
  const [monitoringCount, setMonitoringCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.list("grafanainstances"), api.list("prometheusinstances")])
      .then(([grafana, prometheus]) => setMonitoringCount(grafana.length + prometheus.length))
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  return (
    <>
      <div className="page-header">
        <h2>Observability</h2>
      </div>
      <p className="muted" style={{ marginTop: -12, marginBottom: 20 }}>
        Monitoring and observability tooling, via{" "}
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
        <Link to="/observability/monitoring" className="category-card">
          <h3>Monitoring</h3>
          <p className="muted">
            Grafana &amp; Prometheus, via project-easter's GrafanaInstance and
            PrometheusInstance
          </p>
          <div className="category-stats">
            <span>{monitoringCount ?? "…"} instances</span>
          </div>
        </Link>
      </div>
    </>
  );
}
