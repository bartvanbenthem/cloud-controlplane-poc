import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import type { CustomResource, GrafanaCreateRequest, PrometheusCreateRequest } from "../types";

/** One minimal form that installs the Monitoring stack — a GrafanaInstance
 * and a PrometheusInstance, project-easter's thin fronts for grafana-operator
 * and Prometheus Operator — in a single submit. Everything but name,
 * namespace, and an optional ingress host per component is left at the
 * operator's defaults. */
/** Wildcard DNS zone every ingress host defaults into — see
 * grafanaHostFor/prometheusHostFor. */
const INGRESS_DOMAIN = "paas.cncp.nl";

function grafanaHostFor(name: string): string {
  return name ? `${name}.${INGRESS_DOMAIN}` : "";
}

function prometheusHostFor(name: string): string {
  return name ? `${name}-prometheus.${INGRESS_DOMAIN}` : "";
}

export function MonitoringCreate() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [namespace, setNamespace] = useState("default");
  const [grafanaIngressHost, setGrafanaIngressHost] = useState("");
  const [prometheusIngressHost, setPrometheusIngressHost] = useState("");
  // Once the user edits either host field directly, stop overwriting it as
  // the name changes -- only the untouched, name-derived default keeps
  // tracking. Prevents clobbering a deliberate override.
  const [hostsTouched, setHostsTouched] = useState(false);
  const [lokiRef, setLokiRef] = useState("");
  const [lokiInstances, setLokiInstances] = useState<CustomResource[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prestage both ingress hosts under the real wildcard zone as soon as a
  // name is entered -- the previous "e.g. ...example.com" placeholder was
  // too easy to copy verbatim into a host that has no DNS record at all.
  useEffect(() => {
    if (hostsTouched) return;
    setGrafanaIngressHost(grafanaHostFor(name));
    setPrometheusIngressHost(prometheusHostFor(name));
  }, [name, hostsTouched]);

  // Loki instances to offer as a datasource are namespace-scoped, so
  // re-fetch whenever the target namespace changes, and drop any previously
  // picked lokiRef that no longer exists in the new namespace.
  useEffect(() => {
    let cancelled = false;
    api
      .list("lokiinstances", namespace)
      .then((items) => !cancelled && setLokiInstances(items))
      .catch(() => !cancelled && setLokiInstances([]));
    return () => {
      cancelled = true;
    };
  }, [namespace]);

  useEffect(() => {
    if (lokiRef && !lokiInstances.some((l) => l.metadata.name === lokiRef)) {
      setLokiRef("");
    }
  }, [lokiInstances, lokiRef]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const grafana: GrafanaCreateRequest = {
      name,
      namespace,
      replicas: 1,
      lokiRef: lokiRef || undefined,
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
          <legend>Logging (optional)</legend>
          <div className="form-grid">
            <div className="field">
              <label>Loki datasource</label>
              <select value={lokiRef} onChange={(e) => setLokiRef(e.target.value)}>
                <option value="">None</option>
                {lokiInstances.map((l) => (
                  <option key={l.metadata.name} value={l.metadata.name}>
                    {l.metadata.name}
                  </option>
                ))}
              </select>
              <p className="hint">
                {lokiInstances.length === 0
                  ? `No LokiInstance found in namespace "${namespace}" — create one first if you want Grafana wired up with a Loki datasource.`
                  : "Wires this Grafana up with a Loki datasource for the selected LokiInstance, in this same namespace."}
              </p>
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
                placeholder={`e.g. name.${INGRESS_DOMAIN}`}
                value={grafanaIngressHost}
                onChange={(e) => {
                  setHostsTouched(true);
                  setGrafanaIngressHost(e.target.value);
                }}
              />
            </div>
            <div className="field">
              <label>Prometheus host</label>
              <input
                type="text"
                placeholder={`e.g. name-prometheus.${INGRESS_DOMAIN}`}
                value={prometheusIngressHost}
                onChange={(e) => {
                  setHostsTouched(true);
                  setPrometheusIngressHost(e.target.value);
                }}
              />
            </div>
          </div>
          <p className="hint">
            Prestaged under the <code>{INGRESS_DOMAIN}</code> wildcard zone, which resolves any
            subdomain without a separate DNS record — edit if you want a different host, or clear
            either to keep it cluster-internal only, with no public IP. Setting a host is the only
            way to make it reachable from outside the cluster; the portal has no built-in proxy
            for either, and deliberately doesn't offer a standalone LoadBalancer/NodePort Service
            option here, since that would front the exact same port as the Ingress and default to
            a second, unwanted public IP alongside it. Without a Grafana host, this instance also
            won't be embeddable in other resources' dashboards through the portal.
          </p>
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
