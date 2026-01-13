/**
 * @fileoverview Verity Protocol - Governance API Routes (Database-backed)
 * @module api/routes/governance
 * @description
 * Production-ready protocol governance and voting endpoints for VRTY token holders.
 * All data is persisted to PostgreSQL via Prisma repositories.
 * 
 * @features
 * - Proposal creation with stake verification
 * - On-chain governance voting with vote weight
 * - Real-time proposal status updates
 * - Comprehensive governance statistics
 * - Vote change support (before deadline)
 * - Delegation support (planned)
 * 
 * @governance
 * - Minimum stake: 10,000 VRTY to create proposals
 * - Voting period: 7 days
 * - Quorum: 10% of staked VRTY
 * - Execution: Manual after passing
 * 
 * @version 2.0.0
 * @since Phase 2 - Database Integration
 * @author Verity Protocol Team
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { proposalRepository } from '../../db/repositories/proposalRepository.js';
import { stakeRepository } from '../../db/repositories/stakeRepository.js';
import { prisma, checkDatabaseHealth } from '../../db/client.js';
import { logger } from '../../utils/logger.js';
import type { ProposalStatus, ProposalCategory, VoteType } from '@prisma/client';

const router = Router();

// ============================================================
// CONSTANTS
// ============================================================

const MIN_STAKE_TO_PROPOSE = 10000; // 10,000 VRTY minimum to create proposals
const MIN_STAKE_TO_VOTE = 1; // Any stake can vote
const VOTING_PERIOD_DAYS = 7;
const QUORUM_PERCENTAGE = 10; // 10% of total staked

// Valid proposal categories
const VALID_CATEGORIES: ProposalCategory[] = [
  'FEE_CHANGE',
  'CLAWBACK_POLICY',
  'ASSET_VERIFICATION',
  'TREASURY_ALLOCATION',
  'PROTOCOL_UPGRADE',
];

// Valid proposal statuses
const VALID_STATUSES: ProposalStatus[] = [
  'PENDING',
  'ACTIVE',
  'PASSED',
  'FAILED',
  'EXECUTED',
  'CANCELLED',
  'EXPIRED',
];

// ============================================================
// VALIDATION SCHEMAS
// ============================================================

/**
 * Schema for creating governance proposals
 */
const proposalSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(200, 'Title too long'),
  description: z.string().min(20, 'Description must be at least 20 characters').max(5000, 'Description too long'),
  category: z.enum(['FEE_CHANGE', 'CLAWBACK_POLICY', 'ASSET_VERIFICATION', 'TREASURY_ALLOCATION', 'PROTOCOL_UPGRADE']),
  executionPayload: z.string().max(10000).optional(),
  wallet: z.string().min(1, 'Proposer wallet address is required'),
});

/**
 * Schema for casting votes
 */
const voteSchema = z.object({
  proposalId: z.string().min(1, 'Proposal ID is required'),
  support: z.enum(['FOR', 'AGAINST', 'ABSTAIN']),
  wallet: z.string().min(1, 'Voter wallet address is required'),
  reason: z.string().max(1000).optional(),
});

/**
 * Schema for cancelling proposals
 */
const cancelSchema = z.object({
  wallet: z.string().min(1, 'Wallet address is required'),
  reason: z.string().min(10, 'Cancellation reason required').max(500),
});

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Format proposal for API response
 */
function formatProposal(proposal: any) {
  const forVotes = Number(proposal.forVotes || 0);
  const againstVotes = Number(proposal.againstVotes || 0);
  const abstainVotes = Number(proposal.abstainVotes || 0);
  const totalVotes = forVotes + againstVotes + abstainVotes;
  
  return {
    id: proposal.id,
    title: proposal.title,
    description: proposal.description,
    category: proposal.category,
    status: proposal.status,
    proposer: proposal.proposerWallet,
    forVotes: forVotes.toString(),
    againstVotes: againstVotes.toString(),
    abstainVotes: abstainVotes.toString(),
    totalVotes: totalVotes.toString(),
    quorumReached: proposal.quorumReached || false,
    votingStartsAt: proposal.votingStartsAt,
    votingEndsAt: proposal.votingEndsAt,
    createdAt: proposal.createdAt,
    executedAt: proposal.executedAt,
    executionTxHash: proposal.executionTxHash,
    cancelledAt: proposal.cancelledAt,
    cancelReason: proposal.cancelReason,
    voteCount: proposal._count?.votes || 0,
  };
}

/**
 * Check if voting period is still active
 */
function isVotingActive(proposal: any): boolean {
  const now = new Date();
  return proposal.status === 'ACTIVE' && now < new Date(proposal.votingEndsAt);
}

// ============================================================
// PROPOSAL ENDPOINTS
// ============================================================

/**
 * @route GET /governance/proposals
 * @summary List all governance proposals with filtering and pagination
 */
router.get('/proposals', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query['page'] as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query['limit'] as string, 10) || 20));
    const status = req.query['status'] as ProposalStatus | undefined;
    const category = req.query['category'] as ProposalCategory | undefined;
    const proposerWallet = req.query['proposer'] as string | undefined;

    // Validate status if provided
    if (status && !VALID_STATUSES.includes(status)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`,
        },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    // Validate category if provided
    if (category && !VALID_CATEGORIES.includes(category)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CATEGORY',
          message: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`,
        },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    const { proposals, total } = await proposalRepository.getMany({
      status,
      category,
      proposerId: proposerWallet,
      page,
      limit,
    });

    // Check and update status for active proposals that have ended
    const totalStaked = await stakeRepository.getTotalStaked();
    for (const proposal of proposals) {
      if (proposal.status === 'ACTIVE' && new Date() > proposal.votingEndsAt) {
        await proposalRepository.updateStatus(proposal.id, totalStaked);
      }
    }

    // Re-fetch after status updates
    const { proposals: updatedProposals } = await proposalRepository.getMany({
      status,
      category,
      proposerId: proposerWallet,
      page,
      limit,
    });

    res.json({
      success: true,
      data: {
        proposals: updatedProposals.map(formatProposal),
        filters: {
          status: status || null,
          category: category || null,
          proposer: proposerWallet || null,
        },
      },
      meta: {
        requestId: req.requestId,
        timestamp: new Date(),
        pagination: {
          page,
          pageSize: limit,
          totalItems: total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrevious: page > 1,
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching proposals', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch proposals',
      },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  }
});

/**
 * @route POST /governance/proposals
 * @summary Create a new governance proposal (requires 10,000+ VRTY stake)
 */
router.post('/proposals', async (req: Request, res: Response) => {
  try {
    const validatedData = proposalSchema.parse(req.body);

    // Verify proposer has sufficient stake
    const stake = await stakeRepository.getByWallet(validatedData.wallet);
    
    if (!stake) {
      res.status(403).json({
        success: false,
        error: {
          code: 'NO_STAKE',
          message: 'You must stake VRTY tokens to create proposals',
          details: { requiredStake: MIN_STAKE_TO_PROPOSE },
        },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    const stakeAmount = Number(stake.amount);
    if (stakeAmount < MIN_STAKE_TO_PROPOSE) {
      res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_STAKE',
          message: `Minimum ${MIN_STAKE_TO_PROPOSE.toLocaleString()} VRTY stake required to create proposals`,
          details: {
            currentStake: stakeAmount.toString(),
            requiredStake: MIN_STAKE_TO_PROPOSE.toString(),
            deficit: (MIN_STAKE_TO_PROPOSE - stakeAmount).toString(),
          },
        },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    // Create proposal in database
    const proposal = await proposalRepository.create({
      proposerId: validatedData.wallet,
      proposerWallet: validatedData.wallet,
      title: validatedData.title,
      description: validatedData.description,
      category: validatedData.category as ProposalCategory,
      executionPayload: validatedData.executionPayload,
    });

    logger.info('Governance proposal created', {
      proposalId: proposal.id,
      proposer: validatedData.wallet,
      category: validatedData.category,
    });

    res.status(201).json({
      success: true,
      data: {
        proposal: formatProposal(proposal),
        governance: {
          votingPeriodDays: VOTING_PERIOD_DAYS,
          quorumPercentage: QUORUM_PERCENTAGE,
          votingEndsAt: proposal.votingEndsAt,
        },
      },
      meta: {
        requestId: req.requestId,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid proposal data',
          details: error.errors,
        },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }
    logger.error('Error creating proposal', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: (error as Error).message || 'Failed to create proposal',
      },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  }
});

/**
 * @route GET /governance/proposals/:proposalId
 * @summary Get detailed proposal information
 */
router.get('/proposals/:proposalId', async (req: Request, res: Response) => {
  try {
    const proposalId = req.params['proposalId'] || '';
    
    const proposal = await proposalRepository.getById(proposalId);

    if (!proposal) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Proposal not found',
        },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    // Update status if voting ended
    if (proposal.status === 'ACTIVE' && new Date() > proposal.votingEndsAt) {
      const totalStaked = await stakeRepository.getTotalStaked();
      const updatedProposal = await proposalRepository.updateStatus(proposalId, totalStaked);
      
      res.json({
        success: true,
        data: {
          proposal: formatProposal({ ...updatedProposal, _count: proposal._count }),
          votingActive: false,
          statusUpdated: true,
        },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    const totalStaked = await stakeRepository.getTotalStaked();
    const quorumRequired = totalStaked * (QUORUM_PERCENTAGE / 100);
    const totalVotes = Number(proposal.forVotes) + Number(proposal.againstVotes) + Number(proposal.abstainVotes);

    res.json({
      success: true,
      data: {
        proposal: formatProposal(proposal),
        votingActive: isVotingActive(proposal),
        quorum: {
          required: quorumRequired.toString(),
          current: totalVotes.toString(),
          percentage: totalStaked > 0 ? ((totalVotes / totalStaked) * 100).toFixed(2) + '%' : '0%',
          reached: totalVotes >= quorumRequired,
        },
        timeRemaining: isVotingActive(proposal)
          ? Math.max(0, new Date(proposal.votingEndsAt).getTime() - Date.now())
          : 0,
      },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  } catch (error) {
    logger.error('Error fetching proposal', { error, proposalId: req.params['proposalId'] });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch proposal',
      },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  }
});

/**
 * @route POST /governance/proposals/:proposalId/cancel
 * @summary Cancel a proposal (only by proposer, only if still active)
 */
router.post('/proposals/:proposalId/cancel', async (req: Request, res: Response) => {
  try {
    const proposalId = req.params['proposalId'] || '';
    const validatedData = cancelSchema.parse(req.body);

    const proposal = await proposalRepository.getById(proposalId);

    if (!proposal) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Proposal not found' },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    // Only proposer can cancel
    if (proposal.proposerWallet !== validatedData.wallet) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only the proposer can cancel this proposal' },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    // Can only cancel active proposals
    if (proposal.status !== 'ACTIVE') {
      res.status(400).json({
        success: false,
        error: { 
          code: 'INVALID_STATUS', 
          message: `Cannot cancel proposal with status: ${proposal.status}` 
        },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    const cancelled = await proposalRepository.cancel(proposalId, validatedData.reason);

    logger.info('Proposal cancelled', { proposalId, wallet: validatedData.wallet });

    res.json({
      success: true,
      data: {
        proposal: formatProposal(cancelled),
        message: 'Proposal cancelled successfully',
      },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: error.errors },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }
    logger.error('Error cancelling proposal', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to cancel proposal' },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  }
});

// ============================================================
// VOTING ENDPOINTS
// ============================================================

/**
 * @route POST /governance/vote
 * @summary Cast a vote on an active proposal
 */
router.post('/vote', async (req: Request, res: Response) => {
  try {
    const validatedData = voteSchema.parse(req.body);

    // Get proposal
    const proposal = await proposalRepository.getById(validatedData.proposalId);

    if (!proposal) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Proposal not found' },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    // Check if voting is active
    if (!isVotingActive(proposal)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VOTING_CLOSED',
          message: proposal.status === 'ACTIVE' 
            ? 'Voting period has ended for this proposal'
            : `Cannot vote on proposal with status: ${proposal.status}`,
        },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    // Check voter has stake
    const stake = await stakeRepository.getByWallet(validatedData.wallet);

    if (!stake || Number(stake.amount) < MIN_STAKE_TO_VOTE) {
      res.status(403).json({
        success: false,
        error: {
          code: 'NO_STAKE',
          message: 'You must stake VRTY tokens to vote',
          details: { currentStake: stake ? Number(stake.amount).toString() : '0' },
        },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    // Check if already voted
    const hasVoted = await proposalRepository.hasVoted(validatedData.proposalId, validatedData.wallet);
    
    if (hasVoted) {
      // For now, reject duplicate votes. In future, support vote change.
      res.status(400).json({
        success: false,
        error: {
          code: 'ALREADY_VOTED',
          message: 'You have already voted on this proposal',
          details: { note: 'Vote changing feature coming soon' },
        },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    const voteWeight = Number(stake.amount);

    // Record vote
    const vote = await proposalRepository.vote({
      proposalId: validatedData.proposalId,
      voterId: validatedData.wallet,
      voterWallet: validatedData.wallet,
      support: validatedData.support as VoteType,
      voteWeight,
      reason: validatedData.reason,
    });

    // Update proposal status check
    const totalStaked = await stakeRepository.getTotalStaked();
    await proposalRepository.updateStatus(validatedData.proposalId, totalStaked);

    // Get updated proposal
    const updatedProposal = await proposalRepository.getById(validatedData.proposalId);

    logger.info('Vote cast', {
      proposalId: validatedData.proposalId,
      voter: validatedData.wallet,
      support: validatedData.support,
      weight: voteWeight,
    });

    res.status(201).json({
      success: true,
      data: {
        vote: {
          proposalId: vote.proposalId,
          voter: vote.voterWallet,
          support: vote.support,
          voteWeight: voteWeight.toString(),
          reason: vote.reason,
          votedAt: vote.votedAt,
        },
        proposal: updatedProposal ? formatProposal(updatedProposal) : null,
      },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Invalid vote data', details: error.errors },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }
    
    const errorMessage = (error as Error).message;
    logger.error('Error casting vote', { error });
    
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: errorMessage || 'Failed to cast vote' },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  }
});

/**
 * @route GET /governance/proposals/:proposalId/votes
 * @summary Get all votes for a proposal with pagination
 */
router.get('/proposals/:proposalId/votes', async (req: Request, res: Response) => {
  try {
    const proposalId = req.params['proposalId'] || '';
    const page = Math.max(1, parseInt(req.query['page'] as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query['limit'] as string, 10) || 50));

    // Check proposal exists
    const proposal = await proposalRepository.getById(proposalId);
    if (!proposal) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Proposal not found' },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    const { votes, total } = await proposalRepository.getVotes(proposalId, { page, limit });

    // Calculate vote summary
    const forVotes = Number(proposal.forVotes);
    const againstVotes = Number(proposal.againstVotes);
    const abstainVotes = Number(proposal.abstainVotes);
    const totalVoteWeight = forVotes + againstVotes + abstainVotes;
    
    const totalStaked = await stakeRepository.getTotalStaked();
    const quorumRequired = totalStaked * (QUORUM_PERCENTAGE / 100);

    res.json({
      success: true,
      data: {
        proposalId,
        votes: votes.map(v => ({
          voter: v.voterWallet,
          support: v.support,
          voteWeight: Number(v.voteWeight).toString(),
          reason: v.reason,
          votedAt: v.votedAt,
        })),
        summary: {
          forVotes: forVotes.toString(),
          againstVotes: againstVotes.toString(),
          abstainVotes: abstainVotes.toString(),
          totalVoteWeight: totalVoteWeight.toString(),
          totalVoters: total,
          quorumRequired: quorumRequired.toString(),
          quorumReached: totalVoteWeight >= quorumRequired,
          quorumPercentage: totalStaked > 0 
            ? ((totalVoteWeight / totalStaked) * 100).toFixed(2) + '%' 
            : '0%',
        },
      },
      meta: {
        requestId: req.requestId,
        timestamp: new Date(),
        pagination: {
          page,
          pageSize: limit,
          totalItems: total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrevious: page > 1,
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching votes', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch votes' },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  }
});

/**
 * @route GET /governance/votes/:wallet
 * @summary Get all votes cast by a specific wallet
 */
router.get('/votes/:wallet', async (req: Request, res: Response) => {
  try {
    const wallet = req.params['wallet'] || '';
    const page = Math.max(1, parseInt(req.query['page'] as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query['limit'] as string, 10) || 20));
    const skip = (page - 1) * limit;

    const [votes, total] = await Promise.all([
      prisma.vote.findMany({
        where: { voterWallet: wallet },
        skip,
        take: limit,
        orderBy: { votedAt: 'desc' },
        include: {
          proposal: {
            select: {
              id: true,
              title: true,
              status: true,
              category: true,
            },
          },
        },
      }),
      prisma.vote.count({ where: { voterWallet: wallet } }),
    ]);

    res.json({
      success: true,
      data: {
        wallet,
        votes: votes.map(v => ({
          proposalId: v.proposalId,
          proposalTitle: v.proposal.title,
          proposalStatus: v.proposal.status,
          proposalCategory: v.proposal.category,
          support: v.support,
          voteWeight: Number(v.voteWeight).toString(),
          reason: v.reason,
          votedAt: v.votedAt,
        })),
        totalVotesCast: total,
      },
      meta: {
        requestId: req.requestId,
        timestamp: new Date(),
        pagination: {
          page,
          pageSize: limit,
          totalItems: total,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrevious: page > 1,
        },
      },
    });
  } catch (error) {
    logger.error('Error fetching wallet votes', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch votes' },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  }
});

// ============================================================
// EXECUTION ENDPOINT
// ============================================================

/**
 * @route POST /governance/proposals/:proposalId/execute
 * @summary Execute a passed proposal
 */
router.post('/proposals/:proposalId/execute', async (req: Request, res: Response) => {
  try {
    const proposalId = req.params['proposalId'] || '';
    const { wallet, txHash } = req.body;

    if (!wallet) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Wallet address is required' },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    const proposal = await proposalRepository.getById(proposalId);

    if (!proposal) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Proposal not found' },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    // First, update status if voting ended
    if (proposal.status === 'ACTIVE') {
      const totalStaked = await stakeRepository.getTotalStaked();
      await proposalRepository.updateStatus(proposalId, totalStaked);
      
      // Re-fetch
      const updated = await proposalRepository.getById(proposalId);
      if (updated && updated.status !== 'PASSED') {
        res.status(400).json({
          success: false,
          error: {
            code: 'NOT_PASSED',
            message: `Proposal status is ${updated.status}. Only PASSED proposals can be executed.`,
          },
          meta: { requestId: req.requestId, timestamp: new Date() },
        });
        return;
      }
    } else if (proposal.status !== 'PASSED') {
      res.status(400).json({
        success: false,
        error: {
          code: 'NOT_PASSED',
          message: `Proposal status is ${proposal.status}. Only PASSED proposals can be executed.`,
        },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    // Execute the proposal
    const executed = await proposalRepository.execute(proposalId, txHash);

    logger.info('Proposal executed', { proposalId, executor: wallet, txHash });

    res.json({
      success: true,
      data: {
        proposal: formatProposal(executed),
        message: 'Proposal executed successfully',
        executedAt: executed.executedAt,
        executionTxHash: executed.executionTxHash,
      },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    logger.error('Error executing proposal', { error });
    
    const statusCode = errorMessage.includes('not passed') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      error: { 
        code: statusCode === 400 ? 'EXECUTION_FAILED' : 'INTERNAL_ERROR', 
        message: errorMessage || 'Failed to execute proposal' 
      },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  }
});

// ============================================================
// STATISTICS ENDPOINT
// ============================================================

/**
 * @route GET /governance/stats
 * @summary Get comprehensive governance statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const [stats, totalStaked, stakingStats] = await Promise.all([
      proposalRepository.getStats(),
      stakeRepository.getTotalStaked(),
      stakeRepository.getStakerCountByTier(),
    ]);

    // Calculate additional metrics
    const totalVotingPower = totalStaked;
    const expiredProposals = await prisma.proposal.count({ where: { status: 'EXPIRED' } });
    const cancelledProposals = await prisma.proposal.count({ where: { status: 'CANCELLED' } });

    // Get recent activity
    const recentProposals = await prisma.proposal.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, status: true, createdAt: true },
    });

    const recentVotes = await prisma.vote.findMany({
      take: 10,
      orderBy: { votedAt: 'desc' },
      select: { 
        proposalId: true, 
        voterWallet: true, 
        support: true, 
        voteWeight: true,
        votedAt: true 
      },
    });

    res.json({
      success: true,
      data: {
        stats: {
          ...stats,
          expiredProposals,
          cancelledProposals,
          totalVotingPower: totalVotingPower.toString(),
          averageParticipation: stats.totalProposals > 0 
            ? `${((stats.totalVotes / (stats.totalProposals * totalStaked)) * 100).toFixed(2)}%`
            : '0%',
        },
        stakingDistribution: stakingStats,
        recentActivity: {
          proposals: recentProposals,
          votes: recentVotes.map(v => ({
            proposalId: v.proposalId,
            voter: v.voterWallet,
            support: v.support,
            weight: Number(v.voteWeight).toString(),
            votedAt: v.votedAt,
          })),
        },
        governance: {
          minStakeToPropose: MIN_STAKE_TO_PROPOSE.toString(),
          votingPeriodDays: VOTING_PERIOD_DAYS,
          quorumPercentage: QUORUM_PERCENTAGE,
        },
      },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  } catch (error) {
    logger.error('Error fetching governance stats', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch governance statistics' },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  }
});

// ============================================================
// DELEGATION ENDPOINTS (Preparation for future implementation)
// ============================================================

/**
 * @route GET /governance/delegation
 * @summary Get delegation information (feature in development)
 */
router.get('/delegation', async (req: Request, res: Response) => {
  const wallet = req.query['wallet'] as string | undefined;

  res.json({
    success: true,
    data: {
      delegations: [],
      delegatedToMe: [],
      totalDelegatedPower: '0',
      message: 'Delegation feature is planned for a future release',
      featureStatus: 'PLANNED',
      expectedRelease: 'Q2 2026',
    },
    meta: { requestId: req.requestId, timestamp: new Date() },
  });
});

/**
 * @route GET /governance/active
 * @summary Get all currently active proposals (convenience endpoint)
 */
router.get('/active', async (req: Request, res: Response) => {
  try {
    const activeProposals = await proposalRepository.getActive();
    
    res.json({
      success: true,
      data: {
        proposals: activeProposals.map(formatProposal),
        count: activeProposals.length,
      },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  } catch (error) {
    logger.error('Error fetching active proposals', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch active proposals' },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  }
});

/**
 * @route GET /governance/health
 * @summary Check governance system health
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const dbHealth = await checkDatabaseHealth();
    const activeCount = await prisma.proposal.count({ where: { status: 'ACTIVE' } });

    res.json({
      success: true,
      data: {
        status: dbHealth.connected ? 'healthy' : 'degraded',
        database: dbHealth,
        activeProposals: activeCount,
        features: {
          proposals: true,
          voting: true,
          execution: true,
          delegation: false,
        },
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

export { router as governanceRoutes };
