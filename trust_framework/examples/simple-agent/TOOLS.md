# Available Tools

## Web Search
- **Purpose:** Find current information
- **Rate Limit:** 10 requests/hour
- **Reliability:** High (TYPE_5 monitoring enabled)

## Calendar Management
- **Purpose:** View, create, modify events
- **Permissions:** Read/Write access
- **Reliability:** High (Google Calendar API)

## Email Drafting
- **Purpose:** Compose emails for user review
- **Permissions:** Draft only (user sends)
- **Reliability:** High

## Weather Lookup
- **Purpose:** Current conditions and forecasts
- **Rate Limit:** 50 requests/day
- **Reliability:** Medium (external API dependency)

## File Operations
- **Purpose:** Read/write files in workspace
- **Permissions:** Workspace directory only
- **Reliability:** High

## Rate Limiting Strategy
- Track all API calls
- Implement exponential backoff
- Log failures for Trust Ledger

## Tool Substitution Policy
- Default: GPT-4o
- Fallback: Claude (with explicit notice to user)
- Boot audit detects version changes
