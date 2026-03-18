-- Migration 012: BLS Signatures & ClawFS Evidence Storage
-- Phase 6: Infrastructure & Governance

-- ============================================
-- BLS SIGNATURE AGGREGATION
-- ============================================

-- Extension for BLS operations (if not present)
-- Note: Requires bls12_381 extension or use native JS/WASM implementation

CREATE TABLE IF NOT EXISTS bls_keypairs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id TEXT NOT NULL REFERENCES agent_registry(agent_id),
    public_key BYTEA NOT NULL,  -- 96 bytes BLS12-381 public key
    key_type TEXT NOT NULL CHECK (key_type IN ('attestation', 'governance', 'recovery')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    rotated_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    UNIQUE(agent_id, key_type)
);

CREATE INDEX idx_bls_keys_agent ON bls_keypairs(agent_id);
CREATE INDEX idx_bls_keys_pubkey ON bls_keypairs(public_key);

-- Aggregated attestations (batch verification)
CREATE TABLE IF NOT EXISTS aggregated_attestations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_signature BYTEA NOT NULL,  -- 96 bytes aggregated signature
    attestation_count INTEGER NOT NULL,
    attestation_ids UUID[] NOT NULL,  -- References to attestations table
    public_key_indices INTEGER[] NOT NULL,  -- Indices in verifier set
    block_height INTEGER,  -- For blockchain anchoring
    anchor_tx_hash TEXT,  -- Transaction hash if anchored
    created_at TIMESTAMPTZ DEFAULT NOW(),
    verified_at TIMESTAMPTZ,
    verified_by TEXT REFERENCES agent_registry(agent_id),
    valid BOOLEAN DEFAULT true
);

CREATE INDEX idx_agg_attestations_created ON aggregated_attestations(created_at);
CREATE INDEX idx_agg_attestations_anchor ON aggregated_attestations(anchor_tx_hash) WHERE anchor_tx_hash IS NOT NULL;

-- Signature shares for threshold schemes
CREATE TABLE IF NOT EXISTS signature_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_id UUID NOT NULL REFERENCES aggregated_attestations(id) ON DELETE CASCADE,
    agent_id TEXT NOT NULL REFERENCES agent_registry(agent_id),
    share BYTEA NOT NULL,  -- Individual signature share
    share_index INTEGER NOT NULL,
    verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shares_aggregate ON signature_shares(aggregate_id);

-- ============================================
-- CLAWFS EVIDENCE STORAGE
-- ============================================

-- Evidence buckets (cases/disputes/appeals)
CREATE TABLE IF NOT EXISTS clawfs_buckets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_type TEXT NOT NULL CHECK (bucket_type IN ('dispute', 'appeal', 'anomaly', 'honeypot')),
    related_id UUID NOT NULL,  -- References disputes.id, appeals.id, etc.
    owner_id TEXT NOT NULL REFERENCES agent_registry(agent_id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    locked_at TIMESTAMPTZ,  -- When evidence period closes
    merkle_root TEXT,  -- Root hash of all evidence
    UNIQUE(bucket_type, related_id)
);

CREATE INDEX idx_buckets_owner ON clawfs_buckets(owner_id);
CREATE INDEX idx_buckets_related ON clawfs_buckets(bucket_type, related_id);

-- Individual evidence items (content-addressed)
CREATE TABLE IF NOT EXISTS clawfs_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_id UUID NOT NULL REFERENCES clawfs_buckets(id) ON DELETE CASCADE,
    cid TEXT NOT NULL,  -- Content identifier (IPFS-style or custom)
    evidence_type TEXT NOT NULL CHECK (evidence_type IN ('document', 'screenshot', 'log', 'transaction', 'signature', 'recording')),
    filename TEXT,
    mime_type TEXT,
    size_bytes INTEGER,
    uploaded_by TEXT NOT NULL REFERENCES agent_registry(agent_id),
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    hash_sha256 BYTEA NOT NULL,  -- Content integrity
    metadata JSONB DEFAULT '{}',
    UNIQUE(cid)
);

CREATE INDEX idx_evidence_bucket ON clawfs_evidence(bucket_id);
CREATE INDEX idx_evidence_cid ON clawfs_evidence(cid);
CREATE INDEX idx_evidence_uploaded ON clawfs_evidence(uploaded_at);

-- Evidence access log (audit trail)
CREATE TABLE IF NOT EXISTS clawfs_access_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evidence_id UUID NOT NULL REFERENCES clawfs_evidence(id),
    accessed_by TEXT NOT NULL REFERENCES agent_registry(agent_id),
    accessed_at TIMESTAMPTZ DEFAULT NOW(),
    access_type TEXT NOT NULL CHECK (access_type IN ('read', 'download', 'verify')),
    ip_hash TEXT,  -- Hashed IP for audit (privacy-preserving)
    user_agent TEXT
);

CREATE INDEX idx_access_evidence ON clawfs_access_log(evidence_id);
CREATE INDEX idx_access_time ON clawfs_access_log(accessed_at);

-- ============================================
-- GOVERNANCE DASHBOARD VIEWS
-- ============================================

CREATE OR REPLACE VIEW v_governance_overview AS
SELECT 
    'disputes' as metric_type,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'pending') as pending,
    COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h
FROM dispute_cases
UNION ALL
SELECT 
    'appeals' as metric_type,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'pending' OR status = 'voting') as pending,
    COUNT(*) FILTER (WHERE status IN ('accepted', 'rejected')) as resolved,
    COUNT(*) FILTER (WHERE filed_at > NOW() - INTERVAL '24 hours') as last_24h
FROM appeals
UNION ALL
SELECT 
    'anomalies' as metric_type,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'open') as pending,
    COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as last_24h
FROM anomaly_events
UNION ALL
SELECT 
    'honeypots_triggered' as metric_type,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'triggered') as pending,
    COUNT(*) FILTER (WHERE status = 'retired') as resolved,
    COUNT(*) FILTER (WHERE triggered_at > NOW() - INTERVAL '24 hours') as last_24h
FROM honeypot_agents;

-- Active cases requiring attention
CREATE OR REPLACE VIEW v_cases_requiring_action AS
SELECT 
    d.id,
    'dispute' as case_type,
    d.status,
    d.target_id as subject_id,
    t.name as subject_name,
    d.reporter_id,
    r.name as reporter_name,
    d.bond_amount as stake_amount,
    d.created_at,
    EXTRACT(EPOCH FROM (NOW() - d.created_at))/3600 as hours_open
FROM dispute_cases d
JOIN agent_registry t ON d.target_id = t.agent_id
JOIN agent_registry r ON d.reporter_id = r.agent_id
WHERE d.status = 'pending'
   OR (d.status = 'resolved' AND d.resolved_at > NOW() - INTERVAL '7 days')
UNION ALL
SELECT 
    a.id,
    'appeal' as case_type,
    a.status,
    a.appellant_id as subject_id,
    app.name as subject_name,
    NULL as reporter_id,
    NULL as reporter_name,
    a.appeal_bond as stake_amount,
    a.filed_at as created_at,
    EXTRACT(EPOCH FROM (NOW() - a.filed_at))/3600 as hours_open
FROM appeals a
JOIN agent_registry app ON a.appellant_id = app.agent_id
WHERE a.status IN ('pending', 'voting')
   OR (a.status IN ('accepted', 'rejected') AND a.resolved_at > NOW() - INTERVAL '7 days')
ORDER BY hours_open DESC;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Create evidence bucket for a case
CREATE OR REPLACE FUNCTION create_evidence_bucket(
    p_bucket_type TEXT,
    p_related_id UUID,
    p_owner_id TEXT
) RETURNS UUID AS $$
DECLARE v_bucket_id UUID;
BEGIN
    INSERT INTO clawfs_buckets (bucket_type, related_id, owner_id)
    VALUES (p_bucket_type, p_related_id, p_owner_id)
    RETURNING id INTO v_bucket_id;
    
    RETURN v_bucket_id;
END;
$$ LANGUAGE plpgsql;

-- Lock evidence bucket (no more uploads)
CREATE OR REPLACE FUNCTION lock_evidence_bucket(
    p_bucket_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE clawfs_buckets 
    SET locked_at = NOW()
    WHERE id = p_bucket_id AND locked_at IS NULL;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Verify evidence integrity
CREATE OR REPLACE FUNCTION verify_evidence(
    p_evidence_id UUID
) RETURNS TABLE(
    cid TEXT,
    stored_hash BYTEA,
    computed_hash BYTEA,
    valid BOOLEAN
) AS $$
BEGIN
    -- Note: Actual hash computation would happen in application layer
    -- This function returns metadata for verification
    RETURN QUERY
    SELECT 
        e.cid,
        e.hash_sha256 as stored_hash,
        NULL::BYTEA as computed_hash,  -- Placeholder
        NULL::BOOLEAN as valid  -- Placeholder
    FROM clawfs_evidence e
    WHERE e.id = p_evidence_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- CONFIG UPDATES
-- ============================================

ALTER TABLE wot_config ADD COLUMN IF NOT EXISTS bls_verification_enabled BOOLEAN DEFAULT false;
ALTER TABLE wot_config ADD COLUMN IF NOT EXISTS evidence_lock_hours INTEGER DEFAULT 168;  -- 7 days
ALTER TABLE wot_config ADD COLUMN IF NOT EXISTS max_evidence_size_mb INTEGER DEFAULT 100;
ALTER TABLE wot_config ADD COLUMN IF NOT EXISTS max_evidence_items INTEGER DEFAULT 50;
