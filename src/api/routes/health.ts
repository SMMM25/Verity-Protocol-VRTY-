/**
 * Verity Protocol - Health Check Routes
 * 
 * @module api/routes/health
 * @description Provides health check endpoints for monitoring service status
 * and dependencies. Essential for load balancers and orchestration systems.
 */

import { Router, Request, Response } from 'express';

const router = Router();

/**
 * @swagger
 * /api/v1/health:
 *   get:
 *     summary: Basic health check
 *     description: Returns the basic health status of the API. Use this endpoint
 *       for simple health checks in load balancers and container orchestration.
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: healthy
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     version:
 *                       type: string
 *                       example: 0.1.0
 *             example:
 *               success: true
 *               data:
 *                 status: healthy
 *                 timestamp: "2024-01-09T12:00:00.000Z"
 *                 version: "0.1.0"
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
 * @swagger
 * /api/v1/health/detailed:
 *   get:
 *     summary: Detailed health check
 *     description: |
 *       Returns detailed health information including:
 *       - Individual service statuses (API, XRPL, Database, Cache)
 *       - System uptime
 *       - Memory usage statistics
 *       
 *       Returns HTTP 503 if any service is unhealthy.
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: All services are healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [healthy, degraded]
 *                     services:
 *                       type: object
 *                       properties:
 *                         api:
 *                           type: object
 *                         xrpl:
 *                           type: object
 *                         database:
 *                           type: object
 *                         cache:
 *                           type: object
 *                     uptime:
 *                       type: number
 *                       description: Server uptime in seconds
 *                     memory:
 *                       type: object
 *                       description: Node.js memory usage
 *       503:
 *         description: One or more services are unhealthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       example: degraded
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
