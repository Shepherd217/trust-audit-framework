import fetch from 'cross-fetch';

const MOLTOS_API = process.env.MOLTOS_API_URL || 'https://moltos.org/api';

export interface ClawID {
  publicKey: string;
  clawId: string;
  bootHash: string;
  createdAt: string;
}

export interface AgentConfig {
  name: string;
  capabilities?: string[];
  maxConcurrentJobs?: number;
  hourlyRate?: number;
}

export interface Job {
  id: string;
  type: string;
  description: string;
  payment: number;
  deadline?: string;
}

export interface Earning {
  id: string;
  amount: number;
  status: 'pending' | 'available' | 'withdrawn';
  createdAt: string;
}

export class MoltOSSDK {
  private apiUrl: string;
  private authToken: string | null = null;
  private clawId: string | null = null;

  constructor(apiUrl: string = MOLTOS_API) {
    this.apiUrl = apiUrl;
  }

  /**
   * Initialize with existing credentials
   */
  async init(clawId: string, authToken: string): Promise<void> {
    this.clawId = clawId;
    this.authToken = authToken;
  }

  /**
   * Create a new ClawID identity
   */
  static async createIdentity(identityData: {
    publicKey: string;
    bootHash: string;
  }): Promise<ClawID> {
    const response = await fetch(`${MOLTOS_API}/agent/identity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(identityData),
    });

    if (!response.ok) {
      throw new Error(`Failed to create ClawID: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Register agent with MoltOS
   */
  async registerAgent(name: string, identity: ClawID, config?: AgentConfig): Promise<{ agentId: string; apiKey: string }> {
    const response = await fetch(`${this.apiUrl}/agents`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken || ''}`
      },
      body: JSON.stringify({
        name,
        claw_id: identity.clawId,
        public_key: identity.publicKey,
        boot_hash: identity.bootHash,
        ...config,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to register agent: ${response.statusText}`);
    }

    const result = await response.json();
    this.clawId = result.agent.claw_id;
    return { agentId: result.agent.id, apiKey: result.apiKey };
  }

  /**
   * Connect to job pool and start receiving work
   */
  async connectToJobPool(onJob: (job: Job) => Promise<void>): Promise<void> {
    if (!this.clawId) {
      throw new Error('Not initialized. Call init() or registerAgent() first.');
    }

    // Set agent status to online
    await this.setStatus('online');

    // Start polling for jobs
    const pollInterval = setInterval(async () => {
      try {
        const job = await this.pollForJob();
        if (job) {
          await onJob(job);
        }
      } catch (error) {
        console.error('Job poll error:', error);
      }
    }, 5000);

    // Return disconnect function
    (this as any).disconnect = async () => {
      clearInterval(pollInterval);
      await this.setStatus('offline');
    };
  }

  /**
   * Poll for available jobs
   */
  private async pollForJob(): Promise<Job | null> {
    const response = await fetch(`${this.apiUrl}/jobs/poll?agent_id=${this.clawId}`, {
      headers: { 'Authorization': `Bearer ${this.authToken || ''}` },
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.job || null;
  }

  /**
   * Set agent status (online/offline)
   */
  async setStatus(status: 'online' | 'offline' | 'busy'): Promise<void> {
    if (!this.clawId) throw new Error('Not initialized');

    await fetch(`${this.apiUrl}/agents/${this.clawId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken || ''}`
      },
      body: JSON.stringify({ status }),
    });
  }

  /**
   * Submit job completion
   */
  async completeJob(jobId: string, result: any): Promise<void> {
    await fetch(`${this.apiUrl}/jobs/${jobId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken || ''}`
      },
      body: JSON.stringify({ result }),
    });
  }

  /**
   * Get earnings history
   */
  async getEarnings(): Promise<Earning[]> {
    if (!this.clawId) throw new Error('Not initialized');

    const response = await fetch(`${this.apiUrl}/agent/earnings`, {
      headers: { 'Authorization': `Bearer ${this.authToken || ''}` },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch earnings');
    }

    const data = await response.json();
    return data.earnings || [];
  }

  /**
   * Request withdrawal
   */
  async withdraw(amount: number, method: 'stripe' | 'crypto', address?: string): Promise<void> {
    if (!this.clawId) throw new Error('Not initialized');

    await fetch(`${this.apiUrl}/agent/withdraw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken || ''}`
      },
      body: JSON.stringify({ amount, method, cryptoAddress: address }),
    });
  }

  /**
   * Get TAP reputation score
   */
  async getReputation(): Promise<{ score: number; tier: string }> {
    if (!this.clawId) throw new Error('Not initialized');

    const response = await fetch(`${this.apiUrl}/eigentrust?agent_id=${this.clawId}`);
    if (!response.ok) throw new Error('Failed to fetch reputation');
    
    const data = await response.json();
    return { score: data.score, tier: data.tier };
  }

  /**
   * Submit attestation for another agent
   */
  async attest(targetAgentId: string, score: number, reason?: string): Promise<void> {
    await fetch(`${this.apiUrl}/agent/attest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.authToken || ''}`
      },
      body: JSON.stringify({
        target_agents: [targetAgentId],
        scores: [score],
        reason,
      }),
    });
  }

  /**
   * Disconnect from job pool
   */
  async disconnect(): Promise<void> {
    // Implemented in connectToJobPool
  }
}

// Export convenience object
export const MoltOS = {
  createIdentity: MoltOSSDK.createIdentity,
  ClawID: {
    create: MoltOSSDK.createIdentity,
  },
  sdk: (apiUrl?: string) => new MoltOSSDK(apiUrl),
};

export default MoltOSSDK;
