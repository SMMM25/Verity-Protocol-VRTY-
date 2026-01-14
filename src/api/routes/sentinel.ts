/**
 * AI Sentinel v1 - API Routes
 * Guardian dashboard and alert management endpoints
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getSentinelService } from '../../sentinel/SentinelService.js';
import {
  AlertFilter,
  AlertAction,
  AlertStatus,
  AlertSeverity,
  Guardian,
  AnalyzedTransaction,
} from '../../sentinel/types.js';
import { logger } from '../../utils/logger.js';

const router = Router();
const sentinel = getSentinelService();

// ============================================================
// Validation Schemas
// ============================================================

const alertFilterSchema = z.object({
  status: z.array(z.enum(['PENDING', 'REVIEWING', 'RESOLVED', 'DISMISSED', 'ESCALATED'])).optional(),
  severity: z.array(z.enum(['INFO', 'WARNING', 'CRITICAL'])).optional(),
  ruleType: z.array(z.string()).optional(),
  wallet: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional(),
});

const alertActionSchema = z.object({
  action: z.enum(['DISMISS', 'FLAG', 'FREEZE', 'ESCALATE', 'CLAWBACK_PROPOSAL']),
  guardianWallet: z.string().min(1),
  reason: z.string().min(10).max(1000),
  metadata: z.record(z.unknown()).optional(),
});

const guardianSchema = z.object({
  wallet: z.string().min(1),
  name: z.string().min(1).max(100),
  role: z.enum(['GUARDIAN', 'ADMIN', 'SUPER_ADMIN']),
});

const transactionSchema = z.object({
  hash: z.string().min(1),
  from: z.string().min(1),
  to: z.string().min(1),
  amount: z.string().min(1),
  asset: z.string().min(1),
  timestamp: z.string().datetime(),
  direction: z.enum(['IN', 'OUT']),
  network: z.enum(['XRPL', 'SOLANA', 'ETHEREUM']),
  metadata: z.record(z.unknown()).optional(),
});

// ============================================================
// Alert Endpoints
// ============================================================

/**
 * GET /api/v1/sentinel/alerts
 * List alerts with filtering
 */
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const statusParam = req.query['status'] as string | undefined;
    const severityParam = req.query['severity'] as string | undefined;
    const ruleTypeParam = req.query['ruleType'] as string | undefined;
    const walletParam = req.query['wallet'] as string | undefined;
    const dateFromParam = req.query['dateFrom'] as string | undefined;
    const dateToParam = req.query['dateTo'] as string | undefined;
    const limitParam = req.query['limit'] as string | undefined;
    const offsetParam = req.query['offset'] as string | undefined;

    const filter: AlertFilter = {
      status: statusParam ? statusParam.split(',') as AlertStatus[] : undefined,
      severity: severityParam ? severityParam.split(',') as AlertSeverity[] : undefined,
      ruleType: ruleTypeParam ? ruleTypeParam.split(',') as any[] : undefined,
      wallet: walletParam,
      dateFrom: dateFromParam ? new Date(dateFromParam) : undefined,
      dateTo: dateToParam ? new Date(dateToParam) : undefined,
      limit: limitParam ? parseInt(limitParam) : undefined,
      offset: offsetParam ? parseInt(offsetParam) : undefined,
    };

    const alerts = await sentinel.getAlerts(filter);

    res.json({
      success: true,
      data: {
        alerts,
        count: alerts.length,
        filter,
      },
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to get alerts', { error });
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid filter parameters',
          details: error.errors,
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve alerts',
      },
    });
  }
});

/**
 * GET /api/v1/sentinel/alerts/:id
 * Get single alert by ID
 */
router.get('/alerts/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string;
    const alert = await sentinel.getAlert(id);

    if (!alert) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ALERT_NOT_FOUND',
          message: `Alert not found: ${id}`,
        },
      });
    }

    res.json({
      success: true,
      data: alert,
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to get alert', { error, alertId: req.params['id'] });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve alert',
      },
    });
  }
});

/**
 * POST /api/v1/sentinel/alerts/:id/review
 * Start review of an alert
 */
router.post('/alerts/:id/review', async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string;
    const guardianWallet = (req.body['guardianWallet'] || req.headers['x-wallet-address']) as string;

    if (!guardianWallet) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_GUARDIAN',
          message: 'Guardian wallet is required',
        },
      });
    }

    const alert = await sentinel.startReview(id, guardianWallet);

    res.json({
      success: true,
      data: alert,
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    logger.error('Failed to start review', { error, alertId: req.params['id'] });
    res.status(400).json({
      success: false,
      error: {
        code: 'REVIEW_FAILED',
        message: error.message || 'Failed to start review',
      },
    });
  }
});

/**
 * POST /api/v1/sentinel/alerts/:id/action
 * Take action on an alert
 */
router.post('/alerts/:id/action', async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string;
    const body = alertActionSchema.parse(req.body);

    const result = await sentinel.processAction({
      alertId: id,
      action: body['action'] as AlertAction,
      guardianWallet: body['guardianWallet'],
      reason: body['reason'],
      metadata: body['metadata'],
    });

    res.json({
      success: true,
      data: result,
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    logger.error('Failed to process action', { error, alertId: req.params['id'] });

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid action parameters',
          details: error.errors,
        },
      });
    }

    res.status(400).json({
      success: false,
      error: {
        code: 'ACTION_FAILED',
        message: error.message || 'Failed to process action',
      },
    });
  }
});

// ============================================================
// Guardian Endpoints
// ============================================================

/**
 * GET /api/v1/sentinel/guardians
 * List all guardians
 */
router.get('/guardians', async (req: Request, res: Response) => {
  try {
    const guardians = await sentinel.listGuardians();

    res.json({
      success: true,
      data: {
        guardians,
        count: guardians.length,
      },
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to list guardians', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to list guardians',
      },
    });
  }
});

/**
 * POST /api/v1/sentinel/guardians
 * Register a new guardian
 */
router.post('/guardians', async (req: Request, res: Response) => {
  try {
    const body = guardianSchema.parse(req.body);

    // Set permissions based on role
    const permissions = {
      GUARDIAN: {
        canDismiss: true,
        canFlag: true,
        canFreeze: false,
        canEscalate: true,
        canInitiateClawback: false,
      },
      ADMIN: {
        canDismiss: true,
        canFlag: true,
        canFreeze: true,
        canEscalate: true,
        canInitiateClawback: false,
      },
      SUPER_ADMIN: {
        canDismiss: true,
        canFlag: true,
        canFreeze: true,
        canEscalate: true,
        canInitiateClawback: true,
      },
    };

    const guardian: Guardian = {
      id: '',
      wallet: body.wallet,
      name: body.name,
      role: body.role,
      ...permissions[body.role],
      alertsReviewed: 0,
      lastActive: new Date(),
    };

    const registered = await sentinel.registerGuardian(guardian);

    res.status(201).json({
      success: true,
      data: registered,
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to register guardian', { error });

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid guardian data',
          details: error.errors,
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to register guardian',
      },
    });
  }
});

/**
 * GET /api/v1/sentinel/guardians/:wallet
 * Get guardian by wallet
 */
router.get('/guardians/:wallet', async (req: Request, res: Response) => {
  try {
    const wallet = req.params['wallet'] as string;
    const guardian = await sentinel.getGuardian(wallet);

    if (!guardian) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'GUARDIAN_NOT_FOUND',
          message: `Guardian not found: ${wallet}`,
        },
      });
    }

    res.json({
      success: true,
      data: guardian,
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to get guardian', { error, wallet: req.params['wallet'] });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve guardian',
      },
    });
  }
});

// ============================================================
// Statistics & Status Endpoints
// ============================================================

/**
 * GET /api/v1/sentinel/stats
 * Get Sentinel statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const periodParam = req.query['period'] as string | undefined;
    const periodDays = periodParam ? parseInt(periodParam) : 30;
    const stats = await sentinel.getStats(periodDays);

    res.json({
      success: true,
      data: stats,
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to get stats', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve statistics',
      },
    });
  }
});

/**
 * GET /api/v1/sentinel/status
 * Get Sentinel service status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = sentinel.getStatus();

    res.json({
      success: true,
      data: {
        isRunning: status.isRunning,
        queueSize: status.queueSize,
        rulesEnabled: status.config.rules.filter(r => r.enabled).length,
        totalRules: status.config.rules.length,
      },
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to get status', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve status',
      },
    });
  }
});

/**
 * GET /api/v1/sentinel/rules
 * Get active rules
 */
router.get('/rules', async (req: Request, res: Response) => {
  try {
    const rules = sentinel.getRules();

    res.json({
      success: true,
      data: {
        rules,
        count: rules.length,
        enabled: rules.filter(r => r.enabled).length,
      },
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to get rules', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve rules',
      },
    });
  }
});

/**
 * PATCH /api/v1/sentinel/rules/:id
 * Enable/disable a rule
 */
router.patch('/rules/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params['id'] as string;
    const enabled = req.body['enabled'];

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'enabled must be a boolean',
        },
      });
    }

    const success = sentinel.setRuleEnabled(id, enabled);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'RULE_NOT_FOUND',
          message: `Rule not found: ${id}`,
        },
      });
    }

    res.json({
      success: true,
      data: {
        ruleId: id,
        enabled,
      },
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to update rule', { error, ruleId: req.params['id'] });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to update rule',
      },
    });
  }
});

// ============================================================
// Wallet Risk Endpoints
// ============================================================

/**
 * GET /api/v1/sentinel/wallets/:address/risk
 * Get wallet risk profile
 */
router.get('/wallets/:address/risk', async (req: Request, res: Response) => {
  try {
    const address = req.params['address'] as string;
    const profile = await sentinel.getWalletRiskProfile(address);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'WALLET_NOT_FOUND',
          message: `No risk profile found for wallet: ${address}`,
        },
      });
    }

    res.json({
      success: true,
      data: profile,
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to get wallet risk profile', { error, address: req.params['address'] });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve wallet risk profile',
      },
    });
  }
});

// ============================================================
// Transaction Analysis Endpoint
// ============================================================

/**
 * POST /api/v1/sentinel/analyze
 * Submit transaction for analysis
 */
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const body = transactionSchema.parse(req.body);

    const transaction: AnalyzedTransaction = {
      ...body,
      timestamp: new Date(body.timestamp),
    };

    await sentinel.analyzeTransaction(transaction);

    res.status(202).json({
      success: true,
      data: {
        message: 'Transaction queued for analysis',
        transactionHash: transaction.hash,
      },
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to analyze transaction', { error });

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid transaction data',
          details: error.errors,
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to analyze transaction',
      },
    });
  }
});

/**
 * POST /api/v1/sentinel/analyze/batch
 * Submit multiple transactions for analysis
 */
router.post('/analyze/batch', async (req: Request, res: Response) => {
  try {
    const { transactions } = req.body;

    if (!Array.isArray(transactions)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'transactions must be an array',
        },
      });
    }

    const parsed: AnalyzedTransaction[] = transactions.map(tx => ({
      ...transactionSchema.parse(tx),
      timestamp: new Date(tx.timestamp),
    }));

    await sentinel.analyzeTransactions(parsed);

    res.status(202).json({
      success: true,
      data: {
        message: 'Transactions queued for analysis',
        count: parsed.length,
      },
      meta: {
        requestId: req.headers['x-request-id'],
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Failed to analyze transactions', { error });

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid transaction data',
          details: error.errors,
        },
      });
    }

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to analyze transactions',
      },
    });
  }
});

export { router as sentinelRoutes };
