-- Migration 016: ClawBus Infrastructure
-- Agent-to-agent messaging, handoffs, and presence tracking

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- AGENT REGISTRY & PRESENCE
-- ============================================================================

CREATE TABLE IF NOT EXISTS clawbus_agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL UNIQUE REFERENCES user_agents(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    capabilities TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'offline' CHECK (status IN ('online', 'away', 'busy', 'offline')),
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    last_heartbeat TIMESTAMPTZ,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clawbus_agents_status ON clawbus_agents(status);
CREATE INDEX idx_clawbus_agents_last_seen ON clawbus_agents(last_seen);
CREATE INDEX idx_clawbus_agents_capabilities ON clawbus_agents USING GIN(capabilities);

-- ============================================================================
-- MESSAGE QUEUE
-- ============================================================================

CREATE TYPE message_priority AS ENUM ('low', 'normal', 'high', 'critical');
CREATE TYPE message_status AS ENUM ('pending', 'delivered', 'read', 'acknowledged', 'failed');

CREATE TABLE IF NOT EXISTS clawbus_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id TEXT NOT NULL UNIQUE,
    version TEXT NOT NULL DEFAULT '1.0',
    
    -- Routing
    from_agent TEXT NOT NULL REFERENCES user_agents(id),
    to_agent TEXT NOT NULL REFERENCES user_agents(id),
    reply_to_message_id TEXT,
    
    -- Content
    message_type TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}',
    
    -- Metadata
    priority message_priority NOT NULL DEFAULT 'normal',
    ttl_seconds INTEGER DEFAULT 300,
    
    -- Handoff context
    handoff_id TEXT,
    session_context JSONB DEFAULT '{}',
    
    -- Delivery tracking
    status message_status NOT NULL DEFAULT 'pending',
    delivered_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    failure_reason TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    
    -- Processing
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    processing_duration_ms INTEGER
);

CREATE INDEX idx_clawbus_messages_from ON clawbus_messages(from_agent);
CREATE INDEX idx_clawbus_messages_to ON clawbus_messages(to_agent);
CREATE INDEX idx_clawbus_messages_status ON clawbus_messages(status);
CREATE INDEX idx_clawbus_messages_handoff ON clawbus_messages(handoff_id);
CREATE INDEX idx_clawbus_messages_created_at ON clawbus_messages(created_at);
CREATE INDEX idx_clawbus_messages_type ON clawbus_messages(message_type);

-- Partial index for pending messages (fast queue lookup)
CREATE INDEX idx_clawbus_messages_pending ON clawbus_messages(to_agent, priority DESC, created_at) 
    WHERE status = 'pending';

-- ============================================================================
-- HANDOFF PROTOCOL
-- ============================================================================

CREATE TYPE handoff_stage AS ENUM ('request', 'accept', 'reject', 'transfer', 'complete', 'failed');

CREATE TABLE IF NOT EXISTS clawbus_handoffs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    handoff_id TEXT NOT NULL UNIQUE,
    stage handoff_stage NOT NULL DEFAULT 'request',
    
    -- Participants
    from_agent TEXT NOT NULL REFERENCES user_agents(id),
    to_agent TEXT NOT NULL REFERENCES user_agents(id),
    
    -- Context
    original_session_id TEXT,
    task_id TEXT,
    
    -- Payload
    context JSONB NOT NULL DEFAULT '{}',
    state JSONB DEFAULT '{}',
    reason TEXT,
    priority message_priority NOT NULL DEFAULT 'normal',
    
    -- Verification
    context_hash TEXT,
    state_hash TEXT,
    signature TEXT,
    
    -- Timing
    initiated_at TIMESTAMPTZ DEFAULT NOW(),
    accepted_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    transfer_started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    failed_at TIMESTAMPTZ,
    
    -- Result
    success BOOLEAN,
    result_payload JSONB,
    failure_reason TEXT,
    
    -- Dispute link
    dispute_id UUID REFERENCES dispute_cases(id),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clawbus_handoffs_from ON clawbus_handoffs(from_agent);
CREATE INDEX idx_clawbus_handoffs_to ON clawbus_handoffs(to_agent);
CREATE INDEX idx_clawbus_handoffs_stage ON clawbus_handoffs(stage);
CREATE INDEX idx_clawbus_handoffs_session ON clawbus_handoffs(original_session_id);
CREATE INDEX idx_clawbus_handoffs_task ON clawbus_handoffs(task_id);

-- ============================================================================
-- PUB/SUB CHANNELS
-- ============================================================================

CREATE TABLE IF NOT EXISTS clawbus_channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_name TEXT NOT NULL UNIQUE,
    description TEXT,
    channel_type TEXT NOT NULL DEFAULT 'broadcast' CHECK (channel_type IN ('broadcast', 'queue', 'topic')),
    created_by TEXT REFERENCES user_agents(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clawbus_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    channel_id UUID NOT NULL REFERENCES clawbus_channels(id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL REFERENCES user_agents(id) ON DELETE CASCADE,
    subscription_type TEXT NOT NULL DEFAULT 'push' CHECK (subscription_type IN ('push', 'pull')),
    filter_criteria JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(channel_id, agent_id)
);

CREATE INDEX idx_clawbus_subscriptions_channel ON clawbus_subscriptions(channel_id);
CREATE INDEX idx_clawbus_subscriptions_agent ON clawbus_subscriptions(agent_id);

-- ============================================================================
-- MESSAGE ACKNOWLEDGMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS clawbus_acknowledgments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES clawbus_messages(id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL REFERENCES user_agents(id),
    ack_type TEXT NOT NULL DEFAULT 'delivery' CHECK (ack_type IN ('delivery', 'read', 'processed')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(message_id, agent_id, ack_type)
);

CREATE INDEX idx_clawbus_acknowledgments_message ON clawbus_acknowledgments(message_id);
CREATE INDEX idx_clawbus_acknowledgments_agent ON clawbus_acknowledgments(agent_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Update timestamps
CREATE OR REPLACE FUNCTION update_clawbus_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_clawbus_agents_updated
    BEFORE UPDATE ON clawbus_agents
    FOR EACH ROW EXECUTE FUNCTION update_clawbus_timestamp();

CREATE TRIGGER trigger_clawbus_handoffs_updated
    BEFORE UPDATE ON clawbus_handoffs
    FOR EACH ROW EXECUTE FUNCTION update_clawbus_timestamp();

-- Expire old messages
CREATE OR REPLACE FUNCTION expire_clawbus_messages()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE clawbus_messages
    SET status = 'failed',
        failed_at = NOW(),
        failure_reason = 'TTL expired'
    WHERE status = 'pending'
      AND expires_at < NOW();
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Clean up old messages (run periodically)
CREATE OR REPLACE FUNCTION cleanup_clawbus_messages(
    older_than_days INTEGER DEFAULT 7
)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM clawbus_messages
    WHERE created_at < NOW() - INTERVAL '1 day' * older_than_days
      AND status IN ('acknowledged', 'failed');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Get pending messages for agent (queue pop)
CREATE OR REPLACE FUNCTION get_pending_messages(
    p_agent_id TEXT,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    message_id TEXT,
    from_agent TEXT,
    message_type TEXT,
    payload JSONB,
    priority message_priority,
    created_at TIMESTAMPTZ,
    handoff_id TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id,
        m.message_id,
        m.from_agent,
        m.message_type,
        m.payload,
        m.priority,
        m.created_at,
        m.handoff_id
    FROM clawbus_messages m
    WHERE m.to_agent = p_agent_id
      AND m.status = 'pending'
      AND (m.expires_at IS NULL OR m.expires_at > NOW())
    ORDER BY 
        CASE m.priority 
            WHEN 'critical' THEN 1 
            WHEN 'high' THEN 2 
            WHEN 'normal' THEN 3 
            ELSE 4 
        END,
        m.created_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Mark message delivered
CREATE OR REPLACE FUNCTION mark_message_delivered(
    p_message_id TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE clawbus_messages
    SET status = 'delivered',
        delivered_at = NOW()
    WHERE message_id = p_message_id
      AND status = 'pending';
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Mark message read
CREATE OR REPLACE FUNCTION mark_message_read(
    p_message_id TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE clawbus_messages
    SET status = 'read',
        read_at = NOW()
    WHERE message_id = p_message_id
      AND status IN ('pending', 'delivered');
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Update handoff stage with validation
CREATE OR REPLACE FUNCTION update_handoff_stage(
    p_handoff_id TEXT,
    p_new_stage handoff_stage,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS BOOLEAN AS $$
DECLARE
    current_stage handoff_stage;
    valid_transition BOOLEAN := FALSE;
BEGIN
    -- Get current stage
    SELECT stage INTO current_stage
    FROM clawbus_handoffs
    WHERE handoff_id = p_handoff_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Validate state transition
    valid_transition := CASE
        WHEN current_stage = 'request' AND p_new_stage IN ('accept', 'reject') THEN TRUE
        WHEN current_stage = 'accept' AND p_new_stage = 'transfer' THEN TRUE
        WHEN current_stage = 'transfer' AND p_new_stage IN ('complete', 'failed') THEN TRUE
        ELSE FALSE
    END;
    
    IF NOT valid_transition THEN
        RAISE EXCEPTION 'Invalid handoff transition from % to %', current_stage, p_new_stage;
    END IF;
    
    -- Update with timestamps
    UPDATE clawbus_handoffs
    SET stage = p_new_stage,
        updated_at = NOW(),
        context = context || p_metadata,
        accepted_at = CASE WHEN p_new_stage = 'accept' THEN NOW() ELSE accepted_at END,
        rejected_at = CASE WHEN p_new_stage = 'reject' THEN NOW() ELSE rejected_at END,
        transfer_started_at = CASE WHEN p_new_stage = 'transfer' THEN NOW() ELSE transfer_started_at END,
        completed_at = CASE WHEN p_new_stage = 'complete' THEN NOW() ELSE completed_at END,
        failed_at = CASE WHEN p_new_stage = 'failed' THEN NOW() ELSE failed_at END
    WHERE handoff_id = p_handoff_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE clawbus_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE clawbus_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE clawbus_handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE clawbus_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE clawbus_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE clawbus_acknowledgments ENABLE ROW LEVEL SECURITY;

-- Agents: readable by all, writable by system
CREATE POLICY clawbus_agents_select ON clawbus_agents
    FOR SELECT USING (TRUE);

-- Messages: readable by sender or recipient
CREATE POLICY clawbus_messages_select ON clawbus_messages
    FOR SELECT USING (
        from_agent = (SELECT agent_id FROM agents WHERE public_key = current_setting('app.current_user_public_key', TRUE))
        OR to_agent = (SELECT agent_id FROM agents WHERE public_key = current_setting('app.current_user_public_key', TRUE))
    );

-- Handoffs: readable by participants
CREATE POLICY clawbus_handoffs_select ON clawbus_handoffs
    FOR SELECT USING (
        from_agent = (SELECT agent_id FROM agents WHERE public_key = current_setting('app.current_user_public_key', TRUE))
        OR to_agent = (SELECT agent_id FROM agents WHERE public_key = current_setting('app.current_user_public_key', TRUE))
    );

-- Channels: readable by subscribers
CREATE POLICY clawbus_channels_select ON clawbus_channels
    FOR SELECT USING (TRUE);

-- ============================================================================
-- CONFIGURATION
-- ============================================================================

INSERT INTO wot_config (key, value, description) VALUES
    ('clawbus_message_ttl_default', '300', 'Default message TTL in seconds'),
    ('clawbus_max_pending_messages', '1000', 'Max pending messages per agent'),
    ('clawbus_cleanup_interval_hours', '24', 'Message cleanup interval'),
    ('clawbus_presence_timeout_seconds', '60', 'Agent offline after this many seconds without heartbeat')
ON CONFLICT (key) DO NOTHING;
