/**
 * Verity Protocol - Guild Repository
 * 
 * Database operations for guilds (DAOs).
 */

import { prisma } from '../client.js';
import { 
  Guild, 
  GuildMember, 
  GuildRole, 
  GuildTransaction,
  GuildTransactionType,
  Prisma 
} from '@prisma/client';
import { logger } from '../../utils/logger.js';

export type GuildWithMembers = Guild & {
  members: GuildMember[];
  _count: { members: number };
};

/**
 * Guild Repository
 */
export const guildRepository = {
  /**
   * Create a new guild
   */
  async create(data: {
    ownerId: string;
    name: string;
    description?: string;
    treasuryWallet: string;
    membershipFee?: number;
    minStakeToJoin?: number;
    isPublic?: boolean;
  }): Promise<Guild> {
    const guild = await prisma.guild.create({
      data: {
        ownerId: data.ownerId,
        name: data.name,
        description: data.description,
        treasuryWallet: data.treasuryWallet,
        membershipFee: data.membershipFee,
        minStakeToJoin: data.minStakeToJoin,
        isPublic: data.isPublic ?? true,
        totalMembers: 1, // Owner counts
      },
    });

    // Add owner as member
    await prisma.guildMember.create({
      data: {
        guildId: guild.id,
        userId: data.ownerId,
        wallet: data.treasuryWallet, // Owner's wallet, will need to be passed
        role: 'OWNER',
        sharePercentage: 100,
      },
    });

    logger.info('Guild created', { id: guild.id, name: guild.name });
    return guild;
  },

  /**
   * Get guild by ID
   */
  async getById(id: string): Promise<GuildWithMembers | null> {
    return prisma.guild.findUnique({
      where: { id },
      include: {
        members: {
          where: { leftAt: null },
          orderBy: { sharePercentage: 'desc' },
        },
        _count: { select: { members: true } },
      },
    });
  },

  /**
   * Get guild by name
   */
  async getByName(name: string): Promise<Guild | null> {
    return prisma.guild.findUnique({
      where: { name },
    });
  },

  /**
   * Get all public guilds
   */
  async getPublicGuilds(options?: {
    page?: number;
    limit?: number;
  }): Promise<{ guilds: Guild[]; total: number }> {
    const { page = 1, limit = 20 } = options || {};
    const skip = (page - 1) * limit;

    const [guilds, total] = await Promise.all([
      prisma.guild.findMany({
        where: {
          isPublic: true,
          dissolvedAt: null,
        },
        skip,
        take: limit,
        orderBy: { totalMembers: 'desc' },
        include: {
          _count: { select: { members: true } },
        },
      }),
      prisma.guild.count({
        where: { isPublic: true, dissolvedAt: null },
      }),
    ]);

    return { guilds, total };
  },

  /**
   * Get user's guilds
   */
  async getUserGuilds(userId: string): Promise<Guild[]> {
    const memberships = await prisma.guildMember.findMany({
      where: {
        userId,
        leftAt: null,
      },
      include: { guild: true },
    });

    return memberships.map(m => m.guild);
  },

  /**
   * Add member to guild
   */
  async addMember(data: {
    guildId: string;
    userId: string;
    wallet: string;
    role?: GuildRole;
  }): Promise<GuildMember> {
    const guild = await prisma.guild.findUnique({
      where: { id: data.guildId },
    });

    if (!guild) {
      throw new Error('Guild not found');
    }

    if (guild.dissolvedAt) {
      throw new Error('Guild has been dissolved');
    }

    // Check if already a member
    const existing = await prisma.guildMember.findUnique({
      where: {
        guildId_userId: {
          guildId: data.guildId,
          userId: data.userId,
        },
      },
    });

    if (existing && !existing.leftAt) {
      throw new Error('Already a member of this guild');
    }

    const member = await prisma.guildMember.create({
      data: {
        guildId: data.guildId,
        userId: data.userId,
        wallet: data.wallet,
        role: data.role || 'MEMBER',
      },
    });

    // Update member count
    await prisma.guild.update({
      where: { id: data.guildId },
      data: { totalMembers: { increment: 1 } },
    });

    logger.info('Member joined guild', { 
      guildId: data.guildId, 
      userId: data.userId 
    });

    return member;
  },

  /**
   * Remove member from guild
   */
  async removeMember(guildId: string, userId: string): Promise<GuildMember> {
    const member = await prisma.guildMember.findUnique({
      where: {
        guildId_userId: { guildId, userId },
      },
    });

    if (!member) {
      throw new Error('Member not found');
    }

    if (member.role === 'OWNER') {
      throw new Error('Cannot remove guild owner');
    }

    const updated = await prisma.guildMember.update({
      where: { id: member.id },
      data: { leftAt: new Date() },
    });

    // Update member count
    await prisma.guild.update({
      where: { id: guildId },
      data: { totalMembers: { decrement: 1 } },
    });

    return updated;
  },

  /**
   * Update member role
   */
  async updateMemberRole(
    guildId: string, 
    userId: string, 
    role: GuildRole
  ): Promise<GuildMember> {
    return prisma.guildMember.update({
      where: {
        guildId_userId: { guildId, userId },
      },
      data: { role },
    });
  },

  /**
   * Update member share percentage
   */
  async updateMemberShare(
    guildId: string, 
    userId: string, 
    sharePercentage: number
  ): Promise<GuildMember> {
    if (sharePercentage < 0 || sharePercentage > 100) {
      throw new Error('Share percentage must be between 0 and 100');
    }

    return prisma.guildMember.update({
      where: {
        guildId_userId: { guildId, userId },
      },
      data: { sharePercentage },
    });
  },

  /**
   * Record treasury transaction
   */
  async recordTransaction(data: {
    guildId: string;
    type: GuildTransactionType;
    amount: number;
    currency?: string;
    fromWallet?: string;
    toWallet?: string;
    description?: string;
    txHash?: string;
  }): Promise<GuildTransaction> {
    const tx = await prisma.guildTransaction.create({
      data: {
        guildId: data.guildId,
        type: data.type,
        amount: data.amount,
        currency: data.currency || 'XRP',
        fromWallet: data.fromWallet,
        toWallet: data.toWallet,
        description: data.description,
        txHash: data.txHash,
      },
    });

    // Update treasury balance for deposits/withdrawals
    if (data.type === 'DEPOSIT' || data.type === 'FEE_COLLECTION' || data.type === 'MEMBERSHIP_FEE') {
      await prisma.guild.update({
        where: { id: data.guildId },
        data: { 
          treasuryBalance: { increment: data.amount },
          totalRevenue: { increment: data.amount },
        },
      });
    } else if (data.type === 'WITHDRAWAL' || data.type === 'REVENUE_DISTRIBUTION') {
      await prisma.guild.update({
        where: { id: data.guildId },
        data: { treasuryBalance: { decrement: data.amount } },
      });
    }

    return tx;
  },

  /**
   * Get guild transactions
   */
  async getTransactions(guildId: string, options?: {
    type?: GuildTransactionType;
    page?: number;
    limit?: number;
  }): Promise<{ transactions: GuildTransaction[]; total: number }> {
    const { type, page = 1, limit = 50 } = options || {};
    const skip = (page - 1) * limit;

    const where: Prisma.GuildTransactionWhereInput = { guildId };
    if (type) where.type = type;

    const [transactions, total] = await Promise.all([
      prisma.guildTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.guildTransaction.count({ where }),
    ]);

    return { transactions, total };
  },

  /**
   * Dissolve guild
   */
  async dissolve(guildId: string): Promise<Guild> {
    return prisma.guild.update({
      where: { id: guildId },
      data: { dissolvedAt: new Date() },
    });
  },

  /**
   * Get guild statistics
   */
  async getStats(): Promise<{
    totalGuilds: number;
    activeGuilds: number;
    totalMembers: number;
    totalTreasuryValue: number;
  }> {
    const [totalGuilds, activeGuilds, membersResult, treasuryResult] = await Promise.all([
      prisma.guild.count(),
      prisma.guild.count({ where: { dissolvedAt: null } }),
      prisma.guild.aggregate({
        _sum: { totalMembers: true },
        where: { dissolvedAt: null },
      }),
      prisma.guild.aggregate({
        _sum: { treasuryBalance: true },
        where: { dissolvedAt: null },
      }),
    ]);

    return {
      totalGuilds,
      activeGuilds,
      totalMembers: membersResult._sum.totalMembers || 0,
      totalTreasuryValue: Number(treasuryResult._sum.treasuryBalance || 0),
    };
  },
};

export default guildRepository;
