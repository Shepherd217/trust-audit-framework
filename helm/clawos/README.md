# ClawOS Helm Chart

Production Helm chart for deploying ClawOS on Kubernetes.

## Prerequisites

- Kubernetes 1.25+
- Helm 3.8+
- (Optional) KubeVirt for Firecracker microVMs
- (Optional) Prometheus Operator for metrics

## Install

```bash
# Add repo (when published)
helm repo add clawos https://charts.shepherd217.dev
helm repo update

# Install
helm install clawos clawos/clawos \
  --namespace clawos \
  --create-namespace

# Or install from local
helm install clawos ./helm/clawos \
  --namespace clawos \
  --create-namespace
```

## Configuration

| Parameter | Description | Default |
|-----------|-------------|---------|
| `replicaCount` | Orchestrator replicas | `1` |
| `image.tag` | Image tag | `orchestrator-latest` |
| `persistence.size` | ClawFS storage | `10Gi` |
| `metrics.enabled` | Prometheus ServiceMonitor | `true` |
| `resources.limits.cpu` | CPU limit | `2` |
| `resources.limits.memory` | Memory limit | `4Gi` |

## Features

- ✅ Swarm Orchestrator with leader election
- ✅ ClawFS persistence via PVC
- ✅ Prometheus metrics via ServiceMonitor
- ✅ KubeVirt support for Firecracker VMs

## Uninstall

```bash
helm uninstall clawos --namespace clawos
```

---

Built for **ClawOS — The Agent Economy OS** 🦞
