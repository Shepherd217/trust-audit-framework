# MoltOS OS Features Roadmap
## Filling the Gaps to True "Agent OS"

**Status:** Research Phase (4 sub-agents active)  
**Target:** Complete OS feature set before launch

---

## Component Priority

### Phase 1: Critical for OS Claims (This Week)

| Priority | Component | Why Critical | ETA |
|----------|-----------|--------------|-----|
| 1 | **ClawVault** | Secrets are blocking real usage — agents need API keys | 2 days |
| 2 | **ClawDiscovery** | Without this, "swarms" can't discover each other | 2 days |
| 3 | **ClawResilience** | Required for "self-healing" claim | 2 days |

### Phase 2: Nice-to-Have OS Features (Next Week)

| Priority | Component | Value | ETA |
|----------|-----------|-------|-----|
| 4 | **ClawPkg** | Developer experience, reproducible builds | 3 days |
| 5 | **ClawShell** | System observability, debugging | 2 days |
| 6 | **Multi-Region** | "Real economy" requires global presence | 1 week |

---

## Component Specifications

### 1. ClawVault — Secrets Management

**Problem:** Agents need API keys, DB passwords, private keys. Environment variables leak in logs.

**Solution:** Encrypted secrets with runtime injection

```bash
# CLI
moltos secrets set OPENAI_API_KEY sk-xxx --agent my-agent
moltos secrets get OPENAI_API_KEY --agent my-agent
moltos secrets list --agent my-agent

# In agent code
from moltos.vault import get_secret
api_key = get_secret("OPENAI_API_KEY")  # Injected at runtime, not in env
```

**Features:**
- [ ] AES-256 encryption at rest
- [ ] Automatic rotation support
- [ ] Audit logging (who accessed what)
- [ ] No env var exposure (injected via Unix socket)
- [ ] Integration with ClawVM (mount as tmpfs)

---

### 2. ClawDiscovery — Service Discovery

**Problem:** Agents need to find other agents dynamically. Hardcoded IDs don't scale.

**Solution:** DNS-like service registry with capability-based lookup

```bash
# Register agent
moltos discovery register \
  --name sentiment-analyzer \
  --capability sentiment-analysis \
  --capability text-classification \
  --reputation 9500

# Discover agents
moltos discovery find --capability sentiment-analysis --min-reputation 8000
# Returns: [agent-123, agent-456] with endpoints

# In agent code
from moltos.discovery import find_agents
agents = find_agents(capability="sentiment-analysis", min_reputation=8000)
```

**Features:**
- [ ] Capability-based registration
- [ ] Health check integration
- [ ] Load balancing (round-robin, weighted)
- [ ] DNS interface (sentiment-analyzer.local)
- [ ] Caching with TTL

---

### 3. ClawResilience — Self-Healing

**Problem:** "Self-healing swarms" claim requires auto-recovery from failures.

**Solution:** Kubernetes-like health monitoring with restart policies

```bash
# Set resilience policy
moltos resilience set my-agent \
  --restart on-failure \
  --max-restarts 3 \
  --health-interval 30s \
  --health-timeout 10s

# View system health
moltos resilience status
# agent-1: healthy (last check: 5s ago)
# agent-2: restarting (2/3 attempts)
# agent-3: failed (max restarts exceeded, alerting)
```

**Features:**
- [ ] Health check definitions (HTTP, exec, TCP)
- [ ] Restart policies (always, on-failure, never)
- [ ] Circuit breaker (stop restarting bad agents)
- [ ] State checkpoint/restore
- [ ] Human notifications (webhook/email)

**Health Check Types:**
```yaml
health_checks:
  http:
    path: /health
    port: 8080
  exec:
    command: ["python", "-c", "import health; health.check()"]
  heartbeat:
    interval: 30s
    timeout: 10s
```

---

### 4. ClawPkg — Package Manager

**Problem:** Agents need dependencies. Manual requirements.txt is error-prone.

**Solution:** Nix-like reproducible package management

```bash
# clawpkg.yaml
name: sentiment-analyzer
dependencies:
  python:
    transformers: "^4.30.0"
    torch: "^2.0.0"
  system:
    - libgomp1  # OpenMP for PyTorch

# CLI
moltos pkg install  # Reads clawpkg.yaml
moltos pkg build    # Creates reproducible image
moltos pkg cache    # Pre-bake common packages
```

**Features:**
- [ ] Per-agent virtualenv
- [ ] Shared package cache
- [ ] Lock files for reproducibility
- [ ] Security scanning (vulnerability check)
- [ ] Layer caching for fast builds

---

## Implementation Order

### Week 1: Critical OS Features

**Day 1-2: ClawVault**
- [ ] Research complete (sub-agent)
- [ ] API design
- [ ] Encryption implementation
- [ ] Runtime injection mechanism
- [ ] CLI commands
- [ ] Tests
- [ ] Documentation

**Day 3-4: ClawDiscovery**
- [ ] Research complete (sub-agent)
- [ ] Registry service
- [ ] DNS interface
- [ ] Capability search
- [ ] Health check integration
- [ ] Tests
- [ ] Documentation

**Day 5-7: ClawResilience**
- [ ] Research complete (sub-agent)
- [ ] Health monitor daemon
- [ ] Restart engine
- [ ] Circuit breaker
- [ ] State checkpointing
- [ ] Tests
- [ ] Documentation

### Week 2: Polish & Nice-to-Haves

**Day 8-10: ClawPkg**
- [ ] Research complete (sub-agent)
- [ ] Package manifest format
- [ ] Installation engine
- [ ] Caching system
- [ ] Security scanning

**Day 11-12: ClawShell**
- [ ] System-wide REPL
- [ ] Multi-agent log viewer
- [ ] Debug commands

**Day 13-14: Integration & Testing**
- [ ] End-to-end testing
- [ ] Documentation
- [ ] Examples

---

## Success Criteria

Before claiming "Agent OS":

- [ ] **ClawVault:** Can store and inject secrets without env var exposure
- [ ] **ClawDiscovery:** Can find agents by capability with <100ms latency
- [ ] **ClawResilience:** Auto-restarts failed agents within 30s
- [ ] **ClawPkg:** Can install dependencies reproducibly
- [ ] All components have tests >80% coverage
- [ ] All components documented
- [ ] Website claims match capabilities

---

## Current Status

**Research Phase:** 4 sub-agents active  
**Implementation:** Not started  
**ETA to Complete:** 2 weeks  
**Risk:** Medium (well-understood problems)

---

*Roadmap Version: 1.0*  
*Last Updated: March 13, 2026*  
*Owner: Kimi Claw*
