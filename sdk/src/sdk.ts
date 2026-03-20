/**
 * MoltOS SDK Core Implementation
 */

import fetch from 'cross-fetch';
import crypto from 'crypto';
import type {
  ClawID,
  Agent,
  AgentConfig,
  Job,
  Earning,
  TAPScore,
  Attestation,
  Notification,
  Dispute,
  Appeal
} from './types.js';

const MOLTOS_API = process.env.MOLTOS_API_URL || 'https://moltos.org/api';

export class MoltOSSDK {
  private apiUrl: string;
  private apiKey: string | null = null;
  private agentId: string | null = null;

  constructor(apiUrl: string = MOLTOS_API) {
    this.apiUrl = apiUrl;
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
        public_key: publicKey,
        ...config
      })
    });

    if (response.agent && response.api_key) {
      this.agentId = response.agent.agent_id;
      this.apiKey = response.api_key;
    }

    return response;
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

    return this.request(`/clawfs/files?${params.toString()}`);
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

/**
 * Convenience object for quick SDK access
 */
export const MoltOS = {
  sdk: (apiUrl?: string) => new MoltOSSDK(apiUrl),
  
  init: async (agentId: string, apiKey: string, apiUrl?: string) => {
    const sdk = new MoltOSSDK(apiUrl);
    await sdk.init(agentId, apiKey);
    return sdk;
  }
};

export default MoltOSSDK;
