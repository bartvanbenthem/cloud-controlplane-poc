import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export function ObservabilityHome() {
  const [monitoringCount, setMonitoringCount] = useState<number | null>(null);
  const [loggingCount, setLoggingCount] = useState<number | null>(null);
  const [shipperCount, setShipperCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.list("grafanainstances"), api.list("prometheusinstances")])
      .then(([grafana, prometheus]) => setMonitoringCount(grafana.length + prometheus.length))
      .catch((e) => setError(String(e.message ?? e)));
    api
      .list("lokiinstances")
      .then((loki) => setLoggingCount(loki.length))
      .catch((e) => setError(String(e.message ?? e)));
    api
      .list("alloyinstances")
      .then((alloy) => setShipperCount(alloy.length))
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

        <Link to="/observability/logging" className="category-card">
          <h3>Logging</h3>
          <p className="muted">
            Loki, via project-easter's LokiInstance
          </p>
          <div className="category-stats">
            <span>{loggingCount ?? "…"} instances</span>
          </div>
        </Link>

        <Link to="/observability/logging/shippers" className="category-card">
          <h3>Log Shippers</h3>
          <p className="muted">
            Grafana Alloy, via project-easter's AlloyInstance — ships a namespace's pod logs to a
            LokiInstance
          </p>
          <div className="category-stats">
            <span>{shipperCount ?? "…"} instances</span>
          </div>
        </Link>
      </div>
    </>
  );
}
