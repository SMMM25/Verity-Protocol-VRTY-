/**
 * Verity Protocol - API Routes Index
 * Combines all route modules
 */

import { Router } from 'express';
import { healthRoutes } from './health.js';
import { authRoutes } from './auth.js';
import { xrplRoutes } from './xrpl.js';
import { assetsRoutes } from './assets.js';
import { signalsRoutes } from './signals.js';
import { guildsRoutes } from './guilds.js';
import { tokenRoutes } from './token.js';
import { taxRoutes } from './tax.js';
import { governanceRoutes } from './governance.js';
import { transparencyRoutes } from './transparency.js';
import { complianceRoutes } from './compliance.js';
import { vrtyRoutes } from './vrty.js';
import { bridgeRoutes } from './bridge.js';
import { openAPIRoutes } from '../openapi.js';

const router = Router();

// Mount all routes
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/xrpl', xrplRoutes);
router.use('/assets', assetsRoutes);
router.use('/signals', signalsRoutes);
router.use('/guilds', guildsRoutes);
router.use('/token', tokenRoutes);
router.use('/tax', taxRoutes);
router.use('/governance', governanceRoutes);
router.use('/transparency', transparencyRoutes);
router.use('/compliance', complianceRoutes);
router.use('/vrty', vrtyRoutes);
router.use('/bridge', bridgeRoutes);

// OpenAPI/Swagger documentation
router.use('/', openAPIRoutes);

// API documentation endpoint
router.get('/docs', (req, res) => {
  res.json({
    name: 'Verity Protocol API',
    version: 'v1',
    description: 'The Verified Financial Operating System for XRP Ledger',
    endpoints: {
      health: '/api/v1/health',
      auth: '/api/v1/auth',
      xrpl: '/api/v1/xrpl',
      assets: '/api/v1/assets',
      signals: '/api/v1/signals',
      guilds: '/api/v1/guilds',
      token: '/api/v1/token',
      tax: '/api/v1/tax',
      governance: '/api/v1/governance',
      compliance: '/api/v1/compliance',
      vrty: '/api/v1/vrty',
      bridge: '/api/v1/bridge',
      openapi: '/api/v1/openapi.json',
      swagger: '/api/v1/swagger',
    },
    transparency: '/api/v1/transparency',
    documentation: 'https://docs.verity.finance/api',
  });
});

export default router;
