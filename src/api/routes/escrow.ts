/**
 * Verity Protocol - Escrow & Vesting API Routes
 * Sprint 2 - XRPL Escrow Implementation
 * @module api/routes/escrow
 * @version 1.0.0
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger.js';
import { vestingFactory } from '../../escrow/VestingFactory.js';
import { releaseBot } from '../../escrow/ReleaseBot.js';
import {
  VestingType,
  VestingStatus,
  EscrowStatus,
  VestingSchedule,
  EscrowRecord,
  VestingSummary,
} from '../../escrow/types.js';
import { ESCROW_ERROR_CODES, ESCROW_LIMITS } from '../../escrow/config.js';

const router = Router();

// ============================================================================
// Request Schemas
// ============================================================================

/**
 * Create vesting schedule request schema
 */
const CreateVestingSchema = z.object({
  beneficiary: z.string().regex(/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/, 'Invalid XRPL address'),
  totalAmount: z.string().regex(/^\d+$/, 'Amount must be a numeric string'),
  currency: z.enum(['XRP', 'VRTY']),
  issuer: z.string().regex(/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/).optional(),
  vestingType: z.nativeEnum(VestingType),
  startTime: z.number().int().positive(),
  endTime: z.number().int().positive(),
  cliffDuration: z.number().int().min(0).optional(),
  releaseIntervals: z.number().int().min(1).max(ESCROW_LIMITS.MAX_ESCROWS_PER_SCHEDULE).optional(),
  cancelAfter: z.number().int().optional(),
  description: z.string().max(500).optional(),
}).refine(data => data.endTime > data.startTime, {
  message: 'End time must be after start time',
}).refine(data => {
  if (data.currency === 'VRTY' && !data.issuer) {
    return false;
  }
  return true;
}, {
  message: 'Issuer is required for VRTY tokens',
});

/**
 * Release escrow request schema
 */
const ReleaseEscrowSchema = z.object({
  fulfillment: z.string().optional(), // For conditional escrows
});

/**
 * Cancel escrow request schema
 */
const CancelEscrowSchema = z.object({
  reason: z.string().max(500).optional(),
});

// ============================================================================
// In-Memory Storage (would be replaced with Prisma in production)
// ============================================================================

const vestingSchedules = new Map<string, VestingSchedule>();
const escrowRecords = new Map<string, EscrowRecord>();
const schedulesByBeneficiary = new Map<string, string[]>();
const schedulesByCreator = new Map<string, string[]>();

// ============================================================================
// Middleware
// ============================================================================

/**
 * Request logging middleware
 */
const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = uuidv4();
  (req as any).requestId = requestId;
  
  const start = Date.now();
  logger.info('Escrow API request', {
    requestId,
    method: req.method,
    path: req.path,
  });
  
  res.on('finish', () => {
    logger.info('Escrow API response', {
      requestId,
      status: res.statusCode,
      duration: Date.now() - start,
    });
  });
  
  next();
};

router.use(requestLogger);

// ============================================================================
// Vesting Schedule Endpoints
// ============================================================================

/**
 * POST /api/v1/escrow/vesting/create
 * Create a new vesting schedule
 */
router.post('/vesting/create', async (req: Request, res: Response): Promise<void> => {
  const requestId = (req as any).requestId;
  
  try {
    // Parse and validate request body
    const validation = CreateVestingSchema.safeParse(req.body);
    
    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: {
          code: ESCROW_ERROR_CODES.INVALID_SCHEDULE,
          message: 'Invalid request body',
          details: validation.error.errors,
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      });
      return;
    }
    
    const data = validation.data;
    
    // Generate schedule ID
    const scheduleId = `VS-${uuidv4().substring(0, 8).toUpperCase()}`;
    
    // Get creator from auth header (simplified - would use proper auth in production)
    const creator = req.header('X-Creator-Address') || 'rSystem';
    
    // Calculate number of escrows for linear vesting
    let escrowCount = 1;
    if (data.vestingType === VestingType.LINEAR || data.vestingType === VestingType.CLIFF_LINEAR) {
      escrowCount = data.releaseIntervals || 12; // Default to monthly for 1 year
    }
    
    // Calculate individual escrow amounts
    const totalAmountBigInt = BigInt(data.totalAmount);
    const amountPerEscrow = totalAmountBigInt / BigInt(escrowCount);
    const remainder = totalAmountBigInt % BigInt(escrowCount);
    
    // Calculate release times
    const vestingDuration = data.endTime - data.startTime;
    const intervalDuration = vestingDuration / escrowCount;
    
    // Calculate cliff if applicable
    let firstReleaseTime = data.startTime;
    if (data.cliffDuration && (data.vestingType === VestingType.CLIFF || data.vestingType === VestingType.CLIFF_LINEAR)) {
      firstReleaseTime = data.startTime + data.cliffDuration;
    }
    
    // Create escrow records
    const escrowIds: string[] = [];
    const creationTxHashes: string[] = [];
    
    for (let i = 0; i < escrowCount; i++) {
      const escrowId = `ESC-${uuidv4().substring(0, 8).toUpperCase()}`;
      escrowIds.push(escrowId);
      
      // Calculate release time for this escrow
      let releaseTime: number;
      if (data.vestingType === VestingType.CLIFF) {
        releaseTime = firstReleaseTime;
      } else {
        releaseTime = firstReleaseTime + (intervalDuration * (i + 1));
      }
      
      // Last escrow gets any remainder
      const amount = i === escrowCount - 1 
        ? String(amountPerEscrow + remainder)
        : String(amountPerEscrow);
      
      // Create escrow record (in production, this would create actual XRPL escrow)
      const escrowRecord: EscrowRecord = {
        escrowId,
        scheduleId,
        sequence: 1000 + i, // Placeholder sequence
        source: creator,
        destination: data.beneficiary,
        amount,
        currency: data.currency,
        issuer: data.issuer,
        finishAfter: releaseTime - 946684800, // Convert to Ripple epoch
        cancelAfter: data.cancelAfter ? data.cancelAfter - 946684800 : undefined,
        status: EscrowStatus.CREATED,
        createTxHash: `SIM_${escrowId}`, // Simulated hash
        createdAt: new Date(),
      };
      
      escrowRecords.set(escrowId, escrowRecord);
      creationTxHashes.push(escrowRecord.createTxHash);
    }
    
    // Create vesting schedule
    const schedule: VestingSchedule = {
      scheduleId,
      beneficiary: data.beneficiary,
      totalAmount: data.totalAmount,
      currency: data.currency,
      issuer: data.issuer,
      vestingType: data.vestingType,
      startTime: data.startTime,
      endTime: data.endTime,
      cliffDuration: data.cliffDuration,
      releaseIntervals: escrowCount,
      cancelAfter: data.cancelAfter,
      creator,
      description: data.description,
      status: VestingStatus.ACTIVE,
      escrowIds,
      releasedAmount: '0',
      pendingAmount: data.totalAmount,
      escrowsReleased: 0,
      totalEscrows: escrowCount,
      createdAt: new Date(),
      updatedAt: new Date(),
      creationTxHashes,
    };
    
    vestingSchedules.set(scheduleId, schedule);
    
    // Index by beneficiary
    const beneficiarySchedules = schedulesByBeneficiary.get(data.beneficiary) || [];
    beneficiarySchedules.push(scheduleId);
    schedulesByBeneficiary.set(data.beneficiary, beneficiarySchedules);
    
    // Index by creator
    const creatorSchedules = schedulesByCreator.get(creator) || [];
    creatorSchedules.push(scheduleId);
    schedulesByCreator.set(creator, creatorSchedules);
    
    logger.info('Vesting schedule created', {
      requestId,
      scheduleId,
      beneficiary: data.beneficiary,
      totalAmount: data.totalAmount,
      escrowCount,
    });
    
    res.status(201).json({
      success: true,
      data: {
        scheduleId,
        beneficiary: data.beneficiary,
        totalAmount: data.totalAmount,
        currency: data.currency,
        vestingType: data.vestingType,
        escrowCount,
        startTime: data.startTime,
        endTime: data.endTime,
        status: VestingStatus.ACTIVE,
        transactionHashes: creationTxHashes,
      },
      meta: { requestId, timestamp: new Date().toISOString() },
    });
    
  } catch (error) {
    logger.error('Failed to create vesting schedule', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    res.status(500).json({
      success: false,
      error: {
        code: ESCROW_ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to create vesting schedule',
      },
      meta: { requestId, timestamp: new Date().toISOString() },
    });
  }
});

/**
 * GET /api/v1/escrow/vesting/:scheduleId
 * Get vesting schedule details
 */
router.get('/vesting/:scheduleId', async (req: Request, res: Response): Promise<void> => {
  const requestId = (req as any).requestId;
  const scheduleId = req.params['scheduleId'] as string;
  
  try {
    const schedule = vestingSchedules.get(scheduleId);
    
    if (!schedule) {
      res.status(404).json({
        success: false,
        error: {
          code: ESCROW_ERROR_CODES.SCHEDULE_NOT_FOUND,
          message: 'Vesting schedule not found',
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      });
      return;
    }
    
    // Get all escrows for this schedule
    const escrows = schedule.escrowIds
      .map(id => escrowRecords.get(id))
      .filter((e): e is EscrowRecord => e !== undefined);
    
    // Calculate next release
    const now = Math.floor(Date.now() / 1000);
    const pendingEscrows = escrows
      .filter(e => e.status === EscrowStatus.CREATED)
      .sort((a, b) => a.finishAfter - b.finishAfter);
    
    const nextRelease = pendingEscrows[0];
    
    res.json({
      success: true,
      data: {
        ...schedule,
        escrows: escrows.map(e => ({
          escrowId: e.escrowId,
          amount: e.amount,
          status: e.status,
          finishAfter: e.finishAfter + 946684800, // Convert back to Unix
          releasedAt: e.releasedAt,
        })),
        progress: {
          percentage: schedule.totalEscrows > 0 
            ? Math.round((schedule.escrowsReleased / schedule.totalEscrows) * 100)
            : 0,
          released: schedule.releasedAmount,
          pending: schedule.pendingAmount,
        },
        nextRelease: nextRelease ? {
          escrowId: nextRelease.escrowId,
          amount: nextRelease.amount,
          releaseTime: nextRelease.finishAfter + 946684800, // Unix timestamp
          isReady: now >= nextRelease.finishAfter + 946684800,
        } : null,
      },
      meta: { requestId, timestamp: new Date().toISOString() },
    });
    
  } catch (error) {
    logger.error('Failed to get vesting schedule', {
      requestId,
      scheduleId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    res.status(500).json({
      success: false,
      error: {
        code: ESCROW_ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to get vesting schedule',
      },
      meta: { requestId, timestamp: new Date().toISOString() },
    });
  }
});

/**
 * GET /api/v1/escrow/vesting/beneficiary/:address
 * Get all vesting schedules for a beneficiary
 */
router.get('/vesting/beneficiary/:address', async (req: Request, res: Response): Promise<void> => {
  const requestId = (req as any).requestId;
  const address = req.params['address'] as string;
  
  try {
    // Validate address format
    if (!/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(address)) {
      res.status(400).json({
        success: false,
        error: {
          code: ESCROW_ERROR_CODES.INVALID_BENEFICIARY,
          message: 'Invalid XRPL address format',
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      });
      return;
    }
    
    const scheduleIds = schedulesByBeneficiary.get(address) || [];
    const schedules = scheduleIds
      .map(id => vestingSchedules.get(id))
      .filter((s): s is VestingSchedule => s !== undefined);
    
    // Calculate summary
    const summary: VestingSummary = {
      address,
      totalSchedules: schedules.length,
      activeSchedules: schedules.filter(s => s.status === VestingStatus.ACTIVE).length,
      completedSchedules: schedules.filter(s => s.status === VestingStatus.COMPLETED).length,
      totalVested: schedules.reduce((sum, s) => {
        return String(BigInt(sum) + BigInt(s.totalAmount));
      }, '0'),
      totalReleased: schedules.reduce((sum, s) => {
        return String(BigInt(sum) + BigInt(s.releasedAmount));
      }, '0'),
      totalPending: schedules.reduce((sum, s) => {
        return String(BigInt(sum) + BigInt(s.pendingAmount));
      }, '0'),
    };
    
    // Find next release across all schedules
    let nextRelease: { time: number; amount: string } | undefined;
    
    for (const schedule of schedules) {
      if (schedule.status !== VestingStatus.ACTIVE) continue;
      
      for (const escrowId of schedule.escrowIds) {
        const escrow = escrowRecords.get(escrowId);
        if (escrow && escrow.status === EscrowStatus.CREATED) {
          const releaseTime = escrow.finishAfter + 946684800;
          if (!nextRelease || releaseTime < nextRelease.time) {
            nextRelease = { time: releaseTime, amount: escrow.amount };
          }
        }
      }
    }
    
    if (nextRelease) {
      summary.nextReleaseTime = nextRelease.time;
      summary.nextReleaseAmount = nextRelease.amount;
    }
    
    res.json({
      success: true,
      data: {
        summary,
        schedules: schedules.map(s => ({
          scheduleId: s.scheduleId,
          totalAmount: s.totalAmount,
          currency: s.currency,
          vestingType: s.vestingType,
          status: s.status,
          progress: s.totalEscrows > 0 
            ? Math.round((s.escrowsReleased / s.totalEscrows) * 100)
            : 0,
          startTime: s.startTime,
          endTime: s.endTime,
        })),
      },
      meta: { requestId, timestamp: new Date().toISOString() },
    });
    
  } catch (error) {
    logger.error('Failed to get beneficiary vesting schedules', {
      requestId,
      address,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    res.status(500).json({
      success: false,
      error: {
        code: ESCROW_ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to get vesting schedules',
      },
      meta: { requestId, timestamp: new Date().toISOString() },
    });
  }
});

// ============================================================================
// Escrow Release/Cancel Endpoints
// ============================================================================

/**
 * POST /api/v1/escrow/release/:escrowId
 * Release a mature escrow
 */
router.post('/release/:escrowId', async (req: Request, res: Response): Promise<void> => {
  const requestId = (req as any).requestId;
  const escrowId = req.params['escrowId'] as string;
  
  try {
    // Parse optional fulfillment for conditional escrows
    let fulfillment: string | undefined;
    if (req.body) {
      const validation = ReleaseEscrowSchema.safeParse(req.body);
      if (validation.success) {
        fulfillment = validation.data.fulfillment;
      }
    }
    
    const escrow = escrowRecords.get(escrowId);
    
    if (!escrow) {
      res.status(404).json({
        success: false,
        error: {
          code: ESCROW_ERROR_CODES.ESCROW_NOT_FOUND,
          message: 'Escrow not found',
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      });
      return;
    }
    
    // Check if already released or cancelled
    if (escrow.status === EscrowStatus.RELEASED) {
      res.status(400).json({
        success: false,
        error: {
          code: ESCROW_ERROR_CODES.ESCROW_ALREADY_RELEASED,
          message: 'Escrow has already been released',
          details: { releasedAt: escrow.releasedAt, txHash: escrow.finishTxHash },
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      });
      return;
    }
    
    if (escrow.status === EscrowStatus.CANCELLED) {
      res.status(400).json({
        success: false,
        error: {
          code: ESCROW_ERROR_CODES.ESCROW_ALREADY_CANCELLED,
          message: 'Escrow has been cancelled',
          details: { txHash: escrow.cancelTxHash },
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      });
      return;
    }
    
    // Check if escrow is mature
    const now = Math.floor(Date.now() / 1000);
    const finishAfterUnix = escrow.finishAfter + 946684800;
    
    if (now < finishAfterUnix) {
      res.status(400).json({
        success: false,
        error: {
          code: ESCROW_ERROR_CODES.ESCROW_NOT_MATURE,
          message: 'Escrow is not yet mature',
          details: {
            currentTime: now,
            maturityTime: finishAfterUnix,
            timeRemaining: finishAfterUnix - now,
          },
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      });
      return;
    }
    
    // Check for conditional escrow
    if (escrow.condition && !fulfillment) {
      res.status(400).json({
        success: false,
        error: {
          code: ESCROW_ERROR_CODES.INVALID_SCHEDULE,
          message: 'Fulfillment required for conditional escrow',
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      });
      return;
    }
    
    // Simulate escrow release (in production, would submit EscrowFinish transaction)
    const finishTxHash = `FINISH_${escrowId}_${Date.now()}`;
    
    // Update escrow record
    escrow.status = EscrowStatus.RELEASED;
    escrow.finishTxHash = finishTxHash;
    escrow.releasedAt = new Date();
    escrowRecords.set(escrowId, escrow);
    
    // Update vesting schedule
    const schedule = vestingSchedules.get(escrow.scheduleId);
    if (schedule) {
      schedule.escrowsReleased++;
      schedule.releasedAmount = String(BigInt(schedule.releasedAmount) + BigInt(escrow.amount));
      schedule.pendingAmount = String(BigInt(schedule.pendingAmount) - BigInt(escrow.amount));
      schedule.updatedAt = new Date();
      
      // Check if schedule is complete
      if (schedule.escrowsReleased === schedule.totalEscrows) {
        schedule.status = VestingStatus.COMPLETED;
      }
      
      vestingSchedules.set(escrow.scheduleId, schedule);
    }
    
    logger.info('Escrow released', {
      requestId,
      escrowId,
      scheduleId: escrow.scheduleId,
      amount: escrow.amount,
      txHash: finishTxHash,
    });
    
    res.json({
      success: true,
      data: {
        escrowId,
        scheduleId: escrow.scheduleId,
        amount: escrow.amount,
        currency: escrow.currency,
        destination: escrow.destination,
        transactionHash: finishTxHash,
        releasedAt: escrow.releasedAt,
      },
      meta: { requestId, timestamp: new Date().toISOString() },
    });
    
  } catch (error) {
    logger.error('Failed to release escrow', {
      requestId,
      escrowId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    res.status(500).json({
      success: false,
      error: {
        code: ESCROW_ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to release escrow',
      },
      meta: { requestId, timestamp: new Date().toISOString() },
    });
  }
});

/**
 * POST /api/v1/escrow/cancel/:escrowId
 * Cancel an escrow (if CancelAfter has passed)
 */
router.post('/cancel/:escrowId', async (req: Request, res: Response): Promise<void> => {
  const requestId = (req as any).requestId;
  const escrowId = req.params['escrowId'] as string;
  
  try {
    // Parse optional reason
    let reason: string | undefined;
    if (req.body) {
      const validation = CancelEscrowSchema.safeParse(req.body);
      if (validation.success) {
        reason = validation.data.reason;
      }
    }
    
    const escrow = escrowRecords.get(escrowId);
    
    if (!escrow) {
      res.status(404).json({
        success: false,
        error: {
          code: ESCROW_ERROR_CODES.ESCROW_NOT_FOUND,
          message: 'Escrow not found',
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      });
      return;
    }
    
    // Check if already released or cancelled
    if (escrow.status === EscrowStatus.RELEASED) {
      res.status(400).json({
        success: false,
        error: {
          code: ESCROW_ERROR_CODES.ESCROW_ALREADY_RELEASED,
          message: 'Cannot cancel - escrow has already been released',
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      });
      return;
    }
    
    if (escrow.status === EscrowStatus.CANCELLED) {
      res.status(400).json({
        success: false,
        error: {
          code: ESCROW_ERROR_CODES.ESCROW_ALREADY_CANCELLED,
          message: 'Escrow has already been cancelled',
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      });
      return;
    }
    
    // Check if cancellation is allowed
    if (!escrow.cancelAfter) {
      res.status(400).json({
        success: false,
        error: {
          code: ESCROW_ERROR_CODES.CANNOT_CANCEL_YET,
          message: 'This escrow cannot be cancelled (no CancelAfter set)',
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      });
      return;
    }
    
    const now = Math.floor(Date.now() / 1000);
    const cancelAfterUnix = escrow.cancelAfter + 946684800;
    
    if (now < cancelAfterUnix) {
      res.status(400).json({
        success: false,
        error: {
          code: ESCROW_ERROR_CODES.CANNOT_CANCEL_YET,
          message: 'Escrow cannot be cancelled yet',
          details: {
            currentTime: now,
            cancelAfterTime: cancelAfterUnix,
            timeRemaining: cancelAfterUnix - now,
          },
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      });
      return;
    }
    
    // Simulate escrow cancellation (in production, would submit EscrowCancel transaction)
    const cancelTxHash = `CANCEL_${escrowId}_${Date.now()}`;
    
    // Update escrow record
    escrow.status = EscrowStatus.CANCELLED;
    escrow.cancelTxHash = cancelTxHash;
    escrow.errorMessage = reason || 'Cancelled after CancelAfter deadline';
    escrowRecords.set(escrowId, escrow);
    
    // Update vesting schedule
    const schedule = vestingSchedules.get(escrow.scheduleId);
    if (schedule) {
      schedule.pendingAmount = String(BigInt(schedule.pendingAmount) - BigInt(escrow.amount));
      schedule.updatedAt = new Date();
      
      // Check if all escrows are now processed
      const remainingEscrows = schedule.escrowIds
        .map(id => escrowRecords.get(id))
        .filter(e => e && e.status === EscrowStatus.CREATED);
      
      if (remainingEscrows.length === 0) {
        schedule.status = schedule.escrowsReleased > 0 
          ? VestingStatus.COMPLETED 
          : VestingStatus.CANCELLED;
      }
      
      vestingSchedules.set(escrow.scheduleId, schedule);
    }
    
    logger.info('Escrow cancelled', {
      requestId,
      escrowId,
      scheduleId: escrow.scheduleId,
      amount: escrow.amount,
      reason,
      txHash: cancelTxHash,
    });
    
    res.json({
      success: true,
      data: {
        escrowId,
        scheduleId: escrow.scheduleId,
        amount: escrow.amount,
        refundedTo: escrow.source,
        transactionHash: cancelTxHash,
        reason,
      },
      meta: { requestId, timestamp: new Date().toISOString() },
    });
    
  } catch (error) {
    logger.error('Failed to cancel escrow', {
      requestId,
      escrowId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    res.status(500).json({
      success: false,
      error: {
        code: ESCROW_ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to cancel escrow',
      },
      meta: { requestId, timestamp: new Date().toISOString() },
    });
  }
});

// ============================================================================
// Query Endpoints
// ============================================================================

/**
 * GET /api/v1/escrow/stats
 * Get escrow system statistics
 */
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  const requestId = (req as any).requestId;
  
  try {
    const allSchedules = Array.from(vestingSchedules.values());
    const allEscrows = Array.from(escrowRecords.values());
    
    const stats = {
      schedules: {
        total: allSchedules.length,
        active: allSchedules.filter(s => s.status === VestingStatus.ACTIVE).length,
        completed: allSchedules.filter(s => s.status === VestingStatus.COMPLETED).length,
        cancelled: allSchedules.filter(s => s.status === VestingStatus.CANCELLED).length,
      },
      escrows: {
        total: allEscrows.length,
        created: allEscrows.filter(e => e.status === EscrowStatus.CREATED).length,
        mature: allEscrows.filter(e => {
          if (e.status !== EscrowStatus.CREATED) return false;
          const now = Math.floor(Date.now() / 1000);
          return now >= e.finishAfter + 946684800;
        }).length,
        released: allEscrows.filter(e => e.status === EscrowStatus.RELEASED).length,
        cancelled: allEscrows.filter(e => e.status === EscrowStatus.CANCELLED).length,
        failed: allEscrows.filter(e => e.status === EscrowStatus.FAILED).length,
      },
      amounts: {
        totalVested: allSchedules.reduce((sum, s) => {
          return String(BigInt(sum) + BigInt(s.totalAmount));
        }, '0'),
        totalReleased: allSchedules.reduce((sum, s) => {
          return String(BigInt(sum) + BigInt(s.releasedAmount));
        }, '0'),
        totalPending: allSchedules.reduce((sum, s) => {
          return String(BigInt(sum) + BigInt(s.pendingAmount));
        }, '0'),
      },
      byType: {
        [VestingType.LINEAR]: allSchedules.filter(s => s.vestingType === VestingType.LINEAR).length,
        [VestingType.CLIFF]: allSchedules.filter(s => s.vestingType === VestingType.CLIFF).length,
        [VestingType.MILESTONE]: allSchedules.filter(s => s.vestingType === VestingType.MILESTONE).length,
        [VestingType.CLIFF_LINEAR]: allSchedules.filter(s => s.vestingType === VestingType.CLIFF_LINEAR).length,
      },
      uniqueBeneficiaries: new Set(allSchedules.map(s => s.beneficiary)).size,
    };
    
    res.json({
      success: true,
      data: stats,
      meta: { requestId, timestamp: new Date().toISOString() },
    });
    
  } catch (error) {
    logger.error('Failed to get escrow stats', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    res.status(500).json({
      success: false,
      error: {
        code: ESCROW_ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to get statistics',
      },
      meta: { requestId, timestamp: new Date().toISOString() },
    });
  }
});

/**
 * GET /api/v1/escrow/bot/status
 * Get release bot status
 */
router.get('/bot/status', async (req: Request, res: Response): Promise<void> => {
  const requestId = (req as any).requestId;
  
  try {
    const botStatus = await releaseBot.getStatus();
    
    res.json({
      success: true,
      data: botStatus,
      meta: { requestId, timestamp: new Date().toISOString() },
    });
    
  } catch (error) {
    logger.error('Failed to get bot status', {
      requestId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    res.status(500).json({
      success: false,
      error: {
        code: ESCROW_ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to get bot status',
      },
      meta: { requestId, timestamp: new Date().toISOString() },
    });
  }
});

/**
 * GET /api/v1/escrow/:escrowId
 * Get escrow details
 */
router.get('/:escrowId', async (req: Request, res: Response): Promise<void> => {
  const requestId = (req as any).requestId;
  const escrowId = req.params['escrowId'] as string;
  
  // Skip if this looks like a sub-route
  if (['vesting', 'release', 'cancel', 'stats', 'bot'].includes(escrowId)) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Endpoint not found' },
      meta: { requestId, timestamp: new Date().toISOString() },
    });
    return;
  }
  
  try {
    const escrow = escrowRecords.get(escrowId);
    
    if (!escrow) {
      res.status(404).json({
        success: false,
        error: {
          code: ESCROW_ERROR_CODES.ESCROW_NOT_FOUND,
          message: 'Escrow not found',
        },
        meta: { requestId, timestamp: new Date().toISOString() },
      });
      return;
    }
    
    // Get parent schedule info
    const schedule = vestingSchedules.get(escrow.scheduleId);
    
    res.json({
      success: true,
      data: {
        ...escrow,
        finishAfterUnix: escrow.finishAfter + 946684800,
        cancelAfterUnix: escrow.cancelAfter ? escrow.cancelAfter + 946684800 : undefined,
        schedule: schedule ? {
          scheduleId: schedule.scheduleId,
          vestingType: schedule.vestingType,
          totalAmount: schedule.totalAmount,
          progress: schedule.totalEscrows > 0 
            ? Math.round((schedule.escrowsReleased / schedule.totalEscrows) * 100)
            : 0,
        } : undefined,
      },
      meta: { requestId, timestamp: new Date().toISOString() },
    });
    
  } catch (error) {
    logger.error('Failed to get escrow', {
      requestId,
      escrowId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    res.status(500).json({
      success: false,
      error: {
        code: ESCROW_ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to get escrow',
      },
      meta: { requestId, timestamp: new Date().toISOString() },
    });
  }
});

// ============================================================================
// Export
// ============================================================================

export { router as escrowRouter };
export default router;
