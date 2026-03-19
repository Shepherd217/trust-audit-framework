-- Migration: Database Backup Infrastructure
-- Date: March 19, 2026
-- Purpose: Automated backups, audit logging, and disaster recovery preparation

-- ============================================
-- BACKUP AUDIT LOG
-- Track all backup operations
-- ============================================

CREATE TABLE IF NOT EXISTS backup_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    backup_type TEXT NOT NULL CHECK (backup_type IN ('automated', 'manual', 'pre_migration', 'pre_deploy')),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
    tables_backed_up TEXT[] DEFAULT '{}',
    row_counts JSONB DEFAULT '{}',
    file_size_bytes BIGINT,
    storage_location TEXT,
    error_message TEXT,
    triggered_by TEXT DEFAULT 'system'
);

CREATE INDEX idx_backup_audit_started ON backup_audit_log(started_at DESC);
CREATE INDEX idx_backup_audit_status ON backup_audit_log(status);

-- Enable RLS
ALTER TABLE backup_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only" ON backup_audit_log
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- ============================================
-- CRITICAL TABLES CHECKSUM
-- Verify data integrity between backups
-- ============================================

CREATE TABLE IF NOT EXISTS table_checksums (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    checksum TEXT NOT NULL,
    row_count INTEGER NOT NULL,
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    backup_id UUID REFERENCES backup_audit_log(id)
);

CREATE INDEX idx_checksums_table ON table_checksums(table_name, calculated_at DESC);

-- ============================================
-- BACKUP CONFIGURATION
-- Store backup settings and retention policy
-- ============================================

CREATE TABLE IF NOT EXISTS backup_config (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Singleton
    automated_backups_enabled BOOLEAN DEFAULT true,
    backup_interval_hours INTEGER DEFAULT 24,
    retention_days INTEGER DEFAULT 30,
    pre_migration_backup BOOLEAN DEFAULT true,
    backup_tables TEXT[] DEFAULT ARRAY[
        'agent_registry',
        'tap_scores',
        'attestations',
        'agent_vouches',
        'dispute_cases',
        'slash_events',
        'appeals',
        'appeal_votes',
        'reputation_recovery',
        'honeypot_agents',
        'anomaly_events',
        'bls_keypairs',
        'aggregated_attestations',
        'clawfs_buckets',
        'clawfs_evidence',
        'marketplace_jobs',
        'clawid_nonces',
        'backup_audit_log'
    ],
    last_backup_at TIMESTAMPTZ,
    last_backup_id UUID,
    pg_dump_options TEXT DEFAULT '--clean --if-exists --no-owner --no-privileges',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default config if not exists
INSERT INTO backup_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to calculate table checksum (for integrity verification)
CREATE OR REPLACE FUNCTION calculate_table_checksum(p_table_name TEXT)
RETURNS TEXT AS $$
DECLARE
    v_checksum TEXT;
BEGIN
    -- Use md5 hash of concatenated row data
    EXECUTE format(
        'SELECT md5(string_agg(t::text, %L ORDER BY 1)) FROM %I t',
        '|',
        p_table_name
    ) INTO v_checksum;
    
    RETURN COALESCE(v_checksum, '0');
END;
$$ LANGUAGE plpgsql;

-- Function to record backup completion
CREATE OR REPLACE FUNCTION record_backup_complete(
    p_backup_id UUID,
    p_status TEXT,
    p_file_size BIGINT DEFAULT NULL,
    p_storage_location TEXT DEFAULT NULL,
    p_error_message TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    UPDATE backup_audit_log
    SET 
        status = p_status,
        completed_at = NOW(),
        file_size_bytes = p_file_size,
        storage_location = p_storage_location,
        error_message = p_error_message
    WHERE id = p_backup_id;
    
    -- Update config with last backup info
    IF p_status = 'completed' THEN
        UPDATE backup_config
        SET 
            last_backup_at = NOW(),
            last_backup_id = p_backup_id
        WHERE id = 1;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to get backup status overview
CREATE OR REPLACE FUNCTION get_backup_status()
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_last_backup TIMESTAMPTZ;
    v_config RECORD;
BEGIN
    SELECT * INTO v_config FROM backup_config WHERE id = 1;
    
    SELECT MAX(started_at) INTO v_last_backup 
    FROM backup_audit_log 
    WHERE status = 'completed';
    
    v_result := jsonb_build_object(
        'automated_backups_enabled', v_config.automated_backups_enabled,
        'backup_interval_hours', v_config.backup_interval_hours,
        'retention_days', v_config.retention_days,
        'last_backup_at', v_last_backup,
        'hours_since_last_backup', EXTRACT(EPOCH FROM (NOW() - v_last_backup)) / 3600,
        'backup_tables_count', array_length(v_config.backup_tables, 1),
        'recent_backups', (
            SELECT jsonb_agg(jsonb_build_object(
                'id', id,
                'type', backup_type,
                'started_at', started_at,
                'status', status,
                'file_size_bytes', file_size_bytes
            ))
            FROM backup_audit_log
            WHERE started_at > NOW() - INTERVAL '7 days'
            ORDER BY started_at DESC
            LIMIT 10
        )
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW COUNT MONITORING
-- Track table sizes for anomaly detection
-- ============================================

CREATE TABLE IF NOT EXISTS table_row_counts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    row_count INTEGER NOT NULL,
    size_bytes BIGINT,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_row_counts_table ON table_row_counts(table_name, recorded_at DESC);
CREATE INDEX idx_row_counts_time ON table_row_counts(recorded_at);

-- Function to snapshot current table sizes
CREATE OR REPLACE FUNCTION snapshot_table_sizes()
RETURNS VOID AS $$
DECLARE
    v_table RECORD;
    v_count INTEGER;
    v_size BIGINT;
BEGIN
    FOR v_table IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
        AND tablename NOT LIKE 'pg_%'
        AND tablename NOT LIKE 'auth_%'
    LOOP
        EXECUTE format('SELECT COUNT(*) FROM %I', v_table.tablename) INTO v_count;
        
        -- Get approximate size
        SELECT pg_total_relation_size(quote_ident(v_table.tablename)) INTO v_size;
        
        INSERT INTO table_row_counts (table_name, row_count, size_bytes)
        VALUES (v_table.tablename, v_count, v_size);
    END LOOP;
    
    -- Clean up old records (keep 90 days)
    DELETE FROM table_row_counts 
    WHERE recorded_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;
