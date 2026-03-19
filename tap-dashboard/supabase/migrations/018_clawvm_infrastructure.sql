-- Migration 018: ClawVM Infrastructure
-- Hardware-isolated agent runtime with Firecracker microVMs

-- ============================================================================
-- VM INSTANCES
-- ============================================================================

CREATE TYPE vm_state AS ENUM (
    'creating', 'starting', 'running', 'pausing', 'paused', 
    'resuming', 'stopping', 'stopped', 'destroying', 'destroyed', 'error'
);

CREATE TYPE resource_tier AS ENUM ('genesis', 'titanium', 'platinum', 'gold', 'silver', 'bronze');

CREATE TABLE IF NOT EXISTS clawvm_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vm_id TEXT NOT NULL UNIQUE,
    
    -- Ownership
    agent_id TEXT NOT NULL REFERENCES user_agents(id),
    owner_public_key TEXT NOT NULL,
    
    -- Resource tier (reputation-weighted)
    tier resource_tier NOT NULL DEFAULT 'bronze',
    
    -- Resources allocated
    vcpu_count INTEGER NOT NULL,
    memory_mb INTEGER NOT NULL,
    disk_mb INTEGER NOT NULL,
    
    -- Firecracker configuration
    kernel_image_path TEXT,
    rootfs_path TEXT,
    socket_path TEXT,
    log_path TEXT,
    
    -- Network
    tap_device TEXT,
    ip_address INET,
    mac_address MACADDR,
    
    -- State
    state vm_state NOT NULL DEFAULT 'creating',
    pid INTEGER,
    
    -- Boot/shutdown timing
    booted_at TIMESTAMPTZ,
    shutdown_at TIMESTAMPTZ,
    last_heartbeat TIMESTAMPTZ,
    
    -- Error tracking
    error_message TEXT,
    error_count INTEGER DEFAULT 0,
    last_error_at TIMESTAMPTZ,
    
    -- Metadata
    env_vars JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    
    -- Resource usage (updated by metrics collector)
    cpu_usage_percent DECIMAL(5,2),
    memory_usage_mb INTEGER,
    disk_usage_mb INTEGER,
    network_rx_bytes BIGINT DEFAULT 0,
    network_tx_bytes BIGINT DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clawvm_instances_agent ON clawvm_instances(agent_id);
CREATE INDEX idx_clawvm_instances_state ON clawvm_instances(state);
CREATE INDEX idx_clawvm_instances_tier ON clawvm_instances(tier);
CREATE INDEX idx_clawvm_instances_heartbeat ON clawvm_instances(last_heartbeat);

-- ============================================================================
-- VM SNAPSHOTS (For checkpoint/restore)
-- ============================================================================

CREATE TYPE snapshot_state AS ENUM ('creating', 'ready', 'restoring', 'failed', 'deleted');

CREATE TABLE IF NOT EXISTS clawvm_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    snapshot_id TEXT NOT NULL UNIQUE,
    vm_id UUID NOT NULL REFERENCES clawvm_instances(id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL REFERENCES user_agents(id),
    
    -- Snapshot metadata
    name TEXT,
    description TEXT,
    
    -- State
    state snapshot_state NOT NULL DEFAULT 'creating',
    
    -- File paths
    mem_file_path TEXT,
    vmstate_file_path TEXT,
    disk_snapshot_path TEXT,
    
    -- Size tracking
    mem_file_size_bytes BIGINT,
    disk_snapshot_size_bytes BIGINT,
    
    -- Snapshot context
    snapshot_type TEXT DEFAULT 'manual' CHECK (snapshot_type IN ('manual', 'auto', 'pre_migration', 'pre_shutdown')),
    triggered_by TEXT,
    
    -- ClawFS integration
    root_cid TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ
);

CREATE INDEX idx_clawvm_snapshots_vm ON clawvm_snapshots(vm_id);
CREATE INDEX idx_clawvm_snapshots_agent ON clawvm_snapshots(agent_id);
CREATE INDEX idx_clawvm_snapshots_state ON clawvm_snapshots(state);

-- ============================================================================
-- VM METRICS (Time-series data)
-- ============================================================================

CREATE TABLE IF NOT EXISTS clawvm_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vm_id UUID NOT NULL REFERENCES clawvm_instances(id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL REFERENCES user_agents(id),
    
    -- CPU metrics
    cpu_usage_percent DECIMAL(5,2),
    cpu_user_time_ms BIGINT,
    cpu_system_time_ms BIGINT,
    
    -- Memory metrics
    memory_used_mb INTEGER,
    memory_available_mb INTEGER,
    memory_swap_used_mb INTEGER,
    
    -- Disk metrics
    disk_read_bytes BIGINT,
    disk_write_bytes BIGINT,
    disk_read_iops INTEGER,
    disk_write_iops INTEGER,
    
    -- Network metrics
    network_rx_bytes BIGINT,
    network_tx_bytes BIGINT,
    network_rx_packets BIGINT,
    network_tx_packets BIGINT,
    network_rx_dropped BIGINT,
    network_tx_dropped BIGINT,
    
    -- Process metrics
    process_count INTEGER,
    thread_count INTEGER,
    open_file_descriptors INTEGER,
    
    -- Timestamp (for time-series queries)
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clawvm_metrics_vm ON clawvm_metrics(vm_id);
CREATE INDEX idx_clawvm_metrics_recorded ON clawvm_metrics(recorded_at);
CREATE INDEX idx_clawvm_metrics_vm_time ON clawvm_metrics(vm_id, recorded_at DESC);

-- Partition by time (optional, for production scale)
-- Note: Requires pg_partman or manual partitioning setup

-- ============================================================================
-- VM LOGS
-- ============================================================================

CREATE TYPE vm_log_level AS ENUM ('debug', 'info', 'warn', 'error', 'fatal');

CREATE TABLE IF NOT EXISTS clawvm_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vm_id UUID NOT NULL REFERENCES clawvm_instances(id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL REFERENCES user_agents(id),
    
    log_level vm_log_level NOT NULL DEFAULT 'info',
    source TEXT, -- e.g., 'kernel', 'agent', 'firecracker'
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clawvm_logs_vm ON clawvm_logs(vm_id);
CREATE INDEX idx_clawvm_logs_level ON clawvm_logs(log_level);
CREATE INDEX idx_clawvm_logs_created ON clawvm_logs(created_at);

-- ============================================================================
-- RESOURCE QUOTAS (Per-tier limits)
-- ============================================================================

CREATE TABLE IF NOT EXISTS clawvm_tier_quotas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tier resource_tier NOT NULL UNIQUE,
    
    -- Resource limits
    max_vcpu INTEGER NOT NULL,
    max_memory_mb INTEGER NOT NULL,
    max_disk_mb INTEGER NOT NULL,
    max_network_mbps INTEGER,
    
    -- Concurrency limits
    max_concurrent_vms INTEGER DEFAULT 1,
    max_snapshots INTEGER DEFAULT 5,
    
    -- Runtime limits
    max_uptime_hours INTEGER,
    max_snapshot_size_mb INTEGER,
    
    -- Requirements
    min_tap_score DECIMAL(10,6),
    required_tier TEXT[], -- e.g., ['genesis', 'titanium'] for titanium tier
    
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default quotas
INSERT INTO clawvm_tier_quotas (tier, max_vcpu, max_memory_mb, max_disk_mb, max_network_mbps, max_concurrent_vms, max_snapshots, max_uptime_hours, min_tap_score) VALUES
    ('genesis', 8, 32768, 1048576, 10000, 10, 50, NULL, 0.950000),
    ('titanium', 4, 16384, 524288, 5000, 5, 20, NULL, 0.800000),
    ('platinum', 2, 8192, 262144, 2000, 3, 10, NULL, 0.600000),
    ('gold', 2, 4096, 131072, 1000, 2, 5, 168, 0.400000),
    ('silver', 1, 2048, 65536, 500, 1, 3, 72, 0.200000),
    ('bronze', 1, 1024, 32768, 100, 1, 2, 24, 0.000000)
ON CONFLICT (tier) DO NOTHING;

-- ============================================================================
-- VM EXECUTIONS (Link to Scheduler)
-- ============================================================================

-- This table links VM instances to workflow node executions
CREATE TABLE IF NOT EXISTS clawvm_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vm_id UUID NOT NULL REFERENCES clawvm_instances(id),
    agent_id TEXT NOT NULL REFERENCES user_agents(id),
    
    -- Link to scheduler
    execution_id UUID REFERENCES claw_workflow_executions(id),
    node_execution_id UUID REFERENCES claw_node_executions(id),
    
    -- Task info
    task_type TEXT,
    task_payload JSONB DEFAULT '{}',
    
    -- Execution state
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    exit_code INTEGER,
    
    -- Results
    output TEXT,
    output_cid TEXT, -- ClawFS reference for large outputs
    
    -- Error tracking
    error_message TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clawvm_executions_vm ON clawvm_executions(vm_id);
CREATE INDEX idx_clawvm_executions_execution ON clawvm_executions(execution_id);
CREATE INDEX idx_clawvm_executions_node ON clawvm_executions(node_execution_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Update timestamps
CREATE OR REPLACE FUNCTION update_clawvm_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_clawvm_instances_updated
    BEFORE UPDATE ON clawvm_instances
    FOR EACH ROW EXECUTE FUNCTION update_clawvm_timestamp();

CREATE TRIGGER trigger_clawvm_tier_quotas_updated
    BEFORE UPDATE ON clawvm_tier_quotas
    FOR EACH ROW EXECUTE FUNCTION update_clawvm_timestamp();

-- Get available tier for agent based on TAP score
CREATE OR REPLACE FUNCTION get_agent_vm_tier(p_agent_id TEXT)
RETURNS resource_tier AS $$
DECLARE
    agent_tap DECIMAL(10,6);
    best_tier resource_tier;
BEGIN
    -- Get agent's TAP score
    SELECT overall_trust_score INTO agent_tap
    FROM tap_scores
    WHERE agent_id = p_agent_id;
    
    IF agent_tap IS NULL THEN
        agent_tap := 0;
    END IF;
    
    -- Find best tier they qualify for
    SELECT tier INTO best_tier
    FROM clawvm_tier_quotas
    WHERE min_tap_score <= agent_tap
    ORDER BY min_tap_score DESC
    LIMIT 1;
    
    RETURN COALESCE(best_tier, 'bronze');
END;
$$ LANGUAGE plpgsql;

-- Check if agent can spawn new VM
CREATE OR REPLACE FUNCTION can_spawn_vm(p_agent_id TEXT)
RETURNS TABLE (
    allowed BOOLEAN,
    current_vms INTEGER,
    max_vms INTEGER,
    reason TEXT
) AS $$
DECLARE
    agent_tier resource_tier;
    current_count INTEGER;
    max_allowed INTEGER;
BEGIN
    -- Get agent's tier
    agent_tier := get_agent_vm_tier(p_agent_id);
    
    -- Get current VM count for agent
    SELECT COUNT(*) INTO current_count
    FROM clawvm_instances
    WHERE agent_id = p_agent_id
      AND state NOT IN ('destroying', 'destroyed', 'error');
    
    -- Get max allowed for tier
    SELECT max_concurrent_vms INTO max_allowed
    FROM clawvm_tier_quotas
    WHERE tier = agent_tier;
    
    RETURN QUERY SELECT 
        current_count < max_allowed,
        current_count,
        max_allowed,
        CASE 
            WHEN current_count >= max_allowed THEN 'VM limit reached for tier'
            ELSE NULL
        END;
END;
$$ LANGUAGE plpgsql;

-- Record VM heartbeat
CREATE OR REPLACE FUNCTION record_vm_heartbeat(
    p_vm_id TEXT,
    p_metrics JSONB DEFAULT '{}'
)
RETURNS BOOLEAN AS $$
DECLARE
    vm_uuid UUID;
BEGIN
    -- Get VM UUID from vm_id
    SELECT id INTO vm_uuid
    FROM clawvm_instances
    WHERE vm_id = p_vm_id;
    
    IF vm_uuid IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Update heartbeat and metrics
    UPDATE clawvm_instances
    SET last_heartbeat = NOW(),
        cpu_usage_percent = (p_metrics->>'cpu_usage_percent')::DECIMAL(5,2),
        memory_usage_mb = (p_metrics->>'memory_usage_mb')::INTEGER,
        disk_usage_mb = (p_metrics->>'disk_usage_mb')::INTEGER,
        network_rx_bytes = COALESCE(network_rx_bytes, 0) + COALESCE((p_metrics->>'network_rx_bytes')::BIGINT, 0),
        network_tx_bytes = COALESCE(network_tx_bytes, 0) + COALESCE((p_metrics->>'network_tx_bytes')::BIGINT, 0)
    WHERE id = vm_uuid;
    
    -- Insert metrics record
    INSERT INTO clawvm_metrics (
        vm_id,
        agent_id,
        cpu_usage_percent,
        memory_used_mb,
        disk_read_bytes,
        disk_write_bytes,
        network_rx_bytes,
        network_tx_bytes
    )
    SELECT 
        id,
        agent_id,
        (p_metrics->>'cpu_usage_percent')::DECIMAL(5,2),
        (p_metrics->>'memory_usage_mb')::INTEGER,
        (p_metrics->>'disk_read_bytes')::BIGINT,
        (p_metrics->>'disk_write_bytes')::BIGINT,
        (p_metrics->>'network_rx_bytes')::BIGINT,
        (p_metrics->>'network_tx_bytes')::BIGINT
    FROM clawvm_instances
    WHERE id = vm_uuid;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Cleanup stale VMs (heartbeat timeout)
CREATE OR REPLACE FUNCTION cleanup_stale_vms(
    p_timeout_seconds INTEGER DEFAULT 120
)
RETURNS INTEGER AS $$
DECLARE
    stale_count INTEGER;
BEGIN
    UPDATE clawvm_instances
    SET state = 'error',
        error_message = 'Heartbeat timeout',
        error_count = error_count + 1,
        last_error_at = NOW()
    WHERE state = 'running'
      AND last_heartbeat < NOW() - INTERVAL '1 second' * p_timeout_seconds;
    
    GET DIAGNOSTICS stale_count = ROW_COUNT;
    RETURN stale_count;
END;
$$ LANGUAGE plpgsql;

-- Create VM snapshot record
CREATE OR REPLACE FUNCTION create_vm_snapshot(
    p_vm_id TEXT,
    p_name TEXT,
    p_description TEXT,
    p_snapshot_type TEXT DEFAULT 'manual'
)
RETURNS TEXT AS $$
DECLARE
    new_snapshot_id TEXT;
    vm_uuid UUID;
    agent_uuid TEXT;
BEGIN
    -- Get VM info
    SELECT id, agent_id INTO vm_uuid, agent_uuid
    FROM clawvm_instances
    WHERE vm_id = p_vm_id;
    
    IF vm_uuid IS NULL THEN
        RETURN NULL;
    END IF;
    
    -- Generate snapshot ID
    new_snapshot_id := 'snap-' || extract(epoch from now())::bigint || '-' || substr(md5(random()::text), 1, 8);
    
    -- Insert snapshot record
    INSERT INTO clawvm_snapshots (
        snapshot_id,
        vm_id,
        agent_id,
        name,
        description,
        snapshot_type,
        triggered_by
    ) VALUES (
        new_snapshot_id,
        vm_uuid,
        agent_uuid,
        p_name,
        p_description,
        p_snapshot_type,
        agent_uuid
    );
    
    RETURN new_snapshot_id;
END;
$$ LANGUAGE plpgsql;

-- Cleanup old snapshots
CREATE OR REPLACE FUNCTION cleanup_old_snapshots(
    p_older_than_days INTEGER DEFAULT 7
)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    UPDATE clawvm_snapshots
    SET state = 'deleted'
    WHERE state = 'ready'
      AND created_at < NOW() - INTERVAL '1 day' * p_older_than_days
      AND snapshot_type = 'auto';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE clawvm_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE clawvm_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE clawvm_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE clawvm_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE clawvm_executions ENABLE ROW LEVEL SECURITY;

-- VMs: readable by owner
CREATE POLICY clawvm_instances_select ON clawvm_instances
    FOR SELECT USING (
        agent_id = (SELECT agent_id FROM agents WHERE public_key = current_setting('app.current_user_public_key', TRUE))
    );

-- Snapshots: readable by owner
CREATE POLICY clawvm_snapshots_select ON clawvm_snapshots
    FOR SELECT USING (
        agent_id = (SELECT agent_id FROM agents WHERE public_key = current_setting('app.current_user_public_key', TRUE))
    );

-- Metrics: readable by owner
CREATE POLICY clawvm_metrics_select ON clawvm_metrics
    FOR SELECT USING (
        agent_id = (SELECT agent_id FROM agents WHERE public_key = current_setting('app.current_user_public_key', TRUE))
    );

-- Logs: readable by owner
CREATE POLICY clawvm_logs_select ON clawvm_logs
    FOR SELECT USING (
        agent_id = (SELECT agent_id FROM agents WHERE public_key = current_setting('app.current_user_public_key', TRUE))
    );

-- Tier quotas: readable by all
CREATE POLICY clawvm_tier_quotas_select ON clawvm_tier_quotas FOR SELECT USING (TRUE);

-- ============================================================================
-- CONFIGURATION
-- ============================================================================

INSERT INTO wot_config (key, value, description) VALUES
    ('clawvm_heartbeat_interval_seconds', '30', 'Expected heartbeat interval'),
    ('clawvm_stale_timeout_seconds', '120', 'Mark VM as error after this many seconds without heartbeat'),
    ('clawvm_auto_snapshot_interval_minutes', '60', 'Auto-snapshot running VMs every N minutes'),
    ('clawvm_max_log_age_days', '7', 'Auto-cleanup VM logs after N days'),
    ('clawvm_metrics_retention_days', '30', 'Retain VM metrics for N days'),
    ('clawvm_firecracker_socket_dir', '/tmp/clawvm', 'Firecracker socket directory'),
    ('clawvm_kernel_path', '/opt/clawvm/vmlinux', 'Default kernel path'),
    ('clawvm_rootfs_path', '/opt/clawvm/rootfs.ext4', 'Default rootfs path')
ON CONFLICT (key) DO NOTHING;
