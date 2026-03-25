-- Migration: Re-Dispute and Re-Correction Tracking
-- Date: March 25, 2026
-- Description: Track durability metrics for overturned verdicts

-- ============================================
-- Step 1: Add re-dispute tracking to appeals
-- ============================================

ALTER TABLE appeals 
ADD COLUMN IF NOT EXISTS is_re_dispute BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS original_dispute_id UUID REFERENCES dispute_cases(id),
ADD COLUMN IF NOT EXISTS re_dispute_sequence INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_appeals_re_dispute ON appeals(is_re_dispute) WHERE is_re_dispute = true;
CREATE INDEX IF NOT EXISTS idx_appeals_original ON appeals(original_dispute_id);

-- ============================================
-- Step 2: Function to check if dispute is a re-dispute
-- ============================================

CREATE OR REPLACE FUNCTION check_re_dispute(
    p_disputant_id TEXT,
    p_target_id TEXT,
    p_created_at TIMESTAMPTZ
) RETURNS TABLE (
    is_re_dispute BOOLEAN,
    original_dispute_id UUID,
    sequence_number INTEGER
) AS $$
DECLARE
    v_original_dispute_id UUID;
    v_sequence INTEGER;
BEGIN
    -- Look for previous disputes by same disputant against same target within 30 days
    SELECT id, appeal_count + 1 INTO v_original_dispute_id, v_sequence
    FROM dispute_cases
    WHERE reporter_id = p_disputant_id
    AND target_id = p_target_id
    AND created_at < p_created_at
    AND created_at > p_created_at - INTERVAL '30 days'
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_original_dispute_id IS NOT NULL THEN
        RETURN QUERY SELECT true, v_original_dispute_id, v_sequence::INTEGER;
    ELSE
        RETURN QUERY SELECT false, NULL::UUID, 0::INTEGER;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Step 3: Function to mark re-corrections
-- ============================================

CREATE OR REPLACE FUNCTION mark_re_correction(
    p_appeal_id UUID
) RETURNS VOID AS $$
DECLARE
    v_original_dispute_id UUID;
    v_original_verdict TEXT;
    v_new_verdict TEXT;
BEGIN
    -- Get the appeal's dispute
    SELECT dispute_id INTO v_original_dispute_id
    FROM appeals WHERE id = p_appeal_id;
    
    IF v_original_dispute_id IS NULL THEN
        RETURN;
    END IF;
    
    -- Get original verdict
    SELECT resolution INTO v_original_verdict
    FROM dispute_cases WHERE id = v_original_dispute_id;
    
    -- Get new verdict (from the appeal resolution)
    SELECT resolution INTO v_new_verdict
    FROM dispute_cases 
    WHERE id IN (
        SELECT dispute_id FROM appeals 
        WHERE original_dispute_id = v_original_dispute_id
        AND status IN ('accepted', 'rejected')
        ORDER BY resolved_at DESC
        LIMIT 1
    );
    
    -- If verdict flipped back, it's a re-correction
    IF v_original_verdict IS NOT NULL 
       AND v_new_verdict IS NOT NULL 
       AND v_original_verdict != v_new_verdict THEN
        
        UPDATE expertise_history
        SET re_correction_count = re_correction_count + 1,
            overturn_quality = 'regression',
            updated_at = NOW()
        WHERE dispute_id = v_original_dispute_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Step 4: View for re-dispute analysis
-- ============================================

CREATE OR REPLACE VIEW re_dispute_analysis AS
SELECT 
    dc.id as dispute_id,
    dc.reporter_id,
    dc.target_id,
    dc.resolution as final_verdict,
    dc.resolved_at,
    prev.id as previous_dispute_id,
    prev.resolution as previous_verdict,
    prev.resolved_at as previous_resolved_at,
    CASE 
        WHEN prev.id IS NOT NULL THEN true
        ELSE false
    END as is_re_dispute,
    CASE
        WHEN prev.resolution = dc.resolution THEN 'same_outcome'
        WHEN prev.resolution IS NULL THEN 'first_dispute'
        ELSE 'different_outcome'
    END as outcome_pattern,
    EXTRACT(EPOCH FROM (dc.created_at - prev.resolved_at))/3600 as hours_since_previous
FROM dispute_cases dc
LEFT JOIN dispute_cases prev ON prev.reporter_id = dc.reporter_id
    AND prev.target_id = dc.target_id
    AND prev.created_at < dc.created_at
    AND prev.created_at > dc.created_at - INTERVAL '30 days'
    AND prev.id != dc.id
WHERE dc.status IN ('accepted', 'rejected');

-- ============================================
-- Step 5: Trigger to auto-track re-disputes
-- ============================================

CREATE OR REPLACE FUNCTION auto_track_re_dispute()
RETURNS TRIGGER AS $$
DECLARE
    v_check RECORD;
BEGIN
    -- Check if this is a re-dispute
    SELECT * INTO v_check FROM check_re_dispute(
        NEW.reporter_id,
        NEW.target_id,
        NEW.created_at
    );
    
    IF v_check.is_re_dispute THEN
        -- Update the dispute record
        NEW.appeal_count = v_check.sequence_number;
        
        -- Log in expertise_history if verdict is different
        INSERT INTO expertise_history (
            dispute_id,
            re_dispute_filed,
            re_dispute_count,
            final_verdict
        ) VALUES (
            v_check.original_dispute_id,
            true,
            v_check.sequence_number,
            'pending'
        )
        ON CONFLICT (dispute_id) 
        DO UPDATE SET
            re_dispute_filed = true,
            re_dispute_count = v_check.sequence_number,
            updated_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger (commented out - apply manually if desired)
-- CREATE TRIGGER trigger_auto_track_re_dispute
--     BEFORE INSERT ON dispute_cases
--     FOR EACH ROW
--     EXECUTE FUNCTION auto_track_re_dispute();

-- ============================================
-- Migration Complete
-- ============================================
