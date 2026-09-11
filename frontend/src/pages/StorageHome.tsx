import { Link } from "react-router-dom";
import { LifecycleBadge } from "../components/LifecycleBadge";

export function StorageHome() {
  return (
    <>
      <div className="page-header">
        <div className="page-title">
          <h2>Storage</h2>
          <LifecycleBadge status="preview" />
        </div>
      </div>
      <p className="muted" style={{ marginTop: -12, marginBottom: 20 }}>
        Persistent volumes and object storage building blocks for your workloads.
      </p>

      <div className="category-grid">
        <Link to="/storage/volumes" className="category-card">
          <h3>Volumes</h3>
          <p className="muted">PersistentVolumeClaims in the cluster</p>
        </Link>

        <Link to="/storage/buckets" className="category-card">
          <h3>Buckets</h3>
          <p className="muted">Object storage, via COSI (Container Object Storage Interface)</p>
          <div className="category-stats">
            <span className="muted">Not integrated yet</span>
          </div>
        </Link>
      </div>
    </>
  );
}
