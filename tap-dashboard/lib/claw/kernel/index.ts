/**
 * ClawKernel Core Service
 * Process management for MoltOS agents
 */

import { spawn as spawnProcess, ChildProcess } from 'child_process';
import { v4 as uuidv4 } from 'uuid';
import {
  AgentProcess,
  ProcessConfig,
  ClawKernelOptions,
  ProcessEvent,
} from './types';

// In-memory storage
const processes = new Map<string, AgentProcess>();
const childProcesses = new Map<string, ChildProcess>();
const eventListeners: ((event: ProcessEvent) => void)[] = [];

let options: ClawKernelOptions = {
  enablePersistence: false,
};

let initialized = false;

function initialize() {
  if (initialized) return;
  initialized = true;
  
  // TODO: Load from Supabase if persistence enabled
  // TODO: Set up heartbeat monitor
}

export function configure(opts: ClawKernelOptions) {
  options = { ...options, ...opts };
}

export function getOptions(): ClawKernelOptions {
  return { ...options };
}

export async function spawn(config: ProcessConfig): Promise<AgentProcess> {
  initialize();
  
  const id = uuidv4();
  const now = new Date();
  
  const process: AgentProcess = {
    id,
    agentId: config.agentId,
    status: 'spawning',
    resources: {
      cpuPercent: config.resources?.cpuPercent ?? 50,
      memoryMB: config.resources?.memoryMB ?? 512,
    },
    startedAt: now,
    lastHeartbeat: now,
    restartCount: 0,
  };
  
  // Store in memory
  processes.set(id, process);
  
  // Spawn actual child process
  // For now, spawn a simple Node process that keeps running
  const child = spawnProcess('node', ['-e', `
    console.log('Agent ${config.agentId} started, PID:', process.pid);
    setInterval(() => {
      console.log('heartbeat:${id}');
    }, 30000);
  `], {
    detached: false,
    env: { ...process.env, ...config.env, AGENT_ID: config.agentId },
  });
  
  childProcesses.set(id, child);
  process.pid = child.pid;
  process.status = 'running';
  
  // Handle process events
  child.on('exit', (code) => {
    const p = processes.get(id);
    if (p && p.status !== 'killed') {
      p.status = code === 0 ? 'killed' : 'crashed';
      emitEvent({ type: 'crashed', processId: id, agentId: config.agentId, timestamp: new Date(), metadata: { code } });
    }
  });
  
  // Listen for heartbeats
  child.stdout?.on('data', (data) => {
    const line = data.toString().trim();
    if (line.includes('heartbeat:${id}')) {
      heartbeat(id);
    }
  });
  
  emitEvent({ type: 'spawned', processId: id, agentId: config.agentId, timestamp: now });
  
  return process;
}

export async function kill(processId: string): Promise<void> {
  const process = processes.get(processId);
  if (!process) {
    throw new Error(`Process ${processId} not found`);
  }
  
  const child = childProcesses.get(processId);
  if (child) {
    // Try graceful shutdown first
    child.kill('SIGTERM');
    
    // Force kill after 5 seconds
    setTimeout(() => {
      if (!child.killed) {
        child.kill('SIGKILL');
      }
    }, 5000);
  }
  
  process.status = 'killed';
  emitEvent({ type: 'killed', processId, agentId: process.agentId, timestamp: new Date() });
}

export async function getStatus(processId: string): Promise<AgentProcess> {
  const process = processes.get(processId);
  if (!process) {
    throw new Error(`Process ${processId} not found`);
  }
  
  // Verify child process is actually running
  const child = childProcesses.get(processId);
  if (child && !child.killed) {
    try {
      // Check if process exists (sends signal 0)
      process.kill(0);
    } catch {
      process.status = 'crashed';
    }
  }
  
  return { ...process };
}

export async function list(): Promise<AgentProcess[]> {
  return Array.from(processes.values()).map(p => ({ ...p }));
}

export async function heartbeat(processId: string): Promise<void> {
  const process = processes.get(processId);
  if (!process) {
    throw new Error(`Process ${processId} not found`);
  }
  
  process.lastHeartbeat = new Date();
  emitEvent({ type: 'heartbeat', processId, agentId: process.agentId, timestamp: new Date() });
}

export function onEvent(listener: (event: ProcessEvent) => void): () => void {
  eventListeners.push(listener);
  return () => {
    const index = eventListeners.indexOf(listener);
    if (index > -1) {
      eventListeners.splice(index, 1);
    }
  };
}

function emitEvent(event: ProcessEvent) {
  eventListeners.forEach(listener => {
    try {
      listener(event);
    } catch (error) {
      console.error('Event listener error:', error);
    }
  });
}

// Export types
export * from './types';
