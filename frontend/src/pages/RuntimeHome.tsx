import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { LifecycleBadge } from "../components/LifecycleBadge";

export function RuntimeHome() {
  const [clusterCount, setClusterCount] = useState<number | null>(null);
  const [serverCount, setServerCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .list("clusters")
      .then((c) => setClusterCount(c.length))
      .catch((e) => setError(String(e.message ?? e)));
    api
      .list("servers")
      .then((s) => setServerCount(s.length))
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  return (
    <>
      <div className="page-header">
        <div className="page-title">
          <h2>Runtime</h2>
          <LifecycleBadge status="ga" />
        </div>
      </div>
      <p className="page-description">
        Where your workloads actually run. Pick Kubernetes for containerized workloads, or a
        Virtual Machine for anything that needs to run outside a cluster.
      </p>
      {error && <div className="error-banner">{error}</div>}

      <div className="category-grid">
        <Link to="/runtime/stackit" className="category-card">
          <h3>Kubernetes</h3>
          <p className="muted">SKE clusters via stackit-compute-operator</p>
          <div className="category-stats">
            <span>{clusterCount ?? "…"} clusters</span>
          </div>
        </Link>

        <Link to="/runtime/vm" className="category-card">
          <h3>Virtual Machine</h3>
          <p className="muted">STACKIT Compute Engine servers via stackit-compute-operator</p>
          <div className="category-stats">
            <span>{serverCount ?? "…"} servers</span>
          </div>
        </Link>
      </div>
    </>
  );
}
