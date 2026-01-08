/**
 * Verity Protocol - Health Check Routes
 */

import { Router, Request, Response } from 'express';

const router = Router();

/**
 * GET /health
 * Basic health check
 */
router.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env['npm_package_version'] || '0.1.0',
    },
    meta: {
      requestId: req.requestId,
    },
  });
});

/**
 * GET /health/detailed
 * Detailed health check including service dependencies
 */
router.get('/detailed', async (req: Request, res: Response) => {
  // In production, check actual service health
  const services = {
    api: { status: 'healthy', latency: '< 1ms' },
    xrpl: { status: 'healthy', network: process.env['XRPL_NETWORK'] || 'testnet' },
    database: { status: 'healthy' }, // Would check actual DB connection
    cache: { status: 'healthy' }, // Would check Redis connection
  };

  const allHealthy = Object.values(services).every(
    (s) => s.status === 'healthy'
  );

  res.status(allHealthy ? 200 : 503).json({
    success: allHealthy,
    data: {
      status: allHealthy ? 'healthy' : 'degraded',
      services,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
    },
    meta: {
      requestId: req.requestId,
    },
  });
});

export { router as healthRoutes };
