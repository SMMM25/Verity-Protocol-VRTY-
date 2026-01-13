/**
 * @fileoverview Verity Protocol - Token API Routes
 * @module api/routes/token
 * @description
 * VRTY token operations including staking, rewards, and fee calculations.
 * Now uses database-backed storage via Prisma repositories.
 * 
 * @features
 * - Token information and supply tracking
 * - Staking tier management (BASIC, PROFESSIONAL, INSTITUTIONAL, DEVELOPER)
 * - Stake/unstake operations (database-backed)
 * - Fee calculation with VRTY discounts
 * - Revenue and buyback history
 * 
 * @version 2.0.0
 * @since Phase 2 - Database Integration
 * @author Verity Protocol Team
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { stakeRepository, calculateTier } from '../../db/repositories/stakeRepository.js';
import { prisma, checkDatabaseHealth } from '../../db/client.js';
import { clearTierCache } from '../middleware/rateLimit.js';
import { logger } from '../../utils/logger.js';

const router = Router();

// ============================================================
// VALIDATION SCHEMAS
// ============================================================

/**
 * Schema for staking VRTY tokens
 */
const stakeSchema = z.object({
  amount: z.string().min(1, 'Amount is required'),
  lockPeriodDays: z.number().int().min(0).max(365).optional(),
  wallet: z.string().min(1, 'Wallet address is required'),
});

/**
 * Schema for unstaking VRTY tokens
 */
const unstakeSchema = z.object({
  amount: z.string().min(1, 'Amount is required'),
  wallet: z.string().min(1, 'Wallet address is required'),
});

// Staking tier configurations
const STAKING_TIERS = [
  {
    tier: 'BASIC',
    minStake: '1000',
    feeDiscount: 2500,
    features: ['Advanced portfolio analytics', 'Tax optimization', 'Priority support'],
  },
  {
    tier: 'PROFESSIONAL',
    minStake: '10000',
    feeDiscount: 5000,
    features: ['Guild creation', 'Advanced API access', 'White-label options', 'All Basic features'],
  },
  {
    tier: 'INSTITUTIONAL',
    minStake: '50000',
    feeDiscount: 7500,
    features: ['Asset tokenization', 'Regulatory dashboard', 'Dedicated management', 'All Professional features'],
  },
  {
    tier: 'DEVELOPER',
    minStake: '5000',
    feeDiscount: 5000,
    features: ['Full API access', 'Webhooks', 'Beta features', 'Developer support'],
  },
];

// Base fee rates in basis points
const BASE_FEES: Record<string, number> = {
  DEX_TRADE: 10,
  ASSET_TOKENIZATION: 25,
  SIGNAL_SEND: 5,
  GUILD_OPERATION: 15,
};

// ============================================================
// TOKEN INFORMATION ENDPOINTS
// ============================================================

/**
 * @route GET /token/info
 * @summary Get VRTY token information with live database stats
 */
router.get('/info', async (req: Request, res: Response) => {
  try {
    const dbHealth = await checkDatabaseHealth();
    let totalStaked = '0';
    let totalBurned = '0';
    let stakerCount = 0;

    if (dbHealth.connected) {
      try {
        totalStaked = (await stakeRepository.getTotalStaked()).toString();
        const allStakes = await stakeRepository.getAllActiveStakes();
        stakerCount = allStakes.length;
        
        // Get total burned from buyback burns
        const burns = await prisma.buybackBurn.aggregate({
          _sum: { vrtyBurned: true },
        });
        totalBurned = Number(burns._sum?.vrtyBurned || 0).toString();
      } catch (error) {
        logger.warn('Failed to fetch token stats from DB', { error });
      }
    }

    const totalSupply = '1000000000';
    const circulatingSupply = (
      parseFloat(totalSupply) - parseFloat(totalBurned)
    ).toString();

    res.json({
      success: true,
      data: {
        name: 'Verity Protocol Token',
        symbol: 'VRTY',
        totalSupply,
        circulatingSupply,
        totalStaked,
        totalBurned,
        stakerCount,
        decimals: 6,
        issuer: process.env['VERITY_ISSUER_ADDRESS'] || 'Not configured',
        databaseConnected: dbHealth.connected,
      },
      meta: {
        requestId: req.requestId,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    logger.error('Error fetching token info', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch token information',
      },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  }
});

/**
 * @route GET /token/tiers
 * @summary Get staking tier configurations
 */
router.get('/tiers', async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: { tiers: STAKING_TIERS },
    meta: {
      requestId: req.requestId,
      timestamp: new Date(),
    },
  });
});

// ============================================================
// STAKING ENDPOINTS (DATABASE-BACKED)
// ============================================================

/**
 * @route POST /token/stake
 * @summary Stake VRTY tokens (persisted to database)
 */
router.post('/stake', async (req: Request, res: Response) => {
  try {
    const validatedData = stakeSchema.parse(req.body);
    const amount = parseFloat(validatedData.amount);

    if (amount < 1000) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_AMOUNT',
          message: 'Minimum stake is 1000 VRTY to reach BASIC tier',
        },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    // Create or update stake in database
    const stake = await stakeRepository.upsertStake({
      userId: validatedData.wallet, // Using wallet as userId for now
      wallet: validatedData.wallet,
      amount,
      lockPeriodDays: validatedData.lockPeriodDays,
    });

    // Clear rate limit tier cache for this wallet
    clearTierCache(validatedData.wallet);

    logger.info('Stake created/updated', {
      wallet: validatedData.wallet,
      amount,
      tier: stake.tier,
    });

    res.status(201).json({
      success: true,
      data: {
        message: 'Stake created successfully',
        stake: {
          wallet: stake.wallet,
          amount: Number(stake.amount).toString(),
          tier: stake.tier,
          stakedAt: stake.stakedAt,
          lockEndDate: stake.lockEndDate,
          rewardsEarned: Number(stake.rewardsEarned).toString(),
          rewardsClaimed: Number(stake.rewardsClaimed).toString(),
        },
        note: 'For production, integrate with XUMM for wallet signature verification',
      },
      meta: {
        requestId: req.requestId,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: error.errors,
        },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }
    logger.error('Stake error', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: (error as Error).message || 'Failed to create stake',
      },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  }
});

/**
 * @route POST /token/unstake
 * @summary Unstake VRTY tokens (updates database)
 */
router.post('/unstake', async (req: Request, res: Response) => {
  try {
    const validatedData = unstakeSchema.parse(req.body);
    const amount = parseFloat(validatedData.amount);

    // Reduce stake in database
    const updatedStake = await stakeRepository.reduceStake({
      userId: validatedData.wallet,
      wallet: validatedData.wallet,
      amount,
    });

    // Clear rate limit tier cache
    clearTierCache(validatedData.wallet);

    logger.info('Stake reduced', {
      wallet: validatedData.wallet,
      amountUnstaked: amount,
      remainingStake: updatedStake ? Number(updatedStake.amount) : 0,
    });

    res.json({
      success: true,
      data: {
        message: updatedStake && Number(updatedStake.amount) > 0
          ? 'Partial unstake successful'
          : 'Full unstake successful',
        stake: updatedStake ? {
          wallet: updatedStake.wallet,
          amount: Number(updatedStake.amount).toString(),
          tier: updatedStake.tier,
        } : null,
        amountUnstaked: amount.toString(),
      },
      meta: {
        requestId: req.requestId,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: error.errors,
        },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }
    
    const errorMessage = (error as Error).message;
    const statusCode = errorMessage.includes('No stake found') || 
                       errorMessage.includes('Insufficient') ||
                       errorMessage.includes('locked') ? 400 : 500;
    
    res.status(statusCode).json({
      success: false,
      error: {
        code: statusCode === 400 ? 'BAD_REQUEST' : 'INTERNAL_ERROR',
        message: errorMessage || 'Failed to unstake',
      },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  }
});

/**
 * @route GET /token/stake/:wallet
 * @summary Get stake information for a wallet (from database)
 */
router.get('/stake/:wallet', async (req: Request, res: Response) => {
  try {
    const wallet = req.params['wallet'] || '';
    const stake = await stakeRepository.getByWallet(wallet);

    if (!stake || Number(stake.amount) <= 0) {
      res.json({
        success: true,
        data: {
          wallet,
          stake: null,
          message: 'No active stake found for this wallet',
        },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    const pendingRewards = Number(stake.rewardsEarned) - Number(stake.rewardsClaimed);

    res.json({
      success: true,
      data: {
        wallet,
        stake: {
          amount: Number(stake.amount).toString(),
          tier: stake.tier,
          stakedAt: stake.stakedAt,
          lockedUntil: stake.lockEndDate,
          lockPeriodDays: stake.lockPeriodDays,
          pendingRewards: pendingRewards.toFixed(6),
          rewardsEarned: Number(stake.rewardsEarned).toString(),
          rewardsClaimed: Number(stake.rewardsClaimed).toString(),
          lastRewardAt: stake.lastRewardAt,
        },
      },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  } catch (error) {
    logger.error('Error fetching stake', { error, wallet: req.params['wallet'] });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch stake information',
      },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  }
});

/**
 * @route GET /token/stakers
 * @summary Get all active stakers with pagination
 */
router.get('/stakers', async (req: Request, res: Response) => {
  try {
    const allStakes = await stakeRepository.getAllActiveStakes();
    const tierCounts = await stakeRepository.getStakerCountByTier();
    const totalStaked = await stakeRepository.getTotalStaked();

    res.json({
      success: true,
      data: {
        stakers: allStakes.map(s => ({
          wallet: s.wallet,
          amount: Number(s.amount).toString(),
          tier: s.tier,
          stakedAt: s.stakedAt,
        })),
        summary: {
          totalStakers: allStakes.length,
          totalStaked: totalStaked.toString(),
          byTier: tierCounts,
        },
      },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  } catch (error) {
    logger.error('Error fetching stakers', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch stakers',
      },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  }
});

// ============================================================
// REWARDS ENDPOINTS
// ============================================================

/**
 * @route POST /token/rewards/claim
 * @summary Claim staking rewards
 */
router.post('/rewards/claim', async (req: Request, res: Response) => {
  try {
    const { wallet } = req.body;

    if (!wallet) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Wallet address is required',
        },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    const claimedAmount = await stakeRepository.claimRewards(wallet, wallet);

    logger.info('Rewards claimed', { wallet, amount: claimedAmount });

    res.json({
      success: true,
      data: {
        message: 'Rewards claimed successfully',
        claimedAmount: claimedAmount.toFixed(6),
        wallet,
        note: 'For production, XRPL transaction would be created to transfer rewards',
      },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    const statusCode = errorMessage.includes('No stake') || 
                       errorMessage.includes('No rewards') ? 400 : 500;
    
    res.status(statusCode).json({
      success: false,
      error: {
        code: statusCode === 400 ? 'BAD_REQUEST' : 'INTERNAL_ERROR',
        message: errorMessage || 'Failed to claim rewards',
      },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  }
});

// ============================================================
// FEE CALCULATION ENDPOINTS
// ============================================================

/**
 * @route GET /token/fees/calculate
 * @summary Calculate fees with VRTY discount (uses database for tier lookup)
 */
router.get('/fees/calculate', async (req: Request, res: Response) => {
  const { feeType, amount, wallet, payWithVRTY } = req.query;

  if (!feeType || !amount) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Fee type and amount are required',
      },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
    return;
  }

  try {
    const baseFeeRate = BASE_FEES[feeType as string] || 10;
    const baseFee = (parseFloat(amount as string) * baseFeeRate) / 10000;

    // Get tier discount from database
    let tierDiscount = 0;
    let userTier = 'NONE';

    if (wallet && typeof wallet === 'string') {
      const tier = await stakeRepository.getUserTier(wallet);
      userTier = tier;
      const tierConfig = STAKING_TIERS.find(t => t.tier === tier);
      if (tierConfig) {
        tierDiscount = baseFee * (tierConfig.feeDiscount / 10000);
      }
    }

    // Additional discount for VRTY payment
    const vrtyPaymentDiscount = payWithVRTY === 'true' ? baseFee * 0.25 : 0;
    const totalDiscount = Math.min(tierDiscount + vrtyPaymentDiscount, baseFee * 0.75); // Max 75%
    const finalFee = baseFee - totalDiscount;

    res.json({
      success: true,
      data: {
        feeType,
        amount,
        userTier,
        baseFee: baseFee.toFixed(6),
        tierDiscount: tierDiscount.toFixed(6),
        vrtyPaymentDiscount: vrtyPaymentDiscount.toFixed(6),
        totalDiscount: totalDiscount.toFixed(6),
        finalFee: finalFee.toFixed(6),
        paidInVRTY: payWithVRTY === 'true',
        discountPercentage: ((totalDiscount / baseFee) * 100).toFixed(2) + '%',
      },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  } catch (error) {
    logger.error('Fee calculation error', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to calculate fees',
      },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  }
});

// ============================================================
// REVENUE & BUYBACK HISTORY
// ============================================================

/**
 * @route GET /token/revenue/history
 * @summary Get revenue distribution history from database
 */
router.get('/revenue/history', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query['page'] as string, 10) || 1;
    const limit = Math.min(parseInt(req.query['limit'] as string, 10) || 20, 100);
    const skip = (page - 1) * limit;

    const [distributions, total] = await Promise.all([
      prisma.revenueDistribution.findMany({
        skip,
        take: limit,
        orderBy: { distributedAt: 'desc' },
      }),
      prisma.revenueDistribution.count(),
    ]);

    res.json({
      success: true,
      data: {
        distributions: distributions.map(d => ({
          id: d.id,
          period: d.period,
          totalRevenue: Number(d.totalRevenue).toString(),
          stakerPool: Number(d.stakerPool).toString(),
          buybackPool: Number(d.buybackPool).toString(),
          rewardPerToken: Number(d.rewardPerToken).toString(),
          distributedAt: d.distributedAt,
        })),
      },
      meta: {
        requestId: req.requestId,
        timestamp: new Date(),
        pagination: {
          page,
          pageSize: limit,
          totalItems: total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrevious: page > 1,
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching revenue history', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch revenue history',
      },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  }
});

/**
 * @route GET /token/buyback/history
 * @summary Get buyback and burn history from database
 */
router.get('/buyback/history', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query['page'] as string, 10) || 1;
    const limit = Math.min(parseInt(req.query['limit'] as string, 10) || 20, 100);
    const skip = (page - 1) * limit;

    const [burns, total] = await Promise.all([
      prisma.buybackBurn.findMany({
        skip,
        take: limit,
        orderBy: { executedAt: 'desc' },
      }),
      prisma.buybackBurn.count(),
    ]);

    // Get aggregate stats
    const stats = await prisma.buybackBurn.aggregate({
      _sum: { vrtyBurned: true },
      _count: true,
    });

    res.json({
      success: true,
      data: {
        burns: burns.map(b => ({
          id: b.id,
          amountBurned: Number(b.vrtyBurned).toString(),
          averagePrice: Number(b.averagePrice).toString(),
          burnedAt: b.executedAt,
          transactionHash: b.burnTxHash,
        })),
        summary: {
          totalBurned: Number(stats._sum?.vrtyBurned || 0).toString(),
          totalOperations: stats._count,
        },
      },
      meta: {
        requestId: req.requestId,
        timestamp: new Date(),
        pagination: {
          page,
          pageSize: limit,
          totalItems: total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrevious: page > 1,
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching buyback history', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch buyback history',
      },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  }
});

export { router as tokenRoutes };
