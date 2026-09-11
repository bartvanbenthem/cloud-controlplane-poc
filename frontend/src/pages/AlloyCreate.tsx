import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import type { AlloyCreateRequest, CustomResource } from "../types";

const initial: AlloyCreateRequest = {
  name: "",
  namespace: "default",
  lokiInstanceRef: "",
  replicas: 1,
};

/** Creates an AlloyInstance — project-easter's thin front for the Alloy
 * Operator's Alloy — pointed at a LokiInstance in the same namespace. Every
 * other piece (discovery, relabeling, push endpoint, namespace-scoped RBAC)
 * is derived automatically, so this form is deliberately just identity plus
 * a Loki reference. */
export function AlloyCreate() {
  const navigate = useNavigate();
  const [form, setForm] = useState<AlloyCreateRequest>(initial);
  const [lokiInstances, setLokiInstances] = useState<CustomResource[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof AlloyCreateRequest>(key: K, value: AlloyCreateRequest[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  // Loki instances to reference are namespace-scoped, so re-fetch whenever
  // the target namespace changes, and drop any previously picked ref that
  // no longer exists in the new namespace.
  useEffect(() => {
    let cancelled = false;
    api
      .list("lokiinstances", form.namespace)
      .then((items) => !cancelled && setLokiInstances(items))
      .catch(() => !cancelled && setLokiInstances([]));
    return () => {
      cancelled = true;
    };
  }, [form.namespace]);

  useEffect(() => {
    if (form.lokiInstanceRef && !lokiInstances.some((l) => l.metadata.name === form.lokiInstanceRef)) {
      set("lokiInstanceRef", "");
    }
  }, [lokiInstances, form.lokiInstanceRef]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.createAlloy(form);
      navigate(
        `/observability/logging/shippers/${created.metadata.namespace}/${created.metadata.name}`,
      );
    } catch (e) {
      setError(String((e as Error).message ?? e));
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <h2>New Log Collector</h2>
      </div>
      <p className="muted" style={{ marginTop: -12, marginBottom: 20 }}>
        Creates an <code>AlloyInstance</code>, project-easter's thin front
        for the Alloy Operator's Alloy. Ships this namespace's pod logs to
        the referenced <code>LokiInstance</code> — no further configuration
        needed.
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
          <legend>Logging target</legend>
          <div className="form-grid">
            <div className="field">
              <label>Loki instance</label>
              <select
                required
                value={form.lokiInstanceRef}
                onChange={(e) => set("lokiInstanceRef", e.target.value)}
              >
                <option value="" disabled>
                  Select a LokiInstance…
                </option>
                {lokiInstances.map((l) => (
                  <option key={l.metadata.name} value={l.metadata.name}>
                    {l.metadata.name}
                  </option>
                ))}
              </select>
              <p className="hint">
                {lokiInstances.length === 0
                  ? `No LokiInstance found in namespace "${form.namespace}" — create one first.`
                  : "This Alloy ships logs for every pod in its own namespace to the selected LokiInstance."}
              </p>
            </div>
            <div className="field">
              <label>Replicas</label>
              <input
                type="number"
                min={1}
                value={form.replicas}
                onChange={(e) => set("replicas", Number(e.target.value))}
              />
              <p className="hint">
                Alloy discovers and reads pod logs via the Kubernetes API, not by tailing node log
                files — one or a few replicas cover the whole namespace regardless of node count.
              </p>
            </div>
          </div>
        </fieldset>

        <div className="actions-row">
          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create Log Collector"}
          </button>
        </div>
      </form>
    </>
  );
}
