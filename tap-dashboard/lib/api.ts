import type {
  Agent,
  AgentListItem,
  LeaderboardResponse,
  RegisterBody,
  RegisterResponse,
  AttestBody,
  AttestResponse,
  AuthResponse,
  EarningsResponse,
  ArbitraEligibility,
  ClawMessage,
  ClawFile,
  Workflow,
  WorkflowExecution,
} from './types'

const BASE = ''
const FETCH_TIMEOUT = 5000 // 5 second timeout

async function apiFetch<T>(
  path: string,
  opts: RequestInit = {},
  apiKey?: string
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> ?? {}),
  }
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT)

  try {
    const res = await fetch(`${BASE}${path}`, { 
      ...opts, 
      headers,
      signal: controller.signal 
    })
    clearTimeout(timeoutId)

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText)
      throw new Error(`API ${res.status}: ${text}`)
    }
    return res.json() as Promise<T>
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`API timeout after ${FETCH_TIMEOUT}ms`)
    }
    throw error
  }
}

// ── Public Endpoints ───────────────────────────────────

export async function getAgents(): Promise<{ agents: AgentListItem[] }> {
  return apiFetch('/api/agents')
}

export async function getAgent(id: string): Promise<Agent> {
  return apiFetch(`/api/agents/${id}`)
}

export async function getLeaderboard(): Promise<LeaderboardResponse> {
  return apiFetch('/api/leaderboard')
}

export async function registerAgent(body: RegisterBody): Promise<RegisterResponse> {
  return apiFetch('/api/agent/register', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

// ── Authenticated Endpoints ────────────────────────────

export async function authAgent(apiKey: string): Promise<AuthResponse> {
  return apiFetch('/api/agent/auth', {}, apiKey)
}

export async function submitAttestation(
  body: AttestBody,
  apiKey: string
): Promise<AttestResponse> {
  return apiFetch('/api/agent/attest', {
    method: 'POST',
    body: JSON.stringify(body),
  }, apiKey)
}

export async function getEarnings(apiKey: string): Promise<EarningsResponse> {
  return apiFetch('/api/agent/earnings', {}, apiKey)
}

export async function requestWithdrawal(
  amount: number,
  destination: string,
  apiKey: string
) {
  return apiFetch('/api/agent/withdraw', {
    method: 'POST',
    body: JSON.stringify({ amount, destination }),
  }, apiKey)
}

export async function checkArbitraEligibility(
  apiKey: string
): Promise<ArbitraEligibility> {
  return apiFetch('/api/arbitra/join', { method: 'POST' }, apiKey)
}

// ── ClawOS Kernel ──────────────────────────────────────

export async function getInbox(apiKey: string): Promise<{ messages: ClawMessage[] }> {
  return apiFetch('/api/claw/bus/inbox', {}, apiKey)
}

export async function sendMessage(
  to: string,
  payload: Record<string, unknown>,
  priority: number = 3,
  apiKey: string = ''
) {
  return apiFetch('/api/claw/bus/send', {
    method: 'POST',
    body: JSON.stringify({ to, payload, priority }),
  }, apiKey)
}

export async function getFiles(apiKey: string): Promise<{ files: ClawFile[] }> {
  return apiFetch('/api/claw/fs/files', {}, apiKey)
}

export async function getWorkflows(apiKey: string): Promise<{ workflows: Workflow[] }> {
  return apiFetch('/api/claw/scheduler/workflows', {}, apiKey)
}

export async function executeWorkflow(
  workflow_id: string,
  input: Record<string, unknown>,
  apiKey: string
): Promise<WorkflowExecution> {
  return apiFetch('/api/claw/scheduler/execute', {
    method: 'POST',
    body: JSON.stringify({ workflow_id, input }),
  }, apiKey)
}

export async function getProcesses(apiKey: string) {
  return apiFetch('/api/claw/kernel/processes', {}, apiKey)
}
