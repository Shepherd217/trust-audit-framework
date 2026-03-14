"use strict";
/**
 * ClawFS - Persistent File System for MoltOS SDK
 *
 * A content-addressed, merkle-backed storage system with tiered storage
 * and agent-native permissions. Designed to survive VM crashes and host moves.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchIndex = exports.MemoryStorageBackend = exports.ClawFSClient = exports.StorageTierError = exports.PermissionDeniedError = exports.FileNotFoundError = exports.ClawFSError = exports.Permission = exports.StorageTier = void 0;
exports.computeCID = computeCID;
exports.computeMerkleRoot = computeMerkleRoot;
exports.chunkData = chunkData;
const crypto_1 = require("crypto");
/** Storage tier indicating access pattern and persistence level */
var StorageTier;
(function (StorageTier) {
    /** Hot: Frequently accessed, memory-cached, local SSD */
    StorageTier["HOT"] = "hot";
    /** Warm: Occasionally accessed, local disk */
    StorageTier["WARM"] = "warm";
    /** Cold: Rarely accessed, replicated remote storage */
    StorageTier["COLD"] = "cold";
})(StorageTier || (exports.StorageTier = StorageTier = {}));
/** Permission levels for file access */
var Permission;
(function (Permission) {
    /** Read-only access */
    Permission["READ"] = "read";
    /** Write access (includes read) */
    Permission["WRITE"] = "write";
    /** Admin access (includes read, write, delete, share) */
    Permission["ADMIN"] = "admin";
})(Permission || (exports.Permission = Permission = {}));
// ============================================================================
// ERROR CLASSES
// ============================================================================
class ClawFSError extends Error {
    code;
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = 'ClawFSError';
    }
}
exports.ClawFSError = ClawFSError;
class FileNotFoundError extends ClawFSError {
    constructor(cid) {
        super(`File not found: ${cid}`, 'FILE_NOT_FOUND');
        this.name = 'FileNotFoundError';
    }
}
exports.FileNotFoundError = FileNotFoundError;
class PermissionDeniedError extends ClawFSError {
    constructor(agentId, cid, required) {
        super(`Agent ${agentId} lacks ${required} permission for ${cid}`, 'PERMISSION_DENIED');
        this.name = 'PermissionDeniedError';
    }
}
exports.PermissionDeniedError = PermissionDeniedError;
class StorageTierError extends ClawFSError {
    constructor(message) {
        super(message, 'STORAGE_TIER_ERROR');
        this.name = 'StorageTierError';
    }
}
exports.StorageTierError = StorageTierError;
// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
/** Compute SHA-256 CID for content */
function computeCID(data) {
    return (0, crypto_1.createHash)('sha256').update(data).digest('hex');
}
/** Compute Merkle tree root from blocks */
function computeMerkleRoot(blocks) {
    if (blocks.length === 0) {
        return (0, crypto_1.createHash)('sha256').update('').digest('hex');
    }
    // Build tree bottom-up
    let level = blocks.map(hash => ({ hash }));
    while (level.length > 1) {
        const nextLevel = [];
        for (let i = 0; i < level.length; i += 2) {
            const left = level[i];
            const right = level[i + 1] || left; // Duplicate last if odd
            const combined = (0, crypto_1.createHash)('sha256')
                .update(left.hash + right.hash)
                .digest('hex');
            nextLevel.push({ hash: combined, left, right });
        }
        level = nextLevel;
    }
    return level[0].hash;
}
/** Chunk data into blocks for storage */
function chunkData(data, blockSize = 1024 * 1024) {
    const chunks = [];
    for (let i = 0; i < data.length; i += blockSize) {
        chunks.push(data.subarray(i, i + blockSize));
    }
    return chunks.length > 0 ? chunks : [Buffer.alloc(0)];
}
// ============================================================================
// MEMORY BACKEND (for demo/testing - production would use persistent storage)
// ============================================================================
class MemoryStorageBackend {
    hot = new Map();
    warm = new Map();
    cold = new Map();
    accessStats = new Map();
    async get(cid) {
        for (const tier of [this.hot, this.warm, this.cold]) {
            if (tier.has(cid)) {
                const stats = this.accessStats.get(cid) || { count: 0, lastAccessed: new Date() };
                stats.count++;
                stats.lastAccessed = new Date();
                this.accessStats.set(cid, stats);
                return tier.get(cid);
            }
        }
        return null;
    }
    async put(cid, data, tier) {
        const target = tier === StorageTier.HOT ? this.hot : tier === StorageTier.WARM ? this.warm : this.cold;
        target.set(cid, Buffer.from(data)); // Copy to prevent external mutation
        this.accessStats.set(cid, { count: 0, lastAccessed: new Date() });
    }
    async delete(cid) {
        this.hot.delete(cid);
        this.warm.delete(cid);
        this.cold.delete(cid);
        this.accessStats.delete(cid);
    }
    async exists(cid) {
        return this.hot.has(cid) || this.warm.has(cid) || this.cold.has(cid);
    }
    async promote(cid, toTier) {
        const data = await this.get(cid);
        if (!data)
            throw new FileNotFoundError(cid);
        // Remove from all tiers
        this.hot.delete(cid);
        this.warm.delete(cid);
        this.cold.delete(cid);
        // Put in target tier
        await this.put(cid, data, toTier);
    }
    async demote(cid, toTier) {
        await this.promote(cid, toTier); // Same logic: remove + re-add
    }
    getTier(cid) {
        if (this.hot.has(cid))
            return StorageTier.HOT;
        if (this.warm.has(cid))
            return StorageTier.WARM;
        if (this.cold.has(cid))
            return StorageTier.COLD;
        return null;
    }
    getStats(cid) {
        return this.accessStats.get(cid);
    }
}
exports.MemoryStorageBackend = MemoryStorageBackend;
// ============================================================================
// SEARCH INDEX
// ============================================================================
class SearchIndex {
    index = new Map(); // term -> CIDs
    metadata = new Map();
    indexFile(cid, metadata, content) {
        this.metadata.set(cid, metadata);
        // Index metadata fields
        const terms = new Set();
        metadata.name.toLowerCase().split(/\s+/).forEach(t => terms.add(t));
        metadata.tags.forEach(tag => tag.toLowerCase().split(/\s+/).forEach(t => terms.add(t)));
        // Index content if provided (simplified - production would use vector embeddings)
        if (content) {
            content.toLowerCase().split(/\s+/).forEach(t => {
                if (t.length > 2)
                    terms.add(t);
            });
        }
        terms.forEach(term => {
            const cids = this.index.get(term) || [];
            if (!cids.includes(cid)) {
                cids.push(cid);
                this.index.set(term, cids);
            }
        });
    }
    removeFile(cid) {
        this.metadata.delete(cid);
        this.index.forEach((cids, term) => {
            const filtered = cids.filter(c => c !== cid);
            if (filtered.length === 0) {
                this.index.delete(term);
            }
            else {
                this.index.set(term, filtered);
            }
        });
    }
    search(query, limit = 10) {
        const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0);
        const scores = new Map();
        const highlights = new Map();
        queryTerms.forEach(term => {
            this.index.forEach((cids, indexedTerm) => {
                if (indexedTerm.includes(term) || term.includes(indexedTerm)) {
                    cids.forEach(cid => {
                        const score = (scores.get(cid) || 0) + (indexedTerm === term ? 2 : 1);
                        scores.set(cid, score);
                        const hl = highlights.get(cid) || new Set();
                        hl.add(indexedTerm);
                        highlights.set(cid, hl);
                    });
                }
            });
        });
        return Array.from(scores.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([cid, score]) => ({
            cid,
            score,
            highlights: Array.from(highlights.get(cid) || []),
            metadata: this.metadata.get(cid),
        }));
    }
}
exports.SearchIndex = SearchIndex;
// ============================================================================
// CLAWFS CLIENT
// ============================================================================
class ClawFSClient {
    agentId;
    backend;
    fileIndex = new Map();
    snapshots = [];
    searchIndex = new SearchIndex();
    config;
    constructor(config, backend) {
        this.config = config;
        this.agentId = config.agentId;
        this.backend = backend || new MemoryStorageBackend();
    }
    // ==========================================================================
    // CORE OPERATIONS
    // ==========================================================================
    /**
     * Store a file and return its Content Identifier (CID)
     *
     * @param data - File content as Buffer
     * @param metadata - File metadata
     * @param options - Storage options
     * @returns The CID of the stored file
     */
    async write(data, metadata = {}, options = {}) {
        const tier = options.tier || this.inferTier(data.length);
        const now = new Date();
        // Chunk data
        const chunks = chunkData(data);
        const blockCIDs = [];
        // Store each chunk
        for (const chunk of chunks) {
            const blockCID = computeCID(chunk);
            if (!(await this.backend.exists(blockCID))) {
                await this.backend.put(blockCID, chunk, tier);
            }
            blockCIDs.push(blockCID);
        }
        // Compute root CID from full data
        const cid = computeCID(data);
        const merkleRoot = computeMerkleRoot(blockCIDs);
        // Build file entry
        const fileEntry = {
            cid,
            owner: this.agentId,
            metadata: {
                name: metadata.name || 'unnamed',
                mimeType: metadata.mimeType || 'application/octet-stream',
                size: data.length,
                createdAt: metadata.createdAt || now,
                modifiedAt: now,
                tags: metadata.tags || [],
                encryptionKeyId: options.encrypt ? this.generateKeyId() : undefined,
                compression: options.compress ? 'gzip' : undefined,
            },
            tier,
            accessControl: [{
                    agentId: this.agentId,
                    permission: Permission.ADMIN,
                    grantedAt: now,
                    grantedBy: this.agentId,
                }],
            merkleRoot,
            blocks: blockCIDs,
            replicationFactor: options.replicationFactor || this.config.replicationFactor,
            lastAccessedAt: now,
            accessCount: 0,
        };
        // Index file
        this.fileIndex.set(cid, fileEntry);
        this.searchIndex.indexFile(cid, fileEntry.metadata);
        return cid;
    }
    /**
     * Retrieve a file by its CID
     *
     * @param cid - Content Identifier
     * @param requesterAgentId - Optional agent ID for permission check (defaults to current agent)
     * @returns File content as Buffer
     */
    async read(cid, requesterAgentId) {
        const agentId = requesterAgentId || this.agentId;
        const entry = this.fileIndex.get(cid);
        if (!entry) {
            throw new FileNotFoundError(cid);
        }
        // Check permission
        if (!this.hasPermission(agentId, entry, Permission.READ)) {
            throw new PermissionDeniedError(agentId, cid, Permission.READ);
        }
        // Retrieve blocks
        const chunks = [];
        for (const blockCID of entry.blocks) {
            const chunk = await this.backend.get(blockCID);
            if (!chunk) {
                throw new ClawFSError(`Block ${blockCID} missing for file ${cid}`, 'BLOCK_MISSING');
            }
            chunks.push(chunk);
        }
        // Update access stats
        entry.lastAccessedAt = new Date();
        entry.accessCount++;
        // Auto-promote hot files
        if (entry.tier !== StorageTier.HOT && entry.accessCount > 10) {
            await this.promoteToTier(cid, StorageTier.HOT);
        }
        return Buffer.concat(chunks);
    }
    /**
     * Share a file with other agents
     *
     * @param cid - Content Identifier
     * @param agentIds - Array of agent IDs to share with
     * @param permission - Permission level to grant
     * @returns The updated FileEntry
     */
    async share(cid, agentIds, permission = Permission.READ) {
        const entry = this.fileIndex.get(cid);
        if (!entry) {
            throw new FileNotFoundError(cid);
        }
        // Check current agent has admin permission
        if (!this.hasPermission(this.agentId, entry, Permission.ADMIN)) {
            throw new PermissionDeniedError(this.agentId, cid, Permission.ADMIN);
        }
        const now = new Date();
        for (const agentId of agentIds) {
            // Remove existing permission for this agent
            entry.accessControl = entry.accessControl.filter(ac => ac.agentId !== agentId);
            // Add new permission
            entry.accessControl.push({
                agentId,
                permission,
                grantedAt: now,
                grantedBy: this.agentId,
            });
        }
        return entry;
    }
    /**
     * List files accessible to the current agent
     *
     * @param options - Filter options
     * @returns Array of FileEntry objects
     */
    async list(options = {}) {
        let files = Array.from(this.fileIndex.values());
        // Filter by ownership if requested
        if (options.ownedOnly) {
            files = files.filter(f => f.owner === this.agentId);
        }
        else {
            // Filter by permission
            files = files.filter(f => this.hasPermission(this.agentId, f, Permission.READ));
        }
        // Filter by tier
        if (options.tier) {
            files = files.filter(f => f.tier === options.tier);
        }
        // Filter by tags
        if (options.tags && options.tags.length > 0) {
            files = files.filter(f => options.tags.some(tag => f.metadata.tags.includes(tag)));
        }
        // Sort by last accessed (most recent first)
        files.sort((a, b) => b.lastAccessedAt.getTime() - a.lastAccessedAt.getTime());
        // Apply pagination
        const offset = options.offset || 0;
        const limit = options.limit || files.length;
        return files.slice(offset, offset + limit);
    }
    /**
     * Create a Merkle-backed snapshot of the current file system state
     *
     * @param options - Snapshot options
     * @returns The created Snapshot
     */
    async snapshot(options = {}) {
        let files = Array.from(this.fileIndex.values());
        // Apply filters
        if (options.includeFiles) {
            const includeSet = new Set(options.includeFiles);
            files = files.filter(f => includeSet.has(f.cid));
        }
        if (options.excludeFiles) {
            const excludeSet = new Set(options.excludeFiles);
            files = files.filter(f => !excludeSet.has(f.cid));
        }
        // Build snapshot Merkle tree
        const fileRoots = files.map(f => f.merkleRoot).sort();
        const merkleRoot = computeMerkleRoot(fileRoots);
        const snapshot = {
            id: (0, crypto_1.randomUUID)(),
            timestamp: new Date(),
            merkleRoot,
            fileCount: files.length,
            totalSize: files.reduce((sum, f) => sum + f.metadata.size, 0),
            previousSnapshot: this.snapshots.length > 0
                ? this.snapshots[this.snapshots.length - 1].id
                : undefined,
            includedFiles: files.map(f => f.cid),
        };
        this.snapshots.push(snapshot);
        return snapshot;
    }
    /**
     * Semantic search across files
     *
     * @param query - Search query string
     * @param options - Search options
     * @returns Array of SearchResult objects
     */
    async search(query, options = {}) {
        const limit = options.limit || 10;
        // Get search results
        let results = this.searchIndex.search(query, limit * 2); // Get extra for filtering
        // Filter by tags if specified
        if (options.tags && options.tags.length > 0) {
            results = results.filter(r => options.tags.some(tag => r.metadata.tags.includes(tag)));
        }
        // Filter to only files we have permission to read
        results = results.filter(r => {
            const entry = this.fileIndex.get(r.cid);
            return entry && this.hasPermission(this.agentId, entry, Permission.READ);
        });
        return results.slice(0, limit);
    }
    // ==========================================================================
    // ADVANCED OPERATIONS
    // ==========================================================================
    /**
     * Change the storage tier of a file
     *
     * @param cid - Content Identifier
     * @param tier - Target storage tier
     */
    async setTier(cid, tier) {
        const entry = this.fileIndex.get(cid);
        if (!entry) {
            throw new FileNotFoundError(cid);
        }
        if (!this.hasPermission(this.agentId, entry, Permission.WRITE)) {
            throw new PermissionDeniedError(this.agentId, cid, Permission.WRITE);
        }
        for (const blockCID of entry.blocks) {
            await this.backend.promote(blockCID, tier);
        }
        entry.tier = tier;
    }
    /**
     * Delete a file (requires ADMIN permission)
     *
     * @param cid - Content Identifier
     */
    async delete(cid) {
        const entry = this.fileIndex.get(cid);
        if (!entry) {
            throw new FileNotFoundError(cid);
        }
        if (!this.hasPermission(this.agentId, entry, Permission.ADMIN)) {
            throw new PermissionDeniedError(this.agentId, cid, Permission.ADMIN);
        }
        // Delete blocks
        for (const blockCID of entry.blocks) {
            // Check if block is used by other files before deleting
            const usedByOthers = Array.from(this.fileIndex.values()).some(f => f.cid !== cid && f.blocks.includes(blockCID));
            if (!usedByOthers) {
                await this.backend.delete(blockCID);
            }
        }
        // Remove from indices
        this.fileIndex.delete(cid);
        this.searchIndex.removeFile(cid);
    }
    /**
     * Get file entry metadata without reading content
     *
     * @param cid - Content Identifier
     * @returns FileEntry if found and accessible
     */
    async stat(cid) {
        const entry = this.fileIndex.get(cid);
        if (!entry)
            return null;
        if (!this.hasPermission(this.agentId, entry, Permission.READ)) {
            return null;
        }
        return entry;
    }
    /**
     * Get all snapshots
     *
     * @returns Array of snapshots
     */
    async getSnapshots() {
        return [...this.snapshots];
    }
    /**
     * Verify file integrity using Merkle tree
     *
     * @param cid - Content Identifier
     * @returns True if file is valid
     */
    async verify(cid) {
        const entry = this.fileIndex.get(cid);
        if (!entry)
            return false;
        try {
            const blockHashes = [];
            for (const blockCID of entry.blocks) {
                const chunk = await this.backend.get(blockCID);
                if (!chunk)
                    return false;
                blockHashes.push(computeCID(chunk)); // Verify block CID matches content
            }
            const computedRoot = computeMerkleRoot(blockHashes);
            return computedRoot === entry.merkleRoot;
        }
        catch {
            return false;
        }
    }
    // ==========================================================================
    // PRIVATE HELPERS
    // ==========================================================================
    inferTier(size) {
        if (size < 1024 * 1024)
            return StorageTier.HOT; // < 1MB
        if (size < 100 * 1024 * 1024)
            return StorageTier.WARM; // < 100MB
        return StorageTier.COLD;
    }
    hasPermission(agentId, entry, required) {
        const ac = entry.accessControl.find(a => a.agentId === agentId);
        if (!ac)
            return false;
        // Check expiration
        if (ac.expiresAt && ac.expiresAt < new Date()) {
            return false;
        }
        const levels = [Permission.READ, Permission.WRITE, Permission.ADMIN];
        const requiredIdx = levels.indexOf(required);
        const grantedIdx = levels.indexOf(ac.permission);
        return grantedIdx >= requiredIdx;
    }
    async promoteToTier(cid, tier) {
        const entry = this.fileIndex.get(cid);
        if (!entry || entry.tier === tier)
            return;
        for (const blockCID of entry.blocks) {
            await this.backend.promote(blockCID, tier);
        }
        entry.tier = tier;
    }
    generateKeyId() {
        return `key-${(0, crypto_1.randomUUID)()}`;
    }
    // ==========================================================================
    // PERSISTENCE (for crash recovery)
    // ==========================================================================
    /**
     * Export file system state for persistence
     *
     * @returns Serialized state
     */
    exportState() {
        return {
            agentId: this.agentId,
            files: Array.from(this.fileIndex.entries()),
            snapshots: this.snapshots,
            config: this.config,
            exportedAt: new Date().toISOString(),
        };
    }
    /**
     * Import file system state (for recovery after crash)
     *
     * @param state - Serialized state
     */
    importState(state) {
        this.fileIndex = new Map(state.files);
        this.snapshots = state.snapshots;
        // Rebuild search index
        this.searchIndex = new SearchIndex();
        for (const [cid, entry] of this.fileIndex.entries()) {
            this.searchIndex.indexFile(cid, entry.metadata);
        }
    }
}
exports.ClawFSClient = ClawFSClient;
// ============================================================================
// EXPORTS
// ============================================================================
exports.default = ClawFSClient;
//# sourceMappingURL=clawfs.js.map