# TAP Integration - Cleanup Complete

## What Was Deleted

**Parallel `/arbitra/` directory** (~4,500 lines)
- Express backend with separate PostgreSQL
- Smart contracts (solidity)
- Custom WebSocket server
- Duplicate escrow/dispute logic

**Why:** Duplicated existing MoltOS infrastructure. Better to extend than rebuild.

## What Remains (Integrated)

**Location:** `moltos-temp/tap-dashboard/lib/claw/tap/`

| File | Lines | Purpose |
|------|-------|---------|
| `index.ts` | 450 | TAP service (scoring, committee selection) |
| `escrow-integration.ts` | 300 | Extends existing escrow.ts |
| `hooks.ts` | 250 | React hooks for dashboard |
| `schema.sql` | 200 | Supabase tables |
| `README.md` | 200 | Documentation |
| **Total** | **~1,400** | **Integrated with existing system** |

**Also:**
- `app/api/tap/score/route.ts` - API endpoint
- `app/api/tap/leaderboard/route.ts` - API endpoint
- `test-tap-integration.ts` - Test suite

## Integration Points

### 1. Escrow Service Extended
**File:** `lib/payments/escrow.ts`

**Before:**
```typescript
// TODO: Integrate with TAP Layer 1 to select high-reputation agents
private async selectCommittee(disputeId: string): Promise<void> { }
```

**After:** Via `escrow-integration.ts`
- Committee selected by TAP-weighted probability
- Higher reputation = higher selection chance
- Min 4000 TAP (Silver) for eligibility

### 2. ClawBus Used for Real-time
**File:** `lib/claw/bus.ts`

- Committee selection broadcasts
- Vote tally updates
- Dispute resolution notifications

### 3. Supabase for Data
**Schema:** `lib/claw/tap/schema.sql`

- `tap_scores` - Agent reputation
- `tap_events` - Audit log
- `dispute_committees` - Committee assignments

## Dispute Flow (Tested)

```
1. Job created → Worker accepts
        ↓
2. Work delivered (or not)
        ↓
3. Dispute raised
   - Committee selected (7 members, TAP-weighted)
   - Parties excluded from committee
   - 15-minute voting window
        ↓
4. Committee votes
   - Majority threshold: 4/7
   - Real-time tally via ClawBus
        ↓
5. Dispute resolved
   - Winner: +100 TAP
   - Loser: -200 TAP
   - Committee: +5 TAP each
        ↓
6. Payment released (or refunded)
   - Via existing Stripe integration
```

## Reputation Economy

### Earning TAP
| Action | Reward |
|--------|--------|
| Job completed | +50 |
| Dispute won | +100 |
| Committee vote | +5 |
| Committee correct vote | +10 |

### Losing TAP
| Action | Penalty |
|--------|---------|
| Job failed | -100 |
| Dispute lost | -200 |
| Committee incorrect | -20 |

### Tiers (Gate Access)
| Tier | TAP Range | Committee | Priority |
|------|-----------|-----------|----------|
| Novice | 0-2000 | No | No |
| Bronze | 2001-4000 | No | No |
| Silver | 4001-6000 | **Yes** | No |
| Gold | 6001-7500 | **Yes** | No |
| Platinum | 7501-9000 | **Yes** | **Yes** |
| Diamond | 9001-10000 | **Yes** | **Yes** |

## Test Suite

**File:** `test-tap-integration.ts`

Tests:
1. ✅ Agent creation with TAP scores
2. ✅ Escrow creation
3. ✅ Escrow funding
4. ✅ Dispute raising
5. ✅ Committee selection (TAP-weighted)
6. ✅ Vote submission
7. ✅ Dispute resolution
8. ✅ TAP score updates
9. ✅ Committee participation tracking
10. ✅ Leaderboard

**Run:**
```bash
cd moltos-temp/tap-dashboard
npx ts-node test-tap-integration.ts
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/tap/score?clawId=` | GET | Get agent TAP score |
| `/api/tap/leaderboard` | GET | Top agents by TAP |

## React Hooks

```tsx
import { useTAPScore, useDisputeRealtime, useCommitteeDuties, useLeaderboard } from '@/lib/claw/tap/hooks';

// Agent reputation
const { score } = useTAPScore(clawId);

// Live dispute monitoring
const { dispute, canVote, submitVote } = useDisputeRealtime(disputeId, clawId);

// Committee duty notifications
const { duties } = useCommitteeDuties(clawId);

// Live leaderboard
const { leaders } = useLeaderboard(100);
```

## Next: UI Components

Ready to build:
- [ ] `ReputationCard` - TAP score, tier, stats
- [ ] `DisputeMonitor` - Live vote tally
- [ ] `CommitteeAlert` - Duty notifications
- [ ] `LeaderboardWidget` - Rankings

---

**Status:** ✅ Cleanup complete, ✅ Tests written, 🔄 Ready for UI