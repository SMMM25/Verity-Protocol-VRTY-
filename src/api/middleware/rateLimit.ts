/**
 * Verity Protocol - Rate Limiting Middleware
 * Implements tiered rate limiting based on API key
 */

import { Request, Response, NextFunction } from 'express';
import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';
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

// Mock function to get user tier from API key
// In production, this would query the database/VRTY staking contract
function getUserTier(apiKey: string | undefined): keyof typeof RATE_LIMITS {
  if (!apiKey) return 'PUBLIC';
  
  // Simple mock implementation
  // In production, validate API key and check VRTY staking tier
  if (apiKey.startsWith('inst_')) return 'INSTITUTIONAL';
  if (apiKey.startsWith('pro_')) return 'PROFESSIONAL';
  if (apiKey.startsWith('dev_')) return 'DEVELOPER';
  if (apiKey.startsWith('basic_')) return 'BASIC';
  
  // Default to BASIC for any valid API key
  return apiKey ? 'BASIC' : 'PUBLIC';
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
  const tier = getUserTier(apiKey);
  const limiter = rateLimiters[tier];
  
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
