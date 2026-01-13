/**
 * Verity Protocol - Release Bot Service
 * Sprint 2 - XRPL Escrow Implementation
 * @module escrow/ReleaseBot
 * @version 1.0.0
 * 
 * Cron service to monitor and release mature XRPL escrows.
 * Features:
 * - Periodic checking for mature escrows
 * - Automatic EscrowFinish transaction submission
 * - Retry logic for failed releases
 * - Sequence number management
 */

import { Client, Wallet, EscrowFinish } from 'xrpl';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import {
  EscrowStatus,
  EscrowRecord,
  ReleaseBotConfig,
  ReleaseBotStatus,
  RIPPLE_EPOCH_OFFSET,
  unixToRippleTime,
  rippleTimeToUnix,
  isEscrowMature,
} from './types.js';
import {
  getXRPLUrl,
  DEFAULT_RELEASE_BOT_CONFIG,
  ESCROW_ERROR_CODES,
  ESCROW_MEMO_TYPES,
  memoToHex,
} from './config.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Pending release information
 */
interface PendingRelease {
  escrowId: string;
  scheduleId: string;
  owner: string;
  sequence: number;
  destination: string;
  amount: string;
  finishAfter: number;
  condition?: string;
  retryCount: number;
  lastAttempt?: Date;
  error?: string;
}

/**
 * Release result
 */
interface ReleaseResult {
  success: boolean;
  escrowId: string;
  txHash?: string;
  error?: string;
}

// ============================================================================
// Release Bot Class
// ============================================================================

/**
 * Release Bot Service
 * 
 * Monitors XRPL escrows and automatically releases mature ones.
 */
export class ReleaseBot extends EventEmitter {
  private client: Client;
  private botWallet: Wallet | null = null;
  private config: ReleaseBotConfig;
  private isRunning: boolean = false;
  private checkInterval: NodeJS.Timeout | null = null;
  private pendingReleases: Map<string, PendingRelease> = new Map();
  
  // Statistics
  private stats = {
    escrowsProcessed: 0,
    escrowsReleased: 0,
    escrowsFailed: 0,
    lastCheck: null as Date | null,
    lastRelease: null as Date | null,
  };

  constructor(config: Partial<ReleaseBotConfig> = {}) {
    super();
    this.config = { ...DEFAULT_RELEASE_BOT_CONFIG, ...config };
    this.client = new Client(getXRPLUrl());
  }

  /**
   * Initialize the release bot
   */
  async initialize(): Promise<void> {
    try {
      if (!this.client.isConnected()) {
        await this.client.connect();
      }

      // Load bot wallet from environment
      const botSeed = process.env['RELEASE_BOT_WALLET_SEED'];
      if (botSeed) {
        this.botWallet = Wallet.fromSeed(botSeed);
        logger.info('Release bot initialized with wallet', {
          address: this.botWallet.address
        });

        // Check wallet balance
        const balance = await this.getWalletBalance();
        if (balance < this.config.minWalletBalance) {
          logger.warn('Release bot wallet balance is low', {
            balance,
            minimum: this.config.minWalletBalance
          });
        }
      } else {
        logger.warn('No RELEASE_BOT_WALLET_SEED configured - bot cannot release escrows');
      }

      this.emit('initialized');
      logger.info('Release bot initialized', { config: this.config });

    } catch (error) {
      logger.error('Failed to initialize release bot', { error });
      throw error;
    }
  }

  /**
   * Start the release bot
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Release bot is already running');
      return;
    }

    await this.initialize();

    this.isRunning = true;
    logger.info('Release bot started', {
      checkIntervalMs: this.config.checkIntervalMs,
      batchSize: this.config.batchSize,
      dryRun: this.config.dryRun,
    });

    // Run initial check
    await this.checkAndReleaseMatureEscrows();

    // Set up periodic checking
    this.checkInterval = setInterval(
      () => this.checkAndReleaseMatureEscrows(),
      this.config.checkIntervalMs
    );

    this.emit('started');
  }

  /**
   * Stop the release bot
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    if (this.client.isConnected()) {
      await this.client.disconnect();
    }

    logger.info('Release bot stopped', { stats: this.stats });
    this.emit('stopped');
  }

  /**
   * Check for and release mature escrows
   */
  async checkAndReleaseMatureEscrows(): Promise<void> {
    if (!this.isRunning || !this.botWallet) {
      return;
    }

    this.stats.lastCheck = new Date();
    logger.debug('Checking for mature escrows');

    try {
      // Get pending escrows that are now mature
      const matureEscrows = await this.getMatureEscrows();

      if (matureEscrows.length === 0) {
        logger.debug('No mature escrows found');
        return;
      }

      logger.info('Found mature escrows', { count: matureEscrows.length });

      // Process in batches
      const batch = matureEscrows.slice(0, this.config.batchSize);
      const results: ReleaseResult[] = [];

      for (const escrow of batch) {
        const result = await this.releaseEscrow(escrow);
        results.push(result);
        this.stats.escrowsProcessed++;

        if (result.success) {
          this.stats.escrowsReleased++;
          this.stats.lastRelease = new Date();
        } else {
          this.stats.escrowsFailed++;
        }

        // Small delay between releases
        await this.delay(500);
      }

      // Emit batch completion event
      this.emit('batchCompleted', { results });

    } catch (error) {
      logger.error('Error checking mature escrows', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get mature escrows ready for release
   */
  private async getMatureEscrows(): Promise<PendingRelease[]> {
    // In production, this would query the database for pending escrows
    // For now, we return escrows from the pending releases map that are mature
    const matureEscrows: PendingRelease[] = [];
    const now = Math.floor(Date.now() / 1000);
    const rippleNow = unixToRippleTime(now);

    for (const [escrowId, release] of this.pendingReleases) {
      if (release.finishAfter <= rippleNow) {
        matureEscrows.push(release);
      }
    }

    return matureEscrows;
  }

  /**
   * Release a single escrow
   */
  async releaseEscrow(escrow: PendingRelease): Promise<ReleaseResult> {
    if (!this.botWallet) {
      return {
        success: false,
        escrowId: escrow.escrowId,
        error: 'Bot wallet not configured',
      };
    }

    logger.info('Releasing escrow', {
      escrowId: escrow.escrowId,
      owner: escrow.owner,
      sequence: escrow.sequence,
      dryRun: this.config.dryRun,
    });

    // Dry run mode
    if (this.config.dryRun) {
      logger.info('DRY RUN: Would release escrow', { escrowId: escrow.escrowId });
      return {
        success: true,
        escrowId: escrow.escrowId,
        txHash: `DRY_RUN_${escrow.escrowId}`,
      };
    }

    try {
      // Build EscrowFinish transaction
      const escrowFinish: EscrowFinish = {
        TransactionType: 'EscrowFinish',
        Account: this.botWallet.address,
        Owner: escrow.owner,
        OfferSequence: escrow.sequence,
        Memos: [
          {
            Memo: {
              MemoType: memoToHex(ESCROW_MEMO_TYPES.VESTING_RELEASE),
              MemoData: memoToHex(JSON.stringify({
                escrowId: escrow.escrowId,
                scheduleId: escrow.scheduleId,
                releasedBy: this.botWallet.address,
                timestamp: new Date().toISOString(),
              })),
            },
          },
        ],
      };

      // Add condition fulfillment if required
      if (escrow.condition) {
        // In production, would need to provide the fulfillment
        logger.warn('Conditional escrow requires fulfillment', {
          escrowId: escrow.escrowId
        });
      }

      // Prepare and sign transaction
      const prepared = await this.client.autofill(escrowFinish);
      const signed = this.botWallet.sign(prepared);

      // Submit transaction
      const result = await this.client.submitAndWait(signed.tx_blob);

      if (result.result.meta && typeof result.result.meta !== 'string') {
        const transactionResult = result.result.meta.TransactionResult;
        
        if (transactionResult === 'tesSUCCESS') {
          logger.info('Escrow released successfully', {
            escrowId: escrow.escrowId,
            txHash: result.result.hash,
          });

          // Remove from pending releases
          this.pendingReleases.delete(escrow.escrowId);

          this.emit('escrowReleased', {
            escrowId: escrow.escrowId,
            scheduleId: escrow.scheduleId,
            txHash: result.result.hash,
            amount: escrow.amount,
          });

          return {
            success: true,
            escrowId: escrow.escrowId,
            txHash: result.result.hash,
          };
        }

        // Handle failure
        const error = `Transaction failed: ${transactionResult}`;
        await this.handleReleaseFailed(escrow, error);
        
        return {
          success: false,
          escrowId: escrow.escrowId,
          error,
        };
      }

      return {
        success: false,
        escrowId: escrow.escrowId,
        error: 'Unknown transaction result',
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.handleReleaseFailed(escrow, errorMessage);
      
      return {
        success: false,
        escrowId: escrow.escrowId,
        error: errorMessage,
      };
    }
  }

  /**
   * Handle failed release - implement retry logic
   */
  private async handleReleaseFailed(escrow: PendingRelease, error: string): Promise<void> {
    escrow.retryCount++;
    escrow.lastAttempt = new Date();
    escrow.error = error;

    if (escrow.retryCount >= this.config.maxRetries) {
      logger.error('Escrow release failed after max retries', {
        escrowId: escrow.escrowId,
        retryCount: escrow.retryCount,
        error,
      });

      // Remove from pending and mark as failed in database
      this.pendingReleases.delete(escrow.escrowId);
      
      this.emit('escrowFailed', {
        escrowId: escrow.escrowId,
        scheduleId: escrow.scheduleId,
        error,
        retryCount: escrow.retryCount,
      });
    } else {
      logger.warn('Escrow release failed, will retry', {
        escrowId: escrow.escrowId,
        retryCount: escrow.retryCount,
        maxRetries: this.config.maxRetries,
        error,
      });

      // Update pending release for retry
      this.pendingReleases.set(escrow.escrowId, escrow);
    }
  }

  /**
   * Add an escrow to the pending releases queue
   */
  addPendingRelease(release: PendingRelease): void {
    this.pendingReleases.set(release.escrowId, release);
    logger.debug('Added pending release', { escrowId: release.escrowId });
  }

  /**
   * Remove an escrow from the pending releases queue
   */
  removePendingRelease(escrowId: string): void {
    this.pendingReleases.delete(escrowId);
  }

  /**
   * Get wallet balance
   */
  private async getWalletBalance(): Promise<number> {
    if (!this.botWallet) return 0;

    try {
      const response = await this.client.request({
        command: 'account_info',
        account: this.botWallet.address,
      });

      return Number(response.result.account_data.Balance) / 1_000_000;
    } catch {
      return 0;
    }
  }

  /**
   * Get bot status
   */
  async getStatus(): Promise<ReleaseBotStatus> {
    const balance = await this.getWalletBalance();

    return {
      running: this.isRunning,
      lastCheck: this.stats.lastCheck,
      lastRelease: this.stats.lastRelease,
      escrowsProcessed: this.stats.escrowsProcessed,
      escrowsReleased: this.stats.escrowsReleased,
      escrowsFailed: this.stats.escrowsFailed,
      pendingEscrows: this.pendingReleases.size,
      nextScheduledCheck: this.isRunning
        ? new Date(Date.now() + this.config.checkIntervalMs)
        : null,
      walletBalance: String(balance),
      walletAddress: this.botWallet?.address || 'Not configured',
    };
  }

  /**
   * Update bot configuration
   */
  updateConfig(config: Partial<ReleaseBotConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Restart interval if running
    if (this.isRunning && this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = setInterval(
        () => this.checkAndReleaseMatureEscrows(),
        this.config.checkIntervalMs
      );
    }

    logger.info('Release bot config updated', { config: this.config });
  }

  /**
   * Force check for mature escrows (manual trigger)
   */
  async forceCheck(): Promise<void> {
    logger.info('Force checking for mature escrows');
    await this.checkAndReleaseMatureEscrows();
  }

  /**
   * Get pending releases count
   */
  get pendingCount(): number {
    return this.pendingReleases.size;
  }

  /**
   * Check if bot is running
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Helper: delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const releaseBot = new ReleaseBot();
export default ReleaseBot;
