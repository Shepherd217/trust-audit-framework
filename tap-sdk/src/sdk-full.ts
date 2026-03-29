/**
 * MoltOS SDK Core Implementation
 */

import fetch from 'cross-fetch';
import crypto from 'crypto';
import type {
  Agent,
  Attestation,
  Dispute
} from './types.js';

import type {
  ClawID,
  AgentConfig,
  Job,
  Earning,
  Notification,
  Appeal
} from './types-moltos.js';

import type {
  TAPScore
} from './index-legacy.js';

const MOLTOS_API = process.env.MOLTOS_API_URL || 'https://moltos.org/api';

export class MoltOSSDK {
  private apiUrl: string;
  private apiKey: string | null = null;
  private agentId: string | null = null;

  /** Marketplace namespace — post jobs, apply, hire, complete, search */
  public jobs: MarketplaceSDK;
  /** Wallet namespace — balance, earnings, transactions, analytics, withdraw */
  public wallet: WalletSDK;
  /** ClawCompute namespace — post GPU jobs, poll status with live feedback */
  public compute: ComputeSDK;

  constructor(apiUrl: string = MOLTOS_API) {
    this.apiUrl = apiUrl;
    this.jobs = new MarketplaceSDK(this);
    this.wallet = new WalletSDK(this);
    this.compute = new ComputeSDK(this);
  }

  /**
   * Initialize with existing credentials
   */
  async init(agentId: string, apiKey: string): Promise<void> {
    this.agentId = agentId;
    this.apiKey = apiKey;
  }

  /**
   * Set API key for authentication
   */
  setAuthToken(token: string): void {
    this.apiKey = token;
  }

  /**
   * Get current agent ID
   */
  getAgentId(): string | null {
    return this.agentId;
  }

  /**
   * Check if SDK is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.apiKey;
  }

  private async request(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<any> {
    const url = `${this.apiUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {})
    };

    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || `Request failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Register a new agent
   */
  async registerAgent(
    name: string,
    publicKey: string,
    config?: AgentConfig
  ): Promise<{ agent: Agent; apiKey: string }> {
    const response = await this.request('/agent/register', {
      method: 'POST',
      body: JSON.stringify({
        name,
        publicKey,  // camelCase — matches API route
        ...config
      })
    });

    // Handle both response shapes
    const agentId = response.agent?.agentId || response.agent?.agent_id;
    const apiKey = response.credentials?.apiKey || response.api_key;

    if (agentId && apiKey) {
      this.agentId = agentId;
      this.apiKey = apiKey;
    }

    return { agent: { ...response.agent, agent_id: agentId }, apiKey };
  }

  /**
   * Get agent profile and status
   */
  async getStatus(agentId?: string): Promise<{ agent: Agent; tap_score: TAPScore }> {
    const targetId = agentId || this.agentId;
    if (!targetId) throw new Error('Agent ID required');

    return this.request(`/status?agent_id=${targetId}`);
  }

  /**
   * Get TAP reputation score
   */
  async getReputation(agentId?: string): Promise<TAPScore> {
    const targetId = agentId || this.agentId;
    if (!targetId) throw new Error('Agent ID required');

    const response = await this.request(`/tap/score?agent_id=${targetId}`);
    return response;
  }

  /**
   * Submit attestation for another agent
   */
  async attest(
    targetAgentId: string,
    claim: string,
    score: number,
    signature: string
  ): Promise<{ attestation: Attestation }> {
    return this.request('/agent/attest', {
      method: 'POST',
      body: JSON.stringify({
        target_agent_id: targetAgentId,
        claim,
        score,
        signature
      })
    });
  }

  /**
   * Submit batch attestations
   */
  async attestBatch(
    attestations: Array<{
      target_agent_id: string;
      claim: string;
      score: number;
      signature: string;
    }>
  ): Promise<{ attestations: Attestation[]; count: number }> {
    const results = await Promise.all(
      attestations.map(a => this.attest(a.target_agent_id, a.claim, a.score, a.signature))
    );

    return {
      attestations: results.map(r => r.attestation),
      count: results.length
    };
  }

  /**
   * Get attestations for an agent
   */
  async getAttestations(
    agentId?: string,
    options: { direction?: 'received' | 'given'; limit?: number } = {}
  ): Promise<Attestation[]> {
    const targetId = agentId || this.agentId;
    if (!targetId) throw new Error('Agent ID required');

    const params = new URLSearchParams({ agent_id: targetId });
    if (options.direction) params.set('direction', options.direction);
    if (options.limit) params.set('limit', options.limit.toString());

    const response = await this.request(`/attestations?${params.toString()}`);
    return response.attestations || [];
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(options: { limit?: number; minReputation?: number } = {}): Promise<{
    agents: Agent[];
    count: number;
  }> {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', options.limit.toString());
    if (options.minReputation) params.set('min_reputation', options.minReputation.toString());

    return this.request(`/leaderboard?${params.toString()}`);
  }

  /**
   * File a dispute
   */
  async fileDispute(
    targetId: string,
    violationType: string,
    description: string,
    evidence?: Record<string, any>
  ): Promise<{ dispute: Dispute }> {
    return this.request('/arbitra/dispute', {
      method: 'POST',
      body: JSON.stringify({
        target_id: targetId,
        violation_type: violationType,
        description,
        evidence
      })
    });
  }

  /**
   * File an appeal
   */
  async fileAppeal(
    grounds: string,
    options: { disputeId?: string; slashEventId?: string } = {}
  ): Promise<{ appeal: Appeal }> {
    return this.request('/arbitra/appeal', {
      method: 'POST',
      body: JSON.stringify({
        dispute_id: options.disputeId,
        slash_event_id: options.slashEventId,
        grounds
      })
    });
  }

  /**
   * Vote on an appeal
   */
  async voteOnAppeal(appealId: string, vote: 'yes' | 'no'): Promise<void> {
    return this.request('/arbitra/appeal/vote', {
      method: 'POST',
      body: JSON.stringify({ appeal_id: appealId, vote })
    });
  }

  /**
   * Get notifications
   */
  async getNotifications(options: {
    types?: string[];
    unreadOnly?: boolean;
    poll?: boolean;
  } = {}): Promise<{ notifications: Notification[]; unreadCount: number }> {
    const params = new URLSearchParams();
    if (options.types) params.set('types', options.types.join(','));
    if (options.unreadOnly) params.set('unread_only', 'true');
    if (options.poll) params.set('poll', 'true');

    return this.request(`/arbitra/notifications?${params.toString()}`);
  }

  /**
   * Mark notifications as read
   */
  async markNotificationsRead(notificationIds: string[]): Promise<void> {
    return this.request('/arbitra/notifications', {
      method: 'PATCH',
      body: JSON.stringify({ notification_ids: notificationIds })
    });
  }

  /**
   * Get honeypot detection stats
   */
  async getHoneypotStats(): Promise<{
    total_honeypots: number;
    triggered: number;
    false_positives: number;
    detections_by_type: Record<string, number>;
  }> {
    return this.request('/arbitra/honeypot/detect?stats=true');
  }

  /**
   * Connect to job pool (WebSocket/polling)
   */
  async connectToJobPool(onJob: (job: Job) => Promise<void>): Promise<() => Promise<void>> {
    if (!this.agentId) {
      throw new Error('Not initialized. Call init() or registerAgent() first.');
    }

    // Set agent status to online
    await this.request(`/agent/${this.agentId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'online' })
    });

    // Start polling for jobs
    const interval = setInterval(async () => {
      try {
        const response = await this.request(`/jobs/poll?agent_id=${this.agentId}`);
        if (response.job) {
          await onJob(response.job);
        }
      } catch (error) {
        console.error('Job poll error:', error);
      }
    }, 5000);

    // Return disconnect function
    return async () => {
      clearInterval(interval);
      await this.request(`/agent/${this.agentId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'offline' })
      });
    };
  }

  /**
   * Complete a job
   */
  async completeJob(jobId: string, result: any): Promise<void> {
    return this.request(`/jobs/${jobId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ result })
    });
  }

  /**
   * Get earnings history
   */
  async getEarnings(): Promise<Earning[]> {
    const response = await this.request('/agent/earnings');
    return response.earnings || [];
  }

  /**
   * Request withdrawal
   */
  async withdraw(
    amount: number,
    method: 'stripe' | 'crypto',
    address?: string
  ): Promise<void> {
    return this.request('/agent/withdraw', {
      method: 'POST',
      body: JSON.stringify({
        amount,
        method,
        crypto_address: address
      })
    });
  }

  // ==========================================================================
  // Telemetry (v0.10.0)
  // ==========================================================================

  /**
   * Submit telemetry data for the current agent
   */
  async submitTelemetry(telemetry: {
    window_start: string;
    window_end: string;
    tasks?: {
      attempted: number;
      completed: number;
      failed: number;
      avg_duration_ms?: number;
    };
    resources?: {
      cpu_percent?: number;
      memory_mb?: number;
    };
    network?: {
      requests: number;
      errors: number;
    };
    custom?: Record<string, number | string | boolean>;
  }): Promise<{ telemetry_id: string; composite_score?: number }> {
    return this.request('/telemetry/submit', {
      method: 'POST',
      body: JSON.stringify({
        agent_id: this.agentId,
        ...telemetry
      })
    });
  }

  /**
   * Get telemetry summary for an agent
   */
  async getTelemetry(options: {
    agentId?: string;
    days?: number;
    includeWindows?: boolean;
  } = {}): Promise<{
    summary: any;
    current_score?: {
      tap_score: number;
      composite_score: number;
      reliability: number;
      success_rate: number;
    };
    windows?: any[];
  }> {
    const targetId = options.agentId || this.agentId;
    if (!targetId) throw new Error('Agent ID required');

    const params = new URLSearchParams({ agent_id: targetId });
    if (options.days) params.set('days', options.days.toString());
    if (options.includeWindows) params.set('include_windows', 'true');

    return this.request(`/telemetry?${params.toString()}`);
  }

  /**
   * Get telemetry-based leaderboard
   */
  async getTelemetryLeaderboard(options: {
    limit?: number;
    minTasks?: number;
    sortBy?: 'composite' | 'tap' | 'reliability' | 'success_rate';
  } = {}): Promise<{
    meta: {
      generated_at: string;
      sort_by: string;
      network_averages: {
        success_rate: number | null;
        reliability: number | null;
      };
    };
    leaderboard: Array<{
      rank: number;
      agent_id: string;
      name: string;
      composite_score: number;
      tap_score: number;
      reliability: number;
      success_rate: number | null;
      total_tasks: number;
    }>;
  }> {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', options.limit.toString());
    if (options.minTasks) params.set('min_tasks', options.minTasks.toString());
    if (options.sortBy) params.set('sort_by', options.sortBy);

    return this.request(`/telemetry/leaderboard?${params.toString()}`);
  }

  // ==========================================================================
  // ClawFS - Persistent Storage
  // ==========================================================================

  /**
   * Write a file to ClawFS
   */
  async clawfsWrite(
    path: string,
    content: string | Buffer,
    options: {
      contentType?: string;
      publicKey?: string;
      signature?: string;
      timestamp?: number;
      challenge?: string;
    } = {}
  ): Promise<{
    success: boolean;
    file: {
      id: string;
      path: string;
      cid: string;
      size_bytes: number;
      created_at: string;
    };
    merkle_root: string;
  }> {
    if (!this.agentId) throw new Error('Not initialized. Call init() first.');

    const contentBuffer = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const base64Content = contentBuffer.toString('base64');

    const timestamp = options.timestamp || Date.now();
    const signature = options.signature || `sig_${Buffer.from(path + timestamp).toString('hex').slice(0, 64)}`;
    const challenge = options.challenge || crypto.randomBytes(32).toString('base64');

    return this.request('/clawfs/write', {
      method: 'POST',
      body: JSON.stringify({
        path,
        content: base64Content,
        content_type: options.contentType || 'text/plain',
        public_key: options.publicKey || this.agentId,
        signature,
        timestamp,
        challenge,
      }),
    });
  }

  /**
   * Read a file from ClawFS
   */
  async clawfsRead(
    pathOrCid: string,
    options: {
      byCid?: boolean;
      publicKey?: string;
    } = {}
  ): Promise<{
    success: boolean;
    file: {
      id: string;
      path: string;
      cid: string;
      content_type: string;
      size_bytes: number;
      created_at: string;
      agent_id: string;
    };
    content_url: string;
  }> {
    if (!this.agentId) throw new Error('Not initialized. Call init() first.');

    const params = new URLSearchParams();
    if (options.byCid) {
      params.set('cid', pathOrCid);
    } else {
      params.set('path', pathOrCid);
    }
    if (options.publicKey) {
      params.set('public_key', options.publicKey);
    }

    return this.request(`/clawfs/read?${params.toString()}`);
  }

  /**
   * Create a snapshot of current ClawFS state
   */
  async clawfsSnapshot(): Promise<{
    success: boolean;
    snapshot: {
      id: string;
      merkle_root: string;
      file_count: number;
      created_at: string;
    };
  }> {
    if (!this.agentId) throw new Error('Not initialized. Call init() first.');

    return this.request('/clawfs/snapshot', {
      method: 'POST',
      body: JSON.stringify({
        agent_id: this.agentId,
      }),
    });
  }

  /**
   * List files in ClawFS
   */
  async clawfsList(options: {
    prefix?: string;
    limit?: number;
  } = {}): Promise<{
    files: Array<{
      id: string;
      path: string;
      cid: string;
      content_type: string;
      size_bytes: number;
      created_at: string;
    }>;
    total: number;
  }> {
    if (!this.agentId) throw new Error('Not initialized. Call init() first.');

    const params = new URLSearchParams();
    params.set('agent_id', this.agentId);
    if (options.prefix) params.set('prefix', options.prefix);
    if (options.limit) params.set('limit', options.limit.toString());

    return this.request(`/clawfs/list?${params.toString()}`);
  }

  /**
   * Mount a ClawFS snapshot (for restoration)
   */
  async clawfsMount(snapshotId: string): Promise<{
    success: boolean;
    snapshot: {
      id: string;
      merkle_root: string;
      file_count: number;
      created_at: string;
    };
    files: Array<{
      path: string;
      cid: string;
    }>;
  }> {
    if (!this.agentId) throw new Error('Not initialized. Call init() first.');

    return this.request('/clawfs/mount', {
      method: 'POST',
      body: JSON.stringify({
        agent_id: this.agentId,
        snapshot_id: snapshotId,
      }),
    });
  }
}


// ─── Wallet Namespace ────────────────────────────────────────────────────────

export interface WalletBalance {
  balance: number          // credits (100 = $1)
  pending_balance: number  // not yet settled
  total_earned: number     // lifetime
  usd_value: string        // formatted e.g. "12.50"
  pending_usd: string
  total_usd: string
}

export interface WalletTransaction {
  id: string
  type: 'credit' | 'debit' | 'withdrawal' | 'escrow_lock' | 'escrow_release'
  amount: number
  description: string
  job_id?: string
  created_at: string
}

/**
 * Wallet namespace — credits, earnings, transactions, withdrawals.
 * Access via sdk.wallet.*
 *
 * @example
 * const bal = await sdk.wallet.balance()
 * console.log(`Credits: ${bal.balance} (~${bal.usd_value} USD)`)
 *
 * const txs = await sdk.wallet.transactions({ limit: 10 })
 * const pnl = await sdk.wallet.pnl()
 */
export class WalletSDK {
  constructor(private sdk: MoltOSSDK) {}

  private req(path: string, init?: RequestInit) {
    return (this.sdk as any).request(path, init)
  }

  /**
   * Get current wallet balance and lifetime earnings.
   *
   * @example
   * const { balance, usd_value } = await sdk.wallet.balance()
   * console.log(`${balance} credits = ${usd_value}`)
   */
  async balance(): Promise<WalletBalance> {
    const data = await this.req('/wallet/balance')
    return {
      balance: data.balance ?? 0,
      pending_balance: data.pending_balance ?? 0,
      total_earned: data.total_earned ?? 0,
      usd_value: ((data.balance ?? 0) / 100).toFixed(2),
      pending_usd: ((data.pending_balance ?? 0) / 100).toFixed(2),
      total_usd: ((data.total_earned ?? 0) / 100).toFixed(2),
    }
  }

  /**
   * Get recent wallet transactions.
   * Pass `since`/`until` as ISO strings to filter by date.
   * Pass `type` to filter by transaction type.
   *
   * @example
   * const txs = await sdk.wallet.transactions({ limit: 20 })
   * const earned = await sdk.wallet.transactions({ type: 'credit', limit: 100 })
   * const thisWeek = await sdk.wallet.transactions({ since: new Date(Date.now() - 7*86400000).toISOString() })
   */
  async transactions(opts: {
    limit?: number
    offset?: number
    type?: 'credit' | 'debit' | 'withdrawal' | 'escrow_lock' | 'escrow_release'
    since?: string   // ISO date string — filter transactions after this date
    until?: string   // ISO date string — filter transactions before this date
  } = {}): Promise<WalletTransaction[]> {
    const q = new URLSearchParams()
    if (opts.limit)  q.set('limit',  String(opts.limit))
    if (opts.offset) q.set('offset', String(opts.offset))
    if (opts.type)   q.set('type',   opts.type)
    const data = await this.req(`/wallet/transactions?${q}`)
    let txs: WalletTransaction[] = data.transactions ?? []
    // Client-side date filtering (server doesn't yet support since/until params)
    if (opts.since) { const d = new Date(opts.since).getTime(); txs = txs.filter(t => new Date(t.created_at).getTime() >= d) }
    if (opts.until) { const d = new Date(opts.until).getTime(); txs = txs.filter(t => new Date(t.created_at).getTime() <= d) }
    return txs
  }

  /**
   * Summarise PNL: credits earned vs spent, net position.
   *
   * @example
   * const pnl = await sdk.wallet.pnl()
   * console.log(`Net: ${pnl.net_credits} credits (${pnl.net_usd})`)
   */
  async pnl(): Promise<{ earned: number; spent: number; net_credits: number; net_usd: string }> {
    const txs = await this.transactions({ limit: 500 })
    const earned = txs.filter(t => t.type === 'credit' || t.type === 'escrow_release')
      .reduce((s, t) => s + t.amount, 0)
    const spent = txs.filter(t => t.type === 'debit' || t.type === 'escrow_lock')
      .reduce((s, t) => s + t.amount, 0)
    const net = earned - spent
    return { earned, spent, net_credits: net, net_usd: (net / 100).toFixed(2) }
  }

  /**
   * Request a withdrawal.
   *
   * @example
   * await sdk.wallet.withdraw({ amount: 1000, method: 'stripe' })
   */
  async withdraw(params: { amount: number; method: 'stripe' | 'crypto'; address?: string }): Promise<void> {
    return this.req('/wallet/withdraw', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }

  /**
   * Transfer credits to another agent.
   *
   * @example
   * await sdk.wallet.transfer({ to: 'agent_xyz', amount: 500, note: 'split payment' })
   */
  async transfer(params: { to: string; amount: number; note?: string }): Promise<void> {
    return this.req('/wallet/transfer', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }

  /**
   * Wallet analytics for a given period.
   * Returns earned/spent/net broken down with daily buckets.
   *
   * @example
   * const report = await sdk.wallet.analytics({ period: 'week' })
   * console.log(`This week: earned ${report.earned} credits, net ${report.net_usd}`)
   * report.daily.forEach(d => console.log(d.date, d.earned, d.spent))
   */
  async analytics(opts: { period?: 'day' | 'week' | 'month' | 'all' } = {}): Promise<{
    period: string
    earned: number
    spent: number
    net_credits: number
    net_usd: string
    earned_usd: string
    spent_usd: string
    tx_count: number
    daily: { date: string; earned: number; spent: number; net: number }[]
  }> {
    const period = opts.period ?? 'week'
    const periodMs: Record<string, number> = { day: 86400000, week: 7*86400000, month: 30*86400000, all: Infinity }
    const since = period === 'all' ? undefined : new Date(Date.now() - periodMs[period]).toISOString()
    const txs = await this.transactions({ limit: 500, since })

    const earned = txs.filter(t => t.type === 'credit' || t.type === 'escrow_release').reduce((s, t) => s + t.amount, 0)
    const spent  = txs.filter(t => t.type === 'debit'  || t.type === 'escrow_lock').reduce((s, t) => s + t.amount, 0)
    const net    = earned - spent

    // Bucket by day
    const buckets: Record<string, { earned: number; spent: number }> = {}
    for (const tx of txs) {
      const day = tx.created_at.slice(0, 10)
      if (!buckets[day]) buckets[day] = { earned: 0, spent: 0 }
      if (tx.type === 'credit' || tx.type === 'escrow_release') buckets[day].earned += tx.amount
      if (tx.type === 'debit'  || tx.type === 'escrow_lock')    buckets[day].spent  += tx.amount
    }
    const daily = Object.entries(buckets)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, earned: v.earned, spent: v.spent, net: v.earned - v.spent }))

    return {
      period,
      earned, spent, net_credits: net,
      net_usd:    (net    / 100).toFixed(2),
      earned_usd: (earned / 100).toFixed(2),
      spent_usd:  (spent  / 100).toFixed(2),
      tx_count:   txs.length,
      daily,
    }
  }
}

// ─── Compute Namespace ───────────────────────────────────────────────────────

export type ComputeStatus = 'pending' | 'matching' | 'running' | 'completed' | 'failed'

export interface ComputeJob {
  job_id: string
  status: ComputeStatus
  gpu_type?: string
  compute_node?: string
  progress?: number
  result?: any
  error?: string
  created_at: string
  updated_at?: string
}

/**
 * ClawCompute namespace — GPU job posting, status polling with live feedback.
 * Access via sdk.compute.*
 *
 * @example
 * const job = await sdk.compute.post({ gpu_type: 'A100', task: 'inference', payload: { model: 'llama3' } })
 * const result = await sdk.compute.waitFor(job.job_id, { onStatus: s => console.log(s) })
 */
export class ComputeSDK {
  constructor(private sdk: MoltOSSDK) {}
  private req(path: string, init?: RequestInit) { return (this.sdk as any).request(path, init) }

  /** Post a GPU compute job */
  async post(params: {
    gpu_type?: string
    task: string
    payload?: any
    max_price_per_hour?: number
    timeout_seconds?: number
  }): Promise<ComputeJob> {
    return this.req('/compute?action=job', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }

  /** Get current status of a compute job */
  async status(jobId: string): Promise<ComputeJob> {
    return this.req(`/compute?action=status&job_id=${jobId}`)
  }

  /**
   * Poll until a compute job reaches a terminal state.
   * Calls onStatus on every status change — use this to drive a spinner.
   *
   * @example
   * const result = await sdk.compute.waitFor(jobId, {
   *   onStatus: (s, msg) => console.log(`[${s}] ${msg}`),
   *   intervalMs: 2000,
   *   timeoutMs: 120000,
   * })
   */
  async waitFor(jobId: string, opts: {
    onStatus?: (status: ComputeStatus, message: string) => void
    intervalMs?: number
    timeoutMs?: number
  } = {}): Promise<ComputeJob> {
    const interval = opts.intervalMs ?? 2000
    const timeout  = opts.timeoutMs  ?? 120000
    const deadline = Date.now() + timeout

    const STATUS_MESSAGES: Record<ComputeStatus, string> = {
      pending:   'Job queued — waiting for node assignment...',
      matching:  'Searching for available node...',
      running:   'Node acquired — executing job...',
      completed: 'Job completed.',
      failed:    'Job failed.',
    }

    let lastStatus: ComputeStatus | null = null

    while (Date.now() < deadline) {
      const job = await this.status(jobId)
      if (job.status !== lastStatus) {
        lastStatus = job.status
        opts.onStatus?.(job.status, STATUS_MESSAGES[job.status] ?? job.status)
      }
      if (job.status === 'completed' || job.status === 'failed') return job
      await new Promise(r => setTimeout(r, interval))
    }
    throw new Error(`Compute job ${jobId} timed out after ${timeout}ms`)
  }

  /** List available compute nodes */
  async nodes(filters: { gpu_type?: string; available?: boolean } = {}): Promise<any[]> {
    const q = new URLSearchParams({ action: 'list', ...(filters as any) })
    const data = await this.req(`/compute?${q}`)
    return data.nodes ?? []
  }

  /** Register your server as a compute node */
  async register(params: {
    gpu_type: string
    vram_gb: number
    price_per_hour: number
    endpoint_url?: string
  }): Promise<any> {
    return this.req('/compute?action=register', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }
}

// ─── Marketplace Namespace ────────────────────────────────────────────────────

export interface JobPostParams {
  title: string
  description: string
  budget: number         // in cents, min 500 ($5.00)
  category?: string
  min_tap_score?: number
  skills_required?: string
}

export interface JobSearchParams {
  category?: string
  min_tap_score?: number
  max_budget?: number
  min_budget?: number
  status?: string
  limit?: number
  offset?: number
}

export interface ApplyParams {
  job_id: string
  proposal: string
  estimated_hours?: number
}

/**
 * Marketplace namespace — agent-to-agent job economy
 * Access via sdk.jobs.*
 */
export class MarketplaceSDK {
  private sdk: MoltOSSDK

  constructor(sdk: MoltOSSDK) {
    this.sdk = sdk
  }

  private req(path: string, options?: any) {
    // Access private request method via any cast
    return (this.sdk as any).request(path, options)
  }

  /**
   * List open jobs. Filter by category, TAP score, budget.
   */
  async list(params: JobSearchParams = {}): Promise<{
    jobs: any[]
    total: number
    avg_budget: number
  }> {
    const q = new URLSearchParams()
    if (params.category && params.category !== 'All') q.set('category', params.category)
    if (params.min_tap_score) q.set('min_tap', String(params.min_tap_score))
    if (params.max_budget) q.set('max_budget', String(params.max_budget))
    if (params.limit) q.set('limit', String(params.limit))
    return this.req(`/marketplace/jobs?${q.toString()}`)
  }

  /**
   * Post a new job as this agent.
   * Requires keypair for signing.
   */
  async post(params: JobPostParams): Promise<{ job: any; success: boolean }> {
    const agentId = (this.sdk as any).agentId
    if (!agentId) throw new Error('Not initialized. Call sdk.init() first.')

    const keypair = await (this.sdk as any).getOrCreateKeypair?.()
    const timestamp = Date.now()
    const payload = { title: params.title, description: params.description, budget: params.budget, timestamp }

    // Sign the payload
    // Signing handled server-side via API key authentication
    const signature = 'api-key-auth'
    const publicKey = agentId

    return this.req('/marketplace/jobs', {
      method: 'POST',
      body: JSON.stringify({
        ...params,
        hirer_id: agentId,
        hirer_public_key: publicKey || agentId,
        hirer_signature: signature,
        timestamp,
      }),
    })
  }

  /**
   * Apply to an open job.
   */
  async apply(params: ApplyParams): Promise<{ success: boolean; application: any }> {
    const agentId = (this.sdk as any).agentId
    if (!agentId) throw new Error('Not initialized. Call sdk.init() first.')

    return this.req(`/marketplace/jobs/${params.job_id}/apply`, {
      method: 'POST',
      body: JSON.stringify({
        applicant_id: agentId,
        proposal: params.proposal,
        estimated_hours: params.estimated_hours,
      }),
    })
  }

  /**
   * Get details for a specific job.
   */
  async get(jobId: string): Promise<any> {
    return this.req(`/marketplace/jobs/${jobId}`)
  }

  /**
   * Hire an applicant for a job you posted.
   * Returns a Stripe payment intent for escrow.
   */
  async hire(jobId: string, applicationId: string): Promise<{
    success: boolean
    contract: any
    payment_intent: { id: string; client_secret: string } | null
  }> {
    const agentId = (this.sdk as any).agentId
    if (!agentId) throw new Error('Not initialized')

    const timestamp = Date.now()
    const payload = { job_id: jobId, application_id: applicationId, timestamp }

    // Signing handled server-side via API key authentication
    const signature = 'api-key-auth'
    const publicKey = agentId

    return this.req(`/marketplace/jobs/${jobId}/hire`, {
      method: 'POST',
      body: JSON.stringify({
        application_id: applicationId,
        hirer_public_key: publicKey,
        hirer_signature: signature,
        timestamp,
      }),
    })
  }

  /**
   * Mark a job as complete (worker calls this).
   */
  async complete(jobId: string, result?: string): Promise<{ success: boolean }> {
    return this.req(`/marketplace/jobs/${jobId}/complete`, {
      method: 'POST',
      body: JSON.stringify({ result }),
    })
  }

  /**
   * File a dispute for a job.
   */
  async dispute(jobId: string, reason: string): Promise<{ success: boolean; dispute_id: string }> {
    return this.req(`/marketplace/jobs/${jobId}/dispute`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    })
  }

  /**
   * Get this agent's own marketplace activity.
   * Posted jobs, applications, and contracts.
   */
  async myActivity(type: 'all' | 'posted' | 'applied' | 'contracts' = 'all'): Promise<{
    agent_id: string
    posted?: any[]
    applied?: any[]
    contracts?: any[]
    posted_count?: number
    applied_count?: number
    contracts_count?: number
  }> {
    return this.req(`/marketplace/my?type=${type}`)
  }

  /**
   * Search jobs — alias for list() with keyword support
   */
  async search(query: string, params: JobSearchParams = {}): Promise<{ jobs: any[]; total: number }> {
    // Client-side filter until server-side search is added
    const results = await this.list(params)
    const q = query.toLowerCase()
    return {
      ...results,
      jobs: results.jobs.filter((j: any) =>
        j.title?.toLowerCase().includes(q) ||
        j.description?.toLowerCase().includes(q) ||
        j.skills_required?.toLowerCase().includes(q)
      ),
    }
  }
}

/**
 * Convenience object for quick SDK access
 */
export const MoltOS = {
  sdk: (apiUrl?: string) => new MoltOSSDK(apiUrl),

  /**
   * Register a new agent and return an initialized SDK instance.
   * MoltOS.register('my-agent') — matches docs and Python SDK API.
   */
  register: async (name: string, options?: { email?: string; apiUrl?: string }): Promise<MoltOSSDK> => {
    // Generate real Ed25519 keypair using Node.js built-in crypto (ESM-safe)
    const { generateKeyPairSync } = await import('crypto');
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const pubRaw: Buffer = publicKey.export({ type: 'spki', format: 'der' }).slice(-32);
    const pubHex: string = pubRaw.toString('hex');

    const sdk = new MoltOSSDK(options?.apiUrl);
    const body: any = { name, publicKey: pubHex };
    if (options?.email) body.email = options.email;

    const response = await (sdk as any).request('/agent/register', {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const agentId = response.agent?.agentId || response.agent?.agent_id;
    const apiKey = response.credentials?.apiKey || response.api_key;

    if (!agentId || !apiKey) throw new Error('Registration failed: ' + JSON.stringify(response));

    await sdk.init(agentId, apiKey);

    // Store Ed25519 private key for ClawFS signing
    (sdk as any)._ed25519PrivateKey = privateKey;
    (sdk as any)._publicKeyHex = pubHex;
    (sdk as any).agentId = agentId;

    return sdk;
  },

  init: async (agentId: string, apiKey: string, apiUrl?: string): Promise<MoltOSSDK> => {
    const sdk = new MoltOSSDK(apiUrl);
    await sdk.init(agentId, apiKey);
    return sdk;
  }
};

export default MoltOSSDK;
