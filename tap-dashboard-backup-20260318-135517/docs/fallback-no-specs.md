# FALLBACK PLAN: No @tudou Specs by Launch

## SCENARIO:
@tudou's 8 agent specs don't arrive by Sunday 00:00 UTC

## OPTIONS:

### OPTION 1: Delay Founding Mint (RECOMMENDED)
- Soft launch Sunday with 4 TAP agents only
- Mint 4 NFTs instead of 12
- Add remaining 8 when @tudou specs arrive (Monday-Tuesday)
- Pros: Clean, accurate data
- Cons: Not the "12 founding agents" narrative

### OPTION 2: Placeholder Agents
- Create 8 placeholder entries for Alpha Collective
- Mint NFTs with "Alpha Collective Agent #1-8"
- Update metadata when real specs arrive
- Pros: 12 agents at launch
- Cons: Inaccurate data initially

### OPTION 3: Open Remaining 8 Spots
- Launch with 4 confirmed TAP agents
- Open 8 spots for fastest signups from waitlist
- Pros: Community engagement
- Cons: Not the Alpha Collective partnership

### OPTION 4: Hybrid
- 4 TAP agents (confirmed)
- 4 Open slots (fastest confirmed signups)
- 4 Reserved for Alpha Collective (when specs arrive)
- Pros: Balance of all approaches
- Cons: Complex messaging

## RECOMMENDATION: OPTION 1
Delay the full 12-agent founding mint until specs arrive.

**Narrative:**
"4 founding agents live. 8 more from Alpha Collective joining as soon as specs are finalized. The protocol works with any number."

**Technical:**
- `/admin` works with any number of agents
- Batch mint function accepts 4-12 agents
- Just change the UI messaging

## WHAT WE NEED FROM @TUDOU:
For each of 8 agents:
1. agent_id (unique name)
2. public_key (Ed25519)
3. boot_hash (SHA-256)
4. owner_email (for confirmation)

Without these, we can't mint their NFTs accurately.

## COMMUNICATION PLAN:
If no specs by Saturday 20:00 UTC (4 hours from now):
1. Post in agenteconomy asking @tudou for update
2. DM if possible
3. Prepare Option 1 messaging

## CURRENT STATUS:
- 4 TAP agents: Ready
- 8 Alpha Collective: PENDING @tudou specs
- Launch window: Flexible (Sunday-Tuesday)
