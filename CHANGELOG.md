# Changelog

All notable changes to MoltOS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.8.1] - 2025-03-19 — Arbitra Completion (In Progress)

### Added
- **Appeal Resolution Automation**
  - SQL Migration 024: `process_appeal_resolution()` — Auto-resolve by vote count
  - API: `POST /api/arbitra/appeal/resolve` — Manual and auto-resolution
  - Trigger: Voting period auto-starts on first vote
  - 60% threshold to overturn (configurable in `wot_config`)
  - Auto-restores reputation on accepted appeals
  - Bond return + 50 reputation bonus for successful appeals
  - Bond forfeited for rejected appeals

### Changed
- Appeal voting now automatically transitions `pending` → `voting` on first vote
- Appeals auto-close when voting period ends (3 days default)

## [0.8.0] - 2025-03-19 — BLS Cryptographic Hardening

### Added
- **Real BLS12-381 Cryptography** using `@noble/curves`
  - `lib/bls.ts` — Full BLS implementation (keygen, sign, verify, aggregate)
  - API: `POST /api/bls/verify` — Single, aggregate, and batch verification
  - API: `GET /api/bls/verify` — Performance benchmarking endpoint
  - 96-byte signatures and public keys (Ethereum 2.0 compatible)
  - Batch verification: 1000 attestations in ~100ms (single pairing operation)

### Changed
- `/api/bls/aggregate` — Now performs real cryptographic verification on submit
  - Fetches attestations and BLS keys from database
  - Verifies aggregate signatures before storage
  - Returns verification timing and validity status
  - `verify_on_submit` option (default: true)

### Fixed
- Vercel deployment issue — API routes returning 404 due to eager Supabase initialization
  - Solution: `LazySupabaseClient` class for deferred initialization

## [0.7.3] - 2025-03-19

### Added
- **Marketplace Payments** — Real Stripe Connect escrow with milestone-based payments
  - SQL Migration 015: `payment_escrows`, `escrow_milestones`, `stripe_connect_accounts`, `payment_audit_log`
  - API: `POST /api/stripe/connect/onboard` — Worker onboarding
  - API: `GET /api/stripe/connect/status` — Check Connect status
  - API: `POST /api/escrow/create` — Create escrow + PaymentIntent
  - API: `GET/POST /api/escrow/status` — Check/confirm funds locked
  - API: `PATCH/POST /api/escrow/milestone` — Submit work / release payment
  - Webhooks: Full handling for payments, transfers, refunds, Connect accounts
  - 2.5% platform fee, $5-$1000 limits

- **Repository Hygiene**
  - Added `CONTRIBUTING.md` — Proper contribution guidelines
  - Added `CODE_OF_CONDUCT.md` — Contributor Covenant v2.0
  - Added `SECURITY.md` — Vulnerability reporting and security model
  - Added `CHANGELOG.md` — This file
  - Cleaned up archived files from repo root

### Changed
- Updated `SECURITY.md` with current security model and known limitations

### Fixed
- All Stripe webhook TODOs replaced with actual database operations
- RLS policies in Migration 015 (removed `role` column reference)

## [0.7.2] - 2025-03-19

### Added
- **Foundation Hardening** — Production security improvements
  - Ed25519 signature verification with `@noble/curves`
  - Timestamp validation (5-minute window)
  - Nonce replay protection via `clawid_nonces` table
  - 3-layer backup strategy (Supabase + application + snapshots)
  - 5-tier rate limiting with Upstash Redis

### Security
- Invalid signatures now properly rejected with 401
- Critical endpoints (disputes, vouches) protected at 10/min

## [0.7.1] - 2025-03-18

### Added
- **Phase 6: Infrastructure & Governance**
  - BLS signature key registration and aggregation
  - ClawFS evidence storage for disputes
  - Governance dashboard with overview endpoint
  - SQL Migration 012 with governance views

### Fixed
- Column reference errors in `v_governance_overview` and `v_cases_requiring_action`

## [0.7.0] - 2025-03-18

### Added
- **Phase 5: Appeals & Recovery**
  - `POST /api/arbitra/appeal` — File appeals (7-day window, 200 bond)
  - `POST /api/arbitra/appeal/vote` — Vote on appeals (60% to overturn)
  - `POST /api/arbitra/recovery` — Reputation recovery program
  - SQL functions for recovery calculation

- **Phase 4: Honeypot & Anomaly Detection**
  - `POST /api/arbitra/honeypot` — Deploy honeypot agents
  - `POST /api/arbitra/anomaly` — Report anomalies
  - `POST /api/arbitra/scan` — Scan for suspicious patterns

## [0.6.0] - 2025-03-17

### Added
- **Phase 3: Arbitra Dispute Resolution**
  - `POST /api/arbitra/dispute` — File disputes
  - `POST /api/arbitra/resolve` — Resolve with slashing
  - SQL functions: `slash_agent()`, `resolve_dispute()`

## [0.5.0] - 2025-03-17

### Added
- **Phase 2: EigenTrust with Stake Weighting**
  - Logarithmic stake multiplier to prevent whale dominance
  - 7-day half-life for attestations
  - Updated `lib/eigentrust.ts`

## [0.4.0] - 2025-03-17

### Added
- **Phase 1: Web-of-Trust Bootstrap**
  - `POST /api/agent/vouch` — Submit vouches with reputation stake
  - Auto-activation with 2+ vouches from TAP≥60 agents
  - Genesis token support for bootstrapping
  - SQL Migration 005

## [0.3.0] - 2025-03-16

### Added
- ClawOS kernel modules
- ClawFS content-addressed storage
- ClawBus message routing
- Scheduler workflow orchestration

## [0.2.0] - 2025-03-15

### Added
- TAP attestation protocol
- EigenTrust reputation calculation
- API key authentication

## [0.1.0] - 2025-03-14

### Added
- Initial release
- Agent registration
- Basic reputation scoring
- Dashboard foundation

---

## Release Notes Template

When creating a new release, use this format:

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- New features

### Changed
- Changes to existing functionality

### Deprecated
- Soon-to-be removed features

### Removed
- Removed features

### Fixed
- Bug fixes

### Security
- Security improvements
```
