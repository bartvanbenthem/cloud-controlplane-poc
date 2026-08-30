# Multi-cloud ControlPlane POC

POC project regarding a [Backstage](https://backstage.io) developer portal for provisioning and
observing [stackit-compute-operator](https://github.com/bartvanbenthem/stackit-compute-operator)
resources — STACKIT Compute Engine servers and STACKIT Kubernetes Engine
(SKE) clusters — through a self-service UI backed by GitOps.

## How it works

1. A developer opens **Provision Resource** in the sidebar and picks
   **STACKIT Server** or **STACKIT SKE Cluster**.
2. The scaffolder template renders a `Server`/`Cluster` custom resource
   manifest (`compute.sostackit.dev/v1alpha1`) from the form input and opens
   a pull request adding it under `gitops/servers/<name>/` or
   `gitops/clusters/<name>/` in this repo.
3. A reviewer merges the PR. ArgoCD (bootstrapped once via
   `gitops-bootstrap/`) is watching `gitops/` and applies the new manifest.
4. `stackit-compute-operator`, running on the target cluster, reconciles the
   CR against the real STACKIT API and writes status back onto the object.
5. Backstage's Kubernetes plugin reads that status back via each merged
   `catalog-info.yaml`'s component, shown on its **Kubernetes** tab —
   `Ready` condition, `state`, `powerStatus`/`kubernetesVersion`, node
   pools, etc.

`Server`'s supporting resources (boot volume, image, network) are exposed as
inline fields on the Server form — `imageId`, `networkId`, `bootVolume.*` —
rather than as separate templates, matching how the operator's own samples
use them (`config/samples/compute_v1alpha1_server.yaml` in the operator
repo). The operator's `Volume`/`Image`/`Network` kinds still exist and are
registered as Kubernetes-plugin `customResources` in `app-config.yaml`, so
anything created directly with `kubectl` is still visible if referenced by
name.

## Repository layout

```
app-config.yaml            Backstage config: catalog locations, GitHub
                            integration, Kubernetes plugin cluster + CRDs
packages/app/               Frontend (React) — sidebar, entity pages, the
                            Kubernetes tab wiring
packages/backend/           Backend — catalog, scaffolder, kubernetes-backend
templates/stackit-server/           Server scaffolder template + skeleton
templates/stackit-ske-cluster/      SKE Cluster scaffolder template + skeleton
gitops/                     GitOps state — PR target for generated manifests
gitops-bootstrap/           One-time ArgoCD Application + operator install notes
examples/org.yaml           Seed Group/User catalog entities
```

## Setup

This was authored without a Node.js toolchain available in the build
environment, so it has **not** been run through `yarn install` / `yarn dev`
yet. Do that first and fix up anything a real Backstage version pulls in
differently:

```bash
corepack enable   # or: npm i -g yarn
yarn install
```

Environment variables (put them in a `.env` or export before `yarn dev`):

| Variable                    | Purpose                                                            |
|------------------------------|---------------------------------------------------------------------|
| `GITHUB_TOKEN`               | Used by the scaffolder to open PRs into this repo's `gitops/` path |
| `K8S_CLUSTER_URL`             | API server URL of the cluster running stackit-compute-operator     |
| `K8S_SERVICE_ACCOUNT_TOKEN`   | Token for a service account with read access to the CRDs (see below) |

Then:

```bash
yarn dev
```

Backstage comes up at http://localhost:3000, backend at :7007, with guest
auth enabled for local development (`auth.providers.guest` in
`app-config.yaml` — swap for a real provider before deploying this
anywhere shared).

### Before the templates work

- Push this repo to GitHub and update the three `bartvanbenthem` /
  `developer-portal` placeholders (`templates/*/template.yaml`'s
  `allowedOwners`/`allowedRepos`, and `gitops-bootstrap/argocd-application.yaml`'s
  `repoURL`) if it ends up under a different org/repo name.
- `GITHUB_TOKEN` needs `repo` scope (classic) or Contents + Pull requests
  read/write (fine-grained) on that repo.

### Before the Kubernetes tab shows anything

- Follow `gitops-bootstrap/README.md`: install stackit-compute-operator and
  ArgoCD on a cluster, apply `gitops-bootstrap/argocd-application.yaml`.
- Create a Backstage-reading service account on that cluster (`get`/`list`/
  `watch` on `servers.compute.sostackit.dev`, `clusters.compute.sostackit.dev`,
  `volumes.compute.sostackit.dev`, `images.compute.sostackit.dev`,
  `networks.compute.sostackit.dev`, plus `pods`/core resources for the
  standard Kubernetes plugin views), and set `K8S_CLUSTER_URL` /
  `K8S_SERVICE_ACCOUNT_TOKEN` from it.

## Adding the other CRDs as full templates later

If `Volume`, `Image`, or `Network` need their own self-service templates
later (rather than inline Server fields), copy `templates/stackit-server/`
as a starting point — same `fetch:template` + `publish:github:pull-request`
+ `gitops/<kind>/<name>/` pattern, targeting the operator's `VolumeSpec` /
`ImageSpec` / `NetworkSpec` fields (see `api/v1alpha1/*_types.go` in the
operator repo).
