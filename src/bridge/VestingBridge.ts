/**
 * Verity Protocol - Cross-Chain Vesting Bridge
 * Sprint 2 Task 2.5 - VRTY Escrow → wVRTY Vesting
 * 
 * @module bridge/VestingBridge
 * @description Cross-chain vesting implementation that locks VRTY on XRPL
 * and releases vested wVRTY on Solana according to a schedule.
 * 
 * Architecture:
 * - Phase 1: Lock full VRTY amount on XRPL (escrow-like)
 * - Phase 2: Release vested wVRTY on Solana at each interval
 * - Phase 3: Bridge monitors release schedule and mints wVRTY
 * 
 * @version 1.0.0
 * @since Sprint 2 - XRPL Escrow & Vesting
 */

import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import { prisma } from '../db/client.js';
import {
  VestingType,
  VestingStatus,
  unixToRippleTime,
} from '../escrow/types.js';

// ============================================================
// TYPES
// ============================================================

/**
 * Cross-chain vesting schedule configuration
 */
export interface CrossChainVestingConfig {
  /** Unique schedule identifier */
  scheduleId?: string;
  /** XRPL wallet address that locks VRTY */
  xrplSourceAddress: string;
  /** Solana wallet address to receive wVRTY */
  solanaDestinationAddress: string;
  /** Total VRTY amount to be vested (in drops) */
  totalAmount: string;
  /** Type of vesting schedule */
  vestingType: VestingType;
  /** Unix timestamp when vesting starts */
  startTime: number;
  /** Unix timestamp when vesting ends */
  endTime: number;
  /** Cliff duration in seconds (for CLIFF/CLIFF_LINEAR) */
  cliffDuration?: number;
  /** Number of release intervals (for LINEAR/CLIFF_LINEAR) */
  releaseIntervals?: number;
  /** Optional memo/description */
  memo?: string;
}

/**
 * Cross-chain vesting schedule status
 */
export interface CrossChainVestingSchedule {
  scheduleId: string;
  xrplSourceAddress: string;
  solanaDestinationAddress: string;
  totalAmount: string;
  releasedAmount: string;
  pendingAmount: string;
  vestingType: VestingType;
  status: CrossChainVestingStatus;
  startTime: Date;
  endTime: Date;
  cliffEndTime?: Date;
  releases: CrossChainVestingRelease[];
  xrplLockTxHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Individual vesting release record
 */
export interface CrossChainVestingRelease {
  releaseIndex: number;
  amount: string;
  scheduledTime: Date;
  actualReleaseTime?: Date;
  status: ReleaseStatus;
  solanaTxHash?: string;
  xrplUnlockTxHash?: string;
  errorMessage?: string;
}

/**
 * Cross-chain vesting status
 */
export enum CrossChainVestingStatus {
  PENDING_LOCK = 'PENDING_LOCK',
  LOCKED = 'LOCKED',
  VESTING = 'VESTING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  FAILED = 'FAILED',
}

/**
 * Individual release status
 */
export enum ReleaseStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

/**
 * Result of vesting creation
 */
export interface CreateVestingResult {
  success: boolean;
  scheduleId?: string;
  xrplLockTxHash?: string;
  releaseCount?: number;
  error?: string;
  errorCode?: string;
}

// ============================================================
// CONSTANTS
// ============================================================

const CROSS_CHAIN_VESTING_ERROR_CODES = {
  INVALID_CONFIG: 'CROSS_CHAIN_VESTING_INVALID_CONFIG',
  LOCK_FAILED: 'CROSS_CHAIN_VESTING_LOCK_FAILED',
  RELEASE_FAILED: 'CROSS_CHAIN_VESTING_RELEASE_FAILED',
  BRIDGE_UNAVAILABLE: 'CROSS_CHAIN_VESTING_BRIDGE_UNAVAILABLE',
  INSUFFICIENT_BALANCE: 'CROSS_CHAIN_VESTING_INSUFFICIENT_BALANCE',
  INTERNAL_ERROR: 'CROSS_CHAIN_VESTING_INTERNAL_ERROR',
};

const TIME_CONSTANTS = {
  MINUTE: 60,
  HOUR: 3600,
  DAY: 86400,
  WEEK: 604800,
  MONTH: 2592000,
  YEAR: 31536000,
};

const VESTING_LIMITS = {
  MIN_AMOUNT: 1000, // 1000 VRTY minimum
  MAX_AMOUNT: 100000000, // 100M VRTY maximum
  MIN_DURATION: TIME_CONSTANTS.DAY, // 1 day minimum
  MAX_DURATION: TIME_CONSTANTS.YEAR * 5, // 5 years maximum
  MAX_RELEASES: 60, // 60 releases maximum (5 years monthly)
};

// ============================================================
// CROSS-CHAIN VESTING BRIDGE CLASS
// ============================================================

/**
 * CrossChainVestingBridge
 * 
 * Manages vesting schedules that span XRPL and Solana:
 * 1. Lock VRTY tokens on XRPL
 * 2. Generate release schedule
 * 3. Mint wVRTY on Solana at each release point
 * 
 * Features:
 * - LINEAR: Equal wVRTY releases at fixed intervals
 * - CLIFF: All wVRTY after cliff period
 * - CLIFF_LINEAR: Cliff followed by linear releases
 * - Automatic release processing via cron
 * - Multi-validator signatures for releases
 */
export class CrossChainVestingBridge extends EventEmitter {
  private isInitialized: boolean = false;
  private schedules: Map<string, CrossChainVestingSchedule> = new Map();
  private releaseCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
  }

  /**
   * Initialize the cross-chain vesting bridge
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Load existing schedules from database
      await this.loadSchedulesFromDatabase();

      // Start release monitoring
      this.startReleaseMonitor();

      this.isInitialized = true;
      this.emit('initialized');
      
      logger.info('CrossChainVestingBridge initialized', {
        activeSchedules: this.schedules.size,
      });

    } catch (error) {
      logger.error('Failed to initialize CrossChainVestingBridge', { error });
      throw error;
    }
  }

  /**
   * Create a new cross-chain vesting schedule
   */
  async createVestingSchedule(
    config: CrossChainVestingConfig
  ): Promise<CreateVestingResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const scheduleId = config.scheduleId || `CCVS-${uuidv4().substring(0, 8).toUpperCase()}`;

    try {
      // Validate configuration
      const validation = this.validateConfig(config);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          errorCode: CROSS_CHAIN_VESTING_ERROR_CODES.INVALID_CONFIG,
        };
      }

      // Generate release schedule
      const releases = this.generateReleaseSchedule(config);

      logger.info('Creating cross-chain vesting schedule', {
        scheduleId,
        xrplSource: config.xrplSourceAddress,
        solanaDestination: config.solanaDestinationAddress,
        totalAmount: config.totalAmount,
        vestingType: config.vestingType,
        releaseCount: releases.length,
      });

      // Create schedule record
      const schedule: CrossChainVestingSchedule = {
        scheduleId,
        xrplSourceAddress: config.xrplSourceAddress,
        solanaDestinationAddress: config.solanaDestinationAddress,
        totalAmount: config.totalAmount,
        releasedAmount: '0',
        pendingAmount: config.totalAmount,
        vestingType: config.vestingType,
        status: CrossChainVestingStatus.PENDING_LOCK,
        startTime: new Date(config.startTime * 1000),
        endTime: new Date(config.endTime * 1000),
        cliffEndTime: config.cliffDuration 
          ? new Date((config.startTime + config.cliffDuration) * 1000) 
          : undefined,
        releases,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Store in memory and database
      this.schedules.set(scheduleId, schedule);
      await this.persistSchedule(schedule);

      // Lock VRTY on XRPL (Phase 1)
      // In production, this would call the XRPL escrow/lock service
      const lockResult = await this.lockVRTYOnXRPL(schedule);

      if (!lockResult.success) {
        schedule.status = CrossChainVestingStatus.FAILED;
        await this.persistSchedule(schedule);
        
        return {
          success: false,
          scheduleId,
          error: lockResult.error,
          errorCode: CROSS_CHAIN_VESTING_ERROR_CODES.LOCK_FAILED,
        };
      }

      schedule.status = CrossChainVestingStatus.LOCKED;
      schedule.xrplLockTxHash = lockResult.txHash;
      await this.persistSchedule(schedule);

      this.emit('scheduleCreated', schedule);

      return {
        success: true,
        scheduleId,
        xrplLockTxHash: lockResult.txHash,
        releaseCount: releases.length,
      };

    } catch (error) {
      logger.error('Failed to create cross-chain vesting schedule', {
        scheduleId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        scheduleId,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: CROSS_CHAIN_VESTING_ERROR_CODES.INTERNAL_ERROR,
      };
    }
  }

  /**
   * Validate vesting configuration
   */
  private validateConfig(config: CrossChainVestingConfig): { valid: boolean; error?: string } {
    // Validate XRPL address
    if (!config.xrplSourceAddress || !/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(config.xrplSourceAddress)) {
      return { valid: false, error: 'Invalid XRPL source address' };
    }

    // Validate Solana address (base58, 32-44 characters)
    if (!config.solanaDestinationAddress || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(config.solanaDestinationAddress)) {
      return { valid: false, error: 'Invalid Solana destination address' };
    }

    // Validate amount
    const amount = BigInt(config.totalAmount);
    if (amount < BigInt(VESTING_LIMITS.MIN_AMOUNT)) {
      return { valid: false, error: `Minimum vesting amount is ${VESTING_LIMITS.MIN_AMOUNT} VRTY` };
    }
    if (amount > BigInt(VESTING_LIMITS.MAX_AMOUNT)) {
      return { valid: false, error: `Maximum vesting amount is ${VESTING_LIMITS.MAX_AMOUNT} VRTY` };
    }

    // Validate duration
    const duration = config.endTime - config.startTime;
    if (duration < VESTING_LIMITS.MIN_DURATION) {
      return { valid: false, error: 'Vesting duration must be at least 1 day' };
    }
    if (duration > VESTING_LIMITS.MAX_DURATION) {
      return { valid: false, error: 'Vesting duration cannot exceed 5 years' };
    }

    // Validate start time (not in the past)
    const now = Math.floor(Date.now() / 1000);
    if (config.startTime < now - 3600) { // Allow 1 hour tolerance
      return { valid: false, error: 'Start time cannot be in the past' };
    }

    // Validate vesting type specific requirements
    if (config.vestingType === VestingType.LINEAR || config.vestingType === VestingType.CLIFF_LINEAR) {
      if (!config.releaseIntervals || config.releaseIntervals < 1) {
        return { valid: false, error: 'Release intervals required for LINEAR vesting' };
      }
      if (config.releaseIntervals > VESTING_LIMITS.MAX_RELEASES) {
        return { valid: false, error: `Maximum ${VESTING_LIMITS.MAX_RELEASES} release intervals allowed` };
      }
    }

    if (config.vestingType === VestingType.CLIFF || config.vestingType === VestingType.CLIFF_LINEAR) {
      if (!config.cliffDuration || config.cliffDuration < 0) {
        return { valid: false, error: 'Cliff duration required for CLIFF vesting' };
      }
      if (config.cliffDuration >= duration) {
        return { valid: false, error: 'Cliff duration must be less than total vesting duration' };
      }
    }

    return { valid: true };
  }

  /**
   * Generate release schedule based on vesting configuration
   */
  private generateReleaseSchedule(config: CrossChainVestingConfig): CrossChainVestingRelease[] {
    const releases: CrossChainVestingRelease[] = [];
    const totalAmount = BigInt(config.totalAmount);

    switch (config.vestingType) {
      case VestingType.CLIFF:
        // Single release at cliff end
        releases.push({
          releaseIndex: 1,
          amount: config.totalAmount,
          scheduledTime: new Date((config.startTime + (config.cliffDuration || 0)) * 1000),
          status: ReleaseStatus.PENDING,
        });
        break;

      case VestingType.LINEAR: {
        const intervalCount = config.releaseIntervals || 12;
        const amountPerRelease = totalAmount / BigInt(intervalCount);
        const remainder = totalAmount % BigInt(intervalCount);
        const intervalDuration = (config.endTime - config.startTime) / intervalCount;

        for (let i = 0; i < intervalCount; i++) {
          const releaseTime = config.startTime + (intervalDuration * (i + 1));
          const amount = i === intervalCount - 1
            ? String(amountPerRelease + remainder)
            : String(amountPerRelease);

          releases.push({
            releaseIndex: i + 1,
            amount,
            scheduledTime: new Date(releaseTime * 1000),
            status: ReleaseStatus.PENDING,
          });
        }
        break;
      }

      case VestingType.CLIFF_LINEAR: {
        const cliffEnd = config.startTime + (config.cliffDuration || 0);
        const intervalCount = config.releaseIntervals || 12;
        const amountPerRelease = totalAmount / BigInt(intervalCount);
        const remainder = totalAmount % BigInt(intervalCount);
        const postCliffDuration = config.endTime - cliffEnd;
        const intervalDuration = postCliffDuration / intervalCount;

        for (let i = 0; i < intervalCount; i++) {
          const releaseTime = cliffEnd + (intervalDuration * (i + 1));
          const amount = i === intervalCount - 1
            ? String(amountPerRelease + remainder)
            : String(amountPerRelease);

          releases.push({
            releaseIndex: i + 1,
            amount,
            scheduledTime: new Date(releaseTime * 1000),
            status: ReleaseStatus.PENDING,
          });
        }
        break;
      }

      case VestingType.MILESTONE:
        // Single release at end (milestone-based releases handled externally)
        releases.push({
          releaseIndex: 1,
          amount: config.totalAmount,
          scheduledTime: new Date(config.endTime * 1000),
          status: ReleaseStatus.PENDING,
        });
        break;
    }

    return releases;
  }

  /**
   * Lock VRTY on XRPL (simulated - would call actual XRPL escrow in production)
   */
  private async lockVRTYOnXRPL(schedule: CrossChainVestingSchedule): Promise<{
    success: boolean;
    txHash?: string;
    error?: string;
  }> {
    try {
      // In production, this would:
      // 1. Create an XRPL escrow or send to a locked custody address
      // 2. Wait for confirmation
      // 3. Return the transaction hash

      logger.info('Locking VRTY on XRPL for cross-chain vesting', {
        scheduleId: schedule.scheduleId,
        amount: schedule.totalAmount,
        sourceAddress: schedule.xrplSourceAddress,
      });

      // Simulate successful lock
      const mockTxHash = `XRPL-LOCK-${schedule.scheduleId}-${Date.now()}`;

      return {
        success: true,
        txHash: mockTxHash,
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to lock VRTY',
      };
    }
  }

  /**
   * Process pending releases that are due
   */
  async processPendingReleases(): Promise<void> {
    const now = new Date();

    for (const [scheduleId, schedule] of this.schedules) {
      if (schedule.status !== CrossChainVestingStatus.LOCKED && 
          schedule.status !== CrossChainVestingStatus.VESTING) {
        continue;
      }

      for (const release of schedule.releases) {
        if (release.status !== ReleaseStatus.PENDING) continue;
        if (release.scheduledTime > now) continue;

        // Process this release
        await this.processRelease(schedule, release);
      }
    }
  }

  /**
   * Process a single vesting release
   */
  private async processRelease(
    schedule: CrossChainVestingSchedule,
    release: CrossChainVestingRelease
  ): Promise<void> {
    try {
      release.status = ReleaseStatus.PROCESSING;
      schedule.status = CrossChainVestingStatus.VESTING;
      await this.persistSchedule(schedule);

      logger.info('Processing cross-chain vesting release', {
        scheduleId: schedule.scheduleId,
        releaseIndex: release.releaseIndex,
        amount: release.amount,
        destination: schedule.solanaDestinationAddress,
      });

      // In production, this would:
      // 1. Submit mint request to Solana via bridge
      // 2. Collect validator signatures
      // 3. Execute mint on Solana
      // 4. Update schedule state

      // Simulate successful release
      release.status = ReleaseStatus.COMPLETED;
      release.actualReleaseTime = new Date();
      release.solanaTxHash = `SOLANA-MINT-${schedule.scheduleId}-${release.releaseIndex}-${Date.now()}`;

      // Update released amounts
      const releasedAmount = BigInt(schedule.releasedAmount) + BigInt(release.amount);
      const pendingAmount = BigInt(schedule.totalAmount) - releasedAmount;
      
      schedule.releasedAmount = String(releasedAmount);
      schedule.pendingAmount = String(pendingAmount);

      // Check if all releases complete
      const allComplete = schedule.releases.every(r => r.status === ReleaseStatus.COMPLETED);
      if (allComplete) {
        schedule.status = CrossChainVestingStatus.COMPLETED;
      }

      await this.persistSchedule(schedule);

      this.emit('releaseCompleted', {
        scheduleId: schedule.scheduleId,
        releaseIndex: release.releaseIndex,
        amount: release.amount,
        solanaTxHash: release.solanaTxHash,
      });

    } catch (error) {
      release.status = ReleaseStatus.FAILED;
      release.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.persistSchedule(schedule);

      this.emit('releaseFailed', {
        scheduleId: schedule.scheduleId,
        releaseIndex: release.releaseIndex,
        error: release.errorMessage,
      });
    }
  }

  /**
   * Get vesting schedule status
   */
  async getSchedule(scheduleId: string): Promise<CrossChainVestingSchedule | null> {
    return this.schedules.get(scheduleId) || null;
  }

  /**
   * Get all schedules for an XRPL address
   */
  async getSchedulesByXRPLAddress(address: string): Promise<CrossChainVestingSchedule[]> {
    const schedules: CrossChainVestingSchedule[] = [];
    for (const schedule of this.schedules.values()) {
      if (schedule.xrplSourceAddress === address) {
        schedules.push(schedule);
      }
    }
    return schedules;
  }

  /**
   * Get all schedules for a Solana address
   */
  async getSchedulesBySolanaAddress(address: string): Promise<CrossChainVestingSchedule[]> {
    const schedules: CrossChainVestingSchedule[] = [];
    for (const schedule of this.schedules.values()) {
      if (schedule.solanaDestinationAddress === address) {
        schedules.push(schedule);
      }
    }
    return schedules;
  }

  /**
   * Calculate vesting progress
   */
  calculateProgress(schedule: CrossChainVestingSchedule): {
    percentageReleased: number;
    releasedAmount: string;
    pendingAmount: string;
    nextRelease?: { time: Date; amount: string };
    completedReleases: number;
    totalReleases: number;
  } {
    const total = BigInt(schedule.totalAmount);
    const released = BigInt(schedule.releasedAmount);
    
    const percentageReleased = total > BigInt(0)
      ? Number((released * BigInt(10000)) / total) / 100
      : 0;

    const completedReleases = schedule.releases.filter(
      r => r.status === ReleaseStatus.COMPLETED
    ).length;

    const nextPendingRelease = schedule.releases.find(
      r => r.status === ReleaseStatus.PENDING
    );

    return {
      percentageReleased,
      releasedAmount: schedule.releasedAmount,
      pendingAmount: schedule.pendingAmount,
      nextRelease: nextPendingRelease ? {
        time: nextPendingRelease.scheduledTime,
        amount: nextPendingRelease.amount,
      } : undefined,
      completedReleases,
      totalReleases: schedule.releases.length,
    };
  }

  /**
   * Cancel a vesting schedule (before any releases)
   */
  async cancelSchedule(scheduleId: string): Promise<{
    success: boolean;
    xrplUnlockTxHash?: string;
    error?: string;
  }> {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      return { success: false, error: 'Schedule not found' };
    }

    // Can only cancel if no releases have been processed
    const hasReleases = schedule.releases.some(r => r.status === ReleaseStatus.COMPLETED);
    if (hasReleases) {
      return { success: false, error: 'Cannot cancel schedule with completed releases' };
    }

    try {
      // Unlock VRTY on XRPL (return to source)
      // In production, this would execute the unlock transaction
      const mockUnlockTxHash = `XRPL-UNLOCK-${scheduleId}-${Date.now()}`;

      schedule.status = CrossChainVestingStatus.CANCELLED;
      await this.persistSchedule(schedule);

      this.emit('scheduleCancelled', { scheduleId });

      return {
        success: true,
        xrplUnlockTxHash: mockUnlockTxHash,
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel schedule',
      };
    }
  }

  /**
   * Load schedules from database
   */
  private async loadSchedulesFromDatabase(): Promise<void> {
    // In production, this would query the database
    // For now, we start with empty schedules
    logger.info('Loading cross-chain vesting schedules from database');
  }

  /**
   * Persist schedule to database
   */
  private async persistSchedule(schedule: CrossChainVestingSchedule): Promise<void> {
    schedule.updatedAt = new Date();
    // In production, this would save to the database
    logger.debug('Persisting cross-chain vesting schedule', {
      scheduleId: schedule.scheduleId,
      status: schedule.status,
    });
  }

  /**
   * Start release monitor (checks for pending releases periodically)
   */
  private startReleaseMonitor(): void {
    // Check every minute for pending releases
    this.releaseCheckInterval = setInterval(async () => {
      await this.processPendingReleases();
    }, 60000);

    logger.info('Cross-chain vesting release monitor started');
  }

  /**
   * Shutdown the vesting bridge
   */
  async shutdown(): Promise<void> {
    if (this.releaseCheckInterval) {
      clearInterval(this.releaseCheckInterval);
      this.releaseCheckInterval = null;
    }
    this.isInitialized = false;
    logger.info('CrossChainVestingBridge shut down');
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalSchedules: number;
    activeSchedules: number;
    completedSchedules: number;
    totalLockedVRTY: string;
    totalReleasedWVRTY: string;
  } {
    let activeSchedules = 0;
    let completedSchedules = 0;
    let totalLocked = BigInt(0);
    let totalReleased = BigInt(0);

    for (const schedule of this.schedules.values()) {
      if (schedule.status === CrossChainVestingStatus.VESTING || 
          schedule.status === CrossChainVestingStatus.LOCKED) {
        activeSchedules++;
      }
      if (schedule.status === CrossChainVestingStatus.COMPLETED) {
        completedSchedules++;
      }
      totalLocked += BigInt(schedule.totalAmount);
      totalReleased += BigInt(schedule.releasedAmount);
    }

    return {
      totalSchedules: this.schedules.size,
      activeSchedules,
      completedSchedules,
      totalLockedVRTY: String(totalLocked),
      totalReleasedWVRTY: String(totalReleased),
    };
  }
}

// ============================================================
// SINGLETON EXPORT
// ============================================================

export const crossChainVestingBridge = new CrossChainVestingBridge();
export default CrossChainVestingBridge;
