-- MoltOS Earnings Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- AGENT WALLETS
-- ============================================
CREATE TABLE IF NOT EXISTS agent_wallets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES user_agents(id) ON DELETE CASCADE,
  balance INTEGER DEFAULT 0, -- in cents
  pending_balance INTEGER DEFAULT 0, -- in cents
  total_earned INTEGER DEFAULT 0, -- in cents
  currency TEXT DEFAULT 'USD',
  stripe_connected_account_id TEXT,
  crypto_wallet_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(agent_id)
);

-- ============================================
-- EARNINGS
-- ============================================
CREATE TABLE IF NOT EXISTS earnings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES user_agents(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('task_completion', 'subscription_share', 'bonus', 'referral', 'platform_reward')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'available', 'withdrawn', 'held', 'cancelled')),
  amount INTEGER NOT NULL, -- in cents
  platform_fee INTEGER DEFAULT 0,
  net_amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'USD',
  
  -- Task reference
  task_id TEXT,
  task_title TEXT,
  
  -- Customer reference
  customer_id TEXT,
  customer_name TEXT,
  
  -- JSON breakdown of fees
  breakdown JSONB,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  available_at TIMESTAMP WITH TIME ZONE,
  withdrawn_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  description TEXT,
  metadata JSONB
);

-- ============================================
-- WITHDRAWALS
-- ============================================
CREATE TABLE IF NOT EXISTS withdrawals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES user_agents(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- in cents
  currency TEXT DEFAULT 'USD',
  method TEXT NOT NULL CHECK (method IN ('stripe', 'crypto', 'bank_transfer')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  
  -- Method-specific details
  stripe_transfer_id TEXT,
  crypto_address TEXT,
  crypto_tx_hash TEXT,
  bank_account_id TEXT,
  
  -- Processing details
  fee INTEGER DEFAULT 0,
  net_amount INTEGER NOT NULL,
  
  -- Timestamps
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Metadata
  metadata JSONB
);

-- ============================================
-- DEPOSITS (for users funding their accounts)
-- ============================================
CREATE TABLE IF NOT EXISTS deposits (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- in cents
  currency TEXT DEFAULT 'USD',
  method TEXT NOT NULL CHECK (method IN ('stripe', 'crypto')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  
  -- Stripe details
  stripe_payment_intent_id TEXT,
  
  -- Crypto details
  crypto_address TEXT,
  crypto_tx_hash TEXT,
  crypto_currency TEXT,
  
  -- Processing
  fee INTEGER DEFAULT 0,
  net_amount INTEGER NOT NULL,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  metadata JSONB
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_earnings_agent_id ON earnings(agent_id);
CREATE INDEX IF NOT EXISTS idx_earnings_status ON earnings(status);
CREATE INDEX IF NOT EXISTS idx_earnings_type ON earnings(type);
CREATE INDEX IF NOT EXISTS idx_earnings_created_at ON earnings(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_withdrawals_agent_id ON withdrawals(agent_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_requested_at ON withdrawals(requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON deposits(user_id);
CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE agent_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposits ENABLE ROW LEVEL SECURITY;

-- Agents can view their own wallet
CREATE POLICY "Agents can view own wallet" ON agent_wallets
  FOR SELECT USING (auth.uid() IN (
    SELECT user_id FROM user_agents WHERE id = agent_id
  ));

-- Agents can view their own earnings
CREATE POLICY "Agents can view own earnings" ON earnings
  FOR SELECT USING (auth.uid() IN (
    SELECT user_id FROM user_agents WHERE id = agent_id
  ));

-- Agents can view their own withdrawals
CREATE POLICY "Agents can view own withdrawals" ON withdrawals
  FOR SELECT USING (auth.uid() IN (
    SELECT user_id FROM user_agents WHERE id = agent_id
  ));

-- Users can view their own deposits
CREATE POLICY "Users can view own deposits" ON deposits
  FOR SELECT USING (user_id = auth.uid());

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update wallet balance when earnings become available
CREATE OR REPLACE FUNCTION update_wallet_on_earning()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'available' AND OLD.status != 'available' THEN
    UPDATE agent_wallets
    SET balance = balance + NEW.net_amount,
        total_earned = total_earned + NEW.net_amount,
        updated_at = NOW()
    WHERE agent_id = NEW.agent_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_wallet_on_earning
  AFTER UPDATE ON earnings
  FOR EACH ROW
  EXECUTE FUNCTION update_wallet_on_earning();

-- Function to update wallet on withdrawal completion
CREATE OR REPLACE FUNCTION update_wallet_on_withdrawal()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE agent_wallets
    SET balance = balance - NEW.amount,
        updated_at = NOW()
    WHERE agent_id = NEW.agent_id;
  ELSIF NEW.status = 'pending' AND OLD IS NULL THEN
    -- New withdrawal request - reserve the balance
    UPDATE agent_wallets
    SET balance = balance - NEW.amount,
        updated_at = NOW()
    WHERE agent_id = NEW.agent_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_wallet_on_withdrawal
  AFTER INSERT OR UPDATE ON withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION update_wallet_on_withdrawal();

-- ============================================
-- GRANT PERMISSIONS
-- ============================================
GRANT ALL ON TABLE agent_wallets TO authenticated;
GRANT ALL ON TABLE earnings TO authenticated;
GRANT ALL ON TABLE withdrawals TO authenticated;
GRANT ALL ON TABLE deposits TO authenticated;

GRANT ALL ON TABLE agent_wallets TO service_role;
GRANT ALL ON TABLE earnings TO service_role;
GRANT ALL ON TABLE withdrawals TO service_role;
GRANT ALL ON TABLE deposits TO service_role;

-- ============================================
-- SEED DATA (for testing)
-- ============================================

-- Note: Only run this if you have existing agents in user_agents table
-- Uncomment and modify the agent_id to match your test agent

/*
INSERT INTO agent_wallets (agent_id, balance, pending_balance, total_earned, currency)
SELECT id, 154750, 32500, 215000, 'USD'
FROM user_agents
WHERE name = 'Test Agent'
ON CONFLICT (agent_id) DO NOTHING;

INSERT INTO earnings (agent_id, type, status, amount, platform_fee, net_amount, currency, task_title, description, available_at)
SELECT 
  ua.id,
  'task_completion',
  'available',
  15000,
  2250,
  12750,
  'USD',
  'Website SEO Optimization',
  'Completed SEO optimization for company website',
  NOW()
FROM user_agents ua
WHERE ua.name = 'Test Agent'
ON CONFLICT DO NOTHING;
*/
