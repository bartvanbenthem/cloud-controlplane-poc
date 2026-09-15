import { FormEvent, ReactNode, useState } from "react";
import { api } from "../api";
import type { CustomResource, Kind } from "../types";
import { STORAGE_FIELD, StorageSizeField } from "./StorageSizeField";

/** The resource kinds whose replica count can be changed after creation,
 * and the spec field name each one's CRD actually stores it under —
 * "instances" for PostgresCluster/CloudNativePG, "replicas" everywhere
 * else. The wire field the frontend sends is always "replicas" regardless
 * (see api.patchReplicas); this only decides which value in `spec` to read
 * and label. Mirrors backend's replicaSpecField — see its ReplicasPatch
 * doc comment for why each of these is safe to scale live, and why
 * KafkaCluster/ClusterRequest/ServerRequest are excluded. */
const REPLICA_FIELD: Partial<Record<Kind, string>> = {
  postgresclusters: "instances",
  grafanainstances: "replicas",
  prometheusinstances: "replicas",
  alloyinstances: "replicas",
  rabbitmqclusters: "replicas",
  mariadbclusters: "replicas",
  mongodbclusters: "replicas",
  valkeyclusters: "replicas",
};

/** Mirrors backend's replicaMin — the same lower bound each kind's create
 * form already enforces. */
const REPLICA_MIN: Partial<Record<Kind, number>> = {
  postgresclusters: 1,
  grafanainstances: 0,
  prometheusinstances: 0,
  alloyinstances: 1,
  rabbitmqclusters: 1,
  mariadbclusters: 1,
  mongodbclusters: 1,
  valkeyclusters: 0,
};

const ACRONYMS = new Set(["cpu", "tls", "url", "ip", "cr", "crd"]);

/** Turns a camelCase spec key into a human label, e.g. "storageSize" ->
 * "Storage Size", "requestsCpu" -> "Requests CPU". */
function formatLabel(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(" ")
    .map((w) => (ACRONYMS.has(w.toLowerCase()) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

function formatScalar(value: unknown): string {
  if (value === null || value === undefined || value === "") return "–";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Renders one nested object's entries as a compact key/value list — plain
 * flex rows rather than a nested <table>, so column widths don't inherit
 * the outer spec table's (which made nested values land far from their
 * labels). `renderEntry` lets a caller substitute an editable control for
 * one specific sub-key (see StorageValue below) while everything else
 * falls back to the default recursive rendering. */
function NestedEntries({
  entries,
  renderEntry,
}: {
  entries: [string, unknown][];
  renderEntry?: (key: string, value: unknown) => ReactNode;
}) {
  return (
    <div className="spec-nested">
      {entries.map(([k, v]) => (
        <div className="spec-nested-row" key={k}>
          <span className="spec-key">{formatLabel(k)}</span>
          <span>{renderEntry?.(k, v) ?? <SpecValue value={v} />}</span>
        </div>
      ))}
    </div>
  );
}

/** Renders one spec value — recursing into a nested key/value list for
 * objects, and a flat list for arrays — so nested fields (e.g.
 * resources.requests.cpu) stay distinguishable instead of collapsing into
 * a same-named sibling. */
function SpecValue({ value }: { value: unknown }) {
  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) return <span className="muted">–</span>;
    return <NestedEntries entries={entries} />;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="muted">–</span>;
    if (value.every((v) => !isPlainObject(v))) {
      return <>{value.map(formatScalar).join(", ")}</>;
    }
    return (
      <>
        {value.map((v, i) => (
          <div key={i} style={{ marginBottom: i < value.length - 1 ? 8 : 0 }}>
            <SpecValue value={v} />
          </div>
        ))}
      </>
    );
  }
  return <>{formatScalar(value)}</>;
}

/** Inline-editable replica count for the one field a kind's operator
 * actually lets you change after creation — see REPLICA_FIELD above. */
function ReplicasField({
  kind,
  namespace,
  resource,
  field,
  onUpdated,
}: {
  kind: Kind;
  namespace: string;
  resource: CustomResource;
  field: string;
  onUpdated: (updated: CustomResource) => void;
}) {
  const spec = resource.spec as Record<string, unknown>;
  const current = typeof spec[field] === "number" ? (spec[field] as number) : 0;
  const min = REPLICA_MIN[kind] ?? 0;
  const oddOnly = kind === "mariadbclusters";

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    setDraft(current);
    setError(null);
    setEditing(true);
  }

  const invalid = draft < min || (oddOnly && draft > 1 && draft % 2 === 0);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const updated = await api.patchReplicas(kind, namespace, resource.metadata.name, draft);
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
        <strong>{current}</strong>{" "}
        <button type="button" className="btn-link" onClick={startEditing}>
          Edit
        </button>
      </span>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "inline-block", minWidth: 200 }}>
      {error && <div className="error-banner">{error}</div>}
      <div className="field" style={{ marginBottom: 8 }}>
        <input type="number" min={min} value={draft} onChange={(e) => setDraft(Number(e.target.value))} />
        {oddOnly && <p className="hint">Must be 1 or an odd number, for Galera quorum.</p>}
      </div>
      <div className="actions-row" style={{ marginTop: 0 }}>
        <button className="btn" type="submit" disabled={saving || invalid || draft === current}>
          {saving ? "Saving…" : "Save"}
        </button>
        <button className="btn secondary" type="button" onClick={() => setEditing(false)} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/** Renders the storage/persistence object with its "size" sub-field swapped
 * for StorageSizeField's inline editor — see STORAGE_FIELD for which kinds
 * qualify and StorageSizePatch's doc comment (backend) for why growing it
 * live is safe per vendor. */
function StorageValue({
  kind,
  namespace,
  resource,
  value,
  onUpdated,
}: {
  kind: Kind;
  namespace: string;
  resource: CustomResource;
  value: Record<string, unknown>;
  onUpdated: (updated: CustomResource) => void;
}) {
  return (
    <NestedEntries
      entries={Object.entries(value)}
      renderEntry={(k) =>
        k === "size" ? (
          <StorageSizeField kind={kind} namespace={namespace} resource={resource} onUpdated={onUpdated} />
        ) : undefined
      }
    />
  );
}

/** Renders a resource's spec as a friendly field table instead of raw JSON.
 * The fields each operator actually lets you change after creation —
 * replicas (or "instances" for PostgresCluster), and storage/persistence
 * size — become inline-editable controls; see REPLICA_FIELD/STORAGE_FIELD
 * above and backend's ReplicasPatch/StorageSizePatch doc comments for
 * exactly which kinds qualify and why each is safe to apply live. Every
 * other field stays read-only: most operators only read the rest of their
 * CR at creation, so editing it here would silently do nothing. */
export function SpecPanel({
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
  const spec = (resource.spec ?? {}) as Record<string, unknown>;
  const replicaField = REPLICA_FIELD[kind];
  const storageField = STORAGE_FIELD[kind];
  const entries = Object.entries(spec);

  return (
    <div className="panel">
      <h3>Spec</h3>
      {entries.length === 0 ? (
        <p className="muted">No spec fields.</p>
      ) : (
        <table className="spec-table">
          <tbody>
            {entries.map(([key, value]) => (
              <tr key={key}>
                <td className="spec-key">{formatLabel(key)}</td>
                <td>
                  {key === replicaField ? (
                    <ReplicasField
                      kind={kind}
                      namespace={namespace}
                      resource={resource}
                      field={key}
                      onUpdated={onUpdated}
                    />
                  ) : key === storageField && isPlainObject(value) ? (
                    <StorageValue
                      kind={kind}
                      namespace={namespace}
                      resource={resource}
                      value={value}
                      onUpdated={onUpdated}
                    />
                  ) : (
                    <SpecValue value={value} />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
