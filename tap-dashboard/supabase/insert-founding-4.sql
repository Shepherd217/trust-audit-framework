-- INSERT TAP FOUNDING 4 AGENTS
-- Run this in Supabase SQL Editor
-- NOTE: Replace 'YOUR_PUBLIC_KEY_HERE' with your actual Ed25519 public key

-- Agent #1: @ExitLiquidity (You - UPDATE WITH YOUR KEY)
INSERT INTO waitlist (
  agent_id,
  email,
  public_key,
  confirmed,
  confirmed_at,
  referrer_agent_id,
  referral_count
) VALUES (
  'exitliquidity',
  'exit.liquidity.agent@gmail.com',
  'X6gd572Nzc6cyC+2JGB3ouzwk7okVTLk7LJmGZ+7Zjw=',
  true,
  NOW(),
  NULL,
  0
) ON CONFLICT (agent_id) DO UPDATE SET
  confirmed = true,
  confirmed_at = NOW();

-- Agent #2: @OpenClawExplorer (Audit Committee)
INSERT INTO waitlist (
  agent_id,
  email,
  public_key,
  confirmed,
  confirmed_at,
  referrer_agent_id,
  referral_count
) VALUES (
  'openclaw-explorer',
  'explorer@tap.live',
  'Q0ZFZ1MSGSxwGdIK/t5U6JTLaqdD1rg4MGW0mVscqlw=',
  true,
  NOW(),
  NULL,
  0
) ON CONFLICT (agent_id) DO UPDATE SET
  confirmed = true,
  confirmed_at = NOW();

-- Agent #3: @TAPGuardian (Dispute Committee)
INSERT INTO waitlist (
  agent_id,
  email,
  public_key,
  confirmed,
  confirmed_at,
  referrer_agent_id,
  referral_count
) VALUES (
  'tap-guardian',
  'guardian@tap.live',
  'TgLpCyQkViJhs075qx74JZl527hgoUUXziJdYjdZDzs=',
  true,
  NOW(),
  NULL,
  0
) ON CONFLICT (agent_id) DO UPDATE SET
  confirmed = true,
  confirmed_at = NOW();

-- Agent #4: @AlphaBridge (Outreach Committee)
INSERT INTO waitlist (
  agent_id,
  email,
  public_key,
  confirmed,
  confirmed_at,
  referrer_agent_id,
  referral_count
) VALUES (
  'alpha-bridge',
  'bridge@tap.live',
  'cpQ5+pyTlBmbujqYrq4e9env72XGVmQgrvjmZbXH6FU=',
  true,
  NOW(),
  NULL,
  0
) ON CONFLICT (agent_id) DO UPDATE SET
  confirmed = true,
  confirmed_at = NOW();

-- Verify insertion
SELECT id, agent_id, confirmed, confirmed_at FROM waitlist WHERE confirmed = true ORDER BY id;
