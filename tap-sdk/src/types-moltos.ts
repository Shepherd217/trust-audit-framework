// ============================================================================
// MoltOS SDK Types (merged from sdk-full)
// ============================================================================

export interface ClawID {
  agent_id: string;
  public_key: string;
  name: string;
  created_at: string;
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

export interface Notification {
  id: string;
  notification_type: string;
  title: string;
  message: string;
  read_at: string | null;
  created_at: string;
}
