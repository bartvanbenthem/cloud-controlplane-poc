import type { CustomResource } from "./types";

/** Base URL (scheme + host, no trailing slash) for reaching a GrafanaInstance
 * directly through its own Ingress — the only way to reach Grafana at all
 * now that the portal no longer proxies to it (see git history for
 * backend/internal/api/grafana_proxy.go). Returns null when the instance
 * has no `spec.ingress.host` set, e.g. one created without the optional
 * ingress fields on MonitoringCreate. */
export function grafanaIngressUrl(grafana?: CustomResource | null): string | null {
  const ingress = (grafana?.spec as { ingress?: { host?: string; tlsSecretName?: string } } | undefined)
    ?.ingress;
  if (!ingress?.host) return null;
  return `${ingress.tlsSecretName ? "https" : "http"}://${ingress.host}`;
}
