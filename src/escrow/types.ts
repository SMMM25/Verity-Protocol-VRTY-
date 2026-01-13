/**
 * Verity Protocol - Escrow & Vesting Types
 * Sprint 2 - XRPL Escrow Implementation
 * @module escrow/types
 * @version 1.0.0
 */

/**
 * Vesting schedule types
 */
export enum VestingType {
  /** Linear vesting - tokens released gradually over time */
  LINEAR = 'LINEAR',
  /** Cliff vesting - all tokens released at once after cliff period */
  CLIFF = 'CLIFF',
  /** Milestone vesting - tokens released upon milestone completion */
  MILESTONE = 'MILESTONE',
  /** Hybrid - cliff followed by linear vesting */
  CLIFF_LINEAR = 'CLIFF_LINEAR',
}

/**
 * Vesting schedule status
 */
export enum VestingStatus {
  /** Schedule created but not yet started */
  PENDING = 'PENDING',
  /** Schedule is active and releasing tokens */
  ACTIVE = 'ACTIVE',
  /** All tokens have been released */
  COMPLETED = 'COMPLETED',
  /** Schedule was cancelled */
  CANCELLED = 'CANCELLED',
  /** Schedule is paused (requires governance action) */
  PAUSED = 'PAUSED',
}

/**
 * Individual escrow status
 */
export enum EscrowStatus {
  /** Escrow created on XRPL */
  CREATED = 'CREATED',
  /** Escrow is mature and can be released */
  MATURE = 'MATURE',
  /** Escrow has been released (EscrowFinish) */
  RELEASED = 'RELEASED',
  /** Escrow was cancelled (EscrowCancel) */
  CANCELLED = 'CANCELLED',
  /** Escrow release failed */
  FAILED = 'FAILED',
}

/**
 * Vesting schedule configuration
 */
export interface VestingScheduleConfig {
  /** Unique identifier for the schedule */
  scheduleId: string;
  /** Beneficiary XRPL address */
  beneficiary: string;
  /** Total amount to vest (in drops or VRTY units) */
  totalAmount: string;
  /** Token currency (XRP or VRTY) */
  currency: 'XRP' | 'VRTY';
  /** VRTY issuer address (required for VRTY) */
  issuer?: string;
  /** Vesting type */
  vestingType: VestingType;
  /** Start timestamp (Unix seconds) */
  startTime: number;
  /** End timestamp (Unix seconds) */
  endTime: number;
  /** Cliff period in seconds (for CLIFF/CLIFF_LINEAR) */
  cliffDuration?: number;
  /** Number of release intervals for LINEAR vesting */
  releaseIntervals?: number;
  /** CancelAfter timestamp - escrows can be cancelled after this */
  cancelAfter?: number;
  /** Optional condition for conditional escrows */
  condition?: string;
  /** Creator address */
  creator: string;
  /** Optional memo/description */
  description?: string;
}

/**
 * Created vesting schedule
 */
export interface VestingSchedule extends VestingScheduleConfig {
  /** Schedule status */
  status: VestingStatus;
  /** Array of escrow IDs in this schedule */
  escrowIds: string[];
  /** Amount already released */
  releasedAmount: string;
  /** Amount pending release */
  pendingAmount: string;
  /** Number of escrows released */
  escrowsReleased: number;
  /** Total number of escrows */
  totalEscrows: number;
  /** Creation timestamp */
  createdAt: Date;
  /** Last update timestamp */
  updatedAt: Date;
  /** Transaction hash of creation batch */
  creationTxHashes: string[];
}

/**
 * Individual escrow record
 */
export interface EscrowRecord {
  /** Unique escrow ID */
  escrowId: string;
  /** Parent vesting schedule ID */
  scheduleId: string;
  /** Escrow sequence number on XRPL */
  sequence: number;
  /** Source (creator) address */
  source: string;
  /** Destination (beneficiary) address */
  destination: string;
  /** Amount in drops */
  amount: string;
  /** Currency */
  currency: 'XRP' | 'VRTY';
  /** Issuer for VRTY */
  issuer?: string;
  /** FinishAfter timestamp (Ripple epoch) */
  finishAfter: number;
  /** CancelAfter timestamp (Ripple epoch) */
  cancelAfter?: number;
  /** Condition hash (for conditional escrows) */
  condition?: string;
  /** Escrow status */
  status: EscrowStatus;
  /** Creation transaction hash */
  createTxHash: string;
  /** Finish transaction hash (if released) */
  finishTxHash?: string;
  /** Cancel transaction hash (if cancelled) */
  cancelTxHash?: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Release timestamp */
  releasedAt?: Date;
  /** Error message if failed */
  errorMessage?: string;
}

/**
 * Escrow creation result
 */
export interface EscrowCreateResult {
  success: boolean;
  scheduleId?: string;
  escrowCount?: number;
  txHashes?: string[];
  error?: string;
  errorCode?: string;
}

/**
 * Escrow release result
 */
export interface EscrowReleaseResult {
  success: boolean;
  escrowId?: string;
  txHash?: string;
  amount?: string;
  error?: string;
  errorCode?: string;
}

/**
 * Escrow cancel result
 */
export interface EscrowCancelResult {
  success: boolean;
  escrowId?: string;
  txHash?: string;
  refundedTo?: string;
  error?: string;
  errorCode?: string;
}

/**
 * Vesting summary for an address
 */
export interface VestingSummary {
  address: string;
  totalSchedules: number;
  activeSchedules: number;
  completedSchedules: number;
  totalVested: string;
  totalReleased: string;
  totalPending: string;
  nextReleaseTime?: number;
  nextReleaseAmount?: string;
}

/**
 * Release bot configuration
 */
export interface ReleaseBotConfig {
  /** Check interval in milliseconds */
  checkIntervalMs: number;
  /** Maximum escrows to process per batch */
  batchSize: number;
  /** Retry attempts for failed releases */
  maxRetries: number;
  /** Delay between retries in ms */
  retryDelayMs: number;
  /** Enable dry-run mode (no actual transactions) */
  dryRun: boolean;
  /** Minimum XRP balance for bot wallet */
  minWalletBalance: number;
}

/**
 * Release bot status
 */
export interface ReleaseBotStatus {
  running: boolean;
  lastCheck: Date | null;
  lastRelease: Date | null;
  escrowsProcessed: number;
  escrowsReleased: number;
  escrowsFailed: number;
  pendingEscrows: number;
  nextScheduledCheck: Date | null;
  walletBalance: string;
  walletAddress: string;
}

/**
 * Ripple epoch offset (seconds from Unix epoch to Ripple epoch)
 * Ripple epoch: January 1, 2000 00:00:00 UTC
 * Unix epoch: January 1, 1970 00:00:00 UTC
 */
export const RIPPLE_EPOCH_OFFSET = 946684800;

/**
 * Convert Unix timestamp to Ripple epoch
 */
export function unixToRippleTime(unixTimestamp: number): number {
  return unixTimestamp - RIPPLE_EPOCH_OFFSET;
}

/**
 * Convert Ripple epoch to Unix timestamp
 */
export function rippleTimeToUnix(rippleTimestamp: number): number {
  return rippleTimestamp + RIPPLE_EPOCH_OFFSET;
}

/**
 * Check if an escrow is mature (can be finished)
 */
export function isEscrowMature(finishAfter: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  const rippleNow = unixToRippleTime(now);
  return rippleNow >= finishAfter;
}

/**
 * Check if an escrow can be cancelled
 */
export function canCancelEscrow(cancelAfter?: number): boolean {
  if (!cancelAfter) return false;
  const now = Math.floor(Date.now() / 1000);
  const rippleNow = unixToRippleTime(now);
  return rippleNow >= cancelAfter;
}

/**
 * Calculate vesting progress percentage
 */
export function calculateVestingProgress(schedule: VestingSchedule): number {
  const total = BigInt(schedule.totalAmount);
  const released = BigInt(schedule.releasedAmount);
  if (total === BigInt(0)) return 0;
  return Number((released * BigInt(100)) / total);
}

/**
 * Format amount for display
 */
export function formatVestingAmount(amount: string, currency: 'XRP' | 'VRTY'): string {
  if (currency === 'XRP') {
    // Convert drops to XRP
    const xrp = Number(amount) / 1_000_000;
    return `${xrp.toLocaleString()} XRP`;
  }
  // VRTY - already in token units
  const vrty = Number(amount) / 1_000_000;
  return `${vrty.toLocaleString()} VRTY`;
}
