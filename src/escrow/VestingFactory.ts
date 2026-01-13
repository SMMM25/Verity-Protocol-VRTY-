/**
 * Verity Protocol - Vesting Factory
 * Sprint 2 - XRPL Escrow Implementation
 * @module escrow/VestingFactory
 * @version 1.0.0
 * 
 * Factory for creating XRPL escrow-based vesting schedules.
 * Generates batch EscrowCreate transactions for LINEAR, CLIFF, and CLIFF_LINEAR vesting.
 */

import { Client, Wallet, EscrowCreate, xrpToDrops } from 'xrpl';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import {
  VestingType,
  VestingStatus,
  EscrowStatus,
  VestingScheduleConfig,
  VestingSchedule,
  EscrowRecord,
  EscrowCreateResult,
  RIPPLE_EPOCH_OFFSET,
  unixToRippleTime,
} from './types.js';
import {
  XRPL_CONFIG,
  getXRPLUrl,
  VRTY_TOKEN,
  ESCROW_LIMITS,
  ESCROW_ERROR_CODES,
  ESCROW_MEMO_TYPES,
  memoToHex,
  validateEscrowAmount,
  validateVestingDuration,
} from './config.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Escrow creation parameters for a single escrow
 */
interface EscrowTranche {
  index: number;
  amount: string;
  finishAfterUnix: number;
  finishAfterRipple: number;
  cancelAfterUnix?: number;
  cancelAfterRipple?: number;
}

/**
 * Internal vesting creation response
 */
interface CreateVestingResponse {
  success: boolean;
  scheduleId?: string;
  escrowCount?: number;
  txHashes?: string[];
  error?: string;
  errorCode?: string;
}

// ============================================================================
// Vesting Factory Class
// ============================================================================

/**
 * Vesting Factory
 * 
 * Creates and manages XRPL escrow-based vesting schedules.
 * Features:
 * - LINEAR: Equal amounts released each period
 * - CLIFF: All tokens after cliff period
 * - CLIFF_LINEAR: Cliff followed by linear vesting
 * - CancelAfter support for regulatory compliance
 * - Batch escrow creation
 */
export class VestingFactory extends EventEmitter {
  private client: Client;
  private vestingWallet: Wallet | null = null;
  private isInitialized: boolean = false;

  constructor() {
    super();
    this.client = new Client(getXRPLUrl());
  }

  /**
   * Initialize vesting factory
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      if (!this.client.isConnected()) {
        await this.client.connect();
      }

      // Load vesting wallet from environment
      const vestingSeed = process.env['VESTING_WALLET_SEED'];
      if (vestingSeed) {
        this.vestingWallet = Wallet.fromSeed(vestingSeed);
        logger.info('Vesting factory initialized with wallet', {
          address: this.vestingWallet.address
        });
      } else {
        logger.warn('No VESTING_WALLET_SEED configured');
      }

      this.isInitialized = true;
      this.emit('initialized');

    } catch (error) {
      logger.error('Failed to initialize vesting factory', { error });
      throw error;
    }
  }

  /**
   * Create a new vesting schedule
   * 
   * Generates multiple EscrowCreate transactions based on the vesting type.
   */
  async createVestingSchedule(
    config: VestingScheduleConfig,
    signerWallet?: Wallet
  ): Promise<CreateVestingResponse> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const scheduleId = config.scheduleId || `VS-${uuidv4().substring(0, 8).toUpperCase()}`;

    try {
      // Validate configuration
      const validationResult = this.validateConfig(config);
      if (!validationResult.valid) {
        return {
          success: false,
          error: validationResult.error,
          errorCode: ESCROW_ERROR_CODES.INVALID_SCHEDULE,
        };
      }

      // Generate escrow tranches
      const tranches = this.generateTranches(config);

      logger.info('Creating vesting schedule', {
        scheduleId,
        beneficiary: config.beneficiary,
        totalAmount: config.totalAmount,
        vestingType: config.vestingType,
        escrowCount: tranches.length,
      });

      // Use provided wallet or default vesting wallet
      const wallet = signerWallet || this.vestingWallet;
      if (!wallet) {
        return {
          success: false,
          error: 'No wallet available for signing transactions',
          errorCode: ESCROW_ERROR_CODES.UNAUTHORIZED,
        };
      }

      // Create escrows in batches
      const txHashes: string[] = [];
      const batchSize = ESCROW_LIMITS.MAX_BATCH_SIZE;

      for (let i = 0; i < tranches.length; i += batchSize) {
        const batch = tranches.slice(i, i + batchSize);
        
        for (const tranche of batch) {
          const result = await this.createSingleEscrow(
            wallet,
            config,
            tranche,
            scheduleId
          );

          if (result.success && result.txHash) {
            txHashes.push(result.txHash);
          } else {
            logger.warn('Failed to create escrow tranche', {
              scheduleId,
              trancheIndex: tranche.index,
              error: result.error,
            });
          }

          // Small delay between transactions
          await this.delay(500);
        }
      }

      if (txHashes.length === 0) {
        return {
          success: false,
          error: 'Failed to create any escrows',
          errorCode: ESCROW_ERROR_CODES.TRANSACTION_FAILED,
        };
      }

      logger.info('Vesting schedule created', {
        scheduleId,
        escrowsCreated: txHashes.length,
        escrowsExpected: tranches.length,
      });

      this.emit('scheduleCreated', {
        scheduleId,
        config,
        txHashes,
      });

      return {
        success: true,
        scheduleId,
        escrowCount: txHashes.length,
        txHashes,
      };

    } catch (error) {
      logger.error('Failed to create vesting schedule', {
        scheduleId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: ESCROW_ERROR_CODES.INTERNAL_ERROR,
      };
    }
  }

  /**
   * Validate vesting configuration
   */
  private validateConfig(config: VestingScheduleConfig): { valid: boolean; error?: string } {
    // Validate beneficiary address
    if (!config.beneficiary || !/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(config.beneficiary)) {
      return { valid: false, error: 'Invalid beneficiary address' };
    }

    // Validate amount
    const amountValidation = validateEscrowAmount(config.totalAmount, config.currency);
    if (!amountValidation.valid) {
      return { valid: false, error: amountValidation.error };
    }

    // Validate duration
    const durationValidation = validateVestingDuration(
      config.startTime,
      config.endTime,
      config.vestingType
    );
    if (!durationValidation.valid) {
      return { valid: false, error: durationValidation.error };
    }

    // Validate vesting type specific requirements
    if (config.vestingType === VestingType.LINEAR || config.vestingType === VestingType.CLIFF_LINEAR) {
      if (!config.releaseIntervals || config.releaseIntervals < 1) {
        return { valid: false, error: 'Release intervals required for LINEAR vesting' };
      }
      if (config.releaseIntervals > ESCROW_LIMITS.MAX_ESCROWS_PER_SCHEDULE) {
        return { valid: false, error: `Maximum ${ESCROW_LIMITS.MAX_ESCROWS_PER_SCHEDULE} release intervals allowed` };
      }
    }

    if (config.vestingType === VestingType.CLIFF || config.vestingType === VestingType.CLIFF_LINEAR) {
      if (!config.cliffDuration || config.cliffDuration < 0) {
        return { valid: false, error: 'Cliff duration required for CLIFF vesting' };
      }
    }

    return { valid: true };
  }

  /**
   * Generate escrow tranches based on vesting configuration
   */
  private generateTranches(config: VestingScheduleConfig): EscrowTranche[] {
    const tranches: EscrowTranche[] = [];
    const totalAmount = BigInt(config.totalAmount);
    
    switch (config.vestingType) {
      case VestingType.CLIFF:
        // Single escrow at cliff end
        tranches.push({
          index: 1,
          amount: config.totalAmount,
          finishAfterUnix: config.startTime + (config.cliffDuration || 0),
          finishAfterRipple: unixToRippleTime(config.startTime + (config.cliffDuration || 0)),
          cancelAfterUnix: config.cancelAfter,
          cancelAfterRipple: config.cancelAfter ? unixToRippleTime(config.cancelAfter) : undefined,
        });
        break;

      case VestingType.LINEAR:
        // Multiple equal escrows
        const linearCount = config.releaseIntervals || 12;
        const linearAmount = totalAmount / BigInt(linearCount);
        const linearRemainder = totalAmount % BigInt(linearCount);
        const linearInterval = (config.endTime - config.startTime) / linearCount;

        for (let i = 0; i < linearCount; i++) {
          const releaseTime = config.startTime + (linearInterval * (i + 1));
          const amount = i === linearCount - 1
            ? String(linearAmount + linearRemainder)
            : String(linearAmount);

          tranches.push({
            index: i + 1,
            amount,
            finishAfterUnix: releaseTime,
            finishAfterRipple: unixToRippleTime(releaseTime),
            cancelAfterUnix: config.cancelAfter,
            cancelAfterRipple: config.cancelAfter ? unixToRippleTime(config.cancelAfter) : undefined,
          });
        }
        break;

      case VestingType.CLIFF_LINEAR:
        // Cliff period followed by linear vesting
        const cliffEnd = config.startTime + (config.cliffDuration || 0);
        const cliffLinearCount = config.releaseIntervals || 12;
        const cliffLinearAmount = totalAmount / BigInt(cliffLinearCount);
        const cliffLinearRemainder = totalAmount % BigInt(cliffLinearCount);
        const postCliffDuration = config.endTime - cliffEnd;
        const cliffLinearInterval = postCliffDuration / cliffLinearCount;

        for (let i = 0; i < cliffLinearCount; i++) {
          const releaseTime = cliffEnd + (cliffLinearInterval * (i + 1));
          const amount = i === cliffLinearCount - 1
            ? String(cliffLinearAmount + cliffLinearRemainder)
            : String(cliffLinearAmount);

          tranches.push({
            index: i + 1,
            amount,
            finishAfterUnix: releaseTime,
            finishAfterRipple: unixToRippleTime(releaseTime),
            cancelAfterUnix: config.cancelAfter,
            cancelAfterRipple: config.cancelAfter ? unixToRippleTime(config.cancelAfter) : undefined,
          });
        }
        break;

      case VestingType.MILESTONE:
        // Single escrow for milestone-based (released via governance)
        tranches.push({
          index: 1,
          amount: config.totalAmount,
          finishAfterUnix: config.endTime,
          finishAfterRipple: unixToRippleTime(config.endTime),
          cancelAfterUnix: config.cancelAfter,
          cancelAfterRipple: config.cancelAfter ? unixToRippleTime(config.cancelAfter) : undefined,
        });
        break;
    }

    return tranches;
  }

  /**
   * Create a single escrow on XRPL
   */
  private async createSingleEscrow(
    wallet: Wallet,
    config: VestingScheduleConfig,
    tranche: EscrowTranche,
    scheduleId: string
  ): Promise<{ success: boolean; txHash?: string; sequence?: number; error?: string }> {
    try {
      // Build escrow create transaction
      // Note: XRPL native escrows only work with XRP
      // For VRTY (IOU), we use XRP escrows with memo tracking
      const escrowCreate: EscrowCreate = {
        TransactionType: 'EscrowCreate',
        Account: wallet.address,
        Destination: config.beneficiary,
        Amount: xrpToDrops(Number(tranche.amount) / 1_000_000), // Convert to XRP
        FinishAfter: tranche.finishAfterRipple,
        Memos: [
          {
            Memo: {
              MemoType: memoToHex(ESCROW_MEMO_TYPES.VESTING_CREATE),
              MemoData: memoToHex(JSON.stringify({
                scheduleId,
                trancheIndex: tranche.index,
                vestingType: config.vestingType,
                currency: config.currency,
                issuer: config.issuer,
                originalAmount: tranche.amount,
              })),
            },
          },
        ],
      };

      // Add CancelAfter if specified
      if (tranche.cancelAfterRipple) {
        escrowCreate.CancelAfter = tranche.cancelAfterRipple;
      }

      // Add condition if specified (for conditional escrows)
      if (config.condition) {
        escrowCreate.Condition = config.condition;
      }

      // Prepare and sign transaction
      const prepared = await this.client.autofill(escrowCreate);
      const signed = wallet.sign(prepared);

      // Submit transaction
      const result = await this.client.submitAndWait(signed.tx_blob);

      if (result.result.meta && typeof result.result.meta !== 'string') {
        const transactionResult = result.result.meta.TransactionResult;
        if (transactionResult === 'tesSUCCESS') {
          return {
            success: true,
            txHash: result.result.hash,
            sequence: prepared.Sequence,
          };
        }
        return {
          success: false,
          error: `Transaction failed: ${transactionResult}`,
        };
      }

      return {
        success: false,
        error: 'Unknown transaction result',
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get vesting schedule status
   */
  async getScheduleStatus(scheduleId: string): Promise<VestingSchedule | null> {
    // In production, this would query the database
    // For now, return null as we're using in-memory storage in the API
    logger.info('Getting vesting schedule status', { scheduleId });
    return null;
  }

  /**
   * Calculate vesting progress
   */
  calculateProgress(schedule: VestingSchedule): {
    percentage: number;
    released: string;
    pending: string;
    nextRelease?: { time: number; amount: string };
  } {
    const total = BigInt(schedule.totalAmount);
    const released = BigInt(schedule.releasedAmount);
    
    const percentage = total > BigInt(0)
      ? Number((released * BigInt(100)) / total)
      : 0;

    return {
      percentage,
      released: schedule.releasedAmount,
      pending: schedule.pendingAmount,
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (this.client.isConnected()) {
      await this.client.disconnect();
    }
    this.isInitialized = false;
    logger.info('Vesting factory shut down');
  }

  /**
   * Helper: delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if factory is initialized
   */
  get initialized(): boolean {
    return this.isInitialized;
  }

  /**
   * Get vesting wallet address
   */
  get walletAddress(): string | null {
    return this.vestingWallet?.address || null;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const vestingFactory = new VestingFactory();
export default VestingFactory;
