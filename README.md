# CCP — Cloud ControlPlane Portal

A multi-cloud self-service web portal that runs on Kubernetes and talks
**directly** to the Kubernetes API. No GitOps PR round trip, no external
catalog: the CRDs in etcd are the only state, and this is just a UI over
them.

The sidebar is organized around collapsible categories, in addition to
the Dashboard:

- **Runtime** — where workloads actually run. Currently:
  - **STACKIT** (working) — STACKIT Kubernetes Engine (SKE) `Cluster`s
    (`compute.sostackit.dev/v1alpha1`), managed via
    [stackit-compute-operator](https://github.com/bartvanbenthem/stackit-compute-operator).
  - **OpenShift**, **VMware**, **AKS** — placeholders for this POC. No
    operator/CRD wired up yet.
- **Database** — managed database/cache building blocks, via
  [project-easter](https://github.com/bartvanbenthem/project-easter) (a
  meta-operator fronting CloudNativePG, valkey-operator,
  mariadb-operator, RabbitMQ Cluster Operator, grafana-operator, and the
  Prometheus Operator with its own thin `paas.example.com/v1alpha1`
  CRDs):
  - **PostgreSQL** — `PostgresCluster`
  - **Redis** — `ValkeyCluster` (Valkey)
  - **MariaDB** — `MariaDBCluster`
- **Observability** — also via project-easter, both kinds under one
  "Monitoring" list/create page since they're the same operational
  concern:
  - **Monitoring** — `GrafanaInstance` and `PrometheusInstance`
- **Messaging** — also via project-easter:
  - **RabbitMQ** — `RabbitMQCluster`
- **Network**, **Security** — placeholders for this POC. No operator/CRD
  wired up yet.

This repo previously contained a Backstage-based version of this idea
(scaffolder templates opening PRs into a `gitops/` dir for ArgoCD to
apply). That's been replaced by the app here — since the CRDs in etcd are
already the source of truth and already exposed by the Kubernetes API, a
catalog/scaffolder product on top wasn't earning its keep for this use
case.

## How it works

- **Backend** (`backend/`, Go + [client-go](https://github.com/kubernetes/client-go)):
  a REST API using a `dynamic.Interface` client against seven CRDs across
  two API groups — `compute.sostackit.dev/v1alpha1` `Cluster`, and
  `paas.example.com/v1alpha1` `PostgresCluster`/`ValkeyCluster`/`MariaDBCluster`/`RabbitMQCluster`/`GrafanaInstance`/`PrometheusInstance`
  — via `GET/POST /api/resources/{kind}`, `GET/DELETE .../{namespace}/{name}`,
  plus `GET /api/namespaces`. Runs in-cluster under its own ServiceAccount
  (falls back to `$KUBECONFIG` / `~/.kube/config` for local dev), and
  serves the built frontend itself (embedded via `go:embed`) — one binary,
  one container.
- **Frontend** (`frontend/`, React + Vite + TypeScript): list/detail/create
  pages for Clusters and the six Database/Observability/Messaging
  building blocks, polling every 5s for status. GrafanaInstance and
  PrometheusInstance are treated as one "Monitoring" building block
  end to end, since neither is useful without the other: `MonitoringCreate`
  installs both together (one name/namespace, one submit), `MonitoringList`
  merges them into one row per instance with a combined status (Ready only
  once both are), and `MonitoringDetail` shows both halves' status/conditions
  on one page behind a single Delete button that removes both — there's no
  per-component delete, so monitoring can't be left half-torn-down. OpenShift,
  VMware, AKS, Network, and Security are static placeholder pages — no
  backend calls. No build step at
  runtime — it's static files served by the Go backend.
- **Auth**: a single shared HTTP Basic Auth credential in front of the
  whole API (`AUTH_USERNAME`/`AUTH_PASSWORD` env vars — see
  `deploy/03-secret.example.yaml`), *not* per-user Kubernetes RBAC. Every
  write goes through the one ServiceAccount's permissions
  (`deploy/02-rbac.yaml`), scoped to `get/list/watch/create/delete` on
  those seven resource types and `get/list` on `namespaces` — nothing
  else, and no access to the vendor CRDs (CNPG's `Cluster`,
  valkey-operator's `ValkeyCluster`, mariadb-operator's `MariaDB`,
  RabbitMQ Cluster Operator's `RabbitmqCluster`, grafana-operator's
  `Grafana`, Prometheus Operator's `Prometheus`) that project-easter's
  own ServiceAccount reconciles the paas CRs into. If
  you need writes attributed to the real user (audit trail, per-user
  RBAC), swap this for OIDC + Kubernetes impersonation — that's a
  meaningfully bigger change, not a config flag.
- **Writes are direct and immediate**: submitting a create form applies
  the object straight to the API server. There's no review-before-apply
  step — Kubernetes' audit log and the object's `resourceVersion` history
  are the trail, not a merged PR.

## Repository layout

```
backend/    Go module — REST API + embedded frontend, client-go dynamic client
frontend/   React + Vite + TypeScript SPA
deploy/     Kubernetes manifests: namespace, ServiceAccount, RBAC, Secret
            example, Deployment, Service, optional Ingress example
Dockerfile  Multi-stage build: frontend -> backend (go:embed) -> alpine runtime
Makefile    build-frontend / build / run / docker-build / deploy
```

## Local development

```bash
# terminal 1 — backend against your current kubeconfig context
cd backend && go run .

# terminal 2 — frontend with hot reload, proxying /api to :8080
cd frontend && npm install && npm run dev
```

Open http://localhost:5173. No `AUTH_USERNAME`/`AUTH_PASSWORD` set means
the API is unauthenticated locally (a warning is logged).

To run the single production-shaped binary locally instead:

```bash
make run   # builds the frontend, embeds it, builds and runs the backend
```

## Deploying

```bash
docker build -t <your-registry>/cloud-controlplane-portal:latest .
docker push <your-registry>/cloud-controlplane-portal:latest
# update the image in deploy/04-deployment.yaml, then:
cp deploy/03-secret.example.yaml deploy/03-secret.yaml   # fill in real creds
kubectl apply -f deploy/00-namespace.yaml
kubectl apply -f deploy/01-serviceaccount.yaml
kubectl apply -f deploy/02-rbac.yaml
kubectl apply -f deploy/03-secret.yaml
kubectl apply -f deploy/04-deployment.yaml
kubectl apply -f deploy/05-service.yaml
```

`deploy/06-ingress.example.yaml` is an optional starting point if you run
an ingress controller — copy it to `06-ingress.yaml`, set your host, and
apply. Otherwise `kubectl port-forward svc/controlplane-portal -n
controlplane-portal 8080:80` works fine for a POC.

## What this doesn't do (yet)

- No per-user identity/RBAC — see the Auth note above.
- No live watch/streaming — the UI polls every 5s rather than using a
  Kubernetes watch, which is simpler but means up to a 5s lag on status
  changes.
- Of stackit-compute-operator's CRDs, only `Cluster` is exposed —
  `Server`/`Volume`/`Network` aren't wired up here.
- OpenShift, VMware, AKS, Network, and Security are
  navigation/page scaffolding only — no operator, CRD, or API behind them
  yet.
- The `Cluster` form only configures one node pool at creation time;
  additional pools can be added with `kubectl` after the cluster exists.
- The Database/Messaging forms cover the fields project-easter's own
  CRDs expose (deliberately minimal per its README's "Scope" section),
  including the newer `expose` (PostgresCluster/MariaDBCluster/ValkeyCluster
  — LoadBalancer/NodePort only, no annotations), `ingress`
  (RabbitMQCluster — host/class/TLS secret only, no annotations), and
  `monitoring` (PostgresCluster/MariaDBCluster PodMonitor toggle)
  fields — anything beyond that (CNPG backups/pooling, Valkey ACLs,
  MariaDB Galera tuning, RabbitMQ plugins/TLS, ingress/expose
  annotations, etc.) is out of scope here the same way it's out of
  scope for project-easter itself.
- The combined Monitoring install (`MonitoringCreate`) is deliberately
  narrower than that: one name/namespace and an optional ingress host
  per component, with everything else (version, replicas beyond 1,
  persistence/storage, resources, retention, ingress class/TLS secret)
  left at the operator's defaults. Edit the `GrafanaInstance`/`PrometheusInstance`
  directly with `kubectl` afterwards for anything beyond that.
