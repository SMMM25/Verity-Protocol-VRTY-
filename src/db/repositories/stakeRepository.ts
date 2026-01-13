/**
 * Verity Protocol - Stake Repository
 * 
 * Database operations for VRTY staking.
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
   */
  async upsertStake(data: {
    userId: string;
    wallet: string;
    amount: number;
    lockPeriodDays?: number;
    stakeTxHash?: string;
  }): Promise<Stake> {
    const tier = calculateTier(data.amount);
    const lockEndDate = data.lockPeriodDays 
      ? new Date(Date.now() + data.lockPeriodDays * 24 * 60 * 60 * 1000)
      : null;

    const stake = await prisma.stake.upsert({
      where: {
        userId_wallet: {
          userId: data.userId,
          wallet: data.wallet,
        },
      },
      update: {
        amount: { increment: data.amount },
        tier,
        lockEndDate: lockEndDate || undefined,
        lockPeriodDays: data.lockPeriodDays,
        stakeTxHash: data.stakeTxHash,
      },
      create: {
        userId: data.userId,
        wallet: data.wallet,
        amount: data.amount,
        tier,
        lockEndDate,
        lockPeriodDays: data.lockPeriodDays,
        stakeTxHash: data.stakeTxHash,
      },
    });

    // Recalculate tier after update
    const updatedTier = calculateTier(stake.amount);
    if (updatedTier !== stake.tier) {
      return prisma.stake.update({
        where: { id: stake.id },
        data: { tier: updatedTier },
      });
    }

    logger.info('Stake upserted', { wallet: data.wallet, amount: data.amount, tier: updatedTier });
    return stake;
  },

  /**
   * Reduce stake amount (unstake)
   */
  async reduceStake(data: {
    userId: string;
    wallet: string;
    amount: number;
  }): Promise<Stake | null> {
    const existingStake = await prisma.stake.findUnique({
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
      return prisma.stake.update({
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
    return prisma.stake.update({
      where: { id: existingStake.id },
      data: {
        amount: newAmount,
        tier: newTier,
      },
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
   * Add rewards to stakers
   */
  async addRewards(rewardPerToken: number): Promise<number> {
    const stakes = await prisma.stake.findMany({
      where: {
        unstakedAt: null,
        amount: { gt: 0 },
      },
    });

    let totalDistributed = 0;

    for (const stake of stakes) {
      const reward = Number(stake.amount) * rewardPerToken;
      totalDistributed += reward;

      await prisma.stake.update({
        where: { id: stake.id },
        data: {
          rewardsEarned: { increment: reward },
          lastRewardAt: new Date(),
        },
      });
    }

    return totalDistributed;
  },

  /**
   * Claim rewards
   */
  async claimRewards(userId: string, wallet: string): Promise<number> {
    const stake = await prisma.stake.findUnique({
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

    await prisma.stake.update({
      where: { id: stake.id },
      data: {
        rewardsClaimed: stake.rewardsEarned,
      },
    });

    return unclaimed;
  },
};

export default stakeRepository;
