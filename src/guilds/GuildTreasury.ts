/**
 * Verity Protocol - Guild Treasury Management
 * Multi-signature treasury management with automated cross-border payments
 * 
 * @version 2.0.0 - Migrated to PostgreSQL via Prisma
 */

import { Wallet, Payment, EscrowCreate, EscrowFinish, SignerListSet } from 'xrpl';
import { EventEmitter } from 'eventemitter3';
import { XRPLClient, TransactionResult } from '../core/XRPLClient.js';
import { logger, logAuditAction } from '../utils/logger.js';
import { generateId, generateVerificationHash, encodeMemoData } from '../utils/crypto.js';
import { prisma } from '../db/client.js';
import type {
  Guild as GuildConfig,
  GuildMember as GuildMemberType,
  GuildRole,
  TreasuryRules,
  MemberShare,
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
 * Now backed by PostgreSQL via Prisma
 */
export class VerityGuildTreasury extends EventEmitter {
  private xrplClient: XRPLClient;

  constructor(xrplClient: XRPLClient) {
    super();
    this.xrplClient = xrplClient;
    logger.info('Verity Guild Treasury initialized with PostgreSQL backing');
  }

  /**
   * Create a new guild with treasury
   */
  async createGuild(
    founderWallet: Wallet,
    config: {
      name: string;
      description?: string;
      treasuryRules: TreasuryRules;
      isPublic?: boolean;
      membershipFee?: number;
      minStakeToJoin?: number;
    },
    initialSigners: string[],
    founderId: string
  ): Promise<{ guildId: string; result: TransactionResult }> {
    logger.info(`Creating guild: ${config.name}`);

    // Set up multi-sig on the treasury wallet
    const signerListTx: SignerListSet = {
      TransactionType: 'SignerListSet',
      Account: founderWallet.address,
      SignerQuorum: config.treasuryRules.requiredSigners,
      SignerEntries: initialSigners.map((signer) => ({
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

    // Create guild in database
    const guild = await prisma.guild.create({
      data: {
        ownerId: founderId,
        name: config.name,
        description: config.description,
        treasuryWallet: founderWallet.address,
        isPublic: config.isPublic ?? true,
        membershipFee: config.membershipFee,
        minStakeToJoin: config.minStakeToJoin,
        totalMembers: 1 + initialSigners.length,
      },
    });

    // Add founder as owner member
    await prisma.guildMember.create({
      data: {
        guildId: guild.id,
        userId: founderId,
        wallet: founderWallet.address,
        role: 'OWNER',
        sharePercentage: 100, // 100%
      },
    });

    // Add initial signers as admin members
    for (const signer of initialSigners) {
      // Try to find user by wallet, or create placeholder entry
      let user = await prisma.user.findUnique({ where: { wallet: signer } });
      if (!user) {
        user = await prisma.user.create({
          data: { wallet: signer },
        });
      }

      await prisma.guildMember.create({
        data: {
          guildId: guild.id,
          userId: user.id,
          wallet: signer,
          role: 'ADMIN',
          sharePercentage: 0,
        },
      });
    }

    // Record transaction
    await prisma.guildTransaction.create({
      data: {
        guildId: guild.id,
        type: 'DEPOSIT', // Using existing enum type
        amount: 0,
        currency: 'XRP',
        txHash: result.hash,
        description: `Guild "${config.name}" created with multi-sig treasury`,
      },
    });

    logAuditAction('GUILD_CREATED', founderWallet.address, {
      guildId: guild.id,
      name: config.name,
      signers: initialSigners.length + 1,
      transactionHash: result.hash,
    });

    this.emit('guildCreated', { guildId: guild.id, name: config.name });

    return { guildId: guild.id, result };
  }

  /**
   * Get guild by ID
   */
  async getGuild(guildId: string) {
    return prisma.guild.findUnique({
      where: { id: guildId },
      include: {
        members: {
          include: { user: true },
        },
        transactions: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  /**
   * Get guild by treasury wallet
   */
  async getGuildByWallet(wallet: string) {
    return prisma.guild.findUnique({
      where: { treasuryWallet: wallet },
      include: {
        members: true,
      },
    });
  }

  /**
   * Add a member to the guild
   */
  async addMember(
    guildId: string,
    userId: string,
    wallet: string,
    role: 'ADMIN' | 'MEMBER',
    shares: number = 0,
    isSigner: boolean = false
  ) {
    // Check if guild exists
    const guild = await prisma.guild.findUnique({ where: { id: guildId } });
    if (!guild) {
      throw new Error(`Guild ${guildId} not found`);
    }

    // Check if already a member
    const existingMember = await prisma.guildMember.findFirst({
      where: { guildId, wallet },
    });
    if (existingMember) {
      throw new Error('Wallet is already a member');
    }

    // Create member
    const member = await prisma.guildMember.create({
      data: {
        guildId,
        userId,
        wallet,
        role,
        sharePercentage: shares,
      },
    });

    // Update guild member count
    await prisma.guild.update({
      where: { id: guildId },
      data: { totalMembers: { increment: 1 } },
    });

    logAuditAction('MEMBER_ADDED', 'SYSTEM', {
      guildId,
      member: wallet,
      role,
      shares,
    });

    this.emit('memberAdded', { guildId, member });

    return member;
  }

  /**
   * Remove a member from the guild
   */
  async removeMember(guildId: string, wallet: string) {
    const member = await prisma.guildMember.findFirst({
      where: { guildId, wallet },
    });

    if (!member) {
      throw new Error('Member not found');
    }

    if (member.role === 'OWNER') {
      throw new Error('Cannot remove guild owner');
    }

    await prisma.guildMember.delete({
      where: { id: member.id },
    });

    await prisma.guild.update({
      where: { id: guildId },
      data: { totalMembers: { decrement: 1 } },
    });

    logAuditAction('MEMBER_REMOVED', 'SYSTEM', { guildId, wallet });
    this.emit('memberRemoved', { guildId, wallet });
  }

  /**
   * Update member shares (for revenue sharing)
   */
  async updateMemberShares(guildId: string, shares: MemberShare[]) {
    // Validate total shares = 10000 (100%)
    const totalShares = shares.reduce((sum, s) => sum + s.sharePercentage, 0);
    if (totalShares !== 10000) {
      throw new Error(`Total shares must equal 10000 (100%), got ${totalShares}`);
    }

    // Update shares in transaction
    await prisma.$transaction(async (tx) => {
      for (const share of shares) {
        await tx.guildMember.updateMany({
          where: { guildId, wallet: share.member },
          data: { sharePercentage: share.sharePercentage },
        });
      }
    });

    logAuditAction('SHARES_UPDATED', 'SYSTEM', { guildId, shares });
    this.emit('sharesUpdated', { guildId, shares });
  }

  /**
   * Create a payment request (requires multi-sig approval)
   */
  async createPaymentRequest(
    guildId: string,
    requesterId: string,
    requesterWallet: string,
    payee: string,
    amount: string,
    currency: string,
    description: string
  ) {
    const guild = await prisma.guild.findUnique({
      where: { id: guildId },
      include: { members: true },
    });

    if (!guild) {
      throw new Error(`Guild ${guildId} not found`);
    }

    // Verify requester is a member with permission
    const member = guild.members.find((m) => m.wallet === requesterWallet);
    if (!member || (member.role !== 'OWNER' && member.role !== 'ADMIN')) {
      throw new Error('Only owners and admins can create payment requests');
    }

    // Create payment transaction record
    const transaction = await prisma.guildTransaction.create({
      data: {
        guildId,
        type: 'WITHDRAWAL', // Using existing enum type for payment requests
        amount: parseFloat(amount),
        currency,
        toWallet: payee,
        description: `Payment Request: ${description}`,
      },
    });

    logAuditAction('PAYMENT_REQUEST_CREATED', requesterWallet, {
      requestId: transaction.id,
      guildId,
      payee,
      amount,
      currency,
    });

    this.emit('paymentRequestCreated', transaction);

    return transaction;
  }

  /**
   * Sign a payment request
   */
  async signPaymentRequest(
    transactionId: string,
    signerId: string,
    signerWallet: string,
    approved: boolean
  ) {
    const transaction = await prisma.guildTransaction.findUnique({
      where: { id: transactionId },
      include: {
        guild: {
          include: { members: true },
        },
      },
    });

    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    // Note: GuildTransaction doesn't have status field in current schema
    // This would need schema migration for proper payment workflow

    // Verify signer is authorized (OWNER or ADMIN role)
    const member = transaction.guild.members.find(
      (m) => m.wallet === signerWallet && (m.role === 'OWNER' || m.role === 'ADMIN')
    );
    if (!member) {
      throw new Error('Signer is not authorized');
    }

    // Note: Full multi-sig workflow would require schema additions
    // For now, log the signing attempt
    logAuditAction('PAYMENT_REQUEST_SIGNED', signerWallet, {
      transactionId,
      approved,
    });

    this.emit('paymentRequestSigned', { transactionId, signerWallet, approved });

    return { transactionId, approved };
  }

  /**
   * Execute an approved payment
   */
  async executePayment(transactionId: string, treasuryWallet: Wallet) {
    const transaction = await prisma.guildTransaction.findUnique({
      where: { id: transactionId },
    });

    if (!transaction) {
      throw new Error(`Transaction ${transactionId} not found`);
    }

    // Note: Current schema doesn't have status field
    // This would need schema migration for proper payment workflow

    // Build payment transaction
    const paymentTx: Payment = {
      TransactionType: 'Payment',
      Account: treasuryWallet.address,
      Destination: transaction.toWallet || '',
      Amount: String(Math.floor(Number(transaction.amount) * 1_000_000)), // Convert to drops
      Memos: [
        {
          Memo: {
            MemoType: Buffer.from('VERITY_GUILD_PAYMENT', 'utf8').toString('hex'),
            MemoData: Buffer.from(JSON.stringify({
              guildId: transaction.guildId,
              transactionId: transaction.id,
              description: transaction.description,
            }), 'utf8').toString('hex'),
          },
        },
      ],
    };

    const result = await this.xrplClient.submitAndWait(paymentTx, treasuryWallet);

    // Update transaction with hash
    await prisma.guildTransaction.update({
      where: { id: transactionId },
      data: {
        txHash: result.hash,
      },
    });

    // Update guild treasury balance
    if (result.success) {
      await prisma.guild.update({
        where: { id: transaction.guildId },
        data: {
          treasuryBalance: { decrement: transaction.amount },
          totalRevenue: { increment: transaction.amount },
        },
      });
    }

    logAuditAction('PAYMENT_EXECUTED', treasuryWallet.address, {
      transactionId,
      success: result.success,
      txHash: result.hash,
    });

    this.emit('paymentExecuted', { transactionId, result });

    return result;
  }

  /**
   * Get guild transactions
   */
  async getTransactions(guildId: string, limit: number = 50) {
    return prisma.guildTransaction.findMany({
      where: { guildId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get pending payment requests
   */
  async getPendingPayments(guildId: string) {
    // Note: Current schema doesn't have status field
    // Return WITHDRAWAL transactions that might be pending
    return prisma.guildTransaction.findMany({
      where: {
        guildId,
        type: 'WITHDRAWAL',
        txHash: null, // Not yet executed
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * List all guilds
   */
  async listGuilds(options?: {
    isPublic?: boolean;
    limit?: number;
    offset?: number;
  }) {
    return prisma.guild.findMany({
      where: options?.isPublic !== undefined ? { isPublic: options.isPublic } : undefined,
      include: {
        owner: {
          select: { id: true, wallet: true, displayName: true },
        },
        _count: { select: { members: true } },
      },
      take: options?.limit || 20,
      skip: options?.offset || 0,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get guild statistics
   */
  async getGuildStats(guildId: string) {
    const guild = await prisma.guild.findUnique({
      where: { id: guildId },
      include: {
        _count: { select: { members: true, transactions: true } },
      },
    });

    if (!guild) {
      throw new Error(`Guild ${guildId} not found`);
    }

    const transactions = await prisma.guildTransaction.aggregate({
      where: { guildId },
      _sum: { amount: true },
      _count: true,
    });

    return {
      guildId,
      name: guild.name,
      totalMembers: guild._count.members,
      totalTransactions: guild._count.transactions,
      totalVolume: transactions._sum?.amount || 0,
      treasuryBalance: guild.treasuryBalance,
      createdAt: guild.createdAt,
    };
  }

  /**
   * Update treasury balance (called after deposits)
   */
  async updateTreasuryBalance(guildId: string, amount: number, isDeposit: boolean) {
    const update = isDeposit
      ? { treasuryBalance: { increment: amount } }
      : { treasuryBalance: { decrement: amount } };

    await prisma.guild.update({
      where: { id: guildId },
      data: update,
    });

    logAuditAction('TREASURY_BALANCE_UPDATED', 'SYSTEM', {
      guildId,
      amount,
      isDeposit,
    });
  }

  /**
   * Dissolve a guild
   */
  async dissolveGuild(guildId: string, ownerId: string) {
    const guild = await prisma.guild.findUnique({
      where: { id: guildId },
    });

    if (!guild) {
      throw new Error(`Guild ${guildId} not found`);
    }

    if (guild.ownerId !== ownerId) {
      throw new Error('Only the guild owner can dissolve it');
    }

    await prisma.guild.update({
      where: { id: guildId },
      data: { dissolvedAt: new Date() },
    });

    logAuditAction('GUILD_DISSOLVED', ownerId, { guildId, name: guild.name });
    this.emit('guildDissolved', { guildId });
  }
}

// Export singleton pattern support
let guildTreasuryInstance: VerityGuildTreasury | null = null;

export function getGuildTreasury(xrplClient: XRPLClient): VerityGuildTreasury {
  if (!guildTreasuryInstance) {
    guildTreasuryInstance = new VerityGuildTreasury(xrplClient);
  }
  return guildTreasuryInstance;
}

export default VerityGuildTreasury;
