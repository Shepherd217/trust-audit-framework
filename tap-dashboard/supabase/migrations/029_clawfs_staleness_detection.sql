-- Migration 029: ClawFS Staleness Detection (5-Retrieval Rule)
-- Based on @jazero's insight: frequently-accessed memory is most likely to drift
-- Adds explicit validation triggers to ClawFS hot/warm/cold tiering

-- Add staleness tracking columns to clawfs_files
ALTER TABLE clawfs_files 
ADD COLUMN IF NOT EXISTS access_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_validated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS requires_validation BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS validation_threshold INTEGER DEFAULT 5;

-- Create index for efficient staleness queries
CREATE INDEX IF NOT EXISTS idx_clawfs_files_staleness 
ON clawfs_files(agent_id, requires_validation) 
WHERE requires_validation = TRUE;

-- Create index for access count tracking
CREATE INDEX IF NOT EXISTS idx_clawfs_files_access_count 
ON clawfs_files(agent_id, access_count DESC);

-- Function to check staleness on file access/update
CREATE OR REPLACE FUNCTION clawfs_check_staleness()
RETURNS TRIGGER AS $$
BEGIN
    -- Increment access count
    NEW.access_count = COALESCE(OLD.access_count, 0) + 1;
    
    -- 5-retrieval rule: if accessed > threshold times without validation, flag it
    IF NEW.access_count > COALESCE(OLD.validation_threshold, 5) AND 
       (OLD.last_validated_at IS NULL OR OLD.last_validated_at < NOW() - INTERVAL '7 days') THEN
        NEW.requires_validation = TRUE;
        
        -- Emit notification for real-time staleness alerts
        PERFORM pg_notify('clawfs_staleness_alert', json_build_object(
            'file_id', NEW.id,
            'agent_id', NEW.agent_id,
            'access_count', NEW.access_count,
            'last_validated_at', OLD.last_validated_at,
            'triggered_at', NOW()
        )::text);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists (for idempotency)
DROP TRIGGER IF EXISTS clawfs_staleness_check ON clawfs_files;

-- Create trigger for staleness check
CREATE TRIGGER clawfs_staleness_check
    BEFORE UPDATE ON clawfs_files
    FOR EACH ROW
    WHEN (OLD.access_count IS DISTINCT FROM NEW.access_count OR NEW.access_count IS NULL)
    EXECUTE FUNCTION clawfs_check_staleness();

-- Function to validate a file (reset staleness flags)
CREATE OR REPLACE FUNCTION clawfs_validate_file(
    p_file_id UUID,
    p_agent_id TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_updated BOOLEAN := FALSE;
BEGIN
    UPDATE clawfs_files
    SET 
        requires_validation = FALSE,
        last_validated_at = NOW(),
        access_count = 0  -- Reset count after validation
    WHERE id = p_file_id 
      AND agent_id = p_agent_id
      AND requires_validation = TRUE;
    
    GET DIAGNOSTICS v_updated = ROW_COUNT;
    
    RETURN v_updated > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get files requiring validation for an agent
CREATE OR REPLACE FUNCTION clawfs_get_stale_files(
    p_agent_id TEXT,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    file_id UUID,
    file_path TEXT,
    access_count INTEGER,
    last_accessed_at TIMESTAMPTZ,
    days_since_validation INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        f.id AS file_id,
        f.path AS file_path,
        f.access_count,
        f.updated_at AS last_accessed_at,
        CASE 
            WHEN f.last_validated_at IS NULL THEN NULL
            ELSE EXTRACT(DAY FROM NOW() - f.last_validated_at)::INTEGER
        END AS days_since_validation
    FROM clawfs_files f
    WHERE f.agent_id = p_agent_id
      AND f.requires_validation = TRUE
    ORDER BY f.access_count DESC, f.updated_at DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add staleness metrics to clawfs audit log type
-- Note: If clawfs_audit_logs table exists, add these columns
DO $$
BEGIN
    -- Check if audit table exists and add columns if needed
    IF EXISTS (SELECT 1 FROM information_schema.tables 
               WHERE table_name = 'clawfs_audit_logs') THEN
        
        ALTER TABLE clawfs_audit_logs 
        ADD COLUMN IF NOT EXISTS validation_triggered BOOLEAN DEFAULT FALSE;
        
        ALTER TABLE clawfs_audit_logs 
        ADD COLUMN IF NOT EXISTS validation_resolved_at TIMESTAMPTZ;
    END IF;
END $$;

-- Add comment documenting the 5-retrieval rule
COMMENT ON COLUMN clawfs_files.access_count IS 
    'Number of times file has been accessed since last validation. Triggers staleness flag at threshold.';

COMMENT ON COLUMN clawfs_files.requires_validation IS 
    'True when file has been accessed >5 times without validation. Indicates potential staleness.';

COMMENT ON COLUMN clawfs_files.validation_threshold IS 
    'Configurable threshold for staleness detection. Default 5 (the "5-retrieval rule").';

-- Migration complete
SELECT 'Migration 029 applied: ClawFS Staleness Detection (5-Retrieval Rule)' AS status;
