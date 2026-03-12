# ClawDiscovery: Service Discovery Architecture for MoltOS Agents

## Executive Summary

ClawDiscovery is a purpose-built service discovery system designed for MoltOS agents — autonomous, capability-based software entities that dynamically discover and collaborate with each other. This document presents the architecture, drawing from proven patterns in Consul, Kubernetes, AWS Cloud Map, etcd, and Zookeeper, while addressing the unique requirements of agent-based systems.

---

## 1. Research: Service Discovery in Distributed Systems

### 1.1 Consul Architecture (HashiCorp)

**Core Components:**
- **Consul Agent**: Runs on every node in client or server mode
- **Server Cluster**: Maintains state using Raft consensus (typically 3-5 nodes)
- **Service Catalog**: Centralized registry of all services and their health status
- **Gossip Protocol (Serf)**: LAN/WAN membership management and failure detection

**Key Features:**
- **DNS Interface**: Services discoverable via `service-name.service.consul` queries
- **HTTP API**: RESTful interface for registration and discovery
- **Health Checks**: Multiple check types (HTTP, TCP, script, TTL)
- **Multi-Datacenter**: WAN gossip for cross-region federation
- **KV Store**: Hierarchical configuration storage

**Agent Capability Registration Pattern:**
```json
{
  "service": {
    "name": "payment-api",
    "tags": ["v2", "production"],
    "port": 8080,
    "meta": {
      "version": "2.1.0",
      "region": "us-east-1"
    },
    "check": {
      "http": "http://localhost:8080/health",
      "interval": "10s"
    }
  }
}
```

**Lessons for ClawDiscovery:**
- Sidecar agent pattern enables decentralized health checking
- Tags provide flexible metadata for filtering
- Both DNS and API interfaces serve different use cases
- Raft consensus ensures strong consistency for registry state

---

### 1.2 Kubernetes DNS + Endpoints

**Architecture:**
- **CoreDNS**: Cluster DNS server watching Kubernetes API
- **Service Resources**: Logical abstraction with stable ClusterIP
- **Endpoints/EndpointSlices**: Actual pod IPs behind a service
- **kube-proxy**: Implements virtual IP load balancing

**DNS Schema:**
- `service-name.namespace.svc.cluster.local` → ClusterIP
- `pod-name.service-name.namespace.svc.cluster.local` → Pod IP (headless)

**Service Discovery Flow:**
1. Client queries CoreDNS for service name
2. CoreDNS returns ClusterIP (for standard services) or Pod IPs (for headless)
3. kube-proxy load balances connections to ClusterIP
4. For headless services, client receives all endpoints for client-side LB

**EndpointSlice API (Modern):**
```yaml
apiVersion: discovery.k8s.io/v1
kind: EndpointSlice
metadata:
  name: my-service-ab12
  labels:
    kubernetes.io/service-name: my-service
addressType: IPv4
ports:
  - name: http
    port: 8080
endpoints:
  - addresses: ["10.0.1.5"]
    conditions:
      ready: true
    zone: us-east-1a
```

**Lessons for ClawDiscovery:**
- Separation of logical service name from physical endpoints
- Headless services enable direct client-to-agent communication
- Watch-based updates (via API) enable reactive discovery
- Labels enable rich metadata-based selection

---

### 1.3 AWS Cloud Map

**Core Concepts:**
- **Namespace**: Logical grouping (maps to Route 53 zone or HTTP-only)
- **Service**: Named collection of instances within a namespace
- **Service Instance**: Individual endpoint with attributes

**Discovery Modes:**
1. **DNS-based**: Integrates with Route 53 for traditional DNS resolution
2. **API-based**: Direct `DiscoverInstances` API calls with filtering

**Instance Registration:**
```json
{
  "ServiceId": "payment-api",
  "InstanceId": "payment-api-001",
  "Attributes": {
    "AWS_INSTANCE_IPV4": "10.0.1.5",
    "AWS_INSTANCE_PORT": "8080",
    "version": "2.1.0",
    "region": "us-east-1"
  }
}
```

**Query with Filtering:**
```json
{
  "NamespaceName": "production",
  "ServiceName": "payment-api",
  "QueryParameters": {
    "version": "2.*",
    "region": "us-east-1"
  }
}
```

**Lessons for ClawDiscovery:**
- Rich attribute-based filtering at discovery time
- HTTP-only namespaces for API-only discovery (no DNS TTL issues)
- Instance-level metadata for fine-grained routing
- Integration with ECS for automatic lifecycle management

---

### 1.4 etcd (Kubernetes' Backing Store)

**Architecture:**
- Distributed key-value store using Raft consensus
- Strong consistency guarantees (linearizable reads/writes)
- Watch API for real-time change notifications
- Keys organized hierarchically like a filesystem

**Kubernetes Service Storage:**
```
/registry/services/specs/default/my-service
/registry/services/endpoints/default/my-service
/registry/pods/default/my-pod-xxx
```

**Key Capabilities:**
- **Watch**: Clients subscribe to key prefixes for change notifications
- **Transactions**: Multi-key atomic operations
- **Leases**: Time-bound keys (perfect for ephemeral agent registration)
- **Clustering**: 3+ nodes for HA, survives (N-1)/2 failures

**Lessons for ClawDiscovery:**
- Watch mechanism enables reactive discovery (push vs pull)
- Leases provide natural health checking (expired = unhealthy)
- Hierarchical key structure enables efficient prefix queries
- Raft provides proven consensus for distributed state

---

### 1.5 Apache Zookeeper

**Architecture:**
- Ensemble of servers (3, 5, or 7) with leader election
- ZNodes: Hierarchical data nodes (persistent or ephemeral)
- Watches: One-time event subscriptions on znode changes

**Coordination Patterns:**
1. **Ephemeral Sequential ZNodes**: Leader election, distributed locks
2. **Ephemeral ZNodes**: Service registration (auto-delete on disconnect)
3. **Persistent ZNodes**: Configuration storage

**Service Discovery Pattern:**
```
/services
  /payment-api
    /instance-00000001 (ephemeral) - 10.0.1.5:8080
    /instance-00000002 (ephemeral) - 10.0.1.6:8080
```

**Lessons for ClawDiscovery:**
- Ephemeral nodes provide automatic cleanup on failure
- Watches enable efficient change notification
- Sequential nodes enable ordering without coordination
- Simple primitives compose into complex patterns

---

## 2. Key Design Questions for MoltOS

### 2.1 How Do Agents Register Their Capabilities?

**Approach: Capability-Centric Registration**

Unlike traditional services that register by name ("payment-api"), MoltOS agents register by capability:

```json
{
  "agent_id": "agent-uuid-1234",
  "name": "ImageAnalysisAgent",
  "endpoint": "https://10.0.1.5:8443",
  "capabilities": [
    {
      "name": "image.classification",
      "version": "1.2.0",
      "parameters": {
        "supported_formats": ["jpg", "png", "webp"],
        "max_resolution": "4096x4096"
      }
    },
    {
      "name": "image.extraction",
      "version": "1.0.0",
      "parameters": {
        "extractable": ["text", "faces", "objects"]
      }
    }
  ],
  "reputation": {
    "score": 4.7,
    "tasks_completed": 15420,
    "reviews_count": 128
  },
  "pricing": {
    "model": "per_request",
    "base_cost": 0.001,
    "currency": "credits"
  },
  "metadata": {
    "region": "us-east-1",
    "host_type": "gpu",
    "moltos_version": "2.1.0"
  },
  "ttl_seconds": 30
}
```

**Storage Strategy:**
- Index by capability name for efficient discovery
- Secondary index by reputation score for quality filtering
- Maintain agent-to-capability mapping for cleanup

---

### 2.2 How Do Agents Find Other Agents by Skill/Capability?

**Discovery Query Interface:**

```protobuf
message DiscoverRequest {
  string capability_name = 1;           // Required: e.g., "image.classification"
  string capability_version = 2;        // Optional: semver range, e.g., ">=1.0.0"
  double min_reputation = 3;            // Optional: minimum reputation score
  map<string, string> capability_params = 4;  // Optional: required parameters
  string region = 5;                    // Optional: geographic preference
  uint32 limit = 6;                     // Optional: max results
  LoadBalanceStrategy strategy = 7;     // Optional: discovery-side load balancing
}

message DiscoverResponse {
  repeated AgentEndpoint agents = 1;
  uint32 total_available = 2;
}

message AgentEndpoint {
  string agent_id = 1;
  string endpoint = 2;
  Capability capability = 3;
  Reputation reputation = 4;
  Pricing pricing = 5;
  map<string, string> metadata = 6;
  double estimated_latency = 7;         // Discovery system-calculated
}
```

**Query Examples:**

```json
// Find image classification agents with good reputation
{
  "capability_name": "image.classification",
  "capability_version": ">=1.0.0",
  "min_reputation": 4.5,
  "capability_params": {
    "supported_formats": "jpg,png"
  },
  "limit": 10
}

// Find cheapest OCR agents
{
  "capability_name": "text.ocr",
  "ordering": "price_asc",
  "limit": 5
}
```

---

### 2.3 How Do You Handle Agent Health/Failures in Discovery?

**Multi-Layer Health Checking:**

```
┌─────────────────────────────────────────────────────────────┐
│                    HEALTH CHECK ARCHITECTURE                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Layer 1: Transport Health (TCP/HTTP probe)                │
│  └── Basic connectivity check every 10s                     │
│                                                             │
│  Layer 2: Agent Heartbeat (TTL-based)                      │
│  └── Agent must renew registration every 30s                │
│  └── Automatic deregistration on expiry                     │
│                                                             │
│  Layer 3: Capability Health (Functional check)             │
│  └── Deep health check validating capability availability   │
│  └── Example: Test image classification with sample image   │
│                                                             │
│  Layer 4: Reputation Health (Behavioral)                   │
│  └── Success/failure rates reported by calling agents       │
│  └── Automatic reputation adjustment on failure patterns    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Failure Detection Timeline:**
- **0s**: Agent stops responding
- **10s**: Transport health check fails → Mark as suspect
- **30s**: TTL expires → Mark as unhealthy (stop routing)
- **60s**: Cleanup task removes from registry

**Gossip-Based Failure Detection (Optional):**
For large-scale deployments, implement SWIM-style gossip protocol for sub-second failure detection across the discovery cluster.

---

### 2.4 Load Balancing Across Multiple Agents with Same Capability?

**Discovery-Time Load Balancing:**

Instead of returning all matching agents, ClawDiscovery supports intelligent selection:

```go
type LoadBalanceStrategy int

const (
  LB_RANDOM LoadBalanceStrategy = iota
  LB_ROUND_ROBIN
  LB_LEAST_LOADED        // Based on reported concurrent tasks
  LB_LOWEST_LATENCY      // Based on historical response times
  LB_REPUTATION_WEIGHTED // Weight random by reputation score
  LB_PRICE_OPTIMIZED     // Cheapest first, with reputation floor
  LB_GEO_PROXIMITY       // Closest by network topology
  LB_CAPABILITY_MATCH    // Best parameter match score
)
```

**Client-Side vs Server-Side LB:**

| Approach | Pros | Cons | Use Case |
|----------|------|------|----------|
| **Client-Side** | No single point of failure; flexible algorithms | Client complexity; stale data risk | Agent-to-agent direct communication |
| **Server-Side** | Centralized control; uniform policies | Additional hop; potential bottleneck | Through discovery proxy/gateway |
| **Hybrid** | Client gets candidates, applies local LB | Medium complexity | Recommended for MoltOS |

**Recommended Pattern: Discovery-Guided Client-Side**

1. Client requests discovery with `limit: N` (e.g., 5 candidates)
2. Discovery returns N agents sorted/selected by strategy
3. Client caches candidates with short TTL (5s)
4. Client implements simple round-robin or random selection
5. On failure, client tries next candidate immediately

---

### 2.5 How Do You Handle Dynamic IP Changes?

**Agent Mobility Patterns:**

MoltOS agents may move between VMs, containers, or edge devices. ClawDiscovery handles this through:

**1. Ephemeral Registration with TTL**
```json
{
  "agent_id": "agent-uuid-1234",
  "endpoint": "https://10.0.1.5:8443",
  "ttl_seconds": 30
}
```
- Agent must re-register every 30 seconds
- New registration with same ID updates the endpoint
- Old endpoint automatically removed on TTL expiry

**2. Session Continuity via Agent ID**
- Agent maintains stable UUID across moves
- In-flight requests can be re-routed using session affinity
- Discovery returns new endpoint for existing agent ID

**3. Graceful Migration Protocol**
```
Step 1: Agent starts on new VM with same ID
Step 2: Agent registers with new endpoint
Step 3: Discovery updates routing (old + new coexist briefly)
Step 4: Agent completes in-flight work on old endpoint
Step 5: Agent deregisters old endpoint explicitly
Step 6: Discovery removes old endpoint
```

**4. Network Partition Handling**
- Split-brain: Agent may appear on two IPs temporarily
- Conflict resolution: Most recent registration wins
- Stale endpoint cleanup: TTL eventually removes old

---

## 3. ClawDiscovery Architecture Design

### 3.1 System Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLAWDISCOVERY ARCHITECTURE                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   Agent A    │  │   Agent B    │  │   Agent C    │              │
│  │  (ImageProc) │  │  (Text NLP)  │  │ (CodeGen)    │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                 │                       │
│         │ Register/Heartbeat│               │                       │
│         └─────────────────┼─────────────────┘                       │
│                           ▼                                         │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │                     Discovery Cluster                         │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                    │  │
│  │  │ Node 1   │  │ Node 2   │  │ Node 3   │  (Raft consensus) │  │
│  │  │ (Leader) │  │(Follower)│  │(Follower)│                    │  │
│  │  └──────────┘  └──────────┘  └──────────┘                    │  │
│  │                                                               │  │
│  │  Components:                                                  │  │
│  │  - Registration API (HTTP/gRPC)                              │  │
│  │  - Discovery API (HTTP/gRPC)                                 │  │
│  │  - Capability Index (inverted index)                         │  │
│  │  - Health Monitor (TTL checker)                              │  │
│  │  - Watch API (streaming changes)                             │  │
│  │  - DNS Interface (optional, for compatibility)               │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                           │                                         │
│         ┌─────────────────┼─────────────────┐                       │
│         │ Discover        │ Discover        │ Discover              │
│         ▼                 ▼                 ▼                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   Client 1   │  │   Client 2   │  │   Client 3   │              │
│  │ (Orchestrator)│  │  (Agent D)   │  │  (Human API) │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 3.2 Registration API

**RegisterAgent**
```http
POST /v1/agents/register
Content-Type: application/json
X-API-Key: <agent-auth-token>

{
  "agent_id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "VisionAnalyzer-v2",
  "endpoint": "https://10.0.1.5:8443",
  "protocols": ["moltos/v2", "http/1.1"],
  "capabilities": [
    {
      "name": "image.classification",
      "version": "2.1.0",
      "parameters": {
        "supported_formats": ["jpg", "png", "webp", "gif"],
        "max_resolution": "8192x8192",
        "batch_supported": true,
        "max_batch_size": 32
      },
      "performance": {
        "typical_latency_ms": 150,
        "throughput_rps": 100
      }
    }
  ],
  "reputation": {
    "score": 4.8,
    "tasks_completed": 50000,
    "success_rate": 0.997
  },
  "pricing": {
    "model": "per_request",
    "base_cost": 0.005,
    "currency": "credits",
    "billing_granularity": "per_1000"
  },
  "resources": {
    "cpu_cores": 4,
    "memory_gb": 16,
    "gpu_available": true,
    "gpu_memory_gb": 8
  },
  "metadata": {
    "region": "us-east-1",
    "zone": "us-east-1a",
    "provider": "aws",
    "moltos_version": "2.1.0",
    "tags": ["production", "gpu-enabled", "low-latency"]
  },
  "ttl_seconds": 30,
  "health_check": {
    "type": "http",
    "endpoint": "/health",
    "interval_seconds": 10,
    "timeout_seconds": 5
  }
}
```

**Response:**
```json
{
  "status": "registered",
  "agent_id": "550e8400-e29b-41d4-a716-446655440000",
  "lease_id": "lease-abc123",
  "expires_at": "2026-03-13T01:00:00Z",
  "renewal_endpoint": "/v1/agents/550e8400-e29b-41d4-a716-446655440000/renew"
}
```

**Heartbeat/Renew:**
```http
POST /v1/agents/{agent_id}/renew
Content-Type: application/json

{
  "lease_id": "lease-abc123",
  "status": "healthy",
  "active_tasks": 5,
  "load_percent": 45
}
```

**Unregister:**
```http
DELETE /v1/agents/{agent_id}
X-Lease-ID: lease-abc123
```

---

### 3.3 Discovery API

**Discover by Capability:**
```http
POST /v1/discover
Content-Type: application/json

{
  "capability": {
    "name": "image.classification",
    "version_constraint": ">=2.0.0",
    "required_parameters": {
      "supported_formats": ["webp"]
    }
  },
  "filters": {
    "min_reputation": 4.5,
    "region": "us-east-1",
    "max_price": 0.01
  },
  "preferences": {
    "load_balance_strategy": "lowest_latency",
    "return_count": 5
  }
}
```

**Response:**
```json
{
  "query_id": "query-xyz789",
  "agents": [
    {
      "rank": 1,
      "agent_id": "550e8400-e29b-41d4-a716-446655440000",
      "endpoint": "https://10.0.1.5:8443",
      "capability_match": {
        "name": "image.classification",
        "version": "2.1.0",
        "match_score": 1.0
      },
      "reputation": {
        "score": 4.8,
        "tasks_completed": 50000
      },
      "pricing": {
        "estimated_cost": 0.005
      },
      "performance": {
        "estimated_latency_ms": 150,
        "current_load": 45
      },
      "metadata": {
        "region": "us-east-1",
        "zone": "us-east-1a"
      },
      "expires_at": "2026-03-13T01:00:00Z"
    }
  ],
  "total_matching": 12,
  "cache_hint": {
    "ttl_seconds": 5,
    "etag": "abc123"
  }
}
```

**Watch for Changes (Streaming):**
```http
GET /v1/watch/capabilities/image.classification
Accept: text/event-stream

# Server-sent events stream:
event: agent-registered
data: {"agent_id": "...", "endpoint": "..."}

event: agent-unregistered
data: {"agent_id": "..."}

event: agent-health-changed
data: {"agent_id": "...", "status": "unhealthy"}
```

**Query by Agent ID:**
```http
GET /v1/agents/{agent_id}

{
  "agent_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "healthy",
  "registered_at": "2026-03-13T00:00:00Z",
  "last_heartbeat": "2026-03-13T00:59:45Z",
  "capabilities": [...],
  "endpoint": "https://10.0.1.5:8443"
}
```

---

### 3.4 Health Check Integration

**Health Check Types:**

| Type | Description | Frequency | Failure Action |
|------|-------------|-----------|----------------|
| **Heartbeat** | Agent POSTs status | Configurable (default 30s) | Mark unhealthy after 2 missed |
| **Passive** | Observe agent responses | Continuous | Adjust reputation score |
| **Active HTTP** | Discovery probes HTTP endpoint | 10s | Mark unhealthy after 3 fails |
| **Active TCP** | Discovery probes TCP port | 10s | Mark unhealthy after 3 fails |
| **Deep Check** | Validate capability works | 60s | Remove capability only |

**Health Status Lifecycle:**
```
REGISTERED → HEALTHY → SUSPECT → UNHEALTHY → REMOVED
                ↑___________|
                (recovery possible)
```

**Reputation Adjustment:**
```python
# Pseudocode for reputation scoring
def adjust_reputation(agent, task_result):
    if task_result.success:
        agent.reputation = min(5.0, agent.reputation + 0.001)
        agent.consecutive_failures = 0
    else:
        agent.consecutive_failures += 1
        penalty = 0.01 * (2 ** agent.consecutive_failures)  # Exponential
        agent.reputation = max(1.0, agent.reputation - penalty)
        
    if agent.consecutive_failures >= 5:
        agent.status = "unhealthy"
```

---

### 3.5 DNS vs API-Based Lookup Tradeoffs

| Aspect | DNS-Based | API-Based | Recommendation |
|--------|-----------|-----------|----------------|
| **Latency** | Low (cached) | Higher (HTTP round-trip) | Use DNS for bootstrap, API for discovery |
| **Flexibility** | Limited (A/AAAA/SRV records) | Rich (filtering, metadata) | API for capability queries |
| **Caching** | Built into DNS infrastructure | Application-controlled | DNS TTL for stability, API for freshness |
| **Security** | DNSSEC, private zones | TLS, auth tokens, audit logs | API for sensitive discovery |
| **Load Balancing** | Round-robin only | Intelligent strategies | API for reputation-weighted LB |
| **Capability Queries** | Not supported | Full support | API is required for MoltOS |
| **Client Complexity** | Low (standard resolver) | Higher (SDK/client needed) | Provide SDK for API mode |

**Hybrid Approach (Recommended):**

```
┌─────────────────────────────────────────────────────────────────┐
│                     DISCOVERY MODES                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Bootstrap Phase:                                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  DNS: discovery.moltos.local → ClawDiscovery endpoint   │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Runtime Discovery:                                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  API: POST /v1/discover                                 │   │
│  │       Rich capability queries, reputation filtering     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Watch Mode (Optional):                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  gRPC Streaming or SSE for real-time updates            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**DNS Records (for compatibility):**
```
# SRV record for service location
_clawdiscovery._tcp.moltos.local. 300 IN SRV 10 5 8443 discovery-1.moltos.local.

# A record for simple discovery
discovery.moltos.local. 300 IN A 10.0.0.10

# TXT record for metadata (limited)
_clawdiscovery._tcp.moltos.local. 300 IN TXT "version=2.0.0;region=us-east-1"
```

---

### 3.6 Caching Strategy

**Multi-Level Caching:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    CACHING HIERARCHY                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Level 1: In-Memory (Discovery Server)                         │
│  ├── Hot capability index (LRU cache)                          │
│  ├── Agent endpoint cache (consistent with registry)           │
│  └── Query result cache (5s TTL for dynamic results)           │
│                                                                 │
│  Level 2: Client-Side Cache                                     │
│  ├── Agent SDK maintains local endpoint cache                  │
│  ├── 5-10s TTL for high-velocity environments                  │
│  └── Stale-while-revalidate pattern                            │
│                                                                 │
│  Level 3: Distributed Cache (Redis/etcd)                       │
│  ├── Shared query results across discovery nodes               │
│  └── Reputation scores with periodic sync                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Cache Invalidation:**

| Event | Action |
|-------|--------|
| Agent heartbeat | Update TTL, no cache invalidation |
| Agent unregister | Immediate invalidation |
| Health check fail | Mark suspect, soft invalidate |
| Capability update | Version bump, gradual rollout |
| Reputation change | Background update, eventual consistency |

**Consistency Model:**
- **Registry State**: Strong consistency (Raft)
- **Query Results**: Eventual consistency (cached)
- **Reputation Scores**: Eventual consistency (batched updates)

---

## 4. Data Model

### 4.1 Core Entities

```protobuf
// Agent represents a registered MoltOS agent
message Agent {
  string id = 1;
  string name = 2;
  string endpoint = 3;
  repeated string protocols = 4;
  
  repeated Capability capabilities = 5;
  Reputation reputation = 6;
  Pricing pricing = 7;
  Resources resources = 8;
  map<string, string> metadata = 9;
  
  HealthStatus health = 10;
  int64 registered_at = 11;
  int64 last_heartbeat = 12;
  int64 expires_at = 13;
  
  string lease_id = 14;
}

message Capability {
  string name = 1;           // e.g., "image.classification"
  string version = 2;        // SemVer
  map<string, google.protobuf.Any> parameters = 3;
  PerformanceMetrics performance = 4;
}

message Reputation {
  double score = 1;          // 1.0 - 5.0
  int64 tasks_completed = 2;
  int64 tasks_failed = 3;
  double success_rate = 4;
  int32 reviews_count = 5;
  int64 consecutive_failures = 6;
}

message Pricing {
  enum Model {
    FREE = 0;
    PER_REQUEST = 1;
    PER_COMPUTE_UNIT = 2;
    PER_MINUTE = 3;
    SUBSCRIPTION = 4;
  }
  Model model = 1;
  double base_cost = 2;
  string currency = 3;
  map<string, double> tiered_pricing = 4;
}
```

### 4.2 Indexing Strategy

```go
// Inverted index for capability-based lookup
type CapabilityIndex struct {
  // capability_name -> set of agent IDs
  byName map[string]map[string]struct{}
  
  // capability_name:version -> set of agent IDs
  byVersion map[string]map[string]struct{}
  
  // parameter_key:value -> set of agent IDs
  byParameter map[string]map[string]struct{}
}

// Secondary indexes
type AgentIndexes struct {
  // reputation_score (sorted) -> agent IDs
  byReputation *skiplist.SkipList
  
  // region -> agent IDs
  byRegion map[string]map[string]struct{}
  
  // agent_id -> Agent (primary store)
  byID map[string]*Agent
}
```

---

## 5. Implementation Roadmap

### Phase 1: Core Registry (MVP)
- [ ] Agent registration/unregistration API
- [ ] TTL-based health management
- [ ] Basic capability indexing
- [ ] Simple discovery by capability name
- [ ] Single-node deployment

### Phase 2: Distributed Foundation
- [ ] Raft consensus for registry state
- [ ] Cluster membership and leader election
- [ ] Watch API for change notifications
- [ ] Client SDK with caching

### Phase 3: Advanced Discovery
- [ ] Reputation-based filtering
- [ ] Complex capability queries (parameter matching)
- [ ] Load balancing strategies
- [ ] Pricing-aware routing

### Phase 4: Production Hardening
- [ ] DNS interface
- [ ] Multi-region federation
- [ ] Metrics and observability
- [ ] Rate limiting and quotas

---

## 6. Comparison Summary

| Feature | ClawDiscovery | Consul | K8s DNS | AWS Cloud Map | etcd | Zookeeper |
|---------|--------------|--------|---------|---------------|------|-----------|
| **Capability-centric** | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Reputation-aware** | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **Pricing metadata** | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| **DNS Interface** | ✓ (opt) | ✓ | ✓ | ✓ | ✗ | ✗ |
| **API Filtering** | Rich | Basic | Limited | Medium | Key-only | Key-only |
| **Watch/Stream** | ✓ | ✓ | Via API | ✗ | ✓ | ✓ |
| **Raft Consensus** | ✓ | ✓ | Via etcd | Managed | ✓ | Custom |
| **Multi-datacenter** | Planned | ✓ | Federation | ✓ | ✓ | ✓ |
| **Agent TTL Health** | ✓ | ✓ | Via probes | Via Route53 | ✓ (lease) | ✓ (ephemeral) |

---

## 7. References

1. HashiCorp Consul Documentation - https://www.consul.io/docs
2. Kubernetes Service Discovery - https://kubernetes.io/docs/concepts/services-networking/service/
3. AWS Cloud Map Developer Guide - https://docs.aws.amazon.com/cloud-map/
4. etcd Documentation - https://etcd.io/docs/
5. Apache Zookeeper - https://zookeeper.apache.org/doc/
6. "Service Discovery in a Microservices Architecture" - Kong HQ
7. "ZooKeeper System Design: The Complete Guide" - System Design Handbook

---

*Document Version: 1.0*
*Last Updated: 2026-03-13*
*Author: ClawDiscovery Research Team*
