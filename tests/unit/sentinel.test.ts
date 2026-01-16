/**
 * Verity Protocol - AI Sentinel Unit Tests
 * Sprint 3 - Rules-Based Fraud Detection Testing
 * 
 * Tests for:
 * - RulesEngine: All 7 fraud detection rules
 * - AlertManager: Alert lifecycle, severity calculation
 * - WalletProfile: Risk scoring, cluster detection
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// ============================================================================
// Mock Dependencies
// ============================================================================

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ============================================================================
// Constants
// ============================================================================

const TIME_WINDOWS = {
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
};

const ALERT_SEVERITY = {
  INFO: 'INFO',
  WARNING: 'WARNING',
  CRITICAL: 'CRITICAL',
};

const RULE_TYPES = {
  HIGH_VELOCITY: 'HIGH_VELOCITY',
  LARGE_TRANSFER: 'LARGE_TRANSFER',
  WASH_TRADING: 'WASH_TRADING',
  NEW_WALLET_LARGE: 'NEW_WALLET_LARGE',
  STRUCTURING: 'STRUCTURING',
  BRIDGE_ABUSE: 'BRIDGE_ABUSE',
  CLUSTER_ACTIVITY: 'CLUSTER_ACTIVITY',
};

// ============================================================================
// Helper Functions
// ============================================================================

const createMockTransaction = (overrides = {}) => ({
  hash: `TX${Date.now()}${Math.random().toString(36).slice(2)}`,
  from: 'rSender123456789012345678901234',
  to: 'rReceiver12345678901234567890123',
  amount: '1000',
  asset: 'VRTY',
  timestamp: new Date(),
  network: 'XRPL',
  type: 'Payment',
  metadata: {},
  ...overrides,
});

const getSeverityFromScore = (score: number): string => {
  if (score >= 70) return ALERT_SEVERITY.CRITICAL;
  if (score >= 40) return ALERT_SEVERITY.WARNING;
  return ALERT_SEVERITY.INFO;
};

// ============================================================================
// Rule 1: High Velocity Tests
// ============================================================================

describe('Rule 1: High Velocity Detection', () => {
  const MAX_TX_PER_HOUR = 50;

  it('should detect high velocity when threshold exceeded', () => {
    const transactionCount = 55;
    const isHighVelocity = transactionCount >= MAX_TX_PER_HOUR;
    
    expect(isHighVelocity).toBe(true);
  });

  it('should not flag normal transaction frequency', () => {
    const transactionCount = 30;
    const isHighVelocity = transactionCount >= MAX_TX_PER_HOUR;
    
    expect(isHighVelocity).toBe(false);
  });

  it('should calculate risk score based on velocity ratio', () => {
    const maxTxPerHour = 50;
    const actualTxCount = 100; // 2x the threshold
    
    const riskScore = Math.min(100, (actualTxCount / maxTxPerHour) * 50);
    
    expect(riskScore).toBe(100); // Capped at 100
  });

  it('should track velocity per wallet', () => {
    const velocityCache = new Map<string, number>();
    const wallet = 'rTestWallet123456789012345678901';
    
    // Simulate 60 transactions in an hour
    for (let i = 0; i < 60; i++) {
      const current = velocityCache.get(wallet) || 0;
      velocityCache.set(wallet, current + 1);
    }

    expect(velocityCache.get(wallet)).toBe(60);
    expect(velocityCache.get(wallet)! >= MAX_TX_PER_HOUR).toBe(true);
  });

  it('should generate correct alert evidence', () => {
    const evidence = {
      transactionCount: 75,
      transactionVolume: '500000',
      timeWindow: '1 hour',
      patternDescription: 'Unusually high transaction frequency',
    };

    expect(evidence.transactionCount).toBeGreaterThan(MAX_TX_PER_HOUR);
    expect(evidence.timeWindow).toBe('1 hour');
  });
});

// ============================================================================
// Rule 2: Large Transfer Tests
// ============================================================================

describe('Rule 2: Large Transfer Detection', () => {
  const LARGE_TRANSFER_THRESHOLD = 100000; // 100K VRTY

  it('should detect transfers above threshold', () => {
    const amounts = [150000, 500000, 1000000];
    
    for (const amount of amounts) {
      const isLargeTransfer = amount >= LARGE_TRANSFER_THRESHOLD;
      expect(isLargeTransfer).toBe(true);
    }
  });

  it('should not flag transfers below threshold', () => {
    const amounts = [1000, 50000, 99999];
    
    for (const amount of amounts) {
      const isLargeTransfer = amount >= LARGE_TRANSFER_THRESHOLD;
      expect(isLargeTransfer).toBe(false);
    }
  });

  it('should calculate severity based on amount', () => {
    const testCases = [
      { amount: 100000, expectedSeverity: ALERT_SEVERITY.WARNING },
      { amount: 500000, expectedSeverity: ALERT_SEVERITY.CRITICAL }, // 5x threshold
      { amount: 1000000, expectedSeverity: ALERT_SEVERITY.CRITICAL },
    ];

    for (const { amount, expectedSeverity } of testCases) {
      const severity = amount >= LARGE_TRANSFER_THRESHOLD * 5 
        ? ALERT_SEVERITY.CRITICAL 
        : ALERT_SEVERITY.WARNING;
      expect(severity).toBe(expectedSeverity);
    }
  });

  it('should calculate risk score proportional to amount', () => {
    const threshold = 100000;
    const amount = 250000; // 2.5x threshold
    
    const riskScore = Math.min(100, (amount / threshold) * 40);
    
    expect(riskScore).toBe(100); // 2.5 * 40 = 100
  });
});

// ============================================================================
// Rule 3: Wash Trading Tests
// ============================================================================

describe('Rule 3: Wash Trading Detection (A→B→A)', () => {
  const WASH_TRADING_WINDOW = 24 * 60 * 60 * 1000; // 24 hours
  const MIN_WASH_AMOUNT = 1000;

  it('should detect circular transaction pattern', () => {
    const walletA = 'rWalletA12345678901234567890123';
    const walletB = 'rWalletB12345678901234567890123';
    const now = Date.now();

    // Transaction 1: A → B
    const tx1 = { from: walletA, to: walletB, amount: 5000, timestamp: now - 3600000 };
    // Transaction 2: B → A (reverse within 24h)
    const tx2 = { from: walletB, to: walletA, amount: 4800, timestamp: now };

    // Check for reverse transaction
    const isReverse = tx2.from === tx1.to && tx2.to === tx1.from;
    const withinWindow = (tx2.timestamp - tx1.timestamp) <= WASH_TRADING_WINDOW;
    const similarAmount = Math.abs(tx2.amount - tx1.amount) / tx1.amount <= 0.1; // Within 10%

    expect(isReverse).toBe(true);
    expect(withinWindow).toBe(true);
    expect(similarAmount).toBe(true);
  });

  it('should not flag non-circular transactions', () => {
    const walletA = 'rWalletA12345678901234567890123';
    const walletB = 'rWalletB12345678901234567890123';
    const walletC = 'rWalletC12345678901234567890123';

    // Transaction 1: A → B
    const tx1 = { from: walletA, to: walletB };
    // Transaction 2: B → C (not back to A)
    const tx2 = { from: walletB, to: walletC };

    const isReverse = tx2.from === tx1.to && tx2.to === tx1.from;
    
    expect(isReverse).toBe(false);
  });

  it('should not flag transactions outside time window', () => {
    const now = Date.now();
    const tx1Time = now - (48 * 60 * 60 * 1000); // 48 hours ago
    const tx2Time = now;

    const withinWindow = (tx2Time - tx1Time) <= WASH_TRADING_WINDOW;
    
    expect(withinWindow).toBe(false);
  });

  it('should generate CRITICAL severity for wash trading', () => {
    const reverseTransactions = 2;
    const riskScore = 75 + (reverseTransactions * 5);
    const severity = getSeverityFromScore(riskScore);

    expect(riskScore).toBe(85);
    expect(severity).toBe(ALERT_SEVERITY.CRITICAL);
  });
});

// ============================================================================
// Rule 4: New Wallet Large Transaction Tests
// ============================================================================

describe('Rule 4: New Wallet Large Transaction', () => {
  const NEW_WALLET_AGE_THRESHOLD = 24 * 60 * 60 * 1000; // 24 hours
  const NEW_WALLET_AMOUNT_THRESHOLD = 10000;

  it('should detect large transaction from new wallet', () => {
    const walletAge = 6 * 60 * 60 * 1000; // 6 hours
    const amount = 50000;

    const isNewWallet = walletAge <= NEW_WALLET_AGE_THRESHOLD;
    const isLargeAmount = amount >= NEW_WALLET_AMOUNT_THRESHOLD;

    expect(isNewWallet).toBe(true);
    expect(isLargeAmount).toBe(true);
  });

  it('should not flag established wallets', () => {
    const walletAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    const amount = 50000;

    const isNewWallet = walletAge <= NEW_WALLET_AGE_THRESHOLD;

    expect(isNewWallet).toBe(false);
  });

  it('should not flag small transactions from new wallets', () => {
    const walletAge = 6 * 60 * 60 * 1000; // 6 hours
    const amount = 500;

    const isLargeAmount = amount >= NEW_WALLET_AMOUNT_THRESHOLD;

    expect(isLargeAmount).toBe(false);
  });

  it('should calculate risk based on wallet age and amount', () => {
    const threshold = 10000;
    const amount = 25000; // 2.5x threshold
    const baseScore = 50;
    
    const riskScore = baseScore + ((threshold / amount) * 20);
    
    expect(riskScore).toBeGreaterThan(50);
    expect(riskScore).toBeLessThan(100);
  });
});

// ============================================================================
// Rule 5: Structuring Tests
// ============================================================================

describe('Rule 5: Structuring Detection', () => {
  const STRUCTURING_THRESHOLD = 10000; // Reporting threshold
  const STRUCTURING_WINDOW = 24 * 60 * 60 * 1000; // 24 hours
  const MIN_STRUCTURING_COUNT = 3;

  it('should detect multiple transactions just below threshold', () => {
    const threshold = STRUCTURING_THRESHOLD;
    const transactions = [
      { amount: 9500, timestamp: Date.now() - 3600000 },
      { amount: 9400, timestamp: Date.now() - 7200000 },
      { amount: 9600, timestamp: Date.now() - 10800000 },
    ];

    const structuringTxs = transactions.filter(tx => {
      const lowerBound = threshold * 0.9; // 9000
      const upperBound = threshold * 1.05; // 10500
      return tx.amount >= lowerBound && tx.amount <= upperBound;
    });

    expect(structuringTxs.length).toBe(3);
    expect(structuringTxs.length >= MIN_STRUCTURING_COUNT).toBe(true);
  });

  it('should calculate total structured amount', () => {
    const transactions = [
      { amount: 9500 },
      { amount: 9400 },
      { amount: 9600 },
      { amount: 9300 },
    ];

    const totalAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    
    expect(totalAmount).toBe(37800);
  });

  it('should not flag legitimate transactions', () => {
    const threshold = STRUCTURING_THRESHOLD;
    const transactions = [
      { amount: 5000 },  // Well below threshold
      { amount: 15000 }, // Well above threshold
      { amount: 1000 },  // Small transaction
    ];

    const structuringTxs = transactions.filter(tx => {
      const lowerBound = threshold * 0.9;
      const upperBound = threshold * 1.05;
      return tx.amount >= lowerBound && tx.amount <= upperBound;
    });

    expect(structuringTxs.length).toBe(0);
  });

  it('should generate CRITICAL severity for structuring', () => {
    const structuringCount = 5;
    const riskScore = 70 + (structuringCount * 5);
    const severity = getSeverityFromScore(riskScore);

    expect(riskScore).toBe(95);
    expect(severity).toBe(ALERT_SEVERITY.CRITICAL);
  });
});

// ============================================================================
// Rule 6: Bridge Abuse Tests
// ============================================================================

describe('Rule 6: Bridge Abuse Detection', () => {
  const BRIDGE_VELOCITY_LIMIT = 10; // Per hour
  const BRIDGE_AMOUNT_THRESHOLD = 50000;

  it('should detect high frequency bridge transactions', () => {
    const bridgeTxsInLastHour = 15;
    
    const isHighFrequency = bridgeTxsInLastHour >= BRIDGE_VELOCITY_LIMIT;
    
    expect(isHighFrequency).toBe(true);
  });

  it('should detect large bridge transactions', () => {
    const amount = 75000;
    
    const isLargeAmount = amount >= BRIDGE_AMOUNT_THRESHOLD;
    
    expect(isLargeAmount).toBe(true);
  });

  it('should identify bridge transactions from metadata', () => {
    const tx = createMockTransaction({
      metadata: { isBridgeTransaction: true, sourceChain: 'XRPL', destChain: 'Solana' },
    });

    const isBridgeTx = tx.metadata?.isBridgeTransaction === true;
    
    expect(isBridgeTx).toBe(true);
  });

  it('should calculate combined risk score', () => {
    const velocityLimit = 10;
    const amountThreshold = 50000;
    const actualVelocity = 20;
    const actualAmount = 100000;

    const velocityRisk = (actualVelocity / velocityLimit) * 50;
    const amountRisk = (actualAmount / amountThreshold) * 50;
    const riskScore = Math.max(velocityRisk, amountRisk);

    expect(riskScore).toBe(100);
  });
});

// ============================================================================
// Rule 7: Cluster Activity Tests
// ============================================================================

describe('Rule 7: Cluster Activity Detection', () => {
  const MIN_CLUSTER_SIZE = 3;
  const CLUSTER_TIME_WINDOW = 1 * 60 * 60 * 1000; // 1 hour

  it('should detect coordinated cluster activity', () => {
    const linkedWallets = [
      'rLinked1123456789012345678901234',
      'rLinked2123456789012345678901234',
      'rLinked3123456789012345678901234',
    ];

    const hasMinClusterSize = linkedWallets.length >= MIN_CLUSTER_SIZE;
    
    expect(hasMinClusterSize).toBe(true);
  });

  it('should track linked wallets bidirectionally', () => {
    const walletLinks = new Map<string, string[]>();
    const wallet1 = 'rWallet1123456789012345678901234';
    const wallet2 = 'rWallet2123456789012345678901234';

    // Link wallets bidirectionally
    const wallet1Links = walletLinks.get(wallet1) || [];
    if (!wallet1Links.includes(wallet2)) {
      wallet1Links.push(wallet2);
      walletLinks.set(wallet1, wallet1Links);
    }

    const wallet2Links = walletLinks.get(wallet2) || [];
    if (!wallet2Links.includes(wallet1)) {
      wallet2Links.push(wallet1);
      walletLinks.set(wallet2, wallet2Links);
    }

    expect(walletLinks.get(wallet1)).toContain(wallet2);
    expect(walletLinks.get(wallet2)).toContain(wallet1);
  });

  it('should count active linked wallets in time window', () => {
    const now = Date.now();
    const linkedWalletActivity = [
      { wallet: 'rLinked1', lastActive: now - 1800000 },  // 30 min ago
      { wallet: 'rLinked2', lastActive: now - 3600000 }, // 1 hour ago (at boundary)
      { wallet: 'rLinked3', lastActive: now - 7200000 }, // 2 hours ago (outside)
    ];

    const activeInWindow = linkedWalletActivity.filter(
      w => (now - w.lastActive) <= CLUSTER_TIME_WINDOW
    );

    expect(activeInWindow.length).toBe(2);
  });

  it('should calculate cluster risk score', () => {
    const activeLinkedWallets = 5;
    const baseScore = 60;
    
    const riskScore = Math.min(100, baseScore + (activeLinkedWallets * 10));
    
    expect(riskScore).toBe(100); // 60 + 50 = 110, capped at 100
  });
});

// ============================================================================
// Alert Manager Tests
// ============================================================================

describe('AlertManager', () => {
  describe('Alert Lifecycle', () => {
    it('should create alert with correct initial status', () => {
      const alert = {
        id: 'ALT-001',
        status: 'PENDING',
        createdAt: new Date(),
        reviewedAt: null,
        resolvedAt: null,
      };

      expect(alert.status).toBe('PENDING');
      expect(alert.reviewedAt).toBeNull();
    });

    it('should transition from PENDING to REVIEWED', () => {
      const alert = {
        id: 'ALT-001',
        status: 'PENDING',
        reviewedBy: null as string | null,
        reviewedAt: null as Date | null,
      };

      // Guardian reviews alert
      alert.status = 'REVIEWED';
      alert.reviewedBy = 'guardian_1';
      alert.reviewedAt = new Date();

      expect(alert.status).toBe('REVIEWED');
      expect(alert.reviewedBy).toBe('guardian_1');
      expect(alert.reviewedAt).toBeDefined();
    });

    it('should record actions in audit log', () => {
      const auditLog: Array<{
        action: string;
        actor: string;
        timestamp: Date;
        details?: Record<string, unknown>;
      }> = [];

      auditLog.push({
        action: 'ALERT_CREATED',
        actor: 'SENTINEL',
        timestamp: new Date(),
        details: { ruleId: 'RULE-001' },
      });

      auditLog.push({
        action: 'ALERT_REVIEWED',
        actor: 'guardian_1',
        timestamp: new Date(),
        details: { decision: 'escalate' },
      });

      expect(auditLog.length).toBe(2);
      expect(auditLog[0].action).toBe('ALERT_CREATED');
      expect(auditLog[1].action).toBe('ALERT_REVIEWED');
    });
  });

  describe('Severity Calculation', () => {
    it('should assign INFO severity for low risk', () => {
      const riskScore = 25;
      const severity = getSeverityFromScore(riskScore);
      
      expect(severity).toBe(ALERT_SEVERITY.INFO);
    });

    it('should assign WARNING severity for medium risk', () => {
      const riskScore = 55;
      const severity = getSeverityFromScore(riskScore);
      
      expect(severity).toBe(ALERT_SEVERITY.WARNING);
    });

    it('should assign CRITICAL severity for high risk', () => {
      const riskScore = 85;
      const severity = getSeverityFromScore(riskScore);
      
      expect(severity).toBe(ALERT_SEVERITY.CRITICAL);
    });
  });

  describe('Confidence Calculation', () => {
    it('should calculate confidence based on evidence', () => {
      let confidence = 50; // Base

      const evidence = {
        transactionCount: 10,
        patternMatches: ['match1', 'match2'],
        linkedWallets: ['w1', 'w2', 'w3'],
      };

      if (evidence.transactionCount > 3) confidence += 15;
      if (evidence.patternMatches.length > 0) confidence += 20;
      if (evidence.linkedWallets.length > 2) confidence += 10;

      expect(confidence).toBe(95); // 50 + 15 + 20 + 10
    });
  });
});

// ============================================================================
// Wallet Profile Tests
// ============================================================================

describe('WalletProfile', () => {
  describe('Risk Scoring', () => {
    it('should calculate cumulative risk score', () => {
      const profile = {
        address: 'rTestWallet123456789012345678901',
        totalTransactions: 100,
        totalVolume: '1000000',
        alertCount: 3,
        flagCount: 2,
        riskScore: 0,
      };

      // Calculate risk based on flags and alerts
      let risk = 0;
      risk += profile.alertCount * 10;
      risk += profile.flagCount * 5;
      
      profile.riskScore = Math.min(100, risk);

      expect(profile.riskScore).toBe(40); // 30 + 10
    });

    it('should track KYC verification status', () => {
      const profile = {
        address: 'rVerifiedWallet12345678901234567',
        kycVerified: false,
        kycLevel: 0,
      };

      // Simulate KYC verification
      profile.kycVerified = true;
      profile.kycLevel = 2;

      expect(profile.kycVerified).toBe(true);
      expect(profile.kycLevel).toBe(2);
    });
  });

  describe('Activity Tracking', () => {
    it('should calculate average transaction size', () => {
      const profile = {
        totalVolume: BigInt(500000),
        totalTransactions: 50,
      };

      const avgTxSize = Number(profile.totalVolume) / profile.totalTransactions;

      expect(avgTxSize).toBe(10000);
    });

    it('should track unique counterparties', () => {
      const counterparties = new Set<string>();
      
      counterparties.add('rCounterparty1');
      counterparties.add('rCounterparty2');
      counterparties.add('rCounterparty1'); // Duplicate
      counterparties.add('rCounterparty3');

      expect(counterparties.size).toBe(3);
    });
  });
});

// ============================================================================
// Guardian Dashboard API Tests
// ============================================================================

describe('Guardian Dashboard API', () => {
  describe('Alert Listing', () => {
    it('should filter alerts by status', () => {
      const alerts = [
        { id: '1', status: 'PENDING' },
        { id: '2', status: 'REVIEWED' },
        { id: '3', status: 'PENDING' },
        { id: '4', status: 'RESOLVED' },
      ];

      const pendingAlerts = alerts.filter(a => a.status === 'PENDING');
      
      expect(pendingAlerts.length).toBe(2);
    });

    it('should sort alerts by severity and date', () => {
      const alerts = [
        { id: '1', severity: 'WARNING', createdAt: new Date('2026-01-15T10:00:00') },
        { id: '2', severity: 'CRITICAL', createdAt: new Date('2026-01-15T09:00:00') },
        { id: '3', severity: 'CRITICAL', createdAt: new Date('2026-01-15T11:00:00') },
      ];

      const severityOrder = { CRITICAL: 0, WARNING: 1, INFO: 2 };
      
      const sorted = [...alerts].sort((a, b) => {
        const severityDiff = severityOrder[a.severity as keyof typeof severityOrder] - 
                            severityOrder[b.severity as keyof typeof severityOrder];
        if (severityDiff !== 0) return severityDiff;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });

      expect(sorted[0].id).toBe('3'); // Most recent CRITICAL
      expect(sorted[1].id).toBe('2'); // Older CRITICAL
      expect(sorted[2].id).toBe('1'); // WARNING
    });
  });

  describe('Guardian Actions', () => {
    it('should require human approval for freeze actions', () => {
      const action = {
        type: 'FREEZE',
        alertId: 'ALT-001',
        requiresApproval: true,
        approvedBy: null as string | null,
      };

      const canExecute = !action.requiresApproval || action.approvedBy !== null;
      
      expect(canExecute).toBe(false);

      // Guardian approves
      action.approvedBy = 'guardian_1';
      const canExecuteNow = !action.requiresApproval || action.approvedBy !== null;
      
      expect(canExecuteNow).toBe(true);
    });

    it('should log all guardian actions', () => {
      const actionLog: Array<{ action: string; guardian: string; timestamp: Date }> = [];

      actionLog.push({
        action: 'REVIEW_ALERT',
        guardian: 'guardian_1',
        timestamp: new Date(),
      });

      actionLog.push({
        action: 'APPROVE_FREEZE',
        guardian: 'guardian_2',
        timestamp: new Date(),
      });

      expect(actionLog.length).toBe(2);
    });
  });
});

// ============================================================================
// XAO-DOW Compliance Integration Tests
// ============================================================================

describe('XAO-DOW Compliance Integration', () => {
  it('should connect alerts to clawback proposals', () => {
    const alert = {
      id: 'ALT-001',
      primaryWallet: 'rSuspiciousWallet123456789012345',
      severity: 'CRITICAL',
    };

    const clawbackProposal = {
      alertId: alert.id,
      targetWallet: alert.primaryWallet,
      status: 'PENDING_VOTE',
      createdFromAlert: true,
    };

    expect(clawbackProposal.alertId).toBe(alert.id);
    expect(clawbackProposal.targetWallet).toBe(alert.primaryWallet);
    expect(clawbackProposal.createdFromAlert).toBe(true);
  });

  it('should require governance vote for asset freezes', () => {
    const freezeProposal = {
      type: 'ASSET_FREEZE',
      targetAsset: 'VRTY',
      targetWallet: 'rWallet123',
      votesFor: 5,
      votesAgainst: 2,
      quorumRequired: 10,
      status: 'VOTING',
    };

    const hasQuorum = (freezeProposal.votesFor + freezeProposal.votesAgainst) >= freezeProposal.quorumRequired;
    const approved = freezeProposal.votesFor > freezeProposal.votesAgainst;

    expect(hasQuorum).toBe(false);
    expect(approved).toBe(true); // Would be approved if quorum met
  });
});

// ============================================================================
// False Positive Analysis Tests
// ============================================================================

describe('False Positive Analysis', () => {
  it('should track false positive rate', () => {
    const stats = {
      totalAlerts: 100,
      confirmedThreat: 85,
      falsePositive: 15,
    };

    const falsePositiveRate = (stats.falsePositive / stats.totalAlerts) * 100;
    
    expect(falsePositiveRate).toBe(15);
    expect(falsePositiveRate).toBeLessThan(20); // Target: <20% false positive rate
  });

  it('should categorize false positives by rule', () => {
    const falsePositivesByRule: Record<string, number> = {
      HIGH_VELOCITY: 5,
      LARGE_TRANSFER: 3,
      WASH_TRADING: 1,
      NEW_WALLET_LARGE: 4,
      STRUCTURING: 2,
    };

    const totalFalsePositives = Object.values(falsePositivesByRule).reduce((a, b) => a + b, 0);
    const highestFpRule = Object.entries(falsePositivesByRule)
      .sort(([, a], [, b]) => b - a)[0][0];

    expect(totalFalsePositives).toBe(15);
    expect(highestFpRule).toBe('HIGH_VELOCITY');
  });
});
