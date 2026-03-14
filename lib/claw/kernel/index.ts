/**
 * ClawKernel - Process Management for MoltOS
 * 
 * Provides process lifecycle management with optional sandboxed isolation.
 * High-reputation agents get Firecracker microVMs with dedicated resources.
 * Low-reputation agents get restricted containers.
 * Agents below threshold are auto-killed.
 */

export { 
  ProcessManager, 
  ProcessConfig, 
  ProcessStatus, 
  ProcessHandle,
  ProcessStats,
  RestartPolicy,
  SandboxConfig,
  ProcessError 
} from './process';

export {
  SandboxProcessManager,
  KernelSandboxConfig,
  SandboxProcess,
  calculateQuotasFromReputation,
} from './sandbox-integration';

// Re-export sandbox types for convenience
export {
  IsolationBackend,
  SecurityMode,
  ResourceQuotas,
  ResourceUsage,
  SandboxStatus,
  TelemetryReport,
  Violation,
  QuotaCalculator,
  ClawSandbox,
} from '../sandbox';
