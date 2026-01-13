/**
 * Verity Protocol - Relayer Service
 * 
 * @module relayer/RelayerService
 * @description Core meta-transaction relayer service for gasless user experience.
 * Handles signature verification, transaction submission, and fee sponsorship.
 */

import { Client, Wallet, Transaction, xrpToDrops, dropsToXrp, TxResponse, SubmittableTransaction } from 'xrpl';
import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import { prisma } from '../db/client.js';
import { SignatureVerifier, signatureVerifier } from './SignatureVerifier.js';
import { TreasuryManager, treasuryManager } from './TreasuryManager.js';
import {
  RELAYER_CONFIG,
  RelayerTransaction,
  TransactionStatus,
  MetaTransactionPayload,
  RelayerSubmitResult,
  RelayerQuota,
  TreasuryHealth
} from './types.js';

/**
 * Relayer service configuration from environment
 */
const getRelayerConfig = () => ({
  network: process.env['XRPL_NETWORK'] || 'testnet',
  wsUrl: process.env['XRPL_NETWORK'] === 'mainnet'
    ? 'wss://xrplcluster.com'
    : 'wss://s.altnet.rippletest.net:51233',
  maxRetries: parseInt(process.env['RELAYER_MAX_RETRIES'] || '3', 10),
  retryDelayMs: parseInt(process.env['RELAYER_RETRY_DELAY_MS'] || '1000', 10)
});

/**
 * Transaction queue item
 */
interface QueuedTransaction {
  id: string;
  payload: MetaTransactionPayload;
  attempts: number;
  createdAt: Date;
  lastAttempt?: Date;
}

/**
 * Relayer Service
 * 
 * Core service for processing meta-transactions. Features:
 * - User signature verification
 * - Treasury-funded fee payment
 * - XRPL transaction submission
 * - Retry logic and error handling
 * - Transaction tracking and status
 */
export class RelayerService extends EventEmitter {
  private client: Client;
  private relayerWallet: Wallet | null = null;
  private signatureVerifier: SignatureVerifier;
  private treasuryManager: TreasuryManager;
  private isInitialized: boolean = false;
  private transactionQueue: Map<string, QueuedTransaction> = new Map();
  private processingQueue: boolean = false;
  private config: ReturnType<typeof getRelayerConfig>;

  constructor() {
    super();
    this.config = getRelayerConfig();
    this.client = new Client(this.config.wsUrl);
    this.signatureVerifier = signatureVerifier;
    this.treasuryManager = treasuryManager;
  }

  /**
   * Initialize relayer service
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

      // Load relayer wallet (for submitting transactions)
      const relayerSeed = process.env['RELAYER_WALLET_SEED'];
      if (!relayerSeed) {
        throw new Error('RELAYER_WALLET_SEED environment variable not set');
      }
      this.relayerWallet = Wallet.fromSeed(relayerSeed);

      // Initialize treasury manager
      await this.treasuryManager.initialize();

      // Set up treasury event handlers
      this.treasuryManager.on('critical', (data) => {
        logger.error('Treasury critical', data);
        this.emit('treasuryCritical', data);
      });

      this.treasuryManager.on('warning', (data) => {
        logger.warn('Treasury warning', data);
        this.emit('treasuryWarning', data);
      });

      // Start queue processor
      this.startQueueProcessor();

      this.isInitialized = true;

      logger.info('Relayer service initialized', {
        relayerAddress: this.relayerWallet.address,
        treasuryAddress: this.treasuryManager.getAddress(),
        network: this.config.network
      });

      this.emit('initialized', {
        relayerAddress: this.relayerWallet.address,
        treasuryAddress: this.treasuryManager.getAddress()
      });

    } catch (error) {
      logger.error('Failed to initialize relayer service', { error });
      throw error;
    }
  }

  /**
   * Submit a meta-transaction for relaying
   */
  async submitTransaction(payload: MetaTransactionPayload): Promise<RelayerSubmitResult> {
    if (!this.isInitialized) {
      return {
        success: false,
        error: 'Relayer service not initialized'
      };
    }

    const startTime = Date.now();
    const transactionId = this.generateTransactionId();

    logger.info('Processing meta-transaction', {
      transactionId,
      userAddress: payload.userAddress,
      transactionType: payload.transaction.TransactionType
    });

    try {
      // Step 1: Check treasury health
      const treasuryStatus = this.treasuryManager.getTreasuryStatus();
      if (treasuryStatus.health === TreasuryHealth.CRITICAL) {
        return {
          success: false,
          error: 'Relayer temporarily unavailable due to treasury constraints'
        };
      }

      // Step 2: Verify user signature
      const signatureValid = await this.signatureVerifier.verifyMetaTransaction(payload);
      if (!signatureValid.valid) {
        logger.warn('Invalid signature', { transactionId, reason: signatureValid.error });
        return {
          success: false,
          error: `Signature verification failed: ${signatureValid.error}`
        };
      }

      // Step 3: Validate transaction structure
      const validationResult = this.validateTransaction(payload.transaction);
      if (!validationResult.valid) {
        return {
          success: false,
          error: `Transaction validation failed: ${validationResult.error}`
        };
      }

      // Step 4: Estimate and reserve fee
      const estimatedFee = await this.estimateFee(payload.transaction);
      const feeReservation = await this.treasuryManager.reserveFee(
        transactionId,
        estimatedFee,
        payload.userAddress
      );

      if (!feeReservation.success) {
        return {
          success: false,
          error: `Fee reservation failed: ${feeReservation.error}`
        };
      }

      // Step 5: Prepare and submit transaction
      const submissionResult = await this.submitToXRPL(
        transactionId,
        payload.transaction,
        payload.userSignature
      );

      if (!submissionResult.success) {
        // Release fee reservation on failure
        await this.treasuryManager.releaseReservation(transactionId);
        return {
          success: false,
          error: submissionResult.error
        };
      }

      // Step 6: Confirm fee payment
      const actualFee = submissionResult.actualFeeDrops || estimatedFee;
      await this.treasuryManager.confirmFeePayment(transactionId, actualFee);

      // Step 7: Record transaction
      await this.recordTransaction(transactionId, payload, submissionResult);

      const processingTime = Date.now() - startTime;

      logger.info('Meta-transaction submitted successfully', {
        transactionId,
        xrplHash: submissionResult.hash,
        processingTimeMs: processingTime
      });

      return {
        success: true,
        transactionId,
        xrplHash: submissionResult.hash,
        status: TransactionStatus.CONFIRMED,
        feeDrops: String(actualFee),
        feeXRP: String(parseInt(actualFee, 10) / 1000000),
        processingTimeMs: processingTime
      };

    } catch (error) {
      logger.error('Meta-transaction submission failed', { error, transactionId });
      
      // Attempt to release any reserved fees
      await this.treasuryManager.releaseReservation(transactionId).catch(() => {});

      return {
        success: false,
        transactionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Validate transaction structure and parameters
   */
  private validateTransaction(transaction: Transaction): { valid: boolean; error?: string } {
    // Check for required fields
    if (!transaction.TransactionType) {
      return { valid: false, error: 'Missing TransactionType' };
    }

    if (!transaction.Account) {
      return { valid: false, error: 'Missing Account' };
    }

    // Check for disallowed transaction types
    const disallowedTypes = ['AccountDelete', 'SetRegularKey'];
    if (disallowedTypes.includes(transaction.TransactionType)) {
      return { valid: false, error: `Transaction type ${transaction.TransactionType} not allowed via relayer` };
    }

    // Check amount limits for Payment transactions
    if (transaction.TransactionType === 'Payment' && (transaction as any).Amount) {
      const amount = (transaction as any).Amount;
      
      // For XRP payments
      if (typeof amount === 'string') {
        const xrpAmount = parseInt(amount, 10) / 1000000;
        const maxAmount = RELAYER_CONFIG.transaction.maxAmount / 1000000;
        
        if (xrpAmount > maxAmount) {
          return { valid: false, error: `Amount exceeds relayer maximum (${maxAmount} XRP)` };
        }
      }
    }

    return { valid: true };
  }

  /**
   * Estimate transaction fee
   */
  private async estimateFee(transaction: Transaction): Promise<string> {
    try {
      // Get current fee from network
      const feeResponse = await this.client.request({
        command: 'fee'
      });

      // Use open ledger fee or base fee
      const baseFee = feeResponse.result.drops.open_ledger_fee || 
                      feeResponse.result.drops.base_fee ||
                      '12';

      // Add buffer for complex transactions
      const complexTypes = ['TrustSet', 'OfferCreate', 'NFTokenMint'];
      if (complexTypes.includes(transaction.TransactionType)) {
        return String(parseInt(baseFee, 10) * 2);
      }

      return baseFee;

    } catch (error) {
      logger.warn('Fee estimation failed, using default', { error });
      return '12'; // Default XRPL fee in drops
    }
  }

  /**
   * Submit transaction to XRPL
   */
  private async submitToXRPL(
    transactionId: string,
    transaction: Transaction,
    userSignature: string
  ): Promise<{
    success: boolean;
    hash?: string;
    actualFeeDrops?: string;
    error?: string;
  }> {
    if (!this.relayerWallet) {
      return { success: false, error: 'Relayer wallet not initialized' };
    }

    try {
      // Prepare the transaction with fee
      const preparedTx = await this.client.autofill(transaction as SubmittableTransaction);
      
      // Note: In a full implementation, you would need to handle the user's
      // pre-signed transaction. For this implementation, we're showing the
      // structure where the relayer submits on behalf of the user.
      // 
      // The user's signature covers the transaction data, and the relayer
      // pays the fee. This requires special handling based on how the
      // user's signature is structured.

      // Add memo indicating relayed transaction
      preparedTx.Memos = [
        ...(preparedTx.Memos || []),
        {
          Memo: {
            MemoType: Buffer.from('VERITY_RELAYER').toString('hex').toUpperCase(),
            MemoData: Buffer.from(JSON.stringify({
              transactionId,
              relayedAt: new Date().toISOString(),
              relayerVersion: '1.0.0'
            })).toString('hex').toUpperCase()
          }
        }
      ];

      // Sign and submit
      // Note: The actual implementation depends on the signature scheme used
      // For demonstration, we're signing with the relayer wallet
      const signed = this.relayerWallet.sign(preparedTx);
      
      const result = await this.client.submitAndWait(signed.tx_blob);

      if (result.result.meta && 
          typeof result.result.meta === 'object' &&
          'TransactionResult' in result.result.meta) {
        const txResult = result.result.meta.TransactionResult;
        
        if (txResult === 'tesSUCCESS') {
          return {
            success: true,
            hash: result.result.hash,
            actualFeeDrops: preparedTx.Fee
          };
        } else {
          return {
            success: false,
            error: `Transaction failed: ${txResult}`
          };
        }
      }

      return {
        success: false,
        error: 'Unable to determine transaction result'
      };

    } catch (error) {
      logger.error('XRPL submission failed', { error, transactionId });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'XRPL submission error'
      };
    }
  }

  /**
   * Record transaction in database
   */
  private async recordTransaction(
    transactionId: string,
    payload: MetaTransactionPayload,
    result: { hash?: string; actualFeeDrops?: string }
  ): Promise<void> {
    // Log transaction - DB persistence will be added when Prisma model exists
    logger.info('Transaction recorded', {
      transactionId,
      userAddress: payload.userAddress,
      transactionType: payload.transaction.TransactionType,
      xrplHash: result.hash,
      feeDrops: result.actualFeeDrops || '0',
      status: TransactionStatus.CONFIRMED
    });
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(transactionId: string): Promise<RelayerTransaction | null> {
    // For now, return null - DB persistence will be added when Prisma model exists
    logger.debug('Transaction status lookup', { transactionId });
    return null;
  }

  /**
   * Get user's relayer quota and usage
   */
  async getUserQuota(userAddress: string): Promise<RelayerQuota> {
    // Return default limits - DB persistence will be added when Prisma model exists
    const baseLimit = RELAYER_CONFIG.perWalletLimits;

    return {
      userAddress,
      dailyTransactions: 0,
      dailyLimit: baseLimit.dailyTransactions,
      monthlyTransactions: 0,
      monthlyLimit: baseLimit.monthlyTransactions,
      dailyFeeSpent: 0,
      dailyFeeLimit: baseLimit.dailyFeeLimit / 1000000,
      remainingDaily: baseLimit.dailyTransactions,
      remainingMonthly: baseLimit.monthlyTransactions
    };
  }

  /**
   * Get relayer service status
   */
  getServiceStatus(): {
    initialized: boolean;
    network: string;
    treasuryHealth: TreasuryHealth;
    treasuryBalance: number;
    queueSize: number;
  } {
    return {
      initialized: this.isInitialized,
      network: this.config.network,
      treasuryHealth: this.treasuryManager.getHealthStatus(),
      treasuryBalance: this.treasuryManager.getAvailableBalance(),
      queueSize: this.transactionQueue.size
    };
  }

  /**
   * Start transaction queue processor
   */
  private startQueueProcessor(): void {
    setInterval(async () => {
      if (this.processingQueue || this.transactionQueue.size === 0) {
        return;
      }

      this.processingQueue = true;

      try {
        for (const [id, item] of this.transactionQueue) {
          if (item.attempts >= this.config.maxRetries) {
            this.transactionQueue.delete(id);
            continue;
          }

          // Process queued transaction
          const result = await this.submitTransaction(item.payload);
          
          if (result.success) {
            this.transactionQueue.delete(id);
          } else {
            item.attempts++;
            item.lastAttempt = new Date();
          }
        }
      } finally {
        this.processingQueue = false;
      }
    }, 5000); // Process queue every 5 seconds
  }

  /**
   * Generate unique transaction ID
   */
  private generateTransactionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `RTX_${timestamp}_${random}`.toUpperCase();
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down relayer service');

    // Stop queue processing
    this.processingQueue = true;

    // Shutdown treasury manager
    await this.treasuryManager.shutdown();

    // Disconnect from XRPL
    if (this.client.isConnected()) {
      await this.client.disconnect();
    }

    this.isInitialized = false;
    logger.info('Relayer service shut down complete');
  }
}

// Export singleton instance
export const relayerService = new RelayerService();
