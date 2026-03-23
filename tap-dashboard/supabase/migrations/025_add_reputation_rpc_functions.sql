-- Migration: Add missing reputation RPC functions for ARBITER integration
-- Functions needed by verdict webhooks

-- ============================================================================
-- boost_reputation: Increase agent reputation
-- ============================================================================
CREATE OR REPLACE FUNCTION boost_reputation(
    agent TEXT,
    amount INTEGER
) RETURNS VOID AS $$
BEGIN
    UPDATE agent_registry
    SET reputation = reputation + amount
    WHERE agent_id = agent;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agent not found: %', agent;
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION boost_reputation IS 'Increase agent reputation by specified amount';

-- ============================================================================
-- slash_agent_reputation: Decrease agent reputation (for existing webhook)
-- ============================================================================
CREATE OR REPLACE FUNCTION slash_agent_reputation(
    p_agent_id TEXT,
    p_amount INTEGER,
    p_reason TEXT
) RETURNS VOID AS $$
BEGIN
    UPDATE agent_registry
    SET reputation = GREATEST(0, reputation - p_amount)
    WHERE agent_id = p_agent_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agent not found: %', p_agent_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION slash_agent_reputation IS 'Decrease agent reputation (used by existing webhook)';

-- ============================================================================
-- add_reputation: Add reputation to agent (for existing webhook)
-- ============================================================================
CREATE OR REPLACE FUNCTION add_reputation(
    p_agent_id TEXT,
    p_amount INTEGER,
    p_reason TEXT
) RETURNS VOID AS $$
BEGIN
    UPDATE agent_registry
    SET reputation = reputation + p_amount
    WHERE agent_id = p_agent_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Agent not found: %', p_agent_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION add_reputation IS 'Add reputation to agent (used by existing webhook)';
