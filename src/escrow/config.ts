/**
 * Verity Protocol - Escrow & Vesting Configuration
 * Sprint 2 - XRPL Escrow Implementation
 * @module escrow/config
 * @version 1.0.0
 */

import { VestingType, ReleaseBotConfig } from './types.js';

/**
 * XRPL Network configuration
 */
export const XRPL_CONFIG = {
  // Network URLs
  MAINNET_URL: process.env['XRPL_MAINNET_URL'] || 'wss://xrplcluster.com',
  TESTNET_URL: process.env['XRPL_TESTNET_URL'] || 'wss://s.altnet.rippletest.net:51233',
  DEVNET_URL: process.env['XRPL_DEVNET_URL'] || 'wss://s.devnet.rippletest.net:51233',
  
  // Current network
  NETWORK: process.env['XRPL_NETWORK'] || 'testnet',
  
  // Transaction settings
  MAX_FEE_DROPS: '1000', // Maximum fee in drops
  LEDGER_OFFSET: 20, // Ledgers to wait for validation
  RETRY_TIMEOUT_MS: 30000, // Transaction retry timeout
} as const;

/**
 * Get the XRPL WebSocket URL for the current network
 */
export function getXRPLUrl(): string {
  switch (XRPL_CONFIG.NETWORK) {
    case 'mainnet':
      return XRPL_CONFIG.MAINNET_URL;
    case 'devnet':
      return XRPL_CONFIG.DEVNET_URL;
    default:
      return XRPL_CONFIG.TESTNET_URL;
  }
}

/**
 * VRTY Token configuration
 */
export const VRTY_TOKEN = {
  CURRENCY: 'VRTY',
  CURRENCY_HEX: '5652545900000000000000000000000000000000',
  ISSUER: process.env['VRTY_ISSUER'] || 'rBeHfq9vRjZ8Cth1sMbp2nJvExmxSxAH8f',
  DECIMALS: 6,
  TOTAL_SUPPLY: '1000000000', // 1 billion VRTY
} as const;

/**
 * Escrow limits and constraints
 */
export const ESCROW_LIMITS = {
  // Maximum escrows per schedule
  MAX_ESCROWS_PER_SCHEDULE: 365, // Up to 1 year of daily releases
  
  // Minimum escrow amount (in drops for XRP, units for VRTY)
  MIN_ESCROW_AMOUNT_XRP: '1000000', // 1 XRP minimum
  MIN_ESCROW_AMOUNT_VRTY: '1000000', // 1 VRTY minimum
  
  // Maximum escrow amount per transaction
  MAX_ESCROW_AMOUNT_XRP: '100000000000', // 100,000 XRP
  MAX_ESCROW_AMOUNT_VRTY: '100000000000000', // 100,000,000 VRTY
  
  // Time constraints
  MIN_VESTING_DURATION_SECONDS: 86400, // 1 day minimum
  MAX_VESTING_DURATION_SECONDS: 126230400, // 4 years maximum
  
  // Batch processing
  MAX_BATCH_SIZE: 50, // Maximum escrows created per batch
  
  // Cancel after default (days after end date)
  DEFAULT_CANCEL_AFTER_DAYS: 30,
} as const;

/**
 * Vesting type configurations
 */
export const VESTING_TYPE_CONFIG: Record<VestingType, {
  description: string;
  minDuration: number;
  requiresCliff: boolean;
  requiresIntervals: boolean;
}> = {
  [VestingType.LINEAR]: {
    description: 'Tokens released gradually over the vesting period',
    minDuration: 86400 * 7, // 1 week minimum
    requiresCliff: false,
    requiresIntervals: true,
  },
  [VestingType.CLIFF]: {
    description: 'All tokens released at once after the cliff period',
    minDuration: 86400, // 1 day minimum
    requiresCliff: true,
    requiresIntervals: false,
  },
  [VestingType.MILESTONE]: {
    description: 'Tokens released upon milestone completion',
    minDuration: 0,
    requiresCliff: false,
    requiresIntervals: false,
  },
  [VestingType.CLIFF_LINEAR]: {
    description: 'Initial cliff period followed by linear vesting',
    minDuration: 86400 * 30, // 1 month minimum
    requiresCliff: true,
    requiresIntervals: true,
  },
};

/**
 * Release bot default configuration
 */
export const DEFAULT_RELEASE_BOT_CONFIG: ReleaseBotConfig = {
  checkIntervalMs: 60000, // Check every minute
  batchSize: 10, // Process 10 escrows per batch
  maxRetries: 3, // Retry failed releases 3 times
  retryDelayMs: 5000, // 5 second delay between retries
  dryRun: false, // Actually submit transactions
  minWalletBalance: 10, // Minimum 10 XRP in bot wallet
};

/**
 * Founder vesting configuration
 * 200M VRTY over 24 months (linear)
 */
export const FOUNDER_VESTING = {
  AMOUNT: '200000000000000', // 200M VRTY (6 decimals)
  DURATION_MONTHS: 24,
  RELEASE_FREQUENCY: 'monthly', // Monthly releases
  RELEASE_INTERVALS: 24,
  BENEFICIARY: process.env['FOUNDER_ADDRESS'] || '',
  DESCRIPTION: 'Founder allocation - 24-month linear vesting',
  // Multi-sig override for emergency cancellation
  MULTI_SIG_OVERRIDE: process.env['MULTI_SIG_ADDRESS'] || '',
};

/**
 * Treasury vesting configuration
 * 300M VRTY for protocol treasury
 */
export const TREASURY_VESTING = {
  AMOUNT: '300000000000000', // 300M VRTY
  UNLOCK_DELAY_DAYS: 90, // 90 day lock before any release
  GOVERNANCE_CONTROLLED: true,
};

/**
 * Error codes for escrow operations
 */
export const ESCROW_ERROR_CODES = {
  // Validation errors
  INVALID_SCHEDULE: 'ESCROW_INVALID_SCHEDULE',
  INVALID_AMOUNT: 'ESCROW_INVALID_AMOUNT',
  INVALID_BENEFICIARY: 'ESCROW_INVALID_BENEFICIARY',
  INVALID_DURATION: 'ESCROW_INVALID_DURATION',
  INVALID_VESTING_TYPE: 'ESCROW_INVALID_VESTING_TYPE',
  
  // State errors
  SCHEDULE_NOT_FOUND: 'ESCROW_SCHEDULE_NOT_FOUND',
  ESCROW_NOT_FOUND: 'ESCROW_NOT_FOUND',
  ESCROW_NOT_MATURE: 'ESCROW_NOT_MATURE',
  ESCROW_ALREADY_RELEASED: 'ESCROW_ALREADY_RELEASED',
  ESCROW_ALREADY_CANCELLED: 'ESCROW_ALREADY_CANCELLED',
  CANNOT_CANCEL_YET: 'ESCROW_CANNOT_CANCEL_YET',
  
  // XRPL errors
  XRPL_CONNECTION_FAILED: 'ESCROW_XRPL_CONNECTION_FAILED',
  XRPL_SUBMISSION_FAILED: 'ESCROW_XRPL_SUBMISSION_FAILED',
  INSUFFICIENT_BALANCE: 'ESCROW_INSUFFICIENT_BALANCE',
  TRANSACTION_FAILED: 'ESCROW_TRANSACTION_FAILED',
  
  // Authorization errors
  UNAUTHORIZED: 'ESCROW_UNAUTHORIZED',
  NOT_BENEFICIARY: 'ESCROW_NOT_BENEFICIARY',
  NOT_CREATOR: 'ESCROW_NOT_CREATOR',
  
  // System errors
  INTERNAL_ERROR: 'ESCROW_INTERNAL_ERROR',
  DATABASE_ERROR: 'ESCROW_DATABASE_ERROR',
} as const;

/**
 * Escrow-related memo types for XRPL transactions
 */
export const ESCROW_MEMO_TYPES = {
  VESTING_CREATE: 'VERITY_VESTING_CREATE',
  VESTING_RELEASE: 'VERITY_VESTING_RELEASE',
  VESTING_CANCEL: 'VERITY_VESTING_CANCEL',
  FOUNDER_VESTING: 'VERITY_FOUNDER_VESTING',
  TREASURY_VESTING: 'VERITY_TREASURY_VESTING',
} as const;

/**
 * Convert memo string to hex
 */
export function memoToHex(memo: string): string {
  return Buffer.from(memo, 'utf8').toString('hex').toUpperCase();
}

/**
 * Convert hex to memo string
 */
export function hexToMemo(hex: string): string {
  return Buffer.from(hex, 'hex').toString('utf8');
}

/**
 * Calculate vesting dates
 */
export function calculateVestingDates(
  startTime: number,
  durationMonths: number,
  intervalCount: number
): number[] {
  const dates: number[] = [];
  const msPerMonth = 30 * 24 * 60 * 60; // Average month in seconds
  const totalDuration = durationMonths * msPerMonth;
  const intervalDuration = totalDuration / intervalCount;
  
  for (let i = 1; i <= intervalCount; i++) {
    dates.push(startTime + Math.floor(intervalDuration * i));
  }
  
  return dates;
}

/**
 * Validate escrow amount
 */
export function validateEscrowAmount(
  amount: string,
  currency: 'XRP' | 'VRTY'
): { valid: boolean; error?: string } {
  const amountBigInt = BigInt(amount);
  
  if (amountBigInt <= BigInt(0)) {
    return { valid: false, error: 'Amount must be positive' };
  }
  
  if (currency === 'XRP') {
    if (amountBigInt < BigInt(ESCROW_LIMITS.MIN_ESCROW_AMOUNT_XRP)) {
      return { valid: false, error: `Minimum XRP escrow is ${Number(ESCROW_LIMITS.MIN_ESCROW_AMOUNT_XRP) / 1_000_000} XRP` };
    }
    if (amountBigInt > BigInt(ESCROW_LIMITS.MAX_ESCROW_AMOUNT_XRP)) {
      return { valid: false, error: `Maximum XRP escrow is ${Number(ESCROW_LIMITS.MAX_ESCROW_AMOUNT_XRP) / 1_000_000} XRP` };
    }
  } else {
    if (amountBigInt < BigInt(ESCROW_LIMITS.MIN_ESCROW_AMOUNT_VRTY)) {
      return { valid: false, error: `Minimum VRTY escrow is ${Number(ESCROW_LIMITS.MIN_ESCROW_AMOUNT_VRTY) / 1_000_000} VRTY` };
    }
    if (amountBigInt > BigInt(ESCROW_LIMITS.MAX_ESCROW_AMOUNT_VRTY)) {
      return { valid: false, error: `Maximum VRTY escrow is ${Number(ESCROW_LIMITS.MAX_ESCROW_AMOUNT_VRTY) / 1_000_000} VRTY` };
    }
  }
  
  return { valid: true };
}

/**
 * Validate vesting duration
 */
export function validateVestingDuration(
  startTime: number,
  endTime: number,
  vestingType: VestingType
): { valid: boolean; error?: string } {
  const duration = endTime - startTime;
  const typeConfig = VESTING_TYPE_CONFIG[vestingType];
  
  if (duration < ESCROW_LIMITS.MIN_VESTING_DURATION_SECONDS) {
    return { valid: false, error: 'Vesting duration too short (minimum 1 day)' };
  }
  
  if (duration > ESCROW_LIMITS.MAX_VESTING_DURATION_SECONDS) {
    return { valid: false, error: 'Vesting duration too long (maximum 4 years)' };
  }
  
  if (duration < typeConfig.minDuration) {
    return { valid: false, error: `${vestingType} vesting requires minimum ${typeConfig.minDuration / 86400} days` };
  }
  
  return { valid: true };
}
