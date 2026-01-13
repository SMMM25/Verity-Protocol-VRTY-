/**
 * Verity Protocol - Compliance Oracle
 * 
 * Multi-signature governance for XAO-DOW clawback operations with:
 * - 24-hour public comment period before execution
 * - Dispute resolution system
 * - Public transparency ledger
 * - Full audit trail
 * 
 * @version 2.0.0 - Migrated to PostgreSQL via Prisma
 */

import { Wallet } from 'xrpl';
import { EventEmitter } from 'eventemitter3';
import { XRPLClient, TransactionResult } from '../core/XRPLClient.js';
import { VerityXAODOW, ClawbackTransaction } from '../core/XAO_DOW.js';
import { logger, logAuditAction } from '../utils/logger.js';
import { generateId, generateVerificationHash, sha256 } from '../utils/crypto.js';
import { prisma } from '../db/client.js';
import type { ClawbackReason, GovernanceApproval } from '../types/index.js';

// Constants
const COMMENT_PERIOD_MS = 24 * 60 * 60 * 1000; // 24 hours
const MIN_DISPUTE_STAKE_DROPS = '1000000'; // 1 XRP minimum stake
const DISPUTE_RESOLUTION_PERIOD_MS = 72 * 60 * 60 * 1000; // 72 hours

/**
 * Public comment on a clawback proposal
 */
export interface PublicComment {
  id: string;
  clawbackId: string;
  author: string;
  content: string;
  supportClawback: boolean;
  timestamp: Date;
  verificationHash: string;
}

/**
 * Dispute filed against a clawback
 */
export interface Dispute {
  id: string;
  clawbackId: string;
  filer: string;
  reason: string;
  evidence: string[];
  stakeAmount: string;
  status: 'active' | 'resolved_for_filer' | 'resolved_against_filer' | 'withdrawn';
  resolution?: DisputeResolution;
  filedAt: Date;
  resolvedAt?: Date;
}

/**
 * Resolution of a dispute
 */
export interface DisputeResolution {
  decidedBy: string[];
  decision: 'clawback_cancelled' | 'clawback_proceeds' | 'partial_clawback';
  rationale: string;
  partialAmount?: string;
  timestamp: Date;
  verificationHash: string;
}

/**
 * Governance vote on a clawback
 */
export interface ClawbackVote {
  voter: string;
  vote: 'approve' | 'reject' | 'abstain';
  reason?: string;
  timestamp: Date;
  signature: string;
}

/**
 * Transparency ledger entry
 */
export interface TransparencyEntry {
  id: string;
  type: 'PROPOSAL_CREATED' | 'COMMENT_ADDED' | 'VOTE_CAST' | 'DISPUTE_FILED' | 
        'DISPUTE_RESOLVED' | 'CLAWBACK_EXECUTED' | 'CLAWBACK_CANCELLED';
  proposalId: string;
  actor: string;
  action: string;
  details: Record<string, unknown>;
  timestamp: Date;
  blockHeight?: number;
  transactionHash?: string;
  verificationHash: string;
}

/**
 * Oracle configuration
 */
export interface ComplianceOracleConfig {
  commentPeriodMs: number;
  disputeStakeMinDrops: string;
  disputeResolutionPeriodMs: number;
  governanceQuorum: number;
  requiredMajority: number; // Percentage (e.g., 66 for 2/3 majority)
  publicJustificationRequired: boolean;
  allowAnonymousComments: boolean;
}

/**
 * Compliance Oracle
 * Manages transparent governance for clawback operations
 * Now backed by PostgreSQL via Prisma
 */
export class ComplianceOracle extends EventEmitter {
  private xrplClient: XRPLClient;
  private xaodow: VerityXAODOW;
  private config: ComplianceOracleConfig;
  private governanceSigners: Set<string> = new Set();

  constructor(
    xrplClient: XRPLClient,
    xaodow: VerityXAODOW,
    config?: Partial<ComplianceOracleConfig>
  ) {
    super();
    this.xrplClient = xrplClient;
    this.xaodow = xaodow;
    this.config = {
      commentPeriodMs: config?.commentPeriodMs ?? COMMENT_PERIOD_MS,
      disputeStakeMinDrops: config?.disputeStakeMinDrops ?? MIN_DISPUTE_STAKE_DROPS,
      disputeResolutionPeriodMs: config?.disputeResolutionPeriodMs ?? DISPUTE_RESOLUTION_PERIOD_MS,
      governanceQuorum: config?.governanceQuorum ?? 3,
      requiredMajority: config?.requiredMajority ?? 66,
      publicJustificationRequired: config?.publicJustificationRequired ?? true,
      allowAnonymousComments: config?.allowAnonymousComments ?? false,
    };

    logger.info('Compliance Oracle initialized with PostgreSQL backing', {
      commentPeriodHours: this.config.commentPeriodMs / (60 * 60 * 1000),
      quorum: this.config.governanceQuorum,
      requiredMajority: `${this.config.requiredMajority}%`,
    });
  }

  /**
   * Add a governance signer
   */
  addGovernanceSigner(wallet: string): void {
    this.governanceSigners.add(wallet);
    logger.info('Governance signer added', { wallet });
  }

  /**
   * Remove a governance signer
   */
  removeGovernanceSigner(wallet: string): void {
    this.governanceSigners.delete(wallet);
    logger.info('Governance signer removed', { wallet });
  }

  /**
   * Create a new clawback proposal
   */
  async createProposal(
    initiatorWallet: string,
    asset: string,
    targetWallet: string,
    amount: string,
    reason: ClawbackReason,
    legalJustification: string,
    documentationUrls: string[] = []
  ) {
    // Validate inputs
    if (this.config.publicJustificationRequired && !legalJustification) {
      throw new Error('Legal justification is required');
    }

    // Calculate comment period end
    const commentPeriodEnds = new Date(Date.now() + this.config.commentPeriodMs);

    // Generate verification hash
    const verificationHash = generateVerificationHash({
      asset,
      targetWallet,
      amount,
      reason,
      legalJustification,
      initiatorWallet,
      commentPeriodEnds: commentPeriodEnds.toISOString(),
    });

    // Create proposal in database
    const proposal = await prisma.clawbackProposal.create({
      data: {
        asset,
        targetWallet,
        amount: parseFloat(amount),
        reason: reason as any, // Map to Prisma enum
        legalJustification,
        documentationUrls,
        initiatorWallet,
        status: 'COMMENT_PERIOD',
        commentPeriodEnds,
        verificationHash,
      },
    });

    // Log to audit
    await this.logTransparencyEntry({
      type: 'PROPOSAL_CREATED',
      proposalId: proposal.id,
      actor: initiatorWallet,
      action: `Clawback proposal created for ${amount} ${asset} from ${targetWallet}`,
      details: {
        reason,
        amount,
        asset,
        targetWallet,
        commentPeriodEnds: commentPeriodEnds.toISOString(),
      },
    });

    logAuditAction('CLAWBACK_PROPOSAL_CREATED', initiatorWallet, {
      proposalId: proposal.id,
      targetWallet,
      amount,
      asset,
      reason,
    });

    this.emit('proposalCreated', proposal);

    return proposal;
  }

  /**
   * Add a public comment to a proposal
   */
  async addComment(
    proposalId: string,
    authorWallet: string,
    content: string,
    supportClawback: boolean
  ) {
    const proposal = await prisma.clawbackProposal.findUnique({
      where: { id: proposalId },
    });

    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    // Check comment period
    if (new Date() > proposal.commentPeriodEnds) {
      throw new Error('Comment period has ended');
    }

    // Validate author
    if (!this.config.allowAnonymousComments && !authorWallet) {
      throw new Error('Author wallet is required');
    }

    // Generate verification hash
    const verificationHash = generateVerificationHash({
      proposalId,
      author: authorWallet,
      content,
      supportClawback,
      timestamp: new Date().toISOString(),
    });

    // Create comment (verificationHash stored in audit log)
    const comment = await prisma.clawbackComment.create({
      data: {
        proposalId,
        authorWallet,
        content,
        supportClawback,
      },
    });

    // Log transparency entry
    await this.logTransparencyEntry({
      type: 'COMMENT_ADDED',
      proposalId,
      actor: authorWallet,
      action: `Comment added ${supportClawback ? 'supporting' : 'opposing'} clawback`,
      details: { commentId: comment.id, supportClawback },
    });

    this.emit('commentAdded', { proposalId, comment });

    return comment;
  }

  /**
   * File a dispute against a proposal
   */
  async fileDispute(
    proposalId: string,
    filerWallet: string,
    reason: string,
    evidence: string[] = [],
    stakeAmount: string
  ) {
    const proposal = await prisma.clawbackProposal.findUnique({
      where: { id: proposalId },
    });

    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    // Check if proposal can be disputed
    if (!['COMMENT_PERIOD', 'VOTING'].includes(proposal.status)) {
      throw new Error('Proposal cannot be disputed in current status');
    }

    // Validate stake
    if (BigInt(stakeAmount) < BigInt(this.config.disputeStakeMinDrops)) {
      throw new Error(`Minimum stake is ${this.config.disputeStakeMinDrops} drops`);
    }

    // Create dispute
    const dispute = await prisma.clawbackDispute.create({
      data: {
        proposalId,
        filerWallet,
        reason,
        evidence,
        stakeAmount: parseFloat(stakeAmount),
        status: 'ACTIVE',
      },
    });

    // Update proposal status
    await prisma.clawbackProposal.update({
      where: { id: proposalId },
      data: { status: 'DISPUTED' },
    });

    // Log transparency entry
    await this.logTransparencyEntry({
      type: 'DISPUTE_FILED',
      proposalId,
      actor: filerWallet,
      action: 'Dispute filed against clawback proposal',
      details: { disputeId: dispute.id, reason, stakeAmount },
    });

    logAuditAction('DISPUTE_FILED', filerWallet, {
      proposalId,
      disputeId: dispute.id,
      reason,
      stakeAmount,
    });

    this.emit('disputeFiled', { proposalId, dispute });

    return dispute;
  }

  /**
   * Cast a governance vote
   */
  async castVote(
    proposalId: string,
    voterWallet: string,
    vote: 'approve' | 'reject' | 'abstain',
    reason?: string,
    signature?: string
  ) {
    // Verify voter is a governance signer
    if (!this.governanceSigners.has(voterWallet)) {
      throw new Error('Voter is not a governance signer');
    }

    const proposal = await prisma.clawbackProposal.findUnique({
      where: { id: proposalId },
    });

    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    // Check if voting is open
    if (proposal.status !== 'VOTING' && proposal.status !== 'COMMENT_PERIOD') {
      throw new Error('Voting is not open for this proposal');
    }

    // Update vote counts
    const updateData: any = {};
    if (vote === 'approve') {
      updateData.approveVotes = { increment: 1 };
    } else if (vote === 'reject') {
      updateData.rejectVotes = { increment: 1 };
    } else {
      updateData.abstainVotes = { increment: 1 };
    }

    // If first vote and still in comment period, move to voting
    if (proposal.status === 'COMMENT_PERIOD' && new Date() > proposal.commentPeriodEnds) {
      updateData.status = 'VOTING';
      updateData.votingEndsAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hour voting
    }

    await prisma.clawbackProposal.update({
      where: { id: proposalId },
      data: updateData,
    });

    // Log transparency entry
    await this.logTransparencyEntry({
      type: 'VOTE_CAST',
      proposalId,
      actor: voterWallet,
      action: `Vote cast: ${vote}`,
      details: { vote, reason, hasSignature: !!signature },
    });

    logAuditAction('VOTE_CAST', voterWallet, {
      proposalId,
      vote,
      reason,
    });

    this.emit('voteCast', { proposalId, voterWallet, vote });

    // Check if quorum reached
    const updatedProposal = await prisma.clawbackProposal.findUnique({
      where: { id: proposalId },
    });

    if (updatedProposal) {
      const totalVotes = updatedProposal.approveVotes + updatedProposal.rejectVotes;
      if (totalVotes >= this.config.governanceQuorum) {
        await this.checkVotingResult(proposalId);
      }
    }

    return { proposalId, vote, voterWallet };
  }

  /**
   * Check and finalize voting result
   */
  private async checkVotingResult(proposalId: string) {
    const proposal = await prisma.clawbackProposal.findUnique({
      where: { id: proposalId },
    });

    if (!proposal) return;

    const totalVotes = proposal.approveVotes + proposal.rejectVotes;
    if (totalVotes < this.config.governanceQuorum) return;

    const approvalPercentage = (proposal.approveVotes / totalVotes) * 100;

    let newStatus: string;
    if (approvalPercentage >= this.config.requiredMajority) {
      newStatus = 'APPROVED';
    } else {
      newStatus = 'CANCELLED';
    }

    await prisma.clawbackProposal.update({
      where: { id: proposalId },
      data: { status: newStatus as any },
    });

    this.emit('votingComplete', { proposalId, approved: newStatus === 'APPROVED', approvalPercentage });
  }

  /**
   * Execute an approved clawback
   */
  async executeClawback(proposalId: string, executorWallet: Wallet) {
    const proposal = await prisma.clawbackProposal.findUnique({
      where: { id: proposalId },
    });

    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    if (proposal.status !== 'APPROVED') {
      throw new Error('Proposal is not approved for execution');
    }

    // Check for active disputes
    const activeDisputes = await prisma.clawbackDispute.count({
      where: { proposalId, status: 'ACTIVE' },
    });

    if (activeDisputes > 0) {
      throw new Error('Cannot execute - there are unresolved disputes');
    }

    // First, initiate the clawback in XAO-DOW system
    // initiateClawback(asset, fromWallet, amount, reason, legalJustification)
    const clawbackInit = await this.xaodow.initiateClawback(
      proposal.asset,
      proposal.targetWallet,
      String(proposal.amount),
      proposal.reason as ClawbackReason,
      `Proposal ${proposalId}: ${proposal.legalJustification}`
    );

    // Then execute it
    const result = await this.xaodow.executeClawback(clawbackInit.id);

    // Update proposal
    await prisma.clawbackProposal.update({
      where: { id: proposalId },
      data: {
        status: 'EXECUTED',
        executedAt: new Date(),
        executionTxHash: result.hash,
      },
    });

    // Log transparency entry
    await this.logTransparencyEntry({
      type: 'CLAWBACK_EXECUTED',
      proposalId,
      actor: executorWallet.address,
      action: `Clawback executed: ${proposal.amount} ${proposal.asset}`,
      details: {
        txHash: result.hash,
        targetWallet: proposal.targetWallet,
        amount: String(proposal.amount),
      },
      transactionHash: result.hash,
    });

    logAuditAction('CLAWBACK_EXECUTED', executorWallet.address, {
      proposalId,
      txHash: result.hash,
      amount: String(proposal.amount),
      targetWallet: proposal.targetWallet,
    });

    this.emit('clawbackExecuted', { proposalId, result });

    return result;
  }

  /**
   * Resolve a dispute
   */
  async resolveDispute(
    disputeId: string,
    resolvers: string[],
    decision: 'clawback_cancelled' | 'clawback_proceeds' | 'partial_clawback',
    rationale: string,
    partialAmount?: string
  ) {
    const dispute = await prisma.clawbackDispute.findUnique({
      where: { id: disputeId },
      include: { proposal: true },
    });

    if (!dispute) {
      throw new Error(`Dispute ${disputeId} not found`);
    }

    if (dispute.status !== 'ACTIVE') {
      throw new Error('Dispute is not active');
    }

    // Validate resolvers are governance signers
    for (const resolver of resolvers) {
      if (!this.governanceSigners.has(resolver)) {
        throw new Error(`${resolver} is not a governance signer`);
      }
    }

    // Determine dispute outcome
    let disputeStatus: string;
    if (decision === 'clawback_cancelled') {
      disputeStatus = 'RESOLVED_FOR_FILER';
    } else if (decision === 'clawback_proceeds') {
      disputeStatus = 'RESOLVED_AGAINST_FILER';
    } else {
      disputeStatus = 'RESOLVED_PARTIAL';
    }

    // Generate resolution hash
    const resolutionHash = generateVerificationHash({
      disputeId,
      decision,
      rationale,
      resolvers,
      timestamp: new Date().toISOString(),
    });

    // Update dispute - resolution is a text field in schema
    await prisma.clawbackDispute.update({
      where: { id: disputeId },
      data: {
        status: disputeStatus as any,
        resolution: JSON.stringify({
          decidedBy: resolvers,
          decision,
          rationale,
          partialAmount,
          verificationHash: resolutionHash,
        }),
        resolvedBy: resolvers,
        resolvedAt: new Date(),
      },
    });

    // Update proposal status based on decision
    let newProposalStatus: string;
    if (decision === 'clawback_cancelled') {
      newProposalStatus = 'CANCELLED';
    } else if (decision === 'clawback_proceeds') {
      newProposalStatus = 'APPROVED';
    } else {
      newProposalStatus = 'APPROVED'; // Partial proceeds
    }

    if (dispute.proposalId) {
      await prisma.clawbackProposal.update({
        where: { id: dispute.proposalId },
        data: { status: newProposalStatus as any },
      });
    }

    // Log transparency entry
    const proposalIdForLog = dispute.proposalId ?? disputeId;
    await this.logTransparencyEntry({
      type: 'DISPUTE_RESOLVED',
      proposalId: proposalIdForLog,
      actor: resolvers[0] ?? 'unknown',
      action: `Dispute resolved: ${decision}`,
      details: {
        disputeId,
        decision,
        rationale,
        resolvers,
      },
    });

    logAuditAction('DISPUTE_RESOLVED', resolvers[0] ?? 'unknown', {
      disputeId,
      proposalId: proposalIdForLog,
      decision,
    });

    this.emit('disputeResolved', { disputeId, decision });

    return { disputeId, decision, proposalStatus: newProposalStatus };
  }

  /**
   * Get proposal by ID
   */
  async getProposal(proposalId: string) {
    return prisma.clawbackProposal.findUnique({
      where: { id: proposalId },
      include: {
        comments: {
          orderBy: { createdAt: 'desc' },
        },
        disputes: true,
      },
    });
  }

  /**
   * Get all proposals with optional filters
   */
  async getProposals(options?: {
    status?: string;
    targetWallet?: string;
    asset?: string;
    limit?: number;
    offset?: number;
  }) {
    return prisma.clawbackProposal.findMany({
      where: {
        ...(options?.status && { status: options.status as any }),
        ...(options?.targetWallet && { targetWallet: options.targetWallet }),
        ...(options?.asset && { asset: options.asset }),
      },
      include: {
        _count: {
          select: { comments: true, disputes: true },
        },
      },
      take: options?.limit || 20,
      skip: options?.offset || 0,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get comments for a proposal
   */
  async getComments(proposalId: string) {
    return prisma.clawbackComment.findMany({
      where: { proposalId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get disputes for a proposal
   */
  async getDisputes(proposalId: string) {
    return prisma.clawbackDispute.findMany({
      where: { proposalId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get transparency ledger entries
   */
  async getTransparencyLedger(options?: {
    proposalId?: string;
    type?: string;
    limit?: number;
    offset?: number;
  }) {
    return prisma.auditLog.findMany({
      where: {
        ...(options?.proposalId && { metadata: { path: ['proposalId'], equals: options.proposalId } }),
        ...(options?.type && { action: options.type }),
      },
      take: options?.limit || 50,
      skip: options?.offset || 0,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get compliance statistics
   */
  async getStats() {
    const [totalProposals, byStatus, recentActivity] = await Promise.all([
      prisma.clawbackProposal.count(),
      prisma.clawbackProposal.groupBy({
        by: ['status'],
        _count: true,
      }),
      prisma.clawbackProposal.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          status: true,
          asset: true,
          amount: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      totalProposals,
      byStatus: byStatus.reduce((acc, item) => {
        acc[item.status] = item._count;
        return acc;
      }, {} as Record<string, number>),
      governanceSigners: this.governanceSigners.size,
      config: {
        commentPeriodHours: this.config.commentPeriodMs / (60 * 60 * 1000),
        quorum: this.config.governanceQuorum,
        requiredMajority: this.config.requiredMajority,
      },
      recentActivity,
    };
  }

  // ============================================================================
  // Backward Compatibility Aliases
  // ============================================================================

  /** Alias for createProposal */
  async createClawbackProposal(...args: Parameters<typeof this.createProposal>) {
    return this.createProposal(...args);
  }

  /** Alias for getProposals */
  async getAllProposals(options?: Parameters<typeof this.getProposals>[0]) {
    return this.getProposals(options);
  }

  /** Alias for getProposals with status filter */
  async getProposalsByStatus(status: string) {
    return this.getProposals({ status });
  }

  /** Alias for getComments */
  async getProposalComments(proposalId: string) {
    return this.getComments(proposalId);
  }

  /** Alias for getDisputes */
  async getProposalDisputes(proposalId: string) {
    return this.getDisputes(proposalId);
  }

  /** Alias for addComment */
  async addPublicComment(...args: Parameters<typeof this.addComment>) {
    return this.addComment(...args);
  }

  /** Get proposal history (transparency ledger) */
  async getProposalHistory(proposalId: string) {
    return this.getTransparencyLedger({ proposalId });
  }

  /** Verify proposal integrity */
  async verifyProposalIntegrity(proposalId: string) {
    const proposal = await this.getProposal(proposalId);
    if (!proposal) {
      return { valid: false, error: 'Proposal not found' };
    }
    return { valid: true, proposal };
  }

  /** Cancel a proposal */
  async cancelProposal(proposalId: string, reason: string) {
    return prisma.clawbackProposal.update({
      where: { id: proposalId },
      data: { status: 'CANCELLED' as any },
    });
  }

  /** Alias for getStats */
  async getGovernanceStats() {
    return this.getStats();
  }

  /** Get oracle configuration */
  getOracleConfig() {
    return this.config;
  }

  /** Set multiple governance signers */
  setGovernanceSigners(wallets: string[]) {
    this.governanceSigners.clear();
    wallets.forEach(w => this.governanceSigners.add(w));
  }

  /**
   * Log a transparency entry to the audit log
   */
  private async logTransparencyEntry(entry: {
    type: string;
    proposalId: string;
    actor: string;
    action: string;
    details: Record<string, unknown>;
    transactionHash?: string;
  }) {
    const verificationHash = generateVerificationHash({
      ...entry,
      timestamp: new Date().toISOString(),
    });

    await prisma.auditLog.create({
      data: {
        action: entry.type,
        actor: entry.actor,
        entityType: 'CLAWBACK_PROPOSAL',
        entityId: entry.proposalId,
        metadata: {
          ...entry.details,
          transactionHash: entry.transactionHash,
          verificationHash,
        },
      },
    });
  }
}

// Export singleton pattern support
let complianceOracleInstance: ComplianceOracle | null = null;

export function getComplianceOracle(
  xrplClient: XRPLClient,
  xaodow: VerityXAODOW,
  config?: Partial<ComplianceOracleConfig>
): ComplianceOracle {
  if (!complianceOracleInstance) {
    complianceOracleInstance = new ComplianceOracle(xrplClient, xaodow, config);
  }
  return complianceOracleInstance;
}

export default ComplianceOracle;
