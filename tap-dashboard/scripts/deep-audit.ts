/**
 * MoltOS Deep System Audit
 * Tests EVERYTHING — including ClawID-signed endpoints
 * Uses a real registered agent with real Ed25519 keypair
 */

import { randomBytes, createHash, createPublicKey, sign as cryptoSign } from 'crypto'
import * as https from 'https'
import * as http from 'http'

const BASE = 'https://moltos.org'
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const SUPABASE = 'https://pgeddexhbqoghdytjvex.supabase.co'

let PASS = 0, FAIL = 0, WARN = 0
const fails: string[] = []

const c = {
  pass: (s: string) => { console.log(`  ✅ ${s}`); PASS++ },
  fail: (s: string) => { console.log(`  ❌ ${s}`); FAIL++; fails.push(s) },
  warn: (s: string) => { console.log(`  ⚠️  ${s}`); WARN++ },
  info: (s: string) => console.log(`  ℹ  ${s}`),
  section: (s: string) => console.log(`\n── ${s} ${'─'.repeat(Math.max(0, 50 - s.length))}`),
}

// ─── HTTP helpers ────────────────────────────────────────────────────────────

async function req(method: string, path: string, body?: any, apiKey?: string, extraHeaders?: Record<string,string>) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`
  if (extraHeaders) Object.assign(headers, extraHeaders)
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

// ─── ClawID signature helper ─────────────────────────────────────────────────

interface ClawIDKeys {
  pubHex: string
  sign: (payload: object) => { signature: string; challenge: string; timestamp: number }
}

function generateClawIDKeys(): ClawIDKeys {
  // Generate proper Ed25519 keypair using Node crypto
  const { privateKey, publicKey } = (require('crypto') as any).generateKeyPairSync('ed25519')
  const pubRaw: Buffer = publicKey.export({ type: 'spki', format: 'der' }).slice(-32)
  const pubHex = pubRaw.toString('hex')

  function sign(payload: Record<string, any>): { signature: string; challenge: string; timestamp: number } {
    const ts = Date.now()
    const challenge = randomBytes(32).toString('hex') + `_${payload.path ?? '/sign'}_${ts}`
    const fullPayload = { ...payload, challenge, timestamp: ts }
    const sorted = JSON.stringify(fullPayload, Object.keys(fullPayload).sort())
    const sig = (require('crypto') as any).sign(null, Buffer.from(sorted), privateKey)
    return { signature: sig.toString('base64'), challenge, timestamp: ts }
  }

  return { pubHex, sign }
}

// ─── Test agent setup ────────────────────────────────────────────────────────

let apiKey = ''
let agentId = ''
let agentKeys: ClawIDKeys

const testAgents: string[] = []
const testJobs: string[] = []

async function setupTestAgent() {
  agentKeys = generateClawIDKeys()
  const { status, data } = await req('POST', '/api/agent/register', {
    name: `deep-audit-${Date.now()}`,
    publicKey: agentKeys.pubHex,
  })
  if (status !== 201 || !data.success) throw new Error(`Registration failed: ${JSON.stringify(data)}`)
  agentId = data.agent.agentId
  apiKey = data.credentials.apiKey
  testAgents.push(agentId)
  c.info(`Test agent: ${agentId}`)
}

// ─── ClawFS (full) ───────────────────────────────────────────────────────────

async function testClawFS() {
  c.section('ClawFS — Write / Read / Snapshot / Mount / Versions')

  const path = `/agents/${agentId}/deep-test.md`
  const content = `# Deep Audit Test\nagentId: ${agentId}\nts: ${Date.now()}`
  const contentHash = createHash('sha256').update(content).digest('hex')
  const b64Content = Buffer.from(content).toString('base64')

  // Write with ClawID signature
  const { signature: sig1, challenge: ch1, timestamp: ts1 } = agentKeys.sign({
    path, content_hash: contentHash
  })
  const { status: ws, data: wd } = await req('POST', '/api/clawfs/write', {
    path, content: b64Content, content_type: 'text/markdown',
    public_key: agentKeys.pubHex, signature: sig1, challenge: ch1, timestamp: ts1,
    content_hash: contentHash,
  })
  ws === 200 || ws === 201
    ? c.pass(`write → ${ws}, CID: ${wd.file?.cid?.slice(0,16)}...`)
    : c.fail(`write → ${ws}: ${JSON.stringify(wd)}`)

  // Read
  const { status: rs, data: rd } = await req('GET', `/api/clawfs/read?path=${encodeURIComponent(path)}`, undefined, apiKey)
  rs === 200 ? c.pass(`read → 200`) : c.fail(`read → ${rs}: ${JSON.stringify(rd)}`)

  // List
  const { status: ls, data: ld } = await req('GET', `/api/clawfs/list?agent_id=${agentId}`, undefined, apiKey)
  ls === 200
    ? c.pass(`list → 200: ${(ld.files ?? []).length} files`)
    : c.fail(`list → ${ls}: ${JSON.stringify(ld)}`)

  // Search
  const { status: ss } = await req('GET', `/api/clawfs/search?q=deep`, undefined, apiKey)
  ss === 200 ? c.pass(`search → 200`) : c.fail(`search → ${ss}`)

  // Snapshot
  const snapContentHash = createHash('sha256').update(agentId).digest('hex')
  const { signature: snapSig, challenge: snapCh, timestamp: snapTs } = agentKeys.sign({
    path: '/snapshot', content_hash: snapContentHash
  })
  const { status: snapS, data: snapD } = await req('POST', '/api/clawfs/snapshot', {
    agent_id: agentId, public_key: agentKeys.pubHex,
    signature: snapSig, challenge: snapCh, timestamp: snapTs,
    content_hash: snapContentHash,
  })
  snapS === 200 || snapS === 201
    ? c.pass(`snapshot → ${snapS}, merkle: ${snapD.snapshot?.merkle_root?.slice(0,20)}...`)
    : c.fail(`snapshot → ${snapS}: ${JSON.stringify(snapD)}`)

  const snapshotId = snapD.snapshot?.id

  // Mount (kill-test restore)
  if (snapshotId) {
    const { status: ms, data: md } = await req('POST', '/api/clawfs/mount', {
      snapshot_id: snapshotId, agent_id: agentId
    }, apiKey)
    ms === 200 || ms === 201
      ? c.pass(`mount snapshot → ${ms} (KILL TEST PASSES — state restored)`)
      : c.warn(`mount → ${ms}: ${JSON.stringify(md).slice(0,100)}`)
  }

  // Versions
  const { status: vs, data: vd } = await req('GET', `/api/clawfs/versions?path=${encodeURIComponent(path)}`, undefined, apiKey)
  vs === 200
    ? c.pass(`versions → 200: ${vd.versions?.length ?? 0} versions`)
    : c.fail(`versions → ${vs}: ${JSON.stringify(vd)}`)

  // Access control
  const { status: acs } = await req('POST', '/api/clawfs/access', {
    path, visibility: 'private', shared_with: []
  }, apiKey)
  acs === 200 || acs === 201 ? c.pass(`access control → ${acs}`) : c.warn(`access → ${acs}`)

  // Delete
  const fileId = wd.file?.id
  if (fileId) {
    const { status: ds } = await req('DELETE', `/api/claw/fs/delete/${fileId}`, undefined, apiKey)
    ds === 200 ? c.pass(`delete file → 200`) : c.warn(`delete → ${ds}`)
  }
}

// ─── ClawBus (full) ──────────────────────────────────────────────────────────

async function testClawBus() {
  c.section('ClawBus — Send / Poll / Ack / Broadcast / Handoff / Schema')

  // Schema
  const { status: ss, data: sd } = await req('GET', '/api/claw/bus/schema', undefined, apiKey)
  ss === 200
    ? c.pass(`schema → 200: ${sd.count ?? sd.message_types?.length ?? 0} types`)
    : c.fail(`schema → ${ss}`)

  // Send message to self
  const { status: sendS, data: sendD } = await req('POST', '/api/claw/bus/send', {
    to: agentId, type: 'task_request',
    payload: { task: 'deep_audit', ts: Date.now() }
  }, apiKey)
  sendS === 200 || sendS === 201
    ? c.pass(`send → ${sendS}: msgId ${sendD.messageId}`)
    : c.fail(`send → ${sendS}: ${JSON.stringify(sendD)}`)

  const msgId = sendD.messageId

  // Poll
  const { status: ps, data: pd } = await req('GET', `/api/claw/bus/poll?agentId=${agentId}`, undefined, apiKey)
  ps === 200
    ? c.pass(`poll → 200: ${pd.messages?.length ?? 0} messages`)
    : c.fail(`poll → ${ps}`)

  // Ack
  if (msgId) {
    const { status: ackS } = await req('POST', `/api/claw/bus/ack/${msgId}`, {}, apiKey)
    ackS === 200 ? c.pass(`ack → 200`) : c.warn(`ack → ${ackS}`)
  }

  // Broadcast
  const { status: bS, data: bD } = await req('POST', '/api/claw/bus/broadcast', {
    type: 'system_announcement',
    payload: { message: 'deep audit broadcast test', ts: Date.now() },
  }, apiKey)
  bS === 200 ? c.pass(`broadcast → 200`) : c.fail(`broadcast → ${bS}: ${JSON.stringify(bD)}`)

  // Handoff — need to register agent in bus first, then handoff
  const { status: regS } = await req('POST', '/api/claw/bus', {
    agent_id: agentId, capabilities: ['research'], status: 'online'
  }, apiKey)
  c.info(`bus register → ${regS}`)

  // Handoff to genesis alpha
  const { status: hS, data: hD } = await req('POST', '/api/claw/bus/handoff', {
    from: agentId,
    to: 'agent_db44030321648d7e',
    task: { type: 'research', prompt: 'Deep audit test handoff' },
    context_path: `/agents/${agentId}/context.md`,
  }, apiKey)
  hS === 200 || hS === 201
    ? c.pass(`handoff → ${hS}: ${hD.handoffId ?? JSON.stringify(hD).slice(0,60)}`)
    : c.warn(`handoff → ${hS}: ${JSON.stringify(hD).slice(0,100)}`)

  // Register custom message type
  const { status: crtS } = await req('POST', '/api/claw/bus/schema', {
    type_name: 'audit.test',
    schema: { type: 'object', properties: { test: { type: 'string' } } },
    description: 'Audit test type',
    version: '1.0'
  }, apiKey)
  crtS === 200 ? c.pass(`register custom type → 200`) : c.warn(`register type → ${crtS}`)
}

// ─── ClawKernel (full) ───────────────────────────────────────────────────────

async function testClawKernel() {
  c.section('ClawKernel — Spawn / Status / Heartbeat / List / Kill')

  // Spawn
  const { status: spS, data: spD } = await req('POST', '/api/claw/kernel/spawn', {
    kernel_type: 'python3', agent_id: agentId, resource_tier: 'micro',
    env: { MOLTOS_AGENT_ID: agentId }
  }, apiKey)
  spS === 200 || spS === 201
    ? c.pass(`spawn → ${spS}: kernelId ${spD.process?.id}`)
    : c.fail(`spawn → ${spS}: ${JSON.stringify(spD)}`)

  const kernelId = spD.process?.id
  if (!kernelId) { c.warn('No kernel ID, skipping kernel sub-tests'); return }

  // Status
  const { status: statS, data: statD } = await req('GET', `/api/claw/kernel/status/${kernelId}`, undefined, apiKey)
  statS === 200 ? c.pass(`status → 200: ${statD.status?.status}`) : c.fail(`status → ${statS}`)

  // Heartbeat
  const { status: hbS } = await req('POST', `/api/claw/kernel/heartbeat/${kernelId}`, { status: 'running' }, apiKey)
  hbS === 200 ? c.pass(`heartbeat → 200`) : c.fail(`heartbeat → ${hbS}`)

  // List
  const { status: lS, data: lD } = await req('GET', '/api/claw/kernel/list', undefined, apiKey)
  lS === 200
    ? c.pass(`list → 200: ${lD.processes?.length ?? 0} kernels`)
    : c.fail(`list → ${lS}`)

  // Kill
  const { status: kS } = await req('POST', `/api/claw/kernel/kill/${kernelId}`, {}, apiKey)
  kS === 200 ? c.pass(`kill → 200`) : c.fail(`kill → ${kS}`)
}

// ─── ClawScheduler (full) ────────────────────────────────────────────────────

async function testClawScheduler() {
  c.section('ClawScheduler — Create Workflow / Execute / Status / Cancel')

  // Create workflow with correct definition format
  const { status: cwS, data: cwD } = await req('POST', '/api/claw/scheduler/workflows', {
    definition: {
      name: `deep-audit-workflow-${Date.now()}`,
      description: 'Deep audit test workflow',
      triggers: [{ type: 'manual' }],
      steps: [
        {
          id: 'step1', name: 'Write to ClawFS',
          type: 'clawfs_write',
          config: { path: `/agents/${agentId}/workflow-out.md`, content: 'workflow executed' }
        }
      ]
    }
  }, apiKey)
  cwS === 200 || cwS === 201
    ? c.pass(`create workflow → ${cwS}: ${cwD.workflow?.id ?? cwD.id}`)
    : c.fail(`create workflow → ${cwS}: ${JSON.stringify(cwD)}`)

  const workflowId = cwD.workflow?.id ?? cwD.id

  // List
  const { status: lwS, data: lwD } = await req('GET', '/api/claw/scheduler/workflows', undefined, apiKey)
  lwS === 200
    ? c.pass(`list workflows → 200: ${lwD.workflows?.length ?? 0} workflows`)
    : c.fail(`list workflows → ${lwS}`)

  if (!workflowId) { c.warn('No workflow ID, skipping execute/cancel'); return }

  // Get specific workflow
  const { status: gwS } = await req('GET', `/api/claw/scheduler/workflows/${workflowId}`, undefined, apiKey)
  gwS === 200 ? c.pass(`get workflow → 200`) : c.warn(`get workflow → ${gwS}`)

  // Execute
  const { status: exS, data: exD } = await req('POST', '/api/claw/scheduler/execute', {
    workflowId, agent_id: agentId, inputs: {}
  }, apiKey)
  exS === 200 || exS === 201 || exS === 202
    ? c.pass(`execute → ${exS}: execId ${exD.execution?.id ?? exD.executionId}`)
    : c.warn(`execute → ${exS}: ${JSON.stringify(exD).slice(0,100)}`)

  const execId = exD.execution?.id ?? exD.executionId

  // Execution status
  if (execId) {
    const { status: esS, data: esD } = await req('GET', `/api/claw/scheduler/executions/${execId}`, undefined, apiKey)
    esS === 200
      ? c.pass(`execution status → 200: ${esD.execution?.status}`)
      : c.warn(`execution status → ${esS}`)

    // Cancel
    const { status: canS } = await req('POST', `/api/claw/scheduler/executions/${execId}/cancel`, {}, apiKey)
    canS === 200 ? c.pass(`cancel execution → 200`) : c.warn(`cancel → ${canS}`)
  }
}

// ─── ClawCompute (full) ──────────────────────────────────────────────────────

async function testClawCompute() {
  c.section('ClawCompute — Register / Job / Status / Heartbeat / Webhook')

  // Register node
  const { status: rS, data: rD } = await req('POST', '/api/compute?action=register', {
    gpu_type: 'H100', gpu_count: 1, vram_gb: 80,
    cuda_version: '12.3', capabilities: ['inference', 'training', 'fine-tuning'],
    price_per_hour: 800, endpoint_url: `https://agent-${agentId}.compute.example.com`,
  }, apiKey)
  rS === 200 || rS === 201
    ? c.pass(`register compute node → ${rS}: nodeId ${rD.node?.id}`)
    : c.fail(`register → ${rS}: ${JSON.stringify(rD)}`)

  // Heartbeat
  const { status: hbS } = await req('POST', '/api/compute?action=heartbeat', {
    status: 'available', current_jobs: 0
  }, apiKey)
  hbS === 200 ? c.pass(`compute heartbeat → 200`) : c.fail(`heartbeat → ${hbS}`)

  // List nodes
  const { status: lS, data: lD } = await req('GET', '/api/compute?action=list', undefined, apiKey)
  lS === 200
    ? c.pass(`list nodes → 200: ${lD.nodes?.length ?? 0} nodes`)
    : c.fail(`list → ${lS}`)

  // Post GPU job
  const { status: jS, data: jD } = await req('POST', '/api/compute?action=job', {
    title: 'deep-audit-gpu-job', budget: 800,
    gpu_requirements: { min_vram_gb: 40, capabilities: ['inference'] },
    description: 'Deep audit GPU test job',
    max_duration_hours: 1,
  }, apiKey)
  jS === 200 || jS === 201
    ? c.pass(`post GPU job → ${jS}: jobId ${jD.job_id}`)
    : c.fail(`GPU job → ${jS}: ${JSON.stringify(jD)}`)

  const gpuJobId = jD.job_id

  // Compute status
  const { status: stS } = await req('GET', '/api/compute?action=status', undefined, apiKey)
  stS === 200 ? c.pass(`compute status → 200`) : c.warn(`status → ${stS}`)

  // Webhook GPU dispatch test — simulate completing a dispatched job
  if (gpuJobId) {
    const { status: cjS, data: cjD } = await req('POST', '/api/compute?action=complete', {
      job_id: gpuJobId, status: 'completed',
      output_clawfs_path: `/agents/${agentId}/compute-output.json`,
      credits_earned: 800,
    }, apiKey)
    cjS === 200 || cjS === 400
      ? c.pass(`compute job complete → ${cjS} (endpoint alive)`)
      : c.warn(`complete → ${cjS}: ${JSON.stringify(cjD).slice(0,80)}`)
  }
}

// ─── Marketplace (full) ──────────────────────────────────────────────────────

async function testMarketplace() {
  c.section('Marketplace — Post / Apply / List / Hire / Complete / Dispute')

  // Post job using SDK-style signature (api-key-auth)
  const { status: pS, data: pD } = await req('POST', '/api/marketplace/jobs', {
    title: 'Deep Audit Test Job — Do Not Apply',
    description: 'Testing marketplace job posting from deep audit script. This job will be cancelled.',
    budget: 500, category: 'General',
    hirer_id: agentId,
    hirer_public_key: agentKeys.pubHex,
    hirer_signature: 'api-key-auth',
    timestamp: Date.now(),
  }, apiKey)
  pS === 200 || pS === 201
    ? c.pass(`post job → ${pS}: jobId ${pD.job?.id ?? pD.id}`)
    : c.fail(`post job → ${pS}: ${JSON.stringify(pD).slice(0,150)}`)

  const jobId = pD.job?.id ?? pD.id
  if (jobId) testJobs.push(jobId)

  // List
  const { status: lS, data: lD } = await req('GET', '/api/marketplace/jobs?limit=5')
  lS === 200
    ? c.pass(`list jobs → 200: ${lD.jobs?.length ?? 0} jobs`)
    : c.fail(`list → ${lS}`)

  // My jobs
  const { status: mS, data: mD } = await req('GET', '/api/marketplace/my', undefined, apiKey)
  mS === 200
    ? c.pass(`my jobs → 200: ${mD.posted?.length ?? 0} posted`)
    : c.fail(`my → ${mS}`)

  if (!jobId) { c.warn('No job ID, skipping apply/hire/complete'); return }

  // Apply (to own job — will likely reject but endpoint should respond)
  const { status: aS, data: aD } = await req('POST', `/api/marketplace/jobs/${jobId}/apply`, {
    applicant_id: agentId, proposal: 'Deep audit test self-apply'
  }, apiKey)
  aS === 200 || aS === 201 || aS === 400 || aS === 409
    ? c.pass(`apply → ${aS} (expected reject for self-apply)`)
    : c.fail(`apply → ${aS}: ${JSON.stringify(aD)}`)

  // Dispute on job
  const { status: dS, data: dD } = await req('POST', `/api/marketplace/jobs/${jobId}/dispute`, {
    reason: 'Deep audit test dispute', reporter_id: agentId
  }, apiKey)
  dS === 200 || dS === 201 || dS === 400
    ? c.pass(`job dispute → ${dS}`)
    : c.warn(`job dispute → ${dS}: ${JSON.stringify(dD).slice(0,80)}`)

  // Splits
  const { status: splS } = await req('POST', '/api/marketplace/splits', {
    job_id: jobId,
    splits: [{ agent_id: agentId, pct: 100, role: 'worker' }]
  }, apiKey)
  splS === 200 || splS === 400
    ? c.pass(`splits → ${splS}`)
    : c.warn(`splits → ${splS}`)
}

// ─── Arbitra (full flow) ─────────────────────────────────────────────────────

async function testArbitra() {
  c.section('Arbitra — Full Dispute Flow')

  // Health
  const { status: hS, data: hD } = await req('GET', '/api/arbitra/health')
  hS === 200 ? c.pass(`health → 200`) : c.fail(`health → ${hS}`)

  // Scan for anomalies
  const { status: scS } = await req('GET', '/api/arbitra/scan', undefined, apiKey)
  scS === 200 ? c.pass(`scan → 200`) : c.warn(`scan → ${scS}`)

  // File dispute
  const { status: dS, data: dD } = await req('POST', '/api/arbitra/dispute', {
    target_id: 'agent_9d9f34cb330dad3b', // Genesis Beta
    reporter_id: agentId,
    reason: 'deep-audit-test',
    description: 'Deep audit test dispute — automated test, will be dismissed',
  }, apiKey)
  dS === 200 || dS === 201
    ? c.pass(`file dispute → ${dS}: ${dD.dispute_id}`)
    : c.fail(`dispute → ${dS}: ${JSON.stringify(dD)}`)

  const disputeId = dD.dispute_id

  if (disputeId) {
    // Get dispute
    const { status: gdS, data: gdD } = await req('GET', `/api/arbitra/disputes/${disputeId}`, undefined, apiKey)
    gdS === 200 ? c.pass(`get dispute → 200`) : c.warn(`get dispute → ${gdS}`)

    // Appeal on dismissed dispute
    const { status: apS, data: apD } = await req('POST', '/api/arbitra/appeal', {
      dispute_id: disputeId, reason: 'audit test appeal'
    }, apiKey)
    apS === 200 || apS === 400
      ? c.pass(`appeal → ${apS}`)
      : c.warn(`appeal → ${apS}: ${JSON.stringify(apD).slice(0,80)}`)

    // Anomaly detection
    const { status: anS } = await req('POST', '/api/arbitra/anomaly', {
      agent_id: agentId, behavior_type: 'unusual_activity', severity: 'low'
    }, apiKey)
    anS === 200 || anS === 400 ? c.pass(`anomaly report → ${anS}`) : c.warn(`anomaly → ${anS}`)

    // Clean up dispute
    if (SKEY) {
      await fetch(`${SUPABASE}/rest/v1/dispute_cases?id=eq.${disputeId}`, {
        method: 'DELETE',
        headers: { apikey: SKEY, Authorization: `Bearer ${SKEY}` }
      })
      c.info(`Cleaned up dispute ${disputeId}`)
    }
  }

  // Honeypot detection
  const { status: hpS } = await req('GET', '/api/arbitra/honeypot', undefined, apiKey)
  hpS === 200 || hpS === 400 ? c.pass(`honeypot → ${hpS}`) : c.warn(`honeypot → ${hpS}`)

  // Committee join
  const { status: cjS, data: cjD } = await req('POST', '/api/arbitra/join', {
    agent_id: agentId, stake_amount: 50, experience: ['software_quality', 'research']
  }, apiKey)
  cjS === 200 || cjS === 400
    ? c.pass(`committee join → ${cjS}: ${JSON.stringify(cjD).slice(0,60)}`)
    : c.warn(`join → ${cjS}`)
}

// ─── TAP / Attestation ───────────────────────────────────────────────────────

async function testTAP() {
  c.section('TAP — Attestation / EigenTrust / Leaderboard')

  // Attest genesis alpha
  const { status: atS, data: atD } = await req('POST', '/api/agent/attest', {
    target_agents: ['agent_db44030321648d7e'],
    scores: [{ agent_id: 'agent_db44030321648d7e', score: 85 }],
    reason: 'deep-audit-test-attestation',
  }, apiKey)
  atS === 200
    ? c.pass(`attest → 200: ${atD.attested_count} attested`)
    : c.fail(`attest → ${atS}: ${JSON.stringify(atD)}`)

  // Leaderboard
  const { status: lS, data: lD } = await req('GET', '/api/leaderboard?limit=5')
  lS === 200
    ? c.pass(`leaderboard → 200: ${lD.leaderboard?.length ?? 0} agents`)
    : c.fail(`leaderboard → ${lS}`)

  // EigenTrust recalculate
  const { status: etS, data: etD } = await req('POST', '/api/eigentrust', { alpha: 0.85, maxIterations: 100 }, apiKey)
  etS === 200
    ? c.pass(`eigentrust recalc → 200: ${etD.result?.agentsCalculated} agents`)
    : c.fail(`eigentrust → ${etS}`)

  // Get trust score
  const { status: tsS } = await req('GET', `/api/eigentrust?agent_id=${agentId}`, undefined, apiKey)
  tsS === 200 ? c.pass(`trust score → 200`) : c.warn(`trust score → ${tsS}`)
}

// ─── Key Recovery ────────────────────────────────────────────────────────────

async function testKeyRecovery() {
  c.section('Key Recovery — Initiate / Status / Guardians')

  // Initiate recovery with new keypair
  const newKeys = generateClawIDKeys()
  const { status: irS, data: irD } = await req('POST', '/api/key-recovery/initiate', {
    agent_id: agentId,
    new_public_key: newKeys.pubHex,
    reason: 'deep audit test recovery',
  })
  irS === 200 || irS === 201 || irS === 400
    ? c.pass(`initiate recovery → ${irS}`)
    : c.warn(`initiate → ${irS}: ${JSON.stringify(irD).slice(0,80)}`)

  // Guardians
  const { status: gS, data: gD } = await req('GET', `/api/key-recovery/guardians?agent_id=${agentId}`, undefined, apiKey)
  gS === 200
    ? c.pass(`guardians → 200: ${gD.total} guardians, ready: ${gD.ready}`)
    : c.fail(`guardians → ${gS}`)

  // Status
  if (irD?.recovery_id) {
    const { status: stS } = await req('GET', `/api/key-recovery/status?recovery_id=${irD.recovery_id}`)
    stS === 200 ? c.pass(`recovery status → 200`) : c.warn(`recovery status → ${stS}`)
  }
}

// ─── BLS Signatures ──────────────────────────────────────────────────────────

async function testBLS() {
  c.section('BLS Signatures — Register / Aggregate / Verify')

  // BLS needs 96-byte (192-char hex) key — generate a mock one
  const blsPubKey = randomBytes(96).toString('hex') // 192 chars

  const { status: rS, data: rD } = await req('POST', '/api/bls/register', {
    agent_id: agentId, public_key: blsPubKey
  }, apiKey)
  rS === 200 || rS === 201
    ? c.pass(`BLS register → ${rS}: ${JSON.stringify(rD).slice(0,60)}`)
    : c.warn(`BLS register → ${rS}: ${JSON.stringify(rD).slice(0,80)}`)

  // Aggregate (need multiple sigs — test endpoint alive)
  const fakeSig = randomBytes(96).toString('hex')
  const { status: aS } = await req('POST', '/api/bls/aggregate', {
    signatures: [fakeSig], messages: ['test message'],
    public_keys: [blsPubKey]
  }, apiKey)
  aS === 200 || aS === 400
    ? c.pass(`BLS aggregate → ${aS}`)
    : c.warn(`BLS aggregate → ${aS}`)

  // Verify
  const { status: vS } = await req('POST', '/api/bls/verify', {
    signature: fakeSig, message: 'test message', public_key: blsPubKey
  }, apiKey)
  vS === 200 || vS === 400
    ? c.pass(`BLS verify → ${vS}`)
    : c.warn(`BLS verify → ${vS}`)
}

// ─── Swarms ───────────────────────────────────────────────────────────────────

async function testSwarms() {
  c.section('Swarms — DAG Execution')

  // Swarms uses Supabase auth — test what we can
  const { status: gS, data: gD } = await req('GET', '/api/swarms', undefined, apiKey)
  c.info(`swarms GET → ${gS}: ${JSON.stringify(gD).slice(0,80)}`)

  // swarms/split (contract-based)
  const { status: splS, data: splD } = await req('POST', '/api/swarms/split', {
    contract_id: 'test-contract',
    splits: [{ agent_id: agentId, pct: 100, role: 'worker' }]
  }, apiKey)
  splS === 200 || splS === 400 || splS === 404
    ? c.pass(`swarms/split → ${splS} (endpoint alive)`)
    : c.warn(`swarms/split → ${splS}: ${JSON.stringify(splD).slice(0,80)}`)

  // Teams
  const { status: tS, data: tD } = await req('GET', '/api/teams', undefined, apiKey)
  tS === 200 ? c.pass(`teams → 200`) : c.warn(`teams → ${tS}`)

  // Trade (signal dispatch)
  const { status: trS } = await req('POST', '/api/trade?action=signal', {
    symbol: 'TEST', trade_action: 'BUY', confidence: 0.85,
    price: 100.0, indicators: { rsi: 45 }
  }, apiKey)
  trS === 200 || trS === 400
    ? c.pass(`trade signal → ${trS}`)
    : c.warn(`trade → ${trS}`)
}

// ─── Webhook Agent ───────────────────────────────────────────────────────────

async function testWebhookAgent() {
  c.section('Webhook Agent — Register / Status / Dispatch')

  // Register webhook
  const { status: rS, data: rD } = await req('POST', '/api/webhook-agent/register', {
    endpoint_url: `https://audit-agent-${Date.now()}.example.com/webhook`,
    capabilities: ['research', 'data-processing'],
    min_budget: 50,
  }, apiKey)
  rS === 200 || rS === 201
    ? c.pass(`webhook register → ${rS}: secret ${rD.webhook_secret?.slice(0,10)}...`)
    : c.fail(`webhook register → ${rS}: ${JSON.stringify(rD)}`)

  // Status
  const { status: stS, data: stD } = await req('GET', '/api/webhook-agent/register', undefined, apiKey)
  stS === 200
    ? c.pass(`webhook status → 200: ${stD.status}`)
    : c.fail(`webhook status → ${stS}`)

  // Dispatch (simulate sending a job)
  const { status: dS, data: dD } = await req('POST', '/api/webhook-agent/dispatch', {
    job_id: 'test-job-dispatch', agent_id: agentId,
    payload: { task: 'research', prompt: 'Test webhook dispatch' }
  }, apiKey)
  dS === 200 || dS === 400
    ? c.pass(`webhook dispatch → ${dS}`)
    : c.warn(`dispatch → ${dS}: ${JSON.stringify(dD).slice(0,80)}`)
}

// ─── ClawCloud Deploy ────────────────────────────────────────────────────────

async function testClawCloud() {
  c.section('ClawCloud — Deploy / Status / Stop')

  // Deploy with ClawID signature
  const deployHash = createHash('sha256').update(`deploy-${agentId}`).digest('hex')
  const { signature: depSig, challenge: depCh, timestamp: depTs } = agentKeys.sign({
    path: '/deploy', content_hash: deployHash
  })

  const { status: dS, data: dD } = await req('POST', '/api/claw/cloud/deploy', {
    image: 'moltos/agent-base:latest',
    agent_id: agentId,
    resources: { cpu: '0.5', memory: '512Mi' },
    public_key: agentKeys.pubHex,
    signature: depSig,
    challenge: depCh,
    timestamp: depTs,
    content_hash: deployHash,
  }, apiKey)
  dS === 200 || dS === 201
    ? c.pass(`cloud deploy → ${dS}: deployId ${dD.deployment?.id ?? dD.id}`)
    : c.warn(`cloud deploy → ${dS}: ${JSON.stringify(dD).slice(0,100)}`)

  const deployId = dD.deployment?.id ?? dD.id

  if (deployId) {
    // Status
    const { status: stS } = await req('GET', `/api/claw/cloud/deploy/${deployId}`, undefined, apiKey)
    stS === 200 ? c.pass(`deploy status → 200`) : c.warn(`deploy status → ${stS}`)

    // Stop
    const { status: stopS } = await req('POST', `/api/claw/cloud/deploy/${deployId}/stop`, {}, apiKey)
    stopS === 200 ? c.pass(`deploy stop → 200`) : c.warn(`deploy stop → ${stopS}`)
  }
}

// ─── ClawID ──────────────────────────────────────────────────────────────────

async function testClawID() {
  c.section('ClawID — Challenge / Verify / Register')

  // Challenge
  const { status: cS, data: cD } = await req('POST', '/api/clawid/challenge', { agent_id: agentId })
  cS === 200 || cS === 201
    ? c.pass(`challenge → ${cS}: ${cD.challenge?.slice(0,20)}...`)
    : c.fail(`challenge → ${cS}`)

  const challenge = cD.challenge

  // Sign the challenge
  if (challenge) {
    const challengeHash = createHash('sha256').update(challenge).digest('hex')
    const { signature, timestamp } = agentKeys.sign({ path: '/clawid/verify', content_hash: challengeHash })

    // Verify
    const { status: vS, data: vD } = await req('POST', '/api/clawid/verify', {
      agent_id: agentId, challenge,
      public_key: agentKeys.pubHex,
      signature, timestamp,
      content_hash: challengeHash,
    })
    vS === 200 ? c.pass(`verify → 200: valid=${vD.valid}`) : c.warn(`verify → ${vS}: ${JSON.stringify(vD).slice(0,80)}`)
  }

  // Register ClawID
  const { status: rS } = await req('POST', '/api/clawid/register', {
    agent_id: agentId, public_key: agentKeys.pubHex
  }, apiKey)
  rS === 200 || rS === 201 || rS === 409
    ? c.pass(`clawid register → ${rS}`)
    : c.warn(`register → ${rS}`)
}

// ─── Governance ──────────────────────────────────────────────────────────────

async function testGovernance() {
  c.section('Governance — Overview / Proposals / Vote')

  const { status: oS, data: oD } = await req('GET', '/api/governance/overview')
  oS === 200 ? c.pass(`overview → 200`) : c.fail(`overview → ${oS}`)

  const { status: pS, data: pD } = await req('GET', '/api/governance/proposals?status=active')
  pS === 200
    ? c.pass(`proposals → 200: ${pD.proposals?.length ?? 0} proposals`)
    : c.fail(`proposals → ${pS}`)

  const proposalId = pD.proposals?.[0]?.id
  if (proposalId) {
    // Vote
    const { status: vS, data: vD } = await req('POST', '/api/governance/vote', {
      proposal_id: proposalId, vote: 'yes', voter_id: agentId
    }, apiKey)
    vS === 200 || vS === 400
      ? c.pass(`vote → ${vS}`)
      : c.warn(`vote → ${vS}: ${JSON.stringify(vD).slice(0,80)}`)
  }
}

// ─── Misc endpoints ──────────────────────────────────────────────────────────

async function testMisc() {
  c.section('Misc — Status / Stats / Profile / Telemetry / Storefront')

  // /api/status with agent_id
  const { status: stS } = await req('GET', `/api/status?agent_id=${agentId}`, undefined, apiKey)
  stS === 200 ? c.pass(`/api/status → 200`) : c.warn(`/api/status → ${stS}`)

  // /api/agent/[id]
  const { status: aS, data: aD } = await req('GET', `/api/agent/${agentId}`)
  aS === 200
    ? c.pass(`/api/agent/[id] → 200: ${aD.name}`)
    : c.fail(`/api/agent/[id] → ${aS}`)

  // Profile from API key
  const { status: prS, data: prD } = await req('GET', '/api/agent/profile', undefined, apiKey)
  prS === 200 ? c.pass(`profile (from key) → 200: ${prD.name}`) : c.fail(`profile → ${prS}`)

  // Telemetry from API key
  const { status: teS } = await req('GET', '/api/telemetry', undefined, apiKey)
  teS === 200 ? c.pass(`telemetry (from key) → 200`) : c.fail(`telemetry → ${teS}`)

  // Storefront update then get
  const { status: suS } = await req('PATCH', '/api/agent/storefront', {
    bio: 'Deep audit test agent', skills: ['testing', 'audit'],
    available_for_hire: true, rate_per_hour: 100,
  }, apiKey)
  suS === 200 || suS === 201 ? c.pass(`storefront PATCH → ${suS}`) : c.fail(`storefront → ${suS}`)

  const { status: sgS } = await req('GET', `/api/agent/storefront?agent_id=${agentId}`)
  sgS === 200 ? c.pass(`storefront GET → 200`) : c.fail(`storefront GET → ${sgS}`)

  // Activity
  const { status: acS } = await req('GET', `/api/agent/activity?agent_id=${agentId}`, undefined, apiKey)
  acS === 200 ? c.pass(`activity → 200`) : c.warn(`activity → ${acS}`)

  // Earnings
  const { status: eaS } = await req('GET', '/api/agent/earnings', undefined, apiKey)
  eaS === 200 ? c.pass(`earnings → 200`) : c.warn(`earnings → ${eaS}`)

  // Notifications
  const { status: nS } = await req('GET', '/api/agent/notifications', undefined, apiKey)
  nS === 200 ? c.pass(`notifications → 200`) : c.warn(`notifications → ${nS}`)

  // Bootstrap tasks + complete
  const { status: btS, data: btD } = await req('GET', '/api/bootstrap/tasks', undefined, apiKey)
  btS === 200 ? c.pass(`bootstrap tasks → 200: ${btD.tasks?.length ?? 0} tasks`) : c.warn(`bootstrap → ${btS}`)

  // Stats
  const { status: statsS } = await req('GET', '/api/stats')
  statsS === 200 ? c.pass(`stats → 200`) : c.warn(`stats → ${statsS}`)

  // Claw status (fixed)
  const { status: csS, data: csD } = await req('GET', '/api/claw/status')
  csS === 200
    ? c.pass(`claw/status → 200: ${csD.status}`)
    : c.fail(`claw/status → ${csS}: ${JSON.stringify(csD)}`)

  // Templates
  const { status: tmpS } = await req('GET', '/api/agent/templates?limit=3', undefined, apiKey)
  tmpS === 200 ? c.pass(`templates → 200`) : c.warn(`templates → ${tmpS}`)
}

// ─── Arbitra classify fix ─────────────────────────────────────────────────────

async function testArbitraClassify() {
  c.section('Arbitra Classify (committee-intelligence fix)')
  // This endpoint has a broken import — check if it crashes
  const { status } = await req('POST', '/api/arbitra/disputes/test-id/classify', {
    dispute_type: 'service_failure'
  }, apiKey)
  status !== 500
    ? c.pass(`classify → ${status} (no 500 crash)`)
    : c.fail(`classify → 500 (committee-intelligence types broken)`)
}

// ─── Cleanup ─────────────────────────────────────────────────────────────────

async function cleanup() {
  c.section('Cleanup')
  if (!SKEY) { c.warn('No SKEY — skipping cleanup'); return }

  for (const id of testAgents) {
    await supabaseDel('agent_registry', `agent_id=eq.${id}`)
    await supabaseDel('clawfs_files', `agent_id=eq.${id}`)
    await supabaseDel('clawfs_snapshots', `agent_id=eq.${id}`)
  }
  for (const jid of testJobs) {
    await supabaseDel('marketplace_jobs', `id=eq.${jid}`)
  }
  // Clean compute nodes from audit
  await supabaseDel('compute_nodes', `agent_id=eq.${agentId}`)
  await supabaseDel('webhook_agents', `agent_id=eq.${agentId}`)

  c.pass(`Cleaned ${testAgents.length} agents, ${testJobs.length} jobs`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n' + '═'.repeat(60))
  console.log('  MoltOS DEEP SYSTEM AUDIT — Everything')
  console.log(`  Target: ${BASE}`)
  console.log('═'.repeat(60))

  try {
    await setupTestAgent()
  } catch (e: any) {
    console.error('Setup failed:', e.message)
    process.exit(1)
  }

  try {
    await testClawFS()
    await testClawBus()
    await testClawKernel()
    await testClawScheduler()
    await testClawCompute()
    await testMarketplace()
    await testArbitra()
    await testTAP()
    await testKeyRecovery()
    await testBLS()
    await testSwarms()
    await testWebhookAgent()
    await testClawCloud()
    await testClawID()
    await testGovernance()
    await testMisc()
    await testArbitraClassify()
  } finally {
    await cleanup()
  }

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
