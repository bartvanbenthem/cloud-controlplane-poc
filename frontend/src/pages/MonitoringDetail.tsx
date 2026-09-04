import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, RequestError } from "../api";
import type { CustomResource } from "../types";
import { StatusBadge } from "../components/StatusBadge";
import { CredentialsPanel } from "../components/CredentialsPanel";

/** Grafana and Prometheus are installed together by MonitoringCreate and
 * neither is useful without the other (Grafana has nothing to query,
 * Prometheus has nothing to visualize with), so this page shows both
 * halves of one monitoring instance and deletes both together — there's no
 * per-component delete, since a partial delete would just leave a broken
 * install behind. */
export function MonitoringDetail() {
  const { namespace = "", name = "" } = useParams();
  const navigate = useNavigate();
  const [grafana, setGrafana] = useState<CustomResource | null>(null);
  const [prometheus, setPrometheus] = useState<CustomResource | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      Promise.all([
        api.get("grafanainstances", namespace, name).catch((e) => {
          if (e instanceof RequestError && e.status === 404) return null;
          throw e;
        }),
        api.get("prometheusinstances", namespace, name).catch((e) => {
          if (e instanceof RequestError && e.status === 404) return null;
          throw e;
        }),
      ])
        .then(([g, p]) => {
          if (cancelled) return;
          setGrafana(g);
          setPrometheus(p);
          setLoaded(true);
          setError(null);
        })
        .catch((e) => !cancelled && setError(String(e.message ?? e)));

    load();
    const id = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [namespace, name]);

  async function handleDelete() {
    if (
      !confirm(
        `Delete monitoring instance "${name}" in namespace "${namespace}"? This removes both the GrafanaInstance and the PrometheusInstance and cannot be undone.`,
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      await Promise.all([
        grafana ? api.remove("grafanainstances", namespace, name) : Promise.resolve(),
        prometheus ? api.remove("prometheusinstances", namespace, name) : Promise.resolve(),
      ]);
      navigate("/observability/monitoring");
    } catch (e) {
      setError(String((e as Error).message ?? e));
      setDeleting(false);
    }
  }

  if (error && !loaded) {
    return <div className="error-banner">{error}</div>;
  }
  if (!loaded) {
    return <p className="muted">Loading…</p>;
  }
  if (!grafana && !prometheus) {
    return <div className="error-banner">Not found.</div>;
  }

  return (
    <>
      <div className="page-header">
        <h2>{name}</h2>
        <div className="actions-row" style={{ marginTop: 0 }}>
          <button className="btn danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>

      {error && <div className="error-banner">{error}</div>}

      {(!grafana || !prometheus) && (
        <div className="error-banner">
          {!grafana && "No GrafanaInstance found for this name — monitoring is incomplete. "}
          {!prometheus && "No PrometheusInstance found for this name — monitoring is incomplete."}
        </div>
      )}

      <div className="panel">
        <h3>Overview</h3>
        <p className="muted">
          Monitoring instance in namespace <strong>{namespace}</strong> — a Grafana and Prometheus
          pair that run together; delete removes both.
        </p>
      </div>

      <ResourceHalf title="Grafana" kindLabel="GrafanaInstance" resource={grafana} />
      {grafana && (
        <CredentialsPanel kind="grafanainstances" namespace={grafana.metadata.namespace} name={grafana.metadata.name} />
      )}

      <ResourceHalf title="Prometheus" kindLabel="PrometheusInstance" resource={prometheus} />
    </>
  );
}

function ResourceHalf({
  title,
  kindLabel,
  resource,
}: {
  title: string;
  kindLabel: string;
  resource: CustomResource | null;
}) {
  return (
    <div className="panel">
      <h3>{title}</h3>
      {!resource ? (
        <p className="muted">No {kindLabel} found.</p>
      ) : (
        <>
          <p>
            <StatusBadge resource={resource} />
          </p>

          {resource.status?.conditions && resource.status.conditions.length > 0 && (
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
          )}

          <details>
            <summary className="muted">Spec &amp; status</summary>
            <pre>{JSON.stringify(resource.spec, null, 2)}</pre>
            <pre>{JSON.stringify(resource.status ?? {}, null, 2)}</pre>
          </details>
        </>
      )}
    </div>
  );
}
