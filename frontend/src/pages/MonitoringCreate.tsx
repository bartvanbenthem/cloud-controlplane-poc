import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import type { GrafanaCreateRequest, PrometheusCreateRequest } from "../types";

/** One minimal form that installs the Monitoring stack — a GrafanaInstance
 * and a PrometheusInstance, project-easter's thin fronts for grafana-operator
 * and Prometheus Operator — in a single submit. Everything but name,
 * namespace, and an optional ingress host per component is left at the
 * operator's defaults. */
export function MonitoringCreate() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [namespace, setNamespace] = useState("default");
  const [grafanaIngressHost, setGrafanaIngressHost] = useState("");
  const [prometheusIngressHost, setPrometheusIngressHost] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const grafana: GrafanaCreateRequest = {
      name,
      namespace,
      replicas: 1,
      ingressHost: grafanaIngressHost,
    };
    const prometheus: PrometheusCreateRequest = {
      name,
      namespace,
      replicas: 1,
      ingressHost: prometheusIngressHost,
    };

    try {
      await Promise.all([api.createGrafana(grafana), api.createPrometheus(prometheus)]);
      navigate("/observability/monitoring");
    } catch (e) {
      setError(String((e as Error).message ?? e));
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <h2>Install Monitoring</h2>
      </div>
      <p className="muted" style={{ marginTop: -12, marginBottom: 20 }}>
        Creates a <code>GrafanaInstance</code> and a <code>PrometheusInstance</code> together, with
        one replica each and no persistent storage. For finer control over either one, edit it
        after creation.
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
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
              <p className="hint">Lowercase alphanumeric and hyphens only. Used for both instances.</p>
            </div>
            <div className="field">
              <label>Namespace</label>
              <input type="text" value={namespace} onChange={(e) => setNamespace(e.target.value)} />
            </div>
          </div>
        </fieldset>

        <fieldset>
          <legend>Ingress (optional)</legend>
          <div className="form-grid">
            <div className="field">
              <label>Grafana host</label>
              <input
                type="text"
                placeholder="e.g. grafana.example.com"
                value={grafanaIngressHost}
                onChange={(e) => setGrafanaIngressHost(e.target.value)}
              />
            </div>
            <div className="field">
              <label>Prometheus host</label>
              <input
                type="text"
                placeholder="e.g. prometheus.example.com"
                value={prometheusIngressHost}
                onChange={(e) => setPrometheusIngressHost(e.target.value)}
              />
            </div>
          </div>
          <p className="hint">Leave either empty to skip creating an Ingress for it.</p>
        </fieldset>

        <div className="actions-row">
          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? "Installing…" : "Install Monitoring"}
          </button>
        </div>
      </form>
    </>
  );
}
