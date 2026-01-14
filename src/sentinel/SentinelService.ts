/**
 * AI Sentinel v1 - Main Service
 * Orchestrates rules engine, alert management, and transaction processing
 */

import { RulesEngine } from './rules/RulesEngine.js';
import { AlertManager } from './alerts/AlertManager.js';
import {
  AnalyzedTransaction,
  SentinelAlert,
  AlertFilter,
  AlertActionRequest,
  AlertActionResponse,
  Guardian,
  SentinelStats,
  SentinelConfig,
  RuleDefinition,
  WalletProfile,
} from './types.js';
import { DEFAULT_SENTINEL_CONFIG } from './config.js';
import { logger } from '../utils/logger.js';
import { prisma } from '../db/index.js';

/**
 * AI Sentinel Service - Human-in-the-loop fraud detection
 */
export class SentinelService {
  private rulesEngine: RulesEngine;
  private alertManager: AlertManager;
  private config: SentinelConfig;
  private isRunning: boolean = false;
  private processingInterval?: NodeJS.Timeout;
  private transactionQueue: AnalyzedTransaction[] = [];

  constructor(config: Partial<SentinelConfig> = {}) {
    this.config = { ...DEFAULT_SENTINEL_CONFIG, ...config };
    this.rulesEngine = new RulesEngine(this.config.rules);
    this.alertManager = new AlertManager(this.config.webhookUrl);
    
    logger.info('SentinelService initialized', {
      enabled: this.config.enabled,
      rulesCount: this.config.rules.length,
    });
  }

  /**
   * Start the Sentinel service
   */
  async start(): Promise<void> {
    if (!this.config.enabled) {
      logger.info('Sentinel is disabled');
      return;
    }

    if (this.isRunning) {
      logger.warn('Sentinel is already running');
      return;
    }

    this.isRunning = true;

    // Start processing interval
    this.processingInterval = setInterval(
      () => this.processQueue(),
      this.config.processingInterval
    );

    logger.info('Sentinel service started', {
      processingInterval: this.config.processingInterval,
      batchSize: this.config.batchSize,
    });
  }

  /**
   * Stop the Sentinel service
   */
  async stop(): Promise<void> {
    this.isRunning = false;

    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }

    // Process remaining queue
    if (this.transactionQueue.length > 0) {
      await this.processQueue();
    }

    logger.info('Sentinel service stopped');
  }

  /**
   * Submit transaction for analysis
   */
  async analyzeTransaction(tx: AnalyzedTransaction): Promise<void> {
    this.transactionQueue.push(tx);

    // Process immediately if queue is large
    if (this.transactionQueue.length >= this.config.batchSize) {
      await this.processQueue();
    }
  }

  /**
   * Submit multiple transactions for analysis
   */
  async analyzeTransactions(txs: AnalyzedTransaction[]): Promise<void> {
    this.transactionQueue.push(...txs);

    // Process immediately if queue is large
    if (this.transactionQueue.length >= this.config.batchSize) {
      await this.processQueue();
    }
  }

  /**
   * Process transaction queue
   */
  private async processQueue(): Promise<void> {
    if (this.transactionQueue.length === 0) return;

    const batch = this.transactionQueue.splice(0, this.config.batchSize);
    
    try {
      const alerts = await this.rulesEngine.processTransactions(batch);

      // Save alerts to database
      for (const alert of alerts) {
        await this.alertManager.saveAlert(alert);
      }

      if (alerts.length > 0) {
        logger.info(`Processed ${batch.length} transactions, generated ${alerts.length} alerts`);
      }
    } catch (error) {
      logger.error('Error processing transaction queue', { error });
      // Re-add to queue for retry
      this.transactionQueue.unshift(...batch);
    }
  }

  /**
   * Get alerts with filtering
   */
  async getAlerts(filter: AlertFilter = {}): Promise<SentinelAlert[]> {
    return this.alertManager.getAlerts(filter);
  }

  /**
   * Get single alert by ID
   */
  async getAlert(alertId: string): Promise<SentinelAlert | null> {
    return this.alertManager.getAlert(alertId);
  }

  /**
   * Process action on alert (requires guardian approval)
   */
  async processAction(request: AlertActionRequest): Promise<AlertActionResponse> {
    return this.alertManager.processAction(request);
  }

  /**
   * Start review of an alert
   */
  async startReview(alertId: string, guardianWallet: string): Promise<SentinelAlert> {
    return this.alertManager.startReview(alertId, guardianWallet);
  }

  /**
   * Register a guardian
   */
  async registerGuardian(guardian: Guardian): Promise<Guardian> {
    // Save to database
    await prisma.sentinelGuardian.upsert({
      where: { wallet: guardian.wallet },
      update: {
        name: guardian.name,
        role: guardian.role,
        canDismiss: guardian.canDismiss,
        canFlag: guardian.canFlag,
        canFreeze: guardian.canFreeze,
        canEscalate: guardian.canEscalate,
        canInitiateClawback: guardian.canInitiateClawback,
      },
      create: {
        wallet: guardian.wallet,
        name: guardian.name,
        role: guardian.role,
        canDismiss: guardian.canDismiss,
        canFlag: guardian.canFlag,
        canFreeze: guardian.canFreeze,
        canEscalate: guardian.canEscalate,
        canInitiateClawback: guardian.canInitiateClawback,
      },
    });

    this.alertManager.registerGuardian(guardian);
    
    logger.info(`Guardian registered: ${guardian.wallet} (${guardian.role})`);
    return guardian;
  }

  /**
   * Get guardian by wallet
   */
  async getGuardian(wallet: string): Promise<Guardian | null> {
    const dbGuardian = await prisma.sentinelGuardian.findUnique({
      where: { wallet },
    });

    if (!dbGuardian) return null;

    return {
      id: dbGuardian.id,
      wallet: dbGuardian.wallet,
      name: dbGuardian.name,
      role: dbGuardian.role as Guardian['role'],
      canDismiss: dbGuardian.canDismiss,
      canFlag: dbGuardian.canFlag,
      canFreeze: dbGuardian.canFreeze,
      canEscalate: dbGuardian.canEscalate,
      canInitiateClawback: dbGuardian.canInitiateClawback,
      alertsReviewed: dbGuardian.alertsReviewed,
      lastActive: dbGuardian.lastActive || new Date(),
    };
  }

  /**
   * List all guardians
   */
  async listGuardians(): Promise<Guardian[]> {
    const guardians = await prisma.sentinelGuardian.findMany({
      orderBy: { role: 'asc' },
    });

    return guardians.map((g: any) => ({
      id: g.id,
      wallet: g.wallet,
      name: g.name,
      role: g.role as Guardian['role'],
      canDismiss: g.canDismiss,
      canFlag: g.canFlag,
      canFreeze: g.canFreeze,
      canEscalate: g.canEscalate,
      canInitiateClawback: g.canInitiateClawback,
      alertsReviewed: g.alertsReviewed,
      lastActive: g.lastActive || new Date(),
    }));
  }

  /**
   * Get Sentinel statistics
   */
  async getStats(periodDays: number = 30): Promise<SentinelStats> {
    return this.alertManager.getStats(periodDays);
  }

  /**
   * Get wallet risk profile
   */
  async getWalletRiskProfile(wallet: string): Promise<WalletProfile | null> {
    // Check local cache first
    const cached = this.rulesEngine.getWalletProfile(wallet);
    if (cached) return cached;

    // Check database
    const dbProfile = await prisma.walletRiskProfile.findUnique({
      where: { wallet },
    });

    if (!dbProfile) return null;

    return {
      address: dbProfile.wallet,
      network: dbProfile.network as WalletProfile['network'],
      firstSeen: dbProfile.firstSeen,
      lastActive: dbProfile.lastActive,
      totalTransactions: dbProfile.totalTransactions,
      totalVolume: dbProfile.totalVolume.toString(),
      averageTransactionSize: '0',
      riskScore: dbProfile.riskScore,
      flagCount: dbProfile.flagCount,
      alertCount: dbProfile.alertCount,
      linkedWallets: dbProfile.linkedWallets,
      clusterScore: dbProfile.clusterScore,
      kycVerified: dbProfile.kycVerified,
      kycLevel: dbProfile.kycLevel || undefined,
    };
  }

  /**
   * Update wallet risk profile
   */
  async updateWalletRiskProfile(profile: WalletProfile): Promise<void> {
    await prisma.walletRiskProfile.upsert({
      where: { wallet: profile.address },
      update: {
        lastActive: profile.lastActive,
        totalTransactions: profile.totalTransactions,
        totalVolume: profile.totalVolume,
        riskScore: profile.riskScore,
        flagCount: profile.flagCount,
        alertCount: profile.alertCount,
        linkedWallets: profile.linkedWallets,
        clusterScore: profile.clusterScore,
        kycVerified: profile.kycVerified,
        kycLevel: profile.kycLevel,
      },
      create: {
        wallet: profile.address,
        network: profile.network,
        firstSeen: profile.firstSeen,
        lastActive: profile.lastActive,
        totalTransactions: profile.totalTransactions,
        totalVolume: profile.totalVolume,
        riskScore: profile.riskScore,
        flagCount: profile.flagCount,
        alertCount: profile.alertCount,
        linkedWallets: profile.linkedWallets,
        clusterScore: profile.clusterScore,
        kycVerified: profile.kycVerified,
        kycLevel: profile.kycLevel,
      },
    });
  }

  /**
   * Link wallets for cluster detection
   */
  linkWallets(wallet1: string, wallet2: string): void {
    this.rulesEngine.linkWallets(wallet1, wallet2);
  }

  /**
   * Get active rules
   */
  getRules(): RuleDefinition[] {
    return this.rulesEngine.getRules();
  }

  /**
   * Enable/disable a rule
   */
  setRuleEnabled(ruleId: string, enabled: boolean): boolean {
    return this.rulesEngine.setRuleEnabled(ruleId, enabled);
  }

  /**
   * Get service status
   */
  getStatus(): {
    isRunning: boolean;
    queueSize: number;
    config: SentinelConfig;
  } {
    return {
      isRunning: this.isRunning,
      queueSize: this.transactionQueue.length,
      config: this.config,
    };
  }
}

// Singleton instance
let sentinelInstance: SentinelService | null = null;

/**
 * Get or create Sentinel service instance
 */
export function getSentinelService(config?: Partial<SentinelConfig>): SentinelService {
  if (!sentinelInstance) {
    sentinelInstance = new SentinelService(config);
  }
  return sentinelInstance;
}

export default SentinelService;
