# ClawPkg Design Document
## Package Manager for MoltOS Agents

**Version:** 1.0  
**Date:** 2026-03-13  
**Status:** Design Draft

---

## Executive Summary

ClawPkg is the package manager designed specifically for MoltOS agents. It provides isolated, reproducible, and secure package environments for AI agents while optimizing for the unique requirements of agent-based systems: fast startup, shared caching, and conflict-free dependency resolution across multiple agents.

---

## 1. Research Insights

### 1.1 pip/conda (Python Ecosystem)

**Key Strengths:**
- **pip**: Simple, universal Python package installation from PyPI
- **conda**: Full environment isolation with binary package support; handles non-Python dependencies
- Virtual environments provide project-level isolation

**Key Weaknesses:**
- pip has slow dependency resolution (improved in recent versions with backtracking)
- No lock file by default → reproducibility issues
- pip doesn't manage environments; requires separate tools (venv, virtualenv)
- conda uses SAT solver for dependency resolution but can be slow
- "Dependency hell" from conflicting transitive dependencies
- Security scanning requires external tools (pip-audit, safety)

**Lessons for ClawPkg:**
- Must provide lock files for reproducibility by default
- Environment isolation should be built-in, not bolted-on
- Dependency resolution needs to be fast and deterministic
- Should handle binary dependencies (like conda) for ML/AI workloads

### 1.2 npm/yarn (Node.js Ecosystem)

**Key Strengths:**
- **Lock files** (`package-lock.json`, `yarn.lock`) ensure deterministic installs
- **Workspaces** enable monorepo management with hoisted dependencies
- **npm audit** provides built-in vulnerability scanning
- **Yarn PnP (Plug'n'Play)** eliminates `node_modules` bloat

**Key Weaknesses:**
- `node_modules` can be massive ("black hole of dependencies")
- Nested dependency trees can cause duplication
- Version conflicts between packages requiring different versions of shared dependencies

**Lessons for ClawPkg:**
- Lock files are essential for CI/CD and reproducibility
- Workspaces pattern useful for managing multiple agents
- Built-in security scanning should be standard
- Content-addressable storage (like PnP) reduces duplication

### 1.3 Docker Multi-Stage Builds

**Key Strengths:**
- **Layer caching**: Layers are cached and reused when unchanged
- **Multi-stage builds**: Separate build and runtime environments
- **BuildKit cache mounts**: Persist package manager caches across builds
- Deterministic builds from Dockerfile instructions

**Key Patterns:**
```dockerfile
# Copy dependency manifests first (stable layer)
COPY package.json package-lock.json ./
RUN npm ci  # Cached until manifests change
# Copy source code last (frequently changing layer)
COPY . .
```

**Lessons for ClawPkg:**
- Order matters: stable content should be cached separately from volatile content
- Layer-style caching can dramatically speed up agent startup
- Multi-stage approach: separate dependency resolution from runtime
- Shared base layers reduce storage across agents

### 1.4 Nix (Functional Package Management)

**Key Strengths:**
- **Pure functional builds**: Packages are immutable, identified by content hash
- **Nix store** (`/nix/store`): All packages in isolation, no conflicts
- **Reproducibility**: Same inputs always produce same outputs
- **Atomic upgrades/rollbacks**: Profiles as symlinks, instant switching
- **Sandboxing**: Builds isolated from host environment

**Key Concepts:**
```
/nix/store/<hash>-package-name-version/
```

**Lessons for ClawPkg:**
- Content-addressable storage eliminates conflicts entirely
- Immutable packages enable safe sharing and caching
- Sandboxed builds ensure no hidden dependencies
- Rollback capability is valuable for agent stability

---

## 2. Key Design Questions

### 2.1 How to Install Packages into Isolated Agent Environments?

**Approach: Layered Isolation Model**

```
┌─────────────────────────────────────────────────────────────┐
│                    Agent Runtime Layer                       │
│         (Per-agent, mutable, fast startup)                  │
├─────────────────────────────────────────────────────────────┤
│                  Agent Dependency Layer                      │
│         (Per-agent, immutable packages)                     │
├─────────────────────────────────────────────────────────────┤
│                  Shared Base Layer                           │
│    (Common packages shared across agents - read-only)       │
├─────────────────────────────────────────────────────────────┤
│                  System Layer                                │
│              (ClawVM base image)                            │
└─────────────────────────────────────────────────────────────┘
```

**Implementation:**
- Each agent gets its own overlay filesystem
- Shared base layer contains common dependencies (Python stdlib, numpy, requests, etc.)
- Agent-specific packages are layered on top
- Copy-on-write semantics for efficiency

### 2.2 How to Cache Packages to Avoid Repeated Downloads?

**Multi-Tier Caching Strategy:**

```
┌─────────────────────────────────────────────────────────────┐
│  Tier 1: In-Memory Cache (per ClawVM instance)              │
│  - Fastest access                                           │
│  - LRU eviction                                             │
│  - Holds recently used packages                             │
├─────────────────────────────────────────────────────────────┤
│  Tier 2: Local Disk Cache (per node)                        │
│  - Content-addressable storage                              │
│  - Survives agent restarts                                  │
│  - Shared across all agents on node                         │
├─────────────────────────────────────────────────────────────┤
│  Tier 3: Distributed Cache (cluster-wide)                   │
│  - Redis/S3-compatible backend                              │
│  - Cross-node sharing                                       │
│  - Fallback for rare packages                               │
└─────────────────────────────────────────────────────────────┘
```

**Key Features:**
- Packages stored by content hash (SHA-256)
- Deduplication: identical packages stored once
- Lazy loading: fetch from remote only when needed
- Prefetching: predict and cache likely-needed packages

### 2.3 How to Handle Conflicting Dependencies Between Agents?

**Content-Addressable Storage + Namespacing:**

```python
# Package A needs requests==2.28.0
# Package B needs requests==2.31.0

# Both versions coexist in the store:
# /var/lib/clawpkg/store/sha256:abc123...-requests-2.28.0/
# /var/lib/clawpkg/store/sha256:def456...-requests-2.31.0/

# Each agent gets its own dependency graph:
agent_a_env = {
    "requests": "sha256:abc123...",  # 2.28.0
    "urllib3": "sha256:xyz789...",
}

agent_b_env = {
    "requests": "sha256:def456...",  # 2.31.0
    "urllib3": "sha256:xyz789...",   # Same version, shared
}
```

**Conflict Resolution Strategy:**
- No global package namespace - each agent has isolated dependency graph
- Same package/version pairs are automatically shared (content-addressed)
- Different versions coexist without conflict
- Disk space efficient through deduplication

### 2.4 Version Pinning vs Auto-Updates Tradeoffs

**Hybrid Approach:**

| Scenario | Strategy | Rationale |
|----------|----------|-----------|
| Production agents | Strict pinning via `claw.lock` | Reproducibility, stability |
| Development agents | Semver ranges in `claw.toml` | Flexibility, latest features |
| Security patches | Automated PRs to update lock | Security without breaking changes |
| Base system packages | Auto-update with rollback | Security, convenience |

**Implementation:**
```toml
# claw.toml - manifest file (flexible)
[dependencies]
requests = ">=2.28.0,<3.0.0"  # Semver range
numpy = "^1.24.0"             # Compatible versions

[dependencies.security]
pydantic = ">=2.0.0"          # Minimum for security patches
```

```toml
# claw.lock - lock file (strict)
[[package]]
name = "requests"
version = "2.31.0"
hash = "sha256:abc123..."
dependencies = ["urllib3:sha256:xyz789...", "certifi:sha256:..."]

[[package]]
name = "urllib3"
version = "2.0.7"
hash = "sha256:xyz789..."
```

### 2.5 Security Scanning of Packages

**Integrated Security Pipeline:**

```
┌─────────────────────────────────────────────────────────────┐
│  Pre-Install Scan                                           │
│  - Query vulnerability database (CVE, GHSA, OSV)            │
│  - Check package signatures                                 │
│  - Verify checksums                                         │
├─────────────────────────────────────────────────────────────┤
│  Install-Time Scan                                          │
│  - Static analysis of package code                          │
│  - Detect suspicious patterns (obfuscated code, network)    │
│  - Sandboxed execution test                                 │
├─────────────────────────────────────────────────────────────┤
│  Continuous Monitoring                                      │
│  - Periodic re-scan of installed packages                   │
│  - Alert on new vulnerabilities                             │
│  - Automated patch recommendations                          │
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- Integration with OSV (Open Source Vulnerabilities) database
- Policy enforcement: block packages with critical vulnerabilities
- Audit logging: track all installed packages with provenance
- SBOM generation for compliance

---

## 3. ClawPkg Design Specification

### 3.1 Package Manifest Format

**File: `claw.toml`** (inspired by `pyproject.toml` + `Cargo.toml`)

```toml
[package]
name = "my-agent"
version = "1.0.0"
description = "A sample MoltOS agent"
authors = ["Agent Author <author@example.com>"]
license = "MIT"
readme = "README.md"
python = "^3.11"  # Python version requirement

[dependencies]
# Runtime dependencies
requests = ">=2.31.0"
numpy = "^1.24.0"
pydantic = "~2.5.0"  # Compatible with 2.5.x
openai = { version = ">=1.0", optional = true }

[dependencies.groups]
# Dependency groups (like npm workspaces, Poetry groups)
ml = ["torch", "transformers", "datasets"]
web = ["fastapi", "uvicorn", "jinja2"]

[dev-dependencies]
pytest = "^7.0"
mypy = "^1.0"
black = "^23.0"

[tool.clawpkg]
# ClawPkg-specific configuration
isolation = "strict"  # strict | shared
base-image = "clawvm/python:3.11-slim"
cache-strategy = "aggressive"

[tool.clawpkg.security]
audit-level = "high"  # critical | high | medium | low
block-vulnerable = true
allow-unverified = false

[tool.clawpkg.cache]
max-size = "10GB"
ttl = "30d"
prefetch = ["numpy", "requests", "pydantic"]
```

**Key Design Decisions:**
- Uses TOML for human readability and machine parsing
- Follows PEP 621 where applicable (standard Python packaging)
- Semantic versioning with caret (^) and tilde (~) operators
- Optional dependencies for modularity
- Dependency groups for feature sets

### 3.2 Installation API

**Command-Line Interface:**

```bash
# Initialize a new agent project
clawpkg init my-agent --template=web

# Add dependencies
clawpkg add requests numpy
clawpkg add torch --group=ml
clawpkg add pytest --dev

# Install all dependencies (creates/updates claw.lock)
clawpkg install

# Sync environment to match claw.lock exactly
clawpkg sync

# Update dependencies and regenerate lock file
clawpkg update
clawpkg update requests  # Update single package

# Run command in agent environment
clawpkg run python agent.py
clawpkg run pytest

# Build agent package (for distribution)
clawpkg build

# Publish to ClawPkg registry
clawpkg publish

# Security audit
clawpkg audit
clawpkg audit --fix  # Auto-fix where possible

# Clean caches
clawpkg clean
clawpkg clean --all
```

**Python API:**

```python
import clawpkg

# Install packages into agent environment
clawpkg.install(
    agent_id="agent-123",
    packages=["requests>=2.31.0", "numpy"],
    sync=True  # Update lock file
)

# Get agent environment info
env = clawpkg.get_environment("agent-123")
print(env.packages)  # List installed packages
print(env.python_version)  # Python version

# Run code in isolated environment
result = clawpkg.run(
    agent_id="agent-123",
    command=["python", "agent.py"],
    timeout=300
)

# Security scan
report = clawpkg.audit(agent_id="agent-123")
for vuln in report.vulnerabilities:
    print(f"{vuln.package}: {vuln.severity} - {vuln.cve_id}")
```

### 3.3 Caching Strategy

**Content-Addressable Package Store:**

```
/var/lib/clawpkg/
├── store/                          # Immutable package store
│   ├── sha256:abc123...-requests-2.31.0/
│   │   ├── metadata.json
│   │   └── lib/
│   ├── sha256:def456...-numpy-1.24.0/
│   └── ...
├── cache/                          # Download cache
│   ├── pypi/                       # PyPI package cache
│   ├── wheels/                     # Built wheel cache
│   └── index/                      # Package index cache
├── environments/                   # Agent environments (thin layers)
│   ├── agent-123/
│   │   ├── claw.toml
│   │   ├── claw.lock
│   │   └── overlay/                # Copy-on-write overlay
│   └── ...
└── shared/                         # Shared base layers
    ├── python-3.11-slim/
    └── common-ml-packages/
```

**Cache Policies:**

| Cache Type | Eviction Policy | Max Size | TTL |
|------------|-----------------|----------|-----|
| Package store | LRU (manual cleanup) | 50GB | Infinite |
| Download cache | LRU | 10GB | 7 days |
| Wheel cache | LRU | 5GB | 30 days |
| Index cache | TTL-based | 100MB | 1 hour |

**Prefetching Strategy:**
- Analyze `claw.toml` dependencies
- Predict transitive dependencies
- Prefetch during idle time
- Prioritize packages by frequency of use across agents

### 3.4 Build Reproducibility (Lock Files)

**`claw.lock` Format:**

```toml
# This file is automatically generated by ClawPkg.
# It is not intended for manual editing.
version = 1

[[package]]
name = "requests"
version = "2.31.0"
source = "pypi"
hash = "sha256:abc123..."
hash-algorithm = "sha256"
dependencies = [
    "charset-normalizer:sha256:...",
    "idna:sha256:...",
    "urllib3:sha256:...",
    "certifi:sha256:...",
]

[[package]]
name = "urllib3"
version = "2.0.7"
source = "pypi"
hash = "sha256:def456..."
dependencies = []

[metadata]
python-version = "3.11.6"
clawpkg-version = "1.0.0"
lock-date = "2026-03-13T10:00:00Z"

[metadata.requires-hashes]
enabled = true
```

**Reproducibility Guarantees:**
- Exact package versions pinned
- Content hashes verified on install
- Python version recorded
- Platform-specific wheels tracked separately
- Build dependencies recorded for source packages

### 3.5 Integration with ClawVM

**Two-Mode Operation:**

#### Mode A: Pre-baked Images (Recommended for Production)

```
┌─────────────────────────────────────────────────────────────┐
│  ClawVM Base Image (pre-built)                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Layer 0: Minimal OS (Alpine/Debian slim)            │  │
│  │  Layer 1: Python Runtime                              │  │
│  │  Layer 2: Common packages (numpy, requests, etc.)    │  │
│  │  Layer 3: Agent-specific packages (baked at build)   │  │
│  └───────────────────────────────────────────────────────┘  │
│                         ↑                                   │
│              Built from claw.toml + claw.lock               │
└─────────────────────────────────────────────────────────────┘
```

**Build Process:**
```bash
# CI/CD pipeline builds agent image
clawpkg build-image --from=claw.toml --tag=my-agent:v1.0.0

# Image contains fully resolved environment
# Fast startup - no dependency resolution at runtime
```

#### Mode B: Dynamic Install (Development/Flexibility)

```
┌─────────────────────────────────────────────────────────────┐
│  ClawVM Base Image (minimal)                                │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Layer 0: Minimal OS                                   │  │
│  │  Layer 1: Python Runtime + ClawPkg                     │  │
│  └───────────────────────────────────────────────────────┘  │
│                         ↓                                   │
│  Agent start: clawpkg sync (resolves from claw.lock)        │
│                         ↓                                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │  Layer 2+: Dynamic overlay with agent packages       │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Startup Sequence:**
```python
# On agent container start:
1. Check if claw.lock matches installed packages
2. If mismatch: clawpkg sync (incremental update)
3. If match: skip (fast path)
4. Start agent process
```

**Hybrid Approach:**
- Production: Pre-baked images for fastest startup
- Development: Dynamic install for flexibility
- Staging: Pre-baked with dynamic layer for testing updates

---

## 4. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          ClawPkg CLI/API                            │
├─────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │  Resolver   │  │   Builder   │  │   Auditor   │  │   Runner    │ │
│  │  Engine     │  │             │  │             │  │             │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│                         Core Services                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │  Package    │  │   Lock      │  │    Cache    │  │  Security   │ │
│  │  Registry   │  │   Manager   │  │   Manager   │  │   Scanner   │ │
│  │  Client     │  │             │  │             │  │             │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │
├─────────────────────────────────────────────────────────────────────┤
│                        Storage Layer                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │   Local     │  │  Distributed│  │   ClawVM    │  │  External   │ │
│  │   Store     │  │    Cache    │  │  Integration│  │  Registries │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| Resolver Engine | SAT solver for dependency resolution, conflict detection |
| Builder | Package building from source, wheel compilation |
| Auditor | Security scanning, license checking |
| Runner | Environment execution, isolation management |
| Package Registry Client | Interface to PyPI, Conda, private registries |
| Lock Manager | Lock file generation, validation, migration |
| Cache Manager | Multi-tier caching, prefetching, eviction |
| Security Scanner | Vulnerability database queries, static analysis |

---

## 5. Security Model

### 5.1 Supply Chain Security

```
┌─────────────────────────────────────────────────────────────┐
│  Package Provenance                                         │
│  - Verify package signatures (Sigstore, GPG)                │
│  - Record package origin and download URL                   │
│  - Checksum verification on all downloads                   │
├─────────────────────────────────────────────────────────────┤
│  Build Reproducibility                                      │
│  - Sandboxed builds (no network, no host access)            │
│  - Record build environment and tools                       │
│  - Attestation generation                                   │
├─────────────────────────────────────────────────────────────┤
│  Vulnerability Management                                   │
│  - OSV database integration                                 │
│  - Continuous monitoring                                    │
│  - Automated patch generation                               │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Runtime Security

- **Namespace isolation**: Each agent in separate Linux namespace
- **Capability dropping**: Minimal privileges for agent processes
- **Read-only root**: Agent code mounted read-only
- **Seccomp profiles**: Restricted syscall access
- **Resource limits**: CPU, memory, I/O quotas

---

## 6. Comparison with Existing Tools

| Feature | pip+venv | Poetry | conda | npm | Nix | ClawPkg |
|---------|----------|--------|-------|-----|-----|---------|
| Lock files | ❌ Manual | ✅ | ❌ | ✅ | ✅ | ✅ |
| Fast resolution | ⚠️ | ✅ | ⚠️ | ✅ | ⚠️ | ✅ |
| Content-addressed | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Built-in security scan | ❌ | ❌ | ❌ | ✅ | ❌ | ✅ |
| Multi-agent isolation | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| Shared caching | ❌ | ❌ | ✅ | ❌ | ✅ | ✅ |
| Pre-baked images | ❌ | ❌ | ❌ | ❌ | ⚠️ | ✅ |
| Rollback support | ❌ | ❌ | ⚠️ | ❌ | ✅ | ✅ |
| Agent-optimized | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 7. Implementation Roadmap

### Phase 1: Core Package Manager (MVP)
- [ ] `claw.toml` parser
- [ ] Dependency resolver (resolvelib-based)
- [ ] `claw.lock` generator
- [ ] Basic installation from PyPI
- [ ] Content-addressable local store

### Phase 2: Environment Management
- [ ] Per-agent virtual environments
- [ ] Overlay filesystem integration
- [ ] `clawpkg run` command
- [ ] Multi-tier caching

### Phase 3: ClawVM Integration
- [ ] Pre-baked image builder
- [ ] Dynamic install mode
- [ ] Layer caching optimization
- [ ] Container runtime integration

### Phase 4: Security & Enterprise
- [ ] Vulnerability scanner
- [ ] SBOM generation
- [ ] Private registry support
- [ ] Audit logging
- [ ] Policy enforcement

### Phase 5: Advanced Features
- [ ] Workspace/monorepo support
- [ ] Distributed caching
- [ ] Build parallelization
- [ ] AI-powered prefetching

---

## 8. Open Questions

1. **Conda compatibility**: Should ClawPkg support conda packages (binary dependencies) or focus on PyPI + wheels?
2. **GPU support**: How to handle CUDA/ROm dependencies efficiently across agents?
3. **Network policies**: Should agents have network access during package installation?
4. **Package signing**: Should ClawPkg maintain its own package signing infrastructure?
5. **Garbage collection**: How to safely clean up unused packages without breaking agents?

---

## 9. Conclusion

ClawPkg combines the best ideas from existing package managers:
- **Lock files** from npm/Yarn for reproducibility
- **Content-addressable storage** from Nix for conflict-free sharing
- **Layer caching** from Docker for fast startup
- **Fast resolution** from uv/PDM for performance
- **Security scanning** integrated throughout

The result is a package manager purpose-built for MoltOS agents: isolated, reproducible, secure, and optimized for the unique requirements of AI agent workloads.

---

## Appendix A: Glossary

- **Agent**: An AI agent running on MoltOS
- **ClawVM**: The virtual machine/runtime for MoltOS agents
- **Content-addressable storage**: Storage where data is retrieved by its content hash, not location
- **Lock file**: A file that records exact versions and hashes of all dependencies
- **Overlay filesystem**: A filesystem that layers changes on top of a read-only base
- **SAT solver**: An algorithm for determining if a set of constraints can be satisfied
- **SBOM**: Software Bill of Materials - a list of all components in software

## Appendix B: References

- [PEP 621](https://peps.python.org/pep-0621/) - Storing project metadata in pyproject.toml
- [PEP 723](https://peps.python.org/pep-0723/) - Inline script metadata
- [OSV Schema](https://ossf.github.io/osv-schema/) - Open Source Vulnerability format
- [Sigstore](https://www.sigstore.dev/) - Software signing infrastructure
- [Nix Pills](https://nixos.org/guides/nix-pills/) - Nix tutorial series
- [Dockerfile Best Practices](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/)
