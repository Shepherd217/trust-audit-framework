# VIRAL EXPLOSION KIT — Critical Memory

## What This Is
Complete production stack for TAP (Trust Audit Protocol) viral launch. Includes dashboard, NFT contracts, SDK, social content, and deployment scripts. Based on Grok's forensic analysis of DePIN growth patterns.

## Status: PRE-LAUNCH
- 32 agents confirmed
- 4 slots remaining
- Launch: Sunday March 9, 2026 00:00 UTC

## Complete File Inventory

### Dashboard (`tap-dashboard/`)
| File | Purpose |
|------|---------|
| `app/page.tsx` | Next.js 15 dashboard with real-time attestations |
| `deploy.sh` | One-command Vercel + Supabase deployment |
| `DEPLOY.md` | Manual deployment instructions |
| `supabase/schema.sql` | Full database schema |
| `SOCIAL_CONTENT.md` | Sunday launch content pack |

### Contracts (`tap-contracts/`)
| File | Purpose |
|------|---------|
| `TAPFoundingNFT.sol` | Soulbound NFT (32 max, EIP-5192, Base chain) |

### SDK (`tap-sdk/`)
| File | Purpose |
|------|---------|
| `src/index.ts` | TAPClient with BLS aggregation |
| `src/types.ts` | TypeScript definitions |
| `package.json` | NPM config (@tap-protocol/sdk) |
| `README.md` | Documentation |

## Key Metrics to Track
- Agents: 32 → 100 → 500 → 1,000+
- Pairs: 496 → 2,100 → O(n) → O(log n)
- ALPHA: 16,000 staked
- Karma: 236 (Moltbook)
- GitHub Commits: 23

## Stake Tiers
| Tier | Min Stake | Multiplier | Benefits |
|------|-----------|------------|----------|
| Bronze | 750 ALPHA | 1.0x | Basic verification |
| Silver | 2,500 ALPHA | 1.2x | Priority committee, +20% rewards |
| Gold | 10,000 ALPHA | 1.5x | Governance, dispute pool share |

## Sunday Launch Sequence
1. 23:30 UTC — Final check-in
2. 23:45 UTC — Roll call
3. 00:00 UTC — **LIVE**

## Social Content Hooks
- Pre-launch: "⏰ 2 HOURS ⏰ 32 agents. 496 pairs. 16,000 ALPHA."
- Launch: "🚀 LIVE NOW 🚀 TAP is officially live."
- Post-launch: "32 agents made history today."

## Critical URLs
- GitHub: `https://github.com/Shepherd217/trust-audit-framework`
- Moltbook API Key: `moltbook_sk_KlcQQUeG3RG6Sz1O5YrhBlQHkh-LRFMM`

## What User Must Do
1. Deploy dashboard: `cd tap-dashboard && ./deploy.sh`
2. Deploy NFT: `cd tap-contracts && npx hardhat run scripts/deploy.ts --network base`
3. Publish SDK: `cd tap-sdk && npm publish`

## Quote
> "This is the exact stack that made Ethereum, Chainlink, and Helium go parabolic."

---
*Last updated: March 7, 2026 04:18 GMT+8*
*Context: Pre-launch checkpoint before deployment*
