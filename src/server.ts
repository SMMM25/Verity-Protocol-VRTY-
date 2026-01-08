/**
 * Verity Protocol - API Server
 * The Verified Financial Operating System for XRP Ledger
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { config } from 'dotenv';

import routes from './api/routes/index.js';
import {
  requestIdMiddleware,
  requestLoggerMiddleware,
  apiKeyAuthMiddleware,
  rateLimitMiddleware,
  errorHandlerMiddleware,
  notFoundMiddleware,
  corsOptionsMiddleware,
} from './api/middleware.js';
import { logger } from './utils/logger.js';

// Load environment variables
config();

// Create Express app
const app = express();

// Basic configuration
const PORT = parseInt(process.env['API_PORT'] || '3000', 10);
const HOST = process.env['API_HOST'] || '0.0.0.0';
const API_VERSION = process.env['API_VERSION'] || 'v1';

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: process.env['CORS_ORIGIN'] || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-ID'],
  exposedHeaders: ['X-Request-ID'],
  credentials: true,
}));
app.use(corsOptionsMiddleware);

// Compression
app.use(compression());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request tracking
app.use(requestIdMiddleware);
app.use(requestLoggerMiddleware);

// Rate limiting
app.use(rateLimitMiddleware);

// API key authentication
app.use(apiKeyAuthMiddleware);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Verity Protocol',
    description: 'The Verified Financial Operating System for XRP Ledger',
    version: process.env['npm_package_version'] || '0.1.0',
    apiVersion: API_VERSION,
    documentation: `https://docs.verity.finance/api/${API_VERSION}`,
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
║                                                               ║
║   Endpoints:                                                  ║
║   - API:     http://${HOST}:${PORT}/api/${API_VERSION}                   ║
║   - Health:  http://${HOST}:${PORT}/api/${API_VERSION}/health            ║
║   - Docs:    http://${HOST}:${PORT}/api/${API_VERSION}/docs              ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully...`);
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
