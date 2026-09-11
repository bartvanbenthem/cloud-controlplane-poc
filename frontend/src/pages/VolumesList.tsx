import { useEffect, useState } from "react";
import { api } from "../api";
import type { Volume } from "../types";
import { LifecycleBadge } from "../components/LifecycleBadge";

const POLL_INTERVAL_MS = 5000;

function phaseBadge(volume: Volume) {
  const phase = volume.status.phase ?? "Unknown";
  const cls = phase === "Bound" ? "ok" : phase === "Lost" ? "err" : "warn";
  return (
    <span className={`badge ${cls}`}>
      <span className="dot" />
      {phase}
    </span>
  );
}

function attachedBadge(volume: Volume) {
  return volume.attached ? (
    <span className="badge ok" title="Mounted by at least one Pod">
      <span className="dot" />
      Attached
    </span>
  ) : (
    <span className="badge unknown" title="Not mounted by any Pod">
      <span className="dot" />
      Detached
    </span>
  );
}

function capacity(volume: Volume): string {
  return volume.status.capacity?.storage ?? volume.spec.resources?.requests?.storage ?? "–";
}

/** A volume backed by live data (Bound) or actively in use (attached) is
 * never deletable here, force or not — matches the guard the backend
 * enforces in handleDeleteVolume regardless of what the UI sends. */
function deletable(volume: Volume): boolean {
  return !volume.attached && volume.status.phase !== "Bound";
}

/** Lists PersistentVolumeClaims across all namespaces. PVCs are a core
 * Kubernetes resource with no owning operator, so unlike every other
 * Storage/Runtime/Database page this isn't a Kind — it talks to the
 * dedicated /api/volumes endpoints (see backend's volumes.go) instead of
 * /api/resources/{kind}. Delete and Force Delete are only offered once a
 * PVC is both unbound and detached. */
export function VolumesList() {
  const [volumes, setVolumes] = useState<Volume[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      api
        .listVolumes()
        .then((r) => {
          if (!cancelled) {
            setVolumes(r);
            setError(null);
          }
        })
        .catch((e) => !cancelled && setError(String(e.message ?? e)));

    load();
    const id = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  async function handleDelete(volume: Volume, force: boolean) {
    const { namespace, name } = volume.metadata;
    const key = `${namespace}/${name}`;
    const verb = force ? "Force delete" : "Delete";
    if (!confirm(`${verb} volume "${name}" in namespace "${namespace}"? This cannot be undone.`)) {
      return;
    }
    setBusyKey(key);
    try {
      await api.deleteVolume(namespace, name, force);
      setVolumes((prev) => prev?.filter((v) => `${v.metadata.namespace}/${v.metadata.name}` !== key) ?? prev);
      setError(null);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <>
      <div className="page-header">
        <div className="page-title">
          <h2>Volumes</h2>
          <LifecycleBadge status="preview" />
        </div>
      </div>
      <p className="page-description">
        PersistentVolumeClaims across all namespaces — the durable storage backing your
        databases, caches, and other stateful workloads.
      </p>

      {error && <div className="error-banner">{error}</div>}

      {volumes === null ? (
        <p className="muted">Loading…</p>
      ) : volumes.length === 0 ? (
        <p className="empty-state">No volumes found.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Namespace</th>
              <th>Capacity</th>
              <th>Storage Class</th>
              <th>Status</th>
              <th>Attachment</th>
              <th>Age</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {volumes.map((volume) => {
              const key = `${volume.metadata.namespace}/${volume.metadata.name}`;
              const busy = busyKey === key;
              return (
                <tr key={key}>
                  <td>{volume.metadata.name}</td>
                  <td className="muted">{volume.metadata.namespace}</td>
                  <td className="muted">{capacity(volume)}</td>
                  <td className="muted">{volume.spec.storageClassName ?? "–"}</td>
                  <td>{phaseBadge(volume)}</td>
                  <td>{attachedBadge(volume)}</td>
                  <td className="muted">{age(volume.metadata.creationTimestamp)}</td>
                  <td>
                    {deletable(volume) ? (
                      <div className="actions-row" style={{ marginTop: 0 }}>
                        <button
                          className="btn danger"
                          disabled={busy}
                          onClick={() => handleDelete(volume, false)}
                        >
                          {busy ? "Working…" : "Delete"}
                        </button>
                        <button
                          className="btn danger"
                          disabled={busy}
                          title="Strips finalizers and deletes immediately — for a volume stuck Terminating"
                          onClick={() => handleDelete(volume, true)}
                        >
                          {busy ? "Working…" : "Force Delete"}
                        </button>
                      </div>
                    ) : (
                      <span className="muted" title="Only unbound, detached volumes can be deleted">
                        –
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}

function age(ts?: string): string {
  if (!ts) return "–";
  const ms = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}
