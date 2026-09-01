import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export function Dashboard() {
  const [serverCount, setServerCount] = useState<number | null>(null);
  const [clusterCount, setClusterCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.list("servers"), api.list("clusters")])
      .then(([s, c]) => {
        setServerCount(s.length);
        setClusterCount(c.length);
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
        <Link to="/stackit" className="category-card">
          <h3>STACKIT</h3>
          <p className="muted">Compute Engine servers &amp; SKE clusters</p>
          <div className="category-stats">
            <span>{serverCount ?? "…"} servers</span>
            <span>{clusterCount ?? "…"} clusters</span>
          </div>
        </Link>

        <Link to="/paas" className="category-card">
          <h3>PaaS</h3>
          <p className="muted">KPN PaaS building blocks</p>
          <div className="category-stats">
            <span className="muted">Coming soon</span>
          </div>
        </Link>
      </div>
    </>
  );
}
