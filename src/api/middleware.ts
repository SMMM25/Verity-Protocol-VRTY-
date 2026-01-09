/**
 * Verity Protocol - API Middleware
 * Authentication, rate limiting, and request validation
 */

import { Request, Response, NextFunction } from 'express';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';

// Rate limiter configuration
const rateLimiter = new RateLimiterMemory({
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
 */
export function apiKeyAuthMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const apiKey = req.get('X-API-Key') || req.query['api_key'] as string;

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

  // In production, validate against database
  // For now, just set the API key on the request
  req.apiKey = apiKey;
  req.userId = extractUserIdFromApiKey(apiKey);

  next();
}

/**
 * Rate limiting middleware
 */
export async function rateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const key = req.apiKey || req.ip || 'anonymous';
    await rateLimiter.consume(key);
    next();
  } catch {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please try again later.',
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
  ];
  // Allow all UI paths and static assets
  if (path.startsWith('/ui') || path.endsWith('.js') || path.endsWith('.css') || 
      path.endsWith('.html') || path.endsWith('.png') || path.endsWith('.ico') ||
      path.endsWith('.svg') || path.endsWith('.json')) {
    return true;
  }
  return publicPaths.some((p) => path === p || path.startsWith(p + '/'));
}

function extractUserIdFromApiKey(apiKey: string): string {
  // In production, this would look up the user from the database
  // For now, just return a placeholder
  return `user_${apiKey.substring(0, 8)}`;
}
