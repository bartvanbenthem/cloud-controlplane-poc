import { Link } from "react-router-dom";

export function StorageHome() {
  return (
    <>
      <div className="page-header">
        <h2>Storage</h2>
      </div>
      <p className="muted" style={{ marginTop: -12, marginBottom: 20 }}>
        Object storage building blocks.
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
