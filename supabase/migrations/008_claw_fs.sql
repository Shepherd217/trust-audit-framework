-- ClawFS Database Migration
-- Agent-Native Distributed File System Tables

-- ============================================================================
-- Core File Storage
-- ============================================================================

-- Files table with content-addressed storage
CREATE TABLE claw_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cid TEXT NOT NULL UNIQUE, -- Content hash (SHA-256)
    owner_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    
    -- Content (stored in Supabase Storage for hot tier, IPFS hash for cold)
    content_url TEXT, -- URL to actual content
    content_size BIGINT NOT NULL DEFAULT 0,
    
    -- Metadata
    name TEXT NOT NULL,
    mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
    description TEXT,
    tags TEXT[], -- Array of tags
    
    -- Semantic search
    embedding VECTOR(1536), -- OpenAI text-embedding-3-small dimensions
    
    -- Versioning
    version INTEGER NOT NULL DEFAULT 1,
    parent_id UUID REFERENCES claw_files(id),
    branch_name TEXT DEFAULT 'main',
    
    -- Storage tier
    storage_tier TEXT NOT NULL DEFAULT 'hot' CHECK (storage_tier IN ('hot', 'warm', 'cold')),
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ, -- Soft delete
    
    -- Indexes
    CONSTRAINT valid_cid CHECK (LENGTH(cid) = 64) -- SHA-256 hex = 64 chars
);

-- ============================================================================
-- File Versions (Immutable History)
-- ============================================================================

CREATE TABLE claw_file_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES claw_files(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    cid TEXT NOT NULL, -- Content hash of this version
    
    -- Change metadata
    change_summary TEXT, -- Auto-generated or manual summary
    changed_by TEXT NOT NULL REFERENCES agents(id),
    parent_version_id UUID REFERENCES claw_file_versions(id),
    
    -- Content reference
    content_url TEXT NOT NULL,
    content_size BIGINT NOT NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(file_id, version)
);

-- ============================================================================
-- Agent-to-Agent Permissions
-- ============================================================================

CREATE TABLE claw_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES claw_files(id) ON DELETE CASCADE,
    
    -- Who granted and who receives
    granted_by TEXT NOT NULL REFERENCES agents(id),
    granted_to TEXT NOT NULL REFERENCES agents(id),
    
    -- Permission types
    can_read BOOLEAN NOT NULL DEFAULT true,
    can_write BOOLEAN NOT NULL DEFAULT false,
    can_delete BOOLEAN NOT NULL DEFAULT false,
    can_share BOOLEAN NOT NULL DEFAULT false,
    can_admin BOOLEAN NOT NULL DEFAULT false,
    
    -- Time constraints
    granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ, -- NULL = never expires
    revoked_at TIMESTAMPTZ, -- Soft revoke
    revoked_reason TEXT,
    
    -- Conditions (JSON for flexibility)
    conditions JSONB DEFAULT '{}', -- e.g., {"max_accesses": 100, "ip_range": "10.0.0.0/8"}
    
    UNIQUE(file_id, granted_to)
);

-- ============================================================================
-- Access Policies (Rule-Based)
-- ============================================================================

CREATE TABLE claw_access_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES claw_files(id) ON DELETE CASCADE,
    
    -- Policy rules
    policy_type TEXT NOT NULL CHECK (policy_type IN ('public', 'restricted', 'private', 'tiered')),
    rules JSONB NOT NULL DEFAULT '{}',
    -- Examples:
    -- {"min_reputation": "verified", "required_capabilities": ["storage"]}
    -- {"allow_list": ["agent1", "agent2"], "deny_list": ["agent3"]}
    
    priority INTEGER NOT NULL DEFAULT 0, -- Higher = evaluated first
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Semantic Index for Search
-- ============================================================================

CREATE TABLE claw_semantic_index (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES claw_files(id) ON DELETE CASCADE,
    
    -- Search metadata
    content_type TEXT NOT NULL, -- 'text', 'code', 'image', 'structured'
    extracted_text TEXT, -- Plain text extracted for indexing
    
    -- Embeddings for different models
    embedding_1536 VECTOR(1536), -- OpenAI text-embedding-3-small
    embedding_3072 VECTOR(3072), -- OpenAI text-embedding-3-large
    
    -- Search metadata
    language TEXT DEFAULT 'en',
    token_count INTEGER,
    
    -- Indexed chunks for large files
    chunk_index INTEGER NOT NULL DEFAULT 0,
    chunk_total INTEGER NOT NULL DEFAULT 1,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(file_id, chunk_index)
);

-- ============================================================================
-- Audit Trail (Compliance)
-- ============================================================================

CREATE TABLE claw_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Event details
    event_type TEXT NOT NULL CHECK (event_type IN (
        'file_created', 'file_read', 'file_updated', 'file_deleted',
        'file_shared', 'permission_granted', 'permission_revoked',
        'permission_expired', 'tier_migrated', 'version_created',
        'search_performed', 'conflict_resolved', 'policy_violation'
    )),
    
    -- Who and what
    agent_id TEXT NOT NULL REFERENCES agents(id),
    file_id UUID REFERENCES claw_files(id),
    
    -- Event metadata
    details JSONB NOT NULL DEFAULT '{}',
    -- Examples:
    -- {"old_version": 1, "new_version": 2, "conflict_strategy": "lww"}
    -- {"shared_with": "agent2", "permissions": ["read", "write"]}
    
    -- IP and session tracking
    ip_address INET,
    user_agent TEXT,
    session_id TEXT,
    
    -- Integrity (for tamper detection)
    merkle_hash TEXT, -- Hash chain for audit integrity
    previous_hash TEXT REFERENCES claw_audit_logs(merkle_hash),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Storage Tier Tracking
-- ============================================================================

CREATE TABLE claw_storage_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES claw_files(id) ON DELETE CASCADE,
    
    -- Tier history
    from_tier TEXT NOT NULL CHECK (from_tier IN ('hot', 'warm', 'cold')),
    to_tier TEXT NOT NULL CHECK (to_tier IN ('hot', 'warm', 'cold')),
    
    -- Migration metadata
    reason TEXT NOT NULL, -- 'access_pattern', 'size_threshold', 'manual', 'cost_optimization'
    triggered_by TEXT REFERENCES agents(id), -- NULL = system
    
    -- Storage locations
    from_location TEXT, -- e.g., 'supabase-storage-us-east'
    to_location TEXT,   -- e.g., 'ipfs-QmHash...'
    
    -- Costs
    migration_cost_usd DECIMAL(10, 6), -- Cost of this migration
    storage_cost_per_gb_month DECIMAL(10, 6),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Conflict Resolution Queue
-- ============================================================================

CREATE TABLE claw_conflict_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_id UUID NOT NULL REFERENCES claw_files(id) ON DELETE CASCADE,
    
    -- Conflicting versions
    base_version INTEGER NOT NULL,
    incoming_version INTEGER NOT NULL,
    
    -- Agents involved
    base_agent_id TEXT NOT NULL REFERENCES agents(id),
    incoming_agent_id TEXT NOT NULL REFERENCES agents(id),
    
    -- Conflict details
    conflict_type TEXT NOT NULL CHECK (conflict_type IN ('concurrent_edit', 'permission_change', 'tier_conflict')),
    conflict_data JSONB NOT NULL, -- Full context for resolution
    
    -- Resolution
    strategy_used TEXT CHECK (strategy_used IN ('lww', 'branch', 'auto_merge', 'manual', 'rejected')),
    resolved_by TEXT REFERENCES agents(id),
    resolved_at TIMESTAMPTZ,
    resolution_result JSONB, -- Outcome details
    
    -- Status
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolving', 'resolved', 'rejected', 'escalated')),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

-- File lookups
CREATE INDEX idx_claw_files_owner ON claw_files(owner_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_claw_files_cid ON claw_files(cid);
CREATE INDEX idx_claw_files_tier ON claw_files(storage_tier) WHERE deleted_at IS NULL;
CREATE INDEX idx_claw_files_parent ON claw_files(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX idx_claw_files_created ON claw_files(created_at DESC);

-- Version history
CREATE INDEX idx_claw_versions_file ON claw_file_versions(file_id, version DESC);

-- Permissions
CREATE INDEX idx_claw_permissions_file ON claw_permissions(file_id) WHERE revoked_at IS NULL;
CREATE INDEX idx_claw_permissions_granted_to ON claw_permissions(granted_to) WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW());

-- Semantic search (using pgvector)
CREATE INDEX idx_claw_semantic_embedding ON claw_semantic_index USING ivfflat (embedding_1536 vector_cosine_ops);

-- Audit logs
CREATE INDEX idx_claw_audit_agent ON claw_audit_logs(agent_id, created_at DESC);
CREATE INDEX idx_claw_audit_file ON claw_audit_logs(file_id, created_at DESC);
CREATE INDEX idx_claw_audit_event ON claw_audit_logs(event_type, created_at DESC);
CREATE INDEX idx_claw_audit_time ON claw_audit_logs(created_at DESC);

-- Conflict resolution
CREATE INDEX idx_claw_conflict_pending ON claw_conflict_queue(status) WHERE status = 'pending';

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

ALTER TABLE claw_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE claw_file_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE claw_permissions ENABLE ROW LEVEL SECURITY;

-- Files: Agents can see their own files + files shared with them
CREATE POLICY file_access ON claw_files
    FOR SELECT
    USING (
        owner_id = current_setting('app.current_agent_id', true)
        OR EXISTS (
            SELECT 1 FROM claw_permissions
            WHERE file_id = claw_files.id
            AND granted_to = current_setting('app.current_agent_id', true)
            AND can_read = true
            AND revoked_at IS NULL
            AND (expires_at IS NULL OR expires_at > NOW())
        )
    );

-- Files: Only owner can update/delete
CREATE POLICY file_modify ON claw_files
    FOR UPDATE
    USING (owner_id = current_setting('app.current_agent_id', true));

-- Versions: Visible if parent file is visible
CREATE POLICY version_access ON claw_file_versions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM claw_files
            WHERE id = claw_file_versions.file_id
        )
    );

-- Permissions: Visible to granter or grantee
CREATE POLICY permission_access ON claw_permissions
    FOR SELECT
    USING (
        granted_by = current_setting('app.current_agent_id', true)
        OR granted_to = current_setting('app.current_agent_id', true)
    );

-- ============================================================================
-- Triggers for Updated At
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_claw_files_updated_at
    BEFORE UPDATE ON claw_files
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_claw_access_policies_updated_at
    BEFORE UPDATE ON claw_access_policies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_claw_semantic_index_updated_at
    BEFORE UPDATE ON claw_semantic_index
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Storage Bucket for Hot Tier
-- ============================================================================

-- Create Supabase Storage bucket for hot tier files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'clawfs-hot',
    'clawfs-hot',
    false, -- Private by default
    52428800, -- 50MB limit
    ARRAY['*'] -- All mime types allowed
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for hot tier
CREATE POLICY "ClawFS hot tier access"
ON storage.objects
FOR ALL
TO authenticated
USING (
    bucket_id = 'clawfs-hot'
    AND EXISTS (
        SELECT 1 FROM claw_files
        WHERE content_url LIKE '%' || storage.objects.name
        AND (
            owner_id = auth.uid()::text
            OR EXISTS (
                SELECT 1 FROM claw_permissions
                WHERE file_id = claw_files.id
                AND granted_to = auth.uid()::text
                AND can_read = true
                AND revoked_at IS NULL
            )
        )
    )
);

-- ============================================================================
-- Functions for Common Operations
-- ============================================================================

-- Function to check if agent has permission on file
CREATE OR REPLACE FUNCTION check_file_permission(
    p_file_id UUID,
    p_agent_id TEXT,
    p_permission TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    -- Owner always has all permissions
    IF EXISTS (
        SELECT 1 FROM claw_files
        WHERE id = p_file_id AND owner_id = p_agent_id
    ) THEN
        RETURN true;
    END IF;
    
    -- Check specific permission
    RETURN EXISTS (
        SELECT 1 FROM claw_permissions
        WHERE file_id = p_file_id
        AND granted_to = p_agent_id
        AND revoked_at IS NULL
        AND (expires_at IS NULL OR expires_at > NOW())
        AND CASE p_permission
            WHEN 'read' THEN can_read
            WHEN 'write' THEN can_write
            WHEN 'delete' THEN can_delete
            WHEN 'share' THEN can_share
            WHEN 'admin' THEN can_admin
            ELSE false
        END
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log audit event
CREATE OR REPLACE FUNCTION log_claw_audit(
    p_event_type TEXT,
    p_agent_id TEXT,
    p_file_id UUID DEFAULT NULL,
    p_details JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
    v_previous_hash TEXT;
BEGIN
    -- Get previous hash for chain
    SELECT merkle_hash INTO v_previous_hash
    FROM claw_audit_logs
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Insert with hash
    INSERT INTO claw_audit_logs (
        event_type, agent_id, file_id, details, previous_hash,
        merkle_hash -- Would be computed from content in real implementation
    ) VALUES (
        p_event_type, p_agent_id, p_file_id, p_details, v_previous_hash,
        encode(digest(random()::text || NOW()::text, 'sha256'), 'hex')
    )
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to migrate file tier
CREATE OR REPLACE FUNCTION migrate_file_tier(
    p_file_id UUID,
    p_to_tier TEXT,
    p_reason TEXT DEFAULT 'manual',
    p_triggered_by TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_from_tier TEXT;
BEGIN
    -- Get current tier
    SELECT storage_tier INTO v_from_tier FROM claw_files WHERE id = p_file_id;
    
    IF v_from_tier = p_to_tier THEN
        RETURN; -- No change needed
    END IF;
    
    -- Update file
    UPDATE claw_files
    SET storage_tier = p_to_tier, updated_at = NOW()
    WHERE id = p_file_id;
    
    -- Log migration
    INSERT INTO claw_storage_tiers (
        file_id, from_tier, to_tier, reason, triggered_by
    ) VALUES (
        p_file_id, v_from_tier, p_to_tier, p_reason, p_triggered_by
    );
    
    -- Log audit
    PERFORM log_claw_audit(
        'tier_migrated',
        COALESCE(p_triggered_by, 'system'),
        p_file_id,
        jsonb_build_object('from_tier', v_from_tier, 'to_tier', p_to_tier, 'reason', p_reason)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
