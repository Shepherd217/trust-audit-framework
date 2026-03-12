# ClawResilience: Self-Healing Agent Swarm Architecture

## Executive Summary

ClawResilience is a resilience engine designed for MoltOS agent swarms, synthesizing proven patterns from Kubernetes, AWS Auto Scaling Groups, Netflix Chaos Monkey, and Erlang/OTP supervisor trees. This document provides a comprehensive design for detecting, isolating, and recovering from agent failures while preventing cascading failures across the swarm.

---

## Part 1: Research Synthesis - Production System Patterns

### 1.1 Kubernetes Pod Lifecycle Patterns

**Three-Probe Health Model:**
- **Liveness Probe**: "Is the process running?" - detects deadlocks, infinite loops, memory leaks. Fail = restart container.
- **Readiness Probe**: "Is the service ready for traffic?" - checks dependencies. Fail = remove from load balancer, no restart.
- **Startup Probe**: "Has initialization completed?" - for slow-starting services. Disables other probes until success.

**Key Parameters:**
```yaml
initialDelaySeconds: 3-30      # Grace period before first check
periodSeconds: 5-30            # Check frequency
timeoutSeconds: 1-5            # Max time for response
failureThreshold: 3            # Consecutive failures before action
successThreshold: 1            # Consecutive successes to recover
```

**Restart Policies:**
- `Always`: Always restart (default for deployments)
- `OnFailure`: Restart only on non-zero exit codes
- `Never`: Never restart

**CrashLoopBackOff:** Exponential backoff on repeated failures (10s, 20s, 40s, 80s...) with 5-minute cap. Reset after 10 minutes of success.

### 1.2 AWS Auto Scaling Group Patterns

**Two-Tier Health Checks:**
- **EC2 Health Check**: Infrastructure layer - monitors VM state, network, hypervisor
- **ELB/ALB Health Check**: Application layer - HTTP/TCP endpoint checks

**Health Check Configuration:**
```
HealthCheckType: EC2 | ELB
HealthCheckGracePeriod: 300 seconds  # Grace period after launch
HealthCheckInterval: 30 seconds
HealthyThreshold: 2
UnhealthyThreshold: 2
```

**Replacement Strategy:**
1. Mark unhealthy instance
2. Launch replacement (provisioning new instance)
3. Wait for new instance to pass health checks
4. Terminate unhealthy instance (gradual - max 10% at a time)

**Auto Recovery:** CloudWatch alarms trigger automatic recovery on system status check failures (moves to new hardware with same ID and volumes).

### 1.3 Netflix Chaos Engineering Patterns

**Chaos Monkey Principles:**
- "The best way to avoid failure is to fail constantly"
- Run during business hours when engineers can respond
- Random instance termination to validate auto-recovery

**Chaos Engineering Method:**
1. Define steady-state behavior (measurable output like throughput, latency)
2. Build control vs experimental systems
3. Inject real-world failures (crashes, latency, errors)
4. Compare steady-state deviation - less deviation = more confidence
5. Automate fixes for discovered weaknesses

**Controlled Chaos:**
- Opt-in/opt-out capabilities per service
- Configurable blast radius
- Scheduled terminations, not random chaos
- Integration with continuous delivery platform

### 1.4 Erlang/OTP Supervisor Trees

**"Let It Crash" Philosophy:**
- Don't write defensive code for every possible error
- Isolate failures to individual lightweight processes
- Supervisors handle restart, not the failing process
- Focus on recovery, not prevention

**Supervision Tree Structure:**
```
Root Supervisor
├── Supervisor A
│   ├── Worker 1
│   └── Worker 2
└── Supervisor B
    ├── Worker 3
    └── Supervisor C
        ├── Worker 4
        └── Worker 5
```

**Restart Strategies:**
- `one_for_one`: Restart only failed child (default)
- `one_for_all`: Restart all children if one fails
- `rest_for_one`: Restart failed child and all children started after it

**Intensity Limits:**
- Max restarts within time window (e.g., 5 restarts in 10 seconds)
- If exceeded, supervisor terminates itself (escalates to parent)
- Prevents infinite restart loops

**Worker Specifications:**
```erlang
{ChildId, StartFunc, RestartType, ShutdownTime, WorkerType, Modules}
```

---

## Part 2: Key Questions Answered

### 2.1 What Health Checks Detect "Dead" Agents?

**Multi-Layer Health Detection:**

| Check Type | What It Detects | Response |
|------------|-----------------|----------|
| **Process Heartbeat** | Process crash, OS-level death | Immediate restart |
| **Activity Heartbeat** | Agent stuck, infinite loop, deadlock | Restart after threshold |
| **Task Completion** | Hung task, never completing work | Kill + restart |
| **Log Activity** | Silent failure, no output | Alert, then restart |
| **Dependency Check** | External service unavailability | Mark not-ready, don't restart |
| **Resource Usage** | Memory leak, CPU exhaustion | Restart if critical |

**Heartbeat Patterns:**
- **Active Heartbeat**: Agent sends periodic "I'm alive" signals
- **Passive Heartbeat**: Supervisor polls agent status endpoint
- **Task-Based Heartbeat**: Progress updates during long operations
- **Zero-Heartbeat**: Inference from log activity, network traffic

### 2.2 How to Distinguish "Stuck" vs "Working Slowly"?

**Progress-Based Detection:**
```python
class ProgressDetector:
    def __init__(self):
        self.progress_threshold = 0.01  # 1% progress required
        self.check_interval = 60        # Check every 60 seconds
        self.stuck_threshold = 3        # 3 checks without progress = stuck
    
    def check_progress(self, agent):
        current_progress = agent.get_progress()
        time_delta = now() - agent.last_check
        
        if current_progress > agent.last_progress + self.progress_threshold:
            return "working"  # Making progress
        elif time_delta > self.check_interval * self.stuck_threshold:
            return "stuck"    # No progress for too long
        else:
            return "slow"     # Might just be slow
```

**Context-Aware Timeout:**
- Use deadline propagation - "you have X seconds total, Y remaining"
- Baseline historical performance per task type
- Allow tasks to declare expected duration
- Heartbeat with progress percentage for long tasks

**Signal Types:**
- **Working**: Regular heartbeats + progress updates
- **Slow**: Heartbeats but no progress (watch closely)
- **Stuck**: No heartbeats or progress beyond threshold (restart)

### 2.3 Auto-Restart vs Alert-Human Tradeoffs

**Decision Matrix:**

| Scenario | Action | Reasoning |
|----------|--------|-----------|
| First failure on new code | Alert human | Likely code bug, restart won't help |
| Known intermittent issue | Auto-restart | Flaky dependency, will recover |
| Resource exhaustion | Alert human | May need capacity increase |
| Crash loop (>3 in 10min) | Alert human | Code or config problem |
| Single failure on stable code | Auto-restart | Random glitch, will recover |
| Data corruption detected | Alert human + quarantine | Prevent data loss |

**Escalation Policy:**
1. Auto-restart with exponential backoff (up to 5 min)
2. If restart fails 3 times, escalate to human
3. If failure rate >10% of swarm, page on-call
4. If cascading failures detected, emergency circuit break

### 2.4 Circuit Breakers for Failing Agents

**Three-State Circuit Breaker:**

```
┌─────────────────────────────────────────────────────────────┐
│  CLOSED (Normal)                                            │
│  ┌──────────┐                                               │
│  │ Requests │───► Service                                   │
│  └──────────┘   Count failures                              │
│       ▲                                                     │
│       │ Failure rate > threshold                            │
│       │ (e.g., 50% in 30s or 5 consecutive)                 │
│       │                                                     │
│  OPEN │ (Failing)                                           │
│  ┌────┴────┐                                                │
│  │ Fail    │───► Immediate fallback                         │
│  │ Fast    │    No calls to service                         │
│  └────┬────┘    Wait timeout (e.g., 60s)                    │
│       │                                                     │
│       │ Timeout expires                                     │
│       ▼                                                     │
│  HALF-OPEN (Testing)                                        │
│  ┌──────────┐                                               │
│  │ Limited  │───► Test requests only                        │
│  │ Requests │    If succeed → CLOSE                         │
│  └──────────┘    If fail → OPEN (reset timer)               │
└─────────────────────────────────────────────────────────────┘
```

**Circuit Breaker Parameters:**
- `failureThreshold`: 5 failures or 50% failure rate
- `timeoutDuration`: 30-120 seconds (open state duration)
- `halfOpenRequests`: 1-3 test requests allowed
- `successThreshold`: 2 consecutive successes to close

### 2.5 What State Needs Preservation?

**Critical State Categories:**

| State Type | Preservation Strategy | Rationale |
|------------|----------------------|-----------|
| **In-progress tasks** | Checkpoint to disk every N seconds | Resume without losing work |
| **Agent configuration** | Versioned config store | Consistent restart behavior |
| **Session state** | Distributed cache (Redis) | Maintain user context |
| **Partial results** | Incremental writes to persistent store | Avoid recomputation |
| **Message queue position** | Offset tracking | Prevent message loss |
| **Model weights (AI agents)** | Regular snapshots to object storage | Avoid retraining |
| **Audit logs** | Immediate write to append-only log | Compliance, debugging |

**Checkpoint Strategy:**
```
Checkpoint Interval: 30 seconds or 10% progress
Storage: Local temp → Async replicate to distributed store
Format: Differential (only changed state)
Retention: Last 3 checkpoints per agent
```

### 2.6 Handling Cascading Failures

**Cascading Failure Prevention:**

1. **Bulkhead Pattern**: Isolate resource pools per agent type
   - Separate thread pools, connection pools
   - Prevents one failing agent from exhausting all resources

2. **Rate Limiting**: Cap requests per agent and globally
   - Prevents retry storms from overwhelming healthy agents

3. **Timeout Management**: Aggressive timeouts at each layer
   - Don't wait indefinitely for failing dependencies

4. **Graceful Degradation**: Fallback to reduced functionality
   - Cache stale data vs. fresh data
   - Simplified algorithms vs. full processing

5. **Failure Domain Isolation**: Contain failures to small blast radius
   - AZ-level isolation
   - Circuit breakers per dependency

**Cascading Detection:**
```python
def detect_cascading_failure(swarm):
    failure_rate = failed_agents / total_agents
    failure_velocity = rate_of_change(failure_rate)
    
    if failure_rate > 0.1 and failure_velocity > 0.05:
        return "CASCADING_FAILURE"
    elif failure_rate > 0.3:
        return "MASS_OUTAGE"
    return "NORMAL"
```

---

## Part 3: ClawResilience Design for MoltOS

### 3.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    ClawResilience Controller                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ Health Monitor│  │ Supervisor   │  │ Circuit Breaker    │   │
│  │ Service       │  │ Manager      │  │ Registry           │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘   │
│         │                  │                     │               │
│         ▼                  ▼                     ▼               │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Resilience Decision Engine                  │    │
│  └──────────────────────────┬──────────────────────────────┘    │
│                             │                                    │
│         ┌───────────────────┼───────────────────┐               │
│         ▼                   ▼                   ▼               │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │ Checkpoint  │    │ Notification│    │ Chaos       │          │
│  │ Manager     │    │ Dispatcher  │    │ Controller  │          │
│  └─────────────┘    └─────────────┘    └─────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Agent Pod 1   │  │   Agent Pod 2   │  │   Agent Pod N   │
│ ┌─────────────┐ │  │ ┌─────────────┐ │  │ ┌─────────────┐ │
│ │   Agent     │ │  │ │   Agent     │ │  │ │   Agent     │ │
│ │  Process    │ │  │ │  Process    │ │  │ │  Process    │ │
│ └──────┬──────┘ │  │ └──────┬──────┘ │  │ └──────┬──────┘ │
│        │        │  │        │        │  │        │        │
│ ┌──────▼──────┐ │  │ ┌──────▼──────┐ │  │ ┌──────▼──────┐ │
│ │ Health Side │ │  │ │ Health Side │ │  │ │ Health Side │ │
│ │   car       │ │  │ │   car       │ │  │ │   car       │ │
│ └─────────────┘ │  │ └─────────────┘ │  │ └─────────────┘ │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

### 3.2 Health Check Definitions

**Agent Health Protocol:**

```protobuf
message HealthCheck {
  string agent_id = 1;
  int64 timestamp_ms = 2;
  HealthStatus status = 3;
  float progress_percent = 4;
  string current_task = 5;
  map<string, Metric> metrics = 6;
  string message = 7;
}

enum HealthStatus {
  HEALTHY = 0;
  STARTING = 1;
  BUSY = 2;          // Working but responsive
  DEGRADED = 3;      // Working but with issues
  STUCK = 4;         // Not making progress
  UNHEALTHY = 5;     // Failing health checks
  SHUTDOWN = 6;
}
```

**Heartbeat Configuration:**

| Agent Type | Heartbeat Interval | Timeout | Startup Grace |
|------------|-------------------|---------|---------------|
| Short-lived (<1min) | 5s | 15s | 10s |
| Standard (1-10min) | 10s | 30s | 30s |
| Long-running (>10min) | 30s | 90s | 60s |
| AI/ML inference | 15s | 45s | 60s |

**Health Check Types:**

```yaml
health_checks:
  liveness:
    type: heartbeat
    interval: 10s
    timeout: 30s
    failure_threshold: 3
    
  readiness:
    type: dependency_check
    dependencies:
      - database
      - message_queue
      - config_service
    interval: 5s
    timeout: 5s
    
  startup:
    type: probe
    command: /health/startup
    interval: 5s
    timeout: 10s
    initial_delay: 0s
    
  progress:
    type: task_progress
    min_progress_rate: 0.01  # 1% per minute
    check_interval: 60s
```

### 3.3 Restart Policies

**Policy Definitions:**

```yaml
restart_policies:
  # Always restart, regardless of exit code
  always:
    max_restarts: unlimited
    backoff: exponential
    initial_delay: 5s
    max_delay: 300s
    
  # Restart only on failure
  on_failure:
    max_restarts: 5
    backoff: exponential
    initial_delay: 1s
    max_delay: 60s
    reset_after: 600s  # Reset counter after 10 min of success
    
  # Never restart, just alert
  never:
    action: alert_only
    
  # Restart with circuit breaker
  circuit_breaker:
    failure_threshold: 5
    timeout: 120s
    half_open_max_calls: 3
```

**Restart Intensity Control (Erlang-style):**

```yaml
supervisor_policy:
  max_restarts: 5        # Max restarts within window
  restart_window: 60s    # Time window for counting
  strategy: one_for_one  # one_for_one | one_for_all | rest_for_one
  
  # If max_restarts exceeded:
  escalation_action: escalate_to_parent  # or notify_human
```

### 3.4 Circuit Breaker Implementation

**Circuit Breaker Registry:**

```go
type CircuitBreaker struct {
    name            string
    state           State  // CLOSED, OPEN, HALF_OPEN
    failureCount    int
    successCount    int
    lastFailureTime time.Time
    
    // Config
    failureThreshold   int           // 5 failures
    timeoutDuration    time.Duration // 60s
    halfOpenMaxCalls   int           // 3
    successThreshold   int           // 2
}

func (cb *CircuitBreaker) Call(fn func() error) error {
    switch cb.state {
    case OPEN:
        if time.Since(cb.lastFailureTime) > cb.timeoutDuration {
            cb.state = HALF_OPEN
            cb.successCount = 0
        } else {
            return ErrCircuitOpen
        }
        
    case HALF_OPEN:
        if cb.successCount >= cb.halfOpenMaxCalls {
            cb.state = CLOSED
            cb.failureCount = 0
        }
    }
    
    err := fn()
    cb.recordResult(err)
    return err
}
```

**Agent-Level Circuit Breakers:**

| Breaker | Monitors | Threshold | Timeout |
|---------|----------|-----------|---------|
| Task Execution | Task failures | 50% in 5 min | 2 min |
| External API | API call failures | 5 consecutive | 1 min |
| Memory Usage | Memory consumption | >90% for 30s | 5 min |
| CPU Throttling | CPU throttling events | >50% for 2 min | 3 min |

### 3.5 State Preservation (Checkpoint/Restore)

**Checkpoint Manager:**

```yaml
checkpoint_config:
  # When to checkpoint
  triggers:
    interval: 30s
    progress_interval: 10  # Every 10% progress
    on_signal: SIGUSR1
    pre_restart: true
    
  # What to checkpoint
  state_to_preserve:
    - task_state
    - partial_results
    - session_context
    - model_weights
    - message_offsets
    
  # Storage
  storage:
    type: distributed
    backend: redis_cluster
    compression: zstd
    encryption: aes256
    
  # Retention
  retention:
    max_checkpoints_per_agent: 3
    ttl: 24h
```

**Restore Process:**

```python
async def restore_agent(agent_id, checkpoint_id=None):
    # 1. Load latest checkpoint if not specified
    checkpoint = await checkpoint_store.load(agent_id, checkpoint_id)
    
    # 2. Validate checkpoint integrity
    if not validate_checksum(checkpoint):
        raise CheckpointCorruptedError()
    
    # 3. Start new agent process
    agent = await spawn_agent(agent_id, config=checkpoint.config)
    
    # 4. Restore state
    await agent.restore_state(checkpoint.state)
    
    # 5. Resume from last known position
    await agent.resume_task(checkpoint.task_id, checkpoint.progress)
    
    return agent
```

### 3.6 Notification System

**Notification Tiers:**

```yaml
notification_tiers:
  info:
    events:
      - agent_restarted
      - circuit_breaker_state_change
    channels:
      - log
      - metrics
      
  warning:
    events:
      - agent_stuck_detected
      - restart_loop_detected
      - circuit_breaker_opened
    channels:
      - log
      - metrics
      - dashboard
      - slack
      
  critical:
    events:
      - cascading_failure_detected
      - mass_agent_failure
      - checkpoint_restore_failed
      - data_corruption_detected
    channels:
      - log
      - metrics
      - pagerduty
      - slack
      - email
      - dashboard
    escalation:
      - notify: oncall_engineer
      - if_unacknowledged: 15m
      - escalate: engineering_manager
```

**Notification Content:**

```json
{
  "timestamp": "2026-03-13T08:30:00Z",
  "severity": "warning",
  "event": "restart_loop_detected",
  "agent_id": "agent-7f3a9c",
  "agent_type": "data_processor",
  "details": {
    "restart_count": 5,
    "time_window": "10m",
    "last_exit_code": 1,
    "last_error": "Connection timeout to database",
    "circuit_breaker_state": "open"
  },
  "context": {
    "task_id": "task-abc123",
    "progress": "45%",
    "checkpoint_available": true,
    "last_checkpoint": "2026-03-13T08:25:00Z"
  },
  "suggested_action": "Check database connectivity; agent will auto-retry in 5 minutes"
}
```

---

## Part 4: Implementation Guidelines

### 4.1 Deployment Model

**Sidecar Pattern:**
Each agent pod runs a health sidecar alongside the agent process:

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: agent-pod
  labels:
    app: moltos-agent
    agent-type: processor
spec:
  containers:
    - name: agent
      image: moltos/agent:processor-v1
      env:
        - name: CHECKPOINT_DIR
          value: /var/checkpoints
      volumeMounts:
        - name: checkpoints
          mountPath: /var/checkpoints
          
    - name: health-sidecar
      image: clawresilience/health-sidecar:latest
      env:
        - name: AGENT_PID_FILE
          value: /var/run/agent.pid
        - name: HEARTBEAT_INTERVAL
          value: "10s"
        - name: CONTROLLER_ENDPOINT
          value: "clawresilience-controller:8080"
      volumeMounts:
        - name: checkpoints
          mountPath: /var/checkpoints
          readOnly: true
```

### 4.2 Operational Runbooks

**Runbook: Agent Stuck Detection**

```
1. Alert fires: "agent-X stuck for 5 minutes"

2. Initial Assessment:
   - Check agent logs: kubectl logs agent-X -c agent --tail=100
   - Check resource usage: kubectl top pod agent-X
   - Check progress metrics in dashboard

3. Decision Tree:
   
   IF memory usage > 90%:
      → Likely memory leak
      → Action: Restart with memory profiling enabled
   
   IF CPU usage < 1% AND no log activity:
      → Likely deadlock
      → Action: Capture thread dump, then restart
   
   IF network connections in CLOSE_WAIT:
      → Likely connection leak
      → Action: Restart, check connection pool config
   
   IF progress > 0% but stalled:
      → Slow but working
      → Action: Extend timeout, monitor

4. Post-Restart:
   - Verify checkpoint restore success
   - Confirm progress resumes
   - Monitor for recurrence
```

**Runbook: Cascading Failure Response**

```
1. Alert fires: "Cascading failure detected - 15% agent failure rate"

2. Immediate Actions (auto-executed by system):
   - Circuit breakers open on all non-critical dependencies
   - Rate limiting activated
   - Scale-out paused
   - Page on-call engineer

3. Human Assessment:
   - Identify common failure pattern
   - Check for recent deployments
   - Check dependency health (DB, cache, APIs)
   - Review error logs for common errors

4. Containment:
   IF deployment-related:
      → Rollback to previous version
   
   IF dependency-related:
      → Failover to backup dependency if available
      → Enable degraded mode
   
   IF resource exhaustion:
      → Emergency scale-out
      → Shed non-critical load

5. Recovery:
   - Gradually re-enable agents
   - Monitor failure rate
   - Close circuit breakers when stable

6. Post-Incident:
   - Generate failure report
   - Update chaos experiments
   - Improve detection thresholds
```

### 4.3 Metrics and Observability

**Key Metrics:**

```prometheus
# Health metrics
clawresilience_agent_health_status{agent_id, agent_type}  # 0-6 enum
clawresilience_heartbeat_latency_seconds{agent_id}
clawresilience_restart_count{agent_id, reason}

# Circuit breaker metrics
clawresilience_circuit_breaker_state{breaker_name}  # 0=closed, 1=open, 2=half_open
clawresilience_circuit_breaker_tripped_total{breaker_name}
clawresilience_circuit_breaker_failure_rate{breaker_name}

# Checkpoint metrics
clawresilience_checkpoint_created_total{agent_id}
clawresilience_checkpoint_restore_duration_seconds{agent_id}
clawresilience_checkpoint_size_bytes{agent_id}

# System health
clawresilience_swarm_failure_rate
clawresilience_cascading_failure_detected_total
clawresilience_recovery_time_seconds
```

**Dashboards:**

1. **Swarm Health Overview**
   - Overall failure rate
   - Agents by health status
   - Active circuit breakers
   - Recent restarts

2. **Agent Detail View**
   - Individual agent health timeline
   - Heartbeat latency graph
   - Restart history
   - Checkpoint status

3. **Circuit Breaker Status**
   - All breakers and their states
   - Trip frequency
   - Recovery times

---

## Part 5: Chaos Engineering Integration

### 5.1 Chaos Controller

```yaml
chaos_experiments:
  agent_termination:
    schedule: "0 14 * * 1-5"  # 2 PM weekdays
    target_selection: random
    targets_per_run: 1
    max_affected_percent: 5
    excluded_agent_types:
      - critical_controller
    
  network_partition:
    duration: 30s
    target_percent: 10
    
  resource_exhaustion:
    type: memory_pressure
    target: random_agent
    intensity: 50%  # of limit
    
  latency_injection:
    target: database_calls
    latency: 100ms
    jitter: 50ms
```

### 5.2 Steady-State Hypotheses

```python
# Define expected behavior under chaos
steadystate_hypotheses = [
    {
        "name": "task_completion_rate",
        "metric": "tasks_completed_per_minute",
        "expected": "> 100",
        "tolerance": "20%"
    },
    {
        "name": "p99_response_time",
        "metric": "response_time_seconds",
        "expected": "< 0.5",
        "tolerance": "50%"
    },
    {
        "name": "error_rate",
        "metric": "error_rate_percent",
        "expected": "< 1",
        "tolerance": "absolute"
    }
]
```

---

## Appendix: Configuration Reference

### A.1 Full Agent Configuration

```yaml
apiVersion: clawresilience.moltos.io/v1
kind: AgentConfig
metadata:
  name: data-processor-config
spec:
  health:
    heartbeat_interval: 10s
    heartbeat_timeout: 30s
    startup_grace_period: 30s
    
    liveness_probe:
      enabled: true
      type: http
      endpoint: /health/live
      interval: 10s
      timeout: 5s
      failure_threshold: 3
      
    readiness_probe:
      enabled: true
      type: http
      endpoint: /health/ready
      interval: 5s
      timeout: 3s
      failure_threshold: 2
      
    progress_check:
      enabled: true
      min_progress_rate: 0.01  # per minute
      check_interval: 60s
      stuck_threshold: 3
      
  restart:
    policy: on_failure
    max_restarts: 5
    restart_window: 60s
    backoff:
      type: exponential
      initial: 1s
      max: 60s
      multiplier: 2
      
  circuit_breaker:
    enabled: true
    breakers:
      - name: task_execution
        failure_threshold: 5
        timeout: 120s
        half_open_calls: 3
      - name: database_connection
        failure_threshold: 3
        timeout: 60s
        half_open_calls: 1
        
  checkpoint:
    enabled: true
    interval: 30s
    progress_interval: 10  # percent
    compression: zstd
    storage:
      type: s3
      bucket: moltos-checkpoints
      region: us-east-1
    retention:
      max_per_agent: 3
      ttl: 24h
      
  notifications:
    channels:
      - type: slack
        webhook: ${SLACK_WEBHOOK_URL}
        filter: warning,critical
      - type: pagerduty
        key: ${PD_ROUTING_KEY}
        filter: critical
```

### A.2 Controller Configuration

```yaml
apiVersion: clawresilience.moltos.io/v1
kind: ResilienceController
metadata:
  name: clawresilience-main
spec:
  global:
    max_failure_rate: 0.10  # 10% before cascading alert
    default_restart_policy: on_failure
    
  supervision:
    strategy: one_for_one
    max_restarts: 100
    restart_window: 60s
    
  cascading_protection:
    enabled: true
    detection_threshold: 0.10
    velocity_threshold: 0.05
    auto_mitigation:
      - circuit_break_all
      - enable_rate_limiting
      - pause_scaling
      
  chaos:
    enabled: true
    schedule:
      - name: daily_agent_kill
        cron: "0 14 * * 1-5"
        type: agent_termination
        max_affected: 5
        require_steady_state: true
```

---

## Summary

ClawResilience combines the best practices from production-grade systems:

1. **From Kubernetes**: Multi-probe health model, restart policies, graceful startup
2. **From AWS ASG**: Two-tier health checks, gradual replacement, auto-recovery
3. **From Chaos Monkey**: Proactive failure testing, steady-state hypotheses, controlled blast radius
4. **From Erlang/OTP**: "Let it crash" philosophy, supervision trees, escalation patterns

Key design decisions:
- **Sidecar health monitoring** for isolation and reliability
- **Progress-based stuck detection** to distinguish slow from stuck
- **Circuit breakers at multiple levels** to prevent cascading failures
- **Automatic checkpoint/restore** for stateful agents
- **Escalating notification tiers** balancing auto-recovery with human oversight
- **Built-in chaos engineering** to validate resilience continuously

This architecture ensures MoltOS agent swarms can detect failures quickly, recover automatically when safe, escalate to humans when necessary, and prevent small failures from becoming system-wide outages.
