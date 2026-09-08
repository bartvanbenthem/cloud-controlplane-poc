import { Link } from "react-router-dom";

export function DeveloperHome() {
  return (
    <>
      <div className="page-header">
        <h2>Developer</h2>
      </div>
      <p className="muted" style={{ marginTop: -12, marginBottom: 20 }}>
        Developer tooling building blocks.
      </p>

      <div className="category-grid">
        <Link to="/developer/gitops" className="category-card">
          <h3>GitOps Instance</h3>
          <p className="muted">Continuous delivery</p>
          <div className="category-stats">
            <span className="muted">Not integrated yet</span>
          </div>
        </Link>

        <Link to="/developer/container-registry" className="category-card">
          <h3>Container Registry</h3>
          <p className="muted">Container image storage</p>
          <div className="category-stats">
            <span className="muted">Not integrated yet</span>
          </div>
        </Link>
      </div>
    </>
  );
}
