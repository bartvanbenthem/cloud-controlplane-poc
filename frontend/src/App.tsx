import { Route, Routes } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { ScrollToTop } from "./components/ScrollToTop";
import { Dashboard } from "./pages/Dashboard";
import { RuntimeHome } from "./pages/RuntimeHome";
import { DatabaseHome } from "./pages/DatabaseHome";
import { ObservabilityHome } from "./pages/ObservabilityHome";
import { MessagingHome } from "./pages/MessagingHome";
import { StorageHome } from "./pages/StorageHome";
import { VolumesList } from "./pages/VolumesList";
import { SecurityHome } from "./pages/SecurityHome";
import { DeveloperHome } from "./pages/DeveloperHome";
import { Placeholder } from "./pages/Placeholder";
import { ResourceList } from "./pages/ResourceList";
import { ResourceDetail } from "./pages/ResourceDetail";
import { ClusterCreate } from "./pages/ClusterCreate";
import { ServerCreate } from "./pages/ServerCreate";
import { PostgresCreate } from "./pages/PostgresCreate";
import { ValkeyCreate } from "./pages/ValkeyCreate";
import { MariaDBCreate } from "./pages/MariaDBCreate";
import { MongoDBCreate } from "./pages/MongoDBCreate";
import { RabbitMQCreate } from "./pages/RabbitMQCreate";
import { KafkaCreate } from "./pages/KafkaCreate";
import { MonitoringList } from "./pages/MonitoringList";
import { MonitoringCreate } from "./pages/MonitoringCreate";
import { MonitoringDetail } from "./pages/MonitoringDetail";
import { LoggingCreate } from "./pages/LoggingCreate";
import { AlloyCreate } from "./pages/AlloyCreate";
import type { CustomResource } from "./types";

function summarizeCluster(r: CustomResource): string {
  const spec = r.spec as Record<string, unknown>;
  return [`k8s ${spec.kubernetesVersion}`, spec.region].filter(Boolean).join(" · ");
}

function summarizeServer(r: CustomResource): string {
  const spec = r.spec as { machineType?: string; region?: string };
  const status = r.status as { powerStatus?: string } | undefined;
  return [spec.machineType, spec.region, status?.powerStatus].filter(Boolean).join(" · ");
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

function summarizeMariaDB(r: CustomResource): string {
  const spec = r.spec as { replicas?: number; database?: { name?: string } };
  return [`${spec.replicas ?? "?"} replica(s)`, spec.database?.name && `db ${spec.database.name}`]
    .filter(Boolean)
    .join(" · ");
}

function summarizeMongoDB(r: CustomResource): string {
  const spec = r.spec as { replicas?: number };
  return `${spec.replicas ?? "?"} replica(s)`;
}

function summarizeRabbitMQ(r: CustomResource): string {
  const spec = r.spec as { replicas?: number };
  return `${spec.replicas ?? "?"} replica(s)`;
}

function summarizeKafka(r: CustomResource): string {
  const spec = r.spec as { replicas?: number; version?: string };
  return [`${spec.replicas ?? "?"} replica(s)`, spec.version].filter(Boolean).join(" · ");
}

function summarizeLoki(r: CustomResource): string {
  const spec = r.spec as { size?: string; storageClassName?: string };
  return [spec.size, spec.storageClassName && `sc ${spec.storageClassName}`].filter(Boolean).join(" · ");
}

function summarizeAlloy(r: CustomResource): string {
  const spec = r.spec as { lokiInstanceRef?: string; replicas?: number };
  return [`${spec.replicas ?? "?"} replica(s)`, spec.lokiInstanceRef && `→ ${spec.lokiInstanceRef}`]
    .filter(Boolean)
    .join(" · ");
}

export default function App() {
  return (
    <div className="layout">
      <ScrollToTop />
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
                title="Kubernetes Clusters"
                description="Managed Kubernetes clusters on STACKIT Kubernetes Engine (SKE), provisioned and lifecycle-managed via stackit-compute-operator. Create a cluster here, then deploy workloads to it like any other Kubernetes cluster."
                lifecycle="ga"
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
            path="/runtime/vm"
            element={
              <ResourceList
                kind="servers"
                title="Virtual Machines"
                description="STACKIT Compute Engine virtual machines, provisioned and lifecycle-managed via stackit-compute-operator, general-purpose compute for workloads that don't run in Kubernetes."
                lifecycle="ga"
                basePath="/runtime/vm"
                createPath="/runtime/vm/new"
                itemLabel="Virtual Machine"
                summarize={summarizeServer}
              />
            }
          />
          <Route path="/runtime/vm/new" element={<ServerCreate />} />
          <Route
            path="/runtime/vm/:namespace/:name"
            element={<ResourceDetail kind="servers" listPath="/runtime/vm" />}
          />

          {/* Database */}
          <Route path="/database" element={<DatabaseHome />} />

          <Route
            path="/database/postgresql"
            element={
              <ResourceList
                kind="postgresclusters"
                title="PostgreSQL Databases"
                description="Managed PostgreSQL databases running on CloudNativePG, via project-easter's PostgresCluster, includes automated failover, backups, and a bootstrap database/owner on creation."
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
                description="Managed Redis-compatible caches running on Valkey (the open-source Redis fork), via project-easter's ValkeyCluster, sharded and replicated for in-memory caching and fast key-value storage."
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

          <Route
            path="/database/mariadb"
            element={
              <ResourceList
                kind="mariadbclusters"
                title="MariaDB Databases"
                description="Managed MariaDB databases running on mariadb-operator, via project-easter's MariaDBCluster, replicated, MySQL-compatible relational databases with a bootstrap database on creation."
                basePath="/database/mariadb"
                createPath="/database/mariadb/new"
                itemLabel="Database"
                summarize={summarizeMariaDB}
              />
            }
          />
          <Route path="/database/mariadb/new" element={<MariaDBCreate />} />
          <Route
            path="/database/mariadb/:namespace/:name"
            element={<ResourceDetail kind="mariadbclusters" listPath="/database/mariadb" />}
          />

          <Route
            path="/database/mongodb"
            element={
              <ResourceList
                kind="mongodbclusters"
                title="MongoDB Databases"
                description="Managed MongoDB databases running on Percona Server for MongoDB, via project-easter's MongoDBCluster, replicated document databases for applications that need flexible, schema-less storage."
                basePath="/database/mongodb"
                createPath="/database/mongodb/new"
                itemLabel="Database"
                summarize={summarizeMongoDB}
              />
            }
          />
          <Route path="/database/mongodb/new" element={<MongoDBCreate />} />
          <Route
            path="/database/mongodb/:namespace/:name"
            element={<ResourceDetail kind="mongodbclusters" listPath="/database/mongodb" />}
          />

          {/* Observability */}
          <Route path="/observability" element={<ObservabilityHome />} />

          {/* Monitoring covers both GrafanaInstance and PrometheusInstance
              under one install/list/detail/delete function, since neither
              is useful without the other — see
              MonitoringList/MonitoringCreate/MonitoringDetail. */}
          <Route path="/observability/monitoring" element={<MonitoringList />} />
          <Route path="/observability/monitoring/new" element={<MonitoringCreate />} />
          <Route path="/observability/monitoring/:namespace/:name" element={<MonitoringDetail />} />

          {/* Logging — project-easter's LokiInstance, a thin front for a
              Loki Operator LokiStack. */}
          <Route
            path="/observability/logging"
            element={
              <ResourceList
                kind="lokiinstances"
                title="Logging"
                description="Log aggregation and storage backed by the Loki Operator, via project-easter's LokiInstance, pair it with a Log Shipper to collect a namespace's pod logs and query them from Grafana."
                basePath="/observability/logging"
                createPath="/observability/logging/new"
                itemLabel="Logging Instance"
                summarize={summarizeLoki}
              />
            }
          />
          <Route path="/observability/logging/new" element={<LoggingCreate />} />
          <Route
            path="/observability/logging/:namespace/:name"
            element={<ResourceDetail kind="lokiinstances" listPath="/observability/logging" />}
          />

          {/* Log shippers — project-easter's AlloyInstance, a thin front
              for the Alloy Operator's Alloy. Ships a namespace's pod logs
              to a LokiInstance; listed separately from Logging itself since
              it's a many-to-one relationship (multiple AlloyInstances can
              ship to the same LokiInstance), unlike Grafana/Prometheus'
              strict 1:1 pairing. */}
          <Route
            path="/observability/logging/shippers"
            element={
              <ResourceList
                kind="alloyinstances"
                title="Log Shippers"
                description="Ships a namespace's pod logs to a LokiInstance, via project-easter's AlloyInstance (Grafana Alloy), multiple shippers can point at the same Logging instance."
                basePath="/observability/logging/shippers"
                createPath="/observability/logging/shippers/new"
                itemLabel="Log Shipper"
                summarize={summarizeAlloy}
              />
            }
          />
          <Route path="/observability/logging/shippers/new" element={<AlloyCreate />} />
          <Route
            path="/observability/logging/shippers/:namespace/:name"
            element={<ResourceDetail kind="alloyinstances" listPath="/observability/logging/shippers" />}
          />

          {/* Messaging */}
          <Route path="/messaging" element={<MessagingHome />} />

          <Route
            path="/messaging/rabbitmq"
            element={
              <ResourceList
                kind="rabbitmqclusters"
                title="RabbitMQ Brokers"
                description="Managed RabbitMQ message brokers running on the RabbitMQ Cluster Operator, via project-easter's RabbitMQCluster, clustered queues for asynchronous messaging between services."
                basePath="/messaging/rabbitmq"
                createPath="/messaging/rabbitmq/new"
                itemLabel="Broker"
                summarize={summarizeRabbitMQ}
              />
            }
          />
          <Route path="/messaging/rabbitmq/new" element={<RabbitMQCreate />} />
          <Route
            path="/messaging/rabbitmq/:namespace/:name"
            element={<ResourceDetail kind="rabbitmqclusters" listPath="/messaging/rabbitmq" />}
          />

          <Route
            path="/messaging/kafka"
            element={
              <ResourceList
                kind="kafkaclusters"
                title="Kafka Brokers"
                description="Managed Kafka brokers running on Strimzi, via project-easter's KafkaCluster, clustered, replicated event streaming for high-throughput pub/sub workloads."
                basePath="/messaging/kafka"
                createPath="/messaging/kafka/new"
                itemLabel="Broker"
                summarize={summarizeKafka}
              />
            }
          />
          <Route path="/messaging/kafka/new" element={<KafkaCreate />} />
          <Route
            path="/messaging/kafka/:namespace/:name"
            element={<ResourceDetail kind="kafkaclusters" listPath="/messaging/kafka" />}
          />

          {/* Storage */}
          <Route path="/storage" element={<StorageHome />} />
          <Route path="/storage/volumes" element={<VolumesList />} />
          <Route
            path="/storage/buckets"
            element={
              <Placeholder
                title="Buckets"
                tagline="Object storage, via COSI (Container Object Storage Interface)."
                body="Not integrated yet — this is a placeholder for the POC. No operator/CRD wired up."
              />
            }
          />

          {/* Security */}
          <Route path="/security" element={<SecurityHome />} />
          <Route
            path="/security/vault"
            element={
              <Placeholder
                title="Vault"
                tagline="Secrets management."
                body="Not integrated yet — this is a placeholder for the POC. No operator/CRD wired up."
              />
            }
          />
          <Route
            path="/security/audit-logs"
            element={
              <Placeholder
                title="Audit Logs"
                tagline="Who did what, when."
                body="Not integrated yet — this is a placeholder for the POC. No operator/CRD wired up."
              />
            }
          />

          {/* Developer */}
          <Route path="/developer" element={<DeveloperHome />} />
          <Route
            path="/developer/gitops"
            element={
              <Placeholder
                title="GitOps Instance"
                tagline="Continuous delivery."
                body="Not integrated yet — this is a placeholder for the POC. No operator/CRD wired up."
              />
            }
          />
          <Route
            path="/developer/container-registry"
            element={
              <Placeholder
                title="Container Registry"
                tagline="Container image storage."
                body="Not integrated yet — this is a placeholder for the POC. No operator/CRD wired up."
              />
            }
          />

          {/* IAM */}
          <Route
            path="/iam"
            element={
              <Placeholder
                title="IAM"
                tagline="Identity and access management."
                body="Not integrated yet — this is a placeholder for the POC. No operator/CRD wired up."
              />
            }
          />

          {/* Support */}
          <Route
            path="/support"
            element={
              <Placeholder
                title="Support"
                tagline="Help and support requests."
                body="Not integrated yet — this is a placeholder for the POC. No operator/CRD wired up."
              />
            }
          />
        </Routes>
      </div>
    </div>
  );
}
