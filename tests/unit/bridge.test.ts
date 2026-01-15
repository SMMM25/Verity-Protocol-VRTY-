/**
 * Verity Protocol - Bridge Unit Tests
 * 
 * Comprehensive tests for cross-chain bridge functionality
 * Tests validator node, relayer service, and monitor
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Prisma client
vi.mock('../../src/db/client.js', () => ({
  prisma: {
    bridgeTransaction: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    validator: {
      upsert: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
  checkDatabaseHealth: vi.fn(() => Promise.resolve({ connected: true })),
}));

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock Solana
vi.mock('@solana/web3.js', () => ({
  Connection: vi.fn().mockImplementation(() => ({
    getSlot: vi.fn().mockResolvedValue(123456),
    getBlockHeight: vi.fn().mockResolvedValue(100000),
  })),
  PublicKey: vi.fn().mockImplementation((address: string) => ({
    toString: () => address,
    toBase58: () => address,
  })),
  Keypair: {
    fromSecretKey: vi.fn().mockReturnValue({
      publicKey: { toString: () => 'mock-public-key' },
    }),
  },
  Transaction: vi.fn(),
  sendAndConfirmTransaction: vi.fn(),
  clusterApiUrl: vi.fn().mockReturnValue('https://api.mainnet-beta.solana.com'),
}));

// Mock SPL Token
vi.mock('@solana/spl-token', () => ({
  getAssociatedTokenAddress: vi.fn().mockResolvedValue('mock-ata'),
  getAccount: vi.fn(),
  getMint: vi.fn(),
  createAssociatedTokenAccountInstruction: vi.fn(),
  createMintToInstruction: vi.fn(),
  createBurnInstruction: vi.fn(),
  TOKEN_PROGRAM_ID: 'token-program-id',
  ASSOCIATED_TOKEN_PROGRAM_ID: 'ata-program-id',
}));

import { prisma } from '../../src/db/client.js';

// ============================================================
// VALIDATOR NODE TESTS
// ============================================================

describe('ValidatorNode', () => {
  describe('Constructor', () => {
    it('should initialize with provided config', async () => {
      const { ValidatorNode } = await import('../../src/bridge/ValidatorNode.js');
      
      const config = {
        validatorId: 'test-validator-1',
        privateKey: 'test-private-key',
        publicKey: 'test-public-key',
      };

      const node = new ValidatorNode(config);
      const status = node.getStatus();

      expect(status.validatorId).toBe('test-validator-1');
      expect(status.publicKey).toBe('test-public-key');
      expect(status.status).toBe('INACTIVE');
    });
  });

  describe('Lifecycle', () => {
    it('should start and stop correctly', async () => {
      const { ValidatorNode } = await import('../../src/bridge/ValidatorNode.js');
      
      const node = new ValidatorNode({
        validatorId: 'lifecycle-test',
        privateKey: 'key',
        publicKey: 'pubkey',
      });

      await node.start();
      expect(node.getStatus().status).toBe('ACTIVE');

      await node.stop();
      expect(node.getStatus().status).toBe('INACTIVE');
    });
  });

  describe('Transaction Validation', () => {
    it('should validate correct transaction', async () => {
      const { ValidatorNode } = await import('../../src/bridge/ValidatorNode.js');
      
      const node = new ValidatorNode({
        validatorId: 'validation-test',
        privateKey: 'key',
        publicKey: 'pubkey',
      });

      // Mock database response
      vi.mocked(prisma.bridgeTransaction.findUnique).mockResolvedValue({
        id: 'test-bridge-id',
        direction: 'XRPL_TO_SOLANA',
        sourceChain: 'XRPL',
        destinationChain: 'SOLANA',
        sourceAddress: 'rSourceAddress123456',
        destinationAddress: 'SolanaDestAddress123456789',
        amount: 1000,
        fee: 5,
        status: 'VALIDATING',
        sourceTxHash: 'source-hash',
        verificationHash: 'verification-hash',
        createdAt: new Date(),
        completedAt: null,
        destinationTxHash: null,
        errorMessage: null,
        retryCount: 0,
        validatorSignatures: [],
      } as any);

      const result = await node.validateTransaction({
        bridgeId: 'test-bridge-id',
        direction: 'XRPL_TO_SOLANA',
        sourceChain: 'XRPL',
        destinationChain: 'SOLANA',
        sourceAddress: 'rSourceAddress123456',
        destinationAddress: 'SolanaDestAddress123456789',
        amount: 1000,
        sourceTxHash: 'source-hash',
        verificationHash: 'verification-hash',
        timestamp: new Date(),
      });

      expect(result.isValid).toBe(true);
      expect(result.checks.amountMatches).toBe(true);
      expect(result.checks.withinTimeLimits).toBe(true);
    });

    it('should reject invalid amount', async () => {
      const { ValidatorNode } = await import('../../src/bridge/ValidatorNode.js');
      
      const node = new ValidatorNode({
        validatorId: 'validation-test',
        privateKey: 'key',
        publicKey: 'pubkey',
      });

      vi.mocked(prisma.bridgeTransaction.findUnique).mockResolvedValue({
        id: 'test-id',
        status: 'VALIDATING',
      } as any);

      const result = await node.validateTransaction({
        bridgeId: 'test-id',
        direction: 'XRPL_TO_SOLANA',
        sourceChain: 'XRPL',
        destinationChain: 'SOLANA',
        sourceAddress: 'rSource123456789',
        destinationAddress: 'SolanaAddress123456789',
        amount: 50, // Below minimum of 100
        sourceTxHash: 'hash',
        verificationHash: 'hash',
        timestamp: new Date(),
      });

      expect(result.checks.amountMatches).toBe(false);
    });

    it('should reject expired transaction', async () => {
      const { ValidatorNode } = await import('../../src/bridge/ValidatorNode.js');
      
      const node = new ValidatorNode({
        validatorId: 'validation-test',
        privateKey: 'key',
        publicKey: 'pubkey',
      });

      vi.mocked(prisma.bridgeTransaction.findUnique).mockResolvedValue({
        id: 'test-id',
        status: 'VALIDATING',
      } as any);

      // Transaction from 48 hours ago
      const oldTimestamp = new Date(Date.now() - 48 * 60 * 60 * 1000);

      const result = await node.validateTransaction({
        bridgeId: 'test-id',
        direction: 'XRPL_TO_SOLANA',
        sourceChain: 'XRPL',
        destinationChain: 'SOLANA',
        sourceAddress: 'rSource123456789',
        destinationAddress: 'SolanaAddress123456789',
        amount: 1000,
        sourceTxHash: 'hash',
        verificationHash: 'hash',
        timestamp: oldTimestamp,
      });

      expect(result.checks.withinTimeLimits).toBe(false);
    });
  });
});

// ============================================================
// VALIDATOR REGISTRY TESTS
// ============================================================

describe('ValidatorRegistry', () => {
  it('should register and track validators', async () => {
    const { ValidatorNode, ValidatorRegistry } = await import('../../src/bridge/ValidatorNode.js');
    
    const registry = new ValidatorRegistry(3);

    const node1 = new ValidatorNode({
      validatorId: 'validator-1',
      privateKey: 'key1',
      publicKey: 'pubkey1',
    });

    const node2 = new ValidatorNode({
      validatorId: 'validator-2',
      privateKey: 'key2',
      publicKey: 'pubkey2',
    });

    registry.registerValidator(node1);
    registry.registerValidator(node2);

    const stats = registry.getStats();
    expect(stats.totalValidators).toBe(2);
    expect(stats.requiredSignatures).toBe(3);
    expect(stats.hasQuorum).toBe(false); // Only 2 registered, need 3
  });

  it('should check quorum correctly', async () => {
    const { ValidatorNode, ValidatorRegistry } = await import('../../src/bridge/ValidatorNode.js');
    
    const registry = new ValidatorRegistry(2);

    const node1 = new ValidatorNode({
      validatorId: 'v1',
      privateKey: 'k1',
      publicKey: 'p1',
    });

    const node2 = new ValidatorNode({
      validatorId: 'v2',
      privateKey: 'k2',
      publicKey: 'p2',
    });

    registry.registerValidator(node1);
    await node1.start();
    
    registry.registerValidator(node2);
    await node2.start();

    // Both are active
    expect(registry.hasQuorum()).toBe(true);

    await node1.stop();
    await node2.stop();
  });
});

// ============================================================
// BRIDGE RELAYER TESTS
// ============================================================

describe('BridgeRelayer', () => {
  describe('Constructor', () => {
    it('should initialize with provided config', async () => {
      const { BridgeRelayer } = await import('../../src/bridge/BridgeRelayer.js');
      
      const relayer = new BridgeRelayer({
        relayerId: 'test-relayer',
      });

      const status = relayer.getStatus();
      expect(status.relayerId).toBe('test-relayer');
      expect(status.status).toBe('INACTIVE');
    });
  });

  describe('Lifecycle', () => {
    it('should start and stop correctly', async () => {
      const { BridgeRelayer } = await import('../../src/bridge/BridgeRelayer.js');
      
      const relayer = new BridgeRelayer({
        relayerId: 'lifecycle-relayer',
        pollingIntervalMs: 60000, // Long interval to avoid polling during test
      });

      vi.mocked(prisma.bridgeTransaction.findMany).mockResolvedValue([]);

      await relayer.start();
      expect(relayer.getStatus().status).toBe('ACTIVE');

      await relayer.stop();
      expect(relayer.getStatus().status).toBe('INACTIVE');
    });

    it('should pause and resume', async () => {
      const { BridgeRelayer } = await import('../../src/bridge/BridgeRelayer.js');
      
      const relayer = new BridgeRelayer({
        relayerId: 'pause-relayer',
        pollingIntervalMs: 60000,
      });

      vi.mocked(prisma.bridgeTransaction.findMany).mockResolvedValue([]);

      await relayer.start();
      expect(relayer.getStatus().status).toBe('ACTIVE');

      relayer.pause();
      expect(relayer.getStatus().status).toBe('PAUSED');

      relayer.resume();
      expect(relayer.getStatus().status).toBe('ACTIVE');

      await relayer.stop();
    });
  });

  describe('Metrics', () => {
    it('should track metrics correctly', async () => {
      const { BridgeRelayer } = await import('../../src/bridge/BridgeRelayer.js');
      
      const relayer = new BridgeRelayer({
        relayerId: 'metrics-relayer',
      });

      const metrics = relayer.getMetrics();
      expect(metrics.totalProcessed).toBe(0);
      expect(metrics.successfulMints).toBe(0);
      expect(metrics.failedMints).toBe(0);
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

  describe('Constructor', () => {
    it('should initialize with default config', async () => {
      const { BridgeMonitor } = await import('../../src/bridge/BridgeMonitor.js');
      
      const monitor = new BridgeMonitor();
      expect(monitor).toBeDefined();
    });

    it('should initialize with custom config', async () => {
      const { BridgeMonitor } = await import('../../src/bridge/BridgeMonitor.js');
      
      const monitor = new BridgeMonitor({
        checkIntervalMs: 30000,
        stuckTransactionThresholdMs: 15 * 60 * 1000,
        maxRetries: 5,
        enableAutoRefund: false,
      });
      expect(monitor).toBeDefined();
    });
  });

  describe('Health Check', () => {
    it('should perform health check', async () => {
      const { BridgeMonitor } = await import('../../src/bridge/BridgeMonitor.js');
      
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ result: 1 }]);
      vi.mocked(prisma.bridgeTransaction.count).mockResolvedValue(0);
      vi.mocked(prisma.bridgeTransaction.findMany).mockResolvedValue([]);

      const monitor = new BridgeMonitor();
      const health = await monitor.performHealthCheck();

      expect(health.status).toBeDefined();
      expect(health.checks.database).toBe(true);
      expect(health.lastChecked).toBeInstanceOf(Date);
    });

    it('should detect unhealthy state when database is down', async () => {
      const { BridgeMonitor } = await import('../../src/bridge/BridgeMonitor.js');
      
      vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('Connection refused'));
      vi.mocked(prisma.bridgeTransaction.count).mockResolvedValue(0);
      vi.mocked(prisma.bridgeTransaction.findMany).mockResolvedValue([]);

      const monitor = new BridgeMonitor();
      const health = await monitor.performHealthCheck();

      expect(health.checks.database).toBe(false);
    });
  });

  describe('Stuck Transactions', () => {
    it('should detect stuck transactions', async () => {
      const { BridgeMonitor } = await import('../../src/bridge/BridgeMonitor.js');
      
      // Mock stuck transaction (45 minutes old)
      const stuckTx = {
        id: 'stuck-tx-1',
        direction: 'XRPL_TO_SOLANA',
        status: 'VALIDATING',
        amount: 1000,
        retryCount: 0,
        errorMessage: null,
        sourceAddress: 'rSource',
        destinationAddress: 'SolDest',
        createdAt: new Date(Date.now() - 45 * 60 * 1000), // 45 min ago
      };

      vi.mocked(prisma.bridgeTransaction.findMany).mockResolvedValue([stuckTx] as any);

      const monitor = new BridgeMonitor({
        stuckTransactionThresholdMs: 30 * 60 * 1000, // 30 min threshold
      });

      const stuckTxs = await monitor.getStuckTransactions();
      expect(stuckTxs).toHaveLength(1);
      expect(stuckTxs[0].id).toBe('stuck-tx-1');
    });
  });

  describe('Retry Logic', () => {
    it('should retry transaction', async () => {
      const { BridgeMonitor } = await import('../../src/bridge/BridgeMonitor.js');
      
      vi.mocked(prisma.bridgeTransaction.findUnique).mockResolvedValue({
        id: 'retry-tx',
        status: 'VALIDATING',
        retryCount: 1,
      } as any);

      vi.mocked(prisma.bridgeTransaction.update).mockResolvedValue({
        id: 'retry-tx',
        retryCount: 2,
        status: 'VALIDATING',
      } as any);

      const monitor = new BridgeMonitor();
      const result = await monitor.retryTransaction('retry-tx');

      expect(result.success).toBe(true);
      expect(result.retryCount).toBe(2);
    });

    it('should handle transaction not found', async () => {
      const { BridgeMonitor } = await import('../../src/bridge/BridgeMonitor.js');
      
      vi.mocked(prisma.bridgeTransaction.findUnique).mockResolvedValue(null);

      const monitor = new BridgeMonitor();
      const result = await monitor.retryTransaction('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Transaction not found');
    });
  });

  describe('Refund Logic', () => {
    it('should initiate refund for failed transaction', async () => {
      const { BridgeMonitor } = await import('../../src/bridge/BridgeMonitor.js');
      
      vi.mocked(prisma.bridgeTransaction.findUnique).mockResolvedValue({
        id: 'refund-tx',
        status: 'FAILED',
      } as any);

      vi.mocked(prisma.bridgeTransaction.update).mockResolvedValue({
        id: 'refund-tx',
        status: 'REFUNDED',
      } as any);

      const monitor = new BridgeMonitor();
      const result = await monitor.initiateRefund('refund-tx');

      expect(result.success).toBe(true);
    });

    it('should not refund completed transaction', async () => {
      const { BridgeMonitor } = await import('../../src/bridge/BridgeMonitor.js');
      
      vi.mocked(prisma.bridgeTransaction.findUnique).mockResolvedValue({
        id: 'completed-tx',
        status: 'COMPLETED',
      } as any);

      const monitor = new BridgeMonitor();
      const result = await monitor.initiateRefund('completed-tx');

      expect(result.success).toBe(false);
      expect(result.error).toContain('already completed');
    });
  });

  describe('Statistics', () => {
    it('should return statistics', async () => {
      const { BridgeMonitor } = await import('../../src/bridge/BridgeMonitor.js');
      
      vi.mocked(prisma.bridgeTransaction.count).mockResolvedValue(100);
      vi.mocked(prisma.bridgeTransaction.groupBy).mockResolvedValue([
        { status: 'COMPLETED', _count: 80 },
        { status: 'FAILED', _count: 10 },
        { status: 'PENDING', _count: 10 },
      ] as any);
      vi.mocked(prisma.bridgeTransaction.aggregate).mockResolvedValue({
        _sum: { amount: 100000, fee: 500 },
      } as any);
      vi.mocked(prisma.bridgeTransaction.findMany).mockResolvedValue([]);

      const monitor = new BridgeMonitor();
      const stats = await monitor.getStatistics();

      expect(stats.total).toBe(100);
      expect(stats.volume.total).toBe(100000);
    });
  });

  describe('Alerts', () => {
    it('should track alerts', async () => {
      const { BridgeMonitor } = await import('../../src/bridge/BridgeMonitor.js');
      
      const monitor = new BridgeMonitor();
      
      // Trigger health check that might create alerts
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ result: 1 }]);
      vi.mocked(prisma.bridgeTransaction.count).mockResolvedValue(0);
      vi.mocked(prisma.bridgeTransaction.findMany).mockResolvedValue([]);

      await monitor.performHealthCheck();

      const alerts = monitor.getAlerts();
      expect(Array.isArray(alerts)).toBe(true);
    });
  });
});

// ============================================================
// SOLANA BRIDGE TESTS
// ============================================================

describe('SolanaBridge', () => {
  describe('Fee Calculation', () => {
    it('should calculate fees correctly', async () => {
      const { solanaBridge } = await import('../../src/bridge/SolanaBridge.js');
      
      const result = solanaBridge.calculateFee(1000, 'XRPL_TO_SOLANA');
      
      expect(result.fee).toBeGreaterThan(0);
      expect(result.netAmount).toBe(1000 - result.fee);
      expect(result.breakdown.baseFee).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.percentageFee).toBeGreaterThanOrEqual(0);
    });

    it('should apply minimum fee', async () => {
      const { solanaBridge } = await import('../../src/bridge/SolanaBridge.js');
      
      const result = solanaBridge.calculateFee(100, 'XRPL_TO_SOLANA'); // Minimum amount
      
      expect(result.fee).toBeGreaterThanOrEqual(5); // Min fee is 5
    });
  });

  describe('Request Validation', () => {
    it('should validate correct request', async () => {
      const { solanaBridge } = await import('../../src/bridge/SolanaBridge.js');
      
      const result = solanaBridge.validateBridgeRequest({
        sourceAddress: 'rXRPLSourceAddress123456',
        destinationAddress: '7EKfEcvRQYge8fHTnr7YWA7Q5PUXrmYxmKViiX8jWZh5',
        amount: '1000',
        direction: 'XRPL_TO_SOLANA',
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject amount below minimum', async () => {
      const { solanaBridge } = await import('../../src/bridge/SolanaBridge.js');
      
      const result = solanaBridge.validateBridgeRequest({
        sourceAddress: 'rXRPLSource123456',
        destinationAddress: '7EKfEcvRQYge8fHTnr7YWA7Q5PUXrmYxmKViiX8jWZh5',
        amount: '50', // Below minimum of 100
        direction: 'XRPL_TO_SOLANA',
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Minimum'))).toBe(true);
    });

    it('should reject amount above maximum', async () => {
      const { solanaBridge } = await import('../../src/bridge/SolanaBridge.js');
      
      const result = solanaBridge.validateBridgeRequest({
        sourceAddress: 'rXRPLSource123456',
        destinationAddress: '7EKfEcvRQYge8fHTnr7YWA7Q5PUXrmYxmKViiX8jWZh5',
        amount: '2000000', // Above maximum of 1M
        direction: 'XRPL_TO_SOLANA',
      });

      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Maximum'))).toBe(true);
    });
  });

  describe('Verification Hash', () => {
    it('should generate consistent verification hash', async () => {
      const { solanaBridge } = await import('../../src/bridge/SolanaBridge.js');
      
      const hash1 = solanaBridge.generateVerificationHash(
        'source',
        'dest',
        '1000',
        1234567890
      );

      const hash2 = solanaBridge.generateVerificationHash(
        'source',
        'dest',
        '1000',
        1234567890
      );

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // SHA256 hex
    });

    it('should generate different hash for different inputs', async () => {
      const { solanaBridge } = await import('../../src/bridge/SolanaBridge.js');
      
      const hash1 = solanaBridge.generateVerificationHash(
        'source1',
        'dest',
        '1000',
        1234567890
      );

      const hash2 = solanaBridge.generateVerificationHash(
        'source2',
        'dest',
        '1000',
        1234567890
      );

      expect(hash1).not.toBe(hash2);
    });
  });
});
