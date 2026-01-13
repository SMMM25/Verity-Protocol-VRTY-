/**
 * Verity Protocol - Relayer API Routes
 * 
 * @module api/routes/relayer
 * @description REST API endpoints for the gasless transaction relayer.
 * Enables users to submit meta-transactions with protocol-sponsored fees.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { logger } from '../../utils/logger.js';
import { relayerService } from '../../relayer/RelayerService.js';
import { rateLimiter } from '../../relayer/RateLimiter.js';
import { stakeGuard } from '../../relayer/guards/StakeGuard.js';
import { circuitBreaker, CircuitState } from '../../relayer/guards/CircuitBreaker.js';
import { treasuryManager } from '../../relayer/TreasuryManager.js';
import { StakingTierEnum, TreasuryHealth, type StakingTier } from '../../relayer/types.js';

const router = Router();

// ============================================================================
// Validation Schemas
// ============================================================================

const submitTransactionSchema = z.object({
  userAddress: z.string().min(25).max(35).regex(/^r[a-zA-Z0-9]+$/),
  transaction: z.object({
    TransactionType: z.string(),
    Account: z.string(),
  }).passthrough(),  // Allow additional fields
  userSignature: z.string().min(10),
  nonce: z.number().int().positive(),
  deadline: z.number().int().positive().optional()
});

// ============================================================================
// Middleware
// ============================================================================

/**
 * Circuit breaker middleware - blocks requests when circuit is open
 */
const circuitBreakerMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const status = circuitBreaker.canProceed();
  
  if (!status.allowed) {
    res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Relayer service temporarily unavailable',
        reason: status.reason,
        state: status.state
      },
      meta: {
        requestId: req.headers['x-request-id'] || 'unknown',
        timestamp: new Date().toISOString()
      }
    });
    return;
  }
  
  next();
};

/**
 * Stake verification middleware - checks minimum stake requirement
 */
const stakeVerificationMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userAddress = req.body?.userAddress;
  
  if (!userAddress) {
    next();
    return;
  }

  try {
    // Check blacklist
    const isBlacklisted = await stakeGuard.isBlacklisted(userAddress);
    if (isBlacklisted) {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Address is not eligible for relayer service'
        },
        meta: {
          requestId: req.headers['x-request-id'] || 'unknown',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    // Verify stake eligibility
    const stakeResult = await stakeGuard.verifyEligibility(userAddress);
    
    // Attach to request for downstream use
    (req as any).stakeVerification = stakeResult;
    
    // For non-stakers, apply stricter limits
    if (!stakeResult.eligible) {
      // Still allow but with base tier limits
      logger.debug('Non-staked wallet using relayer', {
        userAddress,
        additionalNeeded: stakeResult.additionalNeeded
      });
    }
    
    next();
  } catch (error) {
    logger.error('Stake verification middleware error', { error, userAddress });
    next();  // Continue anyway - fail open for now
  }
};

/**
 * Rate limit middleware
 */
const rateLimitMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const userAddress = req.body?.userAddress;
  
  if (!userAddress) {
    next();
    return;
  }

  try {
    const limitResult = await rateLimiter.checkLimit(userAddress);
    
    if (!limitResult.allowed) {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: limitResult.reason || 'Rate limit exceeded',
          retryAfterMs: limitResult.retryAfterMs
        },
        data: {
          tier: limitResult.tier,
          remaining: limitResult.remaining,
          limits: limitResult.limits
        },
        meta: {
          requestId: req.headers['x-request-id'] || 'unknown',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }
    
    // Attach limit info to request
    (req as any).rateLimitInfo = limitResult;
    next();
  } catch (error) {
    logger.error('Rate limit middleware error', { error, userAddress });
    next();  // Fail open
  }
};

// ============================================================================
// Routes
// ============================================================================

/**
 * POST /relayer/submit
 * Submit a meta-transaction for relaying
 * 
 * The user signs the transaction payload, and the relayer submits it to XRPL,
 * paying the network fee from the protocol treasury.
 */
router.post(
  '/submit',
  circuitBreakerMiddleware,
  stakeVerificationMiddleware,
  rateLimitMiddleware,
  async (req: Request, res: Response): Promise<void> => {
    const requestId = req.headers['x-request-id'] as string || 'unknown';
    
    try {
      // Validate request body
      const validation = submitTransactionSchema.safeParse(req.body);
      
      if (!validation.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: validation.error.errors
          },
          meta: { requestId, timestamp: new Date().toISOString() }
        });
        return;
      }

      const { userAddress, transaction, userSignature, nonce, deadline } = validation.data;

      // Check deadline if provided
      if (deadline && Date.now() / 1000 > deadline) {
        res.status(400).json({
          success: false,
          error: {
            code: 'TRANSACTION_EXPIRED',
            message: 'Transaction deadline has passed'
          },
          meta: { requestId, timestamp: new Date().toISOString() }
        });
        return;
      }

      // Submit to relayer service
      const result = await relayerService.submitTransaction({
        userAddress,
        transaction: transaction as any,
        userSignature,
        nonce,
        deadline
      });

      if (!result.success) {
        // Record failure in circuit breaker
        circuitBreaker.recordTransaction(false, userAddress, '0');
        
        res.status(400).json({
          success: false,
          error: {
            code: 'SUBMISSION_FAILED',
            message: result.error || 'Failed to submit transaction'
          },
          data: {
            transactionId: result.transactionId
          },
          meta: { requestId, timestamp: new Date().toISOString() }
        });
        return;
      }

      // Record success
      circuitBreaker.recordTransaction(true, userAddress, result.feeDrops || '0');
      await rateLimiter.recordTransaction(userAddress, result.feeDrops || '0');

      res.status(200).json({
        success: true,
        data: {
          transactionId: result.transactionId,
          xrplHash: result.xrplHash,
          status: result.status,
          fee: {
            drops: result.feeDrops,
            xrp: result.feeXRP
          },
          processingTimeMs: result.processingTimeMs
        },
        meta: { requestId, timestamp: new Date().toISOString() }
      });

    } catch (error) {
      logger.error('Relayer submit error', { error, requestId });
      
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred'
        },
        meta: { requestId, timestamp: new Date().toISOString() }
      });
    }
  }
);

/**
 * GET /relayer/quota/:address
 * Get relayer quota and usage for a wallet address
 */
router.get('/quota/:address', async (req: Request, res: Response): Promise<void> => {
  const requestId = req.headers['x-request-id'] as string || 'unknown';
  const { address } = req.params;

  try {
    // Validate address format
    if (!address || !/^r[a-zA-Z0-9]{24,34}$/.test(address)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ADDRESS',
          message: 'Invalid XRPL address format'
        },
        meta: { requestId, timestamp: new Date().toISOString() }
      });
      return;
    }

    // Get quota from rate limiter
    const quota = await rateLimiter.getQuota(address);
    
    // Get stake info
    const stakeInfo = await stakeGuard.verifyEligibility(address);

    res.status(200).json({
      success: true,
      data: {
        address,
        tier: stakeInfo.tier,
        stakeAmount: stakeInfo.stakeAmount,
        quota: {
          daily: {
            used: quota.dailyTransactions,
            limit: quota.dailyLimit,
            remaining: quota.remainingDaily
          },
          monthly: {
            used: quota.monthlyTransactions,
            limit: quota.monthlyLimit,
            remaining: quota.remainingMonthly
          },
          fees: {
            spentXRP: quota.dailyFeeSpent,
            limitXRP: quota.dailyFeeLimit
          }
        },
        benefits: stakeInfo.benefits,
        upgrade: stakeInfo.tier !== StakingTierEnum.COMMODORE 
          ? stakeGuard.getNextTierInfo(stakeInfo.tier)
          : null
      },
      meta: { requestId, timestamp: new Date().toISOString() }
    });

  } catch (error) {
    logger.error('Quota lookup error', { error, address, requestId });
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch quota information'
      },
      meta: { requestId, timestamp: new Date().toISOString() }
    });
  }
});

/**
 * GET /relayer/status/:transactionId
 * Get status of a relayed transaction
 */
router.get('/status/:transactionId', async (req: Request, res: Response): Promise<void> => {
  const requestId = req.headers['x-request-id'] as string || 'unknown';
  const { transactionId } = req.params;

  try {
    const tx = await relayerService.getTransactionStatus(transactionId);

    if (!tx) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Transaction not found'
        },
        meta: { requestId, timestamp: new Date().toISOString() }
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: {
        transactionId: tx.id,
        userAddress: tx.userAddress,
        transactionType: tx.transactionType,
        xrplHash: tx.xrplHash,
        status: tx.status,
        fee: {
          drops: tx.feeDrops
        },
        submittedAt: tx.submittedAt,
        confirmedAt: tx.confirmedAt,
        error: tx.error
      },
      meta: { requestId, timestamp: new Date().toISOString() }
    });

  } catch (error) {
    logger.error('Transaction status error', { error, transactionId, requestId });
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch transaction status'
      },
      meta: { requestId, timestamp: new Date().toISOString() }
    });
  }
});

/**
 * GET /relayer/tiers
 * Get information about staking tiers and their benefits
 */
router.get('/tiers', async (_req: Request, res: Response): Promise<void> => {
  const requestId = _req.headers['x-request-id'] as string || 'unknown';

  try {
    const thresholds = stakeGuard.getStakeThresholds();
    const benefits = stakeGuard.getTierBenefits();

    res.status(200).json({
      success: true,
      data: {
        tiers: Object.entries(StakingTierEnum).map(([key, value]) => ({
          tier: value,
          minimumStake: thresholds[value as StakingTier],
          benefits: benefits[value as StakingTier]
        })),
        currency: 'VRTY'
      },
      meta: { requestId, timestamp: new Date().toISOString() }
    });

  } catch (error) {
    logger.error('Tiers lookup error', { error, requestId });
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch tier information'
      },
      meta: { requestId, timestamp: new Date().toISOString() }
    });
  }
});

/**
 * GET /relayer/health
 * Get relayer service health status
 */
router.get('/health', async (_req: Request, res: Response): Promise<void> => {
  const requestId = _req.headers['x-request-id'] as string || 'unknown';

  try {
    const serviceStatus = relayerService.getServiceStatus();
    const circuitState = circuitBreaker.getState();
    const treasuryStatus = treasuryManager.getTreasuryStatus();

    const isHealthy = 
      serviceStatus.initialized &&
      circuitState.state === CircuitState.CLOSED &&
      treasuryStatus.health !== TreasuryHealth.CRITICAL;

    res.status(isHealthy ? 200 : 503).json({
      success: true,
      data: {
        healthy: isHealthy,
        service: {
          initialized: serviceStatus.initialized,
          network: serviceStatus.network,
          queueSize: serviceStatus.queueSize
        },
        circuitBreaker: {
          state: circuitState.state,
          tripReason: circuitState.tripReason,
          errorRate: circuitState.errorRate,
          velocity: circuitState.velocity
        },
        treasury: {
          health: treasuryStatus.health,
          balance: treasuryStatus.balance,
          available: treasuryStatus.availableBalance
        }
      },
      meta: { requestId, timestamp: new Date().toISOString() }
    });

  } catch (error) {
    logger.error('Health check error', { error, requestId });
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Health check failed'
      },
      meta: { requestId, timestamp: new Date().toISOString() }
    });
  }
});

/**
 * GET /relayer/stats
 * Get relayer statistics (public metrics)
 */
router.get('/stats', async (_req: Request, res: Response): Promise<void> => {
  const requestId = _req.headers['x-request-id'] as string || 'unknown';

  try {
    const treasuryStatus = treasuryManager.getTreasuryStatus();
    const limiterStats = rateLimiter.getStatistics();
    const capacity = treasuryManager.estimateRemainingCapacity();

    res.status(200).json({
      success: true,
      data: {
        transactions: {
          totalRelayed: treasuryStatus.metrics.totalTransactionsRelayed,
          todayFeeSpent: treasuryStatus.metrics.dailyFeeSpend,
          averageFee: treasuryStatus.metrics.averageFeePerTransaction
        },
        capacity: {
          remainingByBalance: capacity.byBalance,
          remainingByDailyLimit: capacity.byDailyLimit,
          effectiveRemaining: capacity.effective
        },
        users: {
          activeToday: limiterStats.activeUsers,
          tierDistribution: limiterStats.tierDistribution
        }
      },
      meta: { requestId, timestamp: new Date().toISOString() }
    });

  } catch (error) {
    logger.error('Stats error', { error, requestId });
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch statistics'
      },
      meta: { requestId, timestamp: new Date().toISOString() }
    });
  }
});

export default router;
