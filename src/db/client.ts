/**
 * Verity Protocol - Prisma Database Client
 * 
 * Singleton Prisma client instance with connection management.
 * Handles connection pooling and graceful shutdown.
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

// Extend PrismaClient with logging
const prismaClientSingleton = () => {
  return new PrismaClient({
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'event' },
      { level: 'warn', emit: 'event' },
    ],
  });
};

// Type for the singleton
type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

// Global variable to store singleton
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

// Create or reuse singleton instance
export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

// Set up logging in development
if (process.env['NODE_ENV'] !== 'production') {
  prisma.$on('query' as never, (e: { query: string; duration: number }) => {
    logger.debug('Prisma Query', { 
      query: e.query, 
      duration: `${e.duration}ms` 
    });
  });
}

// Log errors
prisma.$on('error' as never, (e: { message: string }) => {
  logger.error('Prisma Error', { message: e.message });
});

// Prevent multiple instances in development
if (process.env['NODE_ENV'] !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Connect to database
 */
export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error('Failed to connect to database', { error });
    throw error;
  }
}

/**
 * Disconnect from database
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    logger.info('Database disconnected');
  } catch (error) {
    logger.error('Error disconnecting from database', { error });
  }
}

/**
 * Check database health
 */
export async function checkDatabaseHealth(): Promise<{
  connected: boolean;
  latency?: number;
  error?: string;
}> {
  const start = Date.now();
  
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      connected: true,
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      connected: false,
      error: (error as Error).message,
    };
  }
}

export default prisma;
