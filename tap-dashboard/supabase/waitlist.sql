-- Waitlist table (Priority 1)
CREATE TABLE waitlist (
  id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  agent_id TEXT UNIQUE,
  public_key TEXT,
  boot_hash TEXT,
  status TEXT DEFAULT 'waitlisted',
  source TEXT DEFAULT 'form',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS (public insert only, admins can read)
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can join waitlist" ON waitlist
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can read waitlist" ON waitlist
  FOR SELECT USING (auth.role() = 'service_role');
