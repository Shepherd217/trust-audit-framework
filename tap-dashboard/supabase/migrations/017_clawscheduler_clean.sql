-- Migration 017: ClawScheduler (Drop and Recreate)
-- Clean up any partial tables first

DROP TABLE IF EXISTS claw_node_executions CASCADE;
DROP TABLE IF EXISTS claw_workflow_executions CASCADE;
DROP TABLE IF EXISTS claw_workflow_edges CASCADE;
DROP TABLE IF EXISTS claw_workflow_nodes CASCADE;
DROP TABLE IF EXISTS claw_workflows CASCADE;
DROP TYPE IF EXISTS execution_status CASCADE;
DROP TYPE IF EXISTS node_type CASCADE;
DROP TYPE IF EXISTS workflow_status CASCADE;

-- Types
CREATE TYPE workflow_status AS ENUM ('active', 'inactive', 'archived', 'deprecated');
CREATE TYPE node_type AS ENUM ('task', 'decision', 'parallel', 'join', 'event', 'subflow', 'delay', 'error');
CREATE TYPE execution_status AS ENUM ('pending', 'running', 'paused', 'completed', 'failed', 'cancelled', 'timeout', 'retrying');

-- Workflows
CREATE TABLE claw_workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    version TEXT NOT NULL DEFAULT '1.0.0',
    owner_agent_id UUID NOT NULL,
    owner_public_key TEXT NOT NULL,
    status workflow_status NOT NULL DEFAULT 'active',
    definition JSONB NOT NULL DEFAULT '{}',
    node_count INTEGER NOT NULL DEFAULT 0,
    is_valid BOOLEAN DEFAULT FALSE,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    total_executions INTEGER DEFAULT 0,
    successful_executions INTEGER DEFAULT 0,
    failed_executions INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workflow Nodes
CREATE TABLE claw_workflow_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id TEXT NOT NULL,
    workflow_id UUID NOT NULL REFERENCES claw_workflows(id) ON DELETE CASCADE,
    node_type node_type NOT NULL DEFAULT 'task',
    name TEXT NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    timeout_seconds INTEGER DEFAULT 300,
    max_retries INTEGER DEFAULT 3,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(workflow_id, node_id)
);

-- Workflow Edges
CREATE TABLE claw_workflow_edges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    edge_id TEXT NOT NULL,
    workflow_id UUID NOT NULL REFERENCES claw_workflows(id) ON DELETE CASCADE,
    from_node_id TEXT NOT NULL,
    to_node_id TEXT NOT NULL,
    edge_type TEXT DEFAULT 'default',
    condition TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workflow Executions
CREATE TABLE claw_workflow_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    execution_id TEXT NOT NULL UNIQUE,
    workflow_id UUID NOT NULL REFERENCES claw_workflows(id),
    trigger_type TEXT NOT NULL DEFAULT 'manual',
    trigger_payload JSONB DEFAULT '{}',
    status execution_status NOT NULL DEFAULT 'pending',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    current_node_id TEXT,
    completed_nodes TEXT[] DEFAULT '{}',
    pending_nodes TEXT[] DEFAULT '{}',
    global_state JSONB DEFAULT '{}',
    node_states JSONB DEFAULT '{}',
    final_output JSONB,
    error_message TEXT,
    retry_count JSONB DEFAULT '{}',
    parent_execution_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Node Executions
CREATE TABLE claw_node_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    execution_id UUID NOT NULL REFERENCES claw_workflow_executions(id) ON DELETE CASCADE,
    node_id TEXT NOT NULL,
    assigned_agent_id UUID,
    status TEXT NOT NULL DEFAULT 'pending',
    input_data JSONB DEFAULT '{}',
    output_data JSONB,
    assigned_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    processing_duration_ms INTEGER,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    checkpoint_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_workflows_owner ON claw_workflows(owner_agent_id);
CREATE INDEX idx_workflows_status ON claw_workflows(status);
CREATE INDEX idx_executions_workflow ON claw_workflow_executions(workflow_id);
CREATE INDEX idx_executions_status ON claw_workflow_executions(status);
CREATE INDEX idx_node_executions_execution ON claw_node_executions(execution_id);
