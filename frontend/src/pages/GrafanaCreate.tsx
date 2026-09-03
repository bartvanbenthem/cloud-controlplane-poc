import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import type { GrafanaCreateRequest } from "../types";

const initial: GrafanaCreateRequest = {
  name: "",
  namespace: "default",
  version: "",
  replicas: 1,
  persistenceSize: "",
  persistenceStorageClass: "",
};

export function GrafanaCreate() {
  const navigate = useNavigate();
  const [form, setForm] = useState<GrafanaCreateRequest>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof GrafanaCreateRequest>(key: K, value: GrafanaCreateRequest[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.createGrafana(form);
      navigate(`/observability/monitoring/${created.metadata.namespace}/${created.metadata.name}`);
    } catch (e) {
      setError(String((e as Error).message ?? e));
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <h2>New Monitoring (Grafana) Instance</h2>
      </div>
      <p className="muted" style={{ marginTop: -12, marginBottom: 20 }}>
        Creates a <code>GrafanaInstance</code>, project-easter's thin front
        for a grafana-operator instance.
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
          <legend>Instance</legend>
          <div className="form-grid">
            <div className="field">
              <label>Version</label>
              <input
                type="text"
                placeholder="Leave empty for grafana-operator's default"
                value={form.version}
                onChange={(e) => set("version", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Replicas</label>
              <input
                type="number"
                min={0}
                value={form.replicas}
                onChange={(e) => set("replicas", Number(e.target.value))}
              />
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>Persistence (optional)</legend>
          <div className="form-grid">
            <div className="field">
              <label>Volume size</label>
              <input
                type="text"
                placeholder="Leave empty for ephemeral storage"
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

        <div className="actions-row">
          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create Instance"}
          </button>
        </div>
      </form>
    </>
  );
}
