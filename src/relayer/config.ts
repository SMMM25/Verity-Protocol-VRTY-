/**
 * Verity Protocol - Fee Relayer Configuration
 * 
 * @module relayer/config
 * @description Configuration for the meta-transaction fee relayer
 * @version 1.0.0
 * @since Sprint 1
 */

import type { RelayerConfig, TierConfig, StakingTier } from './types.js';

// ============================================================
// TIER CONFIGURATION
// ============================================================

/**
 * Staking tier configurations for relay access
 * Higher tiers get more daily transactions
 */
export const TIER_CONFIGS: Record<StakingTier, TierConfig> = {
  NONE: {
    tier: 'NONE',
    minStake: 0,
    maxStake: 0,
    dailyLimit: 0,           // No access without stake
    priorityLevel: 0,
  },
  EXPLORER: {
    tier: 'EXPLORER',
    minStake: 1,             // Minimum 1 VRTY to access
    maxStake: 999,
    dailyLimit: 10,          // 10 tx/day
    priorityLevel: 1,
  },
  NAVIGATOR: {
    tier: 'NAVIGATOR',
    minStake: 1000,
    maxStake: 9999,
    dailyLimit: 50,          // 50 tx/day
    priorityLevel: 2,
  },
  CAPTAIN: {
    tier: 'CAPTAIN',
    minStake: 10000,
    maxStake: 49999,
    dailyLimit: 200,         // 200 tx/day
    priorityLevel: 3,
  },
  ADMIRAL: {
    tier: 'ADMIRAL',
    minStake: 50000,
    maxStake: 199999,
    dailyLimit: 500,         // 500 tx/day
    priorityLevel: 4,
  },
  COMMODORE: {
    tier: 'COMMODORE',
    minStake: 200000,
    maxStake: Infinity,
    dailyLimit: -1,          // Unlimited (-1)
    priorityLevel: 5,
  },
};

/**
 * Get tier from stake amount
 */
export function getTierFromStake(stakeAmount: number): StakingTier {
  if (stakeAmount >= 200000) return 'COMMODORE';
  if (stakeAmount >= 50000) return 'ADMIRAL';
  if (stakeAmount >= 10000) return 'CAPTAIN';
  if (stakeAmount >= 1000) return 'NAVIGATOR';
  if (stakeAmount >= 1) return 'EXPLORER';
  return 'NONE';
}

/**
 * Get daily limit for a tier
 */
export function getDailyLimitForTier(tier: StakingTier): number {
  return TIER_CONFIGS[tier].dailyLimit;
}

// ============================================================
// DEFAULT RELAYER CONFIGURATION
// ============================================================

/**
 * Default relayer configuration
 * Override via environment variables
 */
export const DEFAULT_RELAYER_CONFIG: RelayerConfig = {
  // Network
  network: (process.env['XRPL_NETWORK'] as RelayerConfig['network']) || 'testnet',
  
  // Treasury (MUST be set in environment for production)
  treasurySecret: process.env['RELAYER_TREASURY_SECRET'],
  
  // Treasury protection
  minTreasuryBalance: parseFloat(process.env['RELAYER_MIN_TREASURY_BALANCE'] || '100'), // 100 XRP minimum
  maxFeePerTx: parseInt(process.env['RELAYER_MAX_FEE_PER_TX'] || '1000', 10), // 1000 drops max (~$0.0005)
  
  // Intent handling
  intentExpirationSeconds: parseInt(process.env['RELAYER_INTENT_EXPIRATION'] || '300', 10), // 5 minutes
  
  // Stake requirements
  requireStake: process.env['RELAYER_REQUIRE_STAKE'] !== 'false', // Default: true
  minStakeAmount: parseInt(process.env['RELAYER_MIN_STAKE'] || '1', 10), // 1 VRTY minimum
  
  // Rate limiting
  rateLimitWindowMs: parseInt(process.env['RELAYER_RATE_LIMIT_WINDOW'] || '60000', 10), // 1 minute
  globalRateLimit: parseInt(process.env['RELAYER_GLOBAL_RATE_LIMIT'] || '1000', 10), // 1000 tx/minute global
  
  // Circuit breaker
  enableCircuitBreaker: process.env['RELAYER_ENABLE_CIRCUIT_BREAKER'] !== 'false', // Default: true
  circuitBreakerThreshold: parseInt(process.env['RELAYER_CIRCUIT_BREAKER_THRESHOLD'] || '10', 10), // 10 consecutive failures
};

// ============================================================
// SUPPORTED TRANSACTION TYPES
// ============================================================

/**
 * Transaction types that can be relayed
 * Some types are excluded for security (e.g., AccountSet, SetRegularKey)
 */
export const RELAYABLE_TRANSACTION_TYPES = [
  'Payment',
  'TrustSet',
  'OfferCreate',
  'OfferCancel',
  'NFTokenMint',
  'NFTokenBurn',
  'NFTokenCreateOffer',
  'NFTokenAcceptOffer',
  'NFTokenCancelOffer',
] as const;

/**
 * Check if a transaction type is relayable
 */
export function isRelayableType(type: string): boolean {
  return RELAYABLE_TRANSACTION_TYPES.includes(type as any);
}

// ============================================================
// VRTY TOKEN CONFIGURATION
// ============================================================

/**
 * VRTY token configuration for stake verification
 */
export const VRTY_TOKEN = {
  currency: 'VRTY',
  currencyHex: '5652545900000000000000000000000000000000',
  issuer: process.env['VRTY_ISSUER'] || 'rBeHfq9vRjZ8Cth1sMbp2nJvExmxSxAH8f',
  decimals: 6,
};

// ============================================================
// ERROR CODES
// ============================================================

export const RELAYER_ERROR_CODES = {
  // Validation errors
  INVALID_INTENT: 'RELAYER_INVALID_INTENT',
  INVALID_SIGNATURE: 'RELAYER_INVALID_SIGNATURE',
  EXPIRED_INTENT: 'RELAYER_EXPIRED_INTENT',
  UNSUPPORTED_TX_TYPE: 'RELAYER_UNSUPPORTED_TX_TYPE',
  
  // Access errors
  INSUFFICIENT_STAKE: 'RELAYER_INSUFFICIENT_STAKE',
  RATE_LIMITED: 'RELAYER_RATE_LIMITED',
  DAILY_LIMIT_EXCEEDED: 'RELAYER_DAILY_LIMIT_EXCEEDED',
  
  // System errors
  CIRCUIT_BREAKER_OPEN: 'RELAYER_CIRCUIT_BREAKER_OPEN',
  TREASURY_LOW: 'RELAYER_TREASURY_LOW',
  XRPL_ERROR: 'RELAYER_XRPL_ERROR',
  SUBMISSION_FAILED: 'RELAYER_SUBMISSION_FAILED',
  
  // Internal errors
  INTERNAL_ERROR: 'RELAYER_INTERNAL_ERROR',
} as const;

export type RelayerErrorCode = typeof RELAYER_ERROR_CODES[keyof typeof RELAYER_ERROR_CODES];
