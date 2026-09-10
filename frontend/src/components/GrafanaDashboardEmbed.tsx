import { useEffect, useState } from "react";
import { api } from "../api";
import type { CustomResource, Kind } from "../types";
import { grafanaIngressUrl } from "../grafanaIngress";

/** Static per-kind info to build a Grafana embed URL for a resource's
 * auto-provisioned dashboard. project-easter bakes a fixed dashboard JSON
 * (and UID) into each kind's own compiled binary via go:embed — a
 * same-kind CR always maps to the same UID; only the Kubernetes
 * GrafanaDashboard *object* it creates is per-instance
 * (`<cr-name>-dashboard`), not the UID pushed into Grafana itself.
 *
 * `vars` supplies Grafana template-variable query params (`var-X=Y`) to
 * scope the dashboard to this specific instance rather than whatever
 * Grafana's own defaults pick. Kinds without one either have no
 * CR-identifying template variable (MongoDB's dashboard var is an
 * exporter/instance value, not the CR name) or use an "adhoc" filter
 * Grafana doesn't expose as a plain var=value param (MariaDB's `Filters`).
 */
const DASHBOARDS: Partial<
  Record<Kind, { uid: string; vars?: (namespace: string, name: string) => Record<string, string> }>
> = {
  postgresclusters: {
    uid: "cloudnative-pg",
    vars: (namespace, name) => ({ namespace, cluster: name }),
  },
  mariadbclusters: { uid: "pXgz0qFGk" },
  valkeyclusters: {
    uid: "e008bc3f-81a2-40f9-baf2-a33fd8dec7ec",
    vars: (namespace) => ({ namespace }),
  },
  mongodbclusters: { uid: "AyWQt9jWk" },
  rabbitmqclusters: {
    uid: "Kn5xm-gZk",
    vars: (namespace, name) => ({ namespace, rabbitmq_cluster: name }),
  },
  kafkaclusters: {
    uid: "0fba080180e35871",
    vars: (namespace, name) => ({ kubernetes_namespace: namespace, strimzi_cluster_name: name }),
  },
};

/** Shows this resource's auto-provisioned Grafana dashboard inline, when
 * all of the following hold:
 *  - `kind` is one of the six project-easter kinds that provision one (see
 *    DASHBOARDS above) — Cluster/Server/GrafanaInstance/PrometheusInstance
 *    don't have one.
 *  - the resource has `spec.monitoring.enablePodMonitor` set — otherwise
 *    project-easter never created the underlying GrafanaDashboard, so no
 *    Grafana actually has this UID loaded.
 *  - exactly one *Ready* GrafanaInstance exists in the resource's own
 *    namespace — project-easter's GrafanaDashboard→Grafana matching is a
 *    label selector scoped by namespace alone (see project-easter's
 *    grafana.go InstanceSelector), so zero is "nothing to embed into" and
 *    more than one is ambiguous; this picks the first Ready one found
 *    rather than guessing further.
 *  - that GrafanaInstance has `spec.ingress.host` set — the portal no
 *    longer proxies to Grafana itself, so the iframe embeds it directly at
 *    its own Ingress host; one without an ingress host has no URL to embed
 *    at all (see backend/internal/api/grafana_provision.go, which also
 *    only configures allow_embedding/anonymous auth for instances with one).
 *
 * Renders nothing rather than an error state when any of these don't
 * hold, the same way CredentialsPanel renders nothing on a 404.
 */
export function GrafanaDashboardEmbed({
  kind,
  namespace,
  name,
  resource,
}: {
  kind: Kind;
  namespace: string;
  name: string;
  resource: CustomResource;
}) {
  const dashboard = DASHBOARDS[kind];
  const monitoring = resource.spec.monitoring as { enablePodMonitor?: boolean } | undefined;
  const enabled = Boolean(dashboard) && Boolean(monitoring?.enablePodMonitor);

  const [grafanaUrl, setGrafanaUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    api
      .list("grafanainstances", namespace)
      .then((instances) => {
        if (cancelled) return;
        const ready = instances.find(
          (i) => i.status?.conditions?.find((c) => c.type === "Ready")?.status === "True",
        );
        setGrafanaUrl(grafanaIngressUrl(ready));
      })
      .catch(() => !cancelled && setGrafanaUrl(null));
    return () => {
      cancelled = true;
    };
  }, [enabled, namespace]);

  if (!enabled || !dashboard || !grafanaUrl) return null;

  const params = new URLSearchParams({ kiosk: "" });
  for (const [key, value] of Object.entries(dashboard.vars?.(namespace, name) ?? {})) {
    params.set(`var-${key}`, value);
  }
  const src = `${grafanaUrl}/d/${dashboard.uid}?${params.toString()}`;

  return (
    <div className="panel">
      <h3>Dashboard</h3>
      <iframe className="grafana-embed" src={src} title={`Grafana dashboard — ${name}`} />
    </div>
  );
}
