/**
 * Verity Protocol - Guild Treasury Management
 * Multi-signature treasury management with automated cross-border payments
 */

import { Wallet, Payment, EscrowCreate, EscrowFinish, SignerListSet } from 'xrpl';
import { EventEmitter } from 'eventemitter3';
import { XRPLClient, TransactionResult } from '../core/XRPLClient.js';
import { logger, logAuditAction } from '../utils/logger.js';
import { generateId, generateVerificationHash, encodeMemoData } from '../utils/crypto.js';
import type {
  Guild,
  GuildConfig,
  GuildMember,
  GuildRole,
  GuildStatus,
  TreasuryRules,
  RecurringPayment,
  MemberShare,
  GovernanceRules,
} from '../types/index.js';

export interface TreasuryBalance {
  currency: string;
  amount: string;
  issuer?: string;
}

export interface PaymentRequest {
  id: string;
  guildId: string;
  payee: string;
  amount: string;
  currency: string;
  description: string;
  requiredSignatures: number;
  signatures: PaymentSignature[];
  status: 'pending' | 'approved' | 'executed' | 'rejected' | 'cancelled';
  createdAt: Date;
  executedAt?: Date;
  transactionHash?: string;
}

export interface PaymentSignature {
  signer: string;
  approved: boolean;
  timestamp: Date;
}

export interface GuildProposal {
  id: string;
  guildId: string;
  proposer: string;
  title: string;
  description: string;
  type: 'MEMBER_ADD' | 'MEMBER_REMOVE' | 'RULE_CHANGE' | 'TREASURY_ALLOCATION' | 'DISSOLUTION';
  payload: Record<string, unknown>;
  votes: ProposalVote[];
  status: 'active' | 'passed' | 'failed' | 'executed';
  createdAt: Date;
  votingEndsAt: Date;
  executedAt?: Date;
}

export interface ProposalVote {
  voter: string;
  shares: number;
  support: boolean;
  timestamp: Date;
}

export interface PayrollExecution {
  id: string;
  guildId: string;
  period: string;
  totalAmount: string;
  currency: string;
  payments: Array<{
    payee: string;
    amount: string;
    transactionHash?: string;
    status: string;
  }>;
  executedAt: Date;
}

/**
 * Verity Guild Treasury Manager
 * Handles multi-sig treasury operations for DAOs and groups
 */
export class VerityGuildTreasury extends EventEmitter {
  private xrplClient: XRPLClient;
  
  // In-memory storage (would be database in production)
  private guilds: Map<string, Guild> = new Map();
  private paymentRequests: Map<string, PaymentRequest> = new Map();
  private guildProposals: Map<string, GuildProposal[]> = new Map();
  private payrollHistory: Map<string, PayrollExecution[]> = new Map();

  constructor(xrplClient: XRPLClient) {
    super();
    this.xrplClient = xrplClient;
    logger.info('Verity Guild Treasury initialized');
  }

  /**
   * Create a new guild with treasury
   */
  async createGuild(
    founderWallet: Wallet,
    config: GuildConfig,
    initialSigners: string[]
  ): Promise<{ guild: Guild; result: TransactionResult }> {
    logger.info(`Creating guild: ${config.name}`);

    // Validate configuration
    this.validateGuildConfig(config);

    // Generate guild ID
    const guildId = generateId('GLD');

    // Set up multi-sig on the treasury wallet
    // The founder wallet becomes the treasury wallet
    const signerListTx: SignerListSet = {
      TransactionType: 'SignerListSet',
      Account: founderWallet.address,
      SignerQuorum: config.treasuryRules.requiredSigners,
      SignerEntries: initialSigners.map((signer, index) => ({
        SignerEntry: {
          Account: signer,
          SignerWeight: 1,
        },
      })),
    };

    const result = await this.xrplClient.submitAndWait(signerListTx, founderWallet);

    if (!result.success) {
      throw new Error(`Failed to set up multi-sig: ${result.error}`);
    }

    // Create guild record
    const guild: Guild = {
      id: guildId,
      name: config.name,
      treasuryWallet: founderWallet.address,
      config,
      members: [
        {
          wallet: founderWallet.address,
          role: 'OWNER',
          shares: 10000, // 100% initially
          joinedAt: new Date(),
          isSigner: true,
        },
        ...initialSigners.map((signer) => ({
          wallet: signer,
          role: 'ADMIN' as GuildRole,
          shares: 0,
          joinedAt: new Date(),
          isSigner: true,
        })),
      ],
      totalTreasuryValue: '0',
      status: 'ACTIVE',
      createdAt: new Date(),
      verificationHash: generateVerificationHash({
        guildId,
        name: config.name,
        founder: founderWallet.address,
        createdAt: new Date().toISOString(),
      }),
    };

    // Store guild
    this.guilds.set(guildId, guild);
    this.guildProposals.set(guildId, []);
    this.payrollHistory.set(guildId, []);

    logAuditAction('GUILD_CREATED', founderWallet.address, {
      guildId,
      name: config.name,
      signers: initialSigners.length + 1,
      transactionHash: result.hash,
    });

    this.emit('guildCreated', guild);

    return { guild, result };
  }

  /**
   * Add a member to the guild
   */
  addMember(
    guildId: string,
    member: {
      wallet: string;
      role: GuildRole;
      shares: number;
      isSigner: boolean;
    }
  ): GuildMember {
    const guild = this.guilds.get(guildId);
    if (!guild) {
      throw new Error(`Guild ${guildId} not found`);
    }

    // Check if already a member
    if (guild.members.some((m) => m.wallet === member.wallet)) {
      throw new Error('Wallet is already a member');
    }

    const newMember: GuildMember = {
      wallet: member.wallet,
      role: member.role,
      shares: member.shares,
      joinedAt: new Date(),
      isSigner: member.isSigner,
    };

    guild.members.push(newMember);

    logAuditAction('MEMBER_ADDED', 'SYSTEM', {
      guildId,
      member: member.wallet,
      role: member.role,
      shares: member.shares,
    });

    this.emit('memberAdded', { guildId, member: newMember });

    return newMember;
  }

  /**
   * Update member shares (for revenue sharing)
   */
  updateMemberShares(guildId: string, shares: MemberShare[]): void {
    const guild = this.guilds.get(guildId);
    if (!guild) {
      throw new Error(`Guild ${guildId} not found`);
    }

    // Validate total shares = 10000 (100%)
    const totalShares = shares.reduce((sum, s) => sum + s.sharePercentage, 0);
    if (totalShares !== 10000) {
      throw new Error(`Total shares must equal 10000 (100%), got ${totalShares}`);
    }

    // Update shares
    for (const share of shares) {
      const member = guild.members.find((m) => m.wallet === share.member);
      if (member) {
        member.shares = share.sharePercentage;
      }
    }

    logAuditAction('SHARES_UPDATED', 'SYSTEM', {
      guildId,
      shares,
    });

    this.emit('sharesUpdated', { guildId, shares });
  }

  /**
   * Create a payment request (requires multi-sig approval)
   */
  createPaymentRequest(
    guildId: string,
    requester: string,
    payee: string,
    amount: string,
    currency: string,
    description: string
  ): PaymentRequest {
    const guild = this.guilds.get(guildId);
    if (!guild) {
      throw new Error(`Guild ${guildId} not found`);
    }

    // Verify requester is a member
    const member = guild.members.find((m) => m.wallet === requester);
    if (!member || (member.role !== 'OWNER' && member.role !== 'ADMIN')) {
      throw new Error('Only owners and admins can create payment requests');
    }

    const requestId = generateId('PAY');
    const request: PaymentRequest = {
      id: requestId,
      guildId,
      payee,
      amount,
      currency,
      description,
      requiredSignatures: guild.config.treasuryRules.requiredSigners,
      signatures: [],
      status: 'pending',
      createdAt: new Date(),
    };

    this.paymentRequests.set(requestId, request);

    logAuditAction('PAYMENT_REQUEST_CREATED', requester, {
      requestId,
      guildId,
      payee,
      amount,
      currency,
    });

    this.emit('paymentRequestCreated', request);

    return request;
  }

  /**
   * Sign a payment request
   */
  signPaymentRequest(requestId: string, signer: string, approved: boolean): PaymentRequest {
    const request = this.paymentRequests.get(requestId);
    if (!request) {
      throw new Error(`Payment request ${requestId} not found`);
    }

    if (request.status !== 'pending') {
      throw new Error('Payment request is not pending');
    }

    const guild = this.guilds.get(request.guildId);
    if (!guild) {
      throw new Error(`Guild ${request.guildId} not found`);
    }

    // Verify signer is authorized
    const member = guild.members.find((m) => m.wallet === signer && m.isSigner);
    if (!member) {
      throw new Error('Signer is not authorized');
    }

    // Check if already signed
    if (request.signatures.some((s) => s.signer === signer)) {
      throw new Error('Already signed this request');
    }

    // Add signature
    request.signatures.push({
      signer,
      approved,
      timestamp: new Date(),
    });

    // Check if approved
    const approvals = request.signatures.filter((s) => s.approved).length;
    const rejections = request.signatures.filter((s) => !s.approved).length;
    const totalSigners = guild.members.filter((m) => m.isSigner).length;

    if (approvals >= request.requiredSignatures) {
      request.status = 'approved';
    } else if (rejections > totalSigners - request.requiredSignatures) {
      request.status = 'rejected';
    }

    logAuditAction('PAYMENT_SIGNED', signer, {
      requestId,
      approved,
      currentApprovals: approvals,
      required: request.requiredSignatures,
    });

    this.emit('paymentSigned', { requestId, signer, approved });

    return request;
  }

  /**
   * Execute an approved payment
   */
  async executePayment(
    requestId: string,
    treasuryWallet: Wallet
  ): Promise<TransactionResult> {
    const request = this.paymentRequests.get(requestId);
    if (!request) {
      throw new Error(`Payment request ${requestId} not found`);
    }

    if (request.status !== 'approved') {
      throw new Error('Payment request is not approved');
    }

    const guild = this.guilds.get(request.guildId);
    if (!guild) {
      throw new Error(`Guild ${request.guildId} not found`);
    }

    logger.info(`Executing payment: ${request.amount} ${request.currency} to ${request.payee}`);

    // Build payment transaction
    const paymentTx: Payment = {
      TransactionType: 'Payment',
      Account: treasuryWallet.address,
      Destination: request.payee,
      Amount: request.currency === 'XRP'
        ? XRPLClient.xrpToDrops(request.amount)
        : {
            currency: request.currency,
            issuer: treasuryWallet.address,
            value: request.amount,
          },
      Memos: [
        {
          Memo: {
            MemoType: Buffer.from('VERITY_GUILD_PAYMENT').toString('hex').toUpperCase(),
            MemoData: encodeMemoData({
              requestId,
              guildId: request.guildId,
              guildName: guild.name,
              description: request.description,
              signatures: request.signatures.length,
            }),
            MemoFormat: Buffer.from('application/json').toString('hex').toUpperCase(),
          },
        },
      ],
    };

    const result = await this.xrplClient.submitAndWait(paymentTx, treasuryWallet);

    if (result.success) {
      request.status = 'executed';
      request.executedAt = new Date();
      request.transactionHash = result.hash;

      logAuditAction('PAYMENT_EXECUTED', treasuryWallet.address, {
        requestId,
        guildId: request.guildId,
        payee: request.payee,
        amount: request.amount,
        currency: request.currency,
        transactionHash: result.hash,
      });

      this.emit('paymentExecuted', request);
    }

    return result;
  }

  /**
   * Execute automated payroll
   */
  async executeVerifiedPayroll(
    guildId: string,
    treasuryWallet: Wallet
  ): Promise<PayrollExecution> {
    const guild = this.guilds.get(guildId);
    if (!guild) {
      throw new Error(`Guild ${guildId} not found`);
    }

    const rules = guild.config.treasuryRules;
    if (!rules.recurringPayments || rules.recurringPayments.length === 0) {
      throw new Error('No recurring payments configured');
    }

    logger.info(`Executing payroll for guild: ${guild.name}`);

    const executionId = generateId('PRL');
    const period = new Date().toISOString().substring(0, 7); // YYYY-MM

    const payments: PayrollExecution['payments'] = [];
    let totalAmount = BigInt(0);

    // Convert incoming revenue to XRP if configured
    if (rules.autoXRPConversion) {
      // In production, this would execute DEX trades
      logger.info('Auto XRP conversion enabled');
    }

    // Execute each recurring payment
    for (const payment of rules.recurringPayments) {
      if (!payment.enabled) continue;

      const paymentTx: Payment = {
        TransactionType: 'Payment',
        Account: treasuryWallet.address,
        Destination: payment.payee,
        Amount: payment.currency === 'XRP'
          ? XRPLClient.xrpToDrops(payment.amount)
          : {
              currency: payment.currency,
              issuer: treasuryWallet.address,
              value: payment.amount,
            },
        Memos: [
          {
            Memo: {
              MemoType: Buffer.from('VERITY_PAYROLL').toString('hex').toUpperCase(),
              MemoData: encodeMemoData({
                executionId,
                guildId,
                period,
                description: payment.description,
              }),
              MemoFormat: Buffer.from('application/json').toString('hex').toUpperCase(),
            },
          },
        ],
      };

      const result = await this.xrplClient.submitAndWait(paymentTx, treasuryWallet);

      payments.push({
        payee: payment.payee,
        amount: payment.amount,
        transactionHash: result.success ? result.hash : undefined,
        status: result.success ? 'completed' : 'failed',
      });

      if (result.success && payment.currency === 'XRP') {
        totalAmount += BigInt(XRPLClient.xrpToDrops(payment.amount));
      }
    }

    const execution: PayrollExecution = {
      id: executionId,
      guildId,
      period,
      totalAmount: totalAmount.toString(),
      currency: 'XRP',
      payments,
      executedAt: new Date(),
    };

    // Store payroll history
    const history = this.payrollHistory.get(guildId) || [];
    history.push(execution);
    this.payrollHistory.set(guildId, history);

    logAuditAction('PAYROLL_EXECUTED', treasuryWallet.address, {
      executionId,
      guildId,
      period,
      totalPayments: payments.length,
      totalAmount: execution.totalAmount,
    });

    this.emit('payrollExecuted', execution);

    return execution;
  }

  /**
   * Distribute revenue to members based on shares
   */
  async distributeRevenue(
    guildId: string,
    treasuryWallet: Wallet,
    totalAmount: string,
    currency: string
  ): Promise<Array<{ member: string; amount: string; hash?: string }>> {
    const guild = this.guilds.get(guildId);
    if (!guild) {
      throw new Error(`Guild ${guildId} not found`);
    }

    if (!guild.config.treasuryRules.revenueSharing.enabled) {
      throw new Error('Revenue sharing is not enabled');
    }

    logger.info(`Distributing ${totalAmount} ${currency} revenue for guild: ${guild.name}`);

    const distributions: Array<{ member: string; amount: string; hash?: string }> = [];
    const totalShares = guild.members.reduce((sum, m) => sum + m.shares, 0);

    for (const member of guild.members) {
      if (member.shares === 0) continue;

      // Calculate member's share
      const sharePercentage = member.shares / totalShares;
      const memberAmount = (parseFloat(totalAmount) * sharePercentage).toFixed(6);

      if (parseFloat(memberAmount) <= 0) continue;

      // Execute payment
      const paymentTx: Payment = {
        TransactionType: 'Payment',
        Account: treasuryWallet.address,
        Destination: member.wallet,
        Amount: currency === 'XRP'
          ? XRPLClient.xrpToDrops(memberAmount)
          : {
              currency,
              issuer: treasuryWallet.address,
              value: memberAmount,
            },
        Memos: [
          {
            Memo: {
              MemoType: Buffer.from('VERITY_REVENUE_SHARE').toString('hex').toUpperCase(),
              MemoData: encodeMemoData({
                guildId,
                sharePercentage: sharePercentage * 100,
              }),
              MemoFormat: Buffer.from('application/json').toString('hex').toUpperCase(),
            },
          },
        ],
      };

      const result = await this.xrplClient.submitAndWait(paymentTx, treasuryWallet);

      distributions.push({
        member: member.wallet,
        amount: memberAmount,
        hash: result.success ? result.hash : undefined,
      });
    }

    logAuditAction('REVENUE_DISTRIBUTED', treasuryWallet.address, {
      guildId,
      totalAmount,
      currency,
      distributions: distributions.length,
    });

    this.emit('revenueDistributed', { guildId, distributions });

    return distributions;
  }

  /**
   * Create a governance proposal
   */
  createProposal(
    guildId: string,
    proposer: string,
    proposal: {
      title: string;
      description: string;
      type: GuildProposal['type'];
      payload: Record<string, unknown>;
    }
  ): GuildProposal {
    const guild = this.guilds.get(guildId);
    if (!guild) {
      throw new Error(`Guild ${guildId} not found`);
    }

    // Verify proposer is a member with shares
    const member = guild.members.find((m) => m.wallet === proposer);
    if (!member || member.shares === 0) {
      throw new Error('Proposer must be a member with shares');
    }

    const proposalId = generateId('PRP');
    const votingPeriodMs = guild.config.governanceRules.votingPeriod * 60 * 60 * 1000;

    const guildProposal: GuildProposal = {
      id: proposalId,
      guildId,
      proposer,
      title: proposal.title,
      description: proposal.description,
      type: proposal.type,
      payload: proposal.payload,
      votes: [],
      status: 'active',
      createdAt: new Date(),
      votingEndsAt: new Date(Date.now() + votingPeriodMs),
    };

    const proposals = this.guildProposals.get(guildId) || [];
    proposals.push(guildProposal);
    this.guildProposals.set(guildId, proposals);

    logAuditAction('PROPOSAL_CREATED', proposer, {
      proposalId,
      guildId,
      type: proposal.type,
      title: proposal.title,
    });

    this.emit('proposalCreated', guildProposal);

    return guildProposal;
  }

  /**
   * Vote on a proposal
   */
  voteOnProposal(proposalId: string, voter: string, support: boolean): GuildProposal {
    // Find the proposal
    let proposal: GuildProposal | undefined;
    let guildId: string | undefined;

    for (const [gId, proposals] of this.guildProposals) {
      const found = proposals.find((p) => p.id === proposalId);
      if (found) {
        proposal = found;
        guildId = gId;
        break;
      }
    }

    if (!proposal || !guildId) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    if (proposal.status !== 'active') {
      throw new Error('Proposal is not active');
    }

    if (new Date() > proposal.votingEndsAt) {
      throw new Error('Voting period has ended');
    }

    const guild = this.guilds.get(guildId);
    if (!guild) {
      throw new Error(`Guild ${guildId} not found`);
    }

    // Verify voter is a member
    const member = guild.members.find((m) => m.wallet === voter);
    if (!member || member.shares === 0) {
      throw new Error('Voter must be a member with shares');
    }

    // Check if already voted
    if (proposal.votes.some((v) => v.voter === voter)) {
      throw new Error('Already voted on this proposal');
    }

    // Add vote
    proposal.votes.push({
      voter,
      shares: member.shares,
      support,
      timestamp: new Date(),
    });

    // Check if quorum reached and proposal passes
    const totalVotingShares = proposal.votes.reduce((sum, v) => sum + v.shares, 0);
    const totalShares = guild.members.reduce((sum, m) => sum + m.shares, 0);
    const quorumPercentage = (totalVotingShares / totalShares) * 10000;

    if (quorumPercentage >= guild.config.governanceRules.quorumPercentage) {
      const forVotes = proposal.votes
        .filter((v) => v.support)
        .reduce((sum, v) => sum + v.shares, 0);
      const againstVotes = proposal.votes
        .filter((v) => !v.support)
        .reduce((sum, v) => sum + v.shares, 0);

      if (forVotes > againstVotes) {
        proposal.status = 'passed';
      } else {
        proposal.status = 'failed';
      }
    }

    logAuditAction('PROPOSAL_VOTE', voter, {
      proposalId,
      support,
      shares: member.shares,
    });

    this.emit('proposalVoted', { proposalId, voter, support });

    return proposal;
  }

  /**
   * Get guild by ID
   */
  getGuild(guildId: string): Guild | undefined {
    return this.guilds.get(guildId);
  }

  /**
   * Get all guilds
   */
  getAllGuilds(): Guild[] {
    return Array.from(this.guilds.values());
  }

  /**
   * Get guilds by member wallet
   */
  getGuildsByMember(wallet: string): Guild[] {
    return Array.from(this.guilds.values()).filter((guild) =>
      guild.members.some((m) => m.wallet === wallet)
    );
  }

  /**
   * Get payment requests for a guild
   */
  getPaymentRequests(guildId: string): PaymentRequest[] {
    return Array.from(this.paymentRequests.values()).filter(
      (r) => r.guildId === guildId
    );
  }

  /**
   * Get proposals for a guild
   */
  getGuildProposals(guildId: string): GuildProposal[] {
    return this.guildProposals.get(guildId) || [];
  }

  /**
   * Get payroll history for a guild
   */
  getPayrollHistory(guildId: string): PayrollExecution[] {
    return this.payrollHistory.get(guildId) || [];
  }

  /**
   * Get treasury audit trail
   */
  getGuildAuditTrail(guildId: string): Record<string, unknown> {
    const guild = this.guilds.get(guildId);
    if (!guild) {
      throw new Error(`Guild ${guildId} not found`);
    }

    const paymentRequests = this.getPaymentRequests(guildId);
    const payrollHistory = this.getPayrollHistory(guildId);
    const proposals = this.getGuildProposals(guildId);

    return {
      guild: {
        id: guild.id,
        name: guild.name,
        status: guild.status,
        createdAt: guild.createdAt,
        verificationHash: guild.verificationHash,
      },
      treasury: {
        wallet: guild.treasuryWallet,
        requiredSigners: guild.config.treasuryRules.requiredSigners,
        totalSigners: guild.members.filter((m) => m.isSigner).length,
      },
      members: guild.members.map((m) => ({
        wallet: m.wallet,
        role: m.role,
        shares: m.shares,
        isSigner: m.isSigner,
        joinedAt: m.joinedAt,
      })),
      activity: {
        totalPaymentRequests: paymentRequests.length,
        executedPayments: paymentRequests.filter((r) => r.status === 'executed').length,
        payrollExecutions: payrollHistory.length,
        proposals: proposals.length,
        passedProposals: proposals.filter((p) => p.status === 'passed').length,
      },
    };
  }

  /**
   * Validate guild configuration
   */
  private validateGuildConfig(config: GuildConfig): void {
    if (!config.name || config.name.length < 1) {
      throw new Error('Guild name is required');
    }
    if (config.treasuryRules.requiredSigners < 1) {
      throw new Error('At least 1 signer is required');
    }
    if (config.treasuryRules.requiredSigners > config.treasuryRules.totalSigners) {
      throw new Error('Required signers cannot exceed total signers');
    }
    if (config.governanceRules.quorumPercentage < 1 || config.governanceRules.quorumPercentage > 10000) {
      throw new Error('Quorum percentage must be between 1 and 10000 basis points');
    }
  }
}

export default VerityGuildTreasury;
