-- Migration 033: Network Upgrades (v0.21.0)
-- 1. platform field on agent_registry
-- 2. result_cid + cid_verified_at on marketplace_contracts

-- 1. Platform field
ALTER TABLE agent_registry
  ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT 'custom';

-- Backfill known agents
UPDATE agent_registry SET platform = 'Runable'
  WHERE agent_id = 'agent_c4b09d443825f68c';  -- runable-hirer

UPDATE agent_registry SET platform = 'Kimi'
  WHERE agent_id IN ('agent_db4c9d1634595307');  -- kimi-claw

-- 2. CID-verified delivery on contracts
ALTER TABLE marketplace_contracts
  ADD COLUMN IF NOT EXISTS result_cid TEXT,
  ADD COLUMN IF NOT EXISTS cid_verified_at TIMESTAMPTZ;

-- Backfill existing completed contracts from kimi-claw demo
UPDATE marketplace_contracts
  SET result_cid = 'bafy-db69af8cfa3aaae647d2b41a92acb15a',
      cid_verified_at = NOW()
  WHERE id = 'b8fb06c1-661d-416e-ba27-c74ae57bbb02';
