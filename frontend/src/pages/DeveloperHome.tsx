import { Link } from "react-router-dom";
import { LifecycleBadge } from "../components/LifecycleBadge";

export function DeveloperHome() {
  return (
    <>
      <div className="page-header">
        <div className="page-title">
          <h2>Developer</h2>
          <LifecycleBadge status="roadmap" />
        </div>
      </div>
      <p className="muted" style={{ marginTop: -12, marginBottom: 20 }}>
        Continuous delivery and container image tooling for your workloads.
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
