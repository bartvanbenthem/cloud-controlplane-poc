# gitops-bootstrap/

One-time cluster setup, applied by hand (not managed by Backstage):

1. **Install stackit-compute-operator** (CRDs + controller + STACKIT
   credentials) — follow
   [bartvanbenthem/stackit-compute-operator](https://github.com/bartvanbenthem/stackit-compute-operator)'s
   own install instructions (`config/default` via kustomize). This portal
   only authors CRs against an operator that's already running; it does not
   install the operator itself.

2. **Install ArgoCD** on the same cluster if it isn't already there.

3. **Apply the bootstrap Application**:

   ```bash
   kubectl apply -f gitops-bootstrap/argocd-application.yaml
   ```

   Update `spec.source.repoURL` first if this repo's GitHub remote differs
   from the placeholder.

4. **Point Backstage's Kubernetes plugin at the same cluster** by filling in
   `K8S_CLUSTER_URL` and `K8S_SERVICE_ACCOUNT_TOKEN` (see root `README.md`)
   so the portal can read back Server/Cluster status.

After this, the loop is: Backstage template → PR into `gitops/` → merge →
ArgoCD applies → stackit-compute-operator reconciles against STACKIT →
status flows back into Backstage's Kubernetes tab.
