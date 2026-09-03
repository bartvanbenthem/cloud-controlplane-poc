import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import type { RabbitMQCreateRequest } from "../types";

const initial: RabbitMQCreateRequest = {
  name: "",
  namespace: "default",
  replicas: 1,
  image: "",
  storageSize: "10Gi",
  storageClass: "",
  requestsCpu: "",
  requestsMemory: "",
  limitsCpu: "",
  limitsMemory: "",
};

export function RabbitMQCreate() {
  const navigate = useNavigate();
  const [form, setForm] = useState<RabbitMQCreateRequest>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof RabbitMQCreateRequest>(key: K, value: RabbitMQCreateRequest[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.createRabbitMQ(form);
      navigate(`/messaging/rabbitmq/${created.metadata.namespace}/${created.metadata.name}`);
    } catch (e) {
      setError(String((e as Error).message ?? e));
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <h2>New RabbitMQ Broker</h2>
      </div>
      <p className="muted" style={{ marginTop: -12, marginBottom: 20 }}>
        Creates a <code>RabbitMQCluster</code>, project-easter's thin front
        for a RabbitMQ Cluster Operator instance. A default vhost and user
        are created automatically — credentials land in a{" "}
        <code>&lt;name&gt;-default-user</code> Secret the operator manages.
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
          <legend>Nodes &amp; image</legend>
          <div className="form-grid">
            <div className="field">
              <label>Replicas</label>
              <input
                type="number"
                min={1}
                value={form.replicas}
                onChange={(e) => set("replicas", Number(e.target.value))}
              />
              <p className="hint">Should be odd (1, 3, 5, …) to maintain quorum.</p>
            </div>
            <div className="field">
              <label>Image</label>
              <input
                type="text"
                placeholder="Leave empty for the operator's default"
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
            {submitting ? "Creating…" : "Create Broker"}
          </button>
        </div>
      </form>
    </>
  );
}
