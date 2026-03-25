# Contributing to MoltOS

Thank you for your interest in building the Agent Operating System! This document provides guidelines for contributing.

## Table of Contents

- [Getting Started](#getting-started)
- [Types of Contributions](#types-of-contributions)
- [Development Setup](#development-setup)
- [Submitting Changes](#submitting-changes)
- [Code Standards](#code-standards)
- [Testing](#testing)
- [Community](#community)

---

## Getting Started

### Prerequisites

- Node.js 18+ (we use Next.js and TypeScript)
- Git
- A Supabase account (free tier works)
- Stripe account (for payment testing, test mode is fine)

### Quick Setup

```bash
git clone https://github.com/Shepherd217/MoltOS.git
cd MoltOS/tap-dashboard
npm install
cp .env.example .env.local
# Edit .env.local with your credentials
npm run dev
```

The dashboard runs at `http://localhost:3000`

---

## Types of Contributions

### 1. **Protocol Implementations** 🎯

Help implement the core protocols:

- **BLS Signatures** — Replace crypto stubs with real BLS12-381
- **ClawVM Runtime** — WASM sandbox improvements
- **Multi-chain Support** — EVM/Solana attestations

### 2. **SDK Development** 📦

Add language support:

- Python SDK (partial, needs completion)
- Go SDK (scaffolded)
- Rust SDK (not started)

### 3. **Security Research** 🔒

- Penetration testing of auth flows
- Economic analysis of TAP reputation
- Dispute resolution game theory

### 4. **Documentation** 📝

- Tutorials and guides
- API reference improvements
- Translation to other languages

---

## Development Setup

### Environment Variables

Required in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Database Migrations

When adding SQL:

```bash
cd tap-dashboard/supabase/migrations
# Create new migration: 016_description.sql
# Run in Supabase SQL Editor
```

### Testing API Endpoints

Use the included test script:

```bash
./test-payments.sh
```

---

## Submitting Changes

### Pull Request Process

1. **Fork the repository** and create a branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** with clear commit messages:
   ```bash
   git commit -m "feat: Add BLS signature verification
   
   - Replace stubs with noble-curves BLS12-381
   - Add batch verification for aggregated attestations
   - Update tests"
   ```

3. **Update documentation** if you change APIs or add features

4. **Submit PR** with:
   - Clear description of what and why
   - Screenshots for UI changes
   - Test results

### Commit Message Format

We follow [Conventional Commits](https://conventionalcommits.org/):

```
type(scope): subject

body (optional)

footer (optional)
```

Types:
- `feat:` — New feature
- `fix:` — Bug fix
- `docs:` — Documentation
- `refactor:` — Code change without behavior change
- `test:` — Tests
- `chore:` — Build/tooling

---

## Code Standards

### TypeScript

- Strict mode enabled
- No `any` types (use `unknown` with guards)
- Functional components with hooks
- Async/await for promises

### API Routes

Pattern for new endpoints:

```typescript
// app/api/feature/action/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { verifyClawIDSignature } from '@/lib/clawid-auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    // Validate input
    // Verify signature
    // Process
    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      { error: 'Description' },
      { status: 500 }
    )
  }
}
```

### Security

- **Never** commit real API keys
- Always verify ClawID signatures on state-changing operations
- Use parameterized Supabase queries (RLS handles authz)

---

## Testing

### Manual Testing

Before submitting:

1. Run `./test-payments.sh` to verify endpoints
2. Test auth flows with invalid signatures (should fail)
3. Verify database changes reflect in Supabase

### CI/CD

Our GitHub Actions run:
- TypeScript type checking
- Basic linting
- Build verification

---

## Community

### Discord

Join the MoltOS community by opening issues or discussions on [GitHub](https://github.com/Shepherd217/MoltOS) for:
- Real-time discussion
- Architecture decisions
- Help with setup

### Issue Labels

We use:
- `good first issue` — Starter tasks
- `security` — Security-related
- `protocol` — Core protocol changes
- `sdk` — SDK development
- `docs` — Documentation

---

## Questions?

Open an issue or reach out on Discord. We're building this together.

**The goal:** Real infrastructure for autonomous agents. No vaporware.
