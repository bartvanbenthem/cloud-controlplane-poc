import { FormEvent, useState } from "react";
import { api } from "../api";
import type { CustomResource, Kind } from "../types";

/** The resource kinds whose storage size can be grown after creation, and
 * where in spec each one keeps it — PostgresCluster/MariaDBCluster/
 * KafkaCluster/RabbitMQCluster/MongoDBCluster under "storage" (mirrors
 * backend's StorageSizePatch), ValkeyCluster under "persistence" (mirrors
 * ValkeyPersistenceSizePatch, since valkey-operator's ValkeyCluster names
 * the field differently). See StorageSizePatch's doc comment in the backend
 * for per-vendor confirmation that each one resizes its PVC(s) in place.
 * GrafanaInstance's persistence isn't listed: unlike the others, whether
 * grafana-operator re-applies a size change onto an already-bound PVC on
 * reconcile isn't confirmed. Exported so SpecPanel knows which top-level
 * spec key to render this field under. */
export const STORAGE_FIELD: Partial<Record<Kind, "storage" | "persistence">> = {
  postgresclusters: "storage",
  mariadbclusters: "storage",
  kafkaclusters: "storage",
  rabbitmqclusters: "storage",
  mongodbclusters: "storage",
  valkeyclusters: "persistence",
};

export function hasStorageSize(kind: Kind): boolean {
  return kind in STORAGE_FIELD;
}

/** Binary-unit suffixes a Kubernetes storage Quantity can carry, in bytes —
 * only the ones actually used by this portal's own storageSize defaults/
 * placeholders (Ki/Mi/Gi/Ti; decimal K/M/G/T are rare for volume sizes but
 * accepted too so an operator-edited CR doesn't fall back to the plain
 * input unnecessarily). */
const UNIT_BYTES: Record<string, number> = {
  Ki: 1024,
  Mi: 1024 ** 2,
  Gi: 1024 ** 3,
  Ti: 1024 ** 4,
  K: 1e3,
  M: 1e6,
  G: 1e9,
  T: 1e12,
};

/** Parses a Kubernetes storage Quantity string (e.g. "10Gi") into GiB as a
 * plain number, or null if the format isn't one of UNIT_BYTES's suffixes —
 * the slider falls back to a plain text input in that case rather than
 * guessing. */
function parseGi(size: string): number | null {
  const m = /^(\d+(?:\.\d+)?)(Ki|Mi|Gi|Ti|K|M|G|T)$/.exec(size.trim());
  if (!m) return null;
  const bytes = parseFloat(m[1]) * UNIT_BYTES[m[2]];
  return bytes / UNIT_BYTES.Gi;
}

/** Lets you grow (never shrink) an existing resource's storage volume via a
 * slider pinned so it can't go below the current size — increasing it
 * live-resizes the underlying PVC(s), handled entirely by the vendor
 * operator once project-easter's reconciler reapplies the new size on its
 * next pass. Renders inline (like SpecPanel's ReplicasField) so it can sit
 * directly in the Spec table's "size" row rather than its own panel. */
export function StorageSizeField({
  kind,
  namespace,
  resource,
  onUpdated,
}: {
  kind: Kind;
  namespace: string;
  resource: CustomResource;
  onUpdated: (updated: CustomResource) => void;
}) {
  const field = STORAGE_FIELD[kind];
  const spec = resource.spec as Record<string, { size?: string } | undefined>;
  const currentSize = (field && spec[field!]?.size) || "";
  const currentGi = parseGi(currentSize);

  // minGi is rounded up (never down) from the actual current size, so the
  // slider's own lower bound can never represent a shrink even if the
  // current size isn't a whole GiB.
  const minGi = currentGi !== null ? Math.max(1, Math.ceil(currentGi)) : 1;
  const maxGi = Math.min(Math.max(minGi + 10, minGi * 4), 10240);
  const step = Math.max(1, Math.round((maxGi - minGi) / 100));

  const [editing, setEditing] = useState(false);
  const [draftGi, setDraftGi] = useState(minGi);
  const [draftText, setDraftText] = useState(currentSize);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!field) return null;

  const draft = currentGi !== null ? `${draftGi}Gi` : draftText;
  const unchanged = currentGi !== null ? draftGi === minGi : draftText === currentSize;

  function startEditing() {
    setDraftGi(minGi);
    setDraftText(currentSize);
    setError(null);
    setEditing(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const updated =
        kind === "valkeyclusters"
          ? await api.patchValkeyPersistenceSize(namespace, resource.metadata.name, draft)
          : await api.patchStorageSize(kind, namespace, resource.metadata.name, draft);
      onUpdated(updated);
      setEditing(false);
    } catch (err) {
      setError(String((err as Error).message ?? err));
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <span>
        <strong>{currentSize || "–"}</strong>{" "}
        <button type="button" className="btn-link" onClick={startEditing}>
          Edit
        </button>
      </span>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "inline-block", minWidth: 220 }}>
      {error && <div className="error-banner">{error}</div>}
      <div className="field" style={{ marginBottom: 8 }}>
        <label>Size{currentGi !== null ? ` — ${draft}` : ""}</label>
        {currentGi !== null ? (
          <input
            type="range"
            min={minGi}
            max={maxGi}
            step={step}
            value={draftGi}
            onChange={(e) => setDraftGi(Number(e.target.value))}
          />
        ) : (
          <input
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            placeholder="e.g. 20Gi"
          />
        )}
        <p className="hint">
          Volumes can only grow, never shrink — the underlying operator resizes the PVC(s) in
          place; this can take a few minutes to finish.
        </p>
      </div>
      <div className="actions-row" style={{ marginTop: 0 }}>
        <button className="btn" type="submit" disabled={saving || unchanged || draft === ""}>
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
  );
}
