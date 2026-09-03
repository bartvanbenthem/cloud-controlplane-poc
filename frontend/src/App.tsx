import { Route, Routes } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./pages/Dashboard";
import { RuntimeHome } from "./pages/RuntimeHome";
import { DatabaseHome } from "./pages/DatabaseHome";
import { ObservabilityHome } from "./pages/ObservabilityHome";
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
          <Route
            path="/runtime/aks"
            element={
              <Placeholder
                title="AKS"
                tagline="Azure Kubernetes Service."
                body="Not integrated yet — this is a placeholder for the POC. Only STACKIT is wired up to an operator right now."
              />
            }
          />

          {/* Database */}
          <Route path="/database" element={<DatabaseHome />} />

          <Route
            path="/database/postgresql"
            element={
              <ResourceList
                kind="postgresclusters"
                title="PostgreSQL Databases"
                basePath="/database/postgresql"
                createPath="/database/postgresql/new"
                itemLabel="Database"
                summarize={summarizePostgres}
              />
            }
          />
          <Route path="/database/postgresql/new" element={<PostgresCreate />} />
          <Route
            path="/database/postgresql/:namespace/:name"
            element={<ResourceDetail kind="postgresclusters" listPath="/database/postgresql" />}
          />

          <Route
            path="/database/redis"
            element={
              <ResourceList
                kind="valkeyclusters"
                title="Redis Caches"
                basePath="/database/redis"
                createPath="/database/redis/new"
                itemLabel="Cache"
                summarize={summarizeValkey}
              />
            }
          />
          <Route path="/database/redis/new" element={<ValkeyCreate />} />
          <Route
            path="/database/redis/:namespace/:name"
            element={<ResourceDetail kind="valkeyclusters" listPath="/database/redis" />}
          />

          {/* Observability */}
          <Route path="/observability" element={<ObservabilityHome />} />

          <Route
            path="/observability/monitoring"
            element={
              <ResourceList
                kind="grafanainstances"
                title="Monitoring Instances"
                basePath="/observability/monitoring"
                createPath="/observability/monitoring/new"
                itemLabel="Instance"
                summarize={summarizeGrafana}
              />
            }
          />
          <Route path="/observability/monitoring/new" element={<GrafanaCreate />} />
          <Route
            path="/observability/monitoring/:namespace/:name"
            element={<ResourceDetail kind="grafanainstances" listPath="/observability/monitoring" />}
          />

          {/* Placeholder categories */}
          <Route
            path="/messaging"
            element={
              <Placeholder
                title="Messaging"
                tagline="Message queues and event streaming."
                body="Not integrated yet — this is a placeholder for the POC. No operator/CRD wired up."
              />
            }
          />
          <Route
            path="/network"
            element={
              <Placeholder
                title="Network"
                tagline="Networking building blocks."
                body="Not integrated yet — this is a placeholder for the POC. No operator/CRD wired up."
              />
            }
          />
          <Route
            path="/security"
            element={
              <Placeholder
                title="Security"
                tagline="Security and secrets building blocks."
                body="Not integrated yet — this is a placeholder for the POC. No operator/CRD wired up."
              />
            }
          />
        </Routes>
      </div>
    </div>
  );
}
