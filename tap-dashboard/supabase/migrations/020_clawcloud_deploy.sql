-- Migration 020: ClawCloud Deploy Infrastructure
-- Simple VPS-based deployment tracking (Pure WASM mode)

-- Deployment targets (VPS, local, etc)
CREATE TYPE deploy_target_type AS ENUM ('vps', 'local', 'docker', 'future_k8s');
CREATE TYPE deploy_status AS ENUM (
    'pending', 'building', 'deploying', 'running', 'stopped', 
    'failed', 'destroying', 'destroyed'
);

-- Deployments table
CREATE TABLE clawcloud_deployments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deployment_id TEXT NOT NULL UNIQUE,
    
    -- Ownership
    agent_id UUID NOT NULL,
    owner_public_key TEXT NOT NULL,
    
    -- What to deploy
    workflow_id UUID,
    task_type TEXT NOT NULL DEFAULT 'agent' CHECK (task_type IN ('agent', 'workflow', 'swarm')),
    
    -- Target configuration
    target_type deploy_target_type NOT NULL DEFAULT 'vps',
    target_host TEXT, -- IP or hostname
    target_port INTEGER DEFAULT 8080,
    target_user TEXT, -- SSH user for VPS
    target_key TEXT, -- SSH key reference (stored in ClawFS)
    
    -- Runtime configuration (Pure WASM)
    wasm_binary_cid TEXT, -- Reference to WASM binary in ClawFS
    wasm_config JSONB DEFAULT '{}',
    env_vars JSONB DEFAULT '{}',
    
    -- Resource allocation (from tier quotas)
    tier TEXT DEFAULT 'bronze',
    vcpu_count INTEGER DEFAULT 1,
    memory_mb INTEGER DEFAULT 1024,
    disk_mb INTEGER DEFAULT 32768,
    
    -- Status tracking
    status deploy_status NOT NULL DEFAULT 'pending',
    
    -- Timing
    started_at TIMESTAMPTZ,
    deployed_at TIMESTAMPTZ,
    stopped_at TIMESTAMPTZ,
    last_heartbeat TIMESTAMPTZ,
    
    -- Process tracking (for local mode)
    process_id INTEGER,
    pid_file TEXT,
    
    -- Logs
    deploy_log TEXT[],
    error_message TEXT,
    
    -- ClawBus integration
    bus_channel TEXT,
    session_id UUID,
    
    -- URLs
    public_url TEXT,
    health_check_url TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deployment logs
CREATE TABLE clawcloud_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deployment_id UUID NOT NULL,
    
    log_level TEXT NOT NULL DEFAULT 'info' CHECK (log_level IN ('debug', 'info', 'warn', 'error')),
    source TEXT, -- 'deploy', 'runtime', 'health'
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deployment metrics
CREATE TABLE clawcloud_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deployment_id UUID NOT NULL,
    
    -- Resource usage
    cpu_percent DECIMAL(5,2),
    memory_mb INTEGER,
    disk_mb INTEGER,
    
    -- Request metrics
    requests_total INTEGER DEFAULT 0,
    requests_2xx INTEGER DEFAULT 0,
    requests_4xx INTEGER DEFAULT 0,
    requests_5xx INTEGER DEFAULT 0,
    
    -- Latency
    response_time_ms INTEGER,
    
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_deployments_agent ON clawcloud_deployments(agent_id);
CREATE INDEX idx_deployments_status ON clawcloud_deployments(status);
CREATE INDEX idx_deployments_workflow ON clawcloud_deployments(workflow_id);
CREATE INDEX idx_cloud_logs_deployment ON clawcloud_logs(deployment_id);
CREATE INDEX idx_cloud_metrics_deployment ON clawcloud_metrics(deployment_id);

-- Functions
CREATE OR REPLACE FUNCTION generate_deployment_id()
RETURNS TEXT AS $$
BEGIN
    RETURN 'deploy-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 6);
END;
$$ LANGUAGE plpgsql;

-- Log deployment event
CREATE OR REPLACE FUNCTION log_deployment_event(
    p_deployment_id UUID,
    p_level TEXT,
    p_message TEXT,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO clawcloud_logs (deployment_id, log_level, message, metadata)
    VALUES (p_deployment_id, p_level, p_message, p_metadata)
    RETURNING id INTO log_id;
    
    -- Also append to deployment log array
    UPDATE clawcloud_deployments
    SET deploy_log = array_append(COALESCE(deploy_log, ARRAY[]::TEXT[]), 
        '[' || p_level || '] ' || p_message)
    WHERE id = p_deployment_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql;

-- Update deployment status
CREATE OR REPLACE FUNCTION update_deployment_status(
    p_deployment_id TEXT,
    p_status TEXT,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE clawcloud_deployments
    SET status = p_status::deploy_status,
        updated_at = NOW(),
        started_at = CASE WHEN p_status = 'running' AND started_at IS NULL THEN NOW() ELSE started_at END,
        deployed_at = CASE WHEN p_status = 'running' THEN NOW() ELSE deployed_at END,
        stopped_at = CASE WHEN p_status IN ('stopped', 'destroyed', 'failed') THEN NOW() ELSE stopped_at END
    WHERE deployment_id = p_deployment_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Get active deployments for agent
CREATE OR REPLACE FUNCTION get_active_deployments(p_agent_id UUID)
RETURNS TABLE (
    deployment_id TEXT,
    status TEXT,
    target_host TEXT,
    public_url TEXT,
    started_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.deployment_id,
        d.status::TEXT,
        d.target_host,
        d.public_url,
        d.started_at
    FROM clawcloud_deployments d
    WHERE d.agent_id = p_agent_id
      AND d.status IN ('pending', 'building', 'deploying', 'running')
    ORDER BY d.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Configuration
INSERT INTO wot_config (key, value, description) VALUES
    ('clawcloud_default_port', '8080', 'Default port for deployments'),
    ('clawcloud_health_check_interval', '30', 'Health check interval in seconds'),
    ('clawcloud_auto_restart', 'true', 'Auto-restart failed deployments'),
    ('clawcloud_max_deployments_per_agent', '5', 'Max concurrent deployments'),
    ('clawcloud_log_retention_days', '7', 'Deployment log retention')
ON CONFLICT (key) DO NOTHING;
