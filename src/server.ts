/**
 * Verity Protocol - API Server
 * The Verified Financial Operating System for XRP Ledger
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from 'dotenv';
import path from 'path';

import routes from './api/routes/index.js';
import {
  requestIdMiddleware,
  requestLoggerMiddleware,
  apiKeyAuthMiddleware,
  rateLimitMiddleware,
  errorHandlerMiddleware,
  notFoundMiddleware,
} from './api/middleware.js';
import { initializeXummAuth } from './api/middleware/xummAuth.js';
import { maintenanceModeMiddleware, isMaintenanceMode } from './api/middleware/maintenance.js';
import { connectDatabase, disconnectDatabase, checkDatabaseHealth } from './db/index.js';
import { logger } from './utils/logger.js';

// Load environment variables
config();

// Initialize database connection
async function initializeDatabase(): Promise<void> {
  const dbUrl = process.env['DATABASE_URL'];
  
  // Debug: Log sanitized URL info
  if (dbUrl) {
    const sanitized = dbUrl.replace(/:[^@]+@/, ':***@');
    logger.info('DATABASE_URL configured', { 
      length: dbUrl.length,
      preview: sanitized.substring(0, 50) + '...',
      hasSSL: dbUrl.includes('sslmode'),
      host: dbUrl.match(/@([^:\/]+)/)?.[1] || 'unknown'
    });
  }
  
  if (dbUrl) {
    try {
      await connectDatabase();
      const health = await checkDatabaseHealth();
      if (health.connected) {
        logger.info(`Database connected (latency: ${health.latency}ms)`);
      }
    } catch (error) {
      logger.warn('Database connection failed - running in memory-only mode', { 
        error,
        errorMessage: (error as Error).message,
        errorName: (error as Error).name
      });
    }
  } else {
    logger.warn('DATABASE_URL not configured - running in memory-only mode');
  }
}

// Initialize database
initializeDatabase();

// Initialize XUMM authentication if configured
if (process.env['XUMM_API_KEY'] && process.env['XUMM_API_SECRET']) {
  try {
    initializeXummAuth({
      apiKey: process.env['XUMM_API_KEY'],
      apiSecret: process.env['XUMM_API_SECRET'],
    });
    logger.info('XUMM authentication initialized');
  } catch (error) {
    logger.warn('Failed to initialize XUMM authentication', { error });
  }
} else {
  logger.warn('XUMM credentials not configured - using development auth mode (x-wallet-address header)');
}

// Create Express app
const app = express();

// Basic configuration - PORT env var is set by Railway
const PORT = parseInt(process.env['PORT'] || process.env['API_PORT'] || '3000', 10);
const HOST = process.env['API_HOST'] || '0.0.0.0';
const API_VERSION = process.env['API_VERSION'] || 'v1';

// Security middleware - relaxed for UI to work
app.use(helmet({
  contentSecurityPolicy: false, // Disabled for UI CDN resources
}));

// CORS configuration
// Note: credentials: true is incompatible with origin: '*' in browsers
// We use a dynamic origin function that:
// - Returns the requesting origin when credentials are needed (for specific domains)
// - Returns '*' for public API access without credentials
const ALLOWED_ORIGINS = process.env['CORS_ORIGIN']?.split(',').map(o => o.trim()) || [];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) {
      return callback(null, true);
    }
    // If specific origins are configured, check against allowlist
    if (ALLOWED_ORIGINS.length > 0 && ALLOWED_ORIGINS[0] !== '*') {
      if (ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, origin);
      }
      // Still allow the request but without credentials
      return callback(null, true);
    }
    // Default: allow all origins (no credentials)
    return callback(null, true);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID', 'X-Wallet-Address'],
  exposedHeaders: ['X-Request-ID'],
  // Only enable credentials when specific origins are configured
  credentials: ALLOWED_ORIGINS.length > 0 && ALLOWED_ORIGINS[0] !== '*',
}));
// Removed duplicate corsOptionsMiddleware - using single CORS strategy

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request tracking
app.use(requestIdMiddleware);
app.use(requestLoggerMiddleware);

// Serve public static files BEFORE maintenance mode (for XRPL metadata)
// These must be accessible even during maintenance for token logo/metadata
const publicPath = path.join(process.cwd(), 'public');
app.use('/.well-known', express.static(path.join(publicPath, '.well-known'), {
  setHeaders: (res, filePath) => {
    // Set correct content type for TOML files
    if (filePath.endsWith('.toml')) {
      res.setHeader('Content-Type', 'application/toml');
    }
    // Enable CORS for XRPL explorers
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
}));
app.use('/assets', express.static(path.join(publicPath, 'assets'), {
  setHeaders: (res) => {
    // Enable CORS for XRPL explorers
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
}));

// Maintenance mode - must be before other routes (but after static assets)
app.use(maintenanceModeMiddleware);

// API key authentication - MUST come before rate limiting
// so that tier-based rate limits work correctly
app.use(apiKeyAuthMiddleware);

// Rate limiting - uses tier from auth middleware
// If auth runs first, we get proper tier-based limits
// Otherwise everyone gets default EXPLORER tier
app.use(rateLimitMiddleware);

// Serve static UI files (frontend build)
const uiPath = path.join(process.cwd(), 'frontend', 'dist');
app.use('/ui', express.static(uiPath));

// Serve index.html for SPA routing (React Router)
app.get('/ui/*', (req, res) => {
  res.sendFile(path.join(uiPath, 'index.html'));
});

// Root endpoint - redirect to UI
app.get('/', (req, res) => {
  res.redirect('/ui');
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Verity Protocol',
    description: 'The Verified Financial Operating System for XRP Ledger',
    version: process.env['npm_package_version'] || '0.1.0',
    apiVersion: API_VERSION,
    documentation: `https://docs.verity.finance/api/${API_VERSION}`,
    ui: '/ui',
    endpoints: {
      api: `/api/${API_VERSION}`,
      health: `/api/${API_VERSION}/health`,
      docs: `/api/${API_VERSION}/docs`,
    },
    timestamp: new Date().toISOString(),
  });
});

// Mount API routes
app.use(`/api/${API_VERSION}`, routes);

// 404 handler
app.use(notFoundMiddleware);

// Error handler
app.use(errorHandlerMiddleware);

// Start server
const server = app.listen(PORT, HOST, () => {
  logger.info(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ██╗   ██╗███████╗██████╗ ██╗████████╗██╗   ██╗             ║
║   ██║   ██║██╔════╝██╔══██╗██║╚══██╔══╝╚██╗ ██╔╝             ║
║   ██║   ██║█████╗  ██████╔╝██║   ██║    ╚████╔╝              ║
║   ╚██╗ ██╔╝██╔══╝  ██╔══██╗██║   ██║     ╚██╔╝               ║
║    ╚████╔╝ ███████╗██║  ██║██║   ██║      ██║                ║
║     ╚═══╝  ╚══════╝╚═╝  ╚═╝╚═╝   ╚═╝      ╚═╝                ║
║                                                               ║
║   The Verified Financial Operating System for XRP Ledger      ║
║                                                               ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║   Server running on http://${HOST}:${PORT}                       ║
║   API Version: ${API_VERSION}                                          ║
║   Environment: ${process.env['NODE_ENV'] || 'development'}                           ║
║   Maintenance Mode: ${isMaintenanceMode() ? 'ENABLED' : 'disabled'}                              ║
║                                                               ║
║   Endpoints:                                                  ║
║   - API:     http://${HOST}:${PORT}/api/${API_VERSION}                   ║
║   - Health:  http://${HOST}:${PORT}/api/${API_VERSION}/health            ║
║   - Docs:    http://${HOST}:${PORT}/api/${API_VERSION}/docs              ║
║   - UI:      http://${HOST}:${PORT}/ui                              ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully...`);
  
  // Disconnect database
  await disconnectDatabase();
  
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;
