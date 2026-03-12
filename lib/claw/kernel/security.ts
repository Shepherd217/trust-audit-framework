/**
 * ClawKernel - Security Layer
 * Capability-based access control, sandboxing, and audit logging for MoltOS
 * 
 * Security Model:
 * - Capability-based: Actions require explicit capabilities
 * - Principle of least privilege: Minimal permissions by default
 * - Defense in depth: Multiple security layers
 * - Audit everything: Complete observability
 */

import { EventEmitter } from 'events';
import { randomUUID, createHash, createHmac } from 'crypto';
import { readFile, writeFile, appendFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

// ============================================================================
// Capability System
// ============================================================================

/**
 * Capability defines a permission to perform an action
 * Format: namespace:resource:action (e.g., "process:agent:spawn")
 */
export type Capability = 
  // Process capabilities
  | 'process:*' | 'process:agent:spawn' | 'process:agent:kill' | 'process:agent:monitor'
  | 'process:agent:restart' | 'process:agent:elevate'
  // File capabilities  
  | 'file:*' | 'file:read' | 'file:write' | 'file:delete' | 'file:execute'
  // Network capabilities
  | 'network:*' | 'network:connect' | 'network:listen' | 'network:outbound'
  | 'network:inbound' | 'network:dns'
  // System capabilities
  | 'system:*' | 'system:env' | 'system:time' | 'system:info'
  // Kernel capabilities
  | 'kernel:*' | 'kernel:admin' | 'kernel:debug' | 'kernel:audit:read'
  // Custom capabilities
  | string;

export interface CapabilityToken {
  id: string;
  subject: string;           // Who owns this token
  capabilities: Capability[];
  issuedAt: Date;
  expiresAt?: Date;
  issuedBy: string;
  metadata?: Record<string, unknown>;
  /** Cryptographic proof of authenticity */
  signature: string;
}

export interface CapabilityDelegation {
  from: string;
  to: string;
  capabilities: Capability[];
  constraints?: DelegationConstraint[];
}

export interface DelegationConstraint {
  type: 'time' | 'count' | 'scope' | 'condition';
  value: unknown;
}

/**
 * Capability Manager - Handles capability tokens and verification
 */
export class CapabilityManager extends EventEmitter {
  private tokens = new Map<string, CapabilityToken>();
  private delegations = new Map<string, CapabilityDelegation>();
  private secretKey: string;

  constructor(secretKey?: string) {
    super();
    this.secretKey = secretKey || this.generateSecret();
  }

  /**
   * Issue a new capability token
   */
  issueToken(
    subject: string,
    capabilities: Capability[],
    options: {
      ttl?: number;           // Time to live in ms
      metadata?: Record<string, unknown>;
      issuer?: string;
    } = {}
  ): CapabilityToken {
    const id = randomUUID();
    const now = new Date();
    
    const token: Omit<CapabilityToken, 'signature'> = {
      id,
      subject,
      capabilities: this.normalizeCapabilities(capabilities),
      issuedAt: now,
      issuedBy: options.issuer || 'kernel:root',
      metadata: options.metadata,
      ...(options.ttl ? { expiresAt: new Date(now.getTime() + options.ttl) } : {}),
    };

    // Sign the token
    const signature = this.signToken(token);
    const fullToken: CapabilityToken = { ...token, signature };

    this.tokens.set(id, fullToken);
    
    this.emit('token:issued', {
      id,
      subject,
      capabilities: token.capabilities,
    });

    return fullToken;
  }

  /**
   * Verify a capability token is valid and unexpired
   */
  verifyToken(token: CapabilityToken): boolean {
    // Check expiration
    if (token.expiresAt && token.expiresAt < new Date()) {
      return false;
    }

    // Verify signature
    const { signature, ...tokenWithoutSig } = token;
    const expectedSig = this.signToken(tokenWithoutSig);
    
    if (signature !== expectedSig) {
      return false;
    }

    return true;
  }

  /**
   * Check if a token has a specific capability
   */
  hasCapability(token: CapabilityToken, required: Capability): boolean {
    if (!this.verifyToken(token)) {
      return false;
    }

    return this.checkCapability(token.capabilities, required);
  }

  /**
   * Check if capabilities include a required capability
   * Supports wildcards: process:* matches process:agent:spawn
   */
  private checkCapability(have: Capability[], need: Capability): boolean {
    for (const cap of have) {
      if (this.capabilityMatches(cap, need)) {
        return true;
      }
    }
    return false;
  }

  private capabilityMatches(have: Capability, need: Capability): boolean {
    // Exact match
    if (have === need) return true;
    
    // Wildcard match
    const haveParts = have.split(':');
    const needParts = need.split(':');
    
    if (haveParts.length !== needParts.length) {
      // Check for partial wildcards like "process:*"
      if (haveParts[haveParts.length - 1] === '*') {
        // Match all with same prefix
        for (let i = 0; i < haveParts.length - 1; i++) {
          if (haveParts[i] !== needParts[i]) return false;
        }
        return true;
      }
      return false;
    }

    for (let i = 0; i < haveParts.length; i++) {
      if (haveParts[i] === '*') return true;
      if (haveParts[i] !== needParts[i]) return false;
    }
    
    return true;
  }

  /**
   * Revoke a capability token
   */
  revokeToken(tokenId: string): boolean {
    const deleted = this.tokens.delete(tokenId);
    if (deleted) {
      this.emit('token:revoked', { id: tokenId });
    }
    return deleted;
  }

  /**
   * Delegate capabilities to another subject
   */
  delegate(
    fromToken: CapabilityToken,
    toSubject: string,
    capabilities: Capability[],
    constraints?: DelegationConstraint[]
  ): CapabilityDelegation {
    // Verify delegator has the capabilities
    for (const cap of capabilities) {
      if (!this.hasCapability(fromToken, cap)) {
        throw new SecurityError(
          `Cannot delegate capability ${cap}: not possessed`,
          'DELEGATION_UNAUTHORIZED'
        );
      }
    }

    const delegation: CapabilityDelegation = {
      from: fromToken.subject,
      to: toSubject,
      capabilities: this.normalizeCapabilities(capabilities),
      constraints,
    };

    const id = randomUUID();
    this.delegations.set(id, delegation);

    this.emit('capability:delegated', {
      id,
      from: fromToken.subject,
      to: toSubject,
      capabilities,
    });

    return delegation;
  }

  /**
   * Get all capabilities for a subject (including delegated)
   */
  getSubjectCapabilities(subject: string): Capability[] {
    const caps = new Set<Capability>();

    // Direct tokens
    for (const token of this.tokens.values()) {
      if (token.subject === subject && this.verifyToken(token)) {
        token.capabilities.forEach(c => caps.add(c));
      }
    }

    // Delegated capabilities
    for (const delegation of this.delegations.values()) {
      if (delegation.to === subject) {
        delegation.capabilities.forEach(c => caps.add(c));
      }
    }

    return Array.from(caps);
  }

  private normalizeCapabilities(caps: Capability[]): Capability[] {
    // Remove duplicates, sort for consistent comparison
    return [...new Set(caps)].sort();
  }

  private signToken(token: Omit<CapabilityToken, 'signature'>): string {
    const data = JSON.stringify(token);
    return createHmac('sha256', this.secretKey).update(data).digest('hex');
  }

  private generateSecret(): string {
    return randomUUID() + randomUUID();
  }
}

// ============================================================================
// Security Errors
// ============================================================================

export class SecurityError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'SecurityError';
  }
}

// ============================================================================
// Sandbox System
// ============================================================================

export interface SandboxRule {
  action: 'allow' | 'deny';
  resource: string;
  operations?: string[];
  conditions?: SandboxCondition[];
}

export interface SandboxCondition {
  type: 'path' | 'time' | 'size' | 'content' | 'rate';
  operator: 'eq' | 'neq' | 'lt' | 'gt' | 'contains' | 'matches';
  value: unknown;
}

export interface SandboxProfile {
  id: string;
  name: string;
  rules: SandboxRule[];
  defaultAction: 'allow' | 'deny';
  resourceLimits?: {
    maxMemory?: number;
    maxCpu?: number;
    maxFileSize?: number;
    maxOpenFiles?: number;
  };
}

/**
 * Sandbox Manager - Process isolation and resource restrictions
 */
export class SandboxManager extends EventEmitter {
  private profiles = new Map<string, SandboxProfile>();
  private activeSandboxes = new Map<string, string>(); // processId -> profileId

  constructor() {
    super();
    this.registerDefaultProfiles();
  }

  /**
   * Register a sandbox profile
   */
  registerProfile(profile: SandboxProfile): void {
    this.profiles.set(profile.id, profile);
    this.emit('profile:registered', { id: profile.id, name: profile.name });
  }

  /**
   * Apply a sandbox profile to a process
   */
  async applySandbox(processId: string, profileId: string): Promise<void> {
    const profile = this.profiles.get(profileId);
    if (!profile) {
      throw new SecurityError(
        `Sandbox profile ${profileId} not found`,
        'PROFILE_NOT_FOUND'
      );
    }

    // Apply sandbox rules
    await this.enforceProfile(processId, profile);
    
    this.activeSandboxes.set(processId, profileId);
    
    this.emit('sandbox:applied', {
      processId,
      profileId,
      profileName: profile.name,
    });
  }

  /**
   * Check if an operation is allowed within a sandbox
   */
  checkOperation(
    processId: string,
    resource: string,
    operation: string,
    context?: Record<string, unknown>
  ): boolean {
    const profileId = this.activeSandboxes.get(processId);
    if (!profileId) {
      // No sandbox = allow all (or could deny all based on policy)
      return true;
    }

    const profile = this.profiles.get(profileId);
    if (!profile) return false;

    // Evaluate rules in order
    for (const rule of profile.rules) {
      if (this.matchesRule(rule, resource, operation, context)) {
        return rule.action === 'allow';
      }
    }

    return profile.defaultAction === 'allow';
  }

  /**
   * Remove sandbox from process
   */
  removeSandbox(processId: string): void {
    const profileId = this.activeSandboxes.get(processId);
    if (profileId) {
      this.activeSandboxes.delete(processId);
      this.emit('sandbox:removed', { processId, profileId });
    }
  }

  /**
   * Create a restricted execution context
   */
  createRestrictedContext<T extends (...args: any[]) => any>(
    fn: T,
    profileId: string
  ): (...args: Parameters<T>) => Promise<ReturnType<T>> {
    return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
      const executionId = randomUUID();
      
      try {
        await this.applySandbox(executionId, profileId);
        
        // Wrap function execution
        const result = await fn(...args);
        
        return result;
      } finally {
        this.removeSandbox(executionId);
      }
    };
  }

  private async enforceProfile(processId: string, profile: SandboxProfile): Promise<void> {
    // In a real implementation, this would:
    // - Set up namespaces (Linux)
    // - Apply seatbelt profile (macOS)
    // - Configure Windows sandbox
    // - Set resource limits via cgroups
    
    // For now, we track it internally
    if (profile.resourceLimits) {
      this.emit('sandbox:limits_applied', {
        processId,
        limits: profile.resourceLimits,
      });
    }
  }

  private matchesRule(
    rule: SandboxRule,
    resource: string,
    operation: string,
    context?: Record<string, unknown>
  ): boolean {
    // Check resource match
    if (rule.resource !== '*' && !this.matchPattern(rule.resource, resource)) {
      return false;
    }

    // Check operation match
    if (rule.operations && !rule.operations.includes(operation) && !rule.operations.includes('*')) {
      return false;
    }

    // Check conditions
    if (rule.conditions) {
      for (const condition of rule.conditions) {
        if (!this.evaluateCondition(condition, context)) {
          return false;
        }
      }
    }

    return true;
  }

  private matchPattern(pattern: string, value: string): boolean {
    // Simple glob-style matching
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
    return regex.test(value);
  }

  private evaluateCondition(
    condition: SandboxCondition,
    context?: Record<string, unknown>
  ): boolean {
    const ctxValue = context?.[condition.type];
    
    switch (condition.operator) {
      case 'eq': return ctxValue === condition.value;
      case 'neq': return ctxValue !== condition.value;
      case 'lt': return (ctxValue as number) < (condition.value as number);
      case 'gt': return (ctxValue as number) > (condition.value as number);
      case 'contains': return String(ctxValue).includes(String(condition.value));
      case 'matches': return new RegExp(String(condition.value)).test(String(ctxValue));
      default: return false;
    }
  }

  private registerDefaultProfiles(): void {
    // Minimal sandbox - only blocks dangerous operations
    this.registerProfile({
      id: 'minimal',
      name: 'Minimal Restrictions',
      rules: [
        { action: 'deny', resource: 'system:kernel' },
        { action: 'deny', resource: 'system:devices' },
      ],
      defaultAction: 'allow',
    });

    // Standard sandbox - common restrictions for untrusted code
    this.registerProfile({
      id: 'standard',
      name: 'Standard Sandbox',
      rules: [
        { action: 'deny', resource: 'file:write', operations: ['write'], conditions: [{ type: 'path', operator: 'contains', value: '/system' }] },
        { action: 'deny', resource: 'network:*' },
        { action: 'allow', resource: 'network:dns' },
        { action: 'allow', resource: 'network:connect', operations: ['connect'], conditions: [{ type: 'content', operator: 'matches', value: '^localhost:|^127\.' }] },
        { action: 'deny', resource: 'system:exec' },
        { action: 'deny', resource: 'process:signal' },
      ],
      defaultAction: 'allow',
      resourceLimits: {
        maxMemory: 512,
        maxCpu: 50,
        maxFileSize: 100 * 1024 * 1024, // 100MB
        maxOpenFiles: 100,
      },
    });

    // Strict sandbox - maximum restrictions
    this.registerProfile({
      id: 'strict',
      name: 'Strict Sandbox',
      rules: [
        { action: 'allow', resource: 'file:read', operations: ['read'] },
        { action: 'deny', resource: 'file:write' },
        { action: 'deny', resource: 'file:delete' },
        { action: 'deny', resource: 'file:execute' },
        { action: 'deny', resource: 'network:*' },
        { action: 'deny', resource: 'system:*' },
        { action: 'deny', resource: 'process:*' },
      ],
      defaultAction: 'deny',
      resourceLimits: {
        maxMemory: 128,
        maxCpu: 25,
        maxFileSize: 10 * 1024 * 1024, // 10MB
        maxOpenFiles: 10,
      },
    });

    // Network-isolated sandbox - allows compute but no network
    this.registerProfile({
      id: 'network-isolated',
      name: 'Network Isolated',
      rules: [
        { action: 'deny', resource: 'network:*' },
        { action: 'allow', resource: 'file:*' },
        { action: 'allow', resource: 'process:*' },
      ],
      defaultAction: 'allow',
    });
  }
}

// ============================================================================
// Audit System
// ============================================================================

export enum AuditLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical',
}

export interface AuditEvent {
  id: string;
  timestamp: Date;
  level: AuditLevel;
  category: string;
  action: string;
  subject: string;
  object?: string;
  result: 'success' | 'failure' | 'denied' | 'error';
  details?: Record<string, unknown>;
  sourceIp?: string;
  sessionId?: string;
  processId?: string;
  /** Integrity hash for tamper detection */
  integrityHash?: string;
}

export interface AuditConfig {
  logPath?: string;
  consoleOutput?: boolean;
  minLevel?: AuditLevel;
  retentionDays?: number;
  tamperDetection?: boolean;
  maxFileSize?: number;
  compression?: boolean;
}

/**
 * Audit Logger - Comprehensive security event logging
 */
export class AuditLogger extends EventEmitter {
  private config: AuditConfig;
  private eventQueue: AuditEvent[] = [];
  private flushTimer?: NodeJS.Timeout;
  private lastHash: string = '';

  constructor(config: AuditConfig = {}) {
    super();
    this.config = {
      logPath: '/var/log/claw/audit',
      consoleOutput: false,
      minLevel: AuditLevel.INFO,
      retentionDays: 90,
      tamperDetection: true,
      maxFileSize: 100 * 1024 * 1024, // 100MB
      compression: true,
      ...config,
    };

    this.startFlushTimer();
  }

  /**
   * Log a security-relevant event
   */
  async log(event: Omit<AuditEvent, 'id' | 'timestamp' | 'integrityHash'>): Promise<void> {
    // Filter by minimum level
    if (!this.shouldLog(event.level)) {
      return;
    }

    const fullEvent: AuditEvent = {
      ...event,
      id: randomUUID(),
      timestamp: new Date(),
    };

    // Add integrity hash for chain verification
    if (this.config.tamperDetection) {
      fullEvent.integrityHash = this.calculateHash(fullEvent);
    }

    this.eventQueue.push(fullEvent);
    
    // Immediate flush for critical events
    if (event.level === AuditLevel.CRITICAL) {
      await this.flush();
    }

    this.emit('audit:event', fullEvent);
  }

  /**
   * Log an access attempt (success or failure)
   */
  async logAccess(params: {
    subject: string;
    action: string;
    object?: string;
    result: 'success' | 'failure' | 'denied';
    details?: Record<string, unknown>;
    level?: AuditLevel;
  }): Promise<void> {
    await this.log({
      category: 'access',
      level: params.level || (params.result === 'denied' ? AuditLevel.WARNING : AuditLevel.INFO),
      ...params,
    });
  }

  /**
   * Log an authentication event
   */
  async logAuth(params: {
    subject: string;
    action: 'login' | 'logout' | 'refresh' | 'mfa' | 'impersonate';
    result: 'success' | 'failure' | 'denied';
    details?: Record<string, unknown>;
    sourceIp?: string;
  }): Promise<void> {
    await this.log({
      category: 'authentication',
      level: params.result === 'failure' ? AuditLevel.WARNING : AuditLevel.INFO,
      ...params,
    });
  }

  /**
   * Log a capability check
   */
  async logCapabilityCheck(
    subject: string,
    capability: string,
    granted: boolean,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      category: 'capability',
      action: 'check',
      subject,
      result: granted ? 'success' : 'denied',
      details: { capability, ...details },
      level: granted ? AuditLevel.DEBUG : AuditLevel.WARNING,
    });
  }

  /**
   * Log a sandbox violation
   */
  async logSandboxViolation(
    processId: string,
    operation: string,
    details?: Record<string, unknown>
  ): Promise<void> {
    await this.log({
      category: 'sandbox',
      action: 'violation',
      subject: processId,
      result: 'denied',
      details: { operation, ...details },
      level: AuditLevel.ERROR,
    });
  }

  /**
   * Query audit logs (simplified - real impl would use database)
   */
  async query(filters: {
    startTime?: Date;
    endTime?: Date;
    subject?: string;
    category?: string;
    level?: AuditLevel;
    limit?: number;
  } = {}): Promise<AuditEvent[]> {
    // This is a simplified implementation
    // Real implementation would query from persistent storage
    let events = [...this.eventQueue];

    if (filters.startTime) {
      events = events.filter(e => e.timestamp >= filters.startTime!);
    }
    if (filters.endTime) {
      events = events.filter(e => e.timestamp <= filters.endTime!);
    }
    if (filters.subject) {
      events = events.filter(e => e.subject === filters.subject);
    }
    if (filters.category) {
      events = events.filter(e => e.category === filters.category);
    }
    if (filters.level) {
      events = events.filter(e => e.level === filters.level);
    }
    if (filters.limit) {
      events = events.slice(-filters.limit);
    }

    return events;
  }

  /**
   * Verify log integrity (detect tampering)
   */
  async verifyIntegrity(): Promise<{
    valid: boolean;
    violations: AuditEvent[];
  }> {
    // In a real implementation, this would verify the hash chain
    // For now, return valid
    return { valid: true, violations: [] };
  }

  /**
   * Flush pending events to storage
   */
  async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const events = this.eventQueue.splice(0);

    try {
      // Ensure log directory exists
      if (!existsSync(this.config.logPath!)) {
        await mkdir(this.config.logPath!, { recursive: true });
      }

      // Write to file
      const logFile = join(this.config.logPath!, `audit-${this.getDateString()}.log`);
      const lines = events.map(e => JSON.stringify(e)).join('\n') + '\n';
      
      await appendFile(logFile, lines, 'utf-8');

      // Console output if configured
      if (this.config.consoleOutput) {
        for (const event of events) {
          console.log(`[AUDIT:${event.level.toUpperCase()}] ${event.category}:${event.action} - ${event.subject} -> ${event.result}`);
        }
      }

      this.emit('audit:flushed', { count: events.length });
    } catch (error) {
      // Critical: audit logging failed
      this.emit('audit:error', { error, events });
      // Re-queue events for retry
      this.eventQueue.unshift(...events);
    }
  }

  /**
   * Shutdown the audit logger
   */
  async shutdown(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    await this.flush();
  }

  private shouldLog(level: AuditLevel): boolean {
    const levels = Object.values(AuditLevel);
    const minIndex = levels.indexOf(this.config.minLevel!);
    const eventIndex = levels.indexOf(level);
    return eventIndex >= minIndex;
  }

  private calculateHash(event: AuditEvent): string {
    const data = JSON.stringify({
      timestamp: event.timestamp,
      category: event.category,
      action: event.action,
      subject: event.subject,
      previousHash: this.lastHash,
    });
    
    const hash = createHash('sha256').update(data).digest('hex');
    this.lastHash = hash;
    return hash;
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch(console.error);
    }, 5000); // Flush every 5 seconds
  }

  private getDateString(): string {
    return new Date().toISOString().split('T')[0];
  }
}

// ============================================================================
// Security Context
// ============================================================================

/**
 * SecurityContext wraps all security operations for a single session/request
 */
export class SecurityContext extends EventEmitter {
  public readonly id: string;
  public readonly token: CapabilityToken;
  
  constructor(
    private capabilityManager: CapabilityManager,
    private sandboxManager: SandboxManager,
    private auditLogger: AuditLogger,
    token: CapabilityToken,
    public metadata?: Record<string, unknown>
  ) {
    super();
    this.id = randomUUID();
    this.token = token;
  }

  /**
   * Check if this context has a capability
   */
  hasCapability(capability: Capability): boolean {
    return this.capabilityManager.hasCapability(this.token, capability);
  }

  /**
   * Require a capability or throw
   */
  requireCapability(capability: Capability): void {
    if (!this.hasCapability(capability)) {
      this.auditLogger.logCapabilityCheck(
        this.token.subject,
        capability,
        false,
        { context: this.id }
      );
      throw new SecurityError(
        `Missing required capability: ${capability}`,
        'CAPABILITY_DENIED',
        { capability, subject: this.token.subject }
      );
    }
    
    this.auditLogger.logCapabilityCheck(
      this.token.subject,
      capability,
      true,
      { context: this.id }
    );
  }

  /**
   * Execute with sandbox
   */
  async withSandbox<T>(profileId: string, fn: () => Promise<T>): Promise<T> {
    await this.sandboxManager.applySandbox(this.id, profileId);
    try {
      return await fn();
    } finally {
      this.sandboxManager.removeSandbox(this.id);
    }
  }

  /**
   * Log an audit event in this context
   */
  async audit(event: Omit<AuditEvent, 'id' | 'timestamp' | 'subject' | 'integrityHash'>): Promise<void> {
    await this.auditLogger.log({
      ...event,
      subject: this.token.subject,
      sessionId: this.id,
    });
  }
}

// ============================================================================
// Main Security Module
// ============================================================================

export interface SecurityModuleConfig {
  secretKey?: string;
  audit?: AuditConfig;
  defaultSandboxProfile?: string;
}

/**
 * Main security module integrating all security components
 */
export class SecurityModule extends EventEmitter {
  public readonly capabilities: CapabilityManager;
  public readonly sandbox: SandboxManager;
  public readonly audit: AuditLogger;

  private rootToken?: CapabilityToken;

  constructor(config: SecurityModuleConfig = {}) {
    super();
    
    this.capabilities = new CapabilityManager(config.secretKey);
    this.sandbox = new SandboxManager();
    this.audit = new AuditLogger(config.audit);

    // Create root token on initialization
    this.initializeRoot();

    // Wire up event forwarding
    this.setupEventForwarding();
  }

  /**
   * Create a security context for a request
   */
  createContext(
    token: CapabilityToken,
    metadata?: Record<string, unknown>
  ): SecurityContext {
    if (!this.capabilities.verifyToken(token)) {
      throw new SecurityError('Invalid or expired token', 'INVALID_TOKEN');
    }

    return new SecurityContext(
      this.capabilities,
      this.sandbox,
      this.audit,
      token,
      metadata
    );
  }

  /**
   * Get the root capability token (use with extreme care)
   */
  getRootToken(): CapabilityToken {
    if (!this.rootToken) {
      throw new SecurityError('Root token not initialized', 'NOT_INITIALIZED');
    }
    return this.rootToken;
  }

  /**
   * Authenticate and create token
   */
  async authenticate(
    subject: string,
    credentials: unknown,
    capabilities: Capability[]
  ): Promise<CapabilityToken> {
    // In real implementation, verify credentials
    // For now, create token directly
    
    await this.audit.logAuth({
      subject,
      action: 'login',
      result: 'success',
      details: { capabilities },
    });

    return this.capabilities.issueToken(subject, capabilities);
  }

  /**
   * Authorize an action
   */
  async authorize(
    token: CapabilityToken,
    capability: Capability,
    resource?: string
  ): Promise<boolean> {
    const granted = this.capabilities.hasCapability(token, capability);
    
    await this.audit.logCapabilityCheck(
      token.subject,
      capability,
      granted,
      { resource }
    );

    return granted;
  }

  /**
   * Shutdown the security module
   */
  async shutdown(): Promise<void> {
    await this.audit.shutdown();
  }

  private initializeRoot(): void {
    this.rootToken = this.capabilities.issueToken(
      'kernel:root',
      ['kernel:*', 'system:*', 'process:*', 'file:*', 'network:*'],
      { issuer: 'kernel:init' }
    );
  }

  private setupEventForwarding(): void {
    // Forward component events through main module
    this.capabilities.on('token:issued', (e) => this.emit('security:token:issued', e));
    this.capabilities.on('token:revoked', (e) => this.emit('security:token:revoked', e));
    this.sandbox.on('sandbox:violation', (e) => this.emit('security:sandbox:violation', e));
    this.audit.on('audit:event', (e) => this.emit('security:audit', e));
  }
}

// ============================================================================
// Exports
// ============================================================================

export default SecurityModule;
