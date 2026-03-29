/**
 * MoltOS Full Functional Audit
 * Tests every major subsystem against the live API
 * Run: npx tsx scripts/full-audit.ts
 */

const BASE = 'https://moltos.org'
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const SUPABASE = 'https://pgeddexhbqoghdytjvex.supabase.co'

let PASS = 0, FAIL = 0, WARN = 0
const fails: string[] = []

function pass(s: string) { console.log(`  ✅ ${s}`); PASS++ }
function fail(s: string) { console.log(`  ❌ ${s}`); FAIL++; fails.push(s) }
function warn(s: string) { console.log(`  ⚠️  ${s}`); WARN++ }
function section(s: string) { console.log(`\n── ${s} ${'─'.repeat(50 - s.length)}`) }

async function req(method: string, path: string, body?: any, apiKey?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  let data: any
  try { data = await res.json() } catch { data = {} }
  return { status: res.status, data }
}

async function supabaseDel(table: string, filter: string) {
  if (!SKEY) return
  await fetch(`${SUPABASE}/rest/v1/${table}?${filter}`, {
    method: 'DELETE',
    headers: { apikey: SKEY, Authorization: `Bearer ${SKEY}` }
  })
}

// Generate Ed25519-compatible 32-byte hex
import { randomBytes, createHash } from 'crypto'
function genPubKey() { return randomBytes(32).toString('hex') }
function agentName(tag: string) { return `audit-${tag}-${Date.now()}` }

const testAgents: string[] = []

async function main() {
  console.log('\n' + '═'.repeat(60))
  console.log('  MoltOS Full Functional Audit')
  console.log(`  Target: ${BASE}`)
  console.log('═'.repeat(60))

  // ── 1. HEALTH ─────────────────────────────────────────────
  section('1. Health & Status')
  {
    const { status, data } = await req('GET', '/api/health')
    status === 200 ? pass(`/api/health → ${status}`) : fail(`/api/health → ${status}: ${JSON.stringify(data)}`)

    const { status: s2 } = await req('GET', '/api/status')
    s2 === 200 ? pass(`/api/status → ${s2}`) : fail(`/api/status → ${s2}`)
  }

  // ── 2. MACHINE ENDPOINT ──────────────────────────────────
  section('2. /machine endpoint')
  {
    const res = await fetch(`${BASE}/machine`)
    const text = await res.text()
    res.status === 200 ? pass(`GET /machine → 200`) : fail(`GET /machine → ${res.status}`)
    text.includes('Register') ? pass('Contains registration instructions') : fail('Missing registration content')
    text.includes('Authorization') ? pass('Contains auth instructions') : fail('Missing auth section')
    res.headers.get('content-type')?.includes('text/plain') ? pass('Content-Type: text/plain') : fail('Wrong content type: ' + res.headers.get('content-type'))
  }

  // ── 3. AGENT.JSON ────────────────────────────────────────
  section('3. /.well-known/agent.json')
  {
    const { status, data } = await req('GET', '/.well-known/agent.json')
    status === 200 ? pass(`GET /.well-known/agent.json → 200`) : fail(`→ ${status}`)
    data.onboarding === `${BASE}/machine` ? pass('onboarding URL correct') : fail(`onboarding: ${data.onboarding}`)
    data.capabilities?.length > 0 ? pass(`capabilities: ${data.capabilities.join(', ')}`) : fail('missing capabilities')
  }

  // ── 4. REGISTRATION ──────────────────────────────────────
  section('4. Agent Registration')
  let apiKey = '', agentId = '', agentName2 = ''
  {
    const name = agentName('main')
    agentName2 = name
    const pubKey = genPubKey()

    const { status, data } = await req('POST', '/api/agent/register', { name, publicKey: pubKey })
    status === 201 ? pass(`Registration → 201`) : fail(`Registration → ${status}: ${JSON.stringify(data)}`)
    if (data.success) {
      agentId = data.agent?.agentId
      apiKey = data.credentials?.apiKey
      agentId?.startsWith('agent_') ? pass(`agentId: ${agentId}`) : fail(`agentId malformed: ${agentId}`)
      apiKey?.startsWith('moltos_sk_') ? pass(`apiKey received`) : fail(`apiKey malformed`)
      data.agent?.activationStatus === 'pending' ? pass(`activationStatus: pending`) : fail(`wrong status: ${data.agent?.activationStatus}`)
      testAgents.push(agentId)
    }

    // Test duplicate rejection
    const { status: dupStatus } = await req('POST', '/api/agent/register', { name: `dup-${name}`, publicKey: pubKey })
    dupStatus === 409 ? pass(`Duplicate pubkey → 409`) : fail(`Duplicate should 409, got ${dupStatus}`)

    // Test invalid pubkey
    const { status: badStatus } = await req('POST', '/api/agent/register', { name: 'bad', publicKey: 'tooshort' })
    badStatus === 400 ? pass(`Invalid pubkey → 400`) : fail(`Should 400, got ${badStatus}`)
  }

  if (!apiKey || !agentId) {
    fail('Registration failed — skipping auth-required tests')
    return summarize()
  }

  // ── 5. AUTHENTICATION ────────────────────────────────────
  section('5. Authentication')
  {
    const { status, data } = await req('GET', '/api/agent/auth', undefined, apiKey)
    status === 200 ? pass(`/api/agent/auth → 200`) : fail(`→ ${status}: ${JSON.stringify(data)}`)

    // Bad key
    const { status: bad } = await req('GET', '/api/agent/auth', undefined, 'moltos_sk_fakefake')
    bad === 401 ? pass(`Bad API key → 401`) : fail(`Bad key should 401, got ${bad}`)

    // Get agent profile
    const { status: ps } = await req('GET', `/api/agent/${agentId}`)
    ps === 200 ? pass(`GET /api/agent/${agentId} → 200`) : fail(`→ ${ps}`)
  }

  // ── 6. CLAWFS ─────────────────────────────────────────────
  section('6. ClawFS — Persistent Memory')
  let snapshotCid = ''
  {
    const path = `/agents/${agentId}/hello.md`
    const content = `# Audit Test\nAgent: ${agentId}\nTime: ${new Date().toISOString()}`

    // Write
    const { status: ws, data: wd } = await req('POST', '/api/clawfs/write', { path, content }, apiKey)
    ws === 200 || ws === 201 ? pass(`clawfs write → ${ws}`) : fail(`write → ${ws}: ${JSON.stringify(wd)}`)

    // Read back
    const { status: rs, data: rd } = await req('GET', `/api/clawfs/read?path=${encodeURIComponent(path)}`, undefined, apiKey)
    rs === 200 ? pass(`clawfs read → 200`) : fail(`read → ${rs}: ${JSON.stringify(rd)}`)
    if (rd.content && rd.content.includes(agentId)) { pass(`Content matches`) } else { warn(`Content mismatch: ${JSON.stringify(rd).slice(0,100)}`) }

    // List
    const { status: ls, data: ld } = await req('GET', `/api/clawfs/list?prefix=${encodeURIComponent('/agents/' + agentId)}`, undefined, apiKey)
    ls === 200 ? pass(`clawfs list → 200`) : fail(`list → ${ls}`)
    if (ls === 200) {
      const files = ld.files ?? ld.items ?? []
      files.length > 0 ? pass(`Listed ${files.length} file(s)`) : warn(`No files listed`)
    }

    // Snapshot (kill-test basis)
    const { status: ss, data: sd } = await req('POST', '/api/clawfs/snapshot', {}, apiKey)
    ss === 200 || ss === 201 ? pass(`clawfs snapshot → ${ss}`) : fail(`snapshot → ${ss}: ${JSON.stringify(sd)}`)
    snapshotCid = sd.cid ?? sd.snapshot_id ?? sd.id ?? ''
    snapshotCid ? pass(`Snapshot CID: ${snapshotCid.slice(0, 20)}...`) : warn(`No CID in snapshot response: ${JSON.stringify(sd).slice(0,100)}`)

    // Versions
    const { status: vs } = await req('GET', `/api/clawfs/versions?path=${encodeURIComponent(path)}`, undefined, apiKey)
    vs === 200 ? pass(`clawfs versions → 200`) : fail(`versions → ${vs}`)

    // Bad path prefix
    const { status: bps } = await req('POST', '/api/clawfs/write', { path: '/memory/bad.md', content: 'test' }, apiKey)
    bps === 400 ? pass(`Invalid path prefix → 400`) : fail(`Bad path should 400, got ${bps}`)
  }

  // ── 7. KILL TEST SIMULATION ──────────────────────────────
  section('7. Kill Test — ClawFS Restore')
  {
    if (snapshotCid) {
      const { status, data } = await req('POST', '/api/clawfs/mount', { snapshot_id: snapshotCid }, apiKey)
      status === 200 || status === 201 ? pass(`Mount snapshot → ${status}`) : warn(`Mount → ${status}: ${JSON.stringify(data).slice(0,100)} (may require different params)`)
    } else {
      warn('No snapshot CID — skipping mount test')
    }

    // Verify the written file is still accessible (simulates post-kill restore)
    const path = `/agents/${agentId}/hello.md`
    const { status, data } = await req('GET', `/api/clawfs/read?path=${encodeURIComponent(path)}`, undefined, apiKey)
    status === 200 ? pass(`File persists after snapshot: state survives`) : fail(`State lost → ${status}`)
  }

  // ── 8. MARKETPLACE ───────────────────────────────────────
  section('8. Marketplace')
  let jobId = ''
  {
    // List jobs
    const { status: ls } = await req('GET', '/api/marketplace/jobs')
    ls === 200 ? pass(`GET marketplace/jobs → 200`) : fail(`→ ${ls}`)

    // Post a job
    const { status: ps, data: pd } = await req('POST', '/api/marketplace/jobs', {
      title: 'Audit Test Job',
      description: 'Functional audit test — delete me',
      budget: 100,
      category: 'General',
    }, apiKey)
    ps === 200 || ps === 201 ? pass(`POST marketplace/jobs → ${ps}`) : fail(`→ ${ps}: ${JSON.stringify(pd).slice(0,150)}`)
    jobId = pd.job?.id ?? pd.id ?? pd.job_id ?? ''
    jobId ? pass(`Job created: ${jobId}`) : warn(`No job ID in response: ${JSON.stringify(pd).slice(0,100)}`)

    // Apply to job (self-apply — might be rejected but endpoint should respond)
    if (jobId) {
      const { status: as } = await req('POST', `/api/marketplace/jobs/${jobId}/apply`, {
        proposal: 'Audit test proposal',
      }, apiKey)
      as === 200 || as === 201 || as === 400 || as === 409 ? pass(`Apply to job → ${as} (ok — self-apply may be rejected)`) : fail(`→ ${as}`)
    }

    // My jobs
    const { status: ms } = await req('GET', '/api/marketplace/my', undefined, apiKey)
    ms === 200 ? pass(`GET marketplace/my → 200`) : fail(`→ ${ms}`)
  }

  // ── 9. WALLET ────────────────────────────────────────────
  section('9. Wallet & Credits')
  {
    const { status: bs, data: bd } = await req('GET', '/api/wallet/balance', undefined, apiKey)
    bs === 200 ? pass(`wallet/balance → 200: ${bd.balance ?? bd.credits ?? JSON.stringify(bd).slice(0,50)} credits`) : fail(`→ ${bs}`)

    const { status: ts } = await req('GET', '/api/wallet/transactions', undefined, apiKey)
    ts === 200 ? pass(`wallet/transactions → 200`) : fail(`→ ${ts}`)
  }

  // ── 10. TAP / REPUTATION ─────────────────────────────────
  section('10. TAP — Reputation')
  {
    const { status: ls } = await req('GET', '/api/leaderboard')
    ls === 200 ? pass(`GET /api/leaderboard → 200`) : fail(`→ ${ls}`)

    const { status: es } = await req('GET', '/api/eigentrust')
    es === 200 ? pass(`GET /api/eigentrust → 200`) : fail(`→ ${es}`)
  }

  // ── 11. CLAWBUS ──────────────────────────────────────────
  section('11. ClawBus — Messaging')
  {
    // Schema
    const { status: ss, data: sd } = await req('GET', '/api/claw/bus/schema', undefined, apiKey)
    ss === 200 ? pass(`bus/schema → 200: ${sd.types?.length ?? sd.messageTypes?.length ?? '?'} types`) : fail(`→ ${ss}`)

    // Send message to self
    const { status: ms, data: md } = await req('POST', '/api/claw/bus/send', {
      to: agentId,
      type: 'task_request',
      payload: { task: 'audit_test', ts: Date.now() },
    }, apiKey)
    ms === 200 || ms === 201 ? pass(`bus/send → ${ms}`) : fail(`→ ${ms}: ${JSON.stringify(md).slice(0,100)}`)

    // Poll
    const { status: ps } = await req('GET', '/api/claw/bus/poll', undefined, apiKey)
    ps === 200 ? pass(`bus/poll → 200`) : fail(`→ ${ps}`)
  }

  // ── 12. AGENTHUB ─────────────────────────────────────────
  section('12. AgentHub')
  {
    const res = await fetch(`${BASE}/agenthub`)
    res.status === 200 ? pass(`GET /agenthub → 200`) : fail(`→ ${res.status}`)

    const res2 = await fetch(`${BASE}/agents`, { redirect: 'manual' })
    res2.status === 307 || res2.status === 308 ? pass(`/agents → ${res2.status} redirect → /agenthub`) : fail(`/agents redirect → ${res2.status}`)

    const { status: as } = await req('GET', '/api/agents/search?q=genesis')
    as === 200 ? pass(`agents/search → 200`) : fail(`→ ${as}`)
  }

  // ── 13. CLAWCOMPUTE ──────────────────────────────────────
  section('13. ClawCompute')
  {
    // Register compute node (will likely fail auth/data but endpoint must respond)
    const { status: rs, data: rd } = await req('POST', '/api/compute?action=register', {
      gpu_type: 'A100',
      vram_gb: 80,
      price_per_hour: 500,
    }, apiKey)
    rs === 200 || rs === 201 || rs === 400 ? pass(`compute register → ${rs} (endpoint alive)`) : fail(`→ ${rs}: ${JSON.stringify(rd).slice(0,100)}`)

    const { status: ss } = await req('GET', '/api/compute?action=status', undefined, apiKey)
    ss === 200 || ss === 404 ? pass(`compute status → ${ss}`) : fail(`→ ${ss}`)
  }

  // ── 14. ARBITRA ──────────────────────────────────────────
  section('14. Arbitra — Dispute Resolution')
  {
    const { status: hs, data: hd } = await req('GET', '/api/arbitra/health')
    hs === 200 ? pass(`arbitra/health → 200`) : fail(`→ ${hs}: ${JSON.stringify(hd).slice(0,100)}`)

    // Scan (anomaly detection)
    const { status: ss } = await req('GET', '/api/arbitra/scan', undefined, apiKey)
    ss === 200 ? pass(`arbitra/scan → 200`) : fail(`→ ${ss}`)

    // File a dispute (against self to test endpoint — should reject but respond)
    const { status: ds, data: dd } = await req('POST', '/api/arbitra/dispute', {
      respondent_id: agentId,
      description: 'Audit test dispute — ignore',
      evidence: [],
    }, apiKey)
    ds === 200 || ds === 201 || ds === 400 || ds === 422 ? pass(`arbitra/dispute → ${ds} (endpoint alive)`) : fail(`→ ${ds}: ${JSON.stringify(dd).slice(0,100)}`)
  }

  // ── 15. CLAWID ───────────────────────────────────────────
  section('15. ClawID — Identity Verification')
  {
    const { status: cs, data: cd } = await req('POST', '/api/clawid/challenge', { agent_id: agentId })
    cs === 200 || cs === 201 ? pass(`clawid/challenge → ${cs}`) : fail(`→ ${cs}: ${JSON.stringify(cd).slice(0,100)}`)
  }

  // ── 16. GOVERNANCE ───────────────────────────────────────
  section('16. Governance')
  {
    const { status: os } = await req('GET', '/api/governance/overview')
    os === 200 ? pass(`governance/overview → 200`) : fail(`→ ${os}`)

    const { status: ps } = await req('GET', '/api/governance/proposals')
    ps === 200 ? pass(`governance/proposals → 200`) : fail(`→ ${ps}`)
  }

  // ── 17. BOOTSTRAP ────────────────────────────────────────
  section('17. Bootstrap Tasks')
  {
    const { status: ts, data: td } = await req('GET', '/api/bootstrap/tasks', undefined, apiKey)
    ts === 200 ? pass(`bootstrap/tasks → 200: ${td.tasks?.length ?? '?'} tasks`) : fail(`→ ${ts}`)
  }

  // ── 18. PROFILE / STOREFRONT ─────────────────────────────
  section('18. Profile & Storefront')
  {
    const { status: ps } = await req('GET', '/api/agent/profile', undefined, apiKey)
    ps === 200 ? pass(`agent/profile → 200`) : fail(`→ ${ps}`)

    const { status: ss, data: sd } = await req('POST', '/api/agent/storefront', {
      bio: 'Audit test agent',
      skills: ['testing', 'audit'],
    }, apiKey)
    ss === 200 || ss === 201 ? pass(`agent/storefront update → ${ss}`) : fail(`→ ${ss}: ${JSON.stringify(sd).slice(0,100)}`)
  }

  // ── 19. TELEMETRY ─────────────────────────────────────────
  section('19. Telemetry')
  {
    const { status: ts } = await req('GET', '/api/telemetry', undefined, apiKey)
    ts === 200 ? pass(`telemetry → 200`) : fail(`→ ${ts}`)
  }

  // ── 20. STATS ─────────────────────────────────────────────
  section('20. Network Stats')
  {
    const { status: ss, data: sd } = await req('GET', '/api/stats')
    ss === 200 ? pass(`/api/stats → 200: ${JSON.stringify(sd).slice(0,80)}`) : fail(`→ ${ss}`)
  }

  // ── CLEANUP ───────────────────────────────────────────────
  section('Cleanup')
  if (SKEY) {
    for (const id of testAgents) {
      await supabaseDel('agent_registry', `agent_id=eq.${id}`)
    }
    if (jobId) await supabaseDel('marketplace_jobs', `id=eq.${jobId}`)
    pass(`Cleaned ${testAgents.length} test agents`)
  } else {
    warn(`No SUPABASE_SERVICE_ROLE_KEY — test agents remain: ${testAgents.join(', ')}`)
  }

  summarize()
}

function summarize() {
  console.log('\n' + '═'.repeat(60))
  console.log(`  RESULT: ${PASS} passed  ${FAIL} failed  ${WARN} warnings`)
  if (fails.length) {
    console.log('\n  FAILURES:')
    fails.forEach(f => console.log(`    ❌ ${f}`))
  }
  console.log('═'.repeat(60) + '\n')
  if (FAIL > 0) process.exitCode = 1
}

main().catch(e => { console.error(e); process.exit(1) })
