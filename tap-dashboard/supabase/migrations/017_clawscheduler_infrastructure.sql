-- Migration 017: ClawScheduler Infrastructure
-- Workflow engine for persistent, resumable agent tasks

-- ============================================================================
-- WORKFLOW DEFINITIONS
-- ============================================================================

CREATE TYPE workflow_status AS ENUM ('active', 'inactive', 'archived', 'deprecated');
CREATE TYPE node_type AS ENUM ('task', 'decision', 'parallel', 'join', 'event', 'subflow', 'delay', 'error');

CREATE TABLE IF NOT EXISTS claw_workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    version TEXT NOT NULL DEFAULT '1.0.0',
    
    -- Ownership
    owner_agent_id TEXT NOT NULL REFERENCES user_agents(id),
    owner_public_key TEXT NOT NULL,
    
    -- Status
    status workflow_status NOT NULL DEFAULT 'active',
    
    -- Definition
    definition JSONB NOT NULL DEFAULT '{}',
    node_count INTEGER NOT NULL DEFAULT 0,
    edge_count INTEGER NOT NULL DEFAULT 0,
    
    -- Validation
    is_valid BOOLEAN DEFAULT FALSE,
    validation_errors JSONB DEFAULT '[]',
    validated_at TIMESTAMPTZ,
    
    -- Metadata
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    
    -- Stats
    total_executions INTEGER DEFAULT 0,
    successful_executions INTEGER DEFAULT 0,
    failed_executions INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_claw_workflows_owner ON claw_workflows(owner_agent_id);
CREATE INDEX idx_claw_workflows_status ON claw_workflows(status);
CREATE INDEX idx_claw_workflows_tags ON claw_workflows USING GIN(tags);

-- ============================================================================
-- WORKFLOW NODES
-- ============================================================================

CREATE TYPE retry_policy_type AS ENUM ('none', 'fixed', 'linear', 'exponential');

CREATE TABLE IF NOT EXISTS claw_workflow_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_id TEXT NOT NULL,
    workflow_id UUID NOT NULL REFERENCES claw_workflows(id) ON DELETE CASCADE,
    
    -- Node definition
    node_type node_type NOT NULL DEFAULT 'task',
    name TEXT NOT NULL,
    description TEXT,
    position JSONB DEFAULT '{"x": 0, "y": 0}',
    
    -- Configuration
    config JSONB NOT NULL DEFAULT '{}',
    
    -- Task-specific
    agent_selection JSONB DEFAULT '{}',
    timeout_seconds INTEGER DEFAULT 300,
    
    -- Retry policy
    retry_policy retry_policy_type DEFAULT 'exponential',
    max_retries INTEGER DEFAULT 3,
    retry_delay_seconds INTEGER DEFAULT 5,
    
    -- Decision-specific
    condition_expression TEXT,
    
    -- Parallel/Join
    branch_count INTEGER,
    join_strategy TEXT DEFAULT 'all' CHECK (join_strategy IN ('all', 'any', 'first')),
    
    -- Event
    event_type TEXT,
    
    -- Subflow
    subflow_workflow_id TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_claw_workflow_nodes_workflow ON claw_workflow_nodes(workflow_id);
CREATE INDEX idx_claw_workflow_nodes_type ON claw_workflow_nodes(node_type);
CREATE UNIQUE INDEX idx_claw_workflow_nodes_unique ON claw_workflow_nodes(workflow_id, node_id);

-- ============================================================================
-- WORKFLOW EDGES
-- ============================================================================

CREATE TABLE IF NOT EXISTS claw_workflow_edges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    edge_id TEXT NOT NULL,
    workflow_id UUID NOT NULL REFERENCES claw_workflows(id) ON DELETE CASCADE,
    
    -- Connection
    from_node_id TEXT NOT NULL,
    to_node_id TEXT NOT NULL,
    
    -- Edge properties
    edge_type TEXT DEFAULT 'default' CHECK (edge_type IN ('default', 'conditional', 'error', 'timeout')),
    condition TEXT,
    label TEXT,
    
    -- Parallel branch mapping
    branch_index INTEGER,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_claw_workflow_edges_workflow ON claw_workflow_edges(workflow_id);
CREATE INDEX idx_claw_workflow_edges_from ON claw_workflow_edges(from_node_id);
CREATE INDEX idx_claw_workflow_edges_to ON claw_workflow_edges(to_node_id);

-- ============================================================================
-- WORKFLOW EXECUTIONS
-- ============================================================================

CREATE TYPE execution_status AS ENUM (
    'pending', 'running', 'paused', 'completed', 'failed', 
    'cancelled', 'timeout', 'retrying'
);

CREATE TABLE IF NOT EXISTS claw_workflow_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    execution_id TEXT NOT NULL UNIQUE,
    workflow_id UUID NOT NULL REFERENCES claw_workflows(id),
    
    -- Trigger
    trigger_type TEXT NOT NULL DEFAULT 'manual' CHECK (trigger_type IN ('manual', 'webhook', 'schedule', 'event', 'subflow')),
    trigger_source TEXT,
    trigger_payload JSONB DEFAULT '{}',
    
    -- Status
    status execution_status NOT NULL DEFAULT 'pending',
    
    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    
    -- Current position
    current_node_id TEXT,
    completed_nodes TEXT[] DEFAULT '{}',
    pending_nodes TEXT[] DEFAULT '{}',
    
    -- State
    global_state JSONB DEFAULT '{}',
    node_states JSONB DEFAULT '{}',
    
    -- Results
    final_output JSONB,
    error_message TEXT,
    error_node_id TEXT,
    
    -- Retry tracking
    retry_count JSONB DEFAULT '{}',
    
    -- Parent context (for subflows)
    parent_execution_id TEXT,
    parent_node_id TEXT,
    
    -- Agent assignment
    assigned_agents JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_claw_workflow_executions_workflow ON claw_workflow_executions(workflow_id);
CREATE INDEX idx_claw_workflow_executions_status ON claw_workflow_executions(status);
CREATE INDEX idx_claw_workflow_executions_trigger ON claw_workflow_executions(trigger_type);
CREATE INDEX idx_claw_workflow_executions_parent ON claw_workflow_executions(parent_execution_id);
CREATE INDEX idx_claw_workflow_executions_created ON claw_workflow_executions(created_at);

-- ============================================================================
-- NODE EXECUTIONS (Individual node runs)
-- ============================================================================

CREATE TYPE node_execution_status AS ENUM (
    'pending', 'assigned', 'running', 'completed', 'failed', 
    'skipped', 'timeout', 'cancelled', 'retrying'
);

CREATE TABLE IF NOT EXISTS claw_node_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    execution_id UUID NOT NULL REFERENCES claw_workflow_executions(id) ON DELETE CASCADE,
    node_id TEXT NOT NULL,
    
    -- Assignment
    assigned_agent_id TEXT REFERENCES user_agents(id),
    
    -- Status
    status node_execution_status NOT NULL DEFAULT 'pending',
    
    -- Input/Output
    input_data JSONB DEFAULT '{}',
    output_data JSONB,
    
    -- Timing
    assigned_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Processing
    processing_duration_ms INTEGER,
    
    -- Error handling
    error_message TEXT,
    error_stack TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- Checkpoint (for resumability)
    checkpoint_data JSONB,
    checkpoint_at TIMESTAMPTZ,
    
    -- ClawBus integration
    handoff_id TEXT,
    message_id TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_claw_node_executions_execution ON claw_node_executions(execution_id);
CREATE INDEX idx_claw_node_executions_node ON claw_node_executions(node_id);
CREATE INDEX idx_claw_node_executions_status ON claw_node_executions(status);
CREATE INDEX idx_claw_node_executions_agent ON claw_node_executions(assigned_agent_id);
CREATE INDEX idx_claw_node_executions_handoff ON claw_node_executions(handoff_id);

-- ============================================================================
-- EXECUTION EVENTS (Audit trail)
-- ============================================================================

CREATE TYPE workflow_event_type AS ENUM (
    'execution_started', 'execution_completed', 'execution_failed', 'execution_cancelled',
    'node_started', 'node_completed', 'node_failed', 'node_retrying',
    'node_assigned', 'node_timeout', 'handoff_initiated', 'handoff_completed',
    'decision_made', 'parallel_branched', 'join_completed',
    'checkpoint_created', 'execution_resumed'
);

CREATE TABLE IF NOT EXISTS claw_workflow_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    execution_id UUID NOT NULL REFERENCES claw_workflow_executions(id) ON DELETE CASCADE,
    
    event_type workflow_event_type NOT NULL,
    node_id TEXT,
    
    -- Event data
    payload JSONB DEFAULT '{}',
    
    -- Actor
    agent_id TEXT REFERENCES user_agents(id),
    
    -- Timestamp (for ordering)
    sequence_number BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_claw_workflow_events_execution ON claw_workflow_events(execution_id);
CREATE INDEX idx_claw_workflow_events_type ON claw_workflow_events(event_type);
CREATE INDEX idx_claw_workflow_events_created ON claw_workflow_events(created_at);

-- Sequence counter per execution
CREATE TABLE IF NOT EXISTS claw_workflow_event_sequences (
    execution_id UUID PRIMARY KEY REFERENCES claw_workflow_executions(id) ON DELETE CASCADE,
    last_sequence BIGINT DEFAULT 0
);

-- ============================================================================
-- EXECUTION CHECKPOINTS (For crash recovery)
-- ============================================================================

CREATE TABLE IF NOT EXISTS claw_execution_checkpoints (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    execution_id UUID NOT NULL REFERENCES claw_workflow_executions(id) ON DELETE CASCADE,
    
    checkpoint_number INTEGER NOT NULL,
    
    -- State snapshot
    global_state JSONB NOT NULL,
    node_states JSONB NOT NULL,
    completed_nodes TEXT[] NOT NULL,
    pending_nodes TEXT[] NOT NULL,
    current_node_id TEXT,
    
    -- Metadata
    triggered_by TEXT,
    node_id TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_claw_execution_checkpoints_execution ON claw_execution_checkpoints(execution_id);
CREATE INDEX idx_claw_execution_checkpoints_number ON claw_execution_checkpoints(execution_id, checkpoint_number DESC);

-- ============================================================================
-- SCHEDULED WORKFLOWS
-- ============================================================================

CREATE TYPE schedule_type AS ENUM ('once', 'interval', 'cron');

CREATE TABLE IF NOT EXISTS claw_scheduled_workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    schedule_id TEXT NOT NULL UNIQUE,
    workflow_id UUID NOT NULL REFERENCES claw_workflows(id),
    
    -- Schedule definition
    schedule_type schedule_type NOT NULL,
    cron_expression TEXT,
    interval_seconds INTEGER,
    run_at TIMESTAMPTZ,
    
    -- Execution limits
    max_runs INTEGER,
    run_count INTEGER DEFAULT 0,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    
    -- Input
    default_input JSONB DEFAULT '{}',
    
    created_by TEXT NOT NULL REFERENCES user_agents(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_claw_scheduled_workflows_workflow ON claw_scheduled_workflows(workflow_id);
CREATE INDEX idx_claw_scheduled_workflows_next_run ON claw_scheduled_workflows(next_run_at) WHERE is_active = TRUE;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Update timestamps
CREATE OR REPLACE FUNCTION update_scheduler_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_claw_workflows_updated
    BEFORE UPDATE ON claw_workflows
    FOR EACH ROW EXECUTE FUNCTION update_scheduler_timestamp();

CREATE TRIGGER trigger_claw_workflow_executions_updated
    BEFORE UPDATE ON claw_workflow_executions
    FOR EACH ROW EXECUTE FUNCTION update_scheduler_timestamp();

CREATE TRIGGER trigger_claw_node_executions_updated
    BEFORE UPDATE ON claw_node_executions
    FOR EACH ROW EXECUTE FUNCTION update_scheduler_timestamp();

CREATE TRIGGER trigger_claw_scheduled_workflows_updated
    BEFORE UPDATE ON claw_scheduled_workflows
    FOR EACH ROW EXECUTE FUNCTION update_scheduler_timestamp();

-- Get next sequence number for events
CREATE OR REPLACE FUNCTION get_next_event_sequence(p_execution_id UUID)
RETURNS BIGINT AS $$
DECLARE
    next_seq BIGINT;
BEGIN
    INSERT INTO claw_workflow_event_sequences (execution_id, last_sequence)
    VALUES (p_execution_id, 1)
    ON CONFLICT (execution_id)
    DO UPDATE SET last_sequence = claw_workflow_event_sequences.last_sequence + 1
    RETURNING last_sequence INTO next_seq;
    
    RETURN next_seq;
END;
$$ LANGUAGE plpgsql;

-- Create execution checkpoint
CREATE OR REPLACE FUNCTION create_execution_checkpoint(
    p_execution_id UUID,
    p_triggered_by TEXT DEFAULT 'automatic',
    p_node_id TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    checkpoint_id UUID;
    next_number INTEGER;
    exec_record RECORD;
BEGIN
    -- Get execution state
    SELECT * INTO exec_record
    FROM claw_workflow_executions
    WHERE id = p_execution_id;
    
    IF NOT FOUND THEN
        RETURN NULL;
    END IF;
    
    -- Get next checkpoint number
    SELECT COALESCE(MAX(checkpoint_number), 0) + 1 INTO next_number
    FROM claw_execution_checkpoints
    WHERE execution_id = p_execution_id;
    
    -- Insert checkpoint
    INSERT INTO claw_execution_checkpoints (
        execution_id,
        checkpoint_number,
        global_state,
        node_states,
        completed_nodes,
        pending_nodes,
        current_node_id,
        triggered_by,
        node_id
    ) VALUES (
        p_execution_id,
        next_number,
        exec_record.global_state,
        exec_record.node_states,
        exec_record.completed_nodes,
        exec_record.pending_nodes,
        exec_record.current_node_id,
        p_triggered_by,
        p_node_id
    )
    RETURNING id INTO checkpoint_id;
    
    RETURN checkpoint_id;
END;
$$ LANGUAGE plpgsql;

-- Resume execution from checkpoint
CREATE OR REPLACE FUNCTION resume_execution_from_checkpoint(
    p_checkpoint_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    checkpoint_record RECORD;
BEGIN
    SELECT * INTO checkpoint_record
    FROM claw_execution_checkpoints
    WHERE id = p_checkpoint_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Restore execution state
    UPDATE claw_workflow_executions
    SET status = 'running',
        global_state = checkpoint_record.global_state,
        node_states = checkpoint_record.node_states,
        completed_nodes = checkpoint_record.completed_nodes,
        pending_nodes = checkpoint_record.pending_nodes,
        current_node_id = checkpoint_record.current_node_id,
        updated_at = NOW()
    WHERE id = checkpoint_record.execution_id;
    
    -- Log resume event
    INSERT INTO claw_workflow_events (
        execution_id,
        event_type,
        payload,
        sequence_number
    ) VALUES (
        checkpoint_record.execution_id,
        'execution_resumed',
        jsonb_build_object('checkpoint_id', p_checkpoint_id, 'checkpoint_number', checkpoint_record.checkpoint_number),
        get_next_event_sequence(checkpoint_record.execution_id)
    );
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Cleanup old executions
CREATE OR REPLACE FUNCTION cleanup_workflow_executions(
    p_older_than_days INTEGER DEFAULT 30
)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM claw_workflow_executions
    WHERE created_at < NOW() - INTERVAL '1 day' * p_older_than_days
      AND status IN ('completed', 'failed', 'cancelled');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE claw_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE claw_workflow_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE claw_workflow_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE claw_workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE claw_node_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE claw_workflow_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE claw_execution_checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE claw_scheduled_workflows ENABLE ROW LEVEL SECURITY;

-- Workflows: readable by all, writable by owner
CREATE POLICY claw_workflows_select ON claw_workflows FOR SELECT USING (TRUE);
CREATE POLICY claw_workflows_modify ON claw_workflows 
    FOR ALL USING (owner_agent_id = (SELECT agent_id FROM agents WHERE public_key = current_setting('app.current_user_public_key', TRUE)));

-- Executions: readable by participants
CREATE POLICY claw_workflow_executions_select ON claw_workflow_executions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM claw_workflows w 
            WHERE w.id = workflow_id 
            AND w.owner_agent_id = (SELECT agent_id FROM agents WHERE public_key = current_setting('app.current_user_public_key', TRUE))
        )
        OR EXISTS (
            SELECT 1 FROM claw_node_executions ne 
            WHERE ne.execution_id = claw_workflow_executions.id 
            AND ne.assigned_agent_id = (SELECT agent_id FROM agents WHERE public_key = current_setting('app.current_user_public_key', TRUE))
        )
    );

-- ============================================================================
-- CONFIGURATION
-- ============================================================================

INSERT INTO wot_config (key, value, description) VALUES
    ('scheduler_default_timeout_seconds', '300', 'Default node execution timeout'),
    ('scheduler_max_retries_default', '3', 'Default max retries per node'),
    ('scheduler_checkpoint_interval', '10', 'Auto-checkpoint every N nodes'),
    ('scheduler_cleanup_days', '30', 'Auto-cleanup completed executions after N days'),
    ('scheduler_max_concurrent_executions', '100', 'Max concurrent executions per workflow')
ON CONFLICT (key) DO NOTHING;
