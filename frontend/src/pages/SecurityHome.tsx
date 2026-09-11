import { Link } from "react-router-dom";

export function SecurityHome() {
  return (
    <>
      <div className="page-header">
        <h2>Security</h2>
      </div>
      <p className="muted" style={{ marginTop: -12, marginBottom: 20 }}>
        Security and secrets building blocks.
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
