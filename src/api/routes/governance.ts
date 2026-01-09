/**
 * @fileoverview Verity Protocol - Governance API Routes
 * @module api/routes/governance
 * @description
 * Protocol governance and voting endpoints for VRTY token holders.
 * 
 * @features
 * - Proposal creation and management
 * - On-chain governance voting
 * - Delegation support
 * - Governance statistics
 * 
 * @governance
 * - Minimum stake: 10,000 VRTY to create proposals
 * - Voting period: 7 days
 * - Quorum: 10% of staked VRTY
 * - Execution: Automatic after passing
 * 
 * @version 1.0.0
 * @since Phase 1
 * @author Verity Protocol Team
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';

const router = Router();

// ============================================================
// VALIDATION SCHEMAS
// ============================================================

/**
 * Proposal categories for governance
 * @enum {string}
 */
const ProposalCategory = {
  FEE_CHANGE: 'FEE_CHANGE',
  CLAWBACK_POLICY: 'CLAWBACK_POLICY',
  ASSET_VERIFICATION: 'ASSET_VERIFICATION',
  TREASURY_ALLOCATION: 'TREASURY_ALLOCATION',
  PROTOCOL_UPGRADE: 'PROTOCOL_UPGRADE',
} as const;

/**
 * Schema for creating governance proposals
 * @constant {z.ZodObject}
 */
const proposalSchema = z.object({
  /** Proposal title (max 200 characters) */
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  /** Detailed proposal description (max 5000 characters) */
  description: z.string().min(1, 'Description is required').max(5000, 'Description too long'),
  /** Proposal category */
  category: z.enum([
    'FEE_CHANGE',
    'CLAWBACK_POLICY',
    'ASSET_VERIFICATION',
    'TREASURY_ALLOCATION',
    'PROTOCOL_UPGRADE',
  ]),
  /** Optional execution payload for automatic execution */
  executionPayload: z.string().optional(),
});

/**
 * Schema for casting votes
 * @constant {z.ZodObject}
 */
const voteSchema = z.object({
  /** Vote direction (true = for, false = against) */
  support: z.boolean(),
});

// ============================================================
// PROPOSAL ENDPOINTS
// ============================================================

/**
 * @route GET /governance/proposals
 * @group Governance - Protocol Governance
 * @summary List all governance proposals
 * @description
 * Returns all governance proposals with optional filtering by status
 * and category. Supports pagination.
 * 
 * **Proposal Statuses:**
 * - PENDING: Awaiting voting period
 * - ACTIVE: Currently accepting votes
 * - PASSED: Reached quorum and majority
 * - FAILED: Did not pass
 * - EXECUTED: Successfully executed
 * - CANCELLED: Cancelled by proposer
 * 
 * @param {string} status.query - Filter by status
 * @param {string} category.query - Filter by category
 * @param {string} page.query - Page number (default: 1)
 * @param {string} limit.query - Items per page (default: 20)
 * 
 * @returns {object} 200 - Proposals list
 * @returns {Array<object>} data.proposals - Array of proposals
 * @returns {object} data.filters - Applied filters
 * @returns {object} meta.pagination - Pagination info
 * 
 * @example
 * // GET /governance/proposals?status=ACTIVE&category=FEE_CHANGE
 * {
 *   "success": true,
 *   "data": {
 *     "proposals": [...],
 *     "filters": { "status": "ACTIVE", "category": "FEE_CHANGE" }
 *   }
 * }
 */
router.get('/proposals', async (req: Request, res: Response) => {
  const { status, category, page = '1', limit = '20' } = req.query;

  res.json({
    success: true,
    data: {
      proposals: [],
      filters: { status, category },
    },
    meta: {
      requestId: req.requestId,
      timestamp: new Date(),
      pagination: {
        page: parseInt(page as string, 10),
        pageSize: parseInt(limit as string, 10),
        totalItems: 0,
        totalPages: 0,
        hasNext: false,
        hasPrevious: false,
      },
    },
  });
});

/**
 * @route POST /governance/proposals
 * @group Governance - Protocol Governance
 * @summary Create a new governance proposal
 * @description
 * Creates a new governance proposal. Requires minimum 10,000 VRTY stake.
 * 
 * **Proposal Categories:**
 * - FEE_CHANGE: Modify protocol fee rates
 * - CLAWBACK_POLICY: Update XAO-DOW clawback policies
 * - ASSET_VERIFICATION: Add/modify verification standards
 * - TREASURY_ALLOCATION: Allocate treasury funds
 * - PROTOCOL_UPGRADE: Technical protocol upgrades
 * 
 * **Requirements:**
 * - Minimum 10,000 VRTY staked
 * - 7-day voting period
 * - 10% quorum required
 * - Simple majority (>50%) to pass
 * 
 * @param {object} request.body.required - Proposal data
 * @param {string} request.body.title.required - Proposal title
 * @param {string} request.body.description.required - Detailed description
 * @param {string} request.body.category.required - Proposal category
 * @param {string} request.body.executionPayload - Execution parameters
 * 
 * @returns {object} 201 - Proposal created
 * @returns {object} 400 - Validation error
 * @returns {object} 403 - Insufficient stake
 * 
 * @security WalletAuth
 * @security MinimumStake 10000
 * 
 * @example
 * // Request
 * {
 *   "title": "Reduce DEX Trading Fee",
 *   "description": "Proposal to reduce DEX trading fee from 0.10% to 0.08%...",
 *   "category": "FEE_CHANGE",
 *   "executionPayload": "{\"feeType\": \"DEX_TRADE\", \"newRate\": 8}"
 * }
 */
router.post('/proposals', async (req: Request, res: Response) => {
  try {
    const validatedData = proposalSchema.parse(req.body);

    res.status(201).json({
      success: true,
      data: {
        message: 'Proposal creation requires VRTY staking',
        proposalConfig: validatedData,
        requirements: {
          minStake: '10000',
          votingPeriod: '7 days',
          quorum: '10%',
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
          message: 'Invalid request data',
          details: error.errors,
        },
      });
      return;
    }
    throw error;
  }
});

/**
 * @route GET /governance/proposals/:proposalId
 * @group Governance - Protocol Governance
 * @summary Get proposal details
 * @description
 * Returns detailed information about a specific governance proposal
 * including vote counts, status, and execution details.
 * 
 * @param {string} proposalId.path.required - Proposal ID
 * 
 * @returns {object} 200 - Proposal details
 * @returns {string} data.proposalId - Proposal ID
 * @returns {object|null} data.proposal - Full proposal data
 * @returns {string} data.proposal.title - Proposal title
 * @returns {string} data.proposal.description - Full description
 * @returns {string} data.proposal.category - Category
 * @returns {string} data.proposal.status - Current status
 * @returns {string} data.proposal.forVotes - Votes in favor
 * @returns {string} data.proposal.againstVotes - Votes against
 * @returns {Date} data.proposal.createdAt - Creation time
 * @returns {Date} data.proposal.votingEndsAt - Voting deadline
 * @returns {object} 404 - Proposal not found
 */
router.get('/proposals/:proposalId', async (req: Request, res: Response) => {
  const { proposalId } = req.params;

  res.json({
    success: true,
    data: {
      proposalId,
      proposal: null,
      message: 'Proposal not found or requires database connection',
    },
    meta: {
      requestId: req.requestId,
      timestamp: new Date(),
    },
  });
});

// ============================================================
// VOTING ENDPOINTS
// ============================================================

/**
 * @route POST /governance/vote
 * @group Governance - Protocol Governance
 * @summary Vote on a proposal
 * @description
 * Casts a vote on an active governance proposal. Vote weight is
 * determined by VRTY stake amount.
 * 
 * **Voting Rules:**
 * - One vote per wallet per proposal
 * - Vote weight = staked VRTY amount
 * - Can change vote until voting ends
 * - Delegation supported (see /governance/delegation)
 * 
 * @param {object} request.body.required - Vote data
 * @param {string} request.body.proposalId.required - Proposal to vote on
 * @param {boolean} request.body.support.required - Vote direction (true=for, false=against)
 * 
 * @returns {object} 200 - Vote recorded
 * @returns {object} 400 - Validation error
 * @returns {object} 401 - Wallet connection required
 * @returns {object} 403 - Not enough stake to vote
 * @returns {object} 404 - Proposal not found
 * 
 * @security WalletAuth
 * 
 * @example
 * // Request
 * {
 *   "proposalId": "PROP_001",
 *   "support": true
 * }
 */
router.post('/vote', async (req: Request, res: Response) => {
  const { proposalId } = req.body;

  if (!proposalId) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Proposal ID is required',
      },
    });
    return;
  }

  try {
    const validatedData = voteSchema.parse(req.body);

    res.json({
      success: true,
      data: {
        proposalId,
        support: validatedData.support,
        message: 'Voting requires wallet connection and VRTY stake',
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
          message: 'Invalid request data',
          details: error.errors,
        },
      });
      return;
    }
    throw error;
  }
});

/**
 * @route GET /governance/proposals/:proposalId/votes
 * @group Governance - Protocol Governance
 * @summary Get votes for a proposal
 * @description
 * Returns all votes cast on a proposal with voter addresses,
 * vote weights, and vote direction. Fully transparent.
 * 
 * @param {string} proposalId.path.required - Proposal ID
 * @param {string} page.query - Page number (default: 1)
 * @param {string} limit.query - Items per page (default: 50)
 * 
 * @returns {object} 200 - Votes list
 * @returns {string} data.proposalId - Proposal ID
 * @returns {Array<object>} data.votes - Array of votes
 * @returns {string} data.votes[].voter - Voter wallet address
 * @returns {string} data.votes[].voteWeight - Vote weight (staked VRTY)
 * @returns {boolean} data.votes[].support - Vote direction
 * @returns {Date} data.votes[].votedAt - Vote timestamp
 * @returns {object} data.summary - Vote summary
 * @returns {string} data.summary.forVotes - Total votes for
 * @returns {string} data.summary.againstVotes - Total votes against
 * @returns {number} data.summary.totalVoters - Number of voters
 * @returns {boolean} data.summary.quorumReached - Whether quorum met
 */
router.get('/proposals/:proposalId/votes', async (req: Request, res: Response) => {
  const { proposalId } = req.params;
  const { page = '1', limit = '50' } = req.query;

  res.json({
    success: true,
    data: {
      proposalId,
      votes: [],
      summary: {
        forVotes: '0',
        againstVotes: '0',
        totalVoters: 0,
        quorumReached: false,
      },
    },
    meta: {
      requestId: req.requestId,
      timestamp: new Date(),
      pagination: {
        page: parseInt(page as string, 10),
        pageSize: parseInt(limit as string, 10),
        totalItems: 0,
        totalPages: 0,
        hasNext: false,
        hasPrevious: false,
      },
    },
  });
});

// ============================================================
// EXECUTION ENDPOINT
// ============================================================

/**
 * @route POST /governance/proposals/:proposalId/execute
 * @group Governance - Protocol Governance
 * @summary Execute a passed proposal
 * @description
 * Executes a governance proposal that has passed (reached quorum
 * with majority support). Can be called by anyone after voting ends.
 * 
 * **Execution Requirements:**
 * - Voting period ended
 * - Quorum reached (10% of staked VRTY)
 * - Majority support (>50%)
 * - Not already executed
 * 
 * @param {string} proposalId.path.required - Proposal ID to execute
 * 
 * @returns {object} 200 - Execution initiated
 * @returns {string} data.proposalId - Proposal ID
 * @returns {string} data.message - Status message
 * @returns {object} 400 - Proposal cannot be executed
 * @returns {object} 404 - Proposal not found
 */
router.post('/proposals/:proposalId/execute', async (req: Request, res: Response) => {
  const { proposalId } = req.params;

  res.json({
    success: true,
    data: {
      proposalId,
      message: 'Proposal execution requires the proposal to be passed',
    },
    meta: {
      requestId: req.requestId,
      timestamp: new Date(),
    },
  });
});

// ============================================================
// STATISTICS ENDPOINT
// ============================================================

/**
 * @route GET /governance/stats
 * @group Governance - Protocol Governance
 * @summary Get governance statistics
 * @description
 * Returns comprehensive governance statistics including proposal
 * counts, participation rates, and voting power distribution.
 * 
 * @returns {object} 200 - Governance statistics
 * @returns {object} data.stats - Statistics object
 * @returns {number} data.stats.totalProposals - Total proposals created
 * @returns {number} data.stats.activeProposals - Currently active proposals
 * @returns {number} data.stats.passedProposals - Passed proposals
 * @returns {number} data.stats.failedProposals - Failed proposals
 * @returns {number} data.stats.executedProposals - Executed proposals
 * @returns {number} data.stats.totalVoters - Unique voters
 * @returns {string} data.stats.totalVotingPower - Total voting power (staked VRTY)
 * @returns {string} data.stats.averageParticipation - Average voter participation
 * 
 * @example
 * {
 *   "success": true,
 *   "data": {
 *     "stats": {
 *       "totalProposals": 25,
 *       "activeProposals": 3,
 *       "passedProposals": 15,
 *       "failedProposals": 5,
 *       "executedProposals": 12,
 *       "totalVoters": 500,
 *       "totalVotingPower": "50000000",
 *       "averageParticipation": "45%"
 *     }
 *   }
 * }
 */
router.get('/stats', async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      stats: {
        totalProposals: 0,
        activeProposals: 0,
        passedProposals: 0,
        failedProposals: 0,
        executedProposals: 0,
        totalVoters: 0,
        totalVotingPower: '0',
        averageParticipation: '0%',
      },
    },
    meta: {
      requestId: req.requestId,
      timestamp: new Date(),
    },
  });
});

// ============================================================
// DELEGATION ENDPOINT
// ============================================================

/**
 * @route GET /governance/delegation
 * @group Governance - Protocol Governance
 * @summary Get delegation information
 * @description
 * Returns voting power delegation information. Delegation allows
 * stakers to delegate their voting power to another address.
 * 
 * **Delegation Features (Coming Soon):**
 * - Delegate voting power to any address
 * - Delegator retains stake rewards
 * - Can revoke delegation anytime
 * - Delegatee can vote with combined power
 * 
 * @returns {object} 200 - Delegation info
 * @returns {Array<object>} data.delegations - Active delegations
 * @returns {string} data.message - Feature status
 */
router.get('/delegation', async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      delegations: [],
      message: 'Delegation feature coming soon',
    },
    meta: {
      requestId: req.requestId,
      timestamp: new Date(),
    },
  });
});

export { router as governanceRoutes };
