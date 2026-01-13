/**
 * Verity Protocol - Rate Limiting Middleware
 * Implements tiered rate limiting based on API key and VRTY staking tier
 */

import { Request, Response, NextFunction } from 'express';
import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';
import { stakeRepository } from '../../db/index.js';
import { logger } from '../../utils/logger.js';

// Rate limit configurations per tier
const RATE_LIMITS = {
  // Anonymous/public endpoints
  PUBLIC: {
    points: 30, // requests
    duration: 60, // per 60 seconds
    blockDuration: 60, // block for 60 seconds if exceeded
  },
  // Basic tier (1000+ VRTY staked)
  BASIC: {
    points: 100,
    duration: 60,
    blockDuration: 30,
  },
  // Professional tier (10000+ VRTY staked)
  PROFESSIONAL: {
    points: 1000,
    duration: 60,
    blockDuration: 15,
  },
  // Institutional tier (50000+ VRTY staked)
  INSTITUTIONAL: {
    points: 10000,
    duration: 60,
    blockDuration: 10,
  },
  // Developer tier (5000+ VRTY staked)
  DEVELOPER: {
    points: 2000,
    duration: 60,
    blockDuration: 10,
  },
};

// Create rate limiters for each tier
const rateLimiters: Record<string, RateLimiterMemory> = {};

for (const [tier, config] of Object.entries(RATE_LIMITS)) {
  rateLimiters[tier] = new RateLimiterMemory({
    keyPrefix: `verity_${tier.toLowerCase()}`,
    points: config.points,
    duration: config.duration,
    blockDuration: config.blockDuration,
  });
}

// Tier cache to avoid hitting DB on every request
const tierCache = new Map<string, { tier: keyof typeof RATE_LIMITS; expiresAt: number }>();
const CACHE_TTL_MS = 60000; // 1 minute cache

/**
 * Get user tier from database based on wallet address or API key
 * Uses caching to minimize database queries
 */
async function getUserTier(
  wallet: string | undefined,
  apiKey: string | undefined
): Promise<keyof typeof RATE_LIMITS> {
  // No wallet or API key = public tier
  if (!wallet && !apiKey) return 'PUBLIC';
  
  const cacheKey = wallet || apiKey || '';
  
  // Check cache first
  const cached = tierCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.tier;
  }
  
  let tier: keyof typeof RATE_LIMITS = 'PUBLIC';
  
  try {
    if (wallet) {
      // Query database for staking tier
      const stakingTier = await stakeRepository.getUserTier(wallet);
      
      // Map StakingTier enum to rate limit tier
      switch (stakingTier) {
        case 'INSTITUTIONAL':
          tier = 'INSTITUTIONAL';
          break;
        case 'PROFESSIONAL':
          tier = 'PROFESSIONAL';
          break;
        case 'DEVELOPER':
          tier = 'DEVELOPER';
          break;
        case 'BASIC':
          tier = 'BASIC';
          break;
        default:
          tier = 'PUBLIC';
      }
    } else if (apiKey) {
      // Fallback: API key prefix check (for backwards compatibility)
      if (apiKey.startsWith('inst_')) tier = 'INSTITUTIONAL';
      else if (apiKey.startsWith('pro_')) tier = 'PROFESSIONAL';
      else if (apiKey.startsWith('dev_')) tier = 'DEVELOPER';
      else if (apiKey.startsWith('basic_')) tier = 'BASIC';
      else tier = 'BASIC'; // Valid API key gets at least BASIC
    }
  } catch (error) {
    // Database error - default to PUBLIC but don't cache
    logger.warn('Failed to get user tier from database', { wallet, error });
    return 'PUBLIC';
  }
  
  // Cache the result
  tierCache.set(cacheKey, {
    tier,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  
  return tier;
}

/**
 * Clear tier cache for a specific wallet (call after staking changes)
 */
export function clearTierCache(wallet: string): void {
  tierCache.delete(wallet);
}

/**
 * Rate limiting middleware
 */
export async function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const apiKey = req.headers['x-api-key'] as string | undefined;
  const wallet = req.headers['x-wallet-address'] as string | undefined;
  
  // Get tier from database (with caching)
  const tier = await getUserTier(wallet, apiKey);
  const limiter = rateLimiters[tier];
  
  if (!limiter) {
    // Fallback to PUBLIC if limiter not found
    next();
    return;
  }
  
  // Use API key or IP as the rate limit key
  const key = apiKey || req.ip || 'anonymous';
  
  try {
    const rateLimitRes = await limiter.consume(key);
    
    // Add rate limit headers
    res.set({
      'X-RateLimit-Tier': tier,
      'X-RateLimit-Limit': RATE_LIMITS[tier].points.toString(),
      'X-RateLimit-Remaining': rateLimitRes.remainingPoints.toString(),
      'X-RateLimit-Reset': new Date(Date.now() + rateLimitRes.msBeforeNext).toISOString(),
    });
    
    next();
  } catch (error) {
    if (error instanceof Error) {
      // Not a rate limit error
      next(error);
      return;
    }
    
    // Rate limit exceeded
    const rateLimitRes = error as RateLimiterRes;
    const retryAfter = Math.ceil(rateLimitRes.msBeforeNext / 1000);
    
    logger.warn('Rate limit exceeded', {
      key,
      tier,
      retryAfter,
      requestId: req.requestId,
    });
    
    res.set({
      'X-RateLimit-Tier': tier,
      'X-RateLimit-Limit': RATE_LIMITS[tier].points.toString(),
      'X-RateLimit-Remaining': '0',
      'X-RateLimit-Reset': new Date(Date.now() + rateLimitRes.msBeforeNext).toISOString(),
      'Retry-After': retryAfter.toString(),
    });
    
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: `Too many requests. Please retry after ${retryAfter} seconds.`,
        details: {
          tier,
          limit: RATE_LIMITS[tier].points,
          duration: RATE_LIMITS[tier].duration,
          retryAfter,
        },
      },
      meta: {
        requestId: req.requestId,
        timestamp: new Date(),
      },
    });
  }
}

/**
 * Strict rate limiter for sensitive endpoints
 */
export function strictRateLimitMiddleware(maxRequests: number, windowSeconds: number) {
  const strictLimiter = new RateLimiterMemory({
    keyPrefix: 'verity_strict',
    points: maxRequests,
    duration: windowSeconds,
    blockDuration: windowSeconds * 2,
  });

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const key = (req.headers['x-api-key'] as string) || req.ip || 'anonymous';
    
    try {
      await strictLimiter.consume(key);
      next();
    } catch (error) {
      if (error instanceof Error) {
        next(error);
        return;
      }
      
      const rateLimitRes = error as RateLimiterRes;
      const retryAfter = Math.ceil(rateLimitRes.msBeforeNext / 1000);
      
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Rate limit exceeded for this sensitive endpoint',
          details: { retryAfter },
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date(),
        },
      });
    }
  };
}

export { RATE_LIMITS };
