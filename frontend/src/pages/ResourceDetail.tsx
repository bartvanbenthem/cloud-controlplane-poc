import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import type { CustomResource, Kind } from "../types";
import { StatusBadge } from "../components/StatusBadge";
import { CredentialsPanel, hasCredentials } from "../components/CredentialsPanel";

export function ResourceDetail({ kind, listPath }: { kind: Kind; listPath: string }) {
  const { namespace = "", name = "" } = useParams();
  const navigate = useNavigate();
  const [resource, setResource] = useState<CustomResource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      api
        .get(kind, namespace, name)
        .then((r) => !cancelled && setResource(r))
        .catch((e) => !cancelled && setError(String(e.message ?? e)));

    load();
    const id = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [kind, namespace, name]);

  async function handleDelete() {
    if (!confirm(`Delete ${kind.slice(0, -1)} "${name}" in namespace "${namespace}"? This cannot be undone.`)) {
      return;
    }
    setDeleting(true);
    try {
      await api.remove(kind, namespace, name);
      navigate(listPath);
    } catch (e) {
      setError(String((e as Error).message ?? e));
      setDeleting(false);
    }
  }

  if (error && !resource) {
    return <div className="error-banner">{error}</div>;
  }
  if (!resource) {
    return <p className="muted">Loading…</p>;
  }

  return (
    <>
      <div className="page-header">
        <h2>{resource.metadata.name}</h2>
        <div className="actions-row" style={{ marginTop: 0 }}>
          <button className="btn danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="panel">
        <h3>Overview</h3>
        <p>
          <StatusBadge resource={resource} /> &nbsp;
          <span className="muted">
            {resource.kind} in namespace <strong>{resource.metadata.namespace}</strong>
          </span>
        </p>
      </div>

      {hasCredentials(kind) && (
        <CredentialsPanel kind={kind} namespace={resource.metadata.namespace} name={resource.metadata.name} />
      )}

      {resource.status?.conditions && resource.status.conditions.length > 0 && (
        <div className="panel">
          <h3>Conditions</h3>
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Status</th>
                <th>Reason</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {resource.status.conditions.map((c) => (
                <tr key={c.type}>
                  <td>{c.type}</td>
                  <td>{c.status}</td>
                  <td className="muted">{c.reason ?? "–"}</td>
                  <td className="muted">{c.message ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="panel">
        <h3>Spec</h3>
        <pre>{JSON.stringify(resource.spec, null, 2)}</pre>
      </div>

      <div className="panel">
        <h3>Status</h3>
        <pre>{JSON.stringify(resource.status ?? {}, null, 2)}</pre>
      </div>
    </>
  );
}
