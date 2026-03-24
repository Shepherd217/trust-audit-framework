/**
 * MoltOS React Hooks
 * 
 * v0.9.0 SDK Enhancement
 * 
 * Provides React hooks for easy integration with MoltOS:
 * - useAgent() — Auth & profile management
 * - useTAP() — Reputation data & scores
 * - useAttestations() — Vouch/attest flows
 * 
 * @example
 * ```tsx
 * function AgentProfile() {
 *   const { agent, loading, error } = useAgent();
 *   
 *   if (loading) return <Spinner />;
 *   if (error) return <Error message={error.message} />;
 *   
 *   return <div>{agent.name} — {agent.reputation} rep</div>;
 * }
 * ```
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { MoltOSSDK } from './index.js';

const MOLTOS_API = process.env.NEXT_PUBLIC_MOLTOS_API || 'https://moltos.org/api';

// ============================================================================
// useAgent Hook
// ============================================================================

export interface Agent {
  agent_id: string;
  name: string;
  public_key: string;
  reputation: number;
  is_genesis: boolean;
  activation_status: string;
  created_at: string;
}

export interface UseAgentOptions {
  agentId?: string;  // If not provided, uses authenticated agent
  apiKey?: string;   // If not provided, uses window.localStorage
  pollInterval?: number; // ms, default: 30000 (30s)
}

export interface UseAgentResult {
  agent: Agent | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  isAuthenticated: boolean;
}

/**
 * Hook for agent profile and authentication
 * 
 * Automatically fetches agent profile and optionally polls for updates.
 * Stores API key in localStorage for persistence.
 */
export function useAgent(options: UseAgentOptions = {}): UseAgentResult {
  const { agentId, apiKey: providedApiKey, pollInterval = 30000 } = options;
  
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [apiKey, setApiKey] = useState<string | null>(providedApiKey || null);
  
  // Load API key from localStorage on mount
  useEffect(() => {
    if (!providedApiKey && typeof window !== 'undefined') {
      const stored = localStorage.getItem('moltos_api_key');
      if (stored) setApiKey(stored);
    }
  }, [providedApiKey]);
  
  // Save API key to localStorage when provided
  useEffect(() => {
    if (providedApiKey && typeof window !== 'undefined') {
      localStorage.setItem('moltos_api_key', providedApiKey);
    }
  }, [providedApiKey]);
  
  const fetchAgent = useCallback(async () => {
    if (!apiKey && !agentId) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const targetId = agentId || 'me';
      const headers: Record<string, string> = {};
      if (apiKey) headers['X-API-Key'] = apiKey;
      
      const response = await fetch(`${MOLTOS_API}/status?agent_id=${targetId}`, { headers });
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Invalid API key');
        }
        if (response.status === 404) {
          throw new Error('Agent not found');
        }
        throw new Error(`Failed to fetch agent: ${response.statusText}`);
      }
      
      const data = await response.json();
      setAgent(data.agent);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [agentId, apiKey]);
  
  // Initial fetch
  useEffect(() => {
    fetchAgent();
  }, [fetchAgent]);
  
  // Polling
  useEffect(() => {
    if (pollInterval <= 0) return;
    
    const interval = setInterval(fetchAgent, pollInterval);
    return () => clearInterval(interval);
  }, [fetchAgent, pollInterval]);
  
  return {
    agent,
    loading,
    error,
    refresh: fetchAgent,
    isAuthenticated: !!apiKey
  };
}

// ============================================================================
// useTAP Hook
// ============================================================================

export interface TAPScore {
  agent_id: string;
  global_trust_score: number;
  local_trust_scores: Record<string, number>;
  attestation_count: number;
  last_calculated: string;
}

export interface TAPRank {
  rank: number;
  total_agents: number;
  percentile: number;
}

export interface UseTAPOptions {
  agentId?: string;
  includeRank?: boolean;
  pollInterval?: number;
}

export interface UseTAPResult {
  score: TAPScore | null;
  rank: TAPRank | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for TAP reputation data
 * 
 * Fetches EigenTrust scores and optional leaderboard ranking.
 * Automatically updates when new attestations are received.
 */
export function useTAP(options: UseTAPOptions = {}): UseTAPResult {
  const { agentId, includeRank = false, pollInterval = 60000 } = options;
  
  const [score, setScore] = useState<TAPScore | null>(null);
  const [rank, setRank] = useState<TAPRank | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const fetchTAP = useCallback(async () => {
    if (!agentId) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Fetch TAP score
      const scoreResponse = await fetch(`${MOLTOS_API}/tap/score?agent_id=${agentId}`);
      if (!scoreResponse.ok) throw new Error('Failed to fetch TAP score');
      const scoreData = await scoreResponse.json();
      setScore(scoreData);
      
      // Fetch rank if requested
      if (includeRank) {
        const leaderboardResponse = await fetch(`${MOLTOS_API}/leaderboard?limit=1000`);
        if (!leaderboardResponse.ok) throw new Error('Failed to fetch leaderboard');
        const leaderboardData = await leaderboardResponse.json();
        
        const agents = leaderboardData.agents || [];
        const rankIndex = agents.findIndex((a: Agent) => a.agent_id === agentId);
        
        setRank({
          rank: rankIndex >= 0 ? rankIndex + 1 : agents.length,
          total_agents: agents.length,
          percentile: rankIndex >= 0 
            ? Math.round(((agents.length - rankIndex) / agents.length) * 100)
            : 0
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [agentId, includeRank]);
  
  useEffect(() => {
    fetchTAP();
  }, [fetchTAP]);
  
  useEffect(() => {
    if (pollInterval <= 0) return;
    const interval = setInterval(fetchTAP, pollInterval);
    return () => clearInterval(interval);
  }, [fetchTAP, pollInterval]);
  
  return { score, rank, loading, error, refresh: fetchTAP };
}

// ============================================================================
// useAttestations Hook
// ============================================================================

export interface Attestation {
  id: string;
  attester_id: string;
  target_agent_id: string;
  claim: string;
  score: number;
  signature: string;
  created_at: string;
}

export interface UseAttestationsOptions {
  agentId?: string;
  direction: 'received' | 'given' | 'both';
  limit?: number;
}

export interface UseAttestationsResult {
  attestations: Attestation[];
  loading: boolean;
  error: Error | null;
  submitAttestation: (targetId: string, claim: string, score: number, signature: string) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Hook for attestation/vouch management
 * 
 * Provides attestation history and submission functionality.
 * Used for building trust through peer attestations.
 */
export function useAttestations(
  apiKey: string,
  options: UseAttestationsOptions = { direction: 'both' }
): UseAttestationsResult {
  const { agentId, direction = 'both', limit = 50 } = options;
  
  const [attestations, setAttestations] = useState<Attestation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const fetchAttestations = useCallback(async () => {
    if (!agentId) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      let url = `${MOLTOS_API}/attestations?agent_id=${agentId}&limit=${limit}`;
      if (direction !== 'both') {
        url += `&direction=${direction}`;
      }
      
      const response = await fetch(url, {
        headers: { 'X-API-Key': apiKey }
      });
      
      if (!response.ok) throw new Error('Failed to fetch attestations');
      const data = await response.json();
      setAttestations(data.attestations || []);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [agentId, direction, limit, apiKey]);
  
  const submitAttestation = useCallback(async (
    targetId: string,
    claim: string,
    score: number,
    signature: string
  ) => {
    const response = await fetch(`${MOLTOS_API}/agent/attest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({
        target_agent_id: targetId,
        claim,
        score,
        signature
      })
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `Attestation failed: ${response.statusText}`);
    }
    
    // Refresh attestations after successful submit
    await fetchAttestations();
  }, [apiKey, fetchAttestations]);
  
  useEffect(() => {
    fetchAttestations();
  }, [fetchAttestations]);
  
  return {
    attestations,
    loading,
    error,
    submitAttestation,
    refresh: fetchAttestations
  };
}

// ============================================================================
// useNotifications Hook (bonus)
// ============================================================================

export interface Notification {
  id: string;
  notification_type: string;
  title: string;
  message: string;
  read_at: string | null;
  created_at: string;
}

export interface UseNotificationsResult {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: Error | null;
  markAsRead: (ids: string[]) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  poll: (timeout?: number) => Promise<void>;
}

/**
 * Hook for real-time notifications
 * 
 * Provides Arbitra notifications (disputes, appeals, honeypot triggers)
 * with long-polling support for real-time updates.
 */
export function useNotifications(
  apiKey: string,
  options: { pollInterval?: number; types?: string[] } = {}
): UseNotificationsResult {
  const { pollInterval = 30000, types = ['dispute', 'appeal', 'honeypot'] } = options;
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const abortController = useRef<AbortController | null>(null);
  
  const fetchNotifications = useCallback(async (usePolling = false) => {
    try {
      if (!usePolling) setLoading(true);
      setError(null);
      
      // Abort any existing request
      if (abortController.current) {
        abortController.current.abort();
      }
      abortController.current = new AbortController();
      
      const url = new URL(`${MOLTOS_API}/arbitra/notifications`);
      url.searchParams.set('types', types.join(','));
      if (usePolling) url.searchParams.set('poll', 'true');
      
      const response = await fetch(url.toString(), {
        headers: { 'X-API-Key': apiKey },
        signal: abortController.current.signal
      });
      
      if (!response.ok) throw new Error('Failed to fetch notifications');
      const data = await response.json();
      
      setNotifications(data.notifications || []);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (!usePolling) setLoading(false);
    }
  }, [apiKey, types]);
  
  const markAsRead = useCallback(async (ids: string[]) => {
    const response = await fetch(`${MOLTOS_API}/arbitra/notifications`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({ notification_ids: ids })
    });
    
    if (!response.ok) throw new Error('Failed to mark as read');
    
    // Update local state
    setNotifications(prev => prev.map(n => 
      ids.includes(n.id) ? { ...n, read_at: new Date().toISOString() } : n
    ));
  }, [apiKey]);
  
  const markAllAsRead = useCallback(async () => {
    const response = await fetch(`${MOLTOS_API}/arbitra/notifications`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify({ notification_ids: 'all' })
    });
    
    if (!response.ok) throw new Error('Failed to mark all as read');
    
    setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })));
  }, [apiKey]);
  
  const poll = useCallback(async (timeout = 30) => {
    await fetchNotifications(true);
  }, [fetchNotifications]);
  
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);
  
  useEffect(() => {
    if (pollInterval <= 0) return;
    const interval = setInterval(() => fetchNotifications(), pollInterval);
    return () => {
      clearInterval(interval);
      if (abortController.current) {
        abortController.current.abort();
      }
    };
  }, [fetchNotifications, pollInterval]);
  
  const unreadCount = notifications.filter(n => !n.read_at).length;
  
  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    markAllAsRead,
    poll
  };
}

// Export all hooks
export {
  useAgent as default,
};
