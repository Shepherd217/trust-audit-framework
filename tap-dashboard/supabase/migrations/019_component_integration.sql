-- Migration 019: Component Integration Links
-- Connect ClawBus, ClawScheduler, and ClawVM into unified system

-- ============================================================================
-- BUS → SCHEDULER LINKS
-- ============================================================================

-- Link messages to workflow executions
CREATE TABLE IF NOT EXISTS clawbus_execution_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Bus side
    message_id UUID REFERENCES clawbus_messages(id),
    handoff_id UUID REFERENCES clawbus_handoffs(id),
    
    -- Scheduler side
    execution_id UUID REFERENCES claw_workflow_executions(id),
    node_execution_id UUID REFERENCES claw_node_executions(id),
    
    -- Link type
    link_type TEXT NOT NULL CHECK (link_type IN ('trigger', 'notification', 'result', 'handoff')),
    
    -- Status
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_bus_exec_links_message ON clawbus_execution_links(message_id);
CREATE INDEX idx_bus_exec_links_handoff ON clawbus_execution_links(handoff_id);
CREATE INDEX idx_bus_exec_links_execution ON clawbus_execution_links(execution_id);
CREATE INDEX idx_bus_exec_links_node ON clawbus_execution_links(node_execution_id);

-- ============================================================================
-- SCHEDULER → VM LINKS
-- ============================================================================

-- Link node executions to VM executions
CREATE TABLE IF NOT EXISTS clawscheduler_vm_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Scheduler side
    execution_id UUID NOT NULL REFERENCES claw_workflow_executions(id),
    node_execution_id UUID NOT NULL REFERENCES claw_node_executions(id),
    
    -- VM side
    vm_id UUID REFERENCES clawvm_instances(id),
    vm_execution_id UUID REFERENCES clawvm_executions(id),
    
    -- Assignment
    assigned_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    -- Result
    success BOOLEAN,
    output_cid TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scheduler_vm_links_execution ON clawscheduler_vm_links(execution_id);
CREATE INDEX idx_scheduler_vm_links_node ON clawscheduler_vm_links(node_execution_id);
CREATE INDEX idx_scheduler_vm_links_vm ON clawscheduler_vm_links(vm_id);

-- ============================================================================
-- VM → CLAWFS LINKS
-- ============================================================================

-- Track VM filesystem state in ClawFS
CREATE TABLE IF NOT EXISTS clawvm_clawfs_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- VM side
    vm_id UUID NOT NULL REFERENCES clawvm_instances(id) ON DELETE CASCADE,
    snapshot_id UUID REFERENCES clawvm_snapshots(id),
    
    -- ClawFS side
    file_id UUID REFERENCES clawfs_files(id),
    snapshot_cid TEXT,
    
    -- Link metadata
    mount_path TEXT,
    sync_status TEXT DEFAULT 'pending' CHECK (sync_status IN ('pending', 'syncing', 'synced', 'error')),
    
    synced_at TIMESTAMPTZ,
    error_message TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vm_clawfs_links_vm ON clawvm_clawfs_links(vm_id);
CREATE INDEX idx_vm_clawfs_links_file ON clawvm_clawfs_links(file_id);
CREATE INDEX idx_vm_clawfs_links_status ON clawvm_clawfs_links(sync_status);

-- ============================================================================
-- HANDOFF → DISPUTE LINKS
-- ============================================================================

-- Link failed handoffs to dispute system
CREATE TABLE IF NOT EXISTS clawhandoff_dispute_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Handoff side
    handoff_id UUID NOT NULL REFERENCES clawbus_handoffs(id),
    
    -- Dispute side
    dispute_id UUID REFERENCES dispute_cases(id),
    
    -- Link reason
    link_reason TEXT NOT NULL CHECK (link_reason IN ('timeout', 'rejection', 'verification_failure', 'manual')),
    
    -- Evidence
    evidence_cid TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_handoff_dispute_links_handoff ON clawhandoff_dispute_links(handoff_id);
CREATE INDEX idx_handoff_dispute_links_dispute ON clawhandoff_dispute_links(dispute_id);

-- ============================================================================
-- EXECUTION → MARKETPLACE LINKS
-- ============================================================================

-- Link workflow executions to marketplace contracts/jobs
CREATE TABLE IF NOT EXISTS clawexecution_marketplace_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Execution side
    execution_id UUID NOT NULL REFERENCES claw_workflow_executions(id),
    node_execution_id UUID REFERENCES claw_node_executions(id),
    
    -- Marketplace side
    job_id UUID REFERENCES marketplace_jobs(id),
    contract_id UUID REFERENCES marketplace_contracts(id),
    escrow_id UUID REFERENCES payment_escrows(id),
    
    -- Link context
    link_type TEXT NOT NULL CHECK (link_type IN ('job_delivery', 'milestone_work', 'dispute_evidence', 'review')),
    
    -- Status
    verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_exec_market_links_execution ON clawexecution_marketplace_links(execution_id);
CREATE INDEX idx_exec_market_links_job ON clawexecution_marketplace_links(job_id);
CREATE INDEX idx_exec_market_links_contract ON clawexecution_marketplace_links(contract_id);

-- ============================================================================
-- AGENT SESSIONS (Runtime state)
-- ============================================================================

-- Track agent runtime sessions across components
CREATE TABLE IF NOT EXISTS claw_agent_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id TEXT NOT NULL UNIQUE,
    agent_id TEXT NOT NULL REFERENCES user_agents(id),
    
    -- Session boundaries
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    
    -- Component states
    bus_connected BOOLEAN DEFAULT FALSE,
    bus_connected_at TIMESTAMPTZ,
    
    current_execution_id UUID REFERENCES claw_workflow_executions(id),
    current_vm_id UUID REFERENCES clawvm_instances(id),
    
    -- Session context
    context JSONB DEFAULT '{}',
    
    -- Metadata
    ip_address INET,
    user_agent TEXT,
    
    last_activity_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_sessions_agent ON claw_agent_sessions(agent_id);
CREATE INDEX idx_agent_sessions_started ON claw_agent_sessions(started_at);
CREATE INDEX idx_agent_sessions_activity ON claw_agent_sessions(last_activity_at);

-- ============================================================================
-- SYSTEM EVENTS (Cross-component audit)
-- ============================================================================

CREATE TYPE system_event_type AS ENUM (
    'agent_online', 'agent_offline', 'agent_heartbeat_missed',
    'workflow_started', 'workflow_completed', 'workflow_failed',
    'vm_spawned', 'vm_destroyed', 'vm_crashed',
    'handoff_initiated', 'handoff_completed', 'handoff_failed',
    'escrow_funded', 'escrow_released', 'escrow_disputed',
    'dispute_filed', 'dispute_resolved',
    'checkpoint_created', 'checkpoint_restored',
    'snapshot_created', 'snapshot_restored'
);

CREATE TABLE IF NOT EXISTS claw_system_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type system_event_type NOT NULL,
    
    -- Actor
    agent_id TEXT REFERENCES user_agents(id),
    
    -- Component references
    execution_id UUID REFERENCES claw_workflow_executions(id),
    vm_id UUID REFERENCES clawvm_instances(id),
    handoff_id UUID REFERENCES clawbus_handoffs(id),
    dispute_id UUID REFERENCES dispute_cases(id),
    escrow_id UUID REFERENCES payment_escrows(id),
    
    -- Event data
    payload JSONB DEFAULT '{}',
    severity TEXT DEFAULT 'info' CHECK (severity IN ('debug', 'info', 'warn', 'error', 'critical')),
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_system_events_type ON claw_system_events(event_type);
CREATE INDEX idx_system_events_agent ON claw_system_events(agent_id);
CREATE INDEX idx_system_events_created ON claw_system_events(created_at);

-- ============================================================================
-- COMPONENT HEALTH
-- ============================================================================

CREATE TABLE IF NOT EXISTS claw_component_health (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    component_name TEXT NOT NULL UNIQUE,
    component_type TEXT NOT NULL CHECK (component_type IN ('bus', 'scheduler', 'vm', 'fs', 'payments', 'disputes')),
    
    -- Health status
    status TEXT NOT NULL DEFAULT 'unknown' CHECK (status IN ('healthy', 'degraded', 'unhealthy', 'unknown')),
    
    -- Metrics
    last_check_at TIMESTAMPTZ,
    response_time_ms INTEGER,
    error_rate DECIMAL(5,4),
    
    -- Details
    check_output JSONB DEFAULT '{}',
    error_message TEXT,
    
    -- Alerting
    alert_sent BOOLEAN DEFAULT FALSE,
    alert_sent_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert initial health records
INSERT INTO claw_component_health (component_name, component_type, status) VALUES
    ('clawbus', 'bus', 'unknown'),
    ('clawscheduler', 'scheduler', 'unknown'),
    ('clawvm', 'vm', 'unknown'),
    ('clawfs', 'fs', 'unknown'),
    ('payments', 'payments', 'unknown'),
    ('arbitra', 'disputes', 'unknown')
ON CONFLICT (component_name) DO NOTHING;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Record system event
CREATE OR REPLACE FUNCTION record_system_event(
    p_event_type system_event_type,
    p_agent_id TEXT DEFAULT NULL,
    p_payload JSONB DEFAULT '{}',
    p_severity TEXT DEFAULT 'info'
)
RETURNS UUID AS $$
DECLARE
    event_id UUID;
BEGIN
    INSERT INTO claw_system_events (
        event_type,
        agent_id,
        payload,
        severity
    ) VALUES (
        p_event_type,
        p_agent_id,
        p_payload,
        p_severity
    )
    RETURNING id INTO event_id;
    
    RETURN event_id;
END;
$$ LANGUAGE plpgsql;

-- Start agent session
CREATE OR REPLACE FUNCTION start_agent_session(
    p_agent_id TEXT,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
    new_session_id TEXT;
BEGIN
    new_session_id := 'sess-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 8);
    
    INSERT INTO claw_agent_sessions (
        session_id,
        agent_id,
        ip_address,
        user_agent
    ) VALUES (
        new_session_id,
        p_agent_id,
        p_ip_address,
        p_user_agent
    );
    
    -- Record event
    PERFORM record_system_event('agent_online', p_agent_id, jsonb_build_object('session_id', new_session_id));
    
    RETURN new_session_id;
END;
$$ LANGUAGE plpgsql;

-- End agent session
CREATE OR REPLACE FUNCTION end_agent_session(
    p_session_id TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    session_record RECORD;
BEGIN
    SELECT * INTO session_record
    FROM claw_agent_sessions
    WHERE session_id = p_session_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    UPDATE claw_agent_sessions
    SET ended_at = NOW()
    WHERE session_id = p_session_id;
    
    -- Record event
    PERFORM record_system_event('agent_offline', session_record.agent_id, jsonb_build_object('session_id', p_session_id));
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Link message to execution
CREATE OR REPLACE FUNCTION link_message_to_execution(
    p_message_id UUID,
    p_execution_id UUID,
    p_link_type TEXT DEFAULT 'trigger'
)
RETURNS UUID AS $$
DECLARE
    link_id UUID;
BEGIN
    INSERT INTO clawbus_execution_links (
        message_id,
        execution_id,
        link_type
    ) VALUES (
        p_message_id,
        p_execution_id,
        p_link_type
    )
    RETURNING id INTO link_id;
    
    RETURN link_id;
END;
$$ LANGUAGE plpgsql;

-- Link handoff to dispute
CREATE OR REPLACE FUNCTION link_handoff_to_dispute(
    p_handoff_id UUID,
    p_dispute_id UUID,
    p_reason TEXT DEFAULT 'verification_failure'
)
RETURNS UUID AS $$
DECLARE
    link_id UUID;
BEGIN
    INSERT INTO clawhandoff_dispute_links (
        handoff_id,
        dispute_id,
        link_reason
    ) VALUES (
        p_handoff_id,
        p_dispute_id,
        p_reason
    )
    RETURNING id INTO link_id;
    
    RETURN link_id;
END;
$$ LANGUAGE plpgsql;

-- Update component health
CREATE OR REPLACE FUNCTION update_component_health(
    p_component_name TEXT,
    p_status TEXT,
    p_response_time_ms INTEGER DEFAULT NULL,
    p_error_rate DECIMAL DEFAULT NULL,
    p_check_output JSONB DEFAULT '{}'
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE claw_component_health
    SET status = p_status,
        last_check_at = NOW(),
        response_time_ms = p_response_time_ms,
        error_rate = p_error_rate,
        check_output = p_check_output,
        updated_at = NOW()
    WHERE component_name = p_component_name;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Get agent's active components
CREATE OR REPLACE FUNCTION get_agent_active_components(p_agent_id TEXT)
RETURNS TABLE (
    component TEXT,
    component_id UUID,
    status TEXT,
    started_at TIMESTAMPTZ
) AS $$
BEGIN
    -- Active session
    RETURN QUERY
    SELECT 
        'session'::TEXT as component,
        s.id as component_id,
        CASE WHEN s.ended_at IS NULL THEN 'active' ELSE 'ended' END as status,
        s.started_at
    FROM claw_agent_sessions s
    WHERE s.agent_id = p_agent_id
      AND s.ended_at IS NULL;
    
    -- Active VM
    RETURN QUERY
    SELECT 
        'vm'::TEXT as component,
        vm.id as component_id,
        vm.state::TEXT as status,
        vm.booted_at as started_at
    FROM clawvm_instances vm
    WHERE vm.agent_id = p_agent_id
      AND vm.state NOT IN ('destroyed', 'error');
    
    -- Active execution
    RETURN QUERY
    SELECT 
        'execution'::TEXT as component,
        e.id as component_id,
        e.status::TEXT as status,
        e.started_at
    FROM claw_workflow_executions e
    JOIN claw_workflows w ON e.workflow_id = w.id
    WHERE w.owner_agent_id = p_agent_id
      AND e.status IN ('pending', 'running', 'paused', 'retrying');
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE claw_agent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE claw_system_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE claw_component_health ENABLE ROW LEVEL SECURITY;

-- Agent sessions: readable by owner
CREATE POLICY claw_agent_sessions_select ON claw_agent_sessions
    FOR SELECT USING (
        agent_id = (SELECT agent_id FROM agents WHERE public_key = current_setting('app.current_user_public_key', TRUE))
    );

-- System events: readable by referenced agent or all
CREATE POLICY claw_system_events_select ON claw_system_events
    FOR SELECT USING (
        agent_id IS NULL 
        OR agent_id = (SELECT agent_id FROM agents WHERE public_key = current_setting('app.current_user_public_key', TRUE))
    );

-- Component health: readable by all
CREATE POLICY claw_component_health_select ON claw_component_health FOR SELECT USING (TRUE);

-- ============================================================================
-- CONFIGURATION
-- ============================================================================

INSERT INTO wot_config (key, value, description) VALUES
    ('integration_session_timeout_minutes', '60', 'Agent session timeout'),
    ('integration_event_retention_days', '30', 'System event retention'),
    ('integration_health_check_interval_seconds', '60', 'Component health check interval'),
    ('integration_auto_link_handoff_dispute', 'true', 'Auto-link failed handoffs to disputes')
ON CONFLICT (key) DO NOTHING;
