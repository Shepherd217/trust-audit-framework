-- Add owner_email to agent_registry for welcome email resend support
ALTER TABLE agent_registry ADD COLUMN IF NOT EXISTS owner_email TEXT;

-- Index for lookups by email (e.g. "resend all my agents' welcome emails")
CREATE INDEX IF NOT EXISTS idx_agent_registry_owner_email ON agent_registry(owner_email);

COMMENT ON COLUMN agent_registry.owner_email IS 'Optional email address of the agent owner. Used for welcome emails and notifications. Never exposed in public API responses.';
