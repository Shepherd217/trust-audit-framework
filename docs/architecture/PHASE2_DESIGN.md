# Phase 2: ClawScheduler & ClawFS Design Document

## ClawScheduler — Task Orchestration Engine

### Core Concept
A workflow engine that coordinates multi-step tasks across multiple agents. Think Apache Airflow + Kubernetes Jobs, but for AI agents.

### Key Capabilities

#### 1. DAG-Based Workflows
```typescript
interface Workflow {
  id: string;
  name: string;
  definition: {
    nodes: TaskNode[];
    edges: Edge[]; // Dependencies
  };
  state: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  createdBy: string; // agent ID
  startedAt?: Date;
  completedAt?: Date;
}

interface TaskNode {
  id: string;
  type: 'agent' | 'human' | 'api' | 'decision' | 'parallel';
  config: {
    agentId?: string; // Which agent executes this
    skill?: string;   // What skill to use
    prompt?: string;  // Instructions
    timeout: number;  // Seconds
    retries: number;  // Max retry attempts
  };
  dependencies: string[]; // Node IDs that must complete first
}
```

#### 2. Execution Patterns
- **Sequential**: Step A → Step B → Step C
- **Parallel**: Run A, B, C simultaneously, wait for all
- **Fan-out/Fan-in**: One task spawns many, then aggregates results
- **Conditional**: If X then path A, else path B
- **Human-in-the-loop**: Pause for human approval
- **Event-driven**: Wait for external trigger

#### 3. State Machine
```
pending → assigned → running → [completed | failed | retrying]
                    ↓
                  paused (can resume)
```

#### 4. Error Handling
- Automatic retry with exponential backoff
- Dead letter queue for failed tasks
- Compensation transactions (undo previous steps)
- Alert on failure (webhook/email)

#### 5. Resource Management
- Queue tasks when agents are busy
- Priority levels (critical, high, normal, low)
- Preemption (pause low-priority for critical)

### API Endpoints
```
POST   /api/claw/scheduler/workflows          // Create workflow
GET    /api/claw/scheduler/workflows/:id      // Get status
POST   /api/claw/scheduler/workflows/:id/run  // Start execution
POST   /api/claw/scheduler/workflows/:id/pause
POST   /api/claw/scheduler/workflows/:id/resume
POST   /api/claw/scheduler/workflows/:id/cancel
GET    /api/claw/scheduler/queue              // View task queue
```

### CLI Commands
```bash
moltos workflow create --file workflow.yaml
moltos workflow run --id <workflow-id>
moltos workflow status --id <workflow-id>
moltos workflow logs --id <workflow-id>
moltos workflow cancel --id <workflow-id>
```

### Storage
- Supabase table: `claw_workflows`, `claw_tasks`, `claw_task_queue`
- Redis: For queue management and rate limiting

---

## ClawFS — Distributed File System

### Core Concept
A content-addressed, distributed storage system for agents. Think IPFS + S3, with agent-native access controls.

### Key Capabilities

#### 1. Content-Addressed Storage
```typescript
interface ClawFile {
  cid: string; // Content Identifier (hash)
  size: number;
  mimeType: string;
  locations: StorageLocation[];
  accessControl: {
    owner: string; // agent ID
    readAccess: string[]; // agent IDs
    writeAccess: string[];
  };
  metadata: {
    name: string;
    description?: string;
    tags: string[];
    createdAt: Date;
    expiresAt?: Date;
  };
}

type StorageLocation = 
  | { type: 'local'; path: string }
  | { type: 's3'; bucket: string; key: string }
  | { type: 'ipfs'; cid: string }
  | { type: 'supabase'; bucket: string; path: string };
```

#### 2. Storage Tiers
- **Hot**: Local SSD (frequently accessed, expensive)
- **Warm**: Supabase/S3 (recent files, moderate cost)
- **Cold**: Archive (old files, cheap, slower access)

#### 3. Agent-Native Features
- **Share by agent ID**: `clawfs.share(cid, ['agent-123', 'agent-456'])`
- **Time-based expiry**: Auto-delete after 30 days
- **Versioning**: Keep history of file changes
- **Sync**: Replicate across regions for availability

#### 4. Access Patterns
```typescript
// Write
const cid = await clawfs.write('/data/report.pdf', buffer, {
  tier: 'warm',
  shareWith: ['agent-123'],
  expiresIn: '30d'
});

// Read
const buffer = await clawfs.read(cid);

// Query
const files = await clawfs.query({
  owner: 'agent-123',
  tags: ['trading', 'daily'],
  createdAfter: '2025-01-01'
});
```

### API Endpoints
```
POST   /api/claw/fs/upload           // Upload file
GET    /api/claw/fs/download/:cid    // Download file
GET    /api/claw/fs/metadata/:cid    // Get metadata
POST   /api/claw/fs/share/:cid       // Update permissions
DELETE /api/claw/fs/:cid             // Delete file
GET    /api/claw/fs/list             // List files
```

### CLI Commands
```bash
moltos fs upload --file ./data.csv --tags "trading,daily"
moltos fs download --cid QmXyz... --output ./downloaded.csv
moltos fs ls --owner agent-123 --tag trading
moltos fs share --cid QmXyz... --agents agent-456,agent-789
moltos fs rm --cid QmXyz...
```

### Storage Backend
- Primary: Supabase Storage (S3-compatible)
- Cache: Local filesystem
- Archive: Backblaze B2 or Glacier

---

## Integration Points

### ClawScheduler ↔ ClawBus
- Scheduler publishes task assignments via ClawBus
- Agents receive tasks and publish status updates

### ClawScheduler ↔ ClawKernel
- Scheduler requests process spawn from Kernel
- Kernel reports process status to Scheduler

### ClawFS ↔ ClawBus
- File share notifications sent via messaging
- Agents notified when files are shared with them

### ClawFS ↔ ClawKernel
- Kernel provides local storage paths
- Filesystem manages persistence across process restarts

---

## Success Metrics

### ClawScheduler
- Can orchestrate 100-step workflow
- Handles 1000 concurrent tasks
- <1s latency for task assignment
- 99.9% task completion rate (with retries)

### ClawFS
- Store/retrieve 1GB files
- 99.99% data durability
- <500ms read latency for hot files
- <2s read latency for cold files

---

## Dependencies
- Supabase (metadata, queue)
- Redis (task queue, caching)
- S3/Backblaze (blob storage)
- ClawBus (messaging)
- ClawKernel (process management)
