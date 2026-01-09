/**
 * Verity Protocol - Compliance Oracle
 * 
 * Multi-signature governance for XAO-DOW clawback operations with:
 * - 24-hour public comment period before execution
 * - Dispute resolution system
 * - Public transparency ledger
 * - Full audit trail
 */

import { Wallet } from 'xrpl';
import { EventEmitter } from 'eventemitter3';
import { XRPLClient, TransactionResult } from '../core/XRPLClient.js';
import { VerityXAODOW, ClawbackTransaction } from '../core/XAO_DOW.js';
import { logger, logAuditAction } from '../utils/logger.js';
import { generateId, generateVerificationHash, sha256 } from '../utils/crypto.js';
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
 * Clawback proposal with enhanced governance
 */
export interface ClawbackProposal {
  id: string;
  clawbackId: string;
  initiator: string;
  asset: string;
  targetWallet: string;
  amount: string;
  reason: ClawbackReason;
  legalJustification: string;
  documentationUrls: string[];
  status: 'comment_period' | 'voting' | 'approved' | 'disputed' | 'executed' | 'cancelled';
  comments: PublicComment[];
  votes: ClawbackVote[];
  disputes: Dispute[];
  commentPeriodEndsAt: Date;
  votingEndsAt?: Date;
  createdAt: Date;
  executedAt?: Date;
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
 */
export class ComplianceOracle extends EventEmitter {
  private xrplClient: XRPLClient;
  private xaodow: VerityXAODOW;
  private config: ComplianceOracleConfig;
  private governanceSigners: Set<string> = new Set();
  
  // Storage (in-memory for now, would be database in production)
  private proposals: Map<string, ClawbackProposal> = new Map();
  private transparencyLedger: TransparencyEntry[] = [];
  private disputesByProposal: Map<string, Dispute[]> = new Map();
  private commentsByProposal: Map<string, PublicComment[]> = new Map();

  constructor(
    xrplClient: XRPLClient,
    xaodow: VerityXAODOW,
    config?: Partial<ComplianceOracleConfig>
  ) {
    super();
    this.xrplClient = xrplClient;
    this.xaodow = xaodow;
    
    // Default configuration
    this.config = {
      commentPeriodMs: config?.commentPeriodMs ?? COMMENT_PERIOD_MS,
      disputeStakeMinDrops: config?.disputeStakeMinDrops ?? MIN_DISPUTE_STAKE_DROPS,
      disputeResolutionPeriodMs: config?.disputeResolutionPeriodMs ?? DISPUTE_RESOLUTION_PERIOD_MS,
      governanceQuorum: config?.governanceQuorum ?? 3,
      requiredMajority: config?.requiredMajority ?? 66,
      publicJustificationRequired: config?.publicJustificationRequired ?? true,
      allowAnonymousComments: config?.allowAnonymousComments ?? false,
    };

    logger.info('Compliance Oracle initialized', {
      commentPeriod: `${this.config.commentPeriodMs / 3600000} hours`,
      governanceQuorum: this.config.governanceQuorum,
      requiredMajority: `${this.config.requiredMajority}%`,
    });
  }

  /**
   * Set governance signers (multi-sig committee)
   */
  setGovernanceSigners(signers: string[]): void {
    this.governanceSigners = new Set(signers);
    logger.info(`Governance committee set: ${signers.length} members`);
    
    this.addTransparencyEntry({
      type: 'PROPOSAL_CREATED',
      proposalId: 'SYSTEM',
      actor: 'SYSTEM',
      action: 'Governance committee updated',
      details: { signerCount: signers.length },
    });
  }

  /**
   * Create a clawback proposal with 24-hour comment period
   */
  async createClawbackProposal(
    initiator: string,
    asset: string,
    targetWallet: string,
    amount: string,
    reason: ClawbackReason,
    legalJustification: string,
    documentationUrls: string[] = []
  ): Promise<ClawbackProposal> {
    // Verify initiator is authorized
    if (!this.governanceSigners.has(initiator)) {
      throw new Error('Only governance committee members can create clawback proposals');
    }

    // Validate inputs
    if (this.config.publicJustificationRequired && !legalJustification.trim()) {
      throw new Error('Legal justification is required for clawback proposals');
    }

    const proposalId = generateId('PROP');
    const now = new Date();
    
    // Create underlying clawback request in XAO-DOW
    const clawback = await this.xaodow.initiateClawback(
      asset,
      targetWallet,
      amount,
      reason,
      legalJustification
    );

    const proposal: ClawbackProposal = {
      id: proposalId,
      clawbackId: clawback.id,
      initiator,
      asset,
      targetWallet,
      amount,
      reason,
      legalJustification,
      documentationUrls,
      status: 'comment_period',
      comments: [],
      votes: [],
      disputes: [],
      commentPeriodEndsAt: new Date(now.getTime() + this.config.commentPeriodMs),
      createdAt: now,
      verificationHash: generateVerificationHash({
        proposalId,
        clawbackId: clawback.id,
        initiator,
        asset,
        targetWallet,
        amount,
        reason,
        createdAt: now.toISOString(),
      }),
    };

    this.proposals.set(proposalId, proposal);
    this.commentsByProposal.set(proposalId, []);
    this.disputesByProposal.set(proposalId, []);

    // Log to transparency ledger
    this.addTransparencyEntry({
      type: 'PROPOSAL_CREATED',
      proposalId,
      actor: initiator,
      action: 'Created clawback proposal',
      details: {
        asset,
        targetWallet,
        amount,
        reason,
        commentPeriodEndsAt: proposal.commentPeriodEndsAt.toISOString(),
      },
    });

    logAuditAction('CLAWBACK_PROPOSAL_CREATED', initiator, {
      proposalId,
      clawbackId: clawback.id,
      asset,
      targetWallet,
      amount,
      reason,
    });

    this.emit('proposalCreated', proposal);

    logger.info(`Clawback proposal created: ${proposalId}`, {
      commentPeriodEnds: proposal.commentPeriodEndsAt.toISOString(),
    });

    return proposal;
  }

  /**
   * Add a public comment to a proposal
   */
  addPublicComment(
    proposalId: string,
    author: string,
    content: string,
    supportClawback: boolean
  ): PublicComment {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    if (proposal.status !== 'comment_period') {
      throw new Error('Comment period has ended');
    }

    if (new Date() > proposal.commentPeriodEndsAt) {
      // Auto-transition to voting phase
      proposal.status = 'voting';
      proposal.votingEndsAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h voting
      throw new Error('Comment period has ended');
    }

    if (!this.config.allowAnonymousComments && !author) {
      throw new Error('Anonymous comments are not allowed');
    }

    const commentId = generateId('CMT');
    const comment: PublicComment = {
      id: commentId,
      clawbackId: proposal.clawbackId,
      author: author || 'anonymous',
      content,
      supportClawback,
      timestamp: new Date(),
      verificationHash: generateVerificationHash({
        commentId,
        proposalId,
        author,
        content,
        timestamp: new Date().toISOString(),
      }),
    };

    proposal.comments.push(comment);
    const comments = this.commentsByProposal.get(proposalId) || [];
    comments.push(comment);
    this.commentsByProposal.set(proposalId, comments);

    // Log to transparency ledger
    this.addTransparencyEntry({
      type: 'COMMENT_ADDED',
      proposalId,
      actor: comment.author,
      action: `Added ${supportClawback ? 'supporting' : 'opposing'} comment`,
      details: {
        commentId,
        supportClawback,
        contentLength: content.length,
      },
    });

    logAuditAction('PUBLIC_COMMENT_ADDED', author, {
      proposalId,
      commentId,
      supportClawback,
    });

    this.emit('commentAdded', { proposalId, comment });

    return comment;
  }

  /**
   * Cast a governance vote on a proposal
   */
  castVote(
    proposalId: string,
    voter: string,
    vote: 'approve' | 'reject' | 'abstain',
    reason?: string,
    signature?: string
  ): ClawbackVote {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    // Verify voter is governance member
    if (!this.governanceSigners.has(voter)) {
      throw new Error('Only governance committee members can vote');
    }

    // Check if comment period has ended
    if (proposal.status === 'comment_period') {
      if (new Date() < proposal.commentPeriodEndsAt) {
        throw new Error('Cannot vote during comment period');
      }
      // Auto-transition to voting phase
      proposal.status = 'voting';
      proposal.votingEndsAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    }

    if (proposal.status !== 'voting') {
      throw new Error(`Cannot vote on proposal in status: ${proposal.status}`);
    }

    // Check for duplicate vote
    if (proposal.votes.some(v => v.voter === voter)) {
      throw new Error('Already voted on this proposal');
    }

    const governanceVote: ClawbackVote = {
      voter,
      vote,
      reason,
      timestamp: new Date(),
      signature: signature || sha256(`${proposalId}:${voter}:${vote}:${Date.now()}`),
    };

    proposal.votes.push(governanceVote);

    // Also add to XAO-DOW if approving
    if (vote === 'approve') {
      this.xaodow.addGovernanceApproval(
        proposal.clawbackId,
        voter,
        governanceVote.signature,
        true
      );
    }

    // Check if voting is complete
    this.checkVotingOutcome(proposal);

    // Log to transparency ledger
    this.addTransparencyEntry({
      type: 'VOTE_CAST',
      proposalId,
      actor: voter,
      action: `Voted ${vote}`,
      details: {
        vote,
        reason,
        totalVotes: proposal.votes.length,
        governanceSize: this.governanceSigners.size,
      },
    });

    logAuditAction('GOVERNANCE_VOTE_CAST', voter, {
      proposalId,
      vote,
    });

    this.emit('voteCast', { proposalId, vote: governanceVote });

    return governanceVote;
  }

  /**
   * File a dispute against a clawback proposal
   */
  async fileDispute(
    proposalId: string,
    filer: string,
    reason: string,
    evidence: string[],
    stakeAmount: string
  ): Promise<Dispute> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    // Disputes can be filed during comment period or voting
    if (!['comment_period', 'voting', 'approved'].includes(proposal.status)) {
      throw new Error('Cannot file dispute at this stage');
    }

    // Validate stake amount
    if (BigInt(stakeAmount) < BigInt(this.config.disputeStakeMinDrops)) {
      throw new Error(`Minimum stake is ${this.config.disputeStakeMinDrops} drops`);
    }

    const disputeId = generateId('DSP');
    const dispute: Dispute = {
      id: disputeId,
      clawbackId: proposal.clawbackId,
      filer,
      reason,
      evidence,
      stakeAmount,
      status: 'active',
      filedAt: new Date(),
    };

    proposal.disputes.push(dispute);
    proposal.status = 'disputed';

    const disputes = this.disputesByProposal.get(proposalId) || [];
    disputes.push(dispute);
    this.disputesByProposal.set(proposalId, disputes);

    // Log to transparency ledger
    this.addTransparencyEntry({
      type: 'DISPUTE_FILED',
      proposalId,
      actor: filer,
      action: 'Filed dispute against clawback',
      details: {
        disputeId,
        reason,
        evidenceCount: evidence.length,
        stakeAmount,
      },
    });

    logAuditAction('DISPUTE_FILED', filer, {
      proposalId,
      disputeId,
      stakeAmount,
    });

    this.emit('disputeFiled', { proposalId, dispute });

    logger.info(`Dispute filed: ${disputeId}`, {
      proposalId,
      filer,
      stakeAmount,
    });

    return dispute;
  }

  /**
   * Resolve a dispute (governance committee decision)
   */
  resolveDispute(
    proposalId: string,
    disputeId: string,
    decidedBy: string[],
    decision: 'clawback_cancelled' | 'clawback_proceeds' | 'partial_clawback',
    rationale: string,
    partialAmount?: string
  ): Dispute {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    const dispute = proposal.disputes.find(d => d.id === disputeId);
    if (!dispute) {
      throw new Error(`Dispute ${disputeId} not found`);
    }

    if (dispute.status !== 'active') {
      throw new Error('Dispute is not active');
    }

    // Verify deciders are governance members
    for (const decider of decidedBy) {
      if (!this.governanceSigners.has(decider)) {
        throw new Error(`${decider} is not a governance member`);
      }
    }

    // Require quorum for resolution
    if (decidedBy.length < this.config.governanceQuorum) {
      throw new Error(`Resolution requires at least ${this.config.governanceQuorum} governance members`);
    }

    const resolution: DisputeResolution = {
      decidedBy,
      decision,
      rationale,
      partialAmount,
      timestamp: new Date(),
      verificationHash: generateVerificationHash({
        disputeId,
        decision,
        rationale,
        decidedBy,
        timestamp: new Date().toISOString(),
      }),
    };

    dispute.resolution = resolution;
    dispute.resolvedAt = new Date();

    // Update dispute status based on decision
    if (decision === 'clawback_cancelled') {
      dispute.status = 'resolved_for_filer';
      proposal.status = 'cancelled';
      // Filer gets stake back (would implement transfer in production)
    } else if (decision === 'clawback_proceeds' || decision === 'partial_clawback') {
      dispute.status = 'resolved_against_filer';
      proposal.status = 'approved';
      // Stake goes to governance treasury (would implement in production)
    }

    // Log to transparency ledger
    this.addTransparencyEntry({
      type: 'DISPUTE_RESOLVED',
      proposalId,
      actor: decidedBy.join(','),
      action: `Resolved dispute: ${decision}`,
      details: {
        disputeId,
        decision,
        rationale,
        partialAmount,
      },
    });

    logAuditAction('DISPUTE_RESOLVED', decidedBy[0] || 'SYSTEM', {
      proposalId,
      disputeId,
      decision,
    });

    this.emit('disputeResolved', { proposalId, dispute });

    return dispute;
  }

  /**
   * Execute an approved clawback
   */
  async executeClawback(
    proposalId: string,
    executorWallet: Wallet
  ): Promise<TransactionResult> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    if (proposal.status !== 'approved') {
      throw new Error(`Cannot execute proposal in status: ${proposal.status}`);
    }

    // Verify executor is governance member
    if (!this.governanceSigners.has(executorWallet.address)) {
      throw new Error('Only governance members can execute clawbacks');
    }

    // Verify comment period has ended
    if (new Date() < proposal.commentPeriodEndsAt) {
      throw new Error('Cannot execute during comment period');
    }

    // Check for active disputes
    const activeDisputes = proposal.disputes.filter(d => d.status === 'active');
    if (activeDisputes.length > 0) {
      throw new Error('Cannot execute with active disputes');
    }

    logger.info(`Executing clawback: ${proposal.clawbackId}`);

    // Execute via XAO-DOW
    const result = await this.xaodow.executeClawback(proposal.clawbackId);

    if (result.success) {
      proposal.status = 'executed';
      proposal.executedAt = new Date();

      // Log to transparency ledger
      this.addTransparencyEntry({
        type: 'CLAWBACK_EXECUTED',
        proposalId,
        actor: executorWallet.address,
        action: 'Executed clawback',
        details: {
          clawbackId: proposal.clawbackId,
          transactionHash: result.hash,
          asset: proposal.asset,
          amount: proposal.amount,
          targetWallet: proposal.targetWallet,
        },
        transactionHash: result.hash,
      });

      logAuditAction('CLAWBACK_EXECUTED_VIA_ORACLE', executorWallet.address, {
        proposalId,
        clawbackId: proposal.clawbackId,
        transactionHash: result.hash,
      });

      this.emit('clawbackExecuted', { proposalId, result });
    }

    return result;
  }

  /**
   * Cancel a clawback proposal
   */
  cancelProposal(
    proposalId: string,
    canceller: string,
    reason: string
  ): ClawbackProposal {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    // Only initiator or governance majority can cancel
    if (canceller !== proposal.initiator && !this.governanceSigners.has(canceller)) {
      throw new Error('Not authorized to cancel this proposal');
    }

    if (proposal.status === 'executed') {
      throw new Error('Cannot cancel executed proposal');
    }

    proposal.status = 'cancelled';

    // Log to transparency ledger
    this.addTransparencyEntry({
      type: 'CLAWBACK_CANCELLED',
      proposalId,
      actor: canceller,
      action: 'Cancelled clawback proposal',
      details: { reason },
    });

    logAuditAction('CLAWBACK_PROPOSAL_CANCELLED', canceller, {
      proposalId,
      reason,
    });

    this.emit('proposalCancelled', { proposalId, reason });

    return proposal;
  }

  /**
   * Check voting outcome and update proposal status
   */
  private checkVotingOutcome(proposal: ClawbackProposal): void {
    const totalVoters = this.governanceSigners.size;
    const approveVotes = proposal.votes.filter(v => v.vote === 'approve').length;
    const rejectVotes = proposal.votes.filter(v => v.vote === 'reject').length;
    const totalVotes = proposal.votes.length;

    // Check if quorum reached
    if (totalVotes >= this.config.governanceQuorum) {
      const approvePercentage = (approveVotes / totalVotes) * 100;
      const rejectPercentage = (rejectVotes / totalVotes) * 100;

      if (approvePercentage >= this.config.requiredMajority) {
        proposal.status = 'approved';
        logger.info(`Proposal ${proposal.id} approved`, {
          approveVotes,
          rejectVotes,
          percentage: approvePercentage,
        });
      } else if (rejectPercentage > (100 - this.config.requiredMajority)) {
        proposal.status = 'cancelled';
        logger.info(`Proposal ${proposal.id} rejected`, {
          approveVotes,
          rejectVotes,
          percentage: rejectPercentage,
        });
      }
    }
  }

  /**
   * Add entry to transparency ledger
   */
  private addTransparencyEntry(
    entry: Omit<TransparencyEntry, 'id' | 'timestamp' | 'verificationHash'>
  ): TransparencyEntry {
    const fullEntry: TransparencyEntry = {
      ...entry,
      id: generateId('TXP'),
      timestamp: new Date(),
      verificationHash: generateVerificationHash({
        ...entry,
        timestamp: new Date().toISOString(),
      }),
    };

    this.transparencyLedger.push(fullEntry);
    return fullEntry;
  }

  // === Public Getters ===

  /**
   * Get a proposal by ID
   */
  getProposal(proposalId: string): ClawbackProposal | undefined {
    return this.proposals.get(proposalId);
  }

  /**
   * Get all proposals
   */
  getAllProposals(): ClawbackProposal[] {
    return Array.from(this.proposals.values());
  }

  /**
   * Get proposals by status
   */
  getProposalsByStatus(status: ClawbackProposal['status']): ClawbackProposal[] {
    return Array.from(this.proposals.values()).filter(p => p.status === status);
  }

  /**
   * Get the full transparency ledger
   */
  getTransparencyLedger(): TransparencyEntry[] {
    return [...this.transparencyLedger];
  }

  /**
   * Get transparency ledger entries for a specific proposal
   */
  getProposalHistory(proposalId: string): TransparencyEntry[] {
    return this.transparencyLedger.filter(e => e.proposalId === proposalId);
  }

  /**
   * Get comments for a proposal
   */
  getProposalComments(proposalId: string): PublicComment[] {
    return this.commentsByProposal.get(proposalId) || [];
  }

  /**
   * Get disputes for a proposal
   */
  getProposalDisputes(proposalId: string): Dispute[] {
    return this.disputesByProposal.get(proposalId) || [];
  }

  /**
   * Get governance statistics
   */
  getGovernanceStats(): Record<string, unknown> {
    const allProposals = this.getAllProposals();
    
    return {
      totalProposals: allProposals.length,
      proposalsByStatus: {
        comment_period: allProposals.filter(p => p.status === 'comment_period').length,
        voting: allProposals.filter(p => p.status === 'voting').length,
        approved: allProposals.filter(p => p.status === 'approved').length,
        disputed: allProposals.filter(p => p.status === 'disputed').length,
        executed: allProposals.filter(p => p.status === 'executed').length,
        cancelled: allProposals.filter(p => p.status === 'cancelled').length,
      },
      totalComments: this.transparencyLedger.filter(e => e.type === 'COMMENT_ADDED').length,
      totalDisputes: this.transparencyLedger.filter(e => e.type === 'DISPUTE_FILED').length,
      governanceCommitteeSize: this.governanceSigners.size,
      transparencyEntries: this.transparencyLedger.length,
      config: {
        commentPeriodHours: this.config.commentPeriodMs / 3600000,
        disputeStakeMinXRP: Number(this.config.disputeStakeMinDrops) / 1000000,
        governanceQuorum: this.config.governanceQuorum,
        requiredMajority: `${this.config.requiredMajority}%`,
      },
    };
  }

  /**
   * Get oracle configuration (for transparency)
   */
  getOracleConfig(): ComplianceOracleConfig {
    return { ...this.config };
  }

  /**
   * Verify proposal integrity
   */
  verifyProposalIntegrity(proposalId: string): {
    valid: boolean;
    errors: string[];
    verificationHash: string;
  } {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      return { valid: false, errors: ['Proposal not found'], verificationHash: '' };
    }

    const errors: string[] = [];

    // Verify proposal hash
    const expectedHash = generateVerificationHash({
      proposalId: proposal.id,
      clawbackId: proposal.clawbackId,
      initiator: proposal.initiator,
      asset: proposal.asset,
      targetWallet: proposal.targetWallet,
      amount: proposal.amount,
      reason: proposal.reason,
      createdAt: proposal.createdAt.toISOString(),
    });

    if (expectedHash !== proposal.verificationHash) {
      errors.push('Proposal verification hash mismatch');
    }

    // Verify all comments have valid hashes
    for (const comment of proposal.comments) {
      const commentHash = generateVerificationHash({
        commentId: comment.id,
        proposalId,
        author: comment.author,
        content: comment.content,
        timestamp: comment.timestamp.toISOString(),
      });
      if (commentHash !== comment.verificationHash) {
        errors.push(`Comment ${comment.id} hash mismatch`);
      }
    }

    // Verify transparency ledger consistency
    const ledgerEntries = this.getProposalHistory(proposalId);
    if (ledgerEntries.length === 0) {
      errors.push('No transparency ledger entries found');
    }

    return {
      valid: errors.length === 0,
      errors,
      verificationHash: proposal.verificationHash,
    };
  }
}

export default ComplianceOracle;
