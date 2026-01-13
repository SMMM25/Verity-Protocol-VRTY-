/**
 * Verity Protocol - Escrow & Vesting Module
 * Sprint 2 - XRPL Escrow Implementation
 * @module escrow
 * @version 1.0.0
 */

// Types
export {
  VestingType,
  VestingStatus,
  EscrowStatus,
  VestingScheduleConfig,
  VestingSchedule,
  EscrowRecord,
  EscrowCreateResult,
  EscrowReleaseResult,
  EscrowCancelResult,
  VestingSummary,
  ReleaseBotConfig,
  ReleaseBotStatus,
  RIPPLE_EPOCH_OFFSET,
  unixToRippleTime,
  rippleTimeToUnix,
  isEscrowMature,
  canCancelEscrow,
  calculateVestingProgress,
  formatVestingAmount,
} from './types.js';

// Configuration
export {
  XRPL_CONFIG,
  getXRPLUrl,
  VRTY_TOKEN,
  ESCROW_LIMITS,
  VESTING_TYPE_CONFIG,
  DEFAULT_RELEASE_BOT_CONFIG,
  FOUNDER_VESTING,
  TREASURY_VESTING,
  ESCROW_ERROR_CODES,
  ESCROW_MEMO_TYPES,
  memoToHex,
  hexToMemo,
  calculateVestingDates,
  validateEscrowAmount,
  validateVestingDuration,
} from './config.js';

// Core Services
export { VestingFactory, vestingFactory } from './VestingFactory.js';
export { ReleaseBot, releaseBot } from './ReleaseBot.js';
