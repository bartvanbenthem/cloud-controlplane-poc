import { Link } from "react-router-dom";
import { LifecycleBadge } from "../components/LifecycleBadge";

export function SecurityHome() {
  return (
    <>
      <div className="page-header">
        <div className="page-title">
          <h2>Security</h2>
          <LifecycleBadge status="roadmap" />
        </div>
      </div>
      <p className="page-description">
        Secrets management and audit visibility for your workloads. Both Vault and Audit Logs are
        on the roadmap, no operator/CRD is wired up yet for this POC.
      </p>

      <div className="category-grid">
        <Link to="/security/vault" className="category-card">
          <h3>Vault</h3>
          <p className="muted">Secrets management</p>
          <div className="category-stats">
            <span className="muted">Not integrated yet</span>
          </div>
        </Link>
        <Link to="/security/audit-logs" className="category-card">
          <h3>Audit Logs</h3>
          <p className="muted">Who did what, when</p>
          <div className="category-stats">
            <span className="muted">Not integrated yet</span>
          </div>
        </Link>
      </div>
    </>
  );
}
