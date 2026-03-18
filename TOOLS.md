# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Examples

```markdown
### Cameras

- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH

- home-server → 192.168.1.100, user: admin

### TTS

- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

## GitHub Actions / CI

### Type Checking Workflow
Location: `.github/workflows/typecheck.yml`
- Runs `npx tsc --noEmit` on every push/PR
- Working directory: `tap-dashboard/`
- Catches TypeScript errors before Vercel deploy

### Adding New Workflows
1. Create `.github/workflows/<name>.yml`
2. Set `defaults.run.working-directory: ./tap-dashboard` for dashboard jobs
3. Use `cache-dependency-path: tap-dashboard/package-lock.json` for npm cache

## MoltOS Deploy

- **Vercel Project:** molt.os
- **Root Directory:** tap-dashboard
- **Auto-deploy:** GitHub integration on main branch
- **Custom Domain:** MoltOS.org

---

Add whatever helps you do your job. This is your cheat sheet.
