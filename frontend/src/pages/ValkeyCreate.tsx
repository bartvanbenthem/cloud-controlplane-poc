import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import type { ValkeyCreateRequest } from "../types";

const initial: ValkeyCreateRequest = {
  name: "",
  namespace: "default",
  shards: 1,
  replicas: 0,
  image: "",
  persistenceSize: "5Gi",
  persistenceStorageClass: "",
  requestsCpu: "",
  requestsMemory: "",
  limitsCpu: "",
  limitsMemory: "",
};

export function ValkeyCreate() {
  const navigate = useNavigate();
  const [form, setForm] = useState<ValkeyCreateRequest>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof ValkeyCreateRequest>(key: K, value: ValkeyCreateRequest[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.createValkey(form);
      navigate(`/database/redis/${created.metadata.namespace}/${created.metadata.name}`);
    } catch (e) {
      setError(String((e as Error).message ?? e));
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <h2>New Redis (Valkey) Cache</h2>
      </div>
      <p className="muted" style={{ marginTop: -12, marginBottom: 20 }}>
        Creates a <code>ValkeyCluster</code>, project-easter's thin front
        for a valkey-operator cluster.
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
          <legend>Topology &amp; image</legend>
          <div className="form-grid">
            <div className="field">
              <label>Shards</label>
              <input
                type="number"
                min={1}
                value={form.shards}
                onChange={(e) => set("shards", Number(e.target.value))}
              />
            </div>
            <div className="field">
              <label>Replicas per shard</label>
              <input
                type="number"
                min={0}
                value={form.replicas}
                onChange={(e) => set("replicas", Number(e.target.value))}
              />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>Image</label>
              <input
                type="text"
                placeholder="Leave empty for valkey-operator's default"
                value={form.image}
                onChange={(e) => set("image", e.target.value)}
              />
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>Persistence</legend>
          <div className="form-grid">
            <div className="field">
              <label>Volume size</label>
              <input
                type="text"
                required
                placeholder="e.g. 5Gi"
                value={form.persistenceSize}
                onChange={(e) => set("persistenceSize", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Storage class</label>
              <input
                type="text"
                placeholder="Leave empty for the cluster default"
                value={form.persistenceStorageClass}
                onChange={(e) => set("persistenceStorageClass", e.target.value)}
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
                placeholder="e.g. 250m"
                value={form.requestsCpu}
                onChange={(e) => set("requestsCpu", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Memory request</label>
              <input
                type="text"
                placeholder="e.g. 256Mi"
                value={form.requestsMemory}
                onChange={(e) => set("requestsMemory", e.target.value)}
              />
            </div>
            <div className="field">
              <label>CPU limit</label>
              <input
                type="text"
                placeholder="e.g. 500m"
                value={form.limitsCpu}
                onChange={(e) => set("limitsCpu", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Memory limit</label>
              <input
                type="text"
                placeholder="e.g. 512Mi"
                value={form.limitsMemory}
                onChange={(e) => set("limitsMemory", e.target.value)}
              />
            </div>
          </div>
        </fieldset>

        <div className="actions-row">
          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create Cache"}
          </button>
        </div>
      </form>
    </>
  );
}
