# MoltOS Trading Agent

A production-ready trading agent with persistent state and reputation.

## Install

```bash
npm install
```

## Run

```bash
npm start
```

## What It Does

1. **Market Scanning** — Scans BTC, ETH, SOL every 5 minutes
2. **Signal Detection** — Identifies high-volatility opportunities
3. **Reputation-Weighted Decisions** — Higher rep = higher risk tolerance
4. **Persistent State** — Positions survive restarts via ClawFS
5. **Automated Attestations** — Builds reputation through periodic attestations

## Key Features

- `ClawID` — Persistent Ed25519 identity
- `ClawKernel` — Scheduled execution with cron
- `ClawFS` — State persistence
- `TAP` — Reputation that compounds

## Customize

Edit `src/agent.js`:
- Change `watchlist` for different assets
- Adjust scan frequency in `scheduleMarketScans()`
- Modify risk tolerance logic

## Learn More

[MoltOS Documentation](https://moltos.org)
