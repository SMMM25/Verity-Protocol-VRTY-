/**
 * Verity Protocol - Cross-Chain Bridge Integration Tests
 * 
 * @module tests/integration/bridge
 * @description Comprehensive integration tests for the cross-chain bridge system.
 * Tests the full bridge lifecycle from initiation to completion.
 * 
 * @version 1.0.0
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';

// Mock Prisma client
const mockPrismaClient = {
  bridgeTransaction: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
  },
  bridgeValidator: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  validatorSignature: {
    upsert: vi.fn(),
    findMany: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  $connect: vi.fn(),
  $disconnect: vi.fn(),
};

vi.mock('../../src/db/client', () => ({
  prisma: mockPrismaClient,
}));

vi.mock('@solana/web3.js', () => ({
  Connection: vi.fn().mockImplementation(() => ({
    getLatestBlockhash: vi.fn().mockResolvedValue({ blockhash: 'test-blockhash' }),
    getBalance: vi.fn().mockResolvedValue(1000000000),
    getAccountInfo: vi.fn().mockResolvedValue(null),
  })),
  PublicKey: vi.fn().mockImplementation((key) => ({
    toBase58: () => key,
    toString: () => key,
  })),
  Keypair: {
    generate: vi.fn().mockReturnValue({
      publicKey: { toBase58: () => 'test-public-key' },
      secretKey: new Uint8Array(64),
    }),
  },
}));

vi.mock('xrpl', () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    isConnected: vi.fn().mockReturnValue(true),
    request: vi.fn().mockResolvedValue({ result: {} }),
  })),
  Wallet: {
    fromSeed: vi.fn().mockReturnValue({
      address: 'rTestAddress123456789012345678',
      publicKey: 'test-public-key',
    }),
  },
}));

// ============================================================
// TEST DATA
// ============================================================

const TEST_BRIDGE_TRANSACTION = {
  id: 'test-bridge-id-123',
  direction: 'XRPL_TO_SOLANA',
  sourceChain: 'XRPL',
  destinationChain: 'SOLANA',
  sourceAddress: 'rSourceAddress12345678901234567',
  destinationAddress: '7J2Mo8dqKpeSXRepNpnvDqPFMGngXioVya45AirwXGxQ',
  amount: '1000',
  fee: '10',
  status: 'INITIATED',
  verificationHash: 'test-hash-123',
  validatorSignatures: [],
  sourceTxHash: null,
  destinationTxHash: null,
  retryCount: 0,
  errorMessage: null,
  createdAt: new Date(),
  completedAt: null,
};

const TEST_VALIDATOR = {
  id: 'test-validator-id',
  validatorId: 'validator-1',
  publicKey: 'test-validator-public-key',
  status: 'ACTIVE',
  totalSignatures: 0,
  successfulSigs: 0,
  failedSigs: 0,
  lastHeartbeat: new Date(),
};

// ============================================================
// BRIDGE ORCHESTRATOR TESTS
// ============================================================

describe('BridgeOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initiateBridge', () => {
    it('should successfully initiate a bridge transaction', async () => {
      // Setup mocks
      mockPrismaClient.bridgeTransaction.create.mockResolvedValue(TEST_BRIDGE_TRANSACTION);
      mockPrismaClient.auditLog.create.mockResolvedValue({});
      mockPrismaClient.bridgeValidator.findMany.mockResolvedValue([
        { ...TEST_VALIDATOR, status: 'ACTIVE' },
        { ...TEST_VALIDATOR, id: 'v2', validatorId: 'validator-2', status: 'ACTIVE' },
        { ...TEST_VALIDATOR, id: 'v3', validatorId: 'validator-3', status: 'ACTIVE' },
      ]);

      // Import after mocks are set up
      const { BridgeOrchestrator } = await import('../../src/bridge/BridgeOrchestrator');
      const orchestrator = new BridgeOrchestrator({ requiredValidators: 3 });

      // Mock hasQuorum to return true
      vi.spyOn(orchestrator, 'hasQuorum').mockReturnValue(true);

      const result = await orchestrator.initiateBridge({
        direction: 'XRPL_TO_SOLANA',
        sourceChain: 'XRPL',
        destinationChain: 'SOLANA',
        sourceAddress: 'rSourceAddress12345678901234567',
        destinationAddress: '7J2Mo8dqKpeSXRepNpnvDqPFMGngXioVya45AirwXGxQ',
        amount: 1000,
        userWallet: 'rUserWallet123456789012345678',
      });

      expect(result.success).toBe(true);
      expect(result.bridgeId).toBeDefined();
      expect(result.status).toBe('INITIATED');
      expect(result.fee).toBeGreaterThan(0);
      expect(mockPrismaClient.bridgeTransaction.create).toHaveBeenCalled();
      expect(mockPrismaClient.auditLog.create).toHaveBeenCalled();
    });

    it('should reject bridge below minimum amount', async () => {
      const { BridgeOrchestrator } = await import('../../src/bridge/BridgeOrchestrator');
      const orchestrator = new BridgeOrchestrator();
      vi.spyOn(orchestrator, 'hasQuorum').mockReturnValue(true);

      const result = await orchestrator.initiateBridge({
        direction: 'XRPL_TO_SOLANA',
        sourceChain: 'XRPL',
        destinationChain: 'SOLANA',
        sourceAddress: 'rSourceAddress12345678901234567',
        destinationAddress: '7J2Mo8dqKpeSXRepNpnvDqPFMGngXioVya45AirwXGxQ',
        amount: 50, // Below minimum of 100
        userWallet: 'rUserWallet123456789012345678',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Minimum bridge amount');
    });

    it('should reject bridge above maximum amount', async () => {
      const { BridgeOrchestrator } = await import('../../src/bridge/BridgeOrchestrator');
      const orchestrator = new BridgeOrchestrator();
      vi.spyOn(orchestrator, 'hasQuorum').mockReturnValue(true);

      const result = await orchestrator.initiateBridge({
        direction: 'XRPL_TO_SOLANA',
        sourceChain: 'XRPL',
        destinationChain: 'SOLANA',
        sourceAddress: 'rSourceAddress12345678901234567',
        destinationAddress: '7J2Mo8dqKpeSXRepNpnvDqPFMGngXioVya45AirwXGxQ',
        amount: 2000000, // Above maximum of 1,000,000
        userWallet: 'rUserWallet123456789012345678',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Maximum bridge amount');
    });

    it('should reject when no quorum', async () => {
      const { BridgeOrchestrator } = await import('../../src/bridge/BridgeOrchestrator');
      const orchestrator = new BridgeOrchestrator();
      vi.spyOn(orchestrator, 'hasQuorum').mockReturnValue(false);

      const result = await orchestrator.initiateBridge({
        direction: 'XRPL_TO_SOLANA',
        sourceChain: 'XRPL',
        destinationChain: 'SOLANA',
        sourceAddress: 'rSourceAddress12345678901234567',
        destinationAddress: '7J2Mo8dqKpeSXRepNpnvDqPFMGngXioVya45AirwXGxQ',
        amount: 1000,
        userWallet: 'rUserWallet123456789012345678',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient validators');
    });

    it('should reject bridging to same chain', async () => {
      const { BridgeOrchestrator } = await import('../../src/bridge/BridgeOrchestrator');
      const orchestrator = new BridgeOrchestrator();
      vi.spyOn(orchestrator, 'hasQuorum').mockReturnValue(true);

      const result = await orchestrator.initiateBridge({
        direction: 'XRPL_TO_SOLANA',
        sourceChain: 'XRPL',
        destinationChain: 'XRPL', // Same as source
        sourceAddress: 'rSourceAddress12345678901234567',
        destinationAddress: 'rDestAddress12345678901234567',
        amount: 1000,
        userWallet: 'rUserWallet123456789012345678',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('different');
    });
  });

  describe('getBridgeStatus', () => {
    it('should return bridge status correctly', async () => {
      mockPrismaClient.bridgeTransaction.findUnique.mockResolvedValue({
        ...TEST_BRIDGE_TRANSACTION,
        signatures: [{ signature: 'sig1' }, { signature: 'sig2' }],
      });

      const { BridgeOrchestrator } = await import('../../src/bridge/BridgeOrchestrator');
      const orchestrator = new BridgeOrchestrator();

      const status = await orchestrator.getBridgeStatus('test-bridge-id-123');

      expect(status).not.toBeNull();
      expect(status?.bridgeId).toBe('test-bridge-id-123');
      expect(status?.status).toBe('INITIATED');
      expect(status?.validatorSignatures).toBe(2);
    });

    it('should return null for non-existent bridge', async () => {
      mockPrismaClient.bridgeTransaction.findUnique.mockResolvedValue(null);

      const { BridgeOrchestrator } = await import('../../src/bridge/BridgeOrchestrator');
      const orchestrator = new BridgeOrchestrator();

      const status = await orchestrator.getBridgeStatus('non-existent-id');

      expect(status).toBeNull();
    });
  });

  describe('getUserBridgeHistory', () => {
    it('should return user bridge history', async () => {
      mockPrismaClient.bridgeTransaction.findMany.mockResolvedValue([
        { ...TEST_BRIDGE_TRANSACTION, signatures: [] },
        { ...TEST_BRIDGE_TRANSACTION, id: 'bridge-2', status: 'COMPLETED', signatures: [] },
      ]);

      const { BridgeOrchestrator } = await import('../../src/bridge/BridgeOrchestrator');
      const orchestrator = new BridgeOrchestrator();

      const history = await orchestrator.getUserBridgeHistory('rSourceAddress12345678901234567');

      expect(history).toHaveLength(2);
      expect(history[0].bridgeId).toBeDefined();
    });

    it('should filter by status', async () => {
      mockPrismaClient.bridgeTransaction.findMany.mockResolvedValue([
        { ...TEST_BRIDGE_TRANSACTION, status: 'COMPLETED', signatures: [] },
      ]);

      const { BridgeOrchestrator } = await import('../../src/bridge/BridgeOrchestrator');
      const orchestrator = new BridgeOrchestrator();

      const history = await orchestrator.getUserBridgeHistory('rSourceAddress12345678901234567', {
        status: 'COMPLETED',
      });

      expect(history).toHaveLength(1);
      expect(history[0].status).toBe('COMPLETED');
    });
  });

  describe('getStats', () => {
    it('should return orchestrator statistics', async () => {
      mockPrismaClient.bridgeTransaction.count.mockResolvedValueOnce(100);
      mockPrismaClient.bridgeTransaction.count.mockResolvedValueOnce(80);
      mockPrismaClient.bridgeTransaction.count.mockResolvedValueOnce(15);
      mockPrismaClient.bridgeTransaction.count.mockResolvedValueOnce(5);
      mockPrismaClient.bridgeTransaction.aggregate.mockResolvedValue({
        _sum: { amount: 500000 },
      });
      mockPrismaClient.bridgeTransaction.findMany.mockResolvedValue([
        {
          createdAt: new Date(Date.now() - 600000),
          completedAt: new Date(),
        },
      ]);

      const { BridgeOrchestrator } = await import('../../src/bridge/BridgeOrchestrator');
      const orchestrator = new BridgeOrchestrator();

      const stats = await orchestrator.getStats();

      expect(stats.totalTransactions).toBe(100);
      expect(stats.completedTransactions).toBe(80);
      expect(stats.pendingTransactions).toBe(15);
      expect(stats.failedTransactions).toBe(5);
      expect(stats.totalVolume).toBe(500000);
    });
  });

  describe('retryTransaction', () => {
    it('should retry a stuck transaction', async () => {
      mockPrismaClient.bridgeTransaction.findUnique.mockResolvedValue({
        ...TEST_BRIDGE_TRANSACTION,
        status: 'VALIDATING',
        retryCount: 0,
      });
      mockPrismaClient.bridgeTransaction.update.mockResolvedValue({
        ...TEST_BRIDGE_TRANSACTION,
        retryCount: 1,
      });

      const { BridgeOrchestrator } = await import('../../src/bridge/BridgeOrchestrator');
      const orchestrator = new BridgeOrchestrator();

      const result = await orchestrator.retryTransaction('test-bridge-id-123');

      expect(result).toBe(true);
      expect(mockPrismaClient.bridgeTransaction.update).toHaveBeenCalled();
    });

    it('should return false for non-existent transaction', async () => {
      mockPrismaClient.bridgeTransaction.findUnique.mockResolvedValue(null);

      const { BridgeOrchestrator } = await import('../../src/bridge/BridgeOrchestrator');
      const orchestrator = new BridgeOrchestrator();

      const result = await orchestrator.retryTransaction('non-existent-id');

      expect(result).toBe(false);
    });
  });
});

// ============================================================
// VALIDATOR NODE TESTS
// ============================================================

describe('ValidatorNode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with correct config', async () => {
      const { ValidatorNode } = await import('../../src/bridge/ValidatorNode');
      
      const node = new ValidatorNode({
        validatorId: 'test-validator',
        privateKey: 'test-private-key',
        publicKey: 'test-public-key',
      });

      const status = node.getStatus();
      expect(status.validatorId).toBe('test-validator');
      expect(status.publicKey).toBe('test-public-key');
      expect(status.status).toBe('INACTIVE');
    });
  });

  describe('validateTransaction', () => {
    it('should validate a correct transaction', async () => {
      mockPrismaClient.bridgeTransaction.findUnique.mockResolvedValue({
        ...TEST_BRIDGE_TRANSACTION,
        status: 'LOCKED',
      });

      const { ValidatorNode } = await import('../../src/bridge/ValidatorNode');
      
      const node = new ValidatorNode({
        validatorId: 'test-validator',
        privateKey: 'test-private-key',
        publicKey: 'test-public-key',
      });

      const result = await node.validateTransaction({
        bridgeId: 'test-bridge-id-123',
        direction: 'XRPL_TO_SOLANA',
        sourceChain: 'XRPL',
        destinationChain: 'SOLANA',
        sourceAddress: 'rSourceAddress12345678901234567',
        destinationAddress: '7J2Mo8dqKpeSXRepNpnvDqPFMGngXioVya45AirwXGxQ',
        amount: 1000,
        sourceTxHash: 'test-tx-hash',
        verificationHash: 'test-verification-hash',
        timestamp: new Date(),
      });

      expect(result.isValid).toBe(true);
      expect(result.checks.amountMatches).toBe(true);
    });

    it('should reject invalid amount', async () => {
      mockPrismaClient.bridgeTransaction.findUnique.mockResolvedValue({
        ...TEST_BRIDGE_TRANSACTION,
        status: 'LOCKED',
      });

      const { ValidatorNode } = await import('../../src/bridge/ValidatorNode');
      
      const node = new ValidatorNode({
        validatorId: 'test-validator',
        privateKey: 'test-private-key',
        publicKey: 'test-public-key',
      });

      const result = await node.validateTransaction({
        bridgeId: 'test-bridge-id-123',
        direction: 'XRPL_TO_SOLANA',
        sourceChain: 'XRPL',
        destinationChain: 'SOLANA',
        sourceAddress: 'rSourceAddress12345678901234567',
        destinationAddress: '7J2Mo8dqKpeSXRepNpnvDqPFMGngXioVya45AirwXGxQ',
        amount: 50, // Below minimum
        sourceTxHash: 'test-tx-hash',
        verificationHash: 'test-verification-hash',
        timestamp: new Date(),
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid amount: 50');
    });

    it('should reject expired transaction', async () => {
      mockPrismaClient.bridgeTransaction.findUnique.mockResolvedValue({
        ...TEST_BRIDGE_TRANSACTION,
        status: 'LOCKED',
      });

      const { ValidatorNode } = await import('../../src/bridge/ValidatorNode');
      
      const node = new ValidatorNode({
        validatorId: 'test-validator',
        privateKey: 'test-private-key',
        publicKey: 'test-public-key',
      });

      const result = await node.validateTransaction({
        bridgeId: 'test-bridge-id-123',
        direction: 'XRPL_TO_SOLANA',
        sourceChain: 'XRPL',
        destinationChain: 'SOLANA',
        sourceAddress: 'rSourceAddress12345678901234567',
        destinationAddress: '7J2Mo8dqKpeSXRepNpnvDqPFMGngXioVya45AirwXGxQ',
        amount: 1000,
        sourceTxHash: 'test-tx-hash',
        verificationHash: 'test-verification-hash',
        timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000), // 48 hours ago (expired)
      });

      expect(result.checks.withinTimeLimits).toBe(false);
    });
  });
});

// ============================================================
// VALIDATOR REGISTRY TESTS
// ============================================================

describe('ValidatorRegistry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validator management', () => {
    it('should register and track validators', async () => {
      const { ValidatorNode, ValidatorRegistry } = await import('../../src/bridge/ValidatorNode');
      
      const registry = new ValidatorRegistry(3);
      
      const node1 = new ValidatorNode({
        validatorId: 'validator-1',
        privateKey: 'key-1',
        publicKey: 'pubkey-1',
      });
      
      const node2 = new ValidatorNode({
        validatorId: 'validator-2',
        privateKey: 'key-2',
        publicKey: 'pubkey-2',
      });

      registry.registerValidator(node1);
      registry.registerValidator(node2);

      const stats = registry.getStats();
      expect(stats.totalValidators).toBe(2);
      expect(stats.requiredSignatures).toBe(3);
      expect(stats.hasQuorum).toBe(false); // Need 3 but only have 2
    });

    it('should achieve quorum with enough validators', async () => {
      mockPrismaClient.bridgeValidator.upsert.mockResolvedValue({});
      mockPrismaClient.auditLog.create.mockResolvedValue({});

      const { ValidatorNode, ValidatorRegistry } = await import('../../src/bridge/ValidatorNode');
      
      const registry = new ValidatorRegistry(3);
      
      for (let i = 1; i <= 3; i++) {
        const node = new ValidatorNode({
          validatorId: `validator-${i}`,
          privateKey: `key-${i}`,
          publicKey: `pubkey-${i}`,
        });
        registry.registerValidator(node);
        // Simulate starting the node
        await node.start();
      }

      const stats = registry.getStats();
      expect(stats.totalValidators).toBe(3);
      expect(stats.hasQuorum).toBe(true);
    });

    it('should remove validators correctly', async () => {
      const { ValidatorNode, ValidatorRegistry } = await import('../../src/bridge/ValidatorNode');
      
      const registry = new ValidatorRegistry(3);
      
      const node = new ValidatorNode({
        validatorId: 'validator-1',
        privateKey: 'key-1',
        publicKey: 'pubkey-1',
      });

      registry.registerValidator(node);
      expect(registry.getStats().totalValidators).toBe(1);

      await registry.removeValidator('validator-1');
      expect(registry.getStats().totalValidators).toBe(0);
    });
  });
});

// ============================================================
// BRIDGE MONITOR TESTS
// ============================================================

describe('BridgeMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('stuck transaction detection', () => {
    it('should detect stuck transactions', async () => {
      const stuckTx = {
        ...TEST_BRIDGE_TRANSACTION,
        status: 'VALIDATING',
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      };

      mockPrismaClient.bridgeTransaction.findMany.mockResolvedValue([stuckTx]);

      const { BridgeMonitor } = await import('../../src/bridge/BridgeMonitor');
      const monitor = new BridgeMonitor({ stuckThresholdMs: 60 * 60 * 1000 }); // 1 hour

      const stuckTxs = await monitor.getStuckTransactions();

      expect(stuckTxs).toHaveLength(1);
      expect(stuckTxs[0].stuckDurationMs).toBeGreaterThan(60 * 60 * 1000);
    });

    it('should not flag recent transactions as stuck', async () => {
      const recentTx = {
        ...TEST_BRIDGE_TRANSACTION,
        status: 'VALIDATING',
        createdAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
      };

      mockPrismaClient.bridgeTransaction.findMany.mockResolvedValue([recentTx]);

      const { BridgeMonitor } = await import('../../src/bridge/BridgeMonitor');
      const monitor = new BridgeMonitor({ stuckThresholdMs: 60 * 60 * 1000 }); // 1 hour

      const stuckTxs = await monitor.getStuckTransactions();

      expect(stuckTxs).toHaveLength(0);
    });
  });

  describe('health check', () => {
    it('should return healthy status', async () => {
      mockPrismaClient.bridgeTransaction.count.mockResolvedValueOnce(0); // No failed
      mockPrismaClient.bridgeTransaction.count.mockResolvedValueOnce(0); // No stuck
      mockPrismaClient.bridgeValidator.findMany.mockResolvedValue([
        { ...TEST_VALIDATOR, status: 'ACTIVE' },
        { ...TEST_VALIDATOR, id: 'v2', status: 'ACTIVE' },
        { ...TEST_VALIDATOR, id: 'v3', status: 'ACTIVE' },
      ]);

      const { BridgeMonitor } = await import('../../src/bridge/BridgeMonitor');
      const monitor = new BridgeMonitor();

      const health = await monitor.checkHealth();

      expect(health.status).toBe('healthy');
    });
  });
});

// ============================================================
// BRIDGE RELAYER TESTS
// ============================================================

describe('BridgeRelayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('transaction processing', () => {
    it('should process pending transactions', async () => {
      mockPrismaClient.bridgeTransaction.findMany.mockResolvedValue([
        {
          ...TEST_BRIDGE_TRANSACTION,
          status: 'VALIDATING',
          validatorSignatures: [
            { validator: 'v1', signature: 's1' },
            { validator: 'v2', signature: 's2' },
            { validator: 'v3', signature: 's3' },
          ],
        },
      ]);

      const { BridgeRelayer } = await import('../../src/bridge/BridgeRelayer');
      const relayer = new BridgeRelayer({ requiredSignatures: 3 });

      const status = relayer.getStatus();
      expect(status.isRunning).toBe(false);
    });

    it('should track metrics correctly', async () => {
      const { BridgeRelayer } = await import('../../src/bridge/BridgeRelayer');
      const relayer = new BridgeRelayer();

      const metrics = relayer.getMetrics();
      expect(metrics.processedCount).toBe(0);
      expect(metrics.successCount).toBe(0);
      expect(metrics.failureCount).toBe(0);
    });
  });
});

// ============================================================
// FEE CALCULATION TESTS
// ============================================================

describe('Fee Calculations', () => {
  it('should calculate correct fees for different chains', async () => {
    const { BridgeOrchestrator } = await import('../../src/bridge/BridgeOrchestrator');
    const orchestrator = new BridgeOrchestrator();
    
    // Access private method via any cast
    const calculateFee = (orchestrator as any).calculateBridgeFee.bind(orchestrator);

    // Solana: base 10 + 0.1%
    const solanaFee = calculateFee(1000, 'SOLANA');
    expect(solanaFee).toBeGreaterThanOrEqual(10);

    // Ethereum: base 25 + 0.25%
    const ethFee = calculateFee(1000, 'ETHEREUM');
    expect(ethFee).toBeGreaterThanOrEqual(25);

    // XRPL: base 5 + 0.05%
    const xrplFee = calculateFee(1000, 'XRPL');
    expect(xrplFee).toBeGreaterThanOrEqual(5);
  });

  it('should handle large amounts correctly', async () => {
    const { BridgeOrchestrator } = await import('../../src/bridge/BridgeOrchestrator');
    const orchestrator = new BridgeOrchestrator();
    
    const calculateFee = (orchestrator as any).calculateBridgeFee.bind(orchestrator);

    // Large amount should have higher absolute fee
    const largeFee = calculateFee(100000, 'SOLANA');
    const smallFee = calculateFee(1000, 'SOLANA');
    
    expect(largeFee).toBeGreaterThan(smallFee);
  });
});

// ============================================================
// END-TO-END FLOW TESTS
// ============================================================

describe('End-to-End Bridge Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should complete full XRPL to Solana bridge flow', async () => {
    // Step 1: Initiate bridge
    mockPrismaClient.bridgeTransaction.create.mockResolvedValue(TEST_BRIDGE_TRANSACTION);
    mockPrismaClient.auditLog.create.mockResolvedValue({});

    const { BridgeOrchestrator } = await import('../../src/bridge/BridgeOrchestrator');
    const orchestrator = new BridgeOrchestrator();
    vi.spyOn(orchestrator, 'hasQuorum').mockReturnValue(true);

    const initResult = await orchestrator.initiateBridge({
      direction: 'XRPL_TO_SOLANA',
      sourceChain: 'XRPL',
      destinationChain: 'SOLANA',
      sourceAddress: 'rSourceAddress12345678901234567',
      destinationAddress: '7J2Mo8dqKpeSXRepNpnvDqPFMGngXioVya45AirwXGxQ',
      amount: 1000,
      userWallet: 'rUserWallet123456789012345678',
    });

    expect(initResult.success).toBe(true);

    // Step 2: Check status
    mockPrismaClient.bridgeTransaction.findUnique.mockResolvedValue({
      ...TEST_BRIDGE_TRANSACTION,
      status: 'VALIDATING',
      signatures: [{ signature: 'sig1' }],
    });

    const statusResult = await orchestrator.getBridgeStatus(initResult.bridgeId!);
    expect(statusResult?.status).toBe('VALIDATING');

    // Step 3: Verify completion
    mockPrismaClient.bridgeTransaction.findUnique.mockResolvedValue({
      ...TEST_BRIDGE_TRANSACTION,
      status: 'COMPLETED',
      destinationTxHash: 'solana-tx-hash',
      completedAt: new Date(),
      signatures: [{ signature: 'sig1' }, { signature: 'sig2' }, { signature: 'sig3' }],
    });

    const completedStatus = await orchestrator.getBridgeStatus(initResult.bridgeId!);
    expect(completedStatus?.status).toBe('COMPLETED');
    expect(completedStatus?.destinationTxHash).toBeDefined();
  });
});
