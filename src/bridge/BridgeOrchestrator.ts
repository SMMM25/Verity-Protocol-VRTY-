/**
 * Verity Protocol - Bridge Orchestrator
 * 
 * @module bridge/BridgeOrchestrator
 * @description Production-ready orchestration service for cross-chain bridge operations.
 * Coordinates between validators, relayers, and monitors for complete bridge lifecycle.
 * 
 * Architecture:
 * - Manages bridge transaction lifecycle from initiation to completion
 * - Coordinates validator consensus for multi-sig verification
 * - Handles automatic retry and recovery mechanisms
 * - Provides real-time status updates via WebSocket
 * 
 * @version 1.0.0
 * @since Phase 4 - Cross-Chain Bridge
 */

import { EventEmitter } from 'eventemitter3';
import { prisma } from '../db/client.js';
import { logger } from '../utils/logger.js';
import { solanaBridge } from './SolanaBridge.js';
import { validatorRegistry, ValidatorNode, ValidatorConfig } from './ValidatorNode.js';
import type { BridgeStatus, BridgeDirection } from '@prisma/client';

// ============================================================
// TYPES
// ============================================================

export interface BridgeOrchestratorConfig {
  requiredValidators: number;
  maxRetryAttempts: number;
  retryDelayMs: number;
  transactionTimeoutMs: number;
  enableAutomaticRecovery: boolean;
  enableWebSocketNotifications: boolean;
}

export interface BridgeInitiationRequest {
  direction: BridgeDirection;
  sourceChain: string;
  destinationChain: string;
  sourceAddress: string;
  destinationAddress: string;
  amount: number;
  userWallet: string;
}

export interface BridgeInitiationResult {
  success: boolean;
  bridgeId?: string;
  status?: BridgeStatus;
  estimatedCompletionTime?: Date;
  fee?: number;
  error?: string;
}

export interface BridgeStatusResult {
  bridgeId: string;
  direction: BridgeDirection;
  status: BridgeStatus;
  sourceChain: string;
  destinationChain: string;
  sourceAddress: string;
  destinationAddress: string;
  amount: number;
  fee: number;
  sourceTxHash?: string;
  destinationTxHash?: string;
  validatorSignatures: number;
  requiredSignatures: number;
  retryCount: number;
  errorMessage?: string;
  createdAt: Date;
  completedAt?: Date;
}

export interface OrchestratorStats {
  totalTransactions: number;
  completedTransactions: number;
  pendingTransactions: number;
  failedTransactions: number;
  totalVolume: number;
  averageCompletionTimeMs: number;
  validatorCount: number;
  hasQuorum: boolean;
}

// ============================================================
// CONSTANTS
// ============================================================

const DEFAULT_CONFIG: BridgeOrchestratorConfig = {
  requiredValidators: 3,
  maxRetryAttempts: 3,
  retryDelayMs: 30000, // 30 seconds
  transactionTimeoutMs: 3600000, // 1 hour
  enableAutomaticRecovery: true,
  enableWebSocketNotifications: true,
};

const BRIDGE_STATUS_FLOW: Record<BridgeStatus, BridgeStatus[]> = {
  'INITIATED': ['LOCKED', 'FAILED'],
  'LOCKED': ['VALIDATING', 'FAILED'],
  'VALIDATING': ['MINTING', 'RELEASING', 'FAILED'],
  'MINTING': ['COMPLETED', 'FAILED'],
  'RELEASING': ['COMPLETED', 'FAILED'],
  'COMPLETED': [],
  'FAILED': ['REFUNDED'],
  'REFUNDED': [],
};

// ============================================================
// BRIDGE ORCHESTRATOR CLASS
// ============================================================

export class BridgeOrchestrator extends EventEmitter {
  private config: BridgeOrchestratorConfig;
  private isRunning: boolean = false;
  private recoveryInterval: NodeJS.Timeout | null = null;
  private statusCheckInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<BridgeOrchestratorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    logger.info('Bridge Orchestrator initialized', {
      requiredValidators: this.config.requiredValidators,
      maxRetryAttempts: this.config.maxRetryAttempts,
    });
  }

  // ============================================================
  // LIFECYCLE METHODS
  // ============================================================

  /**
   * Start the orchestrator service
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Bridge Orchestrator already running');
      return;
    }

    this.isRunning = true;

    // Start validator registry
    await validatorRegistry.startAll();

    // Start automatic recovery if enabled
    if (this.config.enableAutomaticRecovery) {
      this.recoveryInterval = setInterval(
        () => this.runRecoveryCheck(),
        60000 // Check every minute
      );
    }

    // Start periodic status checks
    this.statusCheckInterval = setInterval(
      () => this.runStatusCheck(),
      30000 // Check every 30 seconds
    );

    logger.info('Bridge Orchestrator started');
    this.emit('started');
  }

  /**
   * Stop the orchestrator service
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    // Stop intervals
    if (this.recoveryInterval) {
      clearInterval(this.recoveryInterval);
      this.recoveryInterval = null;
    }

    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = null;
    }

    // Stop validator registry
    await validatorRegistry.stopAll();

    logger.info('Bridge Orchestrator stopped');
    this.emit('stopped');
  }

  /**
   * Check if orchestrator has quorum
   */
  hasQuorum(): boolean {
    return validatorRegistry.hasQuorum();
  }

  // ============================================================
  // BRIDGE INITIATION
  // ============================================================

  /**
   * Initiate a new bridge transaction
   */
  async initiateBridge(request: BridgeInitiationRequest): Promise<BridgeInitiationResult> {
    logger.info('Initiating bridge transaction', {
      direction: request.direction,
      amount: request.amount,
    });

    try {
      // Check quorum
      if (!this.hasQuorum()) {
        return {
          success: false,
          error: 'Insufficient validators available. Please try again later.',
        };
      }

      // Validate request
      const validationError = this.validateBridgeRequest(request);
      if (validationError) {
        return { success: false, error: validationError };
      }

      // Calculate fee
      const fee = this.calculateBridgeFee(request.amount, request.destinationChain);

      // Create verification hash
      const verificationHash = this.generateVerificationHash(request);

      // Create bridge transaction in database
      const bridgeTransaction = await prisma.bridgeTransaction.create({
        data: {
          direction: request.direction,
          sourceChain: request.sourceChain,
          destinationChain: request.destinationChain,
          sourceAddress: request.sourceAddress,
          destinationAddress: request.destinationAddress,
          amount: request.amount,
          fee,
          status: 'INITIATED',
          verificationHash,
          validatorSignatures: [],
        },
      });

      // Log audit entry
      await prisma.auditLog.create({
        data: {
          action: 'BRIDGE_INITIATED',
          actor: request.userWallet,
          entityType: 'BRIDGE_TRANSACTION',
          entityId: bridgeTransaction.id,
          metadata: {
            direction: request.direction,
            amount: request.amount,
            fee,
            sourceChain: request.sourceChain,
            destinationChain: request.destinationChain,
          },
        },
      });

      // Emit event for WebSocket notifications
      this.emit('bridgeInitiated', {
        bridgeId: bridgeTransaction.id,
        ...request,
        fee,
      });

      // Estimate completion time (10-15 minutes for most cases)
      const estimatedCompletionTime = new Date(Date.now() + 15 * 60 * 1000);

      return {
        success: true,
        bridgeId: bridgeTransaction.id,
        status: 'INITIATED',
        estimatedCompletionTime,
        fee,
      };
    } catch (error) {
      logger.error('Failed to initiate bridge', {
        error: (error as Error).message,
      });
      return {
        success: false,
        error: 'Failed to initiate bridge transaction. Please try again.',
      };
    }
  }

  /**
   * Validate bridge request
   */
  private validateBridgeRequest(request: BridgeInitiationRequest): string | null {
    // Amount validation
    if (request.amount < 100) {
      return 'Minimum bridge amount is 100 VRTY';
    }
    if (request.amount > 1000000) {
      return 'Maximum bridge amount is 1,000,000 VRTY';
    }

    // Address validation
    if (!request.sourceAddress || !request.destinationAddress) {
      return 'Source and destination addresses are required';
    }

    // Chain validation
    const supportedChains = ['XRPL', 'SOLANA', 'ETHEREUM', 'POLYGON', 'BSC', 'ARBITRUM', 'OPTIMISM'];
    if (!supportedChains.includes(request.sourceChain)) {
      return `Unsupported source chain: ${request.sourceChain}`;
    }
    if (!supportedChains.includes(request.destinationChain)) {
      return `Unsupported destination chain: ${request.destinationChain}`;
    }

    // Can't bridge to same chain
    if (request.sourceChain === request.destinationChain) {
      return 'Source and destination chains must be different';
    }

    return null;
  }

  /**
   * Calculate bridge fee
   */
  private calculateBridgeFee(amount: number, destinationChain: string): number {
    // Base fee + percentage
    const baseFees: Record<string, number> = {
      'SOLANA': 10,
      'ETHEREUM': 25,
      'POLYGON': 10,
      'BSC': 10,
      'ARBITRUM': 15,
      'OPTIMISM': 15,
      'XRPL': 5,
    };

    const percentageFees: Record<string, number> = {
      'SOLANA': 0.1,
      'ETHEREUM': 0.25,
      'POLYGON': 0.1,
      'BSC': 0.1,
      'ARBITRUM': 0.15,
      'OPTIMISM': 0.15,
      'XRPL': 0.05,
    };

    const baseFee = baseFees[destinationChain] || 15;
    const percentageFee = percentageFees[destinationChain] || 0.15;
    const percentageAmount = amount * (percentageFee / 100);

    return Math.max(baseFee, baseFee + percentageAmount);
  }

  /**
   * Generate verification hash
   */
  private generateVerificationHash(request: BridgeInitiationRequest): string {
    const crypto = require('crypto');
    const data = JSON.stringify({
      direction: request.direction,
      sourceChain: request.sourceChain,
      destinationChain: request.destinationChain,
      sourceAddress: request.sourceAddress,
      destinationAddress: request.destinationAddress,
      amount: request.amount,
      timestamp: Date.now(),
      nonce: crypto.randomBytes(16).toString('hex'),
    });
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  // ============================================================
  // STATUS & QUERIES
  // ============================================================

  /**
   * Get bridge transaction status
   */
  async getBridgeStatus(bridgeId: string): Promise<BridgeStatusResult | null> {
    try {
      const transaction = await prisma.bridgeTransaction.findUnique({
        where: { id: bridgeId },
        include: {
          signatures: true,
        },
      });

      if (!transaction) {
        return null;
      }

      const validatorSignatures = transaction.signatures?.length || 
        (transaction.validatorSignatures as any[])?.length || 0;

      return {
        bridgeId: transaction.id,
        direction: transaction.direction,
        status: transaction.status,
        sourceChain: transaction.sourceChain,
        destinationChain: transaction.destinationChain,
        sourceAddress: transaction.sourceAddress,
        destinationAddress: transaction.destinationAddress,
        amount: Number(transaction.amount),
        fee: Number(transaction.fee),
        sourceTxHash: transaction.sourceTxHash || undefined,
        destinationTxHash: transaction.destinationTxHash || undefined,
        validatorSignatures,
        requiredSignatures: this.config.requiredValidators,
        retryCount: transaction.retryCount,
        errorMessage: transaction.errorMessage || undefined,
        createdAt: transaction.createdAt,
        completedAt: transaction.completedAt || undefined,
      };
    } catch (error) {
      logger.error('Failed to get bridge status', {
        bridgeId,
        error: (error as Error).message,
      });
      return null;
    }
  }

  /**
   * Get user's bridge history
   */
  async getUserBridgeHistory(
    userAddress: string,
    options: { limit?: number; offset?: number; status?: BridgeStatus } = {}
  ): Promise<BridgeStatusResult[]> {
    const { limit = 20, offset = 0, status } = options;

    try {
      const transactions = await prisma.bridgeTransaction.findMany({
        where: {
          OR: [
            { sourceAddress: userAddress },
            { destinationAddress: userAddress },
          ],
          ...(status && { status }),
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          signatures: true,
        },
      });

      return transactions.map((tx) => ({
        bridgeId: tx.id,
        direction: tx.direction,
        status: tx.status,
        sourceChain: tx.sourceChain,
        destinationChain: tx.destinationChain,
        sourceAddress: tx.sourceAddress,
        destinationAddress: tx.destinationAddress,
        amount: Number(tx.amount),
        fee: Number(tx.fee),
        sourceTxHash: tx.sourceTxHash || undefined,
        destinationTxHash: tx.destinationTxHash || undefined,
        validatorSignatures: tx.signatures?.length || (tx.validatorSignatures as any[])?.length || 0,
        requiredSignatures: this.config.requiredValidators,
        retryCount: tx.retryCount,
        errorMessage: tx.errorMessage || undefined,
        createdAt: tx.createdAt,
        completedAt: tx.completedAt || undefined,
      }));
    } catch (error) {
      logger.error('Failed to get user bridge history', {
        userAddress,
        error: (error as Error).message,
      });
      return [];
    }
  }

  /**
   * Get orchestrator statistics
   */
  async getStats(): Promise<OrchestratorStats> {
    try {
      const [
        totalTransactions,
        completedTransactions,
        pendingTransactions,
        failedTransactions,
        volumeResult,
      ] = await Promise.all([
        prisma.bridgeTransaction.count(),
        prisma.bridgeTransaction.count({ where: { status: 'COMPLETED' } }),
        prisma.bridgeTransaction.count({
          where: { status: { in: ['INITIATED', 'LOCKED', 'VALIDATING', 'MINTING', 'RELEASING'] } },
        }),
        prisma.bridgeTransaction.count({ where: { status: 'FAILED' } }),
        prisma.bridgeTransaction.aggregate({
          where: { status: 'COMPLETED' },
          _sum: { amount: true },
        }),
      ]);

      // Calculate average completion time
      const completedTxs = await prisma.bridgeTransaction.findMany({
        where: { status: 'COMPLETED', completedAt: { not: null } },
        select: { createdAt: true, completedAt: true },
        take: 100,
        orderBy: { completedAt: 'desc' },
      });

      let averageCompletionTimeMs = 600000; // Default 10 minutes
      if (completedTxs.length > 0) {
        const totalTime = completedTxs.reduce((sum, tx) => {
          if (tx.completedAt) {
            return sum + (tx.completedAt.getTime() - tx.createdAt.getTime());
          }
          return sum;
        }, 0);
        averageCompletionTimeMs = totalTime / completedTxs.length;
      }

      const validatorStats = validatorRegistry.getStats();

      return {
        totalTransactions,
        completedTransactions,
        pendingTransactions,
        failedTransactions,
        totalVolume: Number(volumeResult._sum.amount || 0),
        averageCompletionTimeMs,
        validatorCount: validatorStats.activeValidators,
        hasQuorum: validatorStats.hasQuorum,
      };
    } catch (error) {
      logger.error('Failed to get orchestrator stats', {
        error: (error as Error).message,
      });
      return {
        totalTransactions: 0,
        completedTransactions: 0,
        pendingTransactions: 0,
        failedTransactions: 0,
        totalVolume: 0,
        averageCompletionTimeMs: 0,
        validatorCount: 0,
        hasQuorum: false,
      };
    }
  }

  // ============================================================
  // RECOVERY & STATUS CHECKS
  // ============================================================

  /**
   * Run automatic recovery check for stuck transactions
   */
  private async runRecoveryCheck(): Promise<void> {
    if (!this.isRunning) return;

    try {
      // Find transactions stuck in intermediate states
      const stuckTransactions = await prisma.bridgeTransaction.findMany({
        where: {
          status: { in: ['INITIATED', 'LOCKED', 'VALIDATING', 'MINTING', 'RELEASING'] },
          createdAt: {
            lt: new Date(Date.now() - this.config.transactionTimeoutMs),
          },
          retryCount: { lt: this.config.maxRetryAttempts },
        },
        take: 10,
      });

      for (const tx of stuckTransactions) {
        logger.info('Attempting recovery for stuck transaction', {
          bridgeId: tx.id,
          status: tx.status,
          retryCount: tx.retryCount,
        });

        await this.retryTransaction(tx.id);
      }

      // Mark transactions that exceeded retry limit as failed
      await prisma.bridgeTransaction.updateMany({
        where: {
          status: { in: ['INITIATED', 'LOCKED', 'VALIDATING', 'MINTING', 'RELEASING'] },
          createdAt: {
            lt: new Date(Date.now() - this.config.transactionTimeoutMs),
          },
          retryCount: { gte: this.config.maxRetryAttempts },
        },
        data: {
          status: 'FAILED',
          errorMessage: 'Transaction timed out after maximum retry attempts',
        },
      });
    } catch (error) {
      logger.error('Recovery check failed', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Run periodic status check
   */
  private async runStatusCheck(): Promise<void> {
    if (!this.isRunning) return;

    try {
      // Check validator quorum
      const hasQuorum = this.hasQuorum();
      if (!hasQuorum) {
        logger.warn('Validator quorum lost');
        this.emit('quorumLost');
      }

      // Emit stats update
      const stats = await this.getStats();
      this.emit('statsUpdate', stats);
    } catch (error) {
      logger.error('Status check failed', {
        error: (error as Error).message,
      });
    }
  }

  /**
   * Retry a failed or stuck transaction
   */
  async retryTransaction(bridgeId: string): Promise<boolean> {
    try {
      const transaction = await prisma.bridgeTransaction.findUnique({
        where: { id: bridgeId },
      });

      if (!transaction) {
        return false;
      }

      // Increment retry count
      await prisma.bridgeTransaction.update({
        where: { id: bridgeId },
        data: {
          retryCount: { increment: 1 },
          errorMessage: null, // Clear previous error
        },
      });

      // Reset status based on current state
      const resetStatus = this.getResetStatus(transaction.status);
      if (resetStatus !== transaction.status) {
        await prisma.bridgeTransaction.update({
          where: { id: bridgeId },
          data: { status: resetStatus },
        });
      }

      logger.info('Transaction retry initiated', {
        bridgeId,
        previousStatus: transaction.status,
        newStatus: resetStatus,
        retryCount: transaction.retryCount + 1,
      });

      this.emit('transactionRetried', {
        bridgeId,
        retryCount: transaction.retryCount + 1,
      });

      return true;
    } catch (error) {
      logger.error('Failed to retry transaction', {
        bridgeId,
        error: (error as Error).message,
      });
      return false;
    }
  }

  /**
   * Get reset status for retry
   */
  private getResetStatus(currentStatus: BridgeStatus): BridgeStatus {
    switch (currentStatus) {
      case 'VALIDATING':
      case 'MINTING':
      case 'RELEASING':
        return 'LOCKED';
      case 'LOCKED':
        return 'INITIATED';
      default:
        return currentStatus;
    }
  }

  // ============================================================
  // VALIDATOR MANAGEMENT
  // ============================================================

  /**
   * Add a new validator node
   */
  async addValidator(config: ValidatorConfig): Promise<void> {
    const node = new ValidatorNode(config);
    validatorRegistry.registerValidator(node);
    await node.start();
    
    logger.info('Validator added to orchestrator', {
      validatorId: config.validatorId,
    });
  }

  /**
   * Remove a validator node
   */
  async removeValidator(validatorId: string): Promise<void> {
    await validatorRegistry.removeValidator(validatorId);
    
    logger.info('Validator removed from orchestrator', {
      validatorId,
    });
  }

  /**
   * Get active validators
   */
  getActiveValidators(): any[] {
    return validatorRegistry.getActiveValidators();
  }
}

// ============================================================
// EXPORTS
// ============================================================

export const bridgeOrchestrator = new BridgeOrchestrator();

export default BridgeOrchestrator;
