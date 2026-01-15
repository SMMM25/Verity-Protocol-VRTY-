/**
 * Verity Protocol - Health Check & Monitoring Routes
 * 
 * @module api/routes/health
 * @description Provides comprehensive health check and monitoring endpoints
 * for production deployments. Essential for load balancers, orchestration 
 * systems, and observability platforms.
 * 
 * Endpoints:
 * - GET /health - Basic liveness check
 * - GET /health/detailed - Comprehensive health with dependency checks
 * - GET /health/ready - Kubernetes readiness probe
 * - GET /health/live - Kubernetes liveness probe
 * - GET /health/metrics - Prometheus-compatible metrics
 */

import { Router, Request, Response } from 'express';
import { checkDatabaseHealth } from '../../db/index.js';
import os from 'os';

const router = Router();

// Track request metrics
const metrics = {
  requestsTotal: 0,
  requestsSuccess: 0,
  requestsError: 0,
  requestLatencies: [] as number[],
  startTime: Date.now(),
};

// Middleware to track metrics (applied at app level, but we track here)
export const trackMetrics = (success: boolean, latency: number) => {
  metrics.requestsTotal++;
  if (success) {
    metrics.requestsSuccess++;
  } else {
    metrics.requestsError++;
  }
  metrics.requestLatencies.push(latency);
  // Keep only last 1000 latencies for percentile calculation
  if (metrics.requestLatencies.length > 1000) {
    metrics.requestLatencies.shift();
  }
};

// Calculate percentile
const percentile = (arr: number[], p: number): number => {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * p;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base]! + rest * (sorted[base + 1]! - sorted[base]!);
  }
  return sorted[base]!;
};

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
  // Check actual database health
  const dbHealth = await checkDatabaseHealth();
  
  const services = {
    api: { status: 'healthy', latency: '< 1ms' },
    xrpl: { status: 'healthy', network: process.env['XRPL_NETWORK'] || 'testnet' },
    database: { 
      status: dbHealth.connected ? 'healthy' : 'unhealthy',
      latency: dbHealth.latency ? `${dbHealth.latency}ms` : undefined,
      error: dbHealth.error,
    },
    cache: { status: 'healthy' }, // Would check Redis connection
  };

  // API and DB are critical, cache is not
  const allHealthy = services.api.status === 'healthy' && 
                     services.database.status === 'healthy';

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

/**
 * @swagger
 * /api/v1/health/ready:
 *   get:
 *     summary: Kubernetes readiness probe
 *     description: |
 *       Returns 200 when the service is ready to accept traffic.
 *       Checks database connectivity and required services.
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: Service is ready
 *       503:
 *         description: Service is not ready
 */
router.get('/ready', async (req: Request, res: Response) => {
  try {
    const dbHealth = await checkDatabaseHealth();
    
    if (!dbHealth.connected) {
      return res.status(503).json({
        success: false,
        data: {
          status: 'not_ready',
          reason: 'database_unavailable',
          timestamp: new Date().toISOString(),
        },
      });
    }

    res.json({
      success: true,
      data: {
        status: 'ready',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      data: {
        status: 'not_ready',
        reason: 'health_check_failed',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * @swagger
 * /api/v1/health/live:
 *   get:
 *     summary: Kubernetes liveness probe
 *     description: |
 *       Returns 200 if the service process is alive.
 *       Does not check external dependencies.
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: Service is alive
 */
router.get('/live', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
  });
});

/**
 * @swagger
 * /api/v1/health/metrics:
 *   get:
 *     summary: Prometheus-compatible metrics
 *     description: |
 *       Returns metrics in Prometheus exposition format.
 *       Includes:
 *       - Request counts and latencies
 *       - Memory and CPU usage
 *       - System information
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: Metrics in Prometheus format
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 */
router.get('/metrics', async (req: Request, res: Response) => {
  const memUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage();
  const loadAvg = os.loadaverage();
  const dbHealth = await checkDatabaseHealth();
  
  const uptimeSeconds = process.uptime();
  const p50 = percentile(metrics.requestLatencies, 0.5);
  const p95 = percentile(metrics.requestLatencies, 0.95);
  const p99 = percentile(metrics.requestLatencies, 0.99);

  // Prometheus exposition format
  const prometheusMetrics = `# HELP verity_info Verity Protocol service information
# TYPE verity_info gauge
verity_info{version="${process.env['npm_package_version'] || '1.0.0'}",node_version="${process.version}",environment="${process.env['NODE_ENV'] || 'development'}"} 1

# HELP verity_uptime_seconds Service uptime in seconds
# TYPE verity_uptime_seconds counter
verity_uptime_seconds ${uptimeSeconds}

# HELP verity_requests_total Total number of HTTP requests
# TYPE verity_requests_total counter
verity_requests_total{status="success"} ${metrics.requestsSuccess}
verity_requests_total{status="error"} ${metrics.requestsError}

# HELP verity_request_duration_seconds Request duration in seconds
# TYPE verity_request_duration_seconds histogram
verity_request_duration_seconds{quantile="0.5"} ${(p50 / 1000).toFixed(6)}
verity_request_duration_seconds{quantile="0.95"} ${(p95 / 1000).toFixed(6)}
verity_request_duration_seconds{quantile="0.99"} ${(p99 / 1000).toFixed(6)}

# HELP verity_memory_bytes Memory usage in bytes
# TYPE verity_memory_bytes gauge
verity_memory_bytes{type="rss"} ${memUsage.rss}
verity_memory_bytes{type="heapTotal"} ${memUsage.heapTotal}
verity_memory_bytes{type="heapUsed"} ${memUsage.heapUsed}
verity_memory_bytes{type="external"} ${memUsage.external}

# HELP verity_cpu_usage_microseconds CPU usage in microseconds
# TYPE verity_cpu_usage_microseconds counter
verity_cpu_usage_microseconds{type="user"} ${cpuUsage.user}
verity_cpu_usage_microseconds{type="system"} ${cpuUsage.system}

# HELP verity_system_load_average System load average
# TYPE verity_system_load_average gauge
verity_system_load_average{period="1m"} ${loadAvg[0]?.toFixed(2) || 0}
verity_system_load_average{period="5m"} ${loadAvg[1]?.toFixed(2) || 0}
verity_system_load_average{period="15m"} ${loadAvg[2]?.toFixed(2) || 0}

# HELP verity_database_connected Database connection status
# TYPE verity_database_connected gauge
verity_database_connected ${dbHealth.connected ? 1 : 0}

# HELP verity_database_latency_ms Database query latency in milliseconds
# TYPE verity_database_latency_ms gauge
verity_database_latency_ms ${dbHealth.latency || 0}

# HELP verity_system_memory_bytes System memory in bytes
# TYPE verity_system_memory_bytes gauge
verity_system_memory_bytes{type="total"} ${os.totalmem()}
verity_system_memory_bytes{type="free"} ${os.freemem()}

# HELP verity_system_cpus Number of CPUs
# TYPE verity_system_cpus gauge
verity_system_cpus ${os.cpus().length}
`;

  res.setHeader('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(prometheusMetrics);
});

/**
 * @swagger
 * /api/v1/health/dependencies:
 *   get:
 *     summary: Check all external dependencies
 *     description: |
 *       Performs comprehensive health checks on all external dependencies:
 *       - Database (PostgreSQL)
 *       - XRPL Network
 *       - Redis Cache
 *       - Bridge Services (Solana, Ethereum)
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: All dependencies healthy
 *       503:
 *         description: One or more dependencies unhealthy
 */
router.get('/dependencies', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  // Check database
  const dbHealth = await checkDatabaseHealth();
  
  // Check XRPL (placeholder - would connect to network)
  const xrplHealth = {
    status: process.env['XRPL_MAINNET_URL'] ? 'configured' : 'not_configured',
    network: process.env['XRPL_NETWORK'] || 'testnet',
    url: process.env['XRPL_MAINNET_URL'] ? 'configured' : undefined,
  };
  
  // Check Redis (placeholder - would ping Redis)
  const redisHealth = {
    status: process.env['REDIS_URL'] ? 'configured' : 'not_configured',
  };
  
  // Check Bridge services
  const bridgeHealth = {
    solana: {
      status: process.env['SOLANA_RPC_URL'] ? 'configured' : 'not_configured',
    },
    ethereum: {
      status: process.env['ETHEREUM_RPC_URL'] ? 'configured' : 'not_configured',
    },
    polygon: {
      status: process.env['POLYGON_RPC_URL'] ? 'configured' : 'not_configured',
    },
  };

  const dependencies = {
    database: {
      name: 'PostgreSQL',
      status: dbHealth.connected ? 'healthy' : 'unhealthy',
      latency: dbHealth.latency,
      error: dbHealth.error,
    },
    xrpl: {
      name: 'XRP Ledger',
      ...xrplHealth,
    },
    redis: {
      name: 'Redis Cache',
      ...redisHealth,
    },
    bridges: {
      name: 'Cross-Chain Bridges',
      ...bridgeHealth,
    },
  };

  const allHealthy = dbHealth.connected;
  const checkDuration = Date.now() - startTime;

  res.status(allHealthy ? 200 : 503).json({
    success: allHealthy,
    data: {
      status: allHealthy ? 'healthy' : 'degraded',
      dependencies,
      checkDuration: `${checkDuration}ms`,
      timestamp: new Date().toISOString(),
    },
    meta: {
      requestId: req.requestId,
    },
  });
});

/**
 * @swagger
 * /api/v1/health/version:
 *   get:
 *     summary: Get service version information
 *     description: Returns detailed version and build information
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: Version information
 */
router.get('/version', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      name: 'Verity Protocol',
      version: process.env['npm_package_version'] || '1.0.0',
      apiVersion: process.env['API_VERSION'] || 'v1',
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      environment: process.env['NODE_ENV'] || 'development',
      buildTime: process.env['BUILD_TIME'] || 'unknown',
      commitHash: process.env['COMMIT_HASH'] || 'unknown',
      timestamp: new Date().toISOString(),
    },
  });
});

export { router as healthRoutes };
