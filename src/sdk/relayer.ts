/**
 * Verity Protocol SDK - Relayer Client
 * 
 * @module sdk/relayer
 * @description Client SDK for interacting with the Verity gasless relayer.
 * Enables developers to easily submit meta-transactions without handling XRP fees.
 * 
 * @example
 * import { VerityRelayer } from '@verity-protocol/sdk';
 * 
 * const relayer = new VerityRelayer({
 *   apiUrl: 'https://api.verity.finance',
 *   apiKey: 'your-api-key'
 * });
 * 
 * // Submit a gasless payment
 * const result = await relayer.submit({
 *   userAddress: 'rYourWallet...',
 *   transaction: {
 *     TransactionType: 'Payment',
 *     Account: 'rYourWallet...',
 *     Destination: 'rRecipient...',
 *     Amount: '1000000'  // 1 XRP in drops
 *   },
 *   wallet  // XRPL Wallet for signing
 * });
 */

import { Wallet, Transaction, encode, hashSignedTx } from 'xrpl';

/**
 * Relayer SDK configuration
 */
export interface RelayerConfig {
  /** Base URL for the relayer API */
  apiUrl: string;
  /** API key for authentication (optional for public endpoints) */
  apiKey?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Whether to use testnet (default: false) */
  testnet?: boolean;
}

/**
 * Submit transaction request
 */
export interface SubmitRequest {
  /** User's XRPL wallet address */
  userAddress: string;
  /** The transaction to relay */
  transaction: Transaction;
  /** User's XRPL wallet for signing (or pre-signed signature) */
  wallet?: Wallet;
  /** Pre-signed signature (if wallet not provided) */
  signature?: string;
  /** Optional deadline timestamp */
  deadline?: number;
}

/**
 * Submit transaction result
 */
export interface SubmitResult {
  success: boolean;
  transactionId?: string;
  xrplHash?: string;
  status?: string;
  fee?: {
    drops: string;
    xrp: string;
  };
  processingTimeMs?: number;
  error?: string;
}

/**
 * Quota information
 */
export interface QuotaInfo {
  address: string;
  tier: string;
  stakeAmount: number;
  quota: {
    daily: { used: number; limit: number; remaining: number };
    monthly: { used: number; limit: number; remaining: number };
    fees: { spentXRP: number; limitXRP: number };
  };
  benefits: {
    dailyTransactions: number;
    monthlyTransactions: number;
    prioritySubmission: boolean;
    reducedFees: boolean;
    feeDiscount: number;
  };
  upgrade?: {
    nextTier: string;
    stakeRequired: number;
    benefits: any;
  } | null;
}

/**
 * Relayer health status
 */
export interface RelayerHealth {
  healthy: boolean;
  service: {
    initialized: boolean;
    network: string;
    queueSize: number;
  };
  circuitBreaker: {
    state: string;
    errorRate: number;
  };
  treasury: {
    health: string;
    available: number;
  };
}

/**
 * Tier information
 */
export interface TierInfo {
  tier: string;
  minimumStake: number;
  benefits: {
    dailyTransactions: number;
    monthlyTransactions: number;
    prioritySubmission: boolean;
    reducedFees: boolean;
    feeDiscount: number;
  };
}

/**
 * Verity Relayer SDK Client
 * 
 * Provides a simple interface for submitting gasless transactions
 * through the Verity Protocol relayer.
 */
export class VerityRelayer {
  private config: Required<RelayerConfig>;
  private nonceCounter: number = 0;

  constructor(config: RelayerConfig) {
    this.config = {
      apiUrl: config.apiUrl.replace(/\/$/, ''),  // Remove trailing slash
      apiKey: config.apiKey || '',
      timeout: config.timeout || 30000,
      testnet: config.testnet ?? false
    };
  }

  /**
   * Submit a transaction for gasless relaying
   * 
   * The user signs the transaction, and the relayer submits it to XRPL,
   * paying the network fee from the protocol treasury.
   */
  async submit(request: SubmitRequest): Promise<SubmitResult> {
    try {
      // Generate nonce
      const nonce = this.generateNonce();

      // Get signature
      let signature: string;
      if (request.signature) {
        signature = request.signature;
      } else if (request.wallet) {
        signature = this.signTransaction(request.transaction, request.wallet);
      } else {
        throw new Error('Either wallet or signature must be provided');
      }

      // Prepare payload
      const payload = {
        userAddress: request.userAddress,
        transaction: request.transaction,
        userSignature: signature,
        nonce,
        deadline: request.deadline
      };

      // Submit to relayer
      const response = await this.post('/relayer/submit', payload);

      if (!response.success) {
        return {
          success: false,
          error: response.error?.message || 'Submission failed'
        };
      }

      return {
        success: true,
        transactionId: response.data.transactionId,
        xrplHash: response.data.xrplHash,
        status: response.data.status,
        fee: response.data.fee,
        processingTimeMs: response.data.processingTimeMs
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Submit a payment transaction (convenience method)
   */
  async submitPayment(
    wallet: Wallet,
    destination: string,
    amount: string | { currency: string; issuer: string; value: string }
  ): Promise<SubmitResult> {
    const transaction: Transaction = {
      TransactionType: 'Payment',
      Account: wallet.address,
      Destination: destination,
      Amount: amount
    };

    return this.submit({
      userAddress: wallet.address,
      transaction,
      wallet
    });
  }

  /**
   * Submit a trust line transaction (convenience method)
   */
  async submitTrustSet(
    wallet: Wallet,
    currency: string,
    issuer: string,
    limit: string = '1000000000'
  ): Promise<SubmitResult> {
    const transaction: Transaction = {
      TransactionType: 'TrustSet',
      Account: wallet.address,
      LimitAmount: {
        currency,
        issuer,
        value: limit
      }
    };

    return this.submit({
      userAddress: wallet.address,
      transaction,
      wallet
    });
  }

  /**
   * Get quota and usage for an address
   */
  async getQuota(address: string): Promise<QuotaInfo> {
    const response = await this.get(`/relayer/quota/${address}`);
    
    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch quota');
    }

    return response.data;
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(transactionId: string): Promise<{
    transactionId: string;
    userAddress: string;
    transactionType: string;
    xrplHash?: string;
    status: string;
    fee: { drops: string };
    submittedAt: string;
    confirmedAt?: string;
    error?: string;
  }> {
    const response = await this.get(`/relayer/status/${transactionId}`);
    
    if (!response.success) {
      throw new Error(response.error?.message || 'Transaction not found');
    }

    return response.data;
  }

  /**
   * Get relayer health status
   */
  async getHealth(): Promise<RelayerHealth> {
    const response = await this.get('/relayer/health');
    
    if (!response.success) {
      throw new Error(response.error?.message || 'Health check failed');
    }

    return response.data;
  }

  /**
   * Get staking tier information
   */
  async getTiers(): Promise<TierInfo[]> {
    const response = await this.get('/relayer/tiers');
    
    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch tiers');
    }

    return response.data.tiers;
  }

  /**
   * Get relayer statistics
   */
  async getStats(): Promise<{
    transactions: {
      totalRelayed: number;
      todayFeeSpent: number;
      averageFee: number;
    };
    capacity: {
      remainingByBalance: number;
      remainingByDailyLimit: number;
      effectiveRemaining: number;
    };
    users: {
      activeToday: number;
    };
  }> {
    const response = await this.get('/relayer/stats');
    
    if (!response.success) {
      throw new Error(response.error?.message || 'Failed to fetch stats');
    }

    return response.data;
  }

  /**
   * Check if relayer is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const health = await this.getHealth();
      return health.healthy;
    } catch {
      return false;
    }
  }

  /**
   * Estimate if a transaction can be relayed
   */
  async canRelay(address: string): Promise<{
    canRelay: boolean;
    reason?: string;
    quota?: QuotaInfo;
  }> {
    try {
      // Check health
      const health = await this.getHealth();
      if (!health.healthy) {
        return {
          canRelay: false,
          reason: 'Relayer service is currently unavailable'
        };
      }

      // Check quota
      const quota = await this.getQuota(address);
      
      if (quota.quota.daily.remaining <= 0) {
        return {
          canRelay: false,
          reason: 'Daily transaction limit reached',
          quota
        };
      }

      if (quota.quota.monthly.remaining <= 0) {
        return {
          canRelay: false,
          reason: 'Monthly transaction limit reached',
          quota
        };
      }

      return {
        canRelay: true,
        quota
      };

    } catch (error) {
      return {
        canRelay: false,
        reason: error instanceof Error ? error.message : 'Unable to check eligibility'
      };
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Sign a transaction with the user's wallet
   */
  private signTransaction(transaction: Transaction, wallet: Wallet): string {
    // For meta-transactions, we sign the transaction data
    // The relayer will verify this signature
    const signed = wallet.sign(transaction as any);
    return signed.tx_blob;
  }

  /**
   * Generate unique nonce
   */
  private generateNonce(): number {
    this.nonceCounter++;
    return Date.now() * 1000 + (this.nonceCounter % 1000);
  }

  /**
   * Make GET request
   */
  private async get(path: string): Promise<any> {
    const url = `${this.config.apiUrl}${path}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    if (this.config.apiKey) {
      headers['X-API-Key'] = this.config.apiKey;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        signal: controller.signal
      });

      const data = await response.json();
      return data;

    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Make POST request
   */
  private async post(path: string, body: any): Promise<any> {
    const url = `${this.config.apiUrl}${path}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    
    if (this.config.apiKey) {
      headers['X-API-Key'] = this.config.apiKey;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      });

      const data = await response.json();
      return data;

    } finally {
      clearTimeout(timeoutId);
    }
  }
}

/**
 * Create a relayer client with default configuration
 */
export function createRelayer(config: RelayerConfig): VerityRelayer {
  return new VerityRelayer(config);
}

/**
 * Default relayer instance for quick usage
 */
export const defaultRelayer = new VerityRelayer({
  apiUrl: process.env['VERITY_API_URL'] || 'https://api.verity.finance',
  apiKey: process.env['VERITY_API_KEY']
});
