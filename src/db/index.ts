/**
 * Verity Protocol - Database Module Exports
 */

// Client
export { 
  prisma, 
  connectDatabase, 
  disconnectDatabase, 
  checkDatabaseHealth 
} from './client.js';

// Repositories
export {
  stakeRepository,
  proposalRepository,
  userRepository,
  guildRepository,
  calculateTier,
} from './repositories/index.js';

// Re-export Prisma types for convenience
export type {
  User,
  Stake,
  StakingTier,
  Proposal,
  ProposalStatus,
  ProposalCategory,
  Vote,
  VoteType,
  Guild,
  GuildMember,
  GuildRole,
  GuildTransaction,
  GuildTransactionType,
  KycStatus,
  ApiKey,
  ClawbackProposal,
  ClawbackStatus,
  ClawbackReason,
  BridgeTransaction,
  BridgeStatus,
  BridgeDirection,
  AuditLog,
} from '@prisma/client';
