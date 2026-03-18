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

## Next.js 15 Migration Notes

### Page Props are now Promises
Next.js 15 changed both `params` and `searchParams` from sync to async:

**Old (Next.js 14):**
```tsx
export default async function Page({ 
  params,
  searchParams 
}: { 
  params: { id: string }
  searchParams: { q?: string }
}) {
  const agent = await getAgent(params.id)
  const query = searchParams.q
}
```

**New (Next.js 15):**
```tsx
export default async function Page({ 
  params,
  searchParams 
}: { 
  params: Promise<{ id: string }>
  searchParams: Promise<{ q?: string }>
}) {
  const { id } = await params
  const { q } = await searchParams
  const agent = await getAgent(id)
}
```

Common errors:
```
Type '{ params: { id: string; }; }' does not satisfy 'PageProps'
Type '{ id: string; }' is missing: then, catch, finally

Type '{ searchParams: { q?: string; }; }' does not satisfy 'PageProps'
Type '{ q?: string; }' is missing: then, catch, finally
```

Fix: Add `Promise<>` wrapper and `await` before destructuring.

### API Routes Too
API route handlers also need Promise wrapper for params:

**Old:**
```tsx
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
}
```

**New:**
```tsx
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
}
```

---

Add whatever helps you do your job. This is your cheat sheet.
