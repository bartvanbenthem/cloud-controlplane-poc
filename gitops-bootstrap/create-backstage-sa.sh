#!/usr/bin/env bash
# Creates a read-only ServiceAccount for Backstage's Kubernetes plugin:
# get/list/watch on the stackit-compute-operator CRDs plus the core
# resources the standard Kubernetes plugin views need. Prints the
# K8S_CLUSTER_URL / K8S_SERVICE_ACCOUNT_TOKEN values for app-config.yaml.
#
# Usage: ./create-backstage-sa.sh [namespace] [service-account-name]
set -euo pipefail

NAMESPACE="${1:-backstage}"
SA_NAME="${2:-backstage-k8s-reader}"

kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

kubectl apply -f - <<EOF
apiVersion: v1
kind: ServiceAccount
metadata:
  name: $SA_NAME
  namespace: $NAMESPACE
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: $SA_NAME
rules:
  - apiGroups: ["compute.sostackit.dev"]
    resources: ["servers", "clusters", "volumes", "images", "networks"]
    verbs: ["get", "list", "watch"]
  - apiGroups: [""]
    resources: ["pods", "services", "configmaps", "limitranges", "events"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["apps"]
    resources: ["deployments", "replicasets", "statefulsets", "daemonsets"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["autoscaling"]
    resources: ["horizontalpodautoscalers"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["networking.k8s.io"]
    resources: ["ingresses"]
    verbs: ["get", "list", "watch"]
  - apiGroups: ["metrics.k8s.io"]
    resources: ["pods"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: $SA_NAME
subjects:
  - kind: ServiceAccount
    name: $SA_NAME
    namespace: $NAMESPACE
roleRef:
  kind: ClusterRole
  name: $SA_NAME
  apiGroup: rbac.authorization.k8s.io
---
apiVersion: v1
kind: Secret
metadata:
  name: $SA_NAME-token
  namespace: $NAMESPACE
  annotations:
    kubernetes.io/service-account.name: $SA_NAME
type: kubernetes.io/service-account-token
EOF

echo "Waiting for token to populate..."
for i in $(seq 1 10); do
  TOKEN=$(kubectl get secret "$SA_NAME-token" -n "$NAMESPACE" -o jsonpath='{.data.token}' 2>/dev/null | base64 -d || true)
  [ -n "$TOKEN" ] && break
  sleep 1
done

if [ -z "$TOKEN" ]; then
  echo "Token did not populate in time. Check: kubectl get secret $SA_NAME-token -n $NAMESPACE" >&2
  exit 1
fi

CLUSTER_URL=$(kubectl config view --minify -o jsonpath='{.clusters[0].cluster.server}')

echo
echo "# Add these to your .env (or export before yarn dev):"
echo "K8S_CLUSTER_URL=$CLUSTER_URL"
echo "K8S_SERVICE_ACCOUNT_TOKEN=$TOKEN"
