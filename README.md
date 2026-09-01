# Cloud ControlPlane POC

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

This was originally authored without a Node.js toolchain available in the
build environment, so the dependency versions were hand-picked rather than
resolved — that surfaced a number of issues the first time it was actually
installed and run (see "Known toolchain gotchas" below for what they were
and why the fixes below are needed). The steps here reflect the working
setup.

### Prerequisites

- **Node 22** — the project's `engines` field allows Node 20 or 22, but 22
  is recommended: Node 20 combined with `node-gyp@13` hits a
  `webidl.util.markAsUncloneable is not a function` bug when compiling
  native modules (`better-sqlite3`, `isolated-vm`, `cpu-features`) from
  source. If you don't already have Node 22, install it via
  [nvm](https://github.com/nvm-sh/nvm):

  ```bash
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh"
  nvm install 22 && nvm alias default 22
  ```

  This repo pins the version in `.nvmrc`, so `nvm use` picks it up
  automatically once nvm is loaded in your shell.

- **Corepack**, to get the exact Yarn release this repo pins
  (`packageManager: yarn@4.4.1` in `package.json`). Node 22 ships it
  bundled — just enable it once per Node install:

  ```bash
  corepack enable
  ```

  > On Debian/Ubuntu, watch out for `/usr/bin/yarn` — it's the unrelated
  > `cmdtest` package's fake `yarn` binary, not Yarn Berry. If `yarn -v`
  > doesn't print `4.4.1` after `corepack enable`, run `which -a yarn` and
  > make sure the `nvm`-managed one comes first in `PATH`.

### Install and run

```bash
yarn install
```

Yarn is configured to use the `node-modules` linker (`.yarnrc.yml`), not
Plug'n'Play — Backstage's plugin ecosystem doesn't declare peer
dependencies strictly enough for PnP's stricter resolution and throws
"tried to access X but it isn't declared in its dependencies" errors
under it.

Environment variables, in a `.env` file at the repo root (auto-loaded by
`packages/backend/src/index.ts` via `dotenv` — `@backstage/cli` does not
load `.env` on its own, despite what you might expect):

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

- `templates/*/template.yaml`'s `allowedOwners`/`allowedRepos` and
  `gitops-bootstrap/argocd-application.yaml`'s `repoURL` are already set
  for `bartvanbenthem/cloud-controlplane-poc`. If you fork this or rename
  it again, update those three places to match.
- `GITHUB_TOKEN` needs `repo` scope (classic) or Contents + Pull requests
  read/write (fine-grained) on that repo.

### Before the Kubernetes tab shows anything

- Follow `gitops-bootstrap/README.md`: install stackit-compute-operator and
  ArgoCD on a cluster, apply `gitops-bootstrap/argocd-application.yaml`.
  Having the CRDs installed isn't enough — the operator's controller
  actually has to be running, or created `Server`/`Cluster` resources will
  just sit there unreconciled.
- Create a Backstage-reading service account on that cluster (`get`/`list`/
  `watch` on `servers.compute.sostackit.dev`, `clusters.compute.sostackit.dev`,
  `volumes.compute.sostackit.dev`, `images.compute.sostackit.dev`,
  `networks.compute.sostackit.dev`, plus `pods`/core resources for the
  standard Kubernetes plugin views), and set `K8S_CLUSTER_URL` /
  `K8S_SERVICE_ACCOUNT_TOKEN` from it. `gitops-bootstrap/create-backstage-sa.sh`
  automates this — it creates the namespace, ServiceAccount, ClusterRole/
  ClusterRoleBinding, and a long-lived token Secret, then prints the two
  values ready to paste into `.env`:

  ```bash
  ./gitops-bootstrap/create-backstage-sa.sh [namespace] [service-account-name]
  ```

### Known toolchain gotchas

Fixed as part of getting this running for the first time; noted here in
case a future dependency bump reintroduces them:

- `@backstage/plugin-app-backend`'s version pin in
  `packages/backend/package.json` pointed at a release that was never
  published. Several other `@backstage/*` packages were on mutually
  incompatible major versions too (symptom: the `catalog` plugin failing
  to start with missing `serviceRef{core.permissionsRegistry}` /
  `serviceRef{core.auditor}` errors). Run `yarn backstage-cli
  versions:bump` to realign every `@backstage/*` package to a single
  compatible release line.
- `@material-ui/lab` (used for `Alert` in
  `packages/app/src/components/catalog/EntityPage.tsx`) and
  `better-sqlite3` (the `database.client` configured in `app-config.yaml`)
  were both used but never declared as dependencies.

## Adding the other CRDs as full templates later

If `Volume`, `Image`, or `Network` need their own self-service templates
later (rather than inline Server fields), copy `templates/stackit-server/`
as a starting point — same `fetch:template` + `publish:github:pull-request`
+ `gitops/<kind>/<name>/` pattern, targeting the operator's `VolumeSpec` /
`ImageSpec` / `NetworkSpec` fields (see `api/v1alpha1/*_types.go` in the
operator repo).
