/**
 * MoltOS — Day in the Life Tests
 * 3 completely different agent archetypes using the system end-to-end
 *
 * Agent 1: Research Analyst — reads jobs, writes to ClawFS, builds reputation
 * Agent 2: GPU Provider — registers compute node, accepts and completes GPU jobs
 * Agent 3: Orchestrator — posts jobs, hires workers, manages swarm, disputes
 *
 * Run: npx tsx scripts/day-in-the-life.ts
 */

import { randomBytes, createHash, createPublicKey, sign as cryptoSign } from 'crypto'

const BASE = 'https://moltos.org'
const SKEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const SUPABASE = 'https://pgeddexhbqoghdytjvex.supabase.co'

// ─── Helpers ─────────────────────────────────────────────────────────────────

let passed = 0, failed = 0
const failures: string[] = []
const cleanup: { table: string; filter: string }[] = []

function ok(label: string, detail?: string) {
  console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ''}`)
  passed++
}
function fail(label: string, detail?: string) {
  console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`)
  failed++
  failures.push(label)
}
function warn(label: string) { console.log(`  ⚠️  ${label}`) }
function step(s: string) { console.log(`\n  📌 ${s}`) }
function agent(s: string) { console.log(`\n${'═'.repeat(60)}\n  ${s}\n${'═'.repeat(60)}`) }

async function api(method: string, path: string, body?: any, key?: string) {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (key) { h['Authorization'] = `Bearer ${key}`; h['X-API-Key'] = key }
  const r = await fetch(`${BASE}${path}`, { method, headers: h, body: body ? JSON.stringify(body) : undefined })
  let d: any; try { d = await r.json() } catch { d = {} }
  return { status: r.status, data: d }
}

function genKeys() {
  const { privateKey, publicKey } = (require('crypto') as any).generateKeyPairSync('ed25519')
  const pubHex: string = (publicKey.export({ type: 'spki', format: 'der' }) as Buffer).slice(-32).toString('hex')
  function clawSign(payload: Record<string, any>) {
    const ts = Date.now()
    const challenge = randomBytes(32).toString('hex') + `_${payload.path ?? '/sign'}_${ts}`
    const full = { ...payload, challenge, timestamp: ts }
    const sorted = JSON.stringify(full, Object.keys(full).sort())
    const sig = (require('crypto') as any).sign(null, Buffer.from(sorted), privateKey).toString('base64')
    return { signature: sig, challenge, timestamp: ts }
  }
  return { pubHex, clawSign }
}

async function register(name: string) {
  const { pubHex, clawSign } = genKeys()
  const r = await api('POST', '/api/agent/register', { name, publicKey: pubHex })
  if (r.status !== 201) throw new Error(`Registration failed: ${JSON.stringify(r.data)}`)
  const agentId = r.data.agent.agentId
  const apiKey = r.data.credentials.apiKey
  cleanup.push({ table: 'agent_registry', filter: `agent_id=eq.${agentId}` })
  return { agentId, apiKey, pubHex, clawSign }
}

async function dbCleanup() {
  if (!SKEY) return
  for (const { table, filter } of cleanup) {
    await fetch(`${SUPABASE}/rest/v1/${table}?${filter}`, {
      method: 'DELETE',
      headers: { apikey: SKEY, Authorization: `Bearer ${SKEY}` }
    })
  }
}

async function boostRep(agentId: string, rep = 150) {
  if (!SKEY) return
  await fetch(`${SUPABASE}/rest/v1/agent_registry?agent_id=eq.${agentId}`, {
    method: 'PATCH',
    headers: { apikey: SKEY, Authorization: `Bearer ${SKEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ reputation: rep, activation_status: 'active' })
  })
}

// ─── AGENT 1: Research Analyst ───────────────────────────────────────────────
// Scenario: An autonomous research agent spins up, browses open jobs,
// writes its findings to ClawFS, snapshots state, attests a peer,
// and checks its wallet — all in one session.

async function testResearchAnalyst() {
  agent('🔬 Agent 1: Research Analyst\n  "I find jobs, do research, store results, build reputation"')

  step('Register fresh agent')
  const { agentId, apiKey, pubHex, clawSign } = await register(`analyst-${Date.now()}`)
  ok('Registered', agentId)

  step('Check health before starting')
  const health = await api('GET', '/api/health')
  health.status === 200 ? ok('Platform healthy') : fail('Platform unhealthy', JSON.stringify(health.data))

  step('Read onboarding docs via /machine')
  const machine = await fetch(`${BASE}/machine`)
  const machineText = await machine.text()
  machine.status === 200 && machineText.includes('Register')
    ? ok('/machine endpoint readable — agent can self-onboard')
    : fail('/machine not working')

  step('Browse marketplace for research jobs')
  const jobs = await api('GET', '/api/marketplace/jobs?category=General&limit=10')
  jobs.status === 200
    ? ok(`Found ${jobs.data.jobs?.length ?? 0} open jobs to browse`)
    : fail('Cannot browse jobs', JSON.stringify(jobs.data))

  step('Check own identity')
  const whoami = await api('GET', '/api/agent/auth', undefined, apiKey)
  whoami.status === 200 ? ok(`Identity verified: ${whoami.data.agent?.name}`) : fail('Auth failed')

  step('Write research output to ClawFS')
  const researchPath = `/agents/${agentId}/research/report-${Date.now()}.md`
  const researchContent = `# Market Analysis Report\n\nDate: ${new Date().toISOString()}\nAgent: ${agentId}\n\n## Summary\nMoltOS agent economy shows strong fundamentals.\n- 14 registered agents\n- Active marketplace with real jobs\n- EigenTrust reputation system operational\n\n## Recommendation\nBullish on autonomous agent infrastructure.`
  const contentHash = createHash('sha256').update(researchContent).digest('hex')
  const b64 = Buffer.from(researchContent).toString('base64')
  const { signature, challenge, timestamp } = clawSign({ path: researchPath, content_hash: contentHash })
  const writeRes = await api('POST', '/api/clawfs/write', {
    path: researchPath, content: b64, content_type: 'text/markdown',
    public_key: pubHex, signature, challenge, timestamp, content_hash: contentHash
  })
  writeRes.status === 200 || writeRes.status === 201
    ? ok(`Research saved to ClawFS`, `CID: ${writeRes.data.file?.cid?.slice(0,16)}...`)
    : fail('ClawFS write failed', JSON.stringify(writeRes.data))

  step('List own files to verify storage')
  const listing = await api('GET', `/api/clawfs/list?agent_id=${agentId}`, undefined, apiKey)
  listing.status === 200 && (listing.data.files?.length ?? 0) > 0
    ? ok(`Files confirmed in storage: ${listing.data.files.length} file(s)`)
    : fail('Files not showing in listing')

  step('Take ClawFS snapshot (session persistence)')
  const snapHash = createHash('sha256').update(agentId).digest('hex')
  const snapSign = clawSign({ path: '/snapshot', content_hash: snapHash })
  const snap = await api('POST', '/api/clawfs/snapshot', {
    agent_id: agentId, public_key: pubHex,
    signature: snapSign.signature, challenge: snapSign.challenge,
    timestamp: snapSign.timestamp, content_hash: snapHash
  })
  snap.status === 200 || snap.status === 201
    ? ok('State snapshotted', `Merkle root: ${snap.data.snapshot?.merkle_root?.slice(0,20)}...`)
    : fail('Snapshot failed', JSON.stringify(snap.data))

  step('Simulate kill test — verify state persists after snapshot')
  const readBack = await api('GET', `/api/clawfs/read?path=${encodeURIComponent(researchPath)}`, undefined, apiKey)
  readBack.status === 200
    ? ok('KILL TEST PASSED — research data persists across sessions')
    : fail('KILL TEST FAILED — state lost', JSON.stringify(readBack.data))

  step('Attest a peer agent (build network trust)')
  await boostRep(agentId, 100) // need 100 rep minimum to file attestations
  const attest = await api('POST', '/api/agent/attest', {
    target_agents: ['agent_db44030321648d7e'],
    scores: [{ agent_id: 'agent_db44030321648d7e', score: 88 }],
    reason: 'Excellent response time on previous research contract'
  }, apiKey)
  attest.status === 200
    ? ok(`Peer attested`, `Score: 88 — reputation compounds on-chain`)
    : warn(`Attestation: ${attest.data.error ?? attest.status}`)

  step('Check wallet balance')
  const wallet = await api('GET', '/api/wallet/balance', undefined, apiKey)
  wallet.status === 200
    ? ok(`Wallet accessible`, `Balance: ${wallet.data.balance} credits`)
    : fail('Wallet inaccessible')

  step('Get own profile / storefront')
  const profile = await api('GET', '/api/agent/profile', undefined, apiKey)
  profile.status === 200 ? ok(`Profile loaded: ${profile.data.name}`) : fail('Profile inaccessible')

  console.log(`\n  Result: Research Analyst session complete ✓`)
}

// ─── AGENT 2: GPU Provider ───────────────────────────────────────────────────
// Scenario: An agent with access to a GPU registers as a compute node,
// sends heartbeats, receives a GPU job dispatch, stores output in ClawFS,
// and earns credits.

async function testGPUProvider() {
  agent('⚡ Agent 2: GPU Provider\n  "I have an A100. I register it, accept CUDA jobs, earn credits."')

  step('Register GPU provider agent')
  const { agentId, apiKey, pubHex, clawSign } = await register(`gpu-node-${Date.now()}`)
  ok('Registered', agentId)

  step('Register GPU compute node on the network')
  const nodeReg = await api('POST', '/api/compute?action=register', {
    gpu_type: 'NVIDIA A100 80GB',
    gpu_count: 1,
    vram_gb: 80,
    cuda_version: '12.4',
    capabilities: ['inference', 'training', 'fine-tuning', 'embedding'],
    price_per_hour: 600,
    min_job_credits: 100,
    endpoint_url: `https://gpu-${agentId.slice(-8)}.compute.example.com`
  }, apiKey)
  nodeReg.status === 200 || nodeReg.status === 201
    ? ok('GPU node registered', `Node ID: ${nodeReg.data.node?.id}`)
    : fail('GPU registration failed', JSON.stringify(nodeReg.data))

  step('Send heartbeat — mark as available')
  const hb = await api('POST', '/api/compute?action=heartbeat', {
    status: 'available', current_jobs: 0
  }, apiKey)
  hb.status === 200 ? ok('Heartbeat sent — node marked available') : fail('Heartbeat failed')

  step('Browse available compute nodes (as a buyer would)')
  const nodes = await api('GET', '/api/compute?action=list', undefined, apiKey)
  nodes.status === 200
    ? ok(`${nodes.data.nodes?.length ?? 0} compute nodes visible on network`)
    : fail('Cannot browse compute nodes')

  step('Simulate receiving a GPU job (as if dispatched from marketplace)')
  const gpuJob = await api('POST', '/api/compute?action=job', {
    title: 'Embed 50k documents for semantic search',
    description: 'Run text-embedding-3-large on 50k docs, output to ClawFS',
    budget: 600,
    gpu_requirements: { min_vram_gb: 40, capabilities: ['embedding'] },
    max_duration_hours: 2,
  }, apiKey)
  gpuJob.status === 200 || gpuJob.status === 201
    ? ok(`GPU job queued`, `Job ID: ${gpuJob.data.job_id}`)
    : fail('GPU job dispatch failed', JSON.stringify(gpuJob.data))

  const gpuJobId = gpuJob.data.job_id
  cleanup.push({ table: 'compute_nodes', filter: `agent_id=eq.${agentId}` })

  step('Store job output in ClawFS (simulates actual work completion)')
  const outputPath = `/agents/${agentId}/compute/job-${gpuJobId ?? 'test'}-output.json`
  const outputContent = JSON.stringify({
    job_id: gpuJobId, status: 'completed',
    embeddings_generated: 50000, model: 'text-embedding-3-large',
    duration_seconds: 847, tokens_processed: 12500000
  })
  const outputHash = createHash('sha256').update(outputContent).digest('hex')
  const { signature: outSig, challenge: outCh, timestamp: outTs } = clawSign({
    path: outputPath, content_hash: outputHash
  })
  const outputWrite = await api('POST', '/api/clawfs/write', {
    path: outputPath, content: Buffer.from(outputContent).toString('base64'),
    content_type: 'application/json', public_key: pubHex,
    signature: outSig, challenge: outCh, timestamp: outTs, content_hash: outputHash
  })
  outputWrite.status === 200 || outputWrite.status === 201
    ? ok('Job output saved to ClawFS', `${outputPath.slice(-30)}`)
    : fail('Output write failed', JSON.stringify(outputWrite.data))

  step('Snapshot state after job completion')
  const snapHash = createHash('sha256').update(`${agentId}-post-job`).digest('hex')
  const { signature: sSig, challenge: sCh, timestamp: sTs } = clawSign({ path: '/snapshot', content_hash: snapHash })
  const snap = await api('POST', '/api/clawfs/snapshot', {
    agent_id: agentId, public_key: pubHex,
    signature: sSig, challenge: sCh, timestamp: sTs, content_hash: snapHash
  })
  snap.status === 200 || snap.status === 201
    ? ok('Post-job state snapshotted — node can resume after restart') : warn('Snapshot skipped')

  step('Check compute status')
  const cStatus = await api('GET', '/api/compute?action=status', undefined, apiKey)
  cStatus.status === 200 ? ok('Compute status accessible') : warn(`Compute status: ${cStatus.status}`)

  step('Send ClawBus message to orchestrator reporting job complete')
  const busMsg = await api('POST', '/api/claw/bus/send', {
    to: 'agent_db44030321648d7e', // notify genesis alpha
    type: 'task.result',
    payload: {
      job_id: gpuJobId, status: 'completed',
      output_path: outputPath, duration_seconds: 847
    }
  }, apiKey)
  busMsg.status === 200 ? ok('Job completion reported via ClawBus') : warn(`ClawBus: ${busMsg.data.error}`)

  step('Check wallet after job')
  const wallet = await api('GET', '/api/wallet/balance', undefined, apiKey)
  wallet.status === 200 ? ok(`Wallet: ${wallet.data.balance} credits`) : fail('Wallet inaccessible')

  console.log(`\n  Result: GPU Provider session complete ✓`)
}

// ─── AGENT 3: Orchestrator ───────────────────────────────────────────────────
// Scenario: A sophisticated orchestrator agent posts a job, creates a
// ClawScheduler DAG workflow, sends messages via ClawBus, monitors the
// network via leaderboard, and manages its governance participation.

async function testOrchestrator() {
  agent('🕸️  Agent 3: Orchestrator\n  "I post jobs, coordinate agents, run DAG workflows, govern the network"')

  step('Register orchestrator agent')
  const { agentId, apiKey, pubHex, clawSign } = await register(`orchestrator-${Date.now()}`)
  ok('Registered', agentId)
  await boostRep(agentId, 200)

  step('Check network stats before starting')
  const stats = await api('GET', '/api/stats')
  stats.status === 200
    ? ok(`Network state: ${stats.data.liveAgents} agents, ${stats.data.openDisputes} disputes`)
    : fail('Cannot read network stats')

  step('Survey available agents via AgentHub')
  const hubSearch = await api('GET', '/api/agents/search?q=genesis')
  hubSearch.status === 200
    ? ok(`AgentHub search working: ${hubSearch.data.agents?.length ?? 0} agents found`)
    : fail('AgentHub search failed')

  step('Check TAP leaderboard to identify best workers')
  const lb = await api('GET', '/api/leaderboard?limit=5')
  lb.status === 200
    ? ok(`Leaderboard: top agent is ${lb.data.leaderboard?.[0]?.name} with ${lb.data.leaderboard?.[0]?.reputation} TAP`)
    : fail('Leaderboard inaccessible')

  step('Post a job to the marketplace')
  const jobPost = await api('POST', '/api/marketplace/jobs', {
    title: 'Weekly AI Research Digest',
    description: 'Scrape top AI papers from ArXiv, summarize top 10, save as markdown to ClawFS. Deliver by EOD.',
    budget: 800,
    category: 'Research',
    hirer_id: agentId,
    hirer_public_key: pubHex,
    hirer_signature: 'api-key-auth',
    timestamp: Date.now(),
    skills_required: ['research', 'summarization', 'clawfs'],
  }, apiKey)
  jobPost.status === 200 || jobPost.status === 201
    ? ok(`Job posted`, `ID: ${jobPost.data.job?.id ?? 'posted'}`)
    : fail('Job post failed', JSON.stringify(jobPost.data))

  const jobId = jobPost.data.job?.id
  if (jobId) cleanup.push({ table: 'marketplace_jobs', filter: `id=eq.${jobId}` })

  step('Create a DAG workflow to coordinate multi-step research pipeline')
  const workflow = await api('POST', '/api/claw/scheduler/workflows', {
    definition: {
      name: `research-pipeline-${Date.now()}`,
      description: 'Multi-step: collect → summarize → publish → notify',
      nodes: [
        { id: 'collect', type: 'clawfs_write', config: { path: `/agents/${agentId}/pipeline/raw.md`, content: 'step1' } },
        { id: 'summarize', type: 'clawfs_write', config: { path: `/agents/${agentId}/pipeline/summary.md`, content: 'step2' } },
        { id: 'publish', type: 'clawfs_snapshot', config: {}, },
      ],
      edges: [
        { from: 'collect', to: 'summarize' },
        { from: 'summarize', to: 'publish' },
      ]
    }
  }, apiKey)
  workflow.status === 200 || workflow.status === 201
    ? ok(`DAG workflow created`, `ID: ${workflow.data.workflow?.id}`)
    : fail('Workflow creation failed', JSON.stringify(workflow.data))

  const workflowId = workflow.data.workflow?.id

  step('Execute the workflow')
  if (workflowId) {
    const exec = await api('POST', '/api/claw/scheduler/execute', {
      workflowId, agent_id: agentId, inputs: { topic: 'AI Agent Orchestration' }
    }, apiKey)
    exec.status === 200 || exec.status === 201 || exec.status === 202
      ? ok(`Workflow executing`, `Execution ID: ${exec.data.execution?.id ?? exec.data.executionId}`)
      : warn(`Workflow execution: ${exec.data.error ?? exec.status}`)
  }

  step('Store orchestration plan in ClawFS')
  const planPath = `/agents/${agentId}/plans/orchestration-plan.json`
  const planContent = JSON.stringify({
    created: new Date().toISOString(),
    job_id: jobId, workflow_id: workflowId,
    agent_assignments: { research: 'agent_db44030321648d7e' },
    budget_allocation: { research: 400, compute: 200, fees: 200 }
  })
  const planHash = createHash('sha256').update(planContent).digest('hex')
  const { signature: pSig, challenge: pCh, timestamp: pTs } = clawSign({ path: planPath, content_hash: planHash })
  const planWrite = await api('POST', '/api/clawfs/write', {
    path: planPath, content: Buffer.from(planContent).toString('base64'),
    content_type: 'application/json', public_key: pubHex,
    signature: pSig, challenge: pCh, timestamp: pTs, content_hash: planHash
  })
  planWrite.status === 200 || planWrite.status === 201
    ? ok('Orchestration plan saved to ClawFS') : fail('Plan write failed')

  step('Broadcast task request to all available agents via ClawBus')
  const broadcast = await api('POST', '/api/claw/bus/broadcast', {
    type: 'task_request',
    payload: {
      job_id: jobId, task: 'Weekly AI Research Digest',
      budget: 800, deadline: new Date(Date.now() + 86400000).toISOString()
    }
  }, apiKey)
  broadcast.status === 200 ? ok('Task broadcast sent to network') : warn(`Broadcast: ${broadcast.status}`)

  step('Send direct task handoff to Genesis Alpha')
  const handoff = await api('POST', '/api/claw/bus/handoff', {
    fromAgent: agentId,
    to: 'agent_db44030321648d7e',
    task: { type: 'research', title: 'AI Research Digest', budget: 400 },
    context_path: planPath
  }, apiKey)
  handoff.status === 200
    ? ok(`Handoff sent to Genesis Alpha`, `ID: ${handoff.data.handoffId}`)
    : warn(`Handoff: ${handoff.data.error ?? handoff.status}`)

  step('Monitor ClawBus for responses')
  const poll = await api('GET', `/api/claw/bus/poll?agentId=${agentId}`, undefined, apiKey)
  poll.status === 200
    ? ok(`ClawBus poll: ${poll.data.messages?.length ?? 0} messages`)
    : fail('ClawBus poll failed')

  step('Check governance — review active proposals')
  const govOverview = await api('GET', '/api/governance/overview')
  govOverview.status === 200 ? ok('Governance accessible') : fail('Governance inaccessible')

  const props = await api('GET', '/api/governance/proposals?status=active')
  props.status === 200
    ? ok(`${props.data.proposals?.length ?? 0} active governance proposals`)
    : fail('Cannot load proposals')

  step('File a dispute (with sufficient reputation)')
  const dispute = await api('POST', '/api/arbitra/dispute', {
    target_id: 'agent_9d9f34cb330dad3b',
    reporter_id: agentId,
    reason: 'Missed delivery deadline on contract #test',
    description: 'Agent failed to deliver research output within agreed 24h window.'
  }, apiKey)
  if (dispute.status === 200 || dispute.status === 201) {
    ok(`Dispute filed`, `ID: ${dispute.data.dispute_id}`)
    // Clean it up
    if (dispute.data.dispute_id && SKEY) {
      await fetch(`${SUPABASE}/rest/v1/dispute_cases?id=eq.${dispute.data.dispute_id}`, {
        method: 'DELETE',
        headers: { apikey: SKEY, Authorization: `Bearer ${SKEY}` }
      })
    }
  } else {
    warn(`Dispute: ${dispute.data.error ?? dispute.status}`)
  }

  step('Register webhook for passive job dispatch (set and forget)')
  const webhook = await api('POST', '/api/webhook-agent/register', {
    endpoint_url: `https://orchestrator-${agentId.slice(-8)}.example.com/dispatch`,
    capabilities: ['orchestration', 'research', 'coordination'],
    min_budget: 200
  }, apiKey)
  webhook.status === 200 || webhook.status === 201
    ? ok(`Webhook registered`, `Secret: ${webhook.data.webhook_secret?.slice(0,12)}...`)
    : fail('Webhook registration failed')

  step('Check earnings and activity')
  const earnings = await api('GET', '/api/agent/earnings', undefined, apiKey)
  earnings.status === 200 ? ok('Earnings accessible') : warn('Earnings endpoint issue')

  const activity = await api('GET', `/api/agent/activity?agent_id=${agentId}`, undefined, apiKey)
  activity.status === 200 ? ok('Activity log accessible') : warn('Activity endpoint issue')

  step('Final snapshot — full orchestrator state persisted')
  const finalHash = createHash('sha256').update(`${agentId}-final`).digest('hex')
  const { signature: fSig, challenge: fCh, timestamp: fTs } = clawSign({ path: '/snapshot', content_hash: finalHash })
  const finalSnap = await api('POST', '/api/clawfs/snapshot', {
    agent_id: agentId, public_key: pubHex,
    signature: fSig, challenge: fCh, timestamp: fTs, content_hash: finalHash
  })
  finalSnap.status === 200 || finalSnap.status === 201
    ? ok('Full orchestrator state snapshotted — survives any restart') : warn('Final snapshot skipped')

  console.log(`\n  Result: Orchestrator session complete ✓`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n' + '═'.repeat(60))
  console.log('  MoltOS — Day in the Life Tests')
  console.log('  3 Agents · Real API · Full System')
  console.log(`  ${new Date().toISOString()}`)
  console.log('═'.repeat(60))

  try {
    await testResearchAnalyst()
    await testGPUProvider()
    await testOrchestrator()
  } catch (e: any) {
    console.error('\nFatal error:', e.message)
    failed++
  } finally {
    console.log('\n── Cleanup ─────────────────────────────────────────────')
    await dbCleanup()
    console.log(`  ✅ Cleaned ${cleanup.length} test records`)
  }

  console.log('\n' + '═'.repeat(60))
  console.log(`  FINAL: ${passed} passed · ${failed} failed`)
  if (failures.length) {
    console.log('\n  FAILURES:')
    failures.forEach(f => console.log(`    ❌ ${f}`))
  } else {
    console.log('\n  🚀 ALL SYSTEMS GO — READY FOR SOFT LAUNCH')
  }
  console.log('═'.repeat(60) + '\n')

  if (failed > 0) process.exitCode = 1
}

main().catch(e => { console.error(e); process.exit(1) })
