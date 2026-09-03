import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import type { MariaDBCreateRequest } from "../types";

const initial: MariaDBCreateRequest = {
  name: "",
  namespace: "default",
  replicas: 1,
  image: "",
  storageSize: "10Gi",
  storageClass: "",
  databaseName: "",
  databaseOwner: "",
  requestsCpu: "",
  requestsMemory: "",
  limitsCpu: "",
  limitsMemory: "",
};

export function MariaDBCreate() {
  const navigate = useNavigate();
  const [form, setForm] = useState<MariaDBCreateRequest>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof MariaDBCreateRequest>(key: K, value: MariaDBCreateRequest[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.createMariaDB(form);
      navigate(`/database/mariadb/${created.metadata.namespace}/${created.metadata.name}`);
    } catch (e) {
      setError(String((e as Error).message ?? e));
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <h2>New MariaDB Database</h2>
      </div>
      <p className="muted" style={{ marginTop: -12, marginBottom: 20 }}>
        Creates a <code>MariaDBCluster</code>, project-easter's thin front
        for a mariadb-operator instance.
      </p>

      {error && <div className="error-banner">{error}</div>}

      <form onSubmit={handleSubmit}>
        <fieldset>
          <legend>Identity</legend>
          <div className="form-grid">
            <div className="field">
              <label>Name</label>
              <input
                type="text"
                required
                pattern="^[a-z0-9]([-a-z0-9]*[a-z0-9])?$"
                maxLength={63}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                autoFocus
              />
              <p className="hint">Lowercase alphanumeric and hyphens only.</p>
            </div>
            <div className="field">
              <label>Namespace</label>
              <input
                type="text"
                value={form.namespace}
                onChange={(e) => set("namespace", e.target.value)}
              />
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>Replicas &amp; image</legend>
          <div className="form-grid">
            <div className="field">
              <label>Replicas</label>
              <input
                type="number"
                min={1}
                value={form.replicas}
                onChange={(e) => set("replicas", Number(e.target.value))}
              />
              <p className="hint">
                1 runs standalone; &gt;1 enables Galera Cluster and must be odd.
              </p>
            </div>
            <div className="field">
              <label>Image</label>
              <input
                type="text"
                placeholder="Leave empty for mariadb-operator's default"
                value={form.image}
                onChange={(e) => set("image", e.target.value)}
              />
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>Storage</legend>
          <div className="form-grid">
            <div className="field">
              <label>Volume size</label>
              <input
                type="text"
                required
                placeholder="e.g. 10Gi"
                value={form.storageSize}
                onChange={(e) => set("storageSize", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Storage class</label>
              <input
                type="text"
                placeholder="Leave empty for the cluster default"
                value={form.storageClass}
                onChange={(e) => set("storageClass", e.target.value)}
              />
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>Bootstrap database</legend>
          <div className="form-grid">
            <div className="field">
              <label>Database name</label>
              <input
                type="text"
                required
                value={form.databaseName}
                onChange={(e) => set("databaseName", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Owner role</label>
              <input
                type="text"
                required
                value={form.databaseOwner}
                onChange={(e) => set("databaseOwner", e.target.value)}
              />
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>Resources (optional)</legend>
          <div className="form-grid">
            <div className="field">
              <label>CPU request</label>
              <input
                type="text"
                placeholder="e.g. 500m"
                value={form.requestsCpu}
                onChange={(e) => set("requestsCpu", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Memory request</label>
              <input
                type="text"
                placeholder="e.g. 512Mi"
                value={form.requestsMemory}
                onChange={(e) => set("requestsMemory", e.target.value)}
              />
            </div>
            <div className="field">
              <label>CPU limit</label>
              <input
                type="text"
                placeholder="e.g. 1"
                value={form.limitsCpu}
                onChange={(e) => set("limitsCpu", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Memory limit</label>
              <input
                type="text"
                placeholder="e.g. 1Gi"
                value={form.limitsMemory}
                onChange={(e) => set("limitsMemory", e.target.value)}
              />
            </div>
          </div>
        </fieldset>

        <div className="actions-row">
          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create Database"}
          </button>
        </div>
      </form>
    </>
  );
}
