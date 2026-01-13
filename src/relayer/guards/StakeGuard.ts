/**
 * Verity Protocol - Stake Guard
 * 
 * @module relayer/guards/StakeGuard
 * @description Anti-Sybil protection through VRTY staking requirements.
 * Verifies minimum stake for relayer access and determines tier benefits.
 */

import { Client } from 'xrpl';
import { logger } from '../../utils/logger.js';
import { prisma } from '../../db/client.js';
import { StakingTierEnum, RELAYER_CONFIG, type StakingTier } from '../types.js';

/**
 * VRTY staking thresholds for relayer access
 */
const STAKE_THRESHOLDS: Record<StakingTier, number> = {
  [StakingTierEnum.NONE]: 0,
  [StakingTierEnum.EXPLORER]: 1,          // 1 VRTY
  [StakingTierEnum.NAVIGATOR]: 1000,      // 1,000 VRTY
  [StakingTierEnum.CAPTAIN]: 10000,       // 10,000 VRTY
  [StakingTierEnum.ADMIRAL]: 50000,       // 50,000 VRTY
  [StakingTierEnum.COMMODORE]: 200000     // 200,000 VRTY
};

/**
 * Minimum stake required for gasless transactions
 */
const MINIMUM_STAKE_FOR_GASLESS = RELAYER_CONFIG.antiAbuse.minimumStake;

/**
 * Stake verification result
 */
export interface StakeVerificationResult {
  eligible: boolean;
  walletAddress: string;
  tier: StakingTier;
  stakeAmount: number;
  minimumRequired: number;
  additionalNeeded: number;
  benefits: TierBenefits;
  verifiedAt: Date;
  reason?: string;
}

/**
 * Tier benefits
 */
export interface TierBenefits {
  dailyTransactions: number;
  monthlyTransactions: number;
  prioritySubmission: boolean;
  reducedFees: boolean;
  feeDiscount: number;  // percentage
}

/**
 * Tier benefits configuration
 */
const TIER_BENEFITS: Record<StakingTier, TierBenefits> = {
  [StakingTierEnum.NONE]: {
    dailyTransactions: 0,
    monthlyTransactions: 0,
    prioritySubmission: false,
    reducedFees: false,
    feeDiscount: 0
  },
  [StakingTierEnum.EXPLORER]: {
    dailyTransactions: 10,
    monthlyTransactions: 100,
    prioritySubmission: false,
    reducedFees: false,
    feeDiscount: 0
  },
  [StakingTierEnum.NAVIGATOR]: {
    dailyTransactions: 50,
    monthlyTransactions: 500,
    prioritySubmission: false,
    reducedFees: false,
    feeDiscount: 0
  },
  [StakingTierEnum.CAPTAIN]: {
    dailyTransactions: 200,
    monthlyTransactions: 2000,
    prioritySubmission: true,
    reducedFees: false,
    feeDiscount: 0
  },
  [StakingTierEnum.ADMIRAL]: {
    dailyTransactions: 500,
    monthlyTransactions: 5000,
    prioritySubmission: true,
    reducedFees: true,
    feeDiscount: 25  // 25% discount on premium features
  },
  [StakingTierEnum.COMMODORE]: {
    dailyTransactions: 2000,
    monthlyTransactions: 20000,
    prioritySubmission: true,
    reducedFees: true,
    feeDiscount: 50  // 50% discount on premium features
  }
};

/**
 * Stake Guard
 * 
 * Provides anti-Sybil protection by requiring VRTY staking.
 * Features:
 * - Real-time stake verification from XRPL
 * - Tier determination based on stake amount
 * - Caching for performance
 * - Grace period for recently staked tokens
 */
export class StakeGuard {
  private client: Client;
  private stakeCache: Map<string, {
    result: StakeVerificationResult;
    cachedAt: Date;
  }> = new Map();
  private cacheTTLMs: number = 60000; // 1 minute cache
  private isInitialized: boolean = false;

  // VRTY token configuration
  private readonly vrtyIssuer: string;
  private readonly vrtyCurrency: string = 'VRTY';

  constructor() {
    const network = process.env['XRPL_NETWORK'] || 'testnet';
    const wsUrl = network === 'mainnet'
      ? 'wss://xrplcluster.com'
      : 'wss://s.altnet.rippletest.net:51233';
    
    this.client = new Client(wsUrl);
    this.vrtyIssuer = process.env['VRTY_ISSUER_ADDRESS'] || 'rBeHfq9vRjZ8Cth1sMbp2nJvExmxSxAH8f';
  }

  /**
   * Initialize stake guard
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      if (!this.client.isConnected()) {
        await this.client.connect();
      }
      this.isInitialized = true;
      logger.info('Stake guard initialized', { vrtyIssuer: this.vrtyIssuer });
    } catch (error) {
      logger.error('Failed to initialize stake guard', { error });
      throw error;
    }
  }

  /**
   * Verify wallet meets minimum stake requirement for relayer access
   */
  async verifyEligibility(walletAddress: string): Promise<StakeVerificationResult> {
    // Check cache first
    const cached = this.stakeCache.get(walletAddress);
    if (cached && (Date.now() - cached.cachedAt.getTime()) < this.cacheTTLMs) {
      return cached.result;
    }

    try {
      // Get VRTY balance from XRPL
      const stakeAmount = await this.getVRTYBalance(walletAddress);
      
      // Also check database for staked amounts (could be in escrow)
      const dbStake = await this.getStakedAmount(walletAddress);
      const totalStake = stakeAmount + dbStake;

      // Determine tier
      const tier = this.determineTier(totalStake);

      // Check if eligible for gasless
      const eligible = totalStake >= MINIMUM_STAKE_FOR_GASLESS || 
                       tier !== StakingTierEnum.NONE;

      const result: StakeVerificationResult = {
        eligible,
        walletAddress,
        tier,
        stakeAmount: totalStake,
        minimumRequired: MINIMUM_STAKE_FOR_GASLESS,
        additionalNeeded: Math.max(0, MINIMUM_STAKE_FOR_GASLESS - totalStake),
        benefits: TIER_BENEFITS[tier],
        verifiedAt: new Date(),
        reason: eligible ? undefined : `Minimum stake of ${MINIMUM_STAKE_FOR_GASLESS} VRTY required`
      };

      // Cache result
      this.stakeCache.set(walletAddress, { result, cachedAt: new Date() });

      logger.debug('Stake verification completed', {
        walletAddress,
        stakeAmount: totalStake,
        tier,
        eligible
      });

      return result;

    } catch (error) {
      logger.error('Stake verification failed', { error, walletAddress });
      
      // Return ineligible on error (fail safe)
      return {
        eligible: false,
        walletAddress,
        tier: StakingTierEnum.NONE,
        stakeAmount: 0,
        minimumRequired: MINIMUM_STAKE_FOR_GASLESS,
        additionalNeeded: MINIMUM_STAKE_FOR_GASLESS,
        benefits: TIER_BENEFITS[StakingTierEnum.NONE],
        verifiedAt: new Date(),
        reason: 'Unable to verify stake - please try again'
      };
    }
  }

  /**
   * Get VRTY balance from XRPL trust line
   */
  private async getVRTYBalance(walletAddress: string): Promise<number> {
    try {
      if (!this.client.isConnected()) {
        await this.client.connect();
      }

      const response = await this.client.request({
        command: 'account_lines',
        account: walletAddress,
        peer: this.vrtyIssuer,
        ledger_index: 'validated'
      });

      const vrtyLine = response.result.lines.find(
        (line: any) => line.currency === this.vrtyCurrency
      );

      if (!vrtyLine) {
        return 0;
      }

      return parseFloat(vrtyLine.balance);

    } catch (error: any) {
      // Account not found means 0 balance
      if (error.data?.error === 'actNotFound') {
        return 0;
      }
      throw error;
    }
  }

  /**
   * Get staked amount from database (for escrow-based staking)
   */
  private async getStakedAmount(walletAddress: string): Promise<number> {
    // For now, return 0 - DB persistence will be added when Prisma model exists
    logger.debug('Staked amount lookup', { walletAddress });
    return 0;
  }

  /**
   * Determine staking tier from amount
   */
  private determineTier(amount: number): StakingTier {
    if (amount >= STAKE_THRESHOLDS[StakingTierEnum.COMMODORE]) {
      return StakingTierEnum.COMMODORE;
    }
    if (amount >= STAKE_THRESHOLDS[StakingTierEnum.ADMIRAL]) {
      return StakingTierEnum.ADMIRAL;
    }
    if (amount >= STAKE_THRESHOLDS[StakingTierEnum.CAPTAIN]) {
      return StakingTierEnum.CAPTAIN;
    }
    if (amount >= STAKE_THRESHOLDS[StakingTierEnum.NAVIGATOR]) {
      return StakingTierEnum.NAVIGATOR;
    }
    if (amount >= STAKE_THRESHOLDS[StakingTierEnum.EXPLORER]) {
      return StakingTierEnum.EXPLORER;
    }
    return StakingTierEnum.NONE;
  }

  /**
   * Check if address is blacklisted
   */
  async isBlacklisted(walletAddress: string): Promise<boolean> {
    // For now, return false - DB persistence will be added when Prisma model exists
    logger.debug('Blacklist check', { walletAddress });
    return false;
  }

  /**
   * Add address to blacklist
   */
  async addToBlacklist(
    walletAddress: string,
    reason: string,
    addedBy: string
  ): Promise<void> {
    // Clear cache
    this.stakeCache.delete(walletAddress);
    // Log - DB persistence will be added when Prisma model exists
    logger.info('Address added to blacklist', { walletAddress, reason, addedBy });
  }

  /**
   * Remove address from blacklist
   */
  async removeFromBlacklist(walletAddress: string): Promise<void> {
    // Log - DB persistence will be added when Prisma model exists
    logger.info('Address removed from blacklist', { walletAddress });
  }

  /**
   * Get stake thresholds (for UI/documentation)
   */
  getStakeThresholds(): typeof STAKE_THRESHOLDS {
    return STAKE_THRESHOLDS;
  }

  /**
   * Get tier benefits (for UI/documentation)
   */
  getTierBenefits(): typeof TIER_BENEFITS {
    return TIER_BENEFITS;
  }

  /**
   * Clear cache for a specific address
   */
  clearCache(walletAddress?: string): void {
    if (walletAddress) {
      this.stakeCache.delete(walletAddress);
    } else {
      this.stakeCache.clear();
    }
  }

  /**
   * Get next tier info for upgrade path
   */
  getNextTierInfo(currentTier: StakingTier): {
    nextTier: StakingTier | null;
    stakeRequired: number;
    benefits: TierBenefits | null;
  } {
    const tierOrder: StakingTier[] = [
      StakingTierEnum.NONE,
      StakingTierEnum.EXPLORER,
      StakingTierEnum.NAVIGATOR,
      StakingTierEnum.CAPTAIN,
      StakingTierEnum.ADMIRAL,
      StakingTierEnum.COMMODORE
    ];

    const currentIndex = tierOrder.indexOf(currentTier);
    if (currentIndex === tierOrder.length - 1 || currentIndex === -1) {
      return { nextTier: null, stakeRequired: 0, benefits: null };
    }

    const nextTier = tierOrder[currentIndex + 1];
    if (!nextTier) {
      return { nextTier: null, stakeRequired: 0, benefits: null };
    }
    
    return {
      nextTier,
      stakeRequired: STAKE_THRESHOLDS[nextTier],
      benefits: TIER_BENEFITS[nextTier]
    };
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    if (this.client.isConnected()) {
      await this.client.disconnect();
    }
    this.stakeCache.clear();
    this.isInitialized = false;
    logger.info('Stake guard shut down');
  }
}

// Export singleton instance
export const stakeGuard = new StakeGuard();
