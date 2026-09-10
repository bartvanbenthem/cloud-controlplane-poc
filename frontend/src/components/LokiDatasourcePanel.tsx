import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import type { CustomResource } from "../types";

/** Lets you set or clear an existing GrafanaInstance's optional Loki
 * datasource (spec.lokiRef) after creation — the same field MonitoringCreate
 * offers at creation time, but here via the portal's PATCH endpoint instead
 * of live-patching the cluster by hand. */
export function LokiDatasourcePanel({
  namespace,
  grafana,
  onUpdated,
}: {
  namespace: string;
  grafana: CustomResource;
  onUpdated: (updated: CustomResource) => void;
}) {
  const currentRef = (grafana.spec as { lokiRef?: string }).lokiRef ?? "";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentRef);
  const [lokiInstances, setLokiInstances] = useState<CustomResource[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) return;
    let cancelled = false;
    api
      .list("lokiinstances", namespace)
      .then((items) => !cancelled && setLokiInstances(items))
      .catch(() => !cancelled && setLokiInstances([]));
    return () => {
      cancelled = true;
    };
  }, [editing, namespace]);

  function startEditing() {
    setDraft(currentRef);
    setError(null);
    setEditing(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const updated = await api.patchGrafanaLokiRef(namespace, grafana.metadata.name, draft);
      onUpdated(updated);
      setEditing(false);
    } catch (err) {
      setError(String((err as Error).message ?? err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel">
      <h3>Loki datasource</h3>
      {!editing ? (
        <p>
          <strong>{currentRef || "None"}</strong>{" "}
          <button type="button" className="btn-link" onClick={startEditing}>
            Edit
          </button>
        </p>
      ) : (
        <form onSubmit={handleSubmit}>
          {error && <div className="error-banner">{error}</div>}
          <div className="field">
            <label>LokiInstance</label>
            <select value={draft} onChange={(e) => setDraft(e.target.value)}>
              <option value="">None</option>
              {lokiInstances.map((l) => (
                <option key={l.metadata.name} value={l.metadata.name}>
                  {l.metadata.name}
                </option>
              ))}
            </select>
            <p className="hint">
              {lokiInstances.length === 0
                ? `No LokiInstance found in namespace "${namespace}".`
                : "Wires this Grafana up with a Loki datasource for the selected LokiInstance, in this same namespace."}
            </p>
          </div>
          <div className="actions-row">
            <button className="btn" type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              className="btn secondary"
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
