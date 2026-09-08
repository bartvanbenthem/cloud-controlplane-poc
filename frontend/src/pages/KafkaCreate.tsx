import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import type { KafkaCreateRequest } from "../types";

const initial: KafkaCreateRequest = {
  name: "",
  namespace: "default",
  replicas: 3,
  version: "",
  storageSize: "100Gi",
  storageClass: "",
  requestsCpu: "",
  requestsMemory: "",
  limitsCpu: "",
  limitsMemory: "",
  enablePodMonitor: true,
  exposeType: "",
};

export function KafkaCreate() {
  const navigate = useNavigate();
  const [form, setForm] = useState<KafkaCreateRequest>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof KafkaCreateRequest>(key: K, value: KafkaCreateRequest[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.createKafka(form);
      navigate(`/messaging/kafka/${created.metadata.namespace}/${created.metadata.name}`);
    } catch (e) {
      setError(String((e as Error).message ?? e));
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <h2>New Kafka Broker</h2>
      </div>
      <p className="muted" style={{ marginTop: -12, marginBottom: 20 }}>
        Creates a <code>KafkaCluster</code>, project-easter's thin front for
        a Strimzi Kafka instance — KRaft-only, one combined
        controller+broker node pool.
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
          <legend>Replicas &amp; version</legend>
          <div className="form-grid">
            <div className="field">
              <label>Replicas</label>
              <input
                type="number"
                min={1}
                value={form.replicas}
                onChange={(e) => set("replicas", Number(e.target.value))}
              />
              <p className="hint">An odd number is recommended for KRaft quorum.</p>
            </div>
            <div className="field">
              <label>Kafka version</label>
              <input
                type="text"
                placeholder="Leave empty for Strimzi's default"
                value={form.version}
                onChange={(e) => set("version", e.target.value)}
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
                placeholder="e.g. 100Gi"
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
                placeholder="e.g. 1Gi"
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
                placeholder="e.g. 2Gi"
                value={form.limitsMemory}
                onChange={(e) => set("limitsMemory", e.target.value)}
              />
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>Networking &amp; monitoring (optional)</legend>
          <div className="form-grid">
            <div className="field">
              <label>Expose external listener</label>
              <select
                value={form.exposeType}
                onChange={(e) => set("exposeType", e.target.value as typeof form.exposeType)}
              >
                <option value="">Cluster-internal only</option>
                <option value="LoadBalancer">LoadBalancer</option>
                <option value="NodePort">NodePort</option>
              </select>
              <p className="hint">Adds a TLS "external" listener alongside the internal "plain" one.</p>
            </div>
            <div className="field">
              <label>
                <input
                  type="checkbox"
                  checked={form.enablePodMonitor}
                  onChange={(e) => set("enablePodMonitor", e.target.checked)}
                  style={{ marginRight: 8 }}
                />
                Enable Prometheus PodMonitor
              </label>
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
