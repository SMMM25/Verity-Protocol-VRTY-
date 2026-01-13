/**
 * Verity Protocol - Cross-Chain Bridge API Routes (Production)
 * 
 * @module api/routes/bridge
 * @description Production-ready cross-chain bridging endpoints.
 * Supports XRPL ↔ Solana bridging with wVRTY (wrapped VRTY).
 * All operations are persisted to PostgreSQL database.
 * 
 * @version 2.0.0
 * @since Phase 4 - Cross-Chain Bridge
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { solanaBridge } from '../../bridge/index.js';
import { prisma, checkDatabaseHealth } from '../../db/client.js';
import { logger } from '../../utils/logger.js';
import type { BridgeStatus, BridgeDirection } from '@prisma/client';

const router = Router();

// ============================================================
// CONSTANTS
// ============================================================

const SUPPORTED_CHAINS = {
  XRPL: {
    chainId: 'xrpl-mainnet',
    name: 'XRP Ledger',
    status: 'active',
    confirmationsRequired: 1,
    nativeToken: 'XRP',
    fees: {
      baseFee: 1,
      percentageBps: 10,
      minFee: 2,
      maxFee: 2500,
    },
    bridgeConfig: {
      type: 'native',
      issuerAddress: process.env['VERITY_ISSUER_ADDRESS'] || 'Not configured',
    },
  },
  SOLANA: {
    chainId: 'solana-mainnet-beta',
    name: 'Solana Mainnet',
    status: 'active',
    confirmationsRequired: 32,
    nativeToken: 'SOL',
    fees: {
      baseFee: 2,
      percentageBps: 10,
      minFee: 5,
      maxFee: 2500,
    },
    bridgeConfig: {
      type: 'wrapped',
      wvrtyMint: process.env['SOLANA_WVRTY_MINT'] || 'Not configured',
      bridgeProgram: process.env['SOLANA_BRIDGE_PROGRAM'] || 'Not configured',
    },
  },
  ETHEREUM: {
    chainId: 1,
    name: 'Ethereum Mainnet',
    status: 'coming_soon',
    confirmationsRequired: 12,
    nativeToken: 'ETH',
    fees: {
      baseFee: 10,
      percentageBps: 25,
      minFee: 50,
      maxFee: 10000,
    },
    bridgeConfig: {
      type: 'wrapped',
      bridgeContract: process.env['ETH_BRIDGE_CONTRACT'] || 'Not configured',
      wvrtyContract: process.env['ETH_WVRTY_CONTRACT'] || 'Not configured',
    },
  },
  POLYGON: {
    chainId: 137,
    name: 'Polygon Mainnet',
    status: 'coming_soon',
    confirmationsRequired: 128,
    nativeToken: 'MATIC',
    fees: {
      baseFee: 5,
      percentageBps: 15,
      minFee: 10,
      maxFee: 5000,
    },
    bridgeConfig: {
      type: 'wrapped',
      bridgeContract: process.env['POLYGON_BRIDGE_CONTRACT'] || 'Not configured',
      wvrtyContract: process.env['POLYGON_WVRTY_CONTRACT'] || 'Not configured',
    },
  },
};

const ACTIVE_CHAINS = ['XRPL', 'SOLANA'];
const MIN_BRIDGE_AMOUNT = 100;
const MAX_BRIDGE_AMOUNT = 1000000;

// ============================================================
// VALIDATION SCHEMAS
// ============================================================

const initiateBridgeSchema = z.object({
  sourceChain: z.enum(['XRPL', 'SOLANA']),
  destinationChain: z.enum(['XRPL', 'SOLANA']),
  sourceAddress: z.string().min(25, 'Invalid source address'),
  destinationAddress: z.string().min(25, 'Invalid destination address'),
  amount: z.string().refine(val => {
    const num = parseFloat(val);
    return !isNaN(num) && num >= MIN_BRIDGE_AMOUNT && num <= MAX_BRIDGE_AMOUNT;
  }, `Amount must be between ${MIN_BRIDGE_AMOUNT} and ${MAX_BRIDGE_AMOUNT}`),
});

const validatorSignatureSchema = z.object({
  validatorAddress: z.string().min(25, 'Invalid validator address'),
  signature: z.string().min(64, 'Invalid signature'),
});

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function getDirection(source: string, dest: string): BridgeDirection {
  if (source === 'XRPL' && dest === 'SOLANA') return 'XRPL_TO_SOLANA';
  if (source === 'SOLANA' && dest === 'XRPL') return 'SOLANA_TO_XRPL';
  throw new Error(`Unsupported bridge direction: ${source} → ${dest}`);
}

function calculateFee(amount: number, chain: keyof typeof SUPPORTED_CHAINS): {
  fee: number;
  netAmount: number;
  breakdown: { baseFee: number; percentageFee: number };
} {
  const config = SUPPORTED_CHAINS[chain].fees;
  const baseFee = config.baseFee;
  const percentageFee = (amount * config.percentageBps) / 10000;
  let totalFee = baseFee + percentageFee;

  if (totalFee < config.minFee) totalFee = config.minFee;
  if (totalFee > config.maxFee) totalFee = config.maxFee;

  return {
    fee: totalFee,
    netAmount: amount - totalFee,
    breakdown: { baseFee, percentageFee },
  };
}

// ============================================================
// CHAIN INFORMATION ENDPOINTS
// ============================================================

/**
 * @route GET /bridge/supported-chains
 * @summary Get list of supported chains for bridging
 */
router.get('/supported-chains', async (req: Request, res: Response) => {
  try {
    // Get Solana connection status
    const solanaHealth = await solanaBridge.checkConnection();

    res.json({
      success: true,
      data: {
        chains: Object.entries(SUPPORTED_CHAINS).map(([key, chain]) => ({
          id: key,
          ...chain,
          isActive: ACTIVE_CHAINS.includes(key),
          health: key === 'SOLANA' ? {
            connected: solanaHealth.connected,
            latency: solanaHealth.latency,
          } : undefined,
        })),
        activeChains: ACTIVE_CHAINS,
        wrappedToken: {
          symbol: 'wVRTY',
          name: 'Wrapped VRTY',
          decimals: 6,
          description: 'Wrapped VRTY token for cross-chain operations',
        },
        bridgeInfo: {
          minAmount: MIN_BRIDGE_AMOUNT,
          maxAmount: MAX_BRIDGE_AMOUNT,
          requiredValidators: 3,
          estimatedTime: '5-15 minutes',
        },
      },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  } catch (error) {
    logger.error('Error fetching supported chains', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch chain information' },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  }
});

/**
 * @route GET /bridge/solana/status
 * @summary Get Solana network status and wVRTY info
 */
router.get('/solana/status', async (req: Request, res: Response) => {
  try {
    const [health, networkInfo] = await Promise.all([
      solanaBridge.checkConnection(),
      solanaBridge.getNetworkInfo().catch(() => null),
    ]);

    let mintInfo = null;
    try {
      mintInfo = await solanaBridge.getMintInfo();
    } catch {
      // wVRTY mint not configured
    }

    res.json({
      success: true,
      data: {
        network: {
          connected: health.connected,
          slot: health.slot,
          blockHeight: health.blockHeight,
          latency: health.latency,
          error: health.error,
        },
        wvrty: mintInfo || {
          address: 'Not configured',
          supply: '0',
          decimals: 6,
          status: 'pending_deployment',
        },
        epochInfo: networkInfo?.epochInfo,
        version: networkInfo?.version,
      },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  } catch (error) {
    logger.error('Error fetching Solana status', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch Solana status' },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  }
});

// ============================================================
// FEE ESTIMATION ENDPOINTS
// ============================================================

/**
 * @route GET /bridge/estimate-fee
 * @summary Estimate bridge fee for a transaction
 */
router.get('/estimate-fee', (req: Request, res: Response) => {
  try {
    const sourceChain = (req.query['sourceChain'] as string) || 'XRPL';
    const destinationChain = req.query['destinationChain'] as string;
    const amount = req.query['amount'] as string;

    if (!destinationChain || !amount) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'destinationChain and amount are required',
        },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    if (!ACTIVE_CHAINS.includes(destinationChain)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'UNSUPPORTED_CHAIN',
          message: `Chain ${destinationChain} is not currently active for bridging`,
          supportedChains: ACTIVE_CHAINS,
        },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid amount' },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    if (amountNum < MIN_BRIDGE_AMOUNT) {
      res.status(400).json({
        success: false,
        error: {
          code: 'AMOUNT_TOO_LOW',
          message: `Minimum bridge amount is ${MIN_BRIDGE_AMOUNT} VRTY`,
        },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    if (amountNum > MAX_BRIDGE_AMOUNT) {
      res.status(400).json({
        success: false,
        error: {
          code: 'AMOUNT_TOO_HIGH',
          message: `Maximum bridge amount is ${MAX_BRIDGE_AMOUNT} VRTY`,
        },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    const feeResult = calculateFee(amountNum, destinationChain as keyof typeof SUPPORTED_CHAINS);
    const chainConfig = SUPPORTED_CHAINS[destinationChain as keyof typeof SUPPORTED_CHAINS];

    res.json({
      success: true,
      data: {
        sourceChain,
        destinationChain,
        amount,
        estimatedFee: feeResult.fee.toFixed(6),
        netAmount: feeResult.netAmount.toFixed(6),
        feeBreakdown: {
          baseFee: feeResult.breakdown.baseFee.toFixed(6),
          percentageFee: feeResult.breakdown.percentageFee.toFixed(6),
          percentageRate: `${chainConfig.fees.percentageBps / 100}%`,
        },
        limits: {
          minimum: MIN_BRIDGE_AMOUNT,
          maximum: MAX_BRIDGE_AMOUNT,
        },
        estimatedTime: '5-15 minutes',
        confirmationsRequired: chainConfig.confirmationsRequired,
      },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  } catch (error) {
    logger.error('Error estimating fee', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to estimate fee' },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  }
});

// ============================================================
// BRIDGE TRANSACTION ENDPOINTS
// ============================================================

/**
 * @route POST /bridge/initiate
 * @summary Initiate a bridge transaction
 */
router.post('/initiate', async (req: Request, res: Response) => {
  try {
    const validatedData = initiateBridgeSchema.parse(req.body);

    // Validate source and destination are different
    if (validatedData.sourceChain === validatedData.destinationChain) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ROUTE',
          message: 'Source and destination chains must be different',
        },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    const direction = getDirection(validatedData.sourceChain, validatedData.destinationChain);
    const amount = parseFloat(validatedData.amount);
    const feeResult = calculateFee(amount, validatedData.destinationChain as keyof typeof SUPPORTED_CHAINS);

    let result;

    if (direction === 'XRPL_TO_SOLANA') {
      result = await solanaBridge.initiateBridgeToSolana({
        sourceAddress: validatedData.sourceAddress,
        destinationAddress: validatedData.destinationAddress,
        amount: validatedData.amount,
        direction: 'XRPL_TO_SOLANA',
      });
    } else {
      result = await solanaBridge.initiateBridgeToXRPL({
        sourceAddress: validatedData.sourceAddress,
        destinationAddress: validatedData.destinationAddress,
        amount: validatedData.amount,
        direction: 'SOLANA_TO_XRPL',
      });
    }

    logger.info('Bridge transaction initiated', {
      bridgeId: result.bridgeId,
      direction,
      amount,
    });

    res.status(201).json({
      success: true,
      data: {
        bridgeId: result.bridgeId,
        status: result.status,
        direction,
        sourceChain: validatedData.sourceChain,
        destinationChain: validatedData.destinationChain,
        sourceAddress: validatedData.sourceAddress,
        destinationAddress: validatedData.destinationAddress,
        amount: validatedData.amount,
        fee: feeResult.fee.toFixed(6),
        netAmount: feeResult.netAmount.toFixed(6),
        estimatedCompletionTime: result.estimatedCompletionTime,
        nextSteps: direction === 'XRPL_TO_SOLANA'
          ? [
              '1. Sign the lock transaction on XRPL to escrow your VRTY',
              '2. Wait for validator confirmations (3 required)',
              '3. wVRTY will be minted to your Solana wallet',
            ]
          : [
              '1. Approve the burn transaction on Solana',
              '2. Sign the burn transaction to destroy wVRTY',
              '3. Wait for validator confirmations (3 required)',
              '4. VRTY will be released to your XRPL wallet',
            ],
      },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid bridge request',
          details: error.errors,
        },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    logger.error('Error initiating bridge', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: (error as Error).message || 'Failed to initiate bridge',
      },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  }
});

/**
 * @route GET /bridge/transaction/:bridgeId
 * @summary Get bridge transaction status
 */
router.get('/transaction/:bridgeId', async (req: Request, res: Response) => {
  try {
    const bridgeId = req.params['bridgeId'] || '';

    const status = await solanaBridge.getBridgeStatus(bridgeId);

    res.json({
      success: true,
      data: status,
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage.includes('not found')) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Bridge transaction not found' },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    logger.error('Error fetching bridge status', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch bridge status' },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  }
});

/**
 * @route GET /bridge/history/:address
 * @summary Get bridge history for an address
 */
router.get('/history/:address', async (req: Request, res: Response) => {
  try {
    const address = req.params['address'] || '';
    const page = Math.max(1, parseInt(req.query['page'] as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query['limit'] as string, 10) || 20));
    const status = req.query['status'] as BridgeStatus | undefined;

    const result = await solanaBridge.getUserBridgeHistory(address, {
      page,
      limit,
      status,
    });

    res.json({
      success: true,
      data: {
        address,
        transactions: result.transactions,
      },
      meta: {
        requestId: req.requestId,
        timestamp: new Date(),
        pagination: result.pagination,
      },
    });
  } catch (error) {
    logger.error('Error fetching bridge history', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch bridge history' },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  }
});

// ============================================================
// BALANCE ENDPOINTS
// ============================================================

/**
 * @route GET /bridge/wvrty-balance
 * @summary Get wVRTY balance on Solana
 */
router.get('/wvrty-balance', async (req: Request, res: Response) => {
  try {
    const address = req.query['address'] as string;

    if (!address) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'address parameter is required' },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    const balance = await solanaBridge.getWVRTYBalance(address);

    res.json({
      success: true,
      data: {
        chain: 'SOLANA',
        ...balance,
      },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  } catch (error) {
    logger.error('Error fetching wVRTY balance', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: (error as Error).message },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  }
});

// ============================================================
// VALIDATOR ENDPOINTS
// ============================================================

/**
 * @route POST /bridge/transaction/:bridgeId/validate
 * @summary Add validator signature to bridge transaction
 */
router.post('/transaction/:bridgeId/validate', async (req: Request, res: Response) => {
  try {
    const bridgeId = req.params['bridgeId'] || '';
    const validatedData = validatorSignatureSchema.parse(req.body);

    const result = await solanaBridge.addValidatorSignature(
      bridgeId,
      validatedData.validatorAddress,
      validatedData.signature
    );

    res.json({
      success: true,
      data: {
        bridgeId,
        signatureCount: result.signatureCount,
        thresholdReached: result.thresholdReached,
        message: result.thresholdReached
          ? 'Validator threshold reached. Transaction can now be completed.'
          : `${result.signatureCount}/3 signatures collected`,
      },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid signature data', details: error.errors },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    const errorMessage = (error as Error).message;
    if (errorMessage.includes('not found')) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Bridge transaction not found' },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    if (errorMessage.includes('already signed')) {
      res.status(409).json({
        success: false,
        error: { code: 'ALREADY_SIGNED', message: errorMessage },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    logger.error('Error adding validator signature', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to add validator signature' },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  }
});

// ============================================================
// STATISTICS ENDPOINTS
// ============================================================

/**
 * @route GET /bridge/statistics
 * @summary Get bridge usage statistics
 */
router.get('/statistics', async (req: Request, res: Response) => {
  try {
    const stats = await solanaBridge.getStatistics();

    res.json({
      success: true,
      data: {
        ...stats,
        activeChains: ACTIVE_CHAINS,
        validatorInfo: {
          requiredSignatures: 3,
          activeValidators: 0, // Would be populated from validator registry
        },
      },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  } catch (error) {
    logger.error('Error fetching bridge statistics', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch statistics' },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  }
});

/**
 * @route GET /bridge/health
 * @summary Check bridge system health
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const [dbHealth, solanaHealth] = await Promise.all([
      checkDatabaseHealth(),
      solanaBridge.checkConnection(),
    ]);

    const isHealthy = dbHealth.connected && solanaHealth.connected;

    res.status(isHealthy ? 200 : 503).json({
      success: isHealthy,
      data: {
        status: isHealthy ? 'healthy' : 'degraded',
        database: dbHealth,
        solana: {
          connected: solanaHealth.connected,
          slot: solanaHealth.slot,
          latency: solanaHealth.latency,
          error: solanaHealth.error,
        },
        activeChains: ACTIVE_CHAINS.filter(chain => {
          if (chain === 'SOLANA') return solanaHealth.connected;
          if (chain === 'XRPL') return true; // XRPL is always considered active
          return false;
        }),
      },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      data: {
        status: 'unhealthy',
        error: (error as Error).message,
      },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  }
});

export const bridgeRoutes = router;
