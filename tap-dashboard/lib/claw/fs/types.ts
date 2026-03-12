/**
 * ClawFS Types - Agent-Native Distributed File System
 * 
 * ClawFS is the first distributed file system designed specifically for AI agents,
 * combining cryptographic identity, semantic search, and intelligent storage tiering.
 * 
 * @module @claw/fs/types
 * @version 0.1.0
 */

// ============================================================================
// Enums
// ============================================================================

/**
 * Storage tiers for hybrid hot/warm/cold storage architecture.
 * Files automatically migrate between tiers based on access patterns.
 */
export enum StorageTier {
  /** Hot storage: Fast SSD/NVMe, in-memory caching, sub-millisecond latency */
  HOT = 'hot',
  /** Warm storage: Standard SSD, local disk, ~10ms latency */
  WARM = 'warm',
  /** Cold storage: IPFS archival, distributed, higher latency, immutable */
  COLD = 'cold'
}

/**
 * Permission types for agent-to-agent access control.
 */
export enum PermissionType {
  /** Read-only access to file content and metadata */
  READ = 'read',
  /** Write access - modify content, update metadata */
  WRITE = 'write',
  /** Admin access - modify permissions, delete, transfer ownership */
  ADMIN = 'admin',
  /** Share permission - grant access to other agents */
  SHARE = 'share'
}

/**
 * Reputation tiers for agents based on trust score and history.
 */
export enum ReputationTier {
  /** New agents or low trust score (< 0.3) */
  UNTRUSTED = 'untrusted',
  /** Standard tier for established agents (0.3 - 0.6) */
  STANDARD = 'standard',
  /** Verified agents with good history (0.6 - 0.8) */
  VERIFIED = 'verified',
  /** Highly trusted agents with proven track record (0.8 - 0.95) */
  TRUSTED = 'trusted',
  /** System-level or governance agents (> 0.95) */
  SOVEREIGN = 'sovereign'
}

/**
 * Conflict resolution strategies for concurrent modifications.
 */
export enum ConflictStrategy {
  /** Last-write-wins based on vector clock comparison */
  LWW = 'lww',
  /** Create branches for concurrent updates, require manual merge */
  BRANCH = 'branch',
  /** Automatic merge if no conflicting changes */
  AUTO_MERGE = 'auto_merge',
  /** Reject concurrent writes, enforce sequential access */
  REJECT = 'reject'
}

/**
 * Audit event types for compliance and tracking.
 */
export enum AuditEventType {
  FILE_CREATED = 'file_created',
  FILE_READ = 'file_read',
  FILE_UPDATED = 'file_updated',
  FILE_DELETED = 'file_deleted',
  PERMISSION_GRANTED = 'permission_granted',
  PERMISSION_REVOKED = 'permission_revoked',
  POLICY_UPDATED = 'policy_updated',
  TIER_MIGRATED = 'tier_migrated',
  CONFLICT_RESOLVED = 'conflict_resolved',
  ACCESS_DENIED = 'access_denied'
}

/**
 * Agent capability flags for feature negotiation.
 */
export enum AgentCapability {
  /** Can store and retrieve files */
  STORAGE = 'storage',
  /** Can perform semantic search */
  SEMANTIC_SEARCH = 'semantic_search',
  /** Can participate in consensus/validation */
  CONSENSUS = 'consensus',
  /** Can archive to cold storage (IPFS) */
  ARCHIVAL = 'archival',
  /** Can resolve conflicts automatically */
  CONFLICT_RESOLUTION = 'conflict_resolution',
  /** Can audit and generate compliance reports */
  AUDIT = 'audit'
}

// ============================================================================
// Core Types
// ============================================================================

/**
 * Content Identifier using IPFS-style multihash.
 * Format: <multibase-prefix><multicodec><multihash>
 * @example "QmX4z..."
 */
export type CID = string;

/**
 * Agent DID (Decentralized Identifier).
 * Format: did:claw:<public-key-hash>
 * @example "did:claw:z6MkhaXg..."
 */
export type AgentDID = string;

/**
 * Vector embedding for semantic search.
 * Typically 384, 768, or 1536 dimensions depending on model.
 */
export type Embedding = Float32Array;

/**
 * Unix timestamp in milliseconds.
 */
export type Timestamp = number;

/**
 * Vector clock entry for distributed consistency.
 */
export interface VectorClockEntry {
  /** Agent DID */
  agentId: AgentDID;
  /** Logical clock value for this agent */
  counter: number;
}

/**
 * Vector clock for tracking causality in distributed operations.
 */
export type VectorClock = VectorClockEntry[];

// ============================================================================
// Main Interfaces
// ============================================================================

/**
 * AgentIdentity - Cryptographic identity and reputation for agents in ClawFS.
 * 
 * Every agent has a unique cryptographic identity based on public-key cryptography.
 * Reputation is earned through successful interactions and can affect access rights.
 */
export interface AgentIdentity {
  /** Decentralized identifier (DID) - the primary agent ID */
  did: AgentDID;
  
  /** Public key for signature verification (multibase encoded) */
  publicKey: string;
  
  /** Key algorithm used (e.g., 'Ed25519', 'secp256k1') */
  keyType: string;
  
  /** Current reputation tier based on trust score */
  reputationTier: ReputationTier;
  
  /** Numerical trust score from 0.0 to 1.0 */
  trustScore: number;
  
  /** Capabilities this agent supports */
  capabilities: AgentCapability[];
  
  /** When the agent was first registered */
  createdAt: Timestamp;
  
  /** Last activity timestamp */
  lastActive: Timestamp;
  
  /** Human-readable name (optional) */
  displayName?: string;
  
  /** Agent metadata (version, type, etc.) */
  metadata?: Record<string, unknown>;
}

/**
 * FileObject - Core file representation in ClawFS.
 * 
 * Files are content-addressed (by CID) and have rich metadata including
 * semantic embeddings for AI-native search and access control policies.
 */
export interface FileObject {
  /** Unique file ID (UUID) within the namespace */
  id: string;
  
  /** Content Identifier - hash of the file content */
  cid: CID;
  
  /** File name with extension */
  name: string;
  
  /** MIME type of the content */
  mimeType: string;
  
  /** File size in bytes */
  size: number;
  
  /** Owner agent DID */
  owner: AgentDID;
  
  /** Current storage tier */
  storageTier: StorageTier;
  
  /** Current version ID */
  currentVersion: string;
  
  /** All version IDs (ordered oldest to newest) */
  versions: string[];
  
  /** Semantic embeddings for content search */
  embeddings?: Embedding[];
  
  /** Custom metadata (tags, descriptions, etc.) */
  metadata: FileMetadata;
  
  /** Access control policies */
  permissions: Permission[];
  
  /** Creation timestamp */
  createdAt: Timestamp;
  
  /** Last modification timestamp */
  modifiedAt: Timestamp;
  
  /** Vector clock for consistency */
  vectorClock: VectorClock;
}

/**
 * File metadata structure.
 */
export interface FileMetadata {
  /** User-provided description */
  description?: string;
  
  /** Content summary (auto-generated or manual) */
  summary?: string;
  
  /** Key topics extracted from content */
  topics?: string[];
  
  /** User-defined tags */
  tags?: string[];
  
  /** Source/origin information */
  source?: string;
  
  /** Language code (e.g., 'en', 'zh') */
  language?: string;
  
  /** Encryption status */
  encrypted: boolean;
  
  /** Encryption key reference (if encrypted) */
  encryptionKeyRef?: string;
  
  /** Additional custom fields */
  [key: string]: unknown;
}

/**
 * Permission - Agent-to-agent access control entry.
 * 
 * Defines what actions a specific agent can perform on a file.
 * Permissions can be time-bound and revoked.
 */
export interface Permission {
  /** Unique permission ID */
  id: string;
  
  /** File ID this permission applies to */
  fileId: string;
  
  /** Agent being granted permission */
  grantee: AgentDID;
  
  /** Agent who granted the permission */
  grantor: AgentDID;
  
  /** Type of permission granted */
  type: PermissionType;
  
  /** When the permission was granted */
  grantedAt: Timestamp;
  
  /** When the permission expires (null = never) */
  expiresAt: Timestamp | null;
  
  /** Whether this permission is currently active */
  active: boolean;
  
  /** When the permission was revoked (null if not revoked) */
  revokedAt: Timestamp | null;
  
  /** Reason for revocation (if revoked) */
  revokedReason?: string;
  
  /** Conditions that must be met for permission to apply */
  conditions?: PermissionCondition[];
}

/**
 * Permission condition for capability-based access control.
 */
export interface PermissionCondition {
  /** Type of condition */
  type: 'time' | 'location' | 'capability' | 'custom';
  
  /** Condition parameters */
  params: Record<string, unknown>;
  
  /** Whether condition must be verified cryptographically */
  requiresProof: boolean;
}

/**
 * AccessPolicy - High-level access control rules.
 * 
 * Defines default and specific access rules that can be applied to files
 * or directories. Supports time-bound, capability-based, and revocable policies.
 */
export interface AccessPolicy {
  /** Policy ID */
  id: string;
  
  /** Policy name/description */
  name: string;
  
  /** Owner who created this policy */
  owner: AgentDID;
  
  /** Default access level for unknown agents */
  defaultAccess: PermissionType | 'none';
  
  /** Specific rules (evaluated in order) */
  rules: AccessRule[];
  
  /** Whether policies are inherited by children */
  inheritable: boolean;
  
  /** Policy creation time */
  createdAt: Timestamp;
  
  /** Policy last update time */
  updatedAt: Timestamp;
  
  /** Whether the policy is currently active */
  active: boolean;
}

/**
 * Individual access rule within a policy.
 */
export interface AccessRule {
  /** Rule ID */
  id: string;
  
  /** Rule priority (lower = evaluated first) */
  priority: number;
  
  /** Agents this rule applies to (empty = all) */
  appliesTo: AgentDID[];
  
  /** Reputation tiers this rule applies to */
  reputationTiers?: ReputationTier[];
  
  /** Permission being granted */
  permission: PermissionType;
  
  /** Time constraints */
  timeConstraints?: TimeConstraint;
  
  /** Capabilities required */
  requiredCapabilities?: AgentCapability[];
}

/**
 * Time constraints for access rules.
 */
export interface TimeConstraint {
  /** Allowed days of week (0-6, Sunday = 0) */
  daysOfWeek?: number[];
  
  /** Allowed hours (0-23) */
  hoursOfDay?: number[];
  
  /** Absolute start time */
  notBefore?: Timestamp;
  
  /** Absolute end time */
  notAfter?: Timestamp;
  
  /** Maximum session duration in milliseconds */
  maxDurationMs?: number;
}

/**
 * FileVersion - Immutable version of a file.
 * 
 * Versions form a Merkle DAG (Directed Acyclic Graph) enabling
 * branching, merging, and complete history preservation.
 */
export interface FileVersion {
  /** Version ID (CID of version metadata) */
  id: string;
  
  /** File ID this version belongs to */
  fileId: string;
  
  /** Content CID for this version */
  contentCID: CID;
  
  /** Parent version IDs (empty for initial version) */
  parents: string[];
  
  /** Author who created this version */
  author: AgentDID;
  
  /** Commit message/description */
  message: string;
  
  /** Version creation timestamp */
  timestamp: Timestamp;
  
  /** Vector clock at time of creation */
  vectorClock: VectorClock;
  
  /** Merkle root hash of the version tree */
  merkleRoot: string;
  
  /** Whether this is a merge commit */
  isMerge: boolean;
  
  /** Branches this version is part of */
  branches: string[];
  
  /** Semantic embeddings for this version */
  embeddings?: Embedding[];
}

/**
 * StorageTierConfig - Configuration for a storage tier.
 */
export interface StorageTierConfig {
  /** The tier being configured */
  tier: StorageTier;
  
  /** Maximum file size for this tier */
  maxFileSize: number;
  
  /** Retention policy: how long files stay in this tier */
  retentionMs: number;
  
  /** Access frequency threshold for promotion */
  accessThreshold: number;
  
  /** Cost per GB per month (for billing) */
  costPerGB: number;
  
  /** Replication factor for durability */
  replicationFactor: number;
  
  /** Geographic regions for this tier */
  regions: string[];
  
  /** Compression algorithm used */
  compression?: string;
  
  /** Encryption requirements */
  encryptionRequired: boolean;
}

/**
 * Auto-migration rules between storage tiers.
 */
export interface TierMigrationRule {
  /** Source tier */
  from: StorageTier;
  
  /** Destination tier */
  to: StorageTier;
  
  /** Condition for migration */
  condition: MigrationCondition;
  
  /** Delay before migration in milliseconds */
  delayMs: number;
}

/**
 * Migration condition types.
 */
export interface MigrationCondition {
  type: 'age' | 'access_count' | 'access_pattern' | 'size' | 'custom';
  params: Record<string, unknown>;
}

/**
 * SemanticIndex - Vector search index for file content.
 * 
 * Enables AI-native semantic search across the file system.
 * Automatically maintains embeddings for content.
 */
export interface SemanticIndex {
  /** Index ID */
  id: string;
  
  /** Index name */
  name: string;
  
  /** Owner agent */
  owner: AgentDID;
  
  /** Embedding model used */
  model: string;
  
  /** Embedding dimensions */
  dimensions: number;
  
  /** Distance metric (cosine, euclidean, dot) */
  metric: 'cosine' | 'euclidean' | 'dot';
  
  /** Files indexed */
  fileIds: string[];
  
  /** Index statistics */
  stats: IndexStats;
  
  /** Last update timestamp */
  updatedAt: Timestamp;
  
  /** Whether index is currently building */
  building: boolean;
}

/**
 * Semantic index statistics.
 */
export interface IndexStats {
  /** Total number of vectors */
  vectorCount: number;
  
  /** Total indexed file count */
  fileCount: number;
  
  /** Average embedding generation time in ms */
  avgEmbeddingTimeMs: number;
  
  /** Index size in bytes */
  indexSizeBytes: number;
}

/**
 * Semantic search query and result types.
 */
export interface SemanticSearchQuery {
  /** Text query (will be embedded) */
  text?: string;
  
  /** Pre-computed embedding (alternative to text) */
  embedding?: Embedding;
  
  /** Maximum results to return */
  limit: number;
  
  /** Minimum similarity score (0-1) */
  minScore: number;
  
  /** Filter by file properties */
  filters?: SearchFilter;
  
  /** Requesting agent */
  agentId: AgentDID;
}

/**
 * Search filter criteria.
 */
export interface SearchFilter {
  /** Filter by file owner */
  owner?: AgentDID;
  
  /** Filter by MIME type patterns */
  mimeTypes?: string[];
  
  /** Filter by tags */
  tags?: string[];
  
  /** Filter by creation time range */
  createdAfter?: Timestamp;
  createdBefore?: Timestamp;
  
  /** Filter by storage tier */
  storageTier?: StorageTier[];
}

/**
 * Semantic search result.
 */
export interface SemanticSearchResult {
  /** File ID */
  fileId: string;
  
  /** File object (if available) */
  file?: FileObject;
  
  /** Similarity score (0-1) */
  score: number;
  
  /** Matched content excerpt */
  excerpt?: string;
  
  /** Vector distance */
  distance: number;
}

/**
 * ConflictResolution - Strategy and state for resolving concurrent modifications.
 * 
 * Implements optimistic locking with configurable merge strategies.
 * Uses vector clocks to detect and resolve conflicts.
 */
export interface ConflictResolution {
  /** Resolution ID */
  id: string;
  
  /** File ID with conflict */
  fileId: string;
  
  /** Conflict detection timestamp */
  detectedAt: Timestamp;
  
  /** Detected by which agent */
  detectedBy: AgentDID;
  
  /** Conflicting version IDs */
  conflictingVersions: string[];
  
  /** Resolution strategy to use */
  strategy: ConflictStrategy;
  
  /** Current resolution state */
  state: ConflictState;
  
  /** Winning version (if resolved) */
  resolvedVersion?: string;
  
  /** Created branches (if BRANCH strategy) */
  branches?: string[];
  
  /** Resolution timestamp */
  resolvedAt?: Timestamp;
  
  /** Agent who resolved (if manual) */
  resolvedBy?: AgentDID;
  
  /** Merge commit ID (if merged) */
  mergeCommit?: string;
}

/**
 * Conflict resolution states.
 */
export type ConflictState = 
  | 'detected'      // Conflict just detected
  | 'resolving'     // Automatic resolution in progress
  | 'pending_merge' // Waiting for manual merge
  | 'resolved'      // Successfully resolved
  | 'failed';       // Resolution failed

/**
 * Optimistic locking state for a file.
 */
export interface OptimisticLock {
  /** File ID */
  fileId: string;
  
  /** Current version at time of lock */
  version: string;
  
  /** Vector clock at time of lock */
  vectorClock: VectorClock;
  
  /** Lock acquired by */
  agentId: AgentDID;
  
  /** Lock acquisition time */
  acquiredAt: Timestamp;
  
  /** Lock expiration time */
  expiresAt: Timestamp;
}

/**
 * AuditEvent - Immutable record of system events.
 * 
 * Complete audit trail for compliance, debugging, and accountability.
 * All events are cryptographically signed by the acting agent.
 */
export interface AuditEvent {
  /** Event ID (CID of event data) */
  id: string;
  
  /** Event type */
  type: AuditEventType;
  
  /** Timestamp */
  timestamp: Timestamp;
  
  /** Actor agent DID */
  actor: AgentDID;
  
  /** Target file ID (if applicable) */
  targetFileId?: string;
  
  /** Target agent DID (if applicable) */
  targetAgentId?: AgentDID;
  
  /** Event details */
  details: AuditEventDetails;
  
  /** Vector clock at time of event */
  vectorClock: VectorClock;
  
  /** Cryptographic signature of event */
  signature: string;
  
  /** Merkle proof linking to previous events */
  merkleProof: string;
}

/**
 * Audit event details by type.
 */
export interface AuditEventDetails {
  /** Human-readable description */
  description: string;
  
  /** Additional structured data */
  metadata?: Record<string, unknown>;
  
  /** Before/after state for mutations */
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  
  /** IP address or network info */
  source?: string;
  
  /** Success/failure status */
  success: boolean;
  
  /** Error message if failed */
  error?: string;
}

/**
 * ClawFSConfig - System-wide configuration.
 * 
 * Global settings for storage, networking, consensus, and security.
 */
export interface ClawFSConfig {
  /** Config version */
  version: string;
  
  /** Node/agent identifier */
  nodeId: AgentDID;
  
  /** Storage tier configurations */
  storageTiers: StorageTierConfig[];
  
  /** Auto-migration rules */
  migrationRules: TierMigrationRule[];
  
  /** Default conflict resolution strategy */
  defaultConflictStrategy: ConflictStrategy;
  
  /** Semantic search configuration */
  semanticSearch: SemanticSearchConfig;
  
  /** Consensus and replication settings */
  consensus: ConsensusConfig;
  
  /** Security settings */
  security: SecurityConfig;
  
  /** Audit settings */
  audit: AuditConfig;
  
  /** IPFS integration settings */
  ipfs: IPFSConfig;
  
  /** Rate limiting */
  rateLimits: RateLimitConfig;
}

/**
 * Semantic search configuration.
 */
export interface SemanticSearchConfig {
  /** Default embedding model */
  defaultModel: string;
  
  /** Available models */
  availableModels: string[];
  
  /** Auto-embed on file upload */
  autoEmbed: boolean;
  
  /** Embedding batch size */
  batchSize: number;
  
  /** Vector database connection string */
  vectorDB: string;
  
  /** Minimum similarity threshold */
  minSimilarityThreshold: number;
}

/**
 * Consensus configuration.
 */
export interface ConsensusConfig {
  /** Consensus algorithm (raft, pbft, etc.) */
  algorithm: string;
  
  /** Number of nodes for quorum */
  minNodes: number;
  
  /** Replication factor for durability */
  replicationFactor: number;
  
  /** Sync/async replication */
  syncReplication: boolean;
  
  /** Conflict resolution timeout in ms */
  resolutionTimeoutMs: number;
}

/**
 * Security configuration.
 */
export interface SecurityConfig {
  /** Encryption algorithm */
  encryption: string;
  
  /** Key management service URL */
  keyManagement: string;
  
  /** Require encryption for all files */
  requireEncryption: boolean;
  
  /** Default access policy for new files */
  defaultPolicy: string;
  
  /** Maximum permission TTL in ms (0 = unlimited) */
  maxPermissionTTL: number;
}

/**
 * Audit configuration.
 */
export interface AuditConfig {
  /** Enable audit logging */
  enabled: boolean;
  
  /** Retention period in days */
  retentionDays: number;
  
  /** Events to log (empty = all) */
  filterEvents: AuditEventType[];
  
  /** Export destination for audit logs */
  exportDestination?: string;
}

/**
 * IPFS integration configuration.
 */
export interface IPFSConfig {
  /** IPFS API endpoint */
  apiEndpoint: string;
  
  /** IPFS gateway URL */
  gatewayUrl: string;
  
  /** Enable IPFS pinning for cold storage */
  enablePinning: boolean;
  
  /** Pinning service endpoint */
  pinningService?: string;
  
  /** IPFS cluster peers */
  clusterPeers: string[];
}

/**
 * Rate limiting configuration.
 */
export interface RateLimitConfig {
  /** Global requests per second */
  globalRPS: number;
  
  /** Per-agent requests per second */
  perAgentRPS: number;
  
  /** Storage operations per minute */
  storageRPM: number;
  
  /** Search queries per minute */
  searchRPM: number;
}

// ============================================================================
// Helper Types
// ============================================================================

/**
 * File operation result.
 */
export interface FileOperationResult<T> {
  /** Success status */
  success: boolean;
  
  /** Result data */
  data?: T;
  
  /** Error if failed */
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  
  /** Operation ID for tracking */
  operationId: string;
  
  /** Timestamp */
  timestamp: Timestamp;
}

/**
 * Batch operation for efficient bulk updates.
 */
export interface BatchOperation {
  /** Operations to perform */
  operations: SingleOperation[];
  
  /** Whether all must succeed */
  atomic: boolean;
  
  /** Requesting agent */
  agentId: AgentDID;
}

/**
 * Single operation within a batch.
 */
export interface SingleOperation {
  /** Operation type */
  type: 'create' | 'update' | 'delete' | 'move' | 'copy' | 'set_permission';
  
  /** Target file ID */
  fileId?: string;
  
  /** Operation parameters */
  params: Record<string, unknown>;
}

/**
 * Pagination parameters for list operations.
 */
export interface PaginationParams {
  /** Maximum items to return */
  limit: number;
  
  /** Offset for pagination */
  offset: number;
  
  /** Cursor for cursor-based pagination */
  cursor?: string;
  
  /** Sort field */
  sortBy?: string;
  
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated result wrapper.
 */
export interface PaginatedResult<T> {
  /** Result items */
  items: T[];
  
  /** Total count (if available) */
  total?: number;
  
  /** Next page cursor */
  nextCursor?: string;
  
  /** Whether more results available */
  hasMore: boolean;
}
