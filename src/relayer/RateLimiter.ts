/**
 * Verity Protocol - Rate Limiter
 * 
 * @module relayer/RateLimiter
 * @description Per-wallet rate limiting and quota management for the relayer.
 * Implements tiered limits based on VRTY staking status.
 */

import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';
import { logger } from '../utils/logger.js';
import { prisma } from '../db/client.js';
import { 
  RELAYER_CONFIG, 
  StakingTierEnum, 
  RelayerQuota,
  type StakingTier 
} from './types.js';

/**
 * Rate limit configuration per staking tier
 */
const TIER_LIMITS: Record<StakingTier, {
  dailyTransactions: number;
  monthlyTransactions: number;
  dailyFeeLimit: number;  // in drops
  burstLimit: number;     // per minute
}> = {
  [StakingTierEnum.NONE]: {
    dailyTransactions: 10,
    monthlyTransactions: 100,
    dailyFeeLimit: 100000,  // 0.1 XRP
    burstLimit: 2
  },
  [StakingTierEnum.EXPLORER]: {
    dailyTransactions: 50,
    monthlyTransactions: 500,
    dailyFeeLimit: 500000,  // 0.5 XRP
    burstLimit: 5
  },
  [StakingTierEnum.NAVIGATOR]: {
    dailyTransactions: 200,
    monthlyTransactions: 2000,
    dailyFeeLimit: 2000000,  // 2 XRP
    burstLimit: 10
  },
  [StakingTierEnum.CAPTAIN]: {
    dailyTransactions: 500,
    monthlyTransactions: 5000,
    dailyFeeLimit: 5000000,  // 5 XRP
    burstLimit: 20
  },
  [StakingTierEnum.ADMIRAL]: {
    dailyTransactions: 1000,
    monthlyTransactions: 10000,
    dailyFeeLimit: 10000000,  // 10 XRP
    burstLimit: 30
  },
  [StakingTierEnum.COMMODORE]: {
    dailyTransactions: 2000,
    monthlyTransactions: 20000,
    dailyFeeLimit: 20000000,  // 20 XRP
    burstLimit: 50
  }
};

/**
 * Rate limit check result
 */
export interface RateLimitResult {
  allowed: boolean;
  tier: StakingTier;
  remaining: {
    daily: number;
    monthly: number;
    burst: number;
  };
  limits: {
    daily: number;
    monthly: number;
    burst: number;
  };
  retryAfterMs?: number;
  reason?: string;
}

/**
 * User usage tracking
 */
interface UserUsage {
  dailyCount: number;
  monthlyCount: number;
  dailyFeeSpent: number;
  lastResetDay: string;
  lastResetMonth: string;
}

/**
 * Rate Limiter for Relayer
 * 
 * Implements multi-level rate limiting:
 * 1. Burst limit (per minute) - prevent rapid-fire abuse
 * 2. Daily limit - sustainable daily usage
 * 3. Monthly limit - overall fair usage
 * 4. Fee limit - treasury protection
 * 
 * Limits scale with VRTY staking tier.
 */
export class RelayerRateLimiter {
  private burstLimiters: Map<StakingTier, RateLimiterMemory> = new Map();
  private userUsage: Map<string, UserUsage> = new Map();
  private isInitialized: boolean = false;

  constructor() {
    this.initializeBurstLimiters();
  }

  /**
   * Initialize burst limiters for each tier
   */
  private initializeBurstLimiters(): void {
    for (const tier of Object.values(StakingTierEnum) as StakingTier[]) {
      const limits = TIER_LIMITS[tier];
      
      this.burstLimiters.set(tier, new RateLimiterMemory({
        points: limits.burstLimit,
        duration: 60,  // 1 minute
        blockDuration: 60  // Block for 1 minute if exceeded
      }));
    }

    this.isInitialized = true;
    logger.info('Rate limiters initialized for all tiers');
  }

  /**
   * Check if a wallet can submit a transaction
   */
  async checkLimit(
    walletAddress: string,
    estimatedFeeDrops: string = '12'
  ): Promise<RateLimitResult> {
    // Get user's staking tier
    const tier = await this.getUserTier(walletAddress);
    const limits = TIER_LIMITS[tier];

    // Get or initialize usage tracking
    const usage = await this.getUserUsage(walletAddress);

    // Check burst limit first (fastest fail)
    const burstLimiter = this.burstLimiters.get(tier);
    if (burstLimiter) {
      try {
        const burstResult = await burstLimiter.consume(walletAddress);
        
        // Check daily limit
        if (usage.dailyCount >= limits.dailyTransactions) {
          return {
            allowed: false,
            tier,
            remaining: {
              daily: 0,
              monthly: Math.max(0, limits.monthlyTransactions - usage.monthlyCount),
              burst: burstResult.remainingPoints
            },
            limits: {
              daily: limits.dailyTransactions,
              monthly: limits.monthlyTransactions,
              burst: limits.burstLimit
            },
            reason: 'Daily transaction limit exceeded'
          };
        }

        // Check monthly limit
        if (usage.monthlyCount >= limits.monthlyTransactions) {
          return {
            allowed: false,
            tier,
            remaining: {
              daily: Math.max(0, limits.dailyTransactions - usage.dailyCount),
              monthly: 0,
              burst: burstResult.remainingPoints
            },
            limits: {
              daily: limits.dailyTransactions,
              monthly: limits.monthlyTransactions,
              burst: limits.burstLimit
            },
            reason: 'Monthly transaction limit exceeded'
          };
        }

        // Check daily fee limit
        const feeAmount = parseInt(estimatedFeeDrops, 10);
        if (usage.dailyFeeSpent + feeAmount > limits.dailyFeeLimit) {
          return {
            allowed: false,
            tier,
            remaining: {
              daily: Math.max(0, limits.dailyTransactions - usage.dailyCount),
              monthly: Math.max(0, limits.monthlyTransactions - usage.monthlyCount),
              burst: burstResult.remainingPoints
            },
            limits: {
              daily: limits.dailyTransactions,
              monthly: limits.monthlyTransactions,
              burst: limits.burstLimit
            },
            reason: 'Daily fee limit exceeded'
          };
        }

        // All checks passed
        return {
          allowed: true,
          tier,
          remaining: {
            daily: limits.dailyTransactions - usage.dailyCount - 1,
            monthly: limits.monthlyTransactions - usage.monthlyCount - 1,
            burst: burstResult.remainingPoints - 1
          },
          limits: {
            daily: limits.dailyTransactions,
            monthly: limits.monthlyTransactions,
            burst: limits.burstLimit
          }
        };

      } catch (error) {
        // Burst limit exceeded
        if (error instanceof Error && 'msBeforeNext' in error) {
          const rateLimitError = error as unknown as RateLimiterRes;
          return {
            allowed: false,
            tier,
            remaining: {
              daily: Math.max(0, limits.dailyTransactions - usage.dailyCount),
              monthly: Math.max(0, limits.monthlyTransactions - usage.monthlyCount),
              burst: 0
            },
            limits: {
              daily: limits.dailyTransactions,
              monthly: limits.monthlyTransactions,
              burst: limits.burstLimit
            },
            retryAfterMs: rateLimitError.msBeforeNext,
            reason: 'Burst limit exceeded, slow down'
          };
        }
        throw error;
      }
    }

    // Fallback if burst limiter not found
    return {
      allowed: false,
      tier,
      remaining: { daily: 0, monthly: 0, burst: 0 },
      limits: {
        daily: limits.dailyTransactions,
        monthly: limits.monthlyTransactions,
        burst: limits.burstLimit
      },
      reason: 'Rate limiter not initialized'
    };
  }

  /**
   * Record successful transaction (increment counters)
   */
  async recordTransaction(
    walletAddress: string,
    feeDrops: string
  ): Promise<void> {
    const usage = await this.getUserUsage(walletAddress);
    
    usage.dailyCount++;
    usage.monthlyCount++;
    usage.dailyFeeSpent += parseInt(feeDrops, 10);

    this.userUsage.set(walletAddress, usage);

    // Persist to database - skip if model doesn't exist
    logger.debug('Transaction recorded', {
      walletAddress,
      dailyCount: usage.dailyCount,
      monthlyCount: usage.monthlyCount,
      dailyFeeSpent: usage.dailyFeeSpent
    });
  }

  /**
   * Get user's staking tier
   */
  private async getUserTier(walletAddress: string): Promise<StakingTier> {
    try {
      // For now, use in-memory tracking until DB model is added
      // In production, query VRTY stake from database
      
      // Determine tier based on stake amount
      // Tiers: EXPLORER >= 1, NAVIGATOR >= 1,000, CAPTAIN >= 10,000, ADMIRAL >= 50,000, COMMODORE >= 200,000
      // Default to EXPLORER for now (basic access)
      return StakingTierEnum.EXPLORER;

    } catch (error) {
      logger.warn('Failed to get staking tier, defaulting to NONE', { error, walletAddress });
      return StakingTierEnum.NONE;
    }
  }

  /**
   * Get or initialize user usage tracking
   */
  private async getUserUsage(walletAddress: string): Promise<UserUsage> {
    const todayStr = new Date().toISOString().split('T')[0] || '';
    const thisMonth = todayStr.substring(0, 7);

    // Check cache first
    let usage = this.userUsage.get(walletAddress);

    // Check if we need to reset counters
    if (usage) {
      if (usage.lastResetDay !== todayStr) {
        usage.dailyCount = 0;
        usage.dailyFeeSpent = 0;
        usage.lastResetDay = todayStr;
      }
      if (usage.lastResetMonth !== thisMonth) {
        usage.monthlyCount = 0;
        usage.lastResetMonth = thisMonth;
      }
      return usage;
    }

    // Initialize new usage tracking
    usage = {
      dailyCount: 0,
      monthlyCount: 0,
      dailyFeeSpent: 0,
      lastResetDay: todayStr,
      lastResetMonth: thisMonth
    };

    this.userUsage.set(walletAddress, usage);
    return usage;
  }

  /**
   * Get detailed quota information for a wallet
   */
  async getQuota(walletAddress: string): Promise<RelayerQuota> {
    const tier = await this.getUserTier(walletAddress);
    const limits = TIER_LIMITS[tier];
    const usage = await this.getUserUsage(walletAddress);

    return {
      userAddress: walletAddress,
      tier,
      dailyTransactions: usage.dailyCount,
      dailyLimit: limits.dailyTransactions,
      monthlyTransactions: usage.monthlyCount,
      monthlyLimit: limits.monthlyTransactions,
      dailyFeeSpent: usage.dailyFeeSpent / 1000000,  // Convert drops to XRP
      dailyFeeLimit: limits.dailyFeeLimit / 1000000,
      remainingDaily: Math.max(0, limits.dailyTransactions - usage.dailyCount),
      remainingMonthly: Math.max(0, limits.monthlyTransactions - usage.monthlyCount)
    };
  }

  /**
   * Get tier limits (for documentation/UI)
   */
  getTierLimits(): typeof TIER_LIMITS {
    return TIER_LIMITS;
  }

  /**
   * Reset daily limits (for testing or admin)
   */
  async resetDailyLimits(walletAddress?: string): Promise<void> {
    const todayStr = new Date().toISOString().split('T')[0] || '';
    
    if (walletAddress) {
      const usage = this.userUsage.get(walletAddress);
      if (usage) {
        usage.dailyCount = 0;
        usage.dailyFeeSpent = 0;
        usage.lastResetDay = todayStr;
      }
    } else {
      // Reset all users
      for (const [_, usage] of this.userUsage) {
        usage.dailyCount = 0;
        usage.dailyFeeSpent = 0;
        usage.lastResetDay = todayStr;
      }
    }

    logger.info('Daily limits reset', { walletAddress: walletAddress || 'all' });
  }

  /**
   * Get active user count
   */
  getActiveUserCount(): number {
    return this.userUsage.size;
  }

  /**
   * Get aggregate statistics
   */
  getStatistics(): {
    activeUsers: number;
    tierDistribution: Record<StakingTier, number>;
  } {
    const tierDistribution: Record<StakingTier, number> = {
      [StakingTierEnum.NONE]: 0,
      [StakingTierEnum.EXPLORER]: 0,
      [StakingTierEnum.NAVIGATOR]: 0,
      [StakingTierEnum.CAPTAIN]: 0,
      [StakingTierEnum.ADMIRAL]: 0,
      [StakingTierEnum.COMMODORE]: 0
    };

    // Note: This is a simplified version
    // Full implementation would query the database

    return {
      activeUsers: this.userUsage.size,
      tierDistribution
    };
  }
}

// Export singleton instance
export const rateLimiter = new RelayerRateLimiter();
