/**
 * Verity Protocol - Fee Relayer Types
 * 
 * @module relayer/types
 * @description Type definitions for the meta-transaction fee relayer system
 * @version 1.0.0
 * @since Sprint 1
 */

// ============================================================
// TRANSACTION INTENT TYPES
// ============================================================

/**
 * Supported transaction types that can be relayed
 */
export type RelayableTransactionType =
  | 'Payment'
  | 'TrustSet'
  | 'OfferCreate'
  | 'OfferCancel'
  | 'NFTokenMint'
  | 'NFTokenBurn'
  | 'NFTokenCreateOffer'
  | 'NFTokenAcceptOffer'
  | 'NFTokenCancelOffer';

/**
 * Transaction intent - what the user wants to do (unsigned)
 */
export interface TransactionIntent {
  /** Transaction type */
  type: RelayableTransactionType;
  /** User's XRPL address (source) */
  account: string;
  /** Transaction-specific fields */
  payload: Record<string, unknown>;
  /** Optional memo data */
  memos?: Array<{
    type?: string;
    data?: string;
    format?: string;
  }>;
  /** Client-generated nonce to prevent replay */
  nonce: string;
  /** Timestamp when intent was created (ISO string) */
  timestamp: string;
  /** Expiration time in seconds (default 300 = 5 minutes) */
  expiresIn?: number;
}

/**
 * Signed transaction intent from user
 */
export interface SignedIntent {
  /** The transaction intent */
  intent: TransactionIntent;
  /** User's signature of the intent hash */
  signature: string;
  /** User's public key for verification */
  publicKey: string;
}

// ============================================================
// RELAY STATUS TYPES
// ============================================================

/**
 * Status of a relayed transaction
 */
export type RelayStatus =
  | 'PENDING'      // Received, not yet submitted
  | 'SUBMITTED'    // Submitted to XRPL
  | 'VALIDATED'    // Included in validated ledger
  | 'FAILED'       // Transaction failed
  | 'EXPIRED'      // Intent expired before submission
  | 'REJECTED';    // Rejected by relayer (rate limit, invalid, etc.)

/**
 * Result of a relay submission
 */
export interface RelayResult {
  /** Unique relay ID */
  relayId: string;
  /** Current status */
  status: RelayStatus;
  /** XRPL transaction hash (if submitted) */
  txHash?: string;
  /** Ledger index (if validated) */
  ledgerIndex?: number;
  /** Error message (if failed/rejected) */
  error?: string;
  /** Timestamp of submission */
  submittedAt?: Date;
  /** Timestamp of validation */
  validatedAt?: Date;
  /** Fee paid by relayer (in drops) */
  feePaid?: string;
}

/**
 * Detailed relay transaction record
 */
export interface RelayTransaction {
  /** Unique relay ID */
  id: string;
  /** User's wallet address */
  userAddress: string;
  /** Transaction type */
  transactionType: RelayableTransactionType;
  /** Current status */
  status: RelayStatus;
  /** The original signed intent */
  signedIntent: SignedIntent;
  /** XRPL transaction hash */
  txHash?: string;
  /** Ledger index where validated */
  ledgerIndex?: number;
  /** Fee paid by relayer (drops) */
  feePaid: string;
  /** Error message if failed */
  errorMessage?: string;
  /** Number of retry attempts */
  retryCount: number;
  /** Created timestamp */
  createdAt: Date;
  /** Submitted timestamp */
  submittedAt?: Date;
  /** Validated/Failed timestamp */
  completedAt?: Date;
}

// ============================================================
// QUOTA & RATE LIMITING TYPES
// ============================================================

/**
 * User's relay quota information
 */
export interface RelayQuota {
  /** User's wallet address */
  address: string;
  /** Daily transaction limit */
  dailyLimit: number;
  /** Transactions used today */
  dailyUsed: number;
  /** Remaining transactions today */
  dailyRemaining: number;
  /** User's staking tier */
  stakingTier: StakingTier;
  /** Whether user is eligible for gasless */
  eligible: boolean;
  /** Reason if not eligible */
  ineligibleReason?: string;
  /** Quota resets at (UTC) */
  resetsAt: Date;
}

/**
 * Staking tier for relay access
 */
export type StakingTier = 
  | 'NONE'        // No stake - no relay access
  | 'EXPLORER'    // 0-999 VRTY - 10 tx/day
  | 'NAVIGATOR'   // 1,000-9,999 VRTY - 50 tx/day
  | 'CAPTAIN'     // 10,000-49,999 VRTY - 200 tx/day
  | 'ADMIRAL'     // 50,000-199,999 VRTY - 500 tx/day
  | 'COMMODORE';  // 200,000+ VRTY - unlimited

/**
 * Staking tier enum for runtime use
 */
export const StakingTierEnum = {
  NONE: 'NONE' as const,
  EXPLORER: 'EXPLORER' as const,
  NAVIGATOR: 'NAVIGATOR' as const,
  CAPTAIN: 'CAPTAIN' as const,
  ADMIRAL: 'ADMIRAL' as const,
  COMMODORE: 'COMMODORE' as const
};

/**
 * Tier configuration
 */
export interface TierConfig {
  tier: StakingTier;
  minStake: number;
  maxStake: number;
  dailyLimit: number;
  priorityLevel: number;
}

// ============================================================
// RELAYER CONFIGURATION
// ============================================================

/**
 * Relayer service configuration
 */
export interface RelayerConfig {
  /** XRPL network */
  network: 'mainnet' | 'testnet' | 'devnet';
  /** Relayer treasury wallet seed (secure!) */
  treasurySecret?: string;
  /** Minimum treasury balance before circuit breaker (XRP) */
  minTreasuryBalance: number;
  /** Maximum fee per transaction (drops) */
  maxFeePerTx: number;
  /** Intent expiration time (seconds) */
  intentExpirationSeconds: number;
  /** Enable stake requirement */
  requireStake: boolean;
  /** Minimum stake for any relay access (VRTY) */
  minStakeAmount: number;
  /** Rate limit window (milliseconds) */
  rateLimitWindowMs: number;
  /** Global rate limit (tx per window) */
  globalRateLimit: number;
  /** Enable circuit breaker */
  enableCircuitBreaker: boolean;
  /** Circuit breaker threshold (consecutive failures) */
  circuitBreakerThreshold: number;
}

// ============================================================
// HEALTH & METRICS
// ============================================================

/**
 * Relayer health status
 */
export interface RelayerHealth {
  /** Overall health status */
  status: 'healthy' | 'degraded' | 'unhealthy';
  /** XRPL connection status */
  xrplConnected: boolean;
  /** Treasury wallet balance (XRP) */
  treasuryBalance: string;
  /** Treasury address */
  treasuryAddress: string;
  /** Circuit breaker status */
  circuitBreakerOpen: boolean;
  /** Transactions relayed today */
  transactionsToday: number;
  /** Total fees paid today (XRP) */
  feesPaidToday: string;
  /** Current queue size */
  queueSize: number;
  /** Average relay time (ms) */
  avgRelayTimeMs: number;
  /** Last successful relay */
  lastSuccessfulRelay?: Date;
  /** Uptime percentage (24h) */
  uptimePercent: number;
}

/**
 * Relayer statistics
 */
export interface RelayerStats {
  /** Total transactions relayed */
  totalRelayed: number;
  /** Successful transactions */
  successCount: number;
  /** Failed transactions */
  failedCount: number;
  /** Success rate percentage */
  successRate: number;
  /** Total fees paid (XRP) */
  totalFeesPaid: string;
  /** Average fee per tx (drops) */
  avgFeePerTx: string;
  /** Unique users served */
  uniqueUsers: number;
  /** Transactions by type */
  byType: Record<RelayableTransactionType, number>;
  /** Transactions by tier */
  byTier: Record<StakingTier, number>;
}

// ============================================================
// RELAYER CONFIG CONSTANT (used at runtime)
// ============================================================

/**
 * Default relayer configuration constant
 */
export const RELAYER_CONFIG = {
  /** Treasury configuration */
  treasury: {
    minBalance: 100,
    dailyFeeLimit: 10000000,  // 10 XRP in drops
    maxFeePerTransaction: 10000  // 0.01 XRP max per tx
  },
  /** Per-wallet limits */
  perWalletLimits: {
    dailyTransactions: 100,
    monthlyTransactions: 1000,
    dailyFeeLimit: 1000000  // 1 XRP in drops
  },
  /** Transaction limits */
  transaction: {
    maxAmount: 1000000000000  // 1M XRP in drops
  },
  /** Anti-abuse settings */
  antiAbuse: {
    minimumStake: 100,  // 100 VRTY minimum
    maxTransactionsPerMinute: 60
  }
};

// ============================================================
// ADDITIONAL TYPES FOR RELAYER SERVICE
// ============================================================

/**
 * Treasury health status
 */
export enum TreasuryHealth {
  HEALTHY = 'HEALTHY',
  DEGRADED = 'DEGRADED',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL'
}

/**
 * Treasury status
 */
export interface TreasuryStatus {
  address: string;
  balance: number;
  reservedBalance: number;
  availableBalance: number;
  health: TreasuryHealth;
  metrics: {
    totalFeesSpent: number;
    totalTransactionsRelayed: number;
    averageFeePerTransaction: number;
    dailyFeeSpend: number;
  };
  lastUpdated: Date;
}

/**
 * Fee payment result
 */
export interface FeePaymentResult {
  success: boolean;
  feeDrops?: string;
  feeXRP?: number;
  transactionId?: string;
  treasuryAddress?: string;
  error?: string;
}

/**
 * Transaction status
 */
export enum TransactionStatus {
  PENDING = 'PENDING',
  SUBMITTED = 'SUBMITTED',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED'
}

/**
 * Meta-transaction payload
 */
export interface MetaTransactionPayload {
  userAddress: string;
  transaction: any;
  userSignature: string;
  nonce: number;
  deadline?: number;
}

/**
 * Relayer transaction record
 */
export interface RelayerTransaction {
  id: string;
  userAddress: string;
  transactionType: string;
  xrplHash?: string;
  feeDrops: string;
  status: TransactionStatus;
  submittedAt: Date;
  confirmedAt?: Date;
  error?: string;
}

/**
 * Relayer submit result
 */
export interface RelayerSubmitResult {
  success: boolean;
  transactionId?: string;
  xrplHash?: string;
  status?: TransactionStatus;
  feeDrops?: string;
  feeXRP?: string;
  processingTimeMs?: number;
  error?: string;
}

/**
 * User quota information
 */
export interface RelayerQuota {
  userAddress: string;
  tier?: StakingTier;
  dailyTransactions: number;
  dailyLimit: number;
  monthlyTransactions: number;
  monthlyLimit: number;
  dailyFeeSpent: number;
  dailyFeeLimit: number;
  remainingDaily: number;
  remainingMonthly: number;
}
