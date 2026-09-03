import { Route, Routes } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./pages/Dashboard";
import { RuntimeHome } from "./pages/RuntimeHome";
import { PaasHome } from "./pages/PaasHome";
import { Placeholder } from "./pages/Placeholder";
import { ResourceList } from "./pages/ResourceList";
import { ResourceDetail } from "./pages/ResourceDetail";
import { ClusterCreate } from "./pages/ClusterCreate";
import { PostgresCreate } from "./pages/PostgresCreate";
import { ValkeyCreate } from "./pages/ValkeyCreate";
import { GrafanaCreate } from "./pages/GrafanaCreate";
import type { CustomResource } from "./types";

function summarizeCluster(r: CustomResource): string {
  const spec = r.spec as Record<string, unknown>;
  return [`k8s ${spec.kubernetesVersion}`, spec.region].filter(Boolean).join(" · ");
}

function summarizePostgres(r: CustomResource): string {
  const spec = r.spec as { instances?: number; database?: { name?: string } };
  return [`${spec.instances ?? "?"} instance(s)`, spec.database?.name && `db ${spec.database.name}`]
    .filter(Boolean)
    .join(" · ");
}

function summarizeValkey(r: CustomResource): string {
  const spec = r.spec as { shards?: number; replicas?: number };
  return `${spec.shards ?? "?"} shard(s) · ${spec.replicas ?? 0} replica(s) each`;
}

function summarizeGrafana(r: CustomResource): string {
  const spec = r.spec as { replicas?: number; version?: string };
  return [`${spec.replicas ?? "?"} replica(s)`, spec.version].filter(Boolean).join(" · ");
}

export default function App() {
  return (
    <div className="layout">
      <Sidebar />
      <div className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />

          {/* Runtime */}
          <Route path="/runtime" element={<RuntimeHome />} />

          <Route
            path="/runtime/stackit"
            element={
              <ResourceList
                kind="clusters"
                title="STACKIT Clusters"
                basePath="/runtime/stackit"
                createPath="/runtime/stackit/new"
                itemLabel="Cluster"
                summarize={summarizeCluster}
              />
            }
          />
          <Route path="/runtime/stackit/new" element={<ClusterCreate />} />
          <Route
            path="/runtime/stackit/:namespace/:name"
            element={<ResourceDetail kind="clusters" listPath="/runtime/stackit" />}
          />

          <Route
            path="/runtime/openshift"
            element={
              <Placeholder
                title="OpenShift"
                tagline="Red Hat OpenShift."
                body="Not integrated yet — this is a placeholder for the POC. Only STACKIT is wired up to an operator right now."
              />
            }
          />
          <Route
            path="/runtime/vmware"
            element={
              <Placeholder
                title="VMware"
                tagline="VMware-hosted infrastructure."
                body="Not integrated yet — this is a placeholder for the POC. Only STACKIT is wired up to an operator right now."
              />
            }
          />

          {/* PaaS */}
          <Route path="/paas" element={<PaasHome />} />

          <Route
            path="/paas/postgresql"
            element={
              <ResourceList
                kind="postgresclusters"
                title="PostgreSQL Databases"
                basePath="/paas/postgresql"
                createPath="/paas/postgresql/new"
                itemLabel="Database"
                summarize={summarizePostgres}
              />
            }
          />
          <Route path="/paas/postgresql/new" element={<PostgresCreate />} />
          <Route
            path="/paas/postgresql/:namespace/:name"
            element={<ResourceDetail kind="postgresclusters" listPath="/paas/postgresql" />}
          />

          <Route
            path="/paas/redis"
            element={
              <ResourceList
                kind="valkeyclusters"
                title="Redis Caches"
                basePath="/paas/redis"
                createPath="/paas/redis/new"
                itemLabel="Cache"
                summarize={summarizeValkey}
              />
            }
          />
          <Route path="/paas/redis/new" element={<ValkeyCreate />} />
          <Route
            path="/paas/redis/:namespace/:name"
            element={<ResourceDetail kind="valkeyclusters" listPath="/paas/redis" />}
          />

          <Route
            path="/paas/monitoring"
            element={
              <ResourceList
                kind="grafanainstances"
                title="Monitoring Instances"
                basePath="/paas/monitoring"
                createPath="/paas/monitoring/new"
                itemLabel="Instance"
                summarize={summarizeGrafana}
              />
            }
          />
          <Route path="/paas/monitoring/new" element={<GrafanaCreate />} />
          <Route
            path="/paas/monitoring/:namespace/:name"
            element={<ResourceDetail kind="grafanainstances" listPath="/paas/monitoring" />}
          />
        </Routes>
      </div>
    </div>
  );
}
