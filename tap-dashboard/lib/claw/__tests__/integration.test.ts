/**
 * Integration Test Suite: ClawFS + Core Systems
 * Verifies connectivity between ClawFS, ClawBus, ClawKernel, Arbitra, TAP
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ClawFSService } from '../lib/claw/fs';
import { ClawBus } from '../lib/claw/bus';
import { ClawKernel } from '../lib/claw/kernel';
import { ClawFSIntegrations } from '../lib/claw/fs/integration';

// Test configuration
const TEST_AGENT_1 = 'test-agent-001';
const TEST_AGENT_2 = 'test-agent-002';
const ARBITRA_AGENT = 'arbitra:system';
const TAP_AGENT = 'tap:system';

describe('ClawFS Integration Tests', () => {
  let supabase: SupabaseClient;
  let fs: ClawFSService;
  let bus: ClawBus;
  let kernel: ClawKernel;
  let integrations: ClawFSIntegrations;

  beforeAll(async () => {
    // Initialize clients
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    fs = new ClawFSService(supabase);
    bus = new ClawBus(supabase);
    kernel = new ClawKernel(supabase);
    integrations = new ClawFSIntegrations(fs, bus, kernel);
  });

  afterAll(async () => {
    // Cleanup test data
    await supabase.from('claw_files').delete().eq('owner_id', TEST_AGENT_1);
    await supabase.from('claw_files').delete().eq('owner_id', TEST_AGENT_2);
  });

  // =========================================================================
  // Test 1: Basic ClawFS Operations
  // =========================================================================
  describe('ClawFS Core Operations', () => {
    it('should store and retrieve a file with CID', async () => {
      const content = 'Test content for CID verification';
      const file = await fs.store(TEST_AGENT_1, content, {
        name: 'test-file.txt',
        mimeType: 'text/plain'
      });

      expect(file.id).toBeDefined();
      expect(file.cid).toBeDefined();
      expect(file.cid.length).toBe(64); // SHA-256 hex

      const retrieved = await fs.retrieve(TEST_AGENT_1, file.id);
      expect(retrieved.content).toBe(content);
      expect(retrieved.cid).toBe(file.cid);
    });

    it('should create immutable version history', async () => {
      const file = await fs.store(TEST_AGENT_1, 'Version 1', {
        name: 'versioned-file.txt',
        mimeType: 'text/plain'
      });

      // Update creates new version
      const updated = await fs.update(TEST_AGENT_1, file.id, 'Version 2');
      expect(updated.version).toBe(2);
      expect(updated.parentId).toBe(file.id);

      const versions = await fs.getVersionHistory(file.id);
      expect(versions.length).toBeGreaterThanOrEqual(2);
    });

    it('should support semantic search', async () => {
      await fs.store(TEST_AGENT_1, 'Machine learning is amazing', {
        name: 'ml-notes.txt',
        mimeType: 'text/plain',
        tags: ['ai', 'ml']
      });

      await fs.store(TEST_AGENT_1, 'Deep learning neural networks', {
        name: 'dl-notes.txt',
        mimeType: 'text/plain',
        tags: ['ai', 'deep-learning']
      });

      const results = await fs.search(TEST_AGENT_1, 'artificial intelligence');
      expect(results.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Test 2: Agent-to-Agent Permissions
  // =========================================================================
  describe('Agent Permission System', () => {
    it('should allow sharing files between agents', async () => {
      const file = await fs.store(TEST_AGENT_1, 'Shared content', {
        name: 'shared.txt',
        mimeType: 'text/plain'
      });

      await fs.share(TEST_AGENT_1, file.id, TEST_AGENT_2, {
        agentId: TEST_AGENT_2,
        canRead: true,
        canWrite: false,
        canDelete: false,
        canShare: false,
        grantedAt: new Date(),
        grantedBy: TEST_AGENT_1
      });

      // Agent 2 can read
      const retrieved = await fs.retrieve(TEST_AGENT_2, file.id);
      expect(retrieved.content).toBe('Shared content');

      // Agent 2 cannot write (should throw)
      await expect(
        fs.update(TEST_AGENT_2, file.id, 'Modified by agent 2')
      ).rejects.toThrow();
    });

    it('should enforce time-bound permissions', async () => {
      const file = await fs.store(TEST_AGENT_1, 'Time-limited content', {
        name: 'temp.txt',
        mimeType: 'text/plain'
      });

      // Grant access that expires in 1 second
      await fs.share(TEST_AGENT_1, file.id, TEST_AGENT_2, {
        agentId: TEST_AGENT_2,
        canRead: true,
        canWrite: false,
        canDelete: false,
        canShare: false,
        grantedAt: new Date(),
        grantedBy: TEST_AGENT_1,
        expiresAt: new Date(Date.now() + 1000) // 1 second
      });

      // Should work immediately
      await expect(fs.retrieve(TEST_AGENT_2, file.id)).resolves.toBeDefined();

      // Wait for expiration
      await new Promise(r => setTimeout(r, 1500));

      // Should fail after expiration
      await expect(fs.retrieve(TEST_AGENT_2, file.id)).rejects.toThrow();
    });
  });

  // =========================================================================
  // Test 3: ClawBus Integration
  // =========================================================================
  describe('ClawBus Integration', () => {
    it('should broadcast file store events', async () => {
      const events: any[] = [];
      
      // Subscribe to events
      await integrations.bus.subscribeToFileEvents(TEST_AGENT_1, (event) => {
        events.push(event);
      });

      // Store file with broadcast
      await integrations.bus.storeAndBroadcast(
        TEST_AGENT_1,
        'Broadcast test content',
        { name: 'broadcast.txt', mimeType: 'text/plain' }
      );

      // Wait for event propagation
      await new Promise(r => setTimeout(r, 500));

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].type).toBe('file_stored');
    });

    it('should notify recipients on share', async () => {
      const file = await fs.store(TEST_AGENT_1, 'Share notification test', {
        name: 'share-test.txt',
        mimeType: 'text/plain'
      });

      // Share and notify
      await integrations.bus.shareAndNotify(
        TEST_AGENT_1,
        file.id,
        TEST_AGENT_2,
        {
          agentId: TEST_AGENT_2,
          canRead: true,
          canWrite: false,
          canDelete: false,
          canShare: false,
          grantedAt: new Date(),
          grantedBy: TEST_AGENT_1
        }
      );

      // Check that notification was sent via bus
      const messages = await bus.poll(TEST_AGENT_2);
      const shareNotification = messages.find(m => m.type === 'file_shared');
      expect(shareNotification).toBeDefined();
    });
  });

  // =========================================================================
  // Test 4: ClawKernel Integration
  // =========================================================================
  describe('ClawKernel Integration', () => {
    it('should spawn process with FS access', async () => {
      const file = await fs.store(TEST_AGENT_1, 'Process input data', {
        name: 'input.txt',
        mimeType: 'text/plain'
      });

      const processId = await integrations.kernel.spawnWithFSAccess({
        name: 'test-process',
        command: 'cat',
        args: ['/mnt/clawfs/input.txt'],
        agentId: TEST_AGENT_1,
        mountFiles: [file.id],
        allowWrite: true
      });

      expect(processId).toBeDefined();

      // Cleanup
      await kernel.kill(processId);
    });

    it('should capture process output as file', async () => {
      // First spawn a simple process
      const processId = await kernel.spawn({
        name: 'output-test',
        command: 'echo',
        args: ['Process output captured']
      });

      // Wait for completion
      await new Promise(r => setTimeout(r, 1000));

      // Capture output as file
      const outputFile = await integrations.kernel.captureOutputAsFile(
        processId,
        TEST_AGENT_1,
        { name: 'process-output.txt', mimeType: 'text/plain' }
      );

      expect(outputFile).toBeDefined();
      expect(outputFile.metadata.source).toBe('process');
    });
  });

  // =========================================================================
  // Test 5: Arbitra Integration
  // =========================================================================
  describe('Arbitra Integration', () => {
    const DISPUTE_ID = 'test-dispute-001';

    it('should store dispute evidence immutably', async () => {
      const evidence = await integrations.arbitra.storeEvidence(
        DISPUTE_ID,
        TEST_AGENT_1,
        {
          evidenceType: 'file',
          content: JSON.stringify({ screenshot: 'base64data', timestamp: Date.now() }),
          metadata: { source: 'conversation', messageId: 'msg-123' },
          timestamp: new Date().toISOString()
        }
      );

      expect(evidence.id).toBeDefined();
      expect(evidence.metadata.disputeId).toBe(DISPUTE_ID);
      expect(evidence.metadata.immutable).toBe(true);
    });

    it('should retrieve all evidence for a dispute', async () => {
      // Add multiple pieces of evidence
      await integrations.arbitra.storeEvidence(DISPUTE_ID, TEST_AGENT_1, {
        evidenceType: 'log',
        content: 'Transaction log entry',
        metadata: {},
        timestamp: new Date().toISOString()
      });

      await integrations.arbitra.storeEvidence(DISPUTE_ID, TEST_AGENT_2, {
        evidenceType: 'message',
        content: 'Chat transcript',
        metadata: {},
        timestamp: new Date().toISOString()
      });

      const evidence = await integrations.arbitra.getDisputeEvidence(DISPUTE_ID);
      expect(evidence.length).toBeGreaterThanOrEqual(2);
    });

    it('should store verdict with full reasoning', async () => {
      const verdict = await integrations.arbitra.storeVerdict(DISPUTE_ID, {
        decision: 'upheld',
        reasoning: 'Evidence clearly shows contract violation',
        penalties: [{ agentId: TEST_AGENT_2, karma: -50 }],
        restitution: { from: TEST_AGENT_2, to: TEST_AGENT_1, amount: 100 }
      });

      expect(verdict.metadata.evidenceType).toBe('verdict');
      
      // Verify content
      const retrieved = await fs.retrieve(ARBITRA_AGENT, verdict.id);
      const verdictData = JSON.parse(retrieved.content as string);
      expect(verdictData.verdict.decision).toBe('upheld');
    });
  });

  // =========================================================================
  // Test 6: TAP Integration
  // =========================================================================
  describe('TAP Integration', () => {
    it('should store attestation with proof', async () => {
      const attestation = {
        attestationId: 'attest-001',
        attesterId: TEST_AGENT_1,
        targetAgentId: TEST_AGENT_2,
        claim: 'Completed task successfully',
        proof: 'signature:abc123',
        timestamp: new Date().toISOString()
      };

      const file = await integrations.tap.storeAttestation(attestation);

      expect(file.metadata.attestationId).toBe('attest-001');
      expect(file.metadata.targetAgentId).toBe(TEST_AGENT_2);
      expect(file.tags).toContain('attestation');
    });

    it('should retrieve all attestations for an agent', async () => {
      // Create multiple attestations
      await integrations.tap.storeAttestation({
        attestationId: 'attest-002',
        attesterId: TEST_AGENT_1,
        targetAgentId: TEST_AGENT_2,
        claim: 'High quality work',
        timestamp: new Date().toISOString()
      });

      await integrations.tap.storeAttestation({
        attestationId: 'attest-003',
        attesterId: TEST_AGENT_2,
        targetAgentId: TEST_AGENT_2,
        claim: 'Self-attestation',
        timestamp: new Date().toISOString()
      });

      const attestations = await integrations.tap.getAgentAttestations(TEST_AGENT_2);
      expect(attestations.length).toBeGreaterThanOrEqual(2);
    });

    it('should store reputation audit trail', async () => {
      const audit = await integrations.tap.storeReputationAudit(TEST_AGENT_1, {
        type: 'karma_change',
        amount: 25,
        reason: 'Positive attestation received',
        triggeredBy: TAP_AGENT
      });

      expect(audit.metadata.eventType).toBe('karma_change');
      expect(audit.metadata.immutable).toBe(true);
    });
  });

  // =========================================================================
  // Test 7: End-to-End Workflow
  // =========================================================================
  describe('End-to-End Multi-Agent Workflow', () => {
    it('should complete full dispute resolution workflow', async () => {
      // 1. Agent 1 creates a contract document
      const contract = await fs.store(TEST_AGENT_1, 'Contract terms...', {
        name: 'contract-v1.md',
        mimeType: 'text/markdown',
        tags: ['contract', 'legal']
      });

      // 2. Agent 1 shares with Agent 2
      await fs.share(TEST_AGENT_1, contract.id, TEST_AGENT_2, {
        agentId: TEST_AGENT_2,
        canRead: true,
        canWrite: true, // Allow collaboration
        canDelete: false,
        canShare: false,
        grantedAt: new Date(),
        grantedBy: TEST_AGENT_1
      });

      // 3. Agent 2 makes changes (creates new version)
      const updated = await fs.update(TEST_AGENT_2, contract.id, 'Contract terms (Agent 2 edits)...');
      expect(updated.version).toBe(2);

      // 4. Dispute arises - Agent 1 submits evidence
      const evidence1 = await integrations.arbitra.storeEvidence(
        'workflow-dispute-001',
        TEST_AGENT_1,
        {
          evidenceType: 'file',
          content: 'Original contract terms',
          metadata: { originalContractId: contract.id },
          timestamp: new Date().toISOString()
        }
      );

      // 5. Agent 2 submits counter-evidence
      const evidence2 = await integrations.arbitra.storeEvidence(
        'workflow-dispute-001',
        TEST_AGENT_2,
        {
          evidenceType: 'message',
          content: 'Agreement to modify terms',
          metadata: { conversationId: 'conv-123' },
          timestamp: new Date().toISOString()
        }
      );

      // 6. Attestations from witnesses
      await integrations.tap.storeAttestation({
        attestationId: 'witness-001',
        attesterId: 'witness-agent',
        targetAgentId: TEST_AGENT_1,
        claim: 'Witnessed original agreement',
        timestamp: new Date().toISOString()
      });

      // 7. Arbitra renders verdict
      const verdict = await integrations.arbitra.storeVerdict('workflow-dispute-001', {
        decision: 'split',
        reasoning: 'Both parties contributed to misunderstanding',
        penalties: [
          { agentId: TEST_AGENT_1, karma: -10 },
          { agentId: TEST_AGENT_2, karma: -10 }
        ]
      });

      // 8. Verify all data is linked
      const disputeEvidence = await integrations.arbitra.getDisputeEvidence('workflow-dispute-001');
      expect(disputeEvidence.length).toBeGreaterThanOrEqual(2);

      // 9. Export dispute package
      const packageFile = await integrations.arbitra.exportDisputePackage('workflow-dispute-001');
      expect(packageFile.metadata.packageType).toBe('export');
    });
  });
});
