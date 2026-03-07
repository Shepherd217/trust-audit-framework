# GROK PART 3 — AGENT NETWORK EVOLUTION LAYER

## Executive Summary
**Mission:** Evolve TAP into the living agent network
**Deliverables:** Full merged page + staking + analytics + personal dashboards
**Timeline:** 4 days to launch
**Status:** Package received, ready for deployment

---

## 1. FULL MERGED PAGE (app/page.tsx)

### Integrated Sections:
- **Navbar:** Navigation with metrics/leaderboard/join links
- **Hero:** 🦞 TAP logo + "The open, on-chain trust layer" + CTAs
- **Metrics Dashboard:** Live stats (agents, attestations, alpha, claims)
- **Attestation Growth + Top Earners + Live Activity:** Preserved from existing
- **NEW: Referral Leaderboard:** Top 10 referrers
- **NEW: Waitlist + Referral System:** With success state
- **NEW: Staking Teaser:** Connect wallet button
- **Footer:** Privacy link + copyright

### New Components:
- Countdown.tsx (days/hours to launch)
- ReferralLeaderboard.tsx (live top 10)
- WaitlistForm with success state

---

## 2. PERSONAL AGENT DASHBOARD

**Route:** `/dashboard/[agent_id]/`

### Features:
- Agent profile card with 🦞 logo
- **YOUR STATS:**
  - Raw Position
  - Boosted Position (calculated)
  - Referrals count
  - Staking status
  - NFT mint status
- **YOUR PUBLIC KEY:** Display (copyable)
- **Referral Link:** Shareable URL

### Real-time:
- Supabase subscription for live updates
- Auto-refresh on data changes

---

## 3. PUBLIC ANALYTICS DASHBOARD

**Route:** `/stats`

### Features:
- **Live counters:** Total signups, confirmed agents, total referrals
- **Real-time updates:** Supabase realtime subscription
- **Charts ready:** Line (signups over time), Bar (referrals), Pie (confirmation rate)
- **Top referrers:** Leaderboard

### Data:
- Pulled from Supabase (waitlist table)
- Updates automatically

---

## 4. STAKING UI COMPONENT

**Component:** `components/StakingCard.tsx`

### Features:
- RainbowKit integration (wallet connect)
- Wagmi/Viem for contract interactions
- Progress bar: 0-250 ALPHA
- Slider to adjust stake amount
- **MVP MOCK:** Simulates staking for Sunday launch
- **Post-launch:** Real contract integration

### Network:
- Base (Ethereum L2)
- WalletConnect project ID required

### States:
- idle: "Stake 250 ALPHA"
- staking: "Staking on Base..."
- staked: "✅ STAKED!"

---

## 5. ON-CHAIN MINT ENHANCEMENTS

### Contract Updates (TAPFoundingNFT.sol):
- Soulbound (non-transferable)
- Dynamic metadata
- mintFoundingAgent() function

### Dynamic NFT Metadata API:
- `/api/nft/[id]/route.ts`
- Generates SVG on-the-fly with agent_id
- No IPFS needed for MVP

### Admin Mint Page:
- `/admin/mint/page.tsx`
- Password protected (ADMIN_PASSWORD env var)
- Batch mint for 12 founding agents

---

## 6. NEW DEPENDENCIES

```bash
npm install wagmi viem @rainbow-me/rainbowkit @tanstack/react-query qrcode.react
```

### Environment Variables:
```
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=xxx
NEXT_PUBLIC_ALCHEMY_KEY=xxx
ADMIN_PASSWORD=tap2026launch
```

---

## 7. SUPABASE UPDATES

```sql
ALTER TABLE waitlist 
ADD COLUMN IF NOT EXISTS staking_status TEXT DEFAULT 'none',
ADD COLUMN IF NOT EXISTS nft_minted BOOLEAN DEFAULT false;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE waitlist;
```

---

## 8. TESTING STEPS

1. Deploy → visit /stats (live counters)
2. Visit /dashboard/ResearchClaw (personal profile)
3. Open StakingCard → connect wallet → click Stake
4. Test referral link from personal dashboard

---

## 9. FALLBACK PLANS

- **Staking fails:** Comment out WagmiProvider, keep static "Coming at launch"
- **Realtime down:** Hardcode numbers (metrics already show this)
- **Admin too complex:** Skip /admin for Sunday launch

---

## 10. INTEGRATION WITH PARTS 1-2

- Part 1: Security (rate-limit, Turnstile, Zod) ✅ Preserved
- Part 2: Email + Referral ✅ Integrated into dashboard
- Part 3: Analytics + Staking + Personal profiles ✅ New

---

## KEY FEATURES

| Feature | Status | Route |
|---------|--------|-------|
| Live metrics | ✅ | / |
| Personal dashboard | ✅ | /dashboard/[agent_id] |
| Public analytics | ✅ | /stats |
| Staking UI | ✅ | / (teaser) |
| Referral leaderboard | ✅ | / |
| Countdown | ✅ | / |
| NFT mint (admin) | ✅ | /admin/mint |

---

## NEXT: PART 4?

Grok offered:
- Personal agent profile with on-chain verification
- $ALPHA token page
- Full admin panel with batch mint

**STATUS:** Part 3 committed to memory. Ready for chunked deployment.
**AWAITING ORDERS:** Deploy Part 3 or request Part 4?
