/**
 * Verity Protocol - API Middleware
 * Authentication, rate limiting, and request validation
 */

import { Request, Response, NextFunction } from 'express';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import { validateApiKey, getTierRateLimit, TIER_RATE_LIMITS } from '../services/apikey.service.js';

// Tier-based rate limiters
const rateLimiters: Record<string, RateLimiterMemory> = {};

// Initialize rate limiters for each tier
for (const [tier, config] of Object.entries(TIER_RATE_LIMITS)) {
  rateLimiters[tier] = new RateLimiterMemory({
    points: config.points,
    duration: config.duration,
  });
}

// Default rate limiter for unauthenticated requests
const defaultRateLimiter = new RateLimiterMemory({
  points: parseInt(process.env['RATE_LIMIT_MAX_REQUESTS'] || '100'),
  duration: parseInt(process.env['RATE_LIMIT_WINDOW_MS'] || '60000') / 1000,
});

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      requestId: string;
      startTime: number;
      apiKey?: string;
      userId?: string;
    }
  }
}

/**
 * Request ID middleware
 */
export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  req.requestId = uuidv4();
  req.startTime = Date.now();
  res.setHeader('X-Request-ID', req.requestId);
  next();
}

/**
 * Request logging middleware
 */
export function requestLoggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const { method, url, requestId } = req;

  logger.http(`${method} ${url}`, {
    requestId,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
  });

  // Log response on finish
  res.on('finish', () => {
    const duration = Date.now() - req.startTime;
    logger.http(`${method} ${url} ${res.statusCode}`, {
      requestId,
      duration: `${duration}ms`,
      statusCode: res.statusCode,
    });
  });

  next();
}

/**
 * API Key authentication middleware
 * Validates API keys against the database with bcrypt
 */
export async function apiKeyAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // SECURITY: Only accept API key from header, not query string
  // Query string API keys leak via:
  // - Server logs
  // - Browser history
  // - Referer headers
  // - CDN/proxy caches
  // Development mode can still use query string for testing convenience
  const apiKey = req.get('X-API-Key') || 
    (process.env['NODE_ENV'] === 'development' ? req.query['api_key'] as string : undefined);

  if (!apiKey) {
    // Allow unauthenticated access to public endpoints
    if (isPublicEndpoint(req.path)) {
      return next();
    }

    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'API key required',
      },
    });
    return;
  }

  try {
    // Validate API key against database
    const validation = await validateApiKey(apiKey);

    if (!validation.valid) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_API_KEY',
          message: validation.error || 'Invalid or expired API key',
        },
      });
      return;
    }

    // Set validated user info on request
    req.apiKey = apiKey;
    req.userId = validation.userId;
    (req as any).userTier = validation.tier;
    (req as any).rateLimit = validation.rateLimit;

    next();
  } catch (error: any) {
    logger.error('API key validation error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_ERROR',
        message: 'Authentication service error',
      },
    });
  }
}

/**
 * Rate limiting middleware
 * Uses tier-based rate limits from database validation
 */
export async function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const key = req.apiKey || req.ip || 'anonymous';
    const userTier = (req as any).userTier || 'EXPLORER';
    
    // Use tier-specific rate limiter
    const limiter = rateLimiters[userTier] || defaultRateLimiter;
    
    const rateLimitRes = await limiter.consume(key);
    
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', limiter.points?.toString() || '100');
    res.setHeader('X-RateLimit-Remaining', rateLimitRes.remainingPoints.toString());
    res.setHeader('X-RateLimit-Reset', new Date(Date.now() + rateLimitRes.msBeforeNext).toISOString());
    
    next();
  } catch (rateLimitRes: any) {
    const retryAfter = Math.ceil(rateLimitRes.msBeforeNext / 1000);
    
    res.setHeader('Retry-After', retryAfter.toString());
    res.setHeader('X-RateLimit-Remaining', '0');
    
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
        retryAfter,
      },
    });
  }
}

/**
 * Error handling middleware
 */
export function errorHandlerMiddleware(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error(`Error handling request: ${err.message}`, {
    requestId: req.requestId,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An internal error occurred',
    },
    meta: {
      requestId: req.requestId,
    },
  });
}

/**
 * Not found middleware
 */
export function notFoundMiddleware(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Endpoint ${req.method} ${req.path} not found`,
    },
    meta: {
      requestId: req.requestId,
    },
  });
}

/**
 * CORS configuration middleware
 */
export function corsOptionsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, X-API-Key, Authorization'
  );
  res.header('Access-Control-Expose-Headers', 'X-Request-ID');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }

  next();
}

// Helper functions
function isPublicEndpoint(path: string): boolean {
  const publicPaths = [
    '/',
    '/ui',
    '/api',
    '/api/v1/health',
    '/api/v1/status',
    '/api/v1/docs',
    '/api/v1/xrpl/info',
    '/api/v1/token/info',
    '/api/v1/token/tiers',
    '/api/v1/token/fees',
    '/api/v1/tax/jurisdictions',
    '/api/v1/tax/methodology',
    '/api/v1/governance/proposals',
    '/api/v1/governance/stats',
    '/api/v1/signals/algorithm',
    '/api/v1/guilds',
    '/api/v1/transparency',
    '/api/v1/assets',
    '/api/v1/vrty/info',
    '/api/v1/vrty/staking-tiers',
    '/api/v1/vrty/health',
    '/api/v1/bridge/supported-chains',
    '/api/v1/bridge/health',
  ];
  // Allow all UI paths and static assets
  if (path.startsWith('/ui') || path.endsWith('.js') || path.endsWith('.css') || 
      path.endsWith('.html') || path.endsWith('.png') || path.endsWith('.ico') ||
      path.endsWith('.svg') || path.endsWith('.json')) {
    return true;
  }
  return publicPaths.some((p) => path === p || path.startsWith(p + '/'));
}
