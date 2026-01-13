/**
 * Verity Protocol - Proposal Repository
 * 
 * Database operations for governance proposals.
 */

import { prisma } from '../client.js';
import { 
  Prisma, 
  Proposal, 
  ProposalStatus, 
  ProposalCategory,
  Vote,
  VoteType 
} from '@prisma/client';
import { logger } from '../../utils/logger.js';

// Governance configuration
const VOTING_PERIOD_DAYS = 7;
const QUORUM_PERCENTAGE = 10; // 10% of total staked
const MIN_STAKE_TO_PROPOSE = 10000; // 10,000 VRTY

export type ProposalWithVotes = Proposal & {
  votes: Vote[];
  _count: { votes: number };
};

/**
 * Proposal Repository
 */
export const proposalRepository = {
  /**
   * Create a new proposal
   */
  async create(data: {
    proposerId: string;
    proposerWallet: string;
    title: string;
    description: string;
    category: ProposalCategory;
    executionPayload?: string;
  }): Promise<Proposal> {
    const now = new Date();
    const votingStartsAt = now;
    const votingEndsAt = new Date(now.getTime() + VOTING_PERIOD_DAYS * 24 * 60 * 60 * 1000);

    const proposal = await prisma.proposal.create({
      data: {
        proposerId: data.proposerId,
        proposerWallet: data.proposerWallet,
        title: data.title,
        description: data.description,
        category: data.category,
        executionPayload: data.executionPayload,
        status: 'ACTIVE',
        votingStartsAt,
        votingEndsAt,
      },
    });

    logger.info('Proposal created', { 
      id: proposal.id, 
      title: proposal.title,
      category: proposal.category 
    });

    return proposal;
  },

  /**
   * Get proposal by ID
   */
  async getById(id: string): Promise<ProposalWithVotes | null> {
    return prisma.proposal.findUnique({
      where: { id },
      include: {
        votes: true,
        _count: { select: { votes: true } },
      },
    });
  },

  /**
   * Get proposals with filtering
   */
  async getMany(options: {
    status?: ProposalStatus;
    category?: ProposalCategory;
    proposerId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ proposals: Proposal[]; total: number }> {
    const { status, category, proposerId, page = 1, limit = 20 } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.ProposalWhereInput = {};
    if (status) where.status = status;
    if (category) where.category = category;
    if (proposerId) where.proposerId = proposerId;

    const [proposals, total] = await Promise.all([
      prisma.proposal.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { votes: true } },
        },
      }),
      prisma.proposal.count({ where }),
    ]);

    return { proposals, total };
  },

  /**
   * Get active proposals
   */
  async getActive(): Promise<Proposal[]> {
    return prisma.proposal.findMany({
      where: {
        status: 'ACTIVE',
        votingEndsAt: { gt: new Date() },
      },
      orderBy: { votingEndsAt: 'asc' },
    });
  },

  /**
   * Cast a vote
   */
  async vote(data: {
    proposalId: string;
    voterId: string;
    voterWallet: string;
    support: VoteType;
    voteWeight: number;
    reason?: string;
    txHash?: string;
  }): Promise<Vote> {
    // Check if proposal exists and is active
    const proposal = await prisma.proposal.findUnique({
      where: { id: data.proposalId },
    });

    if (!proposal) {
      throw new Error('Proposal not found');
    }

    if (proposal.status !== 'ACTIVE') {
      throw new Error('Proposal is not active');
    }

    if (new Date() > proposal.votingEndsAt) {
      throw new Error('Voting period has ended');
    }

    // Create vote and update proposal counts in transaction
    const [vote] = await prisma.$transaction([
      prisma.vote.create({
        data: {
          proposalId: data.proposalId,
          voterId: data.voterId,
          voterWallet: data.voterWallet,
          support: data.support,
          voteWeight: data.voteWeight,
          reason: data.reason,
          txHash: data.txHash,
        },
      }),
      prisma.proposal.update({
        where: { id: data.proposalId },
        data: {
          forVotes: data.support === 'FOR' 
            ? { increment: data.voteWeight } 
            : undefined,
          againstVotes: data.support === 'AGAINST' 
            ? { increment: data.voteWeight } 
            : undefined,
          abstainVotes: data.support === 'ABSTAIN' 
            ? { increment: data.voteWeight } 
            : undefined,
        },
      }),
    ]);

    logger.info('Vote cast', {
      proposalId: data.proposalId,
      voter: data.voterWallet,
      support: data.support,
      weight: data.voteWeight,
    });

    return vote;
  },

  /**
   * Get votes for a proposal
   */
  async getVotes(proposalId: string, options?: {
    page?: number;
    limit?: number;
  }): Promise<{ votes: Vote[]; total: number }> {
    const { page = 1, limit = 50 } = options || {};
    const skip = (page - 1) * limit;

    const [votes, total] = await Promise.all([
      prisma.vote.findMany({
        where: { proposalId },
        skip,
        take: limit,
        orderBy: { votedAt: 'desc' },
      }),
      prisma.vote.count({ where: { proposalId } }),
    ]);

    return { votes, total };
  },

  /**
   * Check if user has voted
   */
  async hasVoted(proposalId: string, voterId: string): Promise<boolean> {
    const vote = await prisma.vote.findUnique({
      where: {
        proposalId_voterId: { proposalId, voterId },
      },
    });
    return !!vote;
  },

  /**
   * Update proposal status based on votes and time
   */
  async updateStatus(proposalId: string, totalStaked: number): Promise<Proposal> {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
    });

    if (!proposal) {
      throw new Error('Proposal not found');
    }

    const now = new Date();
    const votingEnded = now > proposal.votingEndsAt;
    
    // Calculate totals
    const forVotes = Number(proposal.forVotes);
    const againstVotes = Number(proposal.againstVotes);
    const totalVotes = forVotes + againstVotes + Number(proposal.abstainVotes);
    
    // Check quorum (10% of total staked)
    const quorumRequired = totalStaked * (QUORUM_PERCENTAGE / 100);
    const quorumReached = totalVotes >= quorumRequired;

    let newStatus: ProposalStatus = proposal.status;

    if (votingEnded && proposal.status === 'ACTIVE') {
      if (!quorumReached) {
        newStatus = 'EXPIRED';
      } else if (forVotes > againstVotes) {
        newStatus = 'PASSED';
      } else {
        newStatus = 'FAILED';
      }
    }

    return prisma.proposal.update({
      where: { id: proposalId },
      data: {
        status: newStatus,
        quorumReached,
      },
    });
  },

  /**
   * Execute a passed proposal
   */
  async execute(proposalId: string, txHash?: string): Promise<Proposal> {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
    });

    if (!proposal) {
      throw new Error('Proposal not found');
    }

    if (proposal.status !== 'PASSED') {
      throw new Error('Proposal has not passed');
    }

    return prisma.proposal.update({
      where: { id: proposalId },
      data: {
        status: 'EXECUTED',
        executedAt: new Date(),
        executionTxHash: txHash,
      },
    });
  },

  /**
   * Cancel a proposal
   */
  async cancel(proposalId: string, reason: string): Promise<Proposal> {
    return prisma.proposal.update({
      where: { id: proposalId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelReason: reason,
      },
    });
  },

  /**
   * Get governance statistics
   */
  async getStats(): Promise<{
    totalProposals: number;
    activeProposals: number;
    passedProposals: number;
    failedProposals: number;
    executedProposals: number;
    totalVotes: number;
    uniqueVoters: number;
  }> {
    const [
      totalProposals,
      activeProposals,
      passedProposals,
      failedProposals,
      executedProposals,
      totalVotes,
      uniqueVoters,
    ] = await Promise.all([
      prisma.proposal.count(),
      prisma.proposal.count({ where: { status: 'ACTIVE' } }),
      prisma.proposal.count({ where: { status: 'PASSED' } }),
      prisma.proposal.count({ where: { status: 'FAILED' } }),
      prisma.proposal.count({ where: { status: 'EXECUTED' } }),
      prisma.vote.count(),
      prisma.vote.groupBy({ by: ['voterId'] }).then(r => r.length),
    ]);

    return {
      totalProposals,
      activeProposals,
      passedProposals,
      failedProposals,
      executedProposals,
      totalVotes,
      uniqueVoters,
    };
  },
};

export default proposalRepository;
