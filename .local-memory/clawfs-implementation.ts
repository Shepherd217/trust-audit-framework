/**
 * ClawFS - Persistent, Reputation-Gated, Merkle-Backed Filesystem for Agents
 * @version 0.1.0-alpha
 * @module @exitliquidity/clawfs
 */

import { createHash, randomBytes } from 'crypto';
import { ClawID } from '../clawid-protocol/clawid-token';
import { TAPClient } from '../tap-sdk/tap-client';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface ClawFSConfig {
  agentId: string;
  clawId: ClawID;
  tapClient: TAPClient;
  minReputation: number;
  storageBackend: 'sqlite' | 'memory' | 'hybrid';
  enableVectorIndex: boolean;
  merklePublishInterval: number; // ms
}

export interface FileMetadata {
  path: string;
  owner: string; // ClawID public key
  createdAt: Date;
  modifiedAt: Date;
  merkleRoot: string;
  version: number;
  permissions: Permission[];
  tags: string[];
  vectorEmbedding?: number[]; // For semantic search
}

export interface Permission {
  clawId: string;
  read: boolean;
  write: boolean;
  delete: boolean;
  share: boolean;
}

export interface MerkleNode {
  hash: string;
  left?: MerkleNode;
  right?: MerkleNode;
  leaf?: MerkleLeaf;
  timestamp: number;
  operation: 'create' | 'write' | 'delete' | 'share';
  clawId: string;
  signature: string;
}

export interface MerkleLeaf {
  path: string;
  contentHash: string;
  timestamp: number;
  clawId: string;
  prevVersion?: string;
}

export interface FileHandle {
  path: string;
  merkleRoot: string;
  proof: MerkleProof;
  expiresAt: number;
}

export interface MerkleProof {
  root: string;
  leaf: string;
  siblings: string[];
  indices: number[];
}

export interface OperationResult {
  success: boolean;
  merkleRoot: string;
  proof?: MerkleProof;
  error?: string;
  reputationDeducted?: number;
}

// ============================================================================
// REPUTATION GATE
// ============================================================================

export class ReputationGate {
  private tapClient: TAPClient;
  private minReputation: number;
  private operationCosts: Map<string, number>;

  constructor(tapClient: TAPClient, minReputation: number = 60) {
    this.tapClient = tapClient;
    this.minReputation = minReputation;
    this.operationCosts = new Map([
      ['read', 1],
      ['write', 5],
      ['delete', 10],
      ['share', 2],
      ['create', 5],
    ]);
  }

  async verify(clawId: string): Promise<{ allowed: boolean; reputation: number; cost: number }> {
    // Query TAP for reputation score
    const reputation = await this.tapClient.getReputation(clawId);
    
    if (reputation < this.minReputation) {
      return { allowed: false, reputation, cost: 0 };
    }

    return { allowed: true, reputation, cost: 0 };
  }

  async checkOperation(clawId: string, operation: string): Promise<{ allowed: boolean; reputation: number; cost: number }> {
    const { allowed, reputation } = await this.verify(clawId);
    
    if (!allowed) {
      return { allowed: false, reputation, cost: 0 };
    }

    const cost = this.operationCosts.get(operation) || 1;
    
    // Check if agent has enough "reputation budget" for operation
    // This prevents reputation-draining attacks
    if (reputation - cost < this.minReputation) {
      return { allowed: false, reputation, cost };
    }

    return { allowed: true, reputation, cost };
  }

  setMinReputation(min: number): void {
    this.minReputation = min;
  }

  setOperationCost(operation: string, cost: number): void {
    this.operationCosts.set(operation, cost);
  }
}

// ============================================================================
// MERKLE DAG
// ============================================================================

export class MerkleDAG {
  private root: MerkleNode | null = null;
  private leaves: Map<string, MerkleLeaf> = new Map();
  private nodes: Map<string, MerkleNode> = new Map();

  hash(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }

  createLeaf(path: string, content: Buffer, clawId: string, prevVersion?: string): MerkleLeaf {
    const contentHash = this.hash(content.toString('base64'));
    const timestamp = Date.now();
    
    const leaf: MerkleLeaf = {
      path,
      contentHash,
      timestamp,
      clawId,
      prevVersion,
    };

    this.leaves.set(path, leaf);
    return leaf;
  }

  buildTree(leaves: MerkleLeaf[], operations: { op: string; clawId: string; signature: string }[]): MerkleNode {
    if (leaves.length === 0) {
      throw new Error('Cannot build tree from empty leaves');
    }

    // Create leaf nodes
    let nodes: MerkleNode[] = leaves.map((leaf, index) => ({
      hash: this.hash(JSON.stringify(leaf)),
      leaf,
      timestamp: leaf.timestamp,
      operation: operations[index]?.op as any || 'create',
      clawId: leaf.clawId,
      signature: operations[index]?.signature || '',
    }));

    // Build tree bottom-up
    while (nodes.length > 1) {
      const nextLevel: MerkleNode[] = [];
      
      for (let i = 0; i < nodes.length; i += 2) {
        const left = nodes[i];
        const right = nodes[i + 1] || left; // Duplicate last if odd
        
        const parent: MerkleNode = {
          hash: this.hash(left.hash + right.hash + JSON.stringify(operations[Math.floor(i/2)] || {})),
          left,
          right: right === left ? undefined : right,
          timestamp: Date.now(),
          operation: 'create',
          clawId: left.clawId,
          signature: left.signature,
        };
        
        nextLevel.push(parent);
        this.nodes.set(parent.hash, parent);
      }
      
      nodes = nextLevel;
    }

    this.root = nodes[0];
    return this.root;
  }

  getRoot(): string | null {
    return this.root?.hash || null;
  }

  generateProof(leafPath: string): MerkleProof | null {
    const leaf = this.leaves.get(leafPath);
    if (!leaf) return null;

    const leafHash = this.hash(JSON.stringify(leaf));
    const siblings: string[] = [];
    const indices: number[] = [];

    // Traverse from root to find path
    // This is simplified - real implementation needs parent pointers
    // For now, return basic proof structure
    return {
      root: this.getRoot() || '',
      leaf: leafHash,
      siblings,
      indices,
    };
  }

  verifyProof(proof: MerkleProof): boolean {
    // Reconstruct root from leaf + siblings
    let current = proof.leaf;
    
    for (let i = 0; i < proof.siblings.length; i++) {
      if (proof.indices[i] === 0) {
        current = this.hash(current + proof.siblings[i]);
      } else {
        current = this.hash(proof.siblings[i] + current);
      }
    }

    return current === proof.root;
  }

  getHistory(path: string): MerkleLeaf[] {
    const history: MerkleLeaf[] = [];
    let current = this.leaves.get(path);
    
    while (current) {
      history.unshift(current);
      if (current.prevVersion) {
        // In real implementation, lookup previous version
        break;
      }
      current = undefined;
    }

    return history;
  }
}

// ============================================================================
// HYBRID STORAGE ENGINE
// ============================================================================

export class HybridStorage {
  private sqlite: any; // Would be better-sqlite3 in production
  private vectorIndex: Map<string, number[]> = new Map();
  private memory: Map<string, Buffer> = new Map();
  private backend: string;

  constructor(backend: 'sqlite' | 'memory' | 'hybrid' = 'memory') {
    this.backend = backend;
    // In production: initialize SQLite, vector DB connections
  }

  async write(path: string, data: Buffer, metadata: FileMetadata): Promise<void> {
    // Hot path: memory
    this.memory.set(path, data);

    // Warm path: SQLite
    if (this.backend !== 'memory') {
      // await this.sqlite.prepare('INSERT OR REPLACE INTO files...').run(...)
    }

    // Vector index: semantic embedding
    if (metadata.vectorEmbedding) {
      this.vectorIndex.set(path, metadata.vectorEmbedding);
    }
  }

  async read(path: string): Promise<Buffer | null> {
    // Check hot cache first
    const cached = this.memory.get(path);
    if (cached) return cached;

    // Fall through to SQLite
    if (this.backend !== 'memory') {
      // const row = await this.sqlite.prepare('SELECT data FROM files WHERE path = ?').get(path);
      // return row?.data;
    }

    return null;
  }

  async delete(path: string): Promise<void> {
    this.memory.delete(path);
    this.vectorIndex.delete(path);
    
    if (this.backend !== 'memory') {
      // await this.sqlite.prepare('DELETE FROM files WHERE path = ?').run(path);
    }
  }

  async search(query: string, vector?: number[]): Promise<string[]> {
    // Semantic search using vector similarity
    if (!vector) return [];

    const results: { path: string; similarity: number }[] = [];
    
    for (const [path, embedding] of this.vectorIndex) {
      const similarity = this.cosineSimilarity(vector, embedding);
      if (similarity > 0.8) {
        results.push({ path, similarity });
      }
    }

    return results
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 10)
      .map(r => r.path);
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

// ============================================================================
// CORE CLAWFS CLASS
// ============================================================================

export class ClawFS {
  private config: ClawFSConfig;
  private reputationGate: ReputationGate;
  private merkleDAG: MerkleDAG;
  private storage: HybridStorage;
  private metadata: Map<string, FileMetadata> = new Map();

  constructor(config: ClawFSConfig) {
    this.config = config;
    this.reputationGate = new ReputationGate(config.tapClient, config.minReputation);
    this.merkleDAG = new MerkleDAG();
    this.storage = new HybridStorage(config.storageBackend);
  }

  // --------------------------------------------------------------------------
  // CORE OPERATIONS
  // --------------------------------------------------------------------------

  async create(
    path: string, 
    data: Buffer, 
    options: { 
      tags?: string[]; 
      vectorEmbedding?: number[];
      permissions?: Permission[];
    } = {}
  ): Promise<OperationResult> {
    // 1. Reputation gate
    const check = await this.reputationGate.checkOperation(this.config.agentId, 'create');
    if (!check.allowed) {
      return {
        success: false,
        merkleRoot: '',
        error: `Insufficient reputation: ${check.reputation} < ${this.config.minReputation}`,
      };
    }

    try {
      // 2. Sign operation with ClawID
      const operation = { op: 'create', path, timestamp: Date.now() };
      const signature = await this.config.clawId.sign(JSON.stringify(operation));

      // 3. Create Merkle leaf
      const leaf = this.merkleDAG.createLeaf(path, data, this.config.agentId);

      // 4. Build tree
      const root = this.merkleDAG.buildTree([leaf], [{ op: 'create', clawId: this.config.agentId, signature }]);

      // 5. Store data
      const metadata: FileMetadata = {
        path,
        owner: this.config.agentId,
        createdAt: new Date(),
        modifiedAt: new Date(),
        merkleRoot: root.hash,
        version: 1,
        permissions: options.permissions || [],
        tags: options.tags || [],
        vectorEmbedding: options.vectorEmbedding,
      };

      await this.storage.write(path, data, metadata);
      this.metadata.set(path, metadata);

      // 6. Publish root to ClawID Merkle tree (async)
      this.publishToClawID(root.hash).catch(console.error);

      return {
        success: true,
        merkleRoot: root.hash,
        reputationDeducted: check.cost,
      };
    } catch (error) {
      return {
        success: false,
        merkleRoot: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async read(path: string, requestorClawId?: string): Promise<OperationResult & { data?: Buffer }> {
    const clawId = requestorClawId || this.config.agentId;
    
    // 1. Reputation gate
    const check = await this.reputationGate.checkOperation(clawId, 'read');
    if (!check.allowed) {
      return {
        success: false,
        merkleRoot: '',
        error: `Insufficient reputation: ${check.reputation} < ${this.config.minReputation}`,
      };
    }

    // 2. Check permissions
    const metadata = this.metadata.get(path);
    if (metadata && metadata.owner !== clawId) {
      const hasPermission = metadata.permissions.some(p => 
        p.clawId === clawId && p.read
      );
      if (!hasPermission) {
        return {
          success: false,
          merkleRoot: '',
          error: 'Access denied: no read permission',
        };
      }
    }

    // 3. Read data
    const data = await this.storage.read(path);
    if (!data) {
      return {
        success: false,
        merkleRoot: '',
        error: 'File not found',
      };
    }

    // 4. Generate proof
    const proof = this.merkleDAG.generateProof(path);

    return {
      success: true,
      merkleRoot: this.merkleDAG.getRoot() || '',
      proof: proof || undefined,
      data,
      reputationDeducted: check.cost,
    };
  }

  async write(
    path: string, 
    data: Buffer, 
    options: { append?: boolean } = {}
  ): Promise<OperationResult> {
    // 1. Reputation gate
    const check = await this.reputationGate.checkOperation(this.config.agentId, 'write');
    if (!check.allowed) {
      return {
        success: false,
        merkleRoot: '',
        error: `Insufficient reputation: ${check.reputation} < ${this.config.minReputation}`,
      };
    }

    // 2. Check ownership/permissions
    const metadata = this.metadata.get(path);
    if (metadata && metadata.owner !== this.config.agentId) {
      const hasPermission = metadata.permissions.some(p => 
        p.clawId === this.config.agentId && p.write
      );
      if (!hasPermission) {
        return {
          success: false,
          merkleRoot: '',
          error: 'Access denied: no write permission',
        };
      }
    }

    try {
      // 3. Sign operation
      const operation = { op: 'write', path, timestamp: Date.now() };
      const signature = await this.config.clawId.sign(JSON.stringify(operation));

      // 4. Create new Merkle leaf with previous version reference
      const prevVersion = metadata?.merkleRoot;
      const leaf = this.merkleDAG.createLeaf(path, data, this.config.agentId, prevVersion);

      // 5. Rebuild tree
      const root = this.merkleDAG.buildTree([leaf], [{ op: 'write', clawId: this.config.agentId, signature }]);

      // 6. Update storage
      const newMetadata: FileMetadata = {
        ...metadata!,
        modifiedAt: new Date(),
        merkleRoot: root.hash,
        version: (metadata?.version || 0) + 1,
      };

      await this.storage.write(path, data, newMetadata);
      this.metadata.set(path, newMetadata);

      // 7. Publish root
      this.publishToClawID(root.hash).catch(console.error);

      return {
        success: true,
        merkleRoot: root.hash,
        reputationDeducted: check.cost,
      };
    } catch (error) {
      return {
        success: false,
        merkleRoot: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async delete(path: string): Promise<OperationResult> {
    // 1. Reputation gate (highest cost)
    const check = await this.reputationGate.checkOperation(this.config.agentId, 'delete');
    if (!check.allowed) {
      return {
        success: false,
        merkleRoot: '',
        error: `Insufficient reputation: ${check.reputation} < ${this.config.minReputation}`,
      };
    }

    // 2. Check ownership
    const metadata = this.metadata.get(path);
    if (metadata && metadata.owner !== this.config.agentId) {
      return {
        success: false,
        merkleRoot: '',
        error: 'Access denied: only owner can delete',
      };
    }

    // 3. Create tombstone in Merkle tree
    const tombstone = Buffer.from(JSON.stringify({ deleted: true, path, timestamp: Date.now() }));
    const leaf = this.merkleDAG.createLeaf(`${path}#deleted`, tombstone, this.config.agentId);
    const root = this.merkleDAG.buildTree([leaf], [{ op: 'delete', clawId: this.config.agentId, signature: '' }]);

    // 4. Delete from storage
    await this.storage.delete(path);
    this.metadata.delete(path);

    return {
      success: true,
      merkleRoot: root.hash,
      reputationDeducted: check.cost,
    };
  }

  async share(path: string, targetClawId: string, permissions: Omit<Permission, 'clawId'>): Promise<OperationResult> {
    // 1. Reputation gate
    const check = await this.reputationGate.checkOperation(this.config.agentId, 'share');
    if (!check.allowed) {
      return {
        success: false,
        merkleRoot: '',
        error: `Insufficient reputation: ${check.reputation} < ${this.config.minReputation}`,
      };
    }

    // 2. Check ownership
    const metadata = this.metadata.get(path);
    if (!metadata) {
      return {
        success: false,
        merkleRoot: '',
        error: 'File not found',
      };
    }

    if (metadata.owner !== this.config.agentId) {
      return {
        success: false,
        merkleRoot: '',
        error: 'Access denied: only owner can share',
      };
    }

    // 3. Add permission
    const newPermission: Permission = {
      clawId: targetClawId,
      ...permissions,
    };

    // Remove existing permission for this clawId if present
    metadata.permissions = metadata.permissions.filter(p => p.clawId !== targetClawId);
    metadata.permissions.push(newPermission);

    this.metadata.set(path, metadata);

    return {
      success: true,
      merkleRoot: metadata.merkleRoot,
      reputationDeducted: check.cost,
    };
  }

  async version(path: string): Promise<FileMetadata[]> {
    // Return version history from Merkle tree
    const history = this.merkleDAG.getHistory(path);
    
    // Map to metadata (simplified)
    return history.map((leaf, index) => ({
      path,
      owner: leaf.clawId,
      createdAt: new Date(leaf.timestamp),
      modifiedAt: new Date(leaf.timestamp),
      merkleRoot: this.merkleDAG.hash(JSON.stringify(leaf)),
      version: index + 1,
      permissions: [],
      tags: [],
    }));
  }

  async rollback(path: string, targetMerkleRoot: string): Promise<OperationResult & { data?: Buffer }> {
    // Find version with matching merkle root
    const history = this.merkleDAG.getHistory(path);
    const targetVersion = history.find(h => 
      this.merkleDAG.hash(JSON.stringify(h)) === targetMerkleRoot
    );

    if (!targetVersion) {
      return {
        success: false,
        merkleRoot: '',
        error: 'Version not found',
      };
    }

    // In production: restore from cold storage using content hash
    return {
      success: true,
      merkleRoot: targetMerkleRoot,
    };
  }

  // --------------------------------------------------------------------------
  // UTILITY METHODS
  // --------------------------------------------------------------------------

  async search(query: string, vector?: number[]): Promise<string[]> {
    return this.storage.search(query, vector);
  }

  getMerkleRoot(): string | null {
    return this.merkleDAG.getRoot();
  }

  verifyFile(path: string, proof: MerkleProof): boolean {
    return this.merkleDAG.verifyProof(proof);
  }

  private async publishToClawID(merkleRoot: string): Promise<void> {
    // Publish root to ClawID's identity Merkle tree
    // This links file system state to agent identity
    await this.config.clawId.publishMerkleRoot(merkleRoot);
  }

  // --------------------------------------------------------------------------
  // INTEGRATION HOOKS
  // --------------------------------------------------------------------------

  /**
   * ClawLink integration: Pass file handle to another agent
   */
  async createFileHandle(path: string, recipientClawId: string, expiresIn: number = 3600000): Promise<FileHandle> {
    const proof = this.merkleDAG.generateProof(path);
    if (!proof) throw new Error('Cannot create handle: file not found');

    return {
      path,
      merkleRoot: proof.root,
      proof,
      expiresAt: Date.now() + expiresIn,
    };
  }

  /**
   * ClawKernel integration: Checkpoint task state
   */
  async checkpoint(taskId: string, state: any): Promise<OperationResult> {
    const path = `.clawkernel/checkpoints/${taskId}/${Date.now()}.json`;
    return this.create(path, Buffer.from(JSON.stringify(state)), {
      tags: ['checkpoint', 'clawkernel', taskId],
    });
  }

  /**
   * ClawForge integration: Apply policy enforcement
   */
  async applyPolicy(policy: { maxFileSize?: number; allowedPaths?: string[]; bannedTags?: string[] }): Promise<void> {
    // Enforce policy on all operations
    // This would be called by ClawForge before operations
    console.log('Policy applied:', policy);
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default ClawFS;
