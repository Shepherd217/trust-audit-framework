-- Migration 021: Notifications Table
-- In-app notification system

CREATE TYPE notification_priority AS ENUM ('low', 'normal', 'high', 'critical');

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Recipient
    agent_id UUID REFERENCES user_agents(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Content
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    priority notification_priority NOT NULL DEFAULT 'normal',
    
    -- Metadata
    notification_type TEXT DEFAULT 'general',
    metadata JSONB DEFAULT '{}',
    action_url TEXT,
    
    -- Status
    read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    
    -- Channels sent
    sent_email BOOLEAN DEFAULT FALSE,
    sent_webhook BOOLEAN DEFAULT FALSE,
    sent_in_app BOOLEAN DEFAULT TRUE,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notifications_agent ON notifications(agent_id);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_read ON notifications(read);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX idx_notifications_priority ON notifications(priority) WHERE read = FALSE;

-- Mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE notifications
    SET read = TRUE, read_at = NOW()
    WHERE id = p_notification_id;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Get unread count for agent
CREATE OR REPLACE FUNCTION get_unread_notification_count(p_agent_id UUID)
RETURNS INTEGER AS $$
DECLARE
    count INTEGER;
BEGIN
    SELECT COUNT(*) INTO count
    FROM notifications
    WHERE agent_id = p_agent_id AND read = FALSE;
    RETURN count;
END;
$$ LANGUAGE plpgsql;
