import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import type { LokiCreateRequest } from "../types";

const initial: LokiCreateRequest = {
  name: "",
  namespace: "default",
  size: "1x.demo",
  storageClassName: "premium-perf1-stackit",
  objectStorageSecretName: "cloudian-s3",
};

export function LoggingCreate() {
  const navigate = useNavigate();
  const [form, setForm] = useState<LokiCreateRequest>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof LokiCreateRequest>(key: K, value: LokiCreateRequest[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.createLoki(form);
      navigate(`/observability/logging/${created.metadata.namespace}/${created.metadata.name}`);
    } catch (e) {
      setError(String((e as Error).message ?? e));
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <h2>New Logging Instance</h2>
      </div>
      <p className="muted" style={{ marginTop: -12, marginBottom: 20 }}>
        Creates a <code>LokiInstance</code>, project-easter's thin front for
        a Loki Operator LokiStack.
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
          <legend>Size</legend>
          <div className="form-grid">
            <div className="field">
              <label>Deployment size</label>
              <select value={form.size} onChange={(e) => set("size", e.target.value as typeof form.size)}>
                <option value="1x.demo">1x.demo (smallest, evaluation only)</option>
                <option value="1x.pico">1x.pico</option>
                <option value="1x.extra-small">1x.extra-small</option>
                <option value="1x.small">1x.small</option>
                <option value="1x.medium">1x.medium</option>
              </select>
              <p className="hint">
                Governs replica counts and resource requests for every LokiStack
                component (distributor, ingester, querier, ...) — not a plain
                replica count.
              </p>
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>Storage</legend>
          <div className="form-grid">
            <div className="field">
              <label>Storage class</label>
              <input
                type="text"
                required
                placeholder="e.g. premium-perf1-stackit"
                value={form.storageClassName}
                onChange={(e) => set("storageClassName", e.target.value)}
              />
              <p className="hint">
                Required — unlike Grafana/Prometheus, Loki has no
                ephemeral-storage fallback.
              </p>
            </div>
            <div className="field">
              <label>Object storage secret</label>
              <input
                type="text"
                required
                placeholder="e.g. cloudian-s3"
                value={form.objectStorageSecretName}
                onChange={(e) => set("objectStorageSecretName", e.target.value)}
              />
              <p className="hint">
                Name of an existing Secret in this namespace laid out for the
                Loki Operator's S3-compatible object storage: bucketnames,
                endpoint, region (optional), access_key_id, access_key_secret.
                Must already exist — this portal doesn't create it.
              </p>
            </div>
          </div>
        </fieldset>

        <div className="actions-row">
          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create Logging Instance"}
          </button>
        </div>
      </form>
    </>
  );
}
