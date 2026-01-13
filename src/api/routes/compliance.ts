/**
 * Verity Protocol - Compliance Oracle API Routes
 * 
 * Endpoints for clawback governance with:
 * - 24-hour public comment period
 * - Multi-sig voting
 * - Dispute resolution
 * - Transparency ledger
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ComplianceOracle } from '../../compliance/ComplianceOracle.js';
import { ClawbackReason } from '../../types/index.js';

const router = Router();

// Validation schemas
const createProposalSchema = z.object({
  asset: z.string().min(1),
  targetWallet: z.string().min(1),
  amount: z.string().min(1),
  reason: z.enum([
    'REGULATORY_REQUIREMENT',
    'COURT_ORDER',
    'FRAUD_DETECTION',
    'SANCTIONS_COMPLIANCE',
    'INVESTOR_PROTECTION',
    'ERROR_CORRECTION',
  ] as const),
  legalJustification: z.string().min(10),
  documentationUrls: z.array(z.string().url()).optional(),
});

const addCommentSchema = z.object({
  content: z.string().min(1).max(5000),
  supportClawback: z.boolean(),
});

const castVoteSchema = z.object({
  vote: z.enum(['approve', 'reject', 'abstain']),
  reason: z.string().optional(),
  signature: z.string().optional(),
});

const fileDisputeSchema = z.object({
  reason: z.string().min(10),
  evidence: z.array(z.string()).min(1),
  stakeAmount: z.string().min(1),
});

const resolveDisputeSchema = z.object({
  decision: z.enum(['clawback_cancelled', 'clawback_proceeds', 'partial_clawback']),
  rationale: z.string().min(10),
  partialAmount: z.string().optional(),
});

// Helper to get the compliance oracle instance
// In production, this would be injected via dependency injection
let complianceOracle: ComplianceOracle | null = null;

/**
 * Set the compliance oracle instance
 */
export function setComplianceOracle(oracle: ComplianceOracle): void {
  complianceOracle = oracle;
}

/**
 * Get compliance oracle or throw error
 */
function getOracle(): ComplianceOracle {
  if (!complianceOracle) {
    throw new Error('Compliance Oracle not initialized');
  }
  return complianceOracle;
}

// ============================================================
// PROPOSAL ENDPOINTS
// ============================================================

/**
 * @route GET /compliance/proposals
 * @description Get all clawback proposals with optional filtering
 */
router.get('/proposals', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const oracle = getOracle();
    const status = req.query['status'] as string | undefined;
    
    let proposals;
    if (status) {
      proposals = await oracle.getProposalsByStatus(status as any);
    } else {
      proposals = await oracle.getAllProposals();
    }

    res.json({
      success: true,
      data: {
        proposals,
        count: proposals.length,
      },
      meta: {
        requestId: req.headers['x-request-id'] || 'unknown',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /compliance/proposals
 * @description Create a new clawback proposal (governance only)
 */
router.post('/proposals', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validation = createProposalSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Invalid proposal data',
        details: validation.error.errors,
      });
      return;
    }

    // Get initiator from authenticated user (would use real auth in production)
    const initiator = req.headers['x-wallet-address'] as string;
    if (!initiator) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Wallet connection required',
      });
      return;
    }

    const oracle = getOracle();
    const { asset, targetWallet, amount, reason, legalJustification, documentationUrls } = validation.data;

    const proposal = await oracle.createClawbackProposal(
      initiator,
      asset,
      targetWallet,
      amount,
      reason as ClawbackReason,
      legalJustification,
      documentationUrls || []
    );

    res.status(201).json({
      success: true,
      data: proposal,
      meta: {
        requestId: req.headers['x-request-id'] || 'unknown',
        timestamp: new Date().toISOString(),
        message: '24-hour comment period has started',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /compliance/proposals/:proposalId
 * @description Get a specific proposal with full details
 */
router.get('/proposals/:proposalId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const oracle = getOracle();
    const proposalId = req.params['proposalId'] || '';

    const proposal = await oracle.getProposal(proposalId);
    if (!proposal) {
      res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: `Proposal ${proposalId} not found`,
      });
      return;
    }

    // Include related data
    const comments = await oracle.getProposalComments(proposalId);
    const disputes = await oracle.getProposalDisputes(proposalId);
    const history = await oracle.getProposalHistory(proposalId);
    const integrity = await oracle.verifyProposalIntegrity(proposalId);

    res.json({
      success: true,
      data: {
        proposal,
        comments,
        disputes,
        history,
        integrity,
      },
      meta: {
        requestId: req.headers['x-request-id'] || 'unknown',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route DELETE /compliance/proposals/:proposalId
 * @description Cancel a proposal
 */
router.delete('/proposals/:proposalId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const oracle = getOracle();
    const proposalId = req.params['proposalId'] || '';
    const canceller = req.headers['x-wallet-address'] as string;
    const reason = (req.query['reason'] as string) || 'No reason provided';

    if (!canceller) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Wallet connection required',
      });
      return;
    }

    const proposal = await oracle.cancelProposal(proposalId, reason);

    res.json({
      success: true,
      data: proposal,
      meta: {
        requestId: req.headers['x-request-id'] || 'unknown',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// COMMENT ENDPOINTS
// ============================================================

/**
 * @route GET /compliance/proposals/:proposalId/comments
 * @description Get all comments for a proposal
 */
router.get('/proposals/:proposalId/comments', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const oracle = getOracle();
    const proposalId = req.params['proposalId'] || '';

    const comments = await oracle.getProposalComments(proposalId);
    
    // Calculate sentiment
    const supporting = comments.filter((c: any) => c.supportClawback).length;
    const opposing = comments.filter((c: any) => !c.supportClawback).length;

    res.json({
      success: true,
      data: {
        comments,
        count: comments.length,
        sentiment: {
          supporting,
          opposing,
          ratio: comments.length > 0 ? (supporting / comments.length * 100).toFixed(1) + '%' : 'N/A',
        },
      },
      meta: {
        requestId: req.headers['x-request-id'] || 'unknown',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /compliance/proposals/:proposalId/comments
 * @description Add a public comment to a proposal
 */
router.post('/proposals/:proposalId/comments', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validation = addCommentSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Invalid comment data',
        details: validation.error.errors,
      });
      return;
    }

    const oracle = getOracle();
    const proposalId = req.params['proposalId'] || '';
    const author = req.headers['x-wallet-address'] as string || 'anonymous';
    const { content, supportClawback } = validation.data;

    const comment = await oracle.addPublicComment(proposalId, author, content, supportClawback);

    res.status(201).json({
      success: true,
      data: comment,
      meta: {
        requestId: req.headers['x-request-id'] || 'unknown',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// VOTING ENDPOINTS
// ============================================================

/**
 * @route POST /compliance/proposals/:proposalId/votes
 * @description Cast a governance vote on a proposal
 */
router.post('/proposals/:proposalId/votes', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validation = castVoteSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Invalid vote data',
        details: validation.error.errors,
      });
      return;
    }

    const voter = req.headers['x-wallet-address'] as string;
    if (!voter) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Wallet connection required',
      });
      return;
    }

    const oracle = getOracle();
    const proposalId = req.params['proposalId'] || '';
    const { vote, reason, signature } = validation.data;

    const voteResult = await oracle.castVote(proposalId, voter, vote, reason, signature);

    res.status(201).json({
      success: true,
      data: voteResult,
      meta: {
        requestId: req.headers['x-request-id'] || 'unknown',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// DISPUTE ENDPOINTS
// ============================================================

/**
 * @route GET /compliance/proposals/:proposalId/disputes
 * @description Get all disputes for a proposal
 */
router.get('/proposals/:proposalId/disputes', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const oracle = getOracle();
    const proposalId = req.params['proposalId'] || '';

    const disputes = await oracle.getProposalDisputes(proposalId);

    res.json({
      success: true,
      data: {
        disputes,
        count: disputes.length,
        activeCount: disputes.filter((d: any) => d.status === 'ACTIVE').length,
      },
      meta: {
        requestId: req.headers['x-request-id'] || 'unknown',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /compliance/proposals/:proposalId/disputes
 * @description File a dispute against a proposal
 */
router.post('/proposals/:proposalId/disputes', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validation = fileDisputeSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Invalid dispute data',
        details: validation.error.errors,
      });
      return;
    }

    const filer = req.headers['x-wallet-address'] as string;
    if (!filer) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Wallet connection required',
      });
      return;
    }

    const oracle = getOracle();
    const proposalId = req.params['proposalId'] || '';
    const { reason, evidence, stakeAmount } = validation.data;

    const dispute = await oracle.fileDispute(proposalId, filer, reason, evidence, stakeAmount);

    res.status(201).json({
      success: true,
      data: dispute,
      meta: {
        requestId: req.headers['x-request-id'] || 'unknown',
        timestamp: new Date().toISOString(),
        message: 'Dispute filed successfully. Clawback execution paused pending resolution.',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route POST /compliance/proposals/:proposalId/disputes/:disputeId/resolve
 * @description Resolve a dispute (governance only)
 */
router.post('/proposals/:proposalId/disputes/:disputeId/resolve', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const validation = resolveDisputeSchema.safeParse(req.body);
    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Invalid resolution data',
        details: validation.error.errors,
      });
      return;
    }

    const decider = req.headers['x-wallet-address'] as string;
    if (!decider) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Wallet connection required',
      });
      return;
    }

    // In production, would collect signatures from multiple governance members
    const decidedBy = [decider]; // Simplified for now

    const oracle = getOracle();
    const disputeId = req.params['disputeId'] || '';
    const { decision, rationale, partialAmount } = validation.data;

    // resolveDispute(disputeId, resolvers, decision, rationale, partialAmount?)
    const dispute = await oracle.resolveDispute(
      disputeId,
      decidedBy,
      decision,
      rationale,
      partialAmount
    );

    res.json({
      success: true,
      data: dispute,
      meta: {
        requestId: req.headers['x-request-id'] || 'unknown',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// EXECUTION ENDPOINT
// ============================================================

/**
 * @route POST /compliance/proposals/:proposalId/execute
 * @description Execute an approved clawback (governance only)
 */
router.post('/proposals/:proposalId/execute', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const executor = req.headers['x-wallet-address'] as string;
    if (!executor) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Wallet connection required',
      });
      return;
    }

    // In production, would verify wallet signature
    res.status(501).json({
      success: false,
      error: 'NOT_IMPLEMENTED',
      message: 'Clawback execution requires signed wallet transaction. Use SDK for execution.',
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// TRANSPARENCY ENDPOINTS
// ============================================================

/**
 * @route GET /compliance/transparency
 * @description Get full transparency ledger
 */
router.get('/transparency', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const oracle = getOracle();
    const limit = parseInt(req.query['limit'] as string) || 100;
    const offset = parseInt(req.query['offset'] as string) || 0;

    const ledger = await oracle.getTransparencyLedger();
    const paginatedLedger = ledger.slice(offset, offset + limit);

    res.json({
      success: true,
      data: {
        entries: paginatedLedger,
        total: ledger.length,
        limit,
        offset,
      },
      meta: {
        requestId: req.headers['x-request-id'] || 'unknown',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /compliance/transparency/:proposalId
 * @description Get transparency ledger for a specific proposal
 */
router.get('/transparency/:proposalId', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const oracle = getOracle();
    const proposalId = req.params['proposalId'] || '';

    const history = await oracle.getProposalHistory(proposalId);

    res.json({
      success: true,
      data: {
        proposalId,
        entries: history,
        count: history.length,
      },
      meta: {
        requestId: req.headers['x-request-id'] || 'unknown',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// GOVERNANCE STATS ENDPOINT
// ============================================================

/**
 * @route GET /compliance/stats
 * @description Get governance statistics (public transparency)
 */
router.get('/stats', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const oracle = getOracle();
    const stats = await oracle.getGovernanceStats();

    res.json({
      success: true,
      data: stats,
      meta: {
        requestId: req.headers['x-request-id'] || 'unknown',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @route GET /compliance/config
 * @description Get oracle configuration (public transparency)
 */
router.get('/config', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const oracle = getOracle();
    const config = oracle.getOracleConfig();

    res.json({
      success: true,
      data: {
        ...config,
        description: 'Compliance Oracle Configuration',
        features: [
          '24-hour public comment period before voting',
          'Multi-signature governance voting',
          'Dispute resolution with stake requirements',
          'Full transparency ledger',
          'Cryptographic verification of all actions',
        ],
      },
      meta: {
        requestId: req.headers['x-request-id'] || 'unknown',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    next(error);
  }
});

export { router as complianceRoutes };
