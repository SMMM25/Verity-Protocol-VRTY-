/**
 * Verity Protocol - Fee Relayer Module
 * 
 * @module relayer
 * @description Gasless transaction relayer for XRPL. Enables users to submit
 * transactions without holding XRP for fees - the protocol treasury covers costs.
 * 
 * Features:
 * - Meta-transaction support (user signs, relayer pays)
 * - Treasury-funded fee sponsorship
 * - Tiered rate limiting based on VRTY staking
 * - Anti-Sybil protection via stake requirements
 * - Circuit breaker for treasury protection
 * 
 * @example
 * // Initialize relayer
 * import { relayerService } from './relayer';
 * await relayerService.initialize();
 * 
 * // Submit a meta-transaction
 * const result = await relayerService.submitTransaction({
 *   userAddress: 'rUserWallet...',
 *   transaction: { TransactionType: 'Payment', ... },
 *   userSignature: '304402...',
 *   nonce: 12345,
 *   deadline: 1234567890
 * });
 */

// Core services
export { RelayerService, relayerService } from './RelayerService.js';
export { TreasuryManager, treasuryManager } from './TreasuryManager.js';
export { SignatureVerifier, signatureVerifier } from './SignatureVerifier.js';
export { RelayerRateLimiter, rateLimiter } from './RateLimiter.js';

// Guards
export { StakeGuard, stakeGuard } from './guards/StakeGuard.js';
export { CircuitBreaker, circuitBreaker, CircuitState, TripReason } from './guards/CircuitBreaker.js';

// Types and configuration
export * from './types.js';

// Configuration utilities
export {
  TIER_CONFIGS,
  DEFAULT_RELAYER_CONFIG,
  getTierFromStake,
  getDailyLimitForTier,
  RELAYABLE_TRANSACTION_TYPES,
  isRelayableType,
  VRTY_TOKEN,
  RELAYER_ERROR_CODES
} from './config.js';
