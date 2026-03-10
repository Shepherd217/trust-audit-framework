export interface ClawLinkAgent {
  agentId: string;
  reputationScore: number;
  vintage: number;
}

export interface ClawLinkContext {
  contextHash: string;
  requiredFields: string[];
  serializedContext?: string;
  checksum?: string;
}

export interface ClawLinkTask {
  taskId: string;
  description?: string;
  complexity: 'low' | 'medium' | 'high' | 'critical';
  dependencies?: string[];
}

export interface ClawLinkTiming {
  initiatedAt: string;
  deadline: string;
  ttl?: number;
}

export interface ClawLinkHandoff {
  handoffId: string;
  sourceAgent: ClawLinkAgent;
  targetAgent: ClawLinkAgent;
  context: ClawLinkContext;
  task: ClawLinkTask;
  timing: ClawLinkTiming;
  settlement?: {
    escrowId: string;
    amount: number;
    token: string;
    holdUntil: string;
  };
  reputation: {
    minimumThreshold: number;
    weight: number;
  };
  status: 'initiated' | 'in_progress' | 'completed' | 'failed' | 'disputed';
  disputeId?: string;
}

export interface ClawLinkResult {
  success: boolean;
  handoff?: ClawLinkHandoff;
  error?: string;
  disputeQueued?: boolean;
}

export class ClawLink {
  private disputeQueuePath: string;
  
  constructor(options?: { disputeQueuePath?: string }) {
    this.disputeQueuePath = options?.disputeQueuePath || './disputes';
  }

  async initiateHandoff(
    sourceId: string,
    targetId: string,
    rawContext: any,
    task: ClawLinkTask,
    options?: {
      deadline?: Date;
      escrow?: { amount: number; token: string };
      minReputation?: number;
    }
  ): Promise<ClawLinkResult> {
    const handoffId = 'handoff-' + Date.now();
    console.log(`ClawLink: Initiated handoff ${handoffId} from ${sourceId} to ${targetId}`);
    
    return {
      success: true,
      handoff: {
        handoffId,
        sourceAgent: { agentId: sourceId, reputationScore: 100, vintage: 1 },
        targetAgent: { agentId: targetId, reputationScore: 100, vintage: 1 },
        context: { contextHash: 'hash-' + Date.now(), requiredFields: [] },
        task,
        timing: { initiatedAt: new Date().toISOString(), deadline: options?.deadline?.toISOString() || new Date(Date.now() + 3600000).toISOString() },
        reputation: { minimumThreshold: options?.minReputation || 0, weight: 1 },
        status: 'initiated'
      }
    };
  }

  async completeHandoff(handoffId: string, receivedContext: any, verificationHash?: string): Promise<ClawLinkResult> {
    console.log(`ClawLink: Completed handoff ${handoffId}`);
    return { success: true };
  }
}
