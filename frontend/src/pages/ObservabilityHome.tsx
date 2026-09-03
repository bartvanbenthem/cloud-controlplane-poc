import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export function ObservabilityHome() {
  const [grafanaCount, setGrafanaCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .list("grafanainstances")
      .then((g) => setGrafanaCount(g.length))
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
          <p className="muted">Grafana, via project-easter's GrafanaInstance</p>
          <div className="category-stats">
            <span>{grafanaCount ?? "…"} instances</span>
          </div>
        </Link>
      </div>
    </>
  );
}
