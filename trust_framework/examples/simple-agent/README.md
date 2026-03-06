# Simple Agent Example

This directory contains a minimal example of an agent implementing the Trust Audit Framework.

## Structure

```
simple-agent/
├── AGENTS.md          # Agent identity
├── SOUL.md            # Personality/constraints
├── USER.md            # Human preferences
├── TOOLS.md           # Available tools
├── MEMORY.md          # Long-term memory
├── HEARTBEAT.md       # Periodic tasks
├── agent.py           # Main agent code
└── README.md          # This file
```

## Quick Start

```bash
# 1. Enter the example directory
cd examples/simple-agent

# 2. Run the boot audit
../../trust-audit-cli.sh boot-audit --agent-id simple-agent --workspace ./

# 3. Check the output
cat boot-audit-simple-agent.json

# 4. Create a Trust Ledger
../../trust-audit-cli.sh ledger-create

# 5. Edit the ledger
vim trust-ledger-simple-agent.json

# 6. Validate everything
../../trust-audit-cli.sh validate
```

## Files Explained

### AGENTS.md
Who are you? What is your purpose?

```markdown
# Agent Identity

**Name:** Simple Agent
**Type:** Personal assistant
**Purpose:** Help with daily tasks
**Created:** 2026-03-01
**Runtime:** OpenClaw
```

### SOUL.md
What are your constraints? How do you behave?

```markdown
# Personality

**Tone:** Friendly but professional
**Values:** Honesty, efficiency, helpfulness
**Constraints:**
- Never share private data
- Always ask before executing irreversible actions
- Admit uncertainty rather than guessing
```

### USER.md
Who is your human? What do they prefer?

```markdown
# User Preferences

**Name:** Alice
**Timezone:** America/New_York
**Communication:** Brief, bullet points preferred
**Sensitive Topics:** Medical, financial
```

### TOOLS.md
What can you do?

```markdown
# Capabilities

## Tools Available
- Web search
- Calendar management
- Email drafting
- Weather lookup

## Rate Limits
- 100 requests/hour
```

### MEMORY.md
What do you remember?

```markdown
# Long-term Memory

- Alice prefers coffee over tea
- Alice has a dog named Max
- Last project: Website redesign (completed 2026-02-28)
```

### HEARTBEAT.md
What do you do periodically?

```markdown
# Periodic Tasks

## Daily
- [ ] Check calendar for tomorrow
- [ ] Review unread emails
- [ ] Weather check

## Weekly
- [ ] Trust Ledger publication
- [ ] Workspace cleanup
```

## Next Steps

1. Customize these files for your agent
2. Run the boot audit
3. Publish your Trust Ledger
4. Join Sunday's cross-verification event

See [QUICKSTART.md](../../QUICKSTART.md) for full details.
