# gitops/

State store for STACKIT custom resources created through the Backstage
portal. Nothing in here is written by hand — every `servers/<name>/` and
`clusters/<name>/` directory is opened as a pull request by the
`stackit-server` / `stackit-ske-cluster` scaffolder templates
(`templates/`) and merged after review.

```
gitops/
  servers/<name>/manifest.yaml        # Server custom resource
  servers/<name>/catalog-info.yaml    # picked up by app-config.yaml's catalog.locations glob
  clusters/<name>/manifest.yaml       # Cluster (SKE) custom resource
  clusters/<name>/catalog-info.yaml
```

ArgoCD (see `../gitops-bootstrap/`) watches this path on `main` and applies
every `manifest.yaml` to the cluster running stackit-compute-operator. Once
merged, the corresponding `catalog-info.yaml` also gets picked up by
Backstage's catalog on its next scan, so the resource shows up as a
Component with a live "Kubernetes" tab.

Do not edit a manifest here to change a live resource's desired state other
than through a reviewed PR — the operator reconciles continuously against
whatever is applied, so an unreviewed direct edit changes real STACKIT
infrastructure.
