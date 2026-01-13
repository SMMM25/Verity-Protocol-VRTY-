/**
 * Verity Protocol - Guilds Routes (Database-backed)
 * 
 * @module api/routes/guilds
 * @description Production-ready multi-signature treasury management endpoints for DAOs and groups.
 * All data is persisted to PostgreSQL via Prisma repositories.
 * 
 * The Guilds module enables decentralized treasury management with:
 * - Guild creation with treasury wallet
 * - Multi-role member management (OWNER, ADMIN, MEMBER)
 * - Revenue sharing based on member shares
 * - Treasury transaction tracking
 * - Full audit trail
 * 
 * Key concepts:
 * - **Guild**: A group with a shared treasury wallet
 * - **Member**: User with assigned role and revenue share
 * - **Transaction**: Record of treasury deposits, withdrawals, distributions
 * - **Shares**: Percentage ownership for revenue distribution (0-100%)
 * 
 * @version 2.0.0
 * @since Phase 2 - Database Integration
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { guildRepository } from '../../db/repositories/guildRepository.js';
import { stakeRepository } from '../../db/repositories/stakeRepository.js';
import { prisma, checkDatabaseHealth } from '../../db/client.js';
import { logger } from '../../utils/logger.js';
import type { GuildRole, GuildTransactionType } from '@prisma/client';

const router = Router();

// ============================================================
// CONSTANTS
// ============================================================

const MIN_STAKE_TO_CREATE_GUILD = 10000; // 10,000 VRTY to create a guild
const VALID_ROLES: GuildRole[] = ['OWNER', 'ADMIN', 'MEMBER'];
const VALID_TX_TYPES: GuildTransactionType[] = [
  'DEPOSIT',
  'WITHDRAWAL',
  'REVENUE_DISTRIBUTION',
  'MEMBERSHIP_FEE',
  'FEE_COLLECTION',
];

// ============================================================
// VALIDATION SCHEMAS
// ============================================================

/**
 * Schema for creating a guild
 */
const createGuildSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters').max(100, 'Name too long'),
  description: z.string().max(2000).optional(),
  treasuryWallet: z.string().min(25, 'Invalid XRPL wallet address'),
  ownerWallet: z.string().min(25, 'Owner wallet required'),
  membershipFee: z.number().min(0).optional(),
  minStakeToJoin: z.number().min(0).optional(),
  isPublic: z.boolean().optional(),
  logoUrl: z.string().url().optional(),
  websiteUrl: z.string().url().optional(),
});

/**
 * Schema for adding a member
 */
const addMemberSchema = z.object({
  wallet: z.string().min(25, 'Invalid wallet address'),
  role: z.enum(['ADMIN', 'MEMBER']).optional(),
  sharePercentage: z.number().min(0).max(100).optional(),
  requesterWallet: z.string().min(25, 'Requester wallet required'),
});

/**
 * Schema for recording transactions
 */
const transactionSchema = z.object({
  type: z.enum(['DEPOSIT', 'WITHDRAWAL', 'REVENUE_DISTRIBUTION', 'MEMBERSHIP_FEE', 'FEE_COLLECTION']),
  amount: z.number().positive('Amount must be positive'),
  currency: z.string().default('XRP'),
  fromWallet: z.string().optional(),
  toWallet: z.string().optional(),
  description: z.string().max(500).optional(),
  txHash: z.string().optional(),
  requesterWallet: z.string().min(25, 'Requester wallet required'),
});

/**
 * Schema for revenue distribution
 */
const distributeRevenueSchema = z.object({
  totalAmount: z.number().positive('Amount must be positive'),
  currency: z.string().default('XRP'),
  requesterWallet: z.string().min(25, 'Requester wallet required'),
  txHash: z.string().optional(),
});

/**
 * Schema for updating member
 */
const updateMemberSchema = z.object({
  role: z.enum(['ADMIN', 'MEMBER']).optional(),
  sharePercentage: z.number().min(0).max(100).optional(),
  requesterWallet: z.string().min(25, 'Requester wallet required'),
});

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Format guild for API response
 */
function formatGuild(guild: any) {
  return {
    id: guild.id,
    name: guild.name,
    description: guild.description,
    logoUrl: guild.logoUrl,
    websiteUrl: guild.websiteUrl,
    treasuryWallet: guild.treasuryWallet,
    treasuryBalance: Number(guild.treasuryBalance || 0).toString(),
    membershipFee: guild.membershipFee ? Number(guild.membershipFee).toString() : null,
    minStakeToJoin: guild.minStakeToJoin ? Number(guild.minStakeToJoin).toString() : null,
    isPublic: guild.isPublic,
    totalMembers: guild.totalMembers,
    totalRevenue: Number(guild.totalRevenue || 0).toString(),
    ownerId: guild.ownerId,
    createdAt: guild.createdAt,
    dissolvedAt: guild.dissolvedAt,
    memberCount: guild._count?.members || guild.totalMembers,
  };
}

/**
 * Format member for API response
 */
function formatMember(member: any) {
  return {
    id: member.id,
    wallet: member.wallet,
    userId: member.userId,
    role: member.role,
    sharePercentage: Number(member.sharePercentage).toString(),
    joinedAt: member.joinedAt,
    leftAt: member.leftAt,
  };
}

/**
 * Format transaction for API response
 */
function formatTransaction(tx: any) {
  return {
    id: tx.id,
    type: tx.type,
    amount: Number(tx.amount).toString(),
    currency: tx.currency,
    fromWallet: tx.fromWallet,
    toWallet: tx.toWallet,
    description: tx.description,
    txHash: tx.txHash,
    createdAt: tx.createdAt,
  };
}

/**
 * Check if wallet is guild owner or admin
 */
async function isGuildAdmin(guildId: string, wallet: string): Promise<boolean> {
  const member = await prisma.guildMember.findFirst({
    where: {
      guildId,
      wallet,
      leftAt: null,
      role: { in: ['OWNER', 'ADMIN'] },
    },
  });
  return !!member;
}

/**
 * Check if wallet is guild owner
 */
async function isGuildOwner(guildId: string, wallet: string): Promise<boolean> {
  const member = await prisma.guildMember.findFirst({
    where: {
      guildId,
      wallet,
      leftAt: null,
      role: 'OWNER',
    },
  });
  return !!member;
}

// ============================================================
// GUILD LIST & CREATION ENDPOINTS
// ============================================================

/**
 * @route GET /guilds
 * @summary List all guilds with filtering and pagination
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query['page'] as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query['limit'] as string, 10) || 20));
    const memberWallet = req.query['member'] as string | undefined;
    const publicOnly = req.query['public'] !== 'false';

    let guilds: any[];
    let total: number;

    if (memberWallet) {
      // Get guilds for specific member
      const memberGuilds = await prisma.guildMember.findMany({
        where: {
          wallet: memberWallet,
          leftAt: null,
        },
        include: {
          guild: {
            include: {
              _count: { select: { members: true } },
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
      });

      guilds = memberGuilds.map(m => m.guild);
      total = await prisma.guildMember.count({
        where: { wallet: memberWallet, leftAt: null },
      });
    } else {
      // Get all public guilds
      const result = await guildRepository.getPublicGuilds({ page, limit });
      guilds = result.guilds;
      total = result.total;
    }

    res.json({
      success: true,
      data: {
        guilds: guilds.map(formatGuild),
        filters: {
          member: memberWallet || null,
          publicOnly,
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
    logger.error('Error fetching guilds', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch guilds' },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  }
});

/**
 * @route POST /guilds/treasury
 * @summary Create a new guild with treasury (requires 10,000+ VRTY stake)
 */
router.post('/treasury', async (req: Request, res: Response) => {
  try {
    const validatedData = createGuildSchema.parse(req.body);

    // Check if name is already taken
    const existingGuild = await guildRepository.getByName(validatedData.name);
    if (existingGuild) {
      res.status(409).json({
        success: false,
        error: {
          code: 'NAME_TAKEN',
          message: 'A guild with this name already exists',
        },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    // Check if treasury wallet is already used
    const existingTreasury = await prisma.guild.findUnique({
      where: { treasuryWallet: validatedData.treasuryWallet },
    });
    if (existingTreasury) {
      res.status(409).json({
        success: false,
        error: {
          code: 'TREASURY_IN_USE',
          message: 'This treasury wallet is already used by another guild',
        },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    // Verify owner has sufficient stake (PROFESSIONAL tier minimum)
    const stake = await stakeRepository.getByWallet(validatedData.ownerWallet);
    if (!stake || Number(stake.amount) < MIN_STAKE_TO_CREATE_GUILD) {
      res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_STAKE',
          message: `Minimum ${MIN_STAKE_TO_CREATE_GUILD.toLocaleString()} VRTY stake required to create a guild`,
          details: {
            currentStake: stake ? Number(stake.amount).toString() : '0',
            requiredStake: MIN_STAKE_TO_CREATE_GUILD.toString(),
          },
        },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    // Create guild
    const guild = await prisma.guild.create({
      data: {
        ownerId: validatedData.ownerWallet, // Using wallet as owner ID
        name: validatedData.name,
        description: validatedData.description,
        treasuryWallet: validatedData.treasuryWallet,
        logoUrl: validatedData.logoUrl,
        websiteUrl: validatedData.websiteUrl,
        membershipFee: validatedData.membershipFee,
        minStakeToJoin: validatedData.minStakeToJoin,
        isPublic: validatedData.isPublic ?? true,
        totalMembers: 1,
      },
    });

    // Add owner as first member
    await prisma.guildMember.create({
      data: {
        guildId: guild.id,
        userId: validatedData.ownerWallet,
        wallet: validatedData.ownerWallet,
        role: 'OWNER',
        sharePercentage: 100,
      },
    });

    // Record creation transaction
    await guildRepository.recordTransaction({
      guildId: guild.id,
      type: 'DEPOSIT',
      amount: 0,
      currency: 'XRP',
      description: 'Guild created',
    });

    logger.info('Guild created', {
      guildId: guild.id,
      name: guild.name,
      owner: validatedData.ownerWallet,
    });

    const fullGuild = await guildRepository.getById(guild.id);

    res.status(201).json({
      success: true,
      data: {
        guild: formatGuild(fullGuild),
        message: 'Guild created successfully',
      },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid guild data',
          details: error.errors,
        },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }
    logger.error('Error creating guild', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to create guild' },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  }
});

// ============================================================
// GUILD DETAIL ENDPOINTS
// ============================================================

/**
 * @route GET /guilds/:guildId
 * @summary Get detailed guild information
 */
router.get('/:guildId', async (req: Request, res: Response) => {
  try {
    const guildId = req.params['guildId'] || '';
    const guild = await guildRepository.getById(guildId);

    if (!guild) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Guild not found' },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        guild: formatGuild(guild),
        members: guild.members.map(formatMember),
      },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  } catch (error) {
    logger.error('Error fetching guild', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch guild' },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  }
});

/**
 * @route GET /guilds/:guildId/audit
 * @summary Get guild audit trail (all transactions)
 */
router.get('/:guildId/audit', async (req: Request, res: Response) => {
  try {
    const guildId = req.params['guildId'] || '';
    const page = Math.max(1, parseInt(req.query['page'] as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query['limit'] as string, 10) || 50));
    const txType = req.query['type'] as GuildTransactionType | undefined;

    const guild = await guildRepository.getById(guildId);
    if (!guild) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Guild not found' },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    const { transactions, total } = await guildRepository.getTransactions(guildId, {
      type: txType,
      page,
      limit,
    });

    // Get member history (including those who left)
    const allMembers = await prisma.guildMember.findMany({
      where: { guildId },
      orderBy: { joinedAt: 'desc' },
    });

    res.json({
      success: true,
      data: {
        guildId,
        treasury: {
          wallet: guild.treasuryWallet,
          balance: Number(guild.treasuryBalance).toString(),
          totalRevenue: Number(guild.totalRevenue).toString(),
        },
        transactions: transactions.map(formatTransaction),
        members: {
          current: allMembers.filter(m => !m.leftAt).map(formatMember),
          former: allMembers.filter(m => m.leftAt).map(formatMember),
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
    logger.error('Error fetching guild audit', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch audit trail' },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  }
});

// ============================================================
// MEMBER MANAGEMENT ENDPOINTS
// ============================================================

/**
 * @route POST /guilds/:guildId/members
 * @summary Add a member to the guild (requires OWNER or ADMIN)
 */
router.post('/:guildId/members', async (req: Request, res: Response) => {
  try {
    const guildId = req.params['guildId'] || '';
    const validatedData = addMemberSchema.parse(req.body);

    const guild = await guildRepository.getById(guildId);
    if (!guild) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Guild not found' },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    // Check if requester is admin
    const canAdd = await isGuildAdmin(guildId, validatedData.requesterWallet);
    if (!canAdd) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only guild owners and admins can add members' },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    // Check if guild has minimum stake requirement
    if (guild.minStakeToJoin && Number(guild.minStakeToJoin) > 0) {
      const memberStake = await stakeRepository.getByWallet(validatedData.wallet);
      if (!memberStake || Number(memberStake.amount) < Number(guild.minStakeToJoin)) {
        res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_STAKE',
            message: `Minimum ${Number(guild.minStakeToJoin)} VRTY stake required to join this guild`,
            details: {
              currentStake: memberStake ? Number(memberStake.amount).toString() : '0',
              requiredStake: Number(guild.minStakeToJoin).toString(),
            },
          },
          meta: { requestId: req.requestId, timestamp: new Date() },
        });
        return;
      }
    }

    // Add member
    const member = await guildRepository.addMember({
      guildId,
      userId: validatedData.wallet,
      wallet: validatedData.wallet,
      role: validatedData.role as GuildRole || 'MEMBER',
    });

    // Update share if provided
    if (validatedData.sharePercentage !== undefined) {
      await guildRepository.updateMemberShare(
        guildId,
        validatedData.wallet,
        validatedData.sharePercentage
      );
    }

    logger.info('Member added to guild', {
      guildId,
      wallet: validatedData.wallet,
      role: validatedData.role || 'MEMBER',
    });

    res.status(201).json({
      success: true,
      data: {
        member: formatMember(member),
        message: 'Member added successfully',
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
    const errorMessage = (error as Error).message;
    if (errorMessage.includes('Already a member')) {
      res.status(409).json({
        success: false,
        error: { code: 'ALREADY_MEMBER', message: errorMessage },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }
    logger.error('Error adding member', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to add member' },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  }
});

/**
 * @route GET /guilds/:guildId/members
 * @summary Get all guild members
 */
router.get('/:guildId/members', async (req: Request, res: Response) => {
  try {
    const guildId = req.params['guildId'] || '';
    const includeFormer = req.query['includeFormer'] === 'true';

    const guild = await guildRepository.getById(guildId);
    if (!guild) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Guild not found' },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    const members = await prisma.guildMember.findMany({
      where: {
        guildId,
        ...(includeFormer ? {} : { leftAt: null }),
      },
      orderBy: [{ role: 'asc' }, { sharePercentage: 'desc' }],
    });

    // Calculate total shares
    const activeMembers = members.filter(m => !m.leftAt);
    const totalShares = activeMembers.reduce((sum, m) => sum + Number(m.sharePercentage), 0);

    res.json({
      success: true,
      data: {
        members: members.map(formatMember),
        summary: {
          total: members.length,
          active: activeMembers.length,
          totalShares: totalShares.toString(),
          byRole: {
            OWNER: activeMembers.filter(m => m.role === 'OWNER').length,
            ADMIN: activeMembers.filter(m => m.role === 'ADMIN').length,
            MEMBER: activeMembers.filter(m => m.role === 'MEMBER').length,
          },
        },
      },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  } catch (error) {
    logger.error('Error fetching members', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch members' },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  }
});

/**
 * @route PATCH /guilds/:guildId/members/:wallet
 * @summary Update member role or share
 */
router.patch('/:guildId/members/:wallet', async (req: Request, res: Response) => {
  try {
    const guildId = req.params['guildId'] || '';
    const targetWallet = req.params['wallet'] || '';
    const validatedData = updateMemberSchema.parse(req.body);

    const guild = await guildRepository.getById(guildId);
    if (!guild) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Guild not found' },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    // Only owner can update members
    const isOwner = await isGuildOwner(guildId, validatedData.requesterWallet);
    if (!isOwner) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only guild owner can update members' },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    // Can't change owner role
    const targetMember = await prisma.guildMember.findFirst({
      where: { guildId, wallet: targetWallet, leftAt: null },
    });

    if (!targetMember) {
      res.status(404).json({
        success: false,
        error: { code: 'MEMBER_NOT_FOUND', message: 'Member not found' },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    if (targetMember.role === 'OWNER') {
      res.status(400).json({
        success: false,
        error: { code: 'CANNOT_MODIFY_OWNER', message: 'Cannot modify owner role' },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    // Update role if provided
    if (validatedData.role) {
      await guildRepository.updateMemberRole(guildId, targetWallet, validatedData.role);
    }

    // Update share if provided
    if (validatedData.sharePercentage !== undefined) {
      await guildRepository.updateMemberShare(guildId, targetWallet, validatedData.sharePercentage);
    }

    const updatedMember = await prisma.guildMember.findFirst({
      where: { guildId, wallet: targetWallet, leftAt: null },
    });

    res.json({
      success: true,
      data: {
        member: formatMember(updatedMember),
        message: 'Member updated successfully',
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
    logger.error('Error updating member', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to update member' },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  }
});

/**
 * @route DELETE /guilds/:guildId/members/:wallet
 * @summary Remove a member from the guild
 */
router.delete('/:guildId/members/:wallet', async (req: Request, res: Response) => {
  try {
    const guildId = req.params['guildId'] || '';
    const targetWallet = req.params['wallet'] || '';
    const requesterWallet = req.query['requesterWallet'] as string;

    if (!requesterWallet) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Requester wallet required' },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    const guild = await guildRepository.getById(guildId);
    if (!guild) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Guild not found' },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    // Check permissions: owner can remove anyone, member can leave themselves
    const isOwner = await isGuildOwner(guildId, requesterWallet);
    const isSelf = requesterWallet === targetWallet;

    if (!isOwner && !isSelf) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Not authorized to remove this member' },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    await guildRepository.removeMember(guildId, targetWallet);

    logger.info('Member removed from guild', { guildId, wallet: targetWallet });

    res.json({
      success: true,
      data: {
        message: isSelf ? 'Successfully left guild' : 'Member removed successfully',
      },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  } catch (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage.includes('Cannot remove guild owner')) {
      res.status(400).json({
        success: false,
        error: { code: 'CANNOT_REMOVE_OWNER', message: errorMessage },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }
    logger.error('Error removing member', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to remove member' },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  }
});

// ============================================================
// TREASURY ENDPOINTS
// ============================================================

/**
 * @route POST /guilds/:guildId/transactions
 * @summary Record a treasury transaction
 */
router.post('/:guildId/transactions', async (req: Request, res: Response) => {
  try {
    const guildId = req.params['guildId'] || '';
    const validatedData = transactionSchema.parse(req.body);

    const guild = await guildRepository.getById(guildId);
    if (!guild) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Guild not found' },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    // Check if requester is admin
    const canRecord = await isGuildAdmin(guildId, validatedData.requesterWallet);
    if (!canRecord) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only guild owners and admins can record transactions' },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    // Check balance for withdrawals
    if (validatedData.type === 'WITHDRAWAL' || validatedData.type === 'REVENUE_DISTRIBUTION') {
      if (Number(guild.treasuryBalance) < validatedData.amount) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_BALANCE',
            message: 'Insufficient treasury balance',
            details: {
              available: Number(guild.treasuryBalance).toString(),
              requested: validatedData.amount.toString(),
            },
          },
          meta: { requestId: req.requestId, timestamp: new Date() },
        });
        return;
      }
    }

    const tx = await guildRepository.recordTransaction({
      guildId,
      type: validatedData.type as GuildTransactionType,
      amount: validatedData.amount,
      currency: validatedData.currency,
      fromWallet: validatedData.fromWallet,
      toWallet: validatedData.toWallet,
      description: validatedData.description,
      txHash: validatedData.txHash,
    });

    const updatedGuild = await guildRepository.getById(guildId);

    logger.info('Transaction recorded', {
      guildId,
      type: validatedData.type,
      amount: validatedData.amount,
    });

    res.status(201).json({
      success: true,
      data: {
        transaction: formatTransaction(tx),
        treasuryBalance: Number(updatedGuild?.treasuryBalance || 0).toString(),
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
    logger.error('Error recording transaction', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to record transaction' },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  }
});

/**
 * @route GET /guilds/:guildId/transactions
 * @summary Get guild transactions
 */
router.get('/:guildId/transactions', async (req: Request, res: Response) => {
  try {
    const guildId = req.params['guildId'] || '';
    const page = Math.max(1, parseInt(req.query['page'] as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query['limit'] as string, 10) || 50));
    const txType = req.query['type'] as GuildTransactionType | undefined;

    const guild = await guildRepository.getById(guildId);
    if (!guild) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Guild not found' },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    const { transactions, total } = await guildRepository.getTransactions(guildId, {
      type: txType,
      page,
      limit,
    });

    res.json({
      success: true,
      data: {
        transactions: transactions.map(formatTransaction),
        treasuryBalance: Number(guild.treasuryBalance).toString(),
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
    logger.error('Error fetching transactions', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch transactions' },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  }
});

/**
 * @route POST /guilds/:guildId/revenue/distribute
 * @summary Distribute revenue to members based on shares
 */
router.post('/:guildId/revenue/distribute', async (req: Request, res: Response) => {
  try {
    const guildId = req.params['guildId'] || '';
    const validatedData = distributeRevenueSchema.parse(req.body);

    const guild = await guildRepository.getById(guildId);
    if (!guild) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Guild not found' },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    // Check if requester is admin
    const canDistribute = await isGuildAdmin(guildId, validatedData.requesterWallet);
    if (!canDistribute) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only guild owners and admins can distribute revenue' },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    // Check balance
    if (Number(guild.treasuryBalance) < validatedData.totalAmount) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_BALANCE',
          message: 'Insufficient treasury balance for distribution',
          details: {
            available: Number(guild.treasuryBalance).toString(),
            requested: validatedData.totalAmount.toString(),
          },
        },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    // Get active members with shares
    const members = guild.members.filter(m => !m.leftAt && Number(m.sharePercentage) > 0);

    if (members.length === 0) {
      res.status(400).json({
        success: false,
        error: { code: 'NO_ELIGIBLE_MEMBERS', message: 'No members have revenue shares' },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    // Calculate distributions
    const totalShares = members.reduce((sum, m) => sum + Number(m.sharePercentage), 0);
    const distributions = members.map(m => {
      const share = Number(m.sharePercentage) / totalShares;
      const amount = validatedData.totalAmount * share;
      return {
        wallet: m.wallet,
        sharePercentage: Number(m.sharePercentage).toString(),
        amount: amount.toFixed(6),
      };
    });

    // Record distribution transaction
    await guildRepository.recordTransaction({
      guildId,
      type: 'REVENUE_DISTRIBUTION',
      amount: validatedData.totalAmount,
      currency: validatedData.currency,
      fromWallet: guild.treasuryWallet,
      description: `Revenue distribution to ${members.length} members`,
      txHash: validatedData.txHash,
    });

    const updatedGuild = await guildRepository.getById(guildId);

    logger.info('Revenue distributed', {
      guildId,
      amount: validatedData.totalAmount,
      recipients: members.length,
    });

    res.json({
      success: true,
      data: {
        distribution: {
          totalAmount: validatedData.totalAmount.toString(),
          currency: validatedData.currency,
          recipients: distributions,
          note: 'For production, execute actual XRPL payments to each recipient',
        },
        treasuryBalance: Number(updatedGuild?.treasuryBalance || 0).toString(),
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
    logger.error('Error distributing revenue', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to distribute revenue' },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  }
});

// ============================================================
// STATISTICS ENDPOINT
// ============================================================

/**
 * @route GET /guilds/stats
 * @summary Get global guild statistics
 */
router.get('/stats/global', async (req: Request, res: Response) => {
  try {
    const stats = await guildRepository.getStats();

    // Get recent guilds
    const recentGuilds = await prisma.guild.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      where: { dissolvedAt: null },
      select: { id: true, name: true, totalMembers: true, createdAt: true },
    });

    res.json({
      success: true,
      data: {
        stats: {
          ...stats,
          totalTreasuryValue: stats.totalTreasuryValue.toString(),
        },
        recentGuilds,
      },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  } catch (error) {
    logger.error('Error fetching guild stats', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch statistics' },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  }
});

/**
 * @route POST /guilds/:guildId/dissolve
 * @summary Dissolve a guild (owner only)
 */
router.post('/:guildId/dissolve', async (req: Request, res: Response) => {
  try {
    const guildId = req.params['guildId'] || '';
    const { wallet, reason } = req.body;

    if (!wallet) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Wallet address required' },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    const guild = await guildRepository.getById(guildId);
    if (!guild) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Guild not found' },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    // Only owner can dissolve
    const isOwner = await isGuildOwner(guildId, wallet);
    if (!isOwner) {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Only the guild owner can dissolve the guild' },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    // Check if treasury has balance
    if (Number(guild.treasuryBalance) > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'TREASURY_NOT_EMPTY',
          message: 'Treasury must be empty before dissolving. Withdraw or distribute all funds first.',
          details: { balance: Number(guild.treasuryBalance).toString() },
        },
        meta: { requestId: req.requestId, timestamp: new Date() },
      });
      return;
    }

    await guildRepository.dissolve(guildId);

    logger.info('Guild dissolved', { guildId, reason });

    res.json({
      success: true,
      data: {
        message: 'Guild dissolved successfully',
        reason,
      },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  } catch (error) {
    logger.error('Error dissolving guild', { error });
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to dissolve guild' },
      meta: { requestId: req.requestId, timestamp: new Date() },
    });
  }
});

/**
 * @route GET /guilds/health
 * @summary Check guilds system health
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const dbHealth = await checkDatabaseHealth();
    const stats = await guildRepository.getStats();

    res.json({
      success: true,
      data: {
        status: dbHealth.connected ? 'healthy' : 'degraded',
        database: dbHealth,
        stats: {
          totalGuilds: stats.totalGuilds,
          activeGuilds: stats.activeGuilds,
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

export { router as guildsRoutes };
