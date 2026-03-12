# ClawVault — Secrets Management Research & Design Document

## Executive Summary

This document presents comprehensive research on production secrets management systems and provides design recommendations for **ClawVault**, a secrets management system for MoltOS. The design balances security, operational simplicity, and integration with the ClawVM agent architecture.

---

## 1. Research: Production Secrets Management Systems

### 1.1 HashiCorp Vault

#### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           HashiCorp Vault Architecture                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    HTTP API    ┌──────────────────────────────────────┐   │
│  │   Clients   │◄──────────────►│          Vault Server                │   │
│  │  (CLI/UI)   │    (mTLS)      │  ┌────────────────────────────────┐  │   │
│  └─────────────┘                │  │           Core                 │  │   │
│                                 │  │  ┌────────────┐  ┌───────────┐  │  │   │
│  ┌─────────────┐                │  │  │   Token    │  │  Policy   │  │  │   │
│  │   Auth      │                │  │  │   Store    │  │  Engine   │  │  │   │
│  │  Methods    │                │  │  └─────┬──────┘  └─────┬─────┘  │  │   │
│  │ (K8s/OIDC)  │                │  │        │               │        │  │   │
│  └──────┬──────┘                │  │  ┌─────▼───────────────▼─────┐  │  │   │
│         │                       │  │  │    Secret Engines         │  │  │   │
│         │                       │  │  │  (KV/Database/AWS/SSH)    │  │  │   │
│         │                       │  │  └───────────────────────────┘  │  │   │
│         │                       │  │        │                        │  │   │
│         │                       │  │  ┌─────▼─────┐  ┌─────────────┐  │  │   │
│         │                       │  │  │  Security │  │   Audit     │  │  │   │
│         │                       │  │  │  Barrier  │  │   Devices   │  │  │   │
│         │                       │  │  └─────┬─────┘  └─────────────┘  │  │   │
│         │                       │  └────────┼─────────────────────────┘  │   │
│         │                       └───────────┼────────────────────────────┘   │
│         │                                   │                                 │
│         └───────────────────────────────────┘                                 │
│                                             ▼                                 │
│                               ┌───────────────────┐                          │
│                               │  Storage Backend  │                          │
│                               │  (etcd/Consul/S3) │                          │
│                               └───────────────────┘                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Key Features

| Feature | Description | Security Benefit |
|---------|-------------|------------------|
| **Secret Engines** | Pluggable backends (KV v1/v2, Database, AWS, PKI, SSH) | Domain-specific secret handling |
| **Dynamic Secrets** | On-demand, short-lived credentials | Automatic expiration reduces blast radius |
| **Leases & TTL** | Time-bound access with mandatory renewal | Forces credential refresh |
| **Encryption as a Service** | Transit secrets engine for app-level encryption | Offload crypto to Vault |
| **Shamir's Secret Sharing** | Unseal key distribution | No single point of compromise |
| **Auto-Unseal** | Cloud KMS integration (AWS/Azure/GCP) | Operational convenience without sacrificing security |
| **Namespaces** | Multi-tenant isolation | Scoped access for teams/environments |
| **Replication** | Performance & DR replication | High availability, geographic distribution |

#### Token Types

```
┌─────────────────────────────────────────────────────────────────┐
│                    Vault Token Types                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────┐    ┌─────────────────────────┐    │
│  │    Service Tokens       │    │     Batch Tokens        │    │
│  ├─────────────────────────┤    ├─────────────────────────┤    │
│  │ • Renewable             │    │ • No persistence        │    │
│  │ • Hierarchical          │    │ • Lightweight           │    │
│  │ • Cubbyhole             │    │ • Fixed TTL             │    │
│  │ • Can be root           │    │ • Not renewable         │    │
│  │ • Heavyweight           │    │ • Cross-cluster capable │    │
│  │ • Accessors for revoc.  │    │ • No accessors          │    │
│  └─────────────────────────┘    └─────────────────────────┘    │
│                                                                 │
│  Use Service Tokens for:        Use Batch Tokens for:          │
│  • Long-running services        • High-volume, short jobs      │
│  • Interactive sessions         • Serverless functions         │
│  • Complex workflows            • CI/CD pipelines              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### Lease Lifecycle

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Request    │────►│   Granted    │────►│   Renewed    │────►│   Expired/   │
│   Secret     │     │   Lease      │     │   (optional) │     │   Revoked    │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                           │                                           │
                           │ TTL expires                               │
                           ▼                                           ▼
                    ┌──────────────┐                         ┌──────────────┐
                    │   Secret     │                         │   Secret     │
                    │   Valid      │                         │   Revoked    │
                    └──────────────┘                         └──────────────┘
```

---

### 1.2 AWS Secrets Manager

#### Core Capabilities

| Capability | Implementation | Benefit |
|------------|----------------|---------|
| **Automatic Rotation** | Lambda-triggered rotation | Zero-touch credential updates |
| **Cross-Account Access** | Resource policies | Centralized secrets for multi-account |
| **Replication** | Multi-region replication | DR and latency reduction |
| **Versioning** | Automatic version history | Rollback capability |
| **Encryption** | KMS envelope encryption | FIPS 140-2 validated |
| **VPC Endpoints** | PrivateLink integration | No internet exposure |

#### Rotation Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AWS Secrets Manager Rotation Flow                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────┐                                                       │
│   │  Rotation Schedule │                                                    │
│   │  (30-90 days)   │                                                       │
│   └────────┬────────┘                                                       │
│            │                                                                │
│            ▼                                                                │
│   ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐      │
│   │  Step 1: Create │────►│  Step 2: Test   │────►│  Step 3: Update │      │
│   │  New Secret     │     │  New Credential │     │  Application    │      │
│   │  (AWSPENDING)   │     │  (verify access)│     │  (AWSCURRENT)   │      │
│   └─────────────────┘     └─────────────────┘     └─────────────────┘      │
│                                                            │                │
│                                                            ▼                │
│                                                   ┌─────────────────┐       │
│                                                   │  Step 4: Deprecate     │
│                                                   │  Old Secret     │       │
│                                                   │  (AWSPREVIOUS)  │       │
│                                                   └─────────────────┘       │
│                                                                             │
│   Key Features:                                                             │
│   • Dual-credential phase ensures zero downtime                             │
│   • Automatic rollback on test failure                                      │
│   • Version labels: AWSCURRENT, AWSPREVIOUS, AWSPENDING                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### 1.3 Kubernetes Secrets — Why They're Insufficient

#### Limitations Analysis

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              Kubernetes Native Secrets: Critical Limitations                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  LIMITATION 1: Base64 Encoding ≠ Encryption                                  │
│  ─────────────────────────────────────────                                  │
│  apiVersion: v1                                                              │
│  kind: Secret                                                                │
│  data:                                                                       │
│    password: cGFzc3dvcmQxMjM=  ◄── Simply Base64 encoded!                    │
│                                ◄── Anyone with API access can read           │
│                                                                             │
│  LIMITATION 2: etcd Storage                                                   │
│  ─────────────────────────────────────────                                  │
│  • Secrets stored in etcd (cluster database)                                │
│  • Encryption at rest is OPTIONAL (must configure EncryptionConfig)         │
│  • etcd backups contain plaintext secrets if encryption not enabled         │
│                                                                             │
│  LIMITATION 3: No Automatic Rotation                                        │
│  ─────────────────────────────────────────                                  │
│  • Secrets are immutable by default                                         │
│  • No built-in rotation mechanism                                           │
│  • Manual process: Create new → Update refs → Delete old                    │
│                                                                             │
│  LIMITATION 4: Limited RBAC Granularity                                     │
│  ─────────────────────────────────────────                                  │
│  • Access is ALL or NOTHING for a secret                                    │
│  • Cannot restrict to specific fields                                       │
│  • Role explosion in large organizations                                    │
│                                                                             │
│  LIMITATION 5: Environment Variable Exposure                                │
│  ─────────────────────────────────────────                                  │
│  • Secrets mounted as env vars are visible to all pod processes             │
│  • `kubectl exec <pod> -- env` dumps all secrets                            │
│  • Logs may accidentally capture env vars                                   │
│                                                                             │
│  LIMITATION 6: No Audit Trail                                               │
│  ─────────────────────────────────────────                                  │
│  • No built-in logging of secret access                                     │
│  • Cannot track "who read what secret when"                                  │
│  • Requires external audit webhook configuration                            │
│                                                                             │
│  LIMITATION 7: Scoped to Cluster                                            │
│  ─────────────────────────────────────────                                  │
│  • Cannot share secrets with external services                              │
│  • No native multi-cluster secret distribution                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### When K8s Secrets Are Acceptable

- Development/testing environments
- Non-sensitive configuration (not true secrets)
- When combined with external secrets operators (Vault, AWS, etc.)

---

### 1.4 1Password & Bitwarden Secrets Automation

#### 1Password Secrets Automation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   1Password Secrets Automation                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TWO ACCESS MODELS:                                                         │
│                                                                             │
│  ┌─────────────────────────────────────┐                                    │
│  │     1Password Service Accounts      │                                    │
│  ├─────────────────────────────────────┤                                    │
│  │ • Cloud-hosted authentication       │                                    │
│  │ • Rate limited                      │                                    │
│  │ • No infrastructure required        │                                    │
│  │ • CLI & SDK support                 │                                    │
│  │ • Good for: CI/CD, simple apps      │                                    │
│  └─────────────────────────────────────┘                                    │
│                                                                             │
│  ┌─────────────────────────────────────┐                                    │
│  │     1Password Connect               │                                    │
│  ├─────────────────────────────────────┤                                    │
│  │ • Self-hosted REST API              │                                    │
│  │ • Local caching                     │                                    │
│  │ • No rate limits                    │                                    │
│  │ • High availability                 │                                    │
│  │ • Good for: High-volume, latency-sensitive                             │
│  └─────────────────────────────────────┘                                    │
│                                                                             │
│  SECURITY MODEL:                                                            │
│  • Service Account tokens are short-lived (configurable TTL)               │
│  • End-to-end encryption (1Password never sees plaintext)                   │
│  • Zero-knowledge architecture                                              │
│  • TOTP support for automated MFA                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Bitwarden Secrets Manager

| Feature | Description |
|---------|-------------|
| **Self-hostable** | Open source, deploy on own infrastructure |
| **Machine credentials** | API keys, tokens, certificates for apps |
| **Environment scoping** | Dev/staging/prod separation |
| **Dynamic secrets** | Not supported (static only) |
| **Rotation** | Manual or via external automation |
| **Access control** | RBAC with organizations/collections |
| **Audit logging** | Event logging for security review |

---

## 2. Key Questions — Deep Dive

### 2.1 How to Securely Inject Secrets at Runtime Without Environment Variables?

#### Problem: Environment Variables Are Insecure

```
ENVIRONMENT VARIABLE RISKS:
─────────────────────────────────────────────────────────
1. Visible to all processes: Any process in container can read env vars
2. Log exposure: Debug dumps, crash reports often include full environment
3. Process inspection: `ps e`, `/proc/<pid>/environ` expose env vars
4. Shell history: Commands with env vars may be logged in shell history
5. Container introspection: `docker inspect`, `kubectl describe` show env vars
```

#### Solution: File-Based Injection with Memory-Only Storage

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              Secure Runtime Secret Injection Pattern                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PATTERN 1: tmpfs-mounted Secret Files (Recommended)                        │
│  ─────────────────────────────────────────────────────                      │
│                                                                             │
│  ┌─────────────┐     mTLS/mutual auth      ┌───────────────┐               │
│  │  ClawVault  │◄────────────────────────►│    Agent      │               │
│  │   Server    │  1. Authenticate          │  (ClawVM)     │               │
│  └─────────────┘  2. Request secret        └───────┬───────┘               │
│       │                                            │                        │
│       │ 3. Return encrypted secret                 │                        │
│       │    with lease ID                           │                        │
│       │                                            ▼                        │
│       │                                   ┌───────────────┐                 │
│       │                                   │  Write to     │                 │
│       │                                   │  tmpfs mount  │                 │
│       │                                   │  (/run/claw/) │                 │
│       │                                   └───────┬───────┘                 │
│       │                                           │                         │
│       │ 4. Periodic renewal                         │ 5. App reads from file │
│       │◄────────────────────────────────────────────┤                        │
│       │                                            │                        │
│                                                                             │
│  tmpfs advantages:                                                          │
│  • Never written to disk (memory only)                                      │
│  • Deleted when container exits                                             │
│  • Can set strict file permissions (0600)                                   │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────      │
│                                                                             │
│  PATTERN 2: Unix Domain Socket (IPC)                                        │
│  ─────────────────────────────────────────────────────                      │
│                                                                             │
│  ┌─────────────┐         Unix Socket         ┌───────────────┐             │
│  │  ClawVault  │◄───────────────────────────►│  Agent        │             │
│  │   Agent     │  Request/response protocol  │  (Sidecar)    │             │
│  │   (local)   │  Never touches disk         │               │             │
│  └─────────────┘                             └───────────────┘             │
│                                                                             │
│  Unix socket advantages:                                                    │
│  • Kernel-mediated IPC (no network stack)                                   │
│  • File permissions control access                                          │
│  • Zero-copy performance                                                    │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────      │
│                                                                             │
│  PATTERN 3: Shared Memory (Advanced)                                        │
│  ─────────────────────────────────────────────────────                      │
│                                                                             │
│  • memfd_create() on Linux                                                  │
│  • Secrets in anonymous memory segments                                     │
│  • No file descriptors visible in /proc                                     │
│  • Requires careful memory management                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 How to Handle Secret Rotation?

#### Zero-Downtime Rotation Pattern

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              Dual-Credential Rotation Strategy                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PHASE 1: Current State                                                      │
│  ────────────────────                                                       │
│                                                                             │
│     ┌─────────┐         Old Credential (ACTIVE)        ┌─────────┐         │
│     │  Agent  │───────────────────────────────────────►│ Service │         │
│     └─────────┘                                        └─────────┘         │
│                                                                             │
│  PHASE 2: Create New Credential (Overlap Period)                            │
│  ────────────────────────────────────────────────                           │
│                                                                             │
│     ┌─────────┐         Old Credential (ACTIVE)        ┌─────────┐         │
│     │  Agent  │───────────────────────────────────────►│ Service │         │
│     │         │         New Credential (STANDBY)       │         │         │
│     │         │───────────────────────────────────────►│         │         │
│     └─────────┘                                        └─────────┘         │
│                                                                             │
│  PHASE 3: Switch Active Credential                                          │
│  ─────────────────────────────────────────                                  │
│                                                                             │
│     ┌─────────┐         Old Credential (DEPRECATED)    ┌─────────┐         │
│     │  Agent  │───────────────────────────────────────►│ Service │         │
│     │         │         New Credential (ACTIVE)        │         │         │
│     │         │───────────────────────────────────────►│         │         │
│     └─────────┘                                        └─────────┘         │
│                                                                             │
│  PHASE 4: Remove Old Credential                                             │
│  ────────────────────────────────                                           │
│                                                                             │
│     ┌─────────┐         New Credential (ACTIVE)        ┌─────────┐         │
│     │  Agent  │───────────────────────────────────────►│ Service │         │
│     └─────────┘                                        └─────────┘         │
│                                                                             │
│  REQUIREMENTS FOR SUCCESS:                                                  │
│  ─────────────────────────                                                  │
│  • Service must accept multiple valid credentials simultaneously            │
│  • Agent must support credential reload without restart                     │
│  • Monitoring must detect auth failures during transition                   │
│  • Automatic rollback if failure threshold exceeded                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Key Rotation Strategy (Encryption Keys)

```
ENVELOPE ENCRYPTION WITH KEY VERSIONING:
────────────────────────────────────────

┌─────────────────────────────────────────────────────────────────┐
│                    Key Hierarchy                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   Level 4:  Root Key (Master) ───────────┐ Protects KEK         │
│       │                                   │                      │
│       ▼                                   │                      │
│   Level 3:  Key Encryption Key (KEK) ◄────┘ Protects DEKs        │
│       │                                   │                      │
│       ▼                                   │                      │
│   Level 2:  Data Encryption Key (DEK) ◄───┘ Encrypts data        │
│       │                                                          │
│       ▼                                                          │
│   Level 1:  Encrypted Data (Ciphertext)                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

KEY ROTATION WITHOUT RE-ENCRYPTING ALL DATA:
───────────────────────────────────────────

When rotating KEK:
1. Generate new KEK (KEK-v2)
2. Re-encrypt only the DEKs with KEK-v2
3. Data stays encrypted with same DEK
4. Old KEK (KEK-v1) kept for decryption
5. Monitor KEK-v1 usage
6. Retire KEK-v1 when DEK usage = 0

This is O(N) where N = number of DEKs, not O(M) where M = data size
```

### 2.3 How to Audit Secret Access?

#### Audit Log Schema

```json
{
  "timestamp": "2026-03-13T00:37:00.000Z",
  "event_type": "secret_access",
  "event_id": "uuid-v4",
  "severity": "info|warning|error|critical",
  
  "actor": {
    "type": "agent|user|service",
    "id": "agent-uuid-or-user-id",
    "identity": "authenticated-principal",
    "ip_address": "10.0.0.1",
    "user_agent": "clawvm-agent/1.0"
  },
  
  "resource": {
    "type": "secret|key|certificate",
    "id": "secret-uuid",
    "path": "/prod/database/password",
    "version": 3,
    "engine": "kv-v2"
  },
  
  "action": {
    "operation": "read|write|delete|rotate|renew",
    "status": "success|failure|denied",
    "reason": "authorization_policy"
  },
  
  "context": {
    "lease_id": "lease-uuid",
    "ttl_remaining": 3600,
    "request_id": "req-uuid",
    "client_token": "hmac-of-token"
  },
  
  "compliance": {
    "pci_dss": true,
    "soc2": true,
    "retention_days": 365
  }
}
```

#### Compliance Requirements Mapping

| Framework | Requirement | ClawVault Implementation |
|-----------|-------------|--------------------------|
| **SOC 2** | CC6.1, CC6.2 | RBAC, authentication |
| **SOC 2** | CC7.2, CC7.3 | Comprehensive audit logging |
| **PCI DSS** | Req 3 | Encryption at rest |
| **PCI DSS** | Req 4 | TLS 1.3 in transit |
| **PCI DSS** | Req 10 | Audit trail, log integrity |
| **HIPAA** | §164.312(b) | Access logging |
| **HIPAA** | §164.312(a)(2) | Encryption, access control |
| **ISO 27001** | A.12.4.1 | Event logging |
| **ISO 27001** | A.9.4.4 | Secret authentication info protection |

### 2.4 Encryption at Rest vs In Transit

#### Encryption Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 Defense in Depth: Encryption Strategy                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  LAYER 1: IN TRANSIT (Network)                                              │
│  ───────────────────────────                                                │
│                                                                             │
│  Agent ◄──────────► ClawVault Server ◄──────────► Storage                   │
│       │                                  │                                  │
│       │  TLS 1.3                         │  TLS 1.3 / mTLS                  │
│       │  • AES-256-GCM                   │                                  │
│       │  • Certificate pinning           │                                  │
│       │  • Mutual authentication         │                                  │
│                                                                             │
│  LAYER 2: AT REST (Storage)                                                 │
│  ──────────────────────────                                                 │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                   Envelope Encryption                            │       │
│  │                                                                  │       │
│  │   ┌─────────────┐      ┌─────────────┐      ┌─────────────┐     │       │
│  │   │   Root Key  │─────►│     KEK     │─────►│     DEK     │     │       │
│  │   │  (HSM/KMS)  │      │  (per-path) │      │ (per-secret)│     │       │
│  │   └─────────────┘      └─────────────┘      └──────┬──────┘     │       │
│  │                                                    │            │       │
│  │                                                    ▼            │       │
│  │                                            ┌─────────────┐      │       │
│  │                                            │   Secret    │      │       │
│  │                                            │  (encrypted)│      │       │
│  │                                            └─────────────┘      │       │
│  │                                                                  │       │
│  │   Storage: Encrypted DEK + Encrypted Secret                      │       │
│  │                                                                  │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                             │
│  LAYER 3: IN MEMORY (Runtime)                                               │
│  ────────────────────────────                                               │
│                                                                             │
│  • mlock() to prevent swapping secrets to disk                              │
│  • memfd_create() for secure memory regions                                 │
│  • Automatic memory zeroing after use                                       │
│  • No core dumps of secret-containing regions                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.5 How Do Agents Request Secrets Without Exposing Them in Logs?

#### Agent-Secret Access Patterns

```
┌─────────────────────────────────────────────────────────────────────────────┐
│               Agent Secret Access: Security Controls                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ANTI-PATTERNS TO AVOID:                                                    │
│  ────────────────────────                                                   │
│  ❌ Never log the full secret value                                         │
│  ❌ Never include secrets in error messages                                 │
│  ❌ Never pass secrets as URL parameters                                    │
│  ❌ Never echo secrets in debug output                                      │
│  ❌ Never include secrets in stack traces                                   │
│                                                                             │
│  SAFE LOGGING PRACTICES:                                                    │
│  ───────────────────────                                                    │
│                                                                             │
│  Secret Value:    "sk-1234567890abcdef"                                     │
│  Logged As:       "sk-12...ef" (first 4 + last 2 chars)                     │
│                                                                             │
│  Secret Value:    "eyJhbGciOiJIUzI1NiIs..."                                 │
│  Logged As:       "eyJ... (JWT, 147 chars)"                                 │
│                    or hash: "sha256:abc123..."                              │
│                                                                             │
│  API DESIGN:                                                                │
│  ───────────                                                                │
│                                                                             │
│  Request:                                                                   │
│  POST /v1/secrets/get                                                       │
│  {                                                                          │
│    "path": "/prod/db/password",                                             │
│    "version": null  // null = current version                               │
│  }                                                                          │
│                                                                             │
│  Response:                                                                  │
│  {                                                                          │
│    "data": {                                                                │
│      "secret_id": "secret-uuid",                                            │
│      "version": 3,                                                          │
│      "lease_id": "lease-uuid",                                              │
│      "lease_duration": 3600,                                                │
│      "renewable": true,                                                     │
│      // Secret value NOT logged anywhere                                     │
│    }                                                                          │
│  }                                                                          │
│                                                                             │
│  AUDIT LOG:                                                                 │
│  {                                                                          │
│    "event": "secret_access",                                                │
│    "path": "/prod/db/password",                                             │
│    "version": 3,                                                            │
│    "secret_hash": "sha256:abc...def",  // Hash only!                        │
│    "agent_id": "agent-uuid",                                                │
│    "timestamp": "..."                                                       │
│  }                                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. ClawVault Design for MoltOS

### 3.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ClawVault Architecture                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │                        ClawVault Server                               │  │
│  │  ┌────────────────────────────────────────────────────────────────┐  │  │
│  │  │                         Core Engine                             │  │  │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │  │  │
│  │  │  │   HTTP API  │  │   Policy    │  │     Secret Engines      │ │  │  │
│  │  │  │  (REST/gRPC)│  │   Engine    │  │  ┌─────┐ ┌─────┐ ┌────┐ │ │  │  │
│  │  │  └──────┬──────┘  └─────────────┘  │  │ KV  │ │ Dyn │ │ PKI│ │ │  │  │
│  │  │         │                           │  └─────┘ └─────┘ └────┘ │ │  │  │
│  │  │    ┌────┴────┐                      └─────────────────────────┘ │  │  │
│  │  │    │  Auth   │                                                 │  │  │
│  │  │    │ Module  │                                                 │  │  │
│  │  │    └────┬────┘                                                 │  │  │
│  │  │         │                                                      │  │  │
│  │  │    ┌────┴────┐                      ┌─────────────────────────┐ │  │  │
│  │  │    │ Token   │                      │    Encryption Layer     │ │  │  │
│  │  │    │ Store   │                      │  ┌─────┐ ┌─────┐ ┌────┐ │ │  │  │
│  │  │    └─────────┘                      │  │ DEK │ │ KEK │ │Root│ │ │  │  │
│  │  │                                     │  └─────┘ └─────┘ └────┘ │ │  │  │
│  │  └────────────────────────────────────────────────────────────────┘  │  │
│  │                                     │                                 │  │
│  │  ┌──────────────────────────────────┼───────────────────────────────┐ │  │
│  │  │                        Storage                                  │ │  │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │ │  │
│  │  │  │   SQLite    │  │   Audit     │  │      Key Store          │  │ │  │
│  │  │  │  (secrets)  │  │    Logs     │  │    (encrypted)          │  │ │  │
│  │  │  └─────────────┘  └─────────────┘  └─────────────────────────┘  │ │  │
│  │  └─────────────────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│              mTLS + Token Auth     │                                        │
│                    │               │                                        │
│         ┌──────────┴───────────┐   │                                        │
│         │                      │   │                                        │
│    ┌────┴────┐           ┌─────┴───┴─────┐                                 │
│    │  Agent  │◄─────────►│  ClawVM Agent │                                 │
│    │ Sidecar │  Unix     │   (Runtime)   │                                 │
│    │(local)  │  Socket   │               │                                 │
│    └────┬────┘           └───────┬───────┘                                 │
│         │                        │                                         │
│         │    tmpfs mount         │                                         │
│         └───────► /run/claw/     │                                         │
│                           │      │                                         │
│                    ┌──────┴──────┴───┐                                     │
│                    │   Application   │                                     │
│                    │   Process       │                                     │
│                    └─────────────────┘                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 API Design

#### Core API Endpoints

```yaml
openapi: 3.0.0
info:
  title: ClawVault API
  version: 1.0.0
  description: Secure secrets management for MoltOS

paths:
  /v1/auth/login:
    post:
      summary: Authenticate agent/service
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                method:
                  type: string
                  enum: [token, certificate, workload]
                credentials:
                  type: object
      responses:
        200:
          description: Authentication successful
          content:
            application/json:
              schema:
                type: object
                properties:
                  token:
                    type: string
                  lease_duration:
                    type: integer
                  renewable:
                    type: boolean

  /v1/secrets/{path}:
    get:
      summary: Read secret at path
      parameters:
        - name: path
          in: path
          required: true
          schema:
            type: string
        - name: version
          in: query
          schema:
            type: integer
      responses:
        200:
          description: Secret retrieved
          content:
            application/json:
              schema:
                type: object
                properties:
                  data:
                    type: object
                    additionalProperties: true
                  metadata:
                    $ref: '#/components/schemas/SecretMetadata'

    post:
      summary: Create/update secret
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                data:
                  type: object
                  additionalProperties: true
                cas:
                  type: integer
                  description: Check-and-set version
      responses:
        200:
          description: Secret stored

    delete:
      summary: Delete secret (soft delete)
      responses:
        204:
          description: Secret deleted

  /v1/secrets/{path}/versions:
    get:
      summary: List secret versions
      responses:
        200:
          description: Version list

  /v1/secrets/{path}/rotate:
    post:
      summary: Rotate secret (generates new value)
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                rotation_strategy:
                  type: string
                  enum: [auto, manual]
                grace_period:
                  type: integer
                  description: Seconds to keep old version valid
      responses:
        200:
          description: Rotation initiated

  /v1/leases/{lease_id}/renew:
    post:
      summary: Renew lease
      responses:
        200:
          description: Lease renewed

  /v1/leases/{lease_id}/revoke:
    post:
      summary: Revoke lease immediately
      responses:
        204:
          description: Lease revoked

  /v1/audit/query:
    post:
      summary: Query audit logs
      requestBody:
        content:
          application/json:
            schema:
              type: object
              properties:
                start_time:
                  type: string
                  format: date-time
                end_time:
                  type: string
                  format: date-time
                actor:
                  type: string
                resource:
                  type: string
                action:
                  type: string
      responses:
        200:
          description: Audit records

components:
  schemas:
    SecretMetadata:
      type: object
      properties:
        version:
          type: integer
        created_at:
          type: string
          format: date-time
        updated_at:
          type: string
          format: date-time
        created_by:
          type: string
        current:
          type: boolean
```

### 3.3 Encryption Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ClawVault Encryption Strategy                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  KEY HIERARCHY:                                                             │
│  ───────────────                                                            │
│                                                                             │
│  Level 1: Master Key (MK)                                                   │
│  ───────────────────────                                                    │
│  • Generated at first boot                                                  │
│  • Protected by Shamir's Secret Sharing (default: 3 of 5 shards)           │
│  • Can use external KMS (AWS/Azure/GCP) for auto-unseal                    │
│  • Never leaves memory in plaintext                                         │
│                                                                             │
│  Level 2: Key Encryption Keys (KEKs)                                        │
│  ───────────────────────────────────                                        │
│  • One KEK per secret engine/path prefix                                    │
│  • Generated by Master Key                                                  │
│  • Rotated automatically every 90 days                                      │
│  • Previous KEK kept for decryption during grace period                     │
│                                                                             │
│  Level 3: Data Encryption Keys (DEKs)                                       │
│  ───────────────────────────────────                                        │
│  • One DEK per secret                                                       │
│  • Generated per write operation                                            │
│  • Encrypted by KEK and stored alongside ciphertext                         │
│  • Unique per secret version                                                │
│                                                                             │
│  ALGORITHMS:                                                                │
│  ───────────                                                                │
│                                                                             │
│  ┌─────────────────┬─────────────────┬─────────────────────────────────┐   │
│  │     Layer       │   Algorithm     │           Notes                 │   │
│  ├─────────────────┼─────────────────┼─────────────────────────────────┤   │
│  │ DEK Encryption  │ AES-256-GCM     │ Authenticated encryption        │   │
│  │ KEK Wrapping    │ AES-256-KWP     │ Key wrap with padding           │   │
│  │ Transit         │ XChaCha20-Poly1305 │ For high-performance paths   │   │
│  │ Hashing         │ SHA-3-256       │ For audit log integrity         │   │
│  └─────────────────┴─────────────────┴─────────────────────────────────┘   │
│                                                                             │
│  STORAGE FORMAT:                                                            │
│  ───────────────                                                            │
│                                                                             │
│  {                                                                          │
│    "ciphertext": "base64(...)",        // AES-256-GCM encrypted secret      │
│    "dek": "base64(...)",               // KEK-encrypted DEK                 │
│    "kek_version": "v2",                // Which KEK encrypted this          │
│    "algorithm": "aes-256-gcm",                                              │
│    "nonce": "base64(...)",                                                  │
│    "created_at": "2026-03-13T00:37:00Z"                                     │
│  }                                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.4 Runtime Injection Mechanism

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              ClawVault Agent: Runtime Secret Injection                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  COMPONENT ARCHITECTURE:                                                    │
│  ────────────────────────                                                   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     ClawVM Agent Process                             │   │
│  │                                                                      │   │
│  │  ┌───────────────┐    ┌───────────────┐    ┌─────────────────────┐  │   │
│  │  │  Agent Core   │◄──►│  Secret       │◄──►│   ClawVault Client  │  │   │
│  │  │  (gRPC API)   │    │  Manager      │    │   (mTLS connection) │  │   │
│  │  └───────┬───────┘    └───────────────┘    └─────────────────────┘  │   │
│  │          │                                                           │   │
│  │          │ Initialize                                                │   │
│  │          ▼                                                           │   │
│  │  ┌───────────────┐                                                   │   │
│  │  │   tmpfs       │  Memory-only, 0600 permissions                    │   │
│  │  │  /run/claw/   │  Auto-created on startup                          │   │
│  │  └───────┬───────┘                                                   │   │
│  │          │                                                           │   │
│  │          │ Mount secrets as files                                    │   │
│  │          ▼                                                           │   │
│  │  /run/claw/database/password    ◄──  Database password               │   │
│  │  /run/claw/api/key              ◄──  External API key                │   │
│  │  /run/claw/tls/cert.pem         ◄──  TLS certificate                 │   │
│  │  /run/claw/tls/key.pem          ◄──  TLS private key                 │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  INJECTION FLOW:                                                            │
│  ───────────────                                                            │
│                                                                             │
│  1. Agent starts, authenticates to ClawVault Server                         │
│     └── Uses workload identity (certificate, token, or mTLS)                │
│                                                                             │
│  2. Agent requests secrets based on policy:                                 │
│     └── Which secrets this agent can access                                 │
│                                                                             │
│  3. Server returns encrypted secrets with lease                             │
│     └── Lease contains TTL and renew/deadline                               │
│                                                                             │
│  4. Agent decrypts secrets and writes to tmpfs                              │
│     └── Secrets now available as files to application                       │
│                                                                             │
│  5. Application reads secrets from /run/claw/*                              │
│     └── Standard file I/O, language-agnostic                                │
│                                                                             │
│  6. Background goroutine manages leases:                                    │
│     ├── Renews leases before expiration                                     │
│     ├── Re-fetches secrets on rotation                                      │
│     └── Cleans up files on shutdown/lease expiry                            │
│                                                                             │
│  CLEANUP GUARANTEES:                                                        │
│  ───────────────────                                                        │
│  • On SIGTERM/SIGINT: Unmount tmpfs, zero memory                            │
│  • On lease expiry: Remove associated files                                 │
│  • On process exit: Kernel automatically cleans tmpfs                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.5 ClawVM Integration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ClawVault + ClawVM Integration                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  AGENT IDENTITY MODEL:                                                      │
│  ─────────────────────                                                      │
│                                                                             │
│  Each ClawVM agent has:                                                     │
│  • Unique Agent ID (UUID)                                                   │
│  • Workload identity certificate                                            │
│  • Policy binding (what secrets it can access)                              │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     Agent Identity                                  │   │
│  │                                                                      │   │
│  │  Agent ID:     agent-7f8a9b2c-...                                    │   │
│  │  Host:         claw-host-01.moltos.local                             │   │
│  │  Purpose:      database-migration-worker                             │   │
│  │  Policy:       /policies/db-migration                                │   │
│  │                                                                      │   │
│  │  Certificate:                                                        │   │
│  │  Subject: CN=agent-7f8a9b2c, OU=clawvm-agents, O=moltos              │   │
│  │  Issuer:  CN=ClawVault CA                                            │   │
│  │  SANs:    DNS:claw-host-01, URI:spiffe://moltos/agent/7f8a9b2c       │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  POLICY EXAMPLE:                                                            │
│  ───────────────                                                            │
│                                                                             │
│  # /policies/db-migration                                                   │
│  path "database/migration/*" {                                              │
│    capabilities = ["read", "list"]                                          │
│    allowed_parameters = {                                                   │
│      "host" = ["db-prod-*.moltos.local"]                                    │
│    }                                                                        │
│    max_ttl = "1h"                                                           │
│  }                                                                          │
│                                                                             │
│  path "database/admin/*" {                                                  │
│    capabilities = []  # Explicitly deny                                     │
│  }                                                                          │
│                                                                             │
│  INTEGRATION PATTERNS:                                                      │
│  ─────────────────────                                                      │
│                                                                             │
│  Pattern A: Sidecar Injection                                               │
│  ───────────────────────────                                                │
│                                                                             │
│  ┌─────────────┐   ┌─────────────┐                                          │
│  │  ClawVM     │   │  ClawVault  │                                          │
│  │  Agent      │◄──┤  Agent      │                                          │
│  │  (app)      │   │  (sidecar)  │                                          │
│  └──────┬──────┘   └──────┬──────┘                                          │
│         │                 │                                                 │
│         └───────► /run/claw                                                 │
│                                                                             │
│  Pattern B: Direct SDK Integration                                          │
│  ────────────────────────────────                                           │
│                                                                             │
│  ┌─────────────┐                                                            │
│  │  ClawVM     │◄────────── ClawVault Go SDK                                │
│  │  Agent      │            (with caching & renewal)                         │
│  └─────────────┘                                                            │
│                                                                             │
│  Pattern C: Environment Wrapper                                             │
│  ───────────────────────────────                                            │
│                                                                             │
│  $ clawvault exec -- /app/my-agent                                          │
│  • Injects secrets as env vars ONLY for this process                        │
│  • Prevents env var leakage to parent/siblings                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Implementation Recommendations

### 4.1 Phase 1: MVP (Weeks 1-4)

| Component | Implementation | Priority |
|-----------|----------------|----------|
| Core API | REST API with token auth | P0 |
| Storage | SQLite with encryption | P0 |
| KV Engine | Basic key-value storage | P0 |
| Agent | File-based secret injection | P0 |
| CLI | Basic CRUD operations | P0 |

### 4.2 Phase 2: Security Hardening (Weeks 5-8)

| Component | Implementation | Priority |
|-----------|----------------|----------|
| mTLS | Mutual authentication | P1 |
| Policy Engine | RBAC with path-based policies | P1 |
| Audit Logging | Structured JSON logs | P1 |
| Encryption | Envelope encryption with versioning | P1 |
| Rotation | Manual rotation API | P1 |

### 4.3 Phase 3: Production Features (Weeks 9-12)

| Component | Implementation | Priority |
|-----------|----------------|----------|
| Dynamic Secrets | Database credential generation | P2 |
| Auto-Rotation | Scheduled rotation with dual-credential | P2 |
| HA Mode | Raft consensus for clustering | P2 |
| SDKs | Go, Python, JavaScript SDKs | P2 |
| UI | Web dashboard for management | P2 |

### 4.4 Security Checklist

```
□ Encryption
  □ All secrets encrypted at rest (AES-256-GCM)
  □ All traffic encrypted in transit (TLS 1.3)
  □ Envelope encryption with key hierarchy
  □ Automatic key rotation

□ Access Control
  □ Authentication required for all operations
  □ RBAC with least privilege
  □ Token-based access with TTL
  □ mTLS for service-to-service auth

□ Audit & Compliance
  □ All access logged with immutable logs
  □ Structured audit events
  □ Log retention policy
  □ Tamper-evident log storage

□ Runtime Security
  □ Secrets never in env vars
  □ Memory-only secret storage (tmpfs)
  □ Automatic cleanup on exit
  □ Secret redaction in logs

□ Operational Security
  □ Sealed at rest (auto-unseal optional)
  □ Backup encryption
  □ Disaster recovery procedures
  □ Secret rotation procedures
```

---

## 5. Comparison Summary

| Feature | HashiCorp Vault | AWS Secrets Manager | Kubernetes Secrets | 1Password | **ClawVault (Proposed)** |
|---------|----------------|---------------------|-------------------|-----------|--------------------------|
| **Encryption at Rest** | Yes (HSM option) | Yes (KMS) | Optional | Yes | Yes (envelope) |
| **Encryption in Transit** | TLS/mTLS | TLS | None | TLS | TLS 1.3/mTLS |
| **Dynamic Secrets** | Yes | Yes | No | No | Phase 2 |
| **Auto Rotation** | Yes | Yes | No | No | Phase 3 |
| **Audit Logging** | Comprehensive | CloudTrail | Minimal | Yes | Comprehensive |
| **Self-Hosted** | Yes | No | Yes | Partial | Yes |
| **Memory-Only Injection** | Via agent | Via agent | No | Via SDK | Native |
| **Agent Integration** | Native | Native | None | SDK | Native (ClawVM) |
| **Complexity** | High | Medium | Low | Low | Low-Medium |
| **Operational Cost** | High | $$ | Free | $ | Low |

---

## 6. Conclusion

ClawVault is designed to provide production-grade secrets management tailored for MoltOS and ClawVM agents. Key design principles:

1. **Security First**: Envelope encryption, mTLS, memory-only secrets, comprehensive audit logging
2. **Simplicity**: Easier to operate than Vault while maintaining essential security features
3. **Agent-Native**: Deep integration with ClawVM workload identity and runtime
4. **Production-Ready**: HA, rotation, and dynamic secrets for enterprise use
5. **Compliance**: Built-in support for SOC 2, PCI DSS, and HIPAA requirements

The phased implementation approach allows for iterative deployment, starting with basic secret storage and progressing to advanced features like dynamic secrets and automatic rotation.

---

*Document Version: 1.0*  
*Date: 2026-03-13*  
*Author: MoltOS Research Team*
