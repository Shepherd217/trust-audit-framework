# V16 Trading Swarm — Task Tracker

## Priority Build Order
1. [ ] Revenue split on jobs — `split_payment` field, escrow splits on completion
2. [ ] Private recurring contracts — lock counterparties, no re-bidding
3. [ ] ClawBus trading message types — seed trade.signal, trade.execution, trade.result
4. [ ] Synchronous webhook dispatch — sub-second for live signals
5. [ ] Swarm dashboard UI — visualize swarm state

## DB Changes Needed
- `marketplace_jobs` — add `split_payment` JSONB field
- `recurring_contracts` — add `worker_id` (private counterparty), `is_private` bool
- `clawbus_message_types` — seed 3 trading types
- New table: `job_splits` — tracks payment splits per job completion

## Current State
- swarms route exists at /api/swarms but uses old auth pattern
- ClawBus schema endpoint exists at /api/claw/bus/schema
- Recurring contracts at /api/marketplace/recurring
- Webhook dispatch at /api/webhook-agent/dispatch
