/**
 * Verity Protocol - Treasury Manager
 * 
 * @module relayer/TreasuryManager
 * @description Manages the relayer treasury wallet for subsidizing user transaction fees.
 * Handles XRP balance tracking, fee payments, and treasury health monitoring.
 */

import { Client, Wallet, Payment, xrpToDrops, dropsToXrp } from 'xrpl';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import {
  RELAYER_CONFIG,
  TreasuryStatus,
  TreasuryHealth,
  FeePaymentResult,
  RelayerTransaction
} from './types.js';

/**
 * Treasury balance thresholds for health monitoring
 */
const TREASURY_THRESHOLDS = {
  /** Critical: Below this, stop all relaying */
  CRITICAL_XRP: 100,
  /** Warning: Below this, alert and reduce limits */
  WARNING_XRP: 500,
  /** Healthy: Above this, normal operation */
  HEALTHY_XRP: 1000,
  /** Reserve requirement per XRPL account */
  ACCOUNT_RESERVE_XRP: 10,
  /** Reserve per trust line */
  TRUSTLINE_RESERVE_XRP: 2
};

/**
 * Treasury metrics tracking
 */
interface TreasuryMetrics {
  totalFeesSpent: number;
  totalTransactionsRelayed: number;
  averageFeePerTransaction: number;
  dailyFeeSpend: number;
  lastRefillTimestamp?: Date;
}

/**
 * Treasury Manager
 * 
 * Manages the relayer's treasury wallet for subsidizing user fees.
 * Features:
 * - Real-time balance monitoring
 * - Fee payment execution
 * - Health status tracking
 * - Circuit breaker integration
 * - Metrics and reporting
 */
export class TreasuryManager extends EventEmitter {
  private client: Client;
  private treasuryWallet: Wallet | null = null;
  private isInitialized: boolean = false;
  private currentBalance: number = 0;
  private reservedBalance: number = 0;
  private metrics: TreasuryMetrics = {
    totalFeesSpent: 0,
    totalTransactionsRelayed: 0,
    averageFeePerTransaction: 0,
    dailyFeeSpend: 0
  };
  private dailyFeeResetTime: Date = new Date();

  constructor() {
    super();
    const network = process.env['XRPL_NETWORK'] || 'testnet';
    const wsUrl = network === 'mainnet'
      ? 'wss://xrplcluster.com'
      : 'wss://s.altnet.rippletest.net:51233';
    
    this.client = new Client(wsUrl);
  }

  /**
   * Initialize treasury manager with wallet
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Connect to XRPL
      if (!this.client.isConnected()) {
        await this.client.connect();
      }

      // Load treasury wallet from environment
      const treasurySeed = process.env['RELAYER_TREASURY_SEED'];
      if (!treasurySeed) {
        throw new Error('RELAYER_TREASURY_SEED environment variable not set');
      }

      this.treasuryWallet = Wallet.fromSeed(treasurySeed);
      
      // Fetch initial balance
      await this.refreshBalance();
      
      // Start periodic balance refresh
      this.startBalanceMonitoring();
      
      this.isInitialized = true;
      
      logger.info('Treasury manager initialized', {
        address: this.treasuryWallet.address,
        balance: this.currentBalance,
        health: this.getHealthStatus()
      });

      this.emit('initialized', {
        address: this.treasuryWallet.address,
        balance: this.currentBalance
      });

    } catch (error) {
      logger.error('Failed to initialize treasury manager', { error });
      throw error;
    }
  }

  /**
   * Get current treasury status
   */
  getTreasuryStatus(): TreasuryStatus {
    return {
      address: this.treasuryWallet?.address || '',
      balance: this.currentBalance,
      reservedBalance: this.reservedBalance,
      availableBalance: this.currentBalance - this.reservedBalance,
      health: this.getHealthStatus(),
      metrics: { ...this.metrics },
      lastUpdated: new Date()
    };
  }

  /**
   * Calculate health status based on balance
   */
  getHealthStatus(): TreasuryHealth {
    const available = this.currentBalance - this.reservedBalance;
    
    if (available < TREASURY_THRESHOLDS.CRITICAL_XRP) {
      return TreasuryHealth.CRITICAL;
    } else if (available < TREASURY_THRESHOLDS.WARNING_XRP) {
      return TreasuryHealth.WARNING;
    } else if (available < TREASURY_THRESHOLDS.HEALTHY_XRP) {
      return TreasuryHealth.DEGRADED;
    }
    return TreasuryHealth.HEALTHY;
  }

  /**
   * Check if treasury can cover a fee
   */
  canCoverFee(feeDrops: string): boolean {
    const feeXRP = parseInt(feeDrops, 10) / 1000000;
    const available = this.currentBalance - this.reservedBalance;
    
    // Check against daily limit
    const dailyLimitXRP = RELAYER_CONFIG.treasury.dailyFeeLimit / 1000000;
    if (this.metrics.dailyFeeSpend + feeXRP > dailyLimitXRP) {
      logger.warn('Daily fee limit reached', {
        dailySpend: this.metrics.dailyFeeSpend,
        requested: feeXRP,
        limit: dailyLimitXRP
      });
      return false;
    }
    
    // Check against max per transaction
    const maxPerTxXRP = RELAYER_CONFIG.treasury.maxFeePerTransaction / 1000000;
    if (feeXRP > maxPerTxXRP) {
      logger.warn('Fee exceeds per-transaction limit', {
        requested: feeXRP,
        limit: maxPerTxXRP
      });
      return false;
    }
    
    // Check available balance (with buffer for reserve)
    const bufferXRP = TREASURY_THRESHOLDS.ACCOUNT_RESERVE_XRP * 2;
    return available - bufferXRP >= feeXRP;
  }

  /**
   * Pay transaction fee from treasury
   * 
   * This doesn't actually send XRP - it tracks that the treasury
   * is sponsoring a user's transaction. The fee is paid when the
   * relayer submits the transaction.
   */
  async reserveFee(
    transactionId: string,
    feeDrops: string,
    userAddress: string
  ): Promise<FeePaymentResult> {
    if (!this.isInitialized) {
      return {
        success: false,
        error: 'Treasury not initialized'
      };
    }

    const feeXRP = parseInt(feeDrops, 10) / 1000000;
    
    // Check if we can cover the fee
    if (!this.canCoverFee(feeDrops)) {
      return {
        success: false,
        error: 'Insufficient treasury balance or limit exceeded'
      };
    }

    try {
      // Reserve the fee
      this.reservedBalance += feeXRP;
      
      // Log the reservation (DB persistence will be added when Prisma model exists)
      logger.debug('Fee reservation logged', { transactionId, feeXRP, userAddress });

      logger.info('Fee reserved', {
        transactionId,
        feeXRP,
        userAddress,
        treasuryBalance: this.currentBalance,
        reservedBalance: this.reservedBalance
      });

      return {
        success: true,
        feeDrops,
        feeXRP,
        transactionId,
        treasuryAddress: this.treasuryWallet?.address
      };

    } catch (error) {
      logger.error('Failed to reserve fee', { error, transactionId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Confirm fee payment after transaction success
   */
  async confirmFeePayment(transactionId: string, actualFeeDrops: string): Promise<void> {
    const actualFeeXRP = parseInt(actualFeeDrops, 10) / 1000000;
    
    // Update metrics
    this.metrics.totalFeesSpent += actualFeeXRP;
    this.metrics.totalTransactionsRelayed++;
    this.metrics.averageFeePerTransaction = 
      this.metrics.totalFeesSpent / this.metrics.totalTransactionsRelayed;
    this.metrics.dailyFeeSpend += actualFeeXRP;
    
    // Release from reserved (might differ from actual)
    // We'll reconcile during balance refresh
    this.reservedBalance = Math.max(0, this.reservedBalance - actualFeeXRP);
    
    // Log confirmation (DB persistence will be added when Prisma model exists)
    logger.debug('Fee confirmation logged', { transactionId, actualFeeXRP });

    logger.info('Fee payment confirmed', {
      transactionId,
      actualFeeXRP,
      totalFeesSpent: this.metrics.totalFeesSpent,
      dailySpend: this.metrics.dailyFeeSpend
    });

    this.emit('feeConfirmed', { transactionId, feeXRP: actualFeeXRP });
    
    // Check health after payment
    const health = this.getHealthStatus();
    if (health !== TreasuryHealth.HEALTHY) {
      this.emit('healthChanged', { health, balance: this.currentBalance });
    }
  }

  /**
   * Release reserved fee if transaction fails
   */
  async releaseReservation(transactionId: string): Promise<void> {
    // Release from reserved balance (simplified - proper tracking will be added)
    logger.info('Fee reservation released', { transactionId });
    this.emit('feeReleased', { transactionId });
  }

  /**
   * Refresh treasury balance from XRPL
   */
  async refreshBalance(): Promise<number> {
    if (!this.treasuryWallet) {
      throw new Error('Treasury wallet not initialized');
    }

    try {
      if (!this.client.isConnected()) {
        await this.client.connect();
      }

      const response = await this.client.request({
        command: 'account_info',
        account: this.treasuryWallet.address,
        ledger_index: 'validated'
      });

      const balanceDrops = response.result.account_data.Balance;
      this.currentBalance = parseInt(String(balanceDrops), 10) / 1000000;
      
      // Calculate owner reserve
      const ownerCount = response.result.account_data.OwnerCount || 0;
      const baseReserve = TREASURY_THRESHOLDS.ACCOUNT_RESERVE_XRP;
      const ownerReserve = ownerCount * TREASURY_THRESHOLDS.TRUSTLINE_RESERVE_XRP;
      
      // Don't count XRPL reserve as "reserved by us"
      // but track it for available balance calculations
      
      logger.debug('Treasury balance refreshed', {
        balance: this.currentBalance,
        ownerCount,
        baseReserve,
        ownerReserve
      });

      // Check if we need to reset daily spend
      this.checkDailyReset();

      return this.currentBalance;

    } catch (error) {
      logger.error('Failed to refresh treasury balance', { error });
      throw error;
    }
  }

  /**
   * Start periodic balance monitoring
   */
  private startBalanceMonitoring(): void {
    // Refresh every 30 seconds
    setInterval(async () => {
      try {
        await this.refreshBalance();
        
        const health = this.getHealthStatus();
        
        // Emit alerts for degraded health
        if (health === TreasuryHealth.CRITICAL) {
          this.emit('critical', {
            message: 'Treasury balance critically low',
            balance: this.currentBalance,
            available: this.currentBalance - this.reservedBalance
          });
        } else if (health === TreasuryHealth.WARNING) {
          this.emit('warning', {
            message: 'Treasury balance low',
            balance: this.currentBalance,
            available: this.currentBalance - this.reservedBalance
          });
        }
      } catch (error) {
        logger.error('Balance monitoring error', { error });
      }
    }, 30000);
  }

  /**
   * Check and reset daily fee spend counter
   */
  private checkDailyReset(): void {
    const now = new Date();
    const resetTime = this.dailyFeeResetTime;
    
    // Reset at midnight UTC
    if (now.getUTCDate() !== resetTime.getUTCDate() ||
        now.getUTCMonth() !== resetTime.getUTCMonth() ||
        now.getUTCFullYear() !== resetTime.getUTCFullYear()) {
      
      logger.info('Resetting daily fee counter', {
        previousDaySpend: this.metrics.dailyFeeSpend
      });
      
      this.metrics.dailyFeeSpend = 0;
      this.dailyFeeResetTime = now;
    }
  }

  /**
   * Get treasury address
   */
  getAddress(): string {
    return this.treasuryWallet?.address || '';
  }

  /**
   * Get current available balance (for external checks)
   */
  getAvailableBalance(): number {
    return this.currentBalance - this.reservedBalance;
  }

  /**
   * Get metrics snapshot
   */
  getMetrics(): TreasuryMetrics {
    return { ...this.metrics };
  }

  /**
   * Estimate how many transactions can be subsidized
   */
  estimateRemainingCapacity(): {
    byBalance: number;
    byDailyLimit: number;
    effective: number;
  } {
    const avgFee = this.metrics.averageFeePerTransaction || 0.000012; // Default XRPL fee
    const available = this.currentBalance - this.reservedBalance - TREASURY_THRESHOLDS.ACCOUNT_RESERVE_XRP;
    const dailyRemaining = (RELAYER_CONFIG.treasury.dailyFeeLimit / 1000000) - this.metrics.dailyFeeSpend;
    
    const byBalance = Math.floor(available / avgFee);
    const byDailyLimit = Math.floor(dailyRemaining / avgFee);
    
    return {
      byBalance,
      byDailyLimit,
      effective: Math.min(byBalance, byDailyLimit)
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down treasury manager', {
      finalBalance: this.currentBalance,
      totalFeesSpent: this.metrics.totalFeesSpent,
      transactionsRelayed: this.metrics.totalTransactionsRelayed
    });
    
    if (this.client.isConnected()) {
      await this.client.disconnect();
    }
    
    this.isInitialized = false;
  }
}

// Export singleton instance
export const treasuryManager = new TreasuryManager();
