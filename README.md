# Cloud ControlPlane Portal

A self-service web portal for `stackit-compute-operator` resources —
STACKIT Compute Engine `Server`s and STACKIT Kubernetes Engine (SKE)
`Cluster`s (`compute.sostackit.dev/v1alpha1`) — that runs on Kubernetes and
talks **directly** to the Kubernetes API. No GitOps PR round trip, no
external catalog: the CRDs in etcd are the only state, and this is just a
UI over them.

This repo previously contained a Backstage-based version of this idea
(scaffolder templates opening PRs into a `gitops/` dir for ArgoCD to
apply). That's been replaced by the app here — since the CRDs in etcd are
already the source of truth and already exposed by the Kubernetes API, a
catalog/scaffolder product on top wasn't earning its keep for this use
case.

## How it works

- **Backend** (`backend/`, Go + [client-go](https://github.com/kubernetes/client-go)):
  a REST API using a `dynamic.Interface` client against the
  `compute.sostackit.dev` CRDs — `GET/POST /api/resources/{servers,clusters}`,
  `GET/DELETE .../{namespace}/{name}`, plus `GET /api/namespaces`. Runs
  in-cluster under its own ServiceAccount (falls back to `$KUBECONFIG` /
  `~/.kube/config` for local dev), and serves the built frontend itself
  (embedded via `go:embed`) — one binary, one container.
- **Frontend** (`frontend/`, React + Vite + TypeScript): list/detail/create
  pages for Servers and Clusters, polling every 5s for status. No build
  step at runtime — it's static files served by the Go backend.
- **Auth**: a single shared HTTP Basic Auth credential in front of the
  whole API (`AUTH_USERNAME`/`AUTH_PASSWORD` env vars — see
  `deploy/03-secret.example.yaml`), *not* per-user Kubernetes RBAC. Every
  write goes through the one ServiceAccount's permissions
  (`deploy/02-rbac.yaml`), scoped to `get/list/watch/create/delete` on
  `servers`/`clusters` and `get/list` on `namespaces` — nothing else. If
  you need writes attributed to the real user (audit trail, per-user
  RBAC), swap this for OIDC + Kubernetes impersonation — that's a
  meaningfully bigger change, not a config flag.
- **Writes are direct and immediate**: submitting the create form applies
  the `Server`/`Cluster` object straight to the API server. There's no
  review-before-apply step — Kubernetes' audit log and the object's
  `resourceVersion` history are the trail, not a merged PR.

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
- Create forms only cover `Server` and `Cluster` (matching the two
  Backstage templates this replaces) — `Volume`/`Network` objects the
  operator also manages aren't exposed here, same as before.
- The `Cluster` form only configures one node pool at creation time, same
  scope as the Backstage template it replaces; additional pools can be
  added with `kubectl` after the cluster exists.
