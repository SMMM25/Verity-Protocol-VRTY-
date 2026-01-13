/**
 * Verity Protocol - User Repository
 * 
 * Database operations for user accounts.
 */

import { prisma } from '../client.js';
import { User, KycStatus, Prisma } from '@prisma/client';
import { logger } from '../../utils/logger.js';
import * as crypto from 'crypto';

export type UserWithStake = User & {
  stakes: { amount: Prisma.Decimal; tier: string }[];
};

/**
 * User Repository
 */
export const userRepository = {
  /**
   * Find or create user by wallet
   */
  async findOrCreateByWallet(wallet: string): Promise<User> {
    let user = await prisma.user.findUnique({
      where: { wallet },
    });

    if (!user) {
      user = await prisma.user.create({
        data: { wallet },
      });
      logger.info('New user created', { wallet });
    }

    // Update last active
    await prisma.user.update({
      where: { id: user.id },
      data: { lastActiveAt: new Date() },
    });

    return user;
  },

  /**
   * Get user by ID
   */
  async getById(id: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { id },
    });
  },

  /**
   * Get user by wallet
   */
  async getByWallet(wallet: string): Promise<User | null> {
    return prisma.user.findUnique({
      where: { wallet },
    });
  },

  /**
   * Get user with stake info
   */
  async getWithStake(wallet: string): Promise<UserWithStake | null> {
    return prisma.user.findUnique({
      where: { wallet },
      include: {
        stakes: {
          where: { unstakedAt: null },
          select: { amount: true, tier: true },
        },
      },
    });
  },

  /**
   * Update user profile
   */
  async updateProfile(userId: string, data: {
    displayName?: string;
    email?: string;
    avatarUrl?: string;
  }): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data,
    });
  },

  /**
   * Update KYC status
   */
  async updateKycStatus(
    userId: string, 
    status: KycStatus,
    jurisdiction?: string
  ): Promise<User> {
    return prisma.user.update({
      where: { id: userId },
      data: {
        kycStatus: status,
        kycVerifiedAt: status === 'VERIFIED' ? new Date() : null,
        jurisdiction,
      },
    });
  },

  /**
   * Create API key for user
   */
  async createApiKey(userId: string, name: string, permissions: string[]): Promise<{
    key: string;
    prefix: string;
  }> {
    // Generate random API key
    const key = `vrty_${crypto.randomBytes(32).toString('hex')}`;
    const prefix = key.substring(0, 12);
    
    // Hash for storage
    const keyHash = crypto.createHash('sha256').update(key).digest('hex');

    await prisma.apiKey.create({
      data: {
        userId,
        keyHash,
        name,
        prefix,
        permissions,
      },
    });

    logger.info('API key created', { userId, prefix });

    // Return the unhashed key (only time it's visible)
    return { key, prefix };
  },

  /**
   * Validate API key
   */
  async validateApiKey(key: string): Promise<{
    valid: boolean;
    userId?: string;
    permissions?: string[];
  }> {
    const keyHash = crypto.createHash('sha256').update(key).digest('hex');

    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash },
      include: { user: true },
    });

    if (!apiKey) {
      return { valid: false };
    }

    // Check if revoked or expired
    if (apiKey.revokedAt) {
      return { valid: false };
    }

    if (apiKey.expiresAt && new Date() > apiKey.expiresAt) {
      return { valid: false };
    }

    // Update last used
    await prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      valid: true,
      userId: apiKey.userId,
      permissions: apiKey.permissions,
    };
  },

  /**
   * Revoke API key
   */
  async revokeApiKey(userId: string, keyPrefix: string): Promise<boolean> {
    const result = await prisma.apiKey.updateMany({
      where: {
        userId,
        prefix: keyPrefix,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    return result.count > 0;
  },

  /**
   * Get user's API keys
   */
  async getApiKeys(userId: string): Promise<{
    id: string;
    name: string;
    prefix: string;
    permissions: string[];
    lastUsedAt: Date | null;
    createdAt: Date;
  }[]> {
    return prisma.apiKey.findMany({
      where: {
        userId,
        revokedAt: null,
      },
      select: {
        id: true,
        name: true,
        prefix: true,
        permissions: true,
        lastUsedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Get users count
   */
  async getCount(): Promise<number> {
    return prisma.user.count();
  },

  /**
   * Get users with verified KYC
   */
  async getVerifiedCount(): Promise<number> {
    return prisma.user.count({
      where: { kycStatus: 'VERIFIED' },
    });
  },
};

export default userRepository;
