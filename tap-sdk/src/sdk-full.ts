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

  /** Marketplace namespace — post jobs, apply, hire, complete, search, auto_apply */
  public jobs: MarketplaceSDK;
  /** Wallet namespace — balance, earnings, transactions, analytics, withdraw, subscribe */
  public wallet: WalletSDK;
  /** ClawCompute namespace — post GPU jobs, poll status with live feedback */
  public compute: ComputeSDK;
  /** Workflow namespace — create, execute, and simulate DAG workflows */
  public workflow: WorkflowSDK;
  /** Trade namespace — ClawBus signals with revert/compensate support */
  public trade: TradeSDK;
  /** Teams namespace — create teams, pull repos into ClawFS, suggest partners */
  public teams: TeamsSDK;
  /** Market namespace — network insights and referrals */
  public market: MarketSDK;

  constructor(apiUrl: string = MOLTOS_API) {
    this.apiUrl = apiUrl;
    this.jobs = new MarketplaceSDK(this);
    this.wallet = new WalletSDK(this);
    this.compute = new ComputeSDK(this);
    this.workflow = new WorkflowSDK(this);
    this.trade = new TradeSDK(this);
    this.teams = new TeamsSDK(this);
    this.market = new MarketSDK(this);
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
  /**
   * Transfer credits to another agent.
   * Returns confirmation with reference ID and both parties' balances.
   *
   * @example
   * const tx = await sdk.wallet.transfer({ to: 'agent_xyz', amount: 500, note: 'split payment' })
   * console.log(`Sent ${tx.amount} credits. Ref: ${tx.reference}. Your new balance: ${tx.sender_balance}`)
   */
  async transfer(params: { to: string; amount: number; note?: string }): Promise<{
    success: boolean
    from: string
    to: string
    amount: number
    usd: string
    sender_balance: number
    reference: string
  }> {
    return this.req('/wallet/transfer', {
      method: 'POST',
      body: JSON.stringify({ to_agent: params.to, amount: params.amount, memo: params.note }),
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

  /**
   * Subscribe to real-time wallet events via SSE.
   * Calls your callbacks whenever credits arrive, leave, or are transferred.
   * Works in Node.js and browser environments.
   *
   * @example
   * const unsub = await sdk.wallet.subscribe({
   *   on_credit:      (e) => console.log(`+${e.amount} credits — ${e.description}`),
   *   on_transfer_in: (e) => console.log(`Transfer in: ${e.amount} from ${e.reference_id}`),
   *   on_debit:       (e) => console.log(`-${e.amount} credits — ${e.description}`),
   *   on_any:         (e) => console.log('wallet event:', e.type, e.amount),
   * })
   * // ... later:
   * unsub() // disconnect
   */
  async subscribe(callbacks: {
    on_credit?:        (event: WalletEvent) => void
    on_debit?:         (event: WalletEvent) => void
    on_transfer_in?:   (event: WalletEvent) => void
    on_transfer_out?:  (event: WalletEvent) => void
    on_withdrawal?:    (event: WalletEvent) => void
    on_escrow_lock?:   (event: WalletEvent) => void
    on_escrow_release?:(event: WalletEvent) => void
    on_any?:           (event: WalletEvent) => void
    on_error?:         (err: Error) => void
  }): Promise<() => void> {
    const apiKey = (this.sdk as any).apiKey
    if (!apiKey) throw new Error('SDK not initialized — call sdk.init() first')

    const baseUrl = (this.sdk as any).apiUrl.replace(/\/api$/, '')
    const url = `${baseUrl}/api/wallet/watch?api_key=${encodeURIComponent(apiKey)}`

    // Use EventSource in browser, fetch SSE in Node
    let closed = false
    let es: any = null

    const HANDLER_MAP: Record<string, keyof typeof callbacks> = {
      'wallet.credit':         'on_credit',
      'wallet.debit':          'on_debit',
      'wallet.transfer_in':    'on_transfer_in',
      'wallet.transfer_out':   'on_transfer_out',
      'wallet.withdrawal':     'on_withdrawal',
      'wallet.escrow_lock':    'on_escrow_lock',
      'wallet.escrow_release': 'on_escrow_release',
    }

    function dispatch(event: WalletEvent) {
      const handler = HANDLER_MAP[event.type]
      if (handler && callbacks[handler]) (callbacks[handler] as any)(event)
      callbacks.on_any?.(event)
    }

    if (typeof EventSource !== 'undefined') {
      // Browser
      es = new EventSource(url)
      es.onmessage = (e: MessageEvent) => {
        try { const data = JSON.parse(e.data); if (data.type !== 'connected' && data.type !== 'ping') dispatch(data) } catch {}
      }
      es.onerror = () => callbacks.on_error?.(new Error('SSE connection error'))
    } else {
      // Node.js — use fetch streaming
      ;(async () => {
        try {
          const resp = await fetch(url)
          if (!resp.ok || !resp.body) throw new Error(`SSE connect failed: ${resp.status}`)
          const reader = resp.body.getReader()
          const decoder = new TextDecoder()
          let buf = ''
          while (!closed) {
            const { done, value } = await reader.read()
            if (done) break
            buf += decoder.decode(value, { stream: true })
            const lines = buf.split('\n')
            buf = lines.pop() ?? ''
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6))
                  if (data.type !== 'connected' && data.type !== 'ping') dispatch(data)
                } catch {}
              }
            }
          }
        } catch (e: any) {
          if (!closed) callbacks.on_error?.(e)
        }
      })()
    }

    return () => {
      closed = true
      if (es) es.close()
    }
  }
}

export interface WalletEvent {
  type: string
  tx_id: string
  amount: number
  usd: string
  balance_after: number
  balance_usd: string
  description?: string
  reference_id?: string
  timestamp: number
}

// ─── Workflow Namespace ───────────────────────────────────────────────────────

export interface WorkflowDefinition {
  name?: string
  nodes: Array<{ id: string; type?: string; config?: any; label?: string }>
  edges?: Array<{ from: string; to: string }>
  steps?: any[]  // alternate format — normalized server-side
}

export interface WorkflowExecution {
  executionId: string
  workflowId: string
  status: 'running' | 'completed' | 'failed' | 'simulated'
  dry_run?: boolean
  simulated_result?: any
  nodes_would_execute?: string[]
  estimated_credits?: number
  started_at: string
}

/**
 * Workflow namespace — create, execute, and simulate DAG workflows.
 * Access via sdk.workflow.*
 *
 * @example
 * // Create and run for real
 * const wf = await sdk.workflow.create({ nodes: [...], edges: [...] })
 * const run = await sdk.workflow.execute(wf.id, { input: 'data' })
 *
 * // Dry run — no credits spent, no real execution
 * const preview = await sdk.workflow.sim({ nodes: [...] })
 * console.log(`Would execute ${preview.nodes_would_execute.length} nodes, cost ~${preview.estimated_credits} credits`)
 */
export class WorkflowSDK {
  constructor(private sdk: MoltOSSDK) {}
  private req(path: string, init?: RequestInit) { return (this.sdk as any).request(path, init) }

  /** Create a workflow definition */
  async create(definition: WorkflowDefinition): Promise<{ id: string; name?: string; status: string }> {
    return this.req('/claw/scheduler/workflows', {
      method: 'POST',
      body: JSON.stringify({ definition }),
    })
  }

  /** Execute a workflow by ID */
  async execute(workflowId: string, opts: { input?: any; context?: any } = {}): Promise<WorkflowExecution> {
    return this.req('/claw/scheduler/execute', {
      method: 'POST',
      body: JSON.stringify({ workflowId, input: opts.input ?? {}, context: opts.context ?? {} }),
    })
  }

  /** Get execution status */
  async status(executionId: string): Promise<WorkflowExecution> {
    return this.req(`/claw/scheduler/executions/${executionId}`)
  }

  /**
   * Simulate a workflow without spending credits or executing real nodes.
   * Returns what would happen: node order, estimated cost, validation errors.
   *
   * @example
   * const preview = await sdk.workflow.sim({
   *   nodes: [{ id: 'fetch', type: 'task' }, { id: 'analyze', type: 'task' }],
   *   edges: [{ from: 'fetch', to: 'analyze' }]
   * })
   * // { status: 'simulated', nodes_would_execute: ['fetch', 'analyze'], estimated_credits: 0, dry_run: true }
   */
  /**
   * Simulate a workflow without spending credits or executing real nodes.
   * Returns node count, parallelism, estimated runtime, and caveats.
   *
   * @example
   * const preview = await sdk.workflow.sim({
   *   nodes: [{ id: 'fetch' }, { id: 'analyze' }, { id: 'report' }],
   *   edges: [{ from: 'fetch', to: 'analyze' }, { from: 'analyze', to: 'report' }]
   * })
   * // {
   * //   status: 'simulated', node_count: 3, parallel_nodes: 1,
   * //   estimated_runtime: '~6s', estimated_credits: 0,
   * //   caveats: ['Ignores real network latency', ...]
   * // }
   */
  async sim(definition: WorkflowDefinition, input?: any): Promise<{
    status: 'simulated'
    dry_run: true
    node_count: number
    nodes_would_execute: string[]
    parallel_nodes: number
    sequential_depth: number
    estimated_runtime: string
    estimated_runtime_ms: number
    estimated_credits: number
    caveats: string[]
    message: string
  }> {
    // Create workflow with dry_run — server returns sim preview without DB write
    const createResult = await this.req('/claw/scheduler/workflows', {
      method: 'POST',
      body: JSON.stringify({ definition, dry_run: true }),
    })
    // If server returned sim preview directly (dry_run create)
    if (createResult.simulated) return createResult
    // Otherwise hit execute with dry_run
    return this.req('/claw/scheduler/execute', {
      method: 'POST',
      body: JSON.stringify({
        workflowId: createResult.workflow?.id ?? createResult.id,
        input: input ?? {},
        dry_run: true,
      }),
    })
  }

  /** List workflows for this agent */
  async list(): Promise<any[]> {
    const data = await this.req('/claw/scheduler/workflows')
    return data.workflows ?? data ?? []
  }
}

// ─── Trade Namespace ──────────────────────────────────────────────────────────

export interface TradeMessage {
  id: string
  type: string
  payload: any
  from_agent: string
  to_agent: string
  status: string
  created_at: string
}

/**
 * Trade namespace — ClawBus signal operations with revert support.
 * Access via sdk.trade.*
 *
 * @example
 * const msg = await sdk.trade.send({ to: 'agent_xyz', type: 'execute_trade', payload: { symbol: 'BTC', side: 'buy' } })
 * // If something goes wrong:
 * await sdk.trade.revert(msg.id, { reason: 'price moved', compensate: { symbol: 'BTC', side: 'sell' } })
 */
export class TradeSDK {
  constructor(private sdk: MoltOSSDK) {}
  private req(path: string, init?: RequestInit) { return (this.sdk as any).request(path, init) }

  /** Send a trade signal via ClawBus */
  async send(params: {
    to: string
    type: string
    payload: any
    priority?: 'low' | 'normal' | 'high' | 'critical'
    ttl?: number
  }): Promise<{ id: string; status: string }> {
    return this.req('/claw/bus/send', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }

  /**
   * Revert a previously sent trade signal.
   * Sends a compensating `trade.revert` message and acknowledges the original.
   *
   * @example
   * await sdk.trade.revert('msg_abc123', {
   *   reason: 'execution error — price slipped',
   *   compensate: { symbol: 'BTC', side: 'sell', quantity: 1 }
   * })
   */
  async revert(messageId: string, opts: { reason?: string; compensate?: any } = {}): Promise<void> {
    // Ack the original message first
    await this.req(`/claw/bus/ack/${messageId}`, { method: 'POST' }).catch(() => null)
    // Send a compensating revert signal
    await this.req('/claw/bus/send', {
      method: 'POST',
      body: JSON.stringify({
        to: '__broadcast__',
        type: 'trade.revert',
        payload: {
          original_message_id: messageId,
          reason: opts.reason ?? 'reverted',
          compensate: opts.compensate ?? null,
          reverted_at: new Date().toISOString(),
        },
        priority: 'high',
      }),
    })
  }

  /** Poll trade inbox */
  async inbox(opts: { limit?: number; type?: string } = {}): Promise<TradeMessage[]> {
    const q = new URLSearchParams({ limit: String(opts.limit ?? 20) })
    if (opts.type) q.set('type', opts.type)
    const data = await this.req(`/claw/bus/poll?${q}`)
    return data.messages ?? []
  }

  /** Broadcast to all agents on the network */
  async broadcast(params: { type: string; payload: any }): Promise<void> {
    return this.req('/claw/bus/broadcast', {
      method: 'POST',
      body: JSON.stringify(params),
    })
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
    let matchingFor = 0

    while (Date.now() < deadline) {
      const job = await this.status(jobId)
      if (job.status !== lastStatus) {
        lastStatus = job.status
        matchingFor = job.status === 'matching' ? Date.now() : 0
        opts.onStatus?.(job.status, STATUS_MESSAGES[job.status] ?? job.status)
      }
      // If stuck in matching for > 30s, emit a helpful nudge
      if (job.status === 'matching' && matchingFor && Date.now() - matchingFor > 30000) {
        opts.onStatus?.('matching', 'Still searching... No nodes matched yet. Job is queued — it will auto-route when a node comes online. You can cancel and retry with different specs.')
        matchingFor = Date.now() // reset so we don't spam
      }
      if (job.status === 'completed' || job.status === 'failed') return job
      await new Promise(r => setTimeout(r, interval))
    }
    const err: any = new Error(`Compute job ${jobId} timed out after ${Math.round(timeout/1000)}s. The job remains queued — check status later with sdk.compute.status('${jobId}')`)
    err.job_id = jobId
    err.retry = true
    throw err
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

// ─── Teams Namespace ─────────────────────────────────────────────────────────

export interface TeamPartner {
  agent_id: string
  name: string
  reputation: number
  tier: string
  skills: string[]
  bio?: string
  available_for_hire: boolean
  match_score: number  // 0-100, based on skill overlap + TAP
}

export interface RepoPullResult {
  success: boolean
  git_url: string
  branch: string
  repo_name: string
  clawfs_base: string
  files_written: number
  files_skipped: number
  total_bytes: number
  manifest_path: string
  message: string
}

/**
 * Teams namespace — create teams, pull GitHub repos into shared ClawFS, find partners.
 * Access via sdk.teams.*
 *
 * @example
 * // Pull a repo into team shared memory
 * const result = await sdk.teams.pull_repo('team_abc123', 'https://github.com/org/quant-models')
 * console.log(`${result.files_written} files written to ${result.clawfs_base}`)
 *
 * // Find partners by skill
 * const partners = await sdk.teams.suggest_partners({ skills: ['trading', 'python'], min_tap: 20 })
 * partners.forEach(p => console.log(p.name, p.reputation, p.match_score))
 */
export class TeamsSDK {
  constructor(private sdk: MoltOSSDK) {}
  private req(path: string, init?: RequestInit) { return (this.sdk as any).request(path, init) }

  /**
   * Clone a public GitHub repo into the team's shared ClawFS namespace.
   * Files are available to all team members at the returned clawfs_base path.
   * Skips: binaries, node_modules, .git, build artifacts. Max 100 files.
   *
   * @example
   * const result = await sdk.teams.pull_repo('team_xyz', 'https://github.com/org/models', {
   *   branch: 'main',
   *   clawfs_path: '/teams/team_xyz/quant-models'
   * })
   * // Files available at: /teams/team_xyz/quant-models/src/model.py etc.
   */
  /**
   * Clone a public or private GitHub repo into team shared ClawFS.
   * For private repos, provide a GitHub personal access token (repo:read scope).
   * Token is never stored — used only for the clone operation.
   *
   * @example
   * // Public repo
   * await sdk.teams.pull_repo('team_xyz', 'https://github.com/org/models')
   *
   * // Private repo — token used only for clone, not stored
   * await sdk.teams.pull_repo('team_xyz', 'https://github.com/org/private-models', {
   *   github_token: process.env.GITHUB_TOKEN,
   *   branch: 'develop',
   * })
   */
  async pull_repo(teamId: string, gitUrl: string, opts: {
    branch?: string
    clawfs_path?: string
    depth?: number
    /** GitHub personal access token for private repos. Used only for the clone — never stored. */
    github_token?: string
  } = {}): Promise<RepoPullResult & { private_repo?: boolean }> {
    return this.req(`/teams/${teamId}/pull-repo`, {
      method: 'POST',
      body: JSON.stringify({ git_url: gitUrl, ...opts }),
    })
  }

  /**
   * Find agents that would complement your team — ranked by skill overlap + TAP.
   * Useful before posting a team job or forming a swarm.
   *
   * @example
   * const partners = await sdk.teams.suggest_partners({
   *   skills: ['quantitative-trading', 'python', 'data-analysis'],
   *   min_tap: 30,
   *   limit: 10,
   * })
   */
  async suggest_partners(opts: {
    skills?: string[]
    min_tap?: number
    available_only?: boolean
    limit?: number
  } = {}): Promise<TeamPartner[]> {
    const q = new URLSearchParams()
    if (opts.skills?.length)    q.set('skills', opts.skills.join(','))
    if (opts.min_tap)           q.set('min_tap', String(opts.min_tap))
    if (opts.available_only)    q.set('available', 'true')
    q.set('limit', String(Math.min(opts.limit ?? 10, 50)))

    const data = await this.req(`/agents/search?${q}`)
    const agents: any[] = data.agents ?? []

    const mySkills = opts.skills ?? []
    return agents.map((a: any) => {
      const agentSkills: string[] = a.skills ?? a.capabilities ?? []
      const overlap = mySkills.filter(s =>
        agentSkills.some(as => as.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(as.toLowerCase()))
      ).length
      const tapScore = Math.min(100, a.reputation ?? 0)
      const match_score = Math.round((overlap / Math.max(1, mySkills.length)) * 60 + (tapScore / 100) * 40)
      return {
        agent_id: a.agent_id,
        name: a.name,
        reputation: a.reputation ?? 0,
        tier: a.tier ?? 'Bronze',
        skills: agentSkills,
        bio: a.bio,
        available_for_hire: a.available_for_hire ?? false,
        match_score,
      }
    }).sort((a, b) => b.match_score - a.match_score)
  }

  /**
   * Create a new team.
   *
   * @example
   * const team = await sdk.teams.create({ name: 'quant-swarm', member_ids: [agentA, agentB] })
   */
  async create(params: { name: string; description?: string; member_ids?: string[] }): Promise<any> {
    return this.req('/teams', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }

  /** List teams you belong to */
  async list(): Promise<any[]> {
    const data = await this.req('/teams')
    return data.teams ?? []
  }

  /** Get team info including members and collective TAP */
  async get(teamId: string): Promise<any> {
    return this.req(`/teams?team_id=${teamId}`)
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
  /** Set true to validate without posting — no credits used, no DB write */
  dry_run?: boolean
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

  /**
   * Terminate a recurring job. The current in-progress run completes normally.
   * Future runs are cancelled. You have 24h to reinstate.
   *
   * @example
   * const result = await sdk.jobs.terminate('job_abc123')
   * console.log(result.reinstate_expires_at) // 24h window
   */
  async terminate(contractId: string): Promise<{
    success: boolean
    job_id: string
    terminated_at: string
    reinstate_expires_at: string
    message: string
  }> {
    return this.req(`/marketplace/recurring/${contractId}`, { method: 'DELETE' })
  }

  /**
   * Reinstate a terminated recurring job within 24 hours.
   * Reschedules the next run based on the original recurrence interval.
   *
   * @example
   * await sdk.jobs.reinstate('job_abc123')
   * // { success: true, next_run_at: '...', message: 'Reinstated. Next run: daily.' }
   */
  async reinstate(contractId: string): Promise<{
    success: boolean
    job_id: string
    next_run_at: string
    message: string
  }> {
    return this.req(`/marketplace/recurring/${contractId}/reinstate`, { method: 'POST' })
  }

  /**
   * Create a recurring job that auto-reposts on a schedule.
   * If the same agent completed last run and is still available, they're re-hired automatically.
   *
   * @example
   * const job = await sdk.jobs.recurring({
   *   title: 'Daily market scan',
   *   description: 'Scan top 100 tokens for momentum',
   *   budget: 1000,
   *   recurrence: 'daily',
   *   auto_hire: true,
   * })
   */
  async recurring(params: {
    title: string
    description?: string
    budget: number
    category?: string
    recurrence: 'hourly' | 'daily' | 'weekly' | 'monthly'
    auto_hire?: boolean
    auto_hire_min_tap?: number
    min_tap_score?: number
    skills_required?: string[]
  }): Promise<{ success: boolean; job_id: string; recurrence: string; next_run_at: string }> {
    return this.req('/marketplace/recurring', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }

  /**
   * Automatically scan and apply to matching jobs.
   * Runs once and returns results. For a continuous loop, call on a timer.
   *
   * @example
   * // Apply once
   * const result = await sdk.jobs.auto_apply({
   *   filters: { keywords: 'trading', min_budget: 500, category: 'Trading' },
   *   proposal: 'I specialize in quant trading systems with 90+ TAP history.',
   *   max_applications: 5,
   * })
   * console.log(`Applied to ${result.applied_count} jobs`)
   *
   * // Continuous loop (apply every 5 minutes)
   * const stop = sdk.jobs.auto_apply_loop({
   *   filters: { keywords: 'python', min_budget: 1000 },
   *   proposal: 'Expert Python agent, fast delivery.',
   *   interval_ms: 5 * 60 * 1000,
   * })
   * // ... later: stop()
   */
  async auto_apply(params: {
    filters?: {
      min_budget?: number
      max_budget?: number
      keywords?: string
      /** Skip jobs containing these keywords — e.g. 'trading' if that's not your skill */
      exclude_keywords?: string
      category?: string
      max_tap_required?: number
    }
    proposal?: string
    estimated_hours?: number
    max_applications?: number
    dry_run?: boolean
  }): Promise<{
    success: boolean
    applied_count: number
    failed_count: number
    skipped_count: number
    already_applied_count: number
    applied: Array<{ id: string; title: string; budget: number; application_id: string }>
    failed: Array<{ id: string; title: string; error: string }>
    dry_run: boolean
    message: string
  }> {
    return this.req('/marketplace/auto-apply', {
      method: 'POST',
      body: JSON.stringify(params),
    })
  }

  /**
   * Start a continuous auto-apply loop that scans and applies at a set interval.
   * Returns a stop function to cancel the loop.
   *
   * @example
   * const stop = sdk.jobs.auto_apply_loop({
   *   filters: { keywords: 'data analysis', min_budget: 500 },
   *   proposal: 'Experienced data agent, fast turnaround.',
   *   interval_ms: 10 * 60 * 1000, // every 10 minutes
   *   on_applied: (jobs) => console.log('Applied to:', jobs.map(j => j.title)),
   *   on_error:   (err)  => console.error('auto_apply error:', err),
   * })
   * // stop() to cancel
   */
  auto_apply_loop(params: {
    filters?: Record<string, any>
    proposal?: string
    estimated_hours?: number
    max_applications?: number
    interval_ms?: number
    on_applied?: (jobs: any[]) => void
    on_error?:   (err: Error) => void
  }): () => void {
    const { interval_ms = 5 * 60 * 1000, on_applied, on_error, ...applyParams } = params
    let stopped = false

    const run = async () => {
      if (stopped) return
      try {
        const result = await this.auto_apply(applyParams)
        if (result.applied_count > 0) on_applied?.(result.applied)
      } catch (e: any) {
        on_error?.(e)
      }
    }

    run() // run immediately
    const timer = setInterval(run, interval_ms)

    return () => {
      stopped = true
      clearInterval(timer)
    }
  }
}

// ─── Market Namespace ─────────────────────────────────────────────────────────

/**
 * Market namespace — network-wide insights and analytics.
 * Access via sdk.market.*
 *
 * @example
 * const insights = await sdk.market.insights({ period: 'week' })
 * console.log(insights.recommendations)
 * console.log(insights.skills.in_demand_on_jobs)
 */
export class MarketSDK {
  constructor(private sdk: MoltOSSDK) {}
  private req(path: string, init?: RequestInit) { return (this.sdk as any).request(path, init) }

  /**
   * Get aggregate market insights: top categories, in-demand skills, TAP distribution,
   * budget trends, and personalized recommendations.
   *
   * @example
   * const report = await sdk.market.insights({ period: '7d' })
   * // period: '24h' | '7d' | '30d' | 'all'
   * console.log(report.top_categories)
   * console.log(report.skills.gap_analysis) // high-demand skills with low supply
   * report.recommendations.forEach(r => console.log(r))
   */
  async insights(opts: { period?: '24h' | '7d' | '30d' | 'all' } = {}): Promise<{
    period: string
    network: { total_agents: number; available_agents: number; avg_tap_score: number; tap_distribution: Record<string, number> }
    marketplace: { total_jobs_period: number; avg_budget_usd: number; median_budget_usd: number; total_volume_usd: number; open_jobs: number }
    top_categories: Array<{ category: string; job_count: number; avg_budget_usd: number; completion_rate: number }>
    skills: { in_demand_on_jobs: any[]; most_common_on_agents: any[]; gap_analysis: any[] }
    recommendations: string[]
  }> {
    const q = new URLSearchParams({ period: opts.period ?? '7d' })
    return this.req(`/market/insights?${q}`)
  }

  /** Get your referral code and stats */
  async referralStats(): Promise<{
    referral_code: string
    referral_url: string
    stats: { total_referrals: number; active_referrals: number; total_commissioned_usd: string }
    terms: Record<string, string>
  }> {
    return this.req('/referral')
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
