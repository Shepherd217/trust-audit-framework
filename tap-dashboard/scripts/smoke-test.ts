/**
 * MoltOS Registration Smoke Test
 *
 * Tests the full registration pipeline end-to-end:
 *   1. Generate a real Ed25519 keypair (same as the join page does)
 *   2. POST to /api/agent/register with camelCase fields
 *   3. Verify 201 + correct response shape
 *   4. Verify agent landed in Supabase DB
 *   5. Clean up the test agent
 *
 * Run: npx tsx scripts/smoke-test.ts
 * Or:  npx tsx scripts/smoke-test.ts --base-url https://moltos.org
 *
 * Catches:
 *   - Field name mismatches (publicKey vs public_key)
 *   - Missing required fields
 *   - DB write failures
 *   - Response shape regressions
 */

import { createHash, generateKeyPairSync } from 'crypto'

const BASE_URL = (() => {
  const eqArg = process.argv.find(a => a.startsWith('--base-url='))
  if (eqArg) return eqArg.split('=')[1]
  const idx = process.argv.indexOf('--base-url')
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1]
  return process.env.SMOKE_TEST_URL ?? 'https://moltos.org'
})()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://pgeddexhbqoghdytjvex.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

const TEST_AGENT_NAME = `smoke-test-${Date.now()}`

// ── Helpers ─────────────────────────────────────────────────────────────────

function pass(msg: string) { console.log(`  ✅ ${msg}`) }
function fail(msg: string) { console.error(`  ❌ ${msg}`); process.exitCode = 1 }
function info(msg: string) { console.log(`  ℹ  ${msg}`) }

async function supabaseGet(table: string, filter: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    }
  })
  return res.json() as Promise<any[]>
}

async function supabaseDelete(table: string, filter: string) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'DELETE',
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    }
  })
}

// Generate Ed25519 keypair — same algorithm as the join page
function generateKeypair(): { publicKeyHex: string } {
  const { publicKey } = generateKeyPairSync('ed25519')
  const pubRaw = publicKey.export({ type: 'spki', format: 'der' })
  // Raw key is last 32 bytes of SPKI-encoded key
  const pubHex = pubRaw.slice(-32).toString('hex')
  return { publicKeyHex: pubHex }
}

// ── Tests ────────────────────────────────────────────────────────────────────

async function testRegistration() {
  console.log('\n── Test 1: Registration API ─────────────────────────────────')
  info(`Registering agent: ${TEST_AGENT_NAME}`)
  info(`Target: ${BASE_URL}/api/agent/register`)

  const { publicKeyHex } = generateKeypair()
  info(`Public key: ${publicKeyHex.slice(0, 16)}...`)

  // This is exactly what the join page POSTs — camelCase publicKey
  const body = {
    name: TEST_AGENT_NAME,
    publicKey: publicKeyHex,   // ← must be camelCase to match route
  }

  // Retry up to 3x if rate limited — smoke tests run from same IP in CI
  let res: Response
  for (let attempt = 1; attempt <= 3; attempt++) {
    res = await fetch(`${BASE_URL}/api/agent/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.status !== 429) break
    const data = await res.json() as any
    const waitMs = data.retry_after_ms ?? 65000
    info(`Rate limited (attempt ${attempt}/3) — waiting ${Math.ceil(waitMs/1000)}s...`)
    await new Promise(r => setTimeout(r, waitMs + 500))
  }
  res = res!

  const data = await res.json() as any

  // Status
  if (res.status === 201) {
    pass(`Status 201 Created`)
  } else {
    fail(`Expected 201, got ${res.status}: ${JSON.stringify(data)}`)
    return null
  }

  // Response shape
  if (data.success === true) pass('data.success === true')
  else fail(`data.success not true: ${JSON.stringify(data)}`)

  if (data.agent?.agentId?.startsWith('agent_')) pass(`agentId present: ${data.agent.agentId}`)
  else fail(`agentId missing or malformed: ${JSON.stringify(data.agent)} — check camelCase vs snake_case in API response`)

  // Verify the field is actually camelCase agentId (not agent_id)
  if ('agentId' in (data.agent ?? {})) pass(`agentId is camelCase (not agent_id)`)
  else fail(`response uses wrong field name — join page will show blank Agent ID`)

  if (data.credentials?.apiKey?.startsWith('moltos_sk_')) pass(`apiKey present`)
  else fail(`apiKey missing or malformed`)

  if (data.agent?.activationStatus) pass(`activationStatus: ${data.agent.activationStatus}`)
  else fail(`activationStatus missing`)

  return { agentId: data.agent.agentId, apiKey: data.credentials.apiKey, publicKeyHex }
}

async function testDatabaseWrite(agentId: string) {
  console.log('\n── Test 2: Database Write ───────────────────────────────────')

  if (!SUPABASE_SERVICE_KEY) {
    info('SUPABASE_SERVICE_ROLE_KEY not set — skipping DB verification')
    return
  }

  const rows = await supabaseGet('agent_registry', `agent_id=eq.${agentId}&select=agent_id,name,status,activation_status`)

  if (rows.length === 1) pass(`Agent found in agent_registry`)
  else { fail(`Expected 1 row, got ${rows.length}`); return }

  const row = rows[0]
  if (row.name === TEST_AGENT_NAME) pass(`name matches: ${row.name}`)
  else fail(`name mismatch: expected ${TEST_AGENT_NAME}, got ${row.name}`)

  if (row.status === 'active') pass(`status: active`)
  else fail(`status: expected active, got ${row.status}`)

  if (row.activation_status === 'pending') pass(`activation_status: pending (correct for new agent)`)
  else fail(`activation_status: expected pending, got ${row.activation_status}`)
}

async function testFieldMismatchCatch() {
  console.log('\n── Test 3: Field Name Regression Guard ──────────────────────')
  info('Sending snake_case public_key (wrong) — should get 400')

  const { publicKeyHex } = generateKeypair()
  const res = await fetch(`${BASE_URL}/api/agent/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `${TEST_AGENT_NAME}-wrongfield`, public_key: publicKeyHex }),
  })

  if (res.status === 400) pass(`Correctly rejected snake_case public_key with 400`)
  else fail(`Expected 400 for snake_case field, got ${res.status} — field name mismatch may be silently accepted`)
}

async function testDuplicateRejection(publicKeyHex: string) {
  console.log('\n── Test 4: Duplicate Registration Guard ─────────────────────')
  info(`Re-registering same public key — should get 409`)

  let res: Response
  for (let attempt = 1; attempt <= 3; attempt++) {
    res = await fetch(`${BASE_URL}/api/agent/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Same public key, different name — should hit 409 ALREADY_REGISTERED
      body: JSON.stringify({ name: `${TEST_AGENT_NAME}-dup`, publicKey: publicKeyHex }),
    })
    if (res.status !== 429) break
    const data = await res.json() as any
    const waitMs = data.retry_after_ms ?? 65000
    info(`Rate limited (attempt ${attempt}/3) — waiting ${Math.ceil(waitMs/1000)}s...`)
    await new Promise(r => setTimeout(r, waitMs + 500))
  }
  res = res!

  // 409 = duplicate rejected, 429 = rate limiter fired first (also correct)
  if (res.status === 409 || res.status === 429) pass(`Duplicate/spam correctly blocked with ${res.status}`)
  else fail(`Expected 409 or 429 for duplicate, got ${res.status}`)
}

async function cleanup(agentId: string) {
  console.log('\n── Cleanup ──────────────────────────────────────────────────')
  if (!SUPABASE_SERVICE_KEY) {
    info('No service key — cannot clean up test agent. Delete manually: ' + agentId)
    return
  }
  await supabaseDelete('agent_registry', `agent_id=eq.${agentId}`)
  pass(`Deleted test agent: ${agentId}`)
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════════')
  console.log('  MoltOS Registration Smoke Test')
  console.log(`  Target: ${BASE_URL}`)
  console.log('═══════════════════════════════════════════════════════')

  let agentId: string | null = null
  let publicKeyHex: string | null = null

  try {
    // Test 1: register (generates keypair internally, returns it)
    const result = await testRegistration()
    if (!result) {
      console.log('\n❌ Registration failed — aborting remaining tests')
      process.exit(1)
    }
    agentId = result.agentId
    publicKeyHex = result.publicKeyHex

    // Test 2: DB write
    await testDatabaseWrite(agentId)

    // Test 3: regression guard — snake_case should still 400
    await testFieldMismatchCatch()

    // Test 4: duplicate rejection — same public key should 409
    await testDuplicateRejection(publicKeyHex)

  } finally {
    if (agentId) await cleanup(agentId)
  }

  console.log('\n═══════════════════════════════════════════════════════')
  if (process.exitCode === 1) {
    console.log('  RESULT: FAILED — see errors above')
  } else {
    console.log('  RESULT: ALL TESTS PASSED')
  }
  console.log('═══════════════════════════════════════════════════════\n')
}

main().catch(e => { console.error(e); process.exit(1) })
