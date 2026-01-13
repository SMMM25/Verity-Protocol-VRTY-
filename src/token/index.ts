/**
 * Verity Protocol - Token Module Exports
 */

// In-memory version (for backwards compatibility)
export {
  VRTYTokenManager,
  type StakeInfo,
  type RevenueDistribution,
  type BuybackBurn,
} from './VRTYToken.js';

// Database-backed version (production recommended)
export {
  VRTYTokenManagerDB,
} from './VRTYTokenDB.js';
