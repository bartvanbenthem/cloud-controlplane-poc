import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

export function RuntimeHome() {
  const [clusterCount, setClusterCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .list("clusters")
      .then((c) => setClusterCount(c.length))
      .catch((e) => setError(String(e.message ?? e)));
  }, []);

  return (
    <>
      <div className="page-header">
        <h2>Runtime</h2>
      </div>
      <p className="muted" style={{ marginTop: -12, marginBottom: 20 }}>
        Where your workloads actually run — one page per platform.
      </p>
      {error && <div className="error-banner">{error}</div>}

      <div className="category-grid">
        <Link to="/runtime/stackit" className="category-card">
          <h3>STACKIT</h3>
          <p className="muted">SKE clusters via stackit-compute-operator</p>
          <div className="category-stats">
            <span>{clusterCount ?? "…"} clusters</span>
          </div>
        </Link>

        <Link to="/runtime/openshift" className="category-card">
          <h3>OpenShift</h3>
          <p className="muted">Red Hat OpenShift</p>
          <div className="category-stats">
            <span className="muted">Not integrated yet</span>
          </div>
        </Link>

        <Link to="/runtime/vmware" className="category-card">
          <h3>VMware</h3>
          <p className="muted">VMware-hosted infrastructure</p>
          <div className="category-stats">
            <span className="muted">Not integrated yet</span>
          </div>
        </Link>

        <Link to="/runtime/aks" className="category-card">
          <h3>AKS</h3>
          <p className="muted">Azure Kubernetes Service</p>
          <div className="category-stats">
            <span className="muted">Not integrated yet</span>
          </div>
        </Link>
      </div>
    </>
  );
}
