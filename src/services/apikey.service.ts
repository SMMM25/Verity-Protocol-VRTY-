/**
 * Verity Protocol - API Key Service
 * 
 * @description Production API key validation against PostgreSQL database.
 * Uses bcrypt for secure key comparison.
 * 
 * @version 1.0.0
 */

import bcrypt from 'bcrypt';
import prisma from '../db/client.js';
import logger from '../utils/logger.js';
import { STAKING_TIERS } from '../config/vrty-token.js';

/**
 * Rate limits by staking tier
 */
export const TIER_RATE_LIMITS = {
  EXPLORER: { points: 100, duration: 60 },      // 100 req/min
  NAVIGATOR: { points: 500, duration: 60 },     // 500 req/min
  CAPTAIN: { points: 1000, duration: 60 },      // 1000 req/min
  ADMIRAL: { points: 5000, duration: 60 },      // 5000 req/min
  COMMODORE: { points: 10000, duration: 60 },   // 10000 req/min
} as const;

/**
 * API Key validation result
 */
export interface ApiKeyValidation {
  valid: boolean;
  userId?: string;
  tier?: string;
  rateLimit?: { points: number; duration: number };
  error?: string;
}

/**
 * Validate API key against database
 */
export async function validateApiKey(apiKey: string): Promise<ApiKeyValidation> {
  if (!apiKey || apiKey.length < 32) {
    return { valid: false, error: 'Invalid API key format' };
  }

  try {
    // Extract key prefix for lookup (first 8 chars)
    const keyPrefix = apiKey.substring(0, 8);
    
    // Find potential matching keys by prefix
    const apiKeys = await prisma.apiKey.findMany({
      where: {
        prefix: keyPrefix,
        revokedAt: null,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });

    if (apiKeys.length === 0) {
      logger.warn('API key not found or expired', { keyPrefix });
      return { valid: false, error: 'API key not found or expired' };
    }

    // Verify the full key using bcrypt
    for (const storedKey of apiKeys) {
      const isMatch = await bcrypt.compare(apiKey, storedKey.keyHash);
      
      if (isMatch) {
        // Update last used timestamp
        await prisma.apiKey.update({
          where: { id: storedKey.id },
          data: { lastUsedAt: new Date() },
        });

        // Get user's active stakes to calculate tier
        const activeStakes = await prisma.stake.findMany({
          where: {
            userId: storedKey.userId,
            unstakedAt: null,
          },
          select: { amount: true },
        });

        // Calculate tier from total staked amount
        const totalStaked = activeStakes.reduce(
          (sum: number, stake: { amount: any }) => sum + Number(stake.amount), 0
        );
        const tier = calculateTierFromStake(totalStaked);
        const rateLimit = TIER_RATE_LIMITS[tier as keyof typeof TIER_RATE_LIMITS] || TIER_RATE_LIMITS.EXPLORER;

        logger.debug('API key validated successfully', {
          userId: storedKey.userId,
          tier,
        });

        return {
          valid: true,
          userId: storedKey.userId,
          tier,
          rateLimit,
        };
      }
    }

    logger.warn('API key validation failed - no match', { keyPrefix });
    return { valid: false, error: 'Invalid API key' };
  } catch (error: any) {
    logger.error('Error validating API key:', error);
    return { valid: false, error: 'API key validation error' };
  }
}

/**
 * Create a new API key for a user
 */
export async function createApiKey(
  userId: string,
  name: string,
  expiresInDays?: number
): Promise<{ apiKey: string; keyId: string }> {
  // Generate a secure random API key
  const apiKey = generateSecureApiKey();
  
  // Hash the key for storage
  const hashedKey = await bcrypt.hash(apiKey, 12);
  
  // Calculate expiration
  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
    : null;

  // Store in database
  const stored = await prisma.apiKey.create({
    data: {
      userId,
      name,
      prefix: apiKey.substring(0, 8), // Store prefix for lookup
      keyHash: hashedKey,
      expiresAt,
      permissions: ['read', 'write'], // Default permissions
    },
  });

  logger.info('API key created', { userId, keyId: stored.id, name });

  return {
    apiKey, // Return plain key only once
    keyId: stored.id,
  };
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(keyId: string, userId: string): Promise<boolean> {
  try {
    const result = await prisma.apiKey.updateMany({
      where: {
        id: keyId,
        userId,
      },
      data: {
        revokedAt: new Date(),
      },
    });

    if (result.count > 0) {
      logger.info('API key revoked', { keyId, userId });
      return true;
    }

    return false;
  } catch (error: any) {
    logger.error('Error revoking API key:', error);
    return false;
  }
}

/**
 * Get user's API keys (without exposing the actual keys)
 */
export async function getUserApiKeys(userId: string) {
  return prisma.apiKey.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      prefix: true, // Only prefix is stored
      permissions: true,
      createdAt: true,
      lastUsedAt: true,
      expiresAt: true,
      revokedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * Generate a secure API key
 */
function generateSecureApiKey(): string {
  const crypto = require('crypto');
  const prefix = 'vrty_';
  const randomPart = crypto.randomBytes(32).toString('hex');
  return `${prefix}${randomPart}`;
}

/**
 * Get rate limit for a tier
 */
export function getTierRateLimit(tier: string): { points: number; duration: number } {
  return TIER_RATE_LIMITS[tier as keyof typeof TIER_RATE_LIMITS] || TIER_RATE_LIMITS.EXPLORER;
}

/**
 * Calculate tier from stake amount
 */
function calculateTierFromStake(amount: number): string {
  if (amount >= 200000) return 'COMMODORE';
  if (amount >= 50000) return 'ADMIRAL';
  if (amount >= 10000) return 'CAPTAIN';
  if (amount >= 1000) return 'NAVIGATOR';
  return 'EXPLORER';
}

export default {
  validateApiKey,
  createApiKey,
  revokeApiKey,
  getUserApiKeys,
  getTierRateLimit,
  TIER_RATE_LIMITS,
};
