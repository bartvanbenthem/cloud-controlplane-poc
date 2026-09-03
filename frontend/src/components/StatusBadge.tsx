import type { CustomResource } from "../types";

/** Reads the CR's `Ready` condition (the operator's convention per the
 * README) and falls back to a generic "Unknown" badge for anything else,
 * since exact status shape varies by resource and operator version. */
export function StatusBadge({ resource }: { resource: CustomResource }) {
  const conditions = resource.status?.conditions ?? [];
  const ready = conditions.find((c) => c.type === "Ready");

  if (!ready) {
    return (
      <span className="badge unknown">
        <span className="dot" />
        Unknown
      </span>
    );
  }

  const isTrue = ready.status === "True";
  const isFalse = ready.status === "False";
  const cls = isTrue ? "ok" : isFalse ? "err" : "warn";
  const label = isTrue ? "Ready" : isFalse ? "Not Ready" : "Unknown";
  // The operator's reason (e.g. CNPG's adapter literally sets
  // "ClusterNotReady" even on a PostgresCluster) is detail for the
  // tooltip, not the headline — it reads oddly as the badge label on
  // anything that isn't itself a Cluster.
  const title = [ready.reason, ready.message].filter(Boolean).join(": ");

  return (
    <span className={`badge ${cls}`} title={title}>
      <span className="dot" />
      {label}
    </span>
  );
}
