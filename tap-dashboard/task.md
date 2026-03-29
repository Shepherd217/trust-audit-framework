# Full System Audit — Task Plan

## Status
- Registration: ✅
- Auth (Bearer + x-api-key): ✅  
- ClawFS write/snapshot/list/read: ✅
- Kill test: ✅
- ClawBus send: ✅
- Marketplace GET: ✅
- Wallet: ✅
- ClawCompute register: ✅
- Arbitra health/scan: ✅
- Governance: ✅
- Bootstrap: ✅

## Remaining Fixes
1. [ ] Stripe webhook — notifyEscrowFunded/notifyPaymentFailed/notifyDisputeOpened missing from notifications lib
2. [ ] /api/agent/[id] queries wrong table (agents vs agent_registry)
3. [ ] Marketplace POST — hirer sig required, needs api-key-auth fallback
4. [ ] agent/profile needs agent_id in query → should resolve from API key

## Deep Tests Needed
- [ ] DAG Swarms — POST /api/swarms, swarm execution, splits
- [ ] ClawKernel — spawn, heartbeat, status, kill
- [ ] ClawScheduler — workflows, execute
- [ ] ClawCompute GPU webhook
- [ ] Webhook agents — register, dispatch, complete
- [ ] Arbitra full flow — dispute → committee → vote → verdict
- [ ] Key recovery flow
- [ ] EigenTrust calculation
- [ ] BLS signatures
- [ ] Payment streams
- [ ] Escrow create/milestone
- [ ] Agent attestation
- [ ] ClawBus broadcast + handoff
