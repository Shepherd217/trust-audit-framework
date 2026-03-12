-- Migration: ClawScheduler Workflow Orchestration Tables
-- Description: Creates tables for workflow orchestration, event sourcing, agent tasks, and circuit breakers
-- Version: 009

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. claw_workflows — Workflow definitions
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.claw_workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    definition JSONB NOT NULL DEFAULT '{}'::jsonb,
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    tags TEXT[] DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT claw_workflows_name_version_owner UNIQUE (name, version, owner_id)
);

COMMENT ON TABLE public.claw_workflows IS 'Workflow definitions for ClawScheduler';
COMMENT ON COLUMN public.claw_workflows.definition IS 'JSONB containing nodes, edges, and config';

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp_claw_workflows
    BEFORE UPDATE ON public.claw_workflows
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- ============================================================================
-- 2. claw_workflow_executions — Runtime instances
-- ============================================================================

CREATE TYPE public.claw_execution_state AS ENUM (
    'pending',
    'running',
    'paused',
    'completed',
    'failed',
    'cancelled'
);

CREATE TABLE IF NOT EXISTS public.claw_workflow_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES public.claw_workflows(id) ON DELETE CASCADE,
    state public.claw_execution_state NOT NULL DEFAULT 'pending',
    current_node_id TEXT,
    progress_percent INTEGER DEFAULT 0,
    input JSONB DEFAULT '{}'::jsonb,
    context JSONB DEFAULT '{}'::jsonb,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    estimated_completion TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT progress_percent_check CHECK (progress_percent >= 0 AND progress_percent <= 100)
);

COMMENT ON TABLE public.claw_workflow_executions IS 'Runtime instances of workflow executions';

CREATE TRIGGER set_timestamp_claw_workflow_executions
    BEFORE UPDATE ON public.claw_workflow_executions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- ============================================================================
-- 3. claw_workflow_events — Event sourcing log
-- ============================================================================

CREATE TYPE public.claw_event_type AS ENUM (
    'execution_started',
    'execution_completed',
    'execution_failed',
    'execution_cancelled',
    'node_started',
    'node_completed',
    'node_failed',
    'task_assigned',
    'task_completed',
    'task_failed',
    'circuit_opened',
    'circuit_closed',
    'circuit_half_opened',
    'custom'
);

CREATE TABLE IF NOT EXISTS public.claw_workflow_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    execution_id UUID NOT NULL REFERENCES public.claw_workflow_executions(id) ON DELETE CASCADE,
    event_type public.claw_event_type NOT NULL,
    node_id TEXT,
    payload JSONB DEFAULT '{}'::jsonb,
    metadata JSONB DEFAULT '{}'::jsonb,
    causation_id UUID REFERENCES public.claw_workflow_events(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.claw_workflow_events IS 'Event sourcing log for workflow executions';
COMMENT ON COLUMN public.claw_workflow_events.causation_id IS 'Self-referential FK for event chain causality';

-- ============================================================================
-- 4. claw_agent_tasks — Task assignments
-- ============================================================================

CREATE TYPE public.claw_task_status AS ENUM (
    'pending',
    'assigned',
    'in_progress',
    'completed',
    'failed',
    'cancelled',
    'timeout'
);

CREATE TYPE public.claw_payment_status AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed',
    'refunded'
);

CREATE TABLE IF NOT EXISTS public.claw_agent_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    execution_id UUID NOT NULL REFERENCES public.claw_workflow_executions(id) ON DELETE CASCADE,
    node_id TEXT NOT NULL,
    agent_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    status public.claw_task_status NOT NULL DEFAULT 'pending',
    input JSONB DEFAULT '{}'::jsonb,
    output JSONB DEFAULT '{}'::jsonb,
    reasoning_trace JSONB DEFAULT '{}'::jsonb,
    token_usage JSONB DEFAULT '{}'::jsonb,
    cost_usd DECIMAL(12, 6),
    payment_status public.claw_payment_status,
    assigned_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    deadline_at TIMESTAMPTZ,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT retry_count_check CHECK (retry_count >= 0),
    CONSTRAINT max_retries_check CHECK (max_retries >= 0)
);

COMMENT ON TABLE public.claw_agent_tasks IS 'Task assignments for agents in workflow executions';

CREATE TRIGGER set_timestamp_claw_agent_tasks
    BEFORE UPDATE ON public.claw_agent_tasks
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- ============================================================================
-- 5. claw_circuit_breakers — Circuit breaker states
-- ============================================================================

CREATE TYPE public.claw_circuit_state AS ENUM (
    'open',
    'closed',
    'half-open'
);

CREATE TABLE IF NOT EXISTS public.claw_circuit_breakers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    node_id TEXT,
    state public.claw_circuit_state NOT NULL DEFAULT 'closed',
    failure_count INTEGER NOT NULL DEFAULT 0,
    success_count INTEGER NOT NULL DEFAULT 0,
    last_failure_at TIMESTAMPTZ,
    last_success_at TIMESTAMPTZ,
    next_attempt_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    CONSTRAINT failure_count_check CHECK (failure_count >= 0),
    CONSTRAINT success_count_check CHECK (success_count >= 0),
    CONSTRAINT unique_agent_node UNIQUE (agent_id, node_id)
);

COMMENT ON TABLE public.claw_circuit_breakers IS 'Circuit breaker states for agent/node resilience';

CREATE TRIGGER set_timestamp_claw_circuit_breakers
    BEFORE UPDATE ON public.claw_circuit_breakers
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

-- ============================================================================
-- INDEXES
-- ============================================================================

-- claw_workflow_executions indexes
CREATE INDEX IF NOT EXISTS idx_claw_executions_workflow_id 
    ON public.claw_workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_claw_executions_state 
    ON public.claw_workflow_executions(state);
CREATE INDEX IF NOT EXISTS idx_claw_executions_created_at 
    ON public.claw_workflow_executions(created_at);
CREATE INDEX IF NOT EXISTS idx_claw_executions_state_created 
    ON public.claw_workflow_executions(state, created_at);

-- claw_workflow_events indexes
CREATE INDEX IF NOT EXISTS idx_claw_events_execution_id 
    ON public.claw_workflow_events(execution_id);
CREATE INDEX IF NOT EXISTS idx_claw_events_event_type 
    ON public.claw_workflow_events(event_type);
CREATE INDEX IF NOT EXISTS idx_claw_events_created_at 
    ON public.claw_workflow_events(created_at);
CREATE INDEX IF NOT EXISTS idx_claw_events_execution_created 
    ON public.claw_workflow_events(execution_id, created_at);

-- claw_agent_tasks indexes
CREATE INDEX IF NOT EXISTS idx_claw_tasks_execution_id 
    ON public.claw_agent_tasks(execution_id);
CREATE INDEX IF NOT EXISTS idx_claw_tasks_agent_id 
    ON public.claw_agent_tasks(agent_id);
CREATE INDEX IF NOT EXISTS idx_claw_tasks_status 
    ON public.claw_agent_tasks(status);
CREATE INDEX IF NOT EXISTS idx_claw_tasks_execution_status 
    ON public.claw_agent_tasks(execution_id, status);
CREATE INDEX IF NOT EXISTS idx_claw_tasks_agent_status 
    ON public.claw_agent_tasks(agent_id, status);
CREATE INDEX IF NOT EXISTS idx_claw_tasks_deadline 
    ON public.claw_agent_tasks(deadline_at) WHERE deadline_at IS NOT NULL;

-- Additional useful indexes
CREATE INDEX IF NOT EXISTS idx_claw_workflows_owner 
    ON public.claw_workflows(owner_id);
CREATE INDEX IF NOT EXISTS idx_claw_workflows_active 
    ON public.claw_workflows(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_claw_circuit_breakers_agent 
    ON public.claw_circuit_breakers(agent_id);
CREATE INDEX IF NOT EXISTS idx_claw_circuit_breakers_state 
    ON public.claw_circuit_breakers(state);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.claw_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claw_workflow_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claw_workflow_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claw_agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claw_circuit_breakers ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies for claw_workflows
-- Owner can CRUD
-- ============================================================================

CREATE POLICY "claw_workflows_owner_select"
    ON public.claw_workflows
    FOR SELECT
    USING (owner_id = auth.uid());

CREATE POLICY "claw_workflows_owner_insert"
    ON public.claw_workflows
    FOR INSERT
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "claw_workflows_owner_update"
    ON public.claw_workflows
    FOR UPDATE
    USING (owner_id = auth.uid())
    WITH CHECK (owner_id = auth.uid());

CREATE POLICY "claw_workflows_owner_delete"
    ON public.claw_workflows
    FOR DELETE
    USING (owner_id = auth.uid());

-- ============================================================================
-- RLS Policies for claw_workflow_executions
-- Visible to workflow owner or participating agents
-- ============================================================================

CREATE POLICY "claw_executions_select"
    ON public.claw_workflow_executions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.claw_workflows w
            WHERE w.id = claw_workflow_executions.workflow_id
            AND w.owner_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM public.claw_agent_tasks t
            WHERE t.execution_id = claw_workflow_executions.id
            AND t.agent_id = auth.uid()
        )
    );

CREATE POLICY "claw_executions_insert"
    ON public.claw_workflow_executions
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.claw_workflows w
            WHERE w.id = claw_workflow_executions.workflow_id
            AND w.owner_id = auth.uid()
        )
    );

CREATE POLICY "claw_executions_update"
    ON public.claw_workflow_executions
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.claw_workflows w
            WHERE w.id = claw_workflow_executions.workflow_id
            AND w.owner_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM public.claw_agent_tasks t
            WHERE t.execution_id = claw_workflow_executions.id
            AND t.agent_id = auth.uid()
        )
    );

CREATE POLICY "claw_executions_delete"
    ON public.claw_workflow_executions
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.claw_workflows w
            WHERE w.id = claw_workflow_executions.workflow_id
            AND w.owner_id = auth.uid()
        )
    );

-- ============================================================================
-- RLS Policies for claw_workflow_events
-- Visible if execution is visible
-- ============================================================================

CREATE POLICY "claw_events_select"
    ON public.claw_workflow_events
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.claw_workflow_executions e
            JOIN public.claw_workflows w ON w.id = e.workflow_id
            WHERE e.id = claw_workflow_events.execution_id
            AND w.owner_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM public.claw_agent_tasks t
            WHERE t.execution_id = claw_workflow_events.execution_id
            AND t.agent_id = auth.uid()
        )
    );

CREATE POLICY "claw_events_insert"
    ON public.claw_workflow_events
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.claw_workflow_executions e
            JOIN public.claw_workflows w ON w.id = e.workflow_id
            WHERE e.id = claw_workflow_events.execution_id
            AND w.owner_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM public.claw_agent_tasks t
            WHERE t.execution_id = claw_workflow_events.execution_id
            AND t.agent_id = auth.uid()
        )
    );

CREATE POLICY "claw_events_update"
    ON public.claw_workflow_events
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.claw_workflow_executions e
            JOIN public.claw_workflows w ON w.id = e.workflow_id
            WHERE e.id = claw_workflow_events.execution_id
            AND w.owner_id = auth.uid()
        )
    );

CREATE POLICY "claw_events_delete"
    ON public.claw_workflow_events
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.claw_workflow_executions e
            JOIN public.claw_workflows w ON w.id = e.workflow_id
            WHERE e.id = claw_workflow_events.execution_id
            AND w.owner_id = auth.uid()
        )
    );

-- ============================================================================
-- RLS Policies for claw_agent_tasks
-- Visible to assigned agent or workflow owner
-- ============================================================================

CREATE POLICY "claw_tasks_select"
    ON public.claw_agent_tasks
    FOR SELECT
    USING (
        agent_id = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM public.claw_workflow_executions e
            JOIN public.claw_workflows w ON w.id = e.workflow_id
            WHERE e.id = claw_agent_tasks.execution_id
            AND w.owner_id = auth.uid()
        )
    );

CREATE POLICY "claw_tasks_insert"
    ON public.claw_agent_tasks
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.claw_workflow_executions e
            JOIN public.claw_workflows w ON w.id = e.workflow_id
            WHERE e.id = claw_agent_tasks.execution_id
            AND w.owner_id = auth.uid()
        )
    );

CREATE POLICY "claw_tasks_update"
    ON public.claw_agent_tasks
    FOR UPDATE
    USING (
        agent_id = auth.uid()
        OR
        EXISTS (
            SELECT 1 FROM public.claw_workflow_executions e
            JOIN public.claw_workflows w ON w.id = e.workflow_id
            WHERE e.id = claw_agent_tasks.execution_id
            AND w.owner_id = auth.uid()
        )
    );

CREATE POLICY "claw_tasks_delete"
    ON public.claw_agent_tasks
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.claw_workflow_executions e
            JOIN public.claw_workflows w ON w.id = e.workflow_id
            WHERE e.id = claw_agent_tasks.execution_id
            AND w.owner_id = auth.uid()
        )
    );

-- ============================================================================
-- RLS Policies for claw_circuit_breakers
-- Visible to agent owner
-- ============================================================================

CREATE POLICY "claw_circuit_breakers_select"
    ON public.claw_circuit_breakers
    FOR SELECT
    USING (
        agent_id = auth.uid()
        OR
        agent_id IS NULL  -- System-level circuit breakers visible to all
    );

CREATE POLICY "claw_circuit_breakers_insert"
    ON public.claw_circuit_breakers
    FOR INSERT
    WITH CHECK (
        agent_id = auth.uid()
        OR
        agent_id IS NULL
    );

CREATE POLICY "claw_circuit_breakers_update"
    ON public.claw_circuit_breakers
    FOR UPDATE
    USING (
        agent_id = auth.uid()
        OR
        agent_id IS NULL
    );

CREATE POLICY "claw_circuit_breakers_delete"
    ON public.claw_circuit_breakers
    FOR DELETE
    USING (
        agent_id = auth.uid()
    );

-- ============================================================================
-- GRANTS (for service roles and authenticated users)
-- ============================================================================

GRANT USAGE ON TYPE public.claw_execution_state TO authenticated, anon, service_role;
GRANT USAGE ON TYPE public.claw_event_type TO authenticated, anon, service_role;
GRANT USAGE ON TYPE public.claw_task_status TO authenticated, anon, service_role;
GRANT USAGE ON TYPE public.claw_payment_status TO authenticated, anon, service_role;
GRANT USAGE ON TYPE public.claw_circuit_state TO authenticated, anon, service_role;

GRANT ALL ON TABLE public.claw_workflows TO authenticated, service_role;
GRANT ALL ON TABLE public.claw_workflow_executions TO authenticated, service_role;
GRANT ALL ON TABLE public.claw_workflow_events TO authenticated, service_role;
GRANT ALL ON TABLE public.claw_agent_tasks TO authenticated, service_role;
GRANT ALL ON TABLE public.claw_circuit_breakers TO authenticated, service_role;

-- ============================================================================
-- VIEWS (convenience views for common queries)
-- ============================================================================

-- View: Active executions with workflow details
CREATE OR REPLACE VIEW public.v_claw_active_executions AS
SELECT 
    e.*,
    w.name as workflow_name,
    w.owner_id as workflow_owner_id
FROM public.claw_workflow_executions e
JOIN public.claw_workflows w ON w.id = e.workflow_id
WHERE e.state IN ('pending', 'running', 'paused');

-- View: Task details with execution and workflow info
CREATE OR REPLACE VIEW public.v_claw_task_details AS
SELECT 
    t.*,
    e.workflow_id,
    e.state as execution_state,
    w.name as workflow_name,
    w.owner_id as workflow_owner_id
FROM public.claw_agent_tasks t
JOIN public.claw_workflow_executions e ON e.id = t.execution_id
JOIN public.claw_workflows w ON w.id = e.workflow_id;

-- ============================================================================
-- FUNCTIONS (helper functions)
-- ============================================================================

-- Function: Get execution statistics for a workflow
CREATE OR REPLACE FUNCTION public.claw_get_execution_stats(p_workflow_id UUID)
RETURNS TABLE (
    state public.claw_execution_state,
    count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        e.state,
        COUNT(*)::BIGINT
    FROM public.claw_workflow_executions e
    WHERE e.workflow_id = p_workflow_id
    GROUP BY e.state;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Update circuit breaker state
CREATE OR REPLACE FUNCTION public.claw_update_circuit_breaker(
    p_agent_id UUID,
    p_node_id TEXT,
    p_success BOOLEAN
)
RETURNS VOID AS $$
DECLARE
    v_threshold INTEGER := 5;  -- failures before opening
    v_timeout INTERVAL := '30 seconds';  -- timeout before half-open
BEGIN
    IF p_success THEN
        UPDATE public.claw_circuit_breakers
        SET 
            state = CASE 
                WHEN state = 'half-open' THEN 'closed'
                ELSE state 
            END,
            success_count = success_count + 1,
            failure_count = 0,
            last_success_at = now(),
            updated_at = now()
        WHERE agent_id = p_agent_id AND node_id = p_node_id;
    ELSE
        UPDATE public.claw_circuit_breakers
        SET 
            state = CASE 
                WHEN failure_count + 1 >= v_threshold THEN 'open'
                ELSE state 
            END,
            failure_count = failure_count + 1,
            last_failure_at = now(),
            next_attempt_at = CASE 
                WHEN failure_count + 1 >= v_threshold THEN now() + v_timeout
                ELSE next_attempt_at 
            END,
            updated_at = now()
        WHERE agent_id = p_agent_id AND node_id = p_node_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- COMPLETION
-- ============================================================================

COMMENT ON SCHEMA public IS 'ClawScheduler workflow orchestration schema';
