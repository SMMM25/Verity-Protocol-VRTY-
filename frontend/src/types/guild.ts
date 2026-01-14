/**
 * Verity Protocol - Frontend Guild Types
 * 
 * @description Type definitions for Guild/DAO Dashboard
 */

// ============================================================
// GUILD TYPES
// ============================================================

export interface Guild {
  id: string;
  name: string;
  description?: string;
  logoUrl?: string;
  websiteUrl?: string;
  treasuryWallet: string;
  treasuryBalance: string;
  membershipFee?: string;
  minStakeToJoin?: string;
  isPublic: boolean;
  totalMembers: number;
  totalRevenue: string;
  ownerId: string;
  createdAt: string;
  dissolvedAt?: string;
  memberCount?: number;
}

export type GuildRole = 'OWNER' | 'ADMIN' | 'MEMBER';

export interface GuildMember {
  id: string;
  wallet: string;
  userId: string;
  role: GuildRole;
  sharePercentage: string;
  joinedAt: string;
  leftAt?: string;
}

// ============================================================
// TRANSACTION TYPES
// ============================================================

export type GuildTransactionType = 
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'REVENUE_DISTRIBUTION'
  | 'MEMBERSHIP_FEE'
  | 'FEE_COLLECTION';

export interface GuildTransaction {
  id: string;
  type: GuildTransactionType;
  amount: string;
  currency: string;
  fromWallet?: string;
  toWallet?: string;
  description?: string;
  txHash?: string;
  createdAt: string;
}

// ============================================================
// REQUEST/RESPONSE TYPES
// ============================================================

export interface CreateGuildParams {
  name: string;
  description?: string;
  treasuryWallet: string;
  ownerWallet: string;
  membershipFee?: number;
  minStakeToJoin?: number;
  isPublic?: boolean;
  logoUrl?: string;
  websiteUrl?: string;
}

export interface AddMemberParams {
  wallet: string;
  role?: 'ADMIN' | 'MEMBER';
  sharePercentage?: number;
  requesterWallet: string;
}

export interface RecordTransactionParams {
  type: GuildTransactionType;
  amount: number;
  currency?: string;
  fromWallet?: string;
  toWallet?: string;
  description?: string;
  txHash?: string;
  requesterWallet: string;
}

export interface DistributeRevenueParams {
  totalAmount: number;
  currency?: string;
  requesterWallet: string;
  txHash?: string;
}

export interface UpdateMemberParams {
  role?: 'ADMIN' | 'MEMBER';
  sharePercentage?: number;
  requesterWallet: string;
}

// ============================================================
// PROPOSAL TYPES (Future)
// ============================================================

export type ProposalType = 
  | 'MEMBER_ADD'
  | 'MEMBER_REMOVE'
  | 'RULE_CHANGE'
  | 'TREASURY_ALLOCATION'
  | 'DISSOLUTION';

export type ProposalStatus = 'active' | 'passed' | 'failed' | 'executed';

export interface GuildProposal {
  id: string;
  guildId: string;
  proposer: string;
  title: string;
  description: string;
  type: ProposalType;
  payload: Record<string, unknown>;
  status: ProposalStatus;
  votesFor: number;
  votesAgainst: number;
  totalVotes: number;
  quorumRequired: number;
  createdAt: string;
  votingEndsAt: string;
  executedAt?: string;
}

export interface ProposalVote {
  voter: string;
  shares: number;
  support: boolean;
  timestamp: string;
}

// ============================================================
// STATS & SUMMARY TYPES
// ============================================================

export interface GuildStats {
  totalGuilds: number;
  activeGuilds: number;
  totalMembers: number;
  totalTreasuryValue: string;
}

export interface MemberSummary {
  total: number;
  active: number;
  totalShares: string;
  byRole: {
    OWNER: number;
    ADMIN: number;
    MEMBER: number;
  };
}

export interface RevenueDistribution {
  wallet: string;
  sharePercentage: string;
  amount: string;
}

// ============================================================
// API RESPONSE TYPES
// ============================================================

export interface GuildApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: {
    requestId: string;
    timestamp: string;
    pagination?: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
      hasNext: boolean;
      hasPrevious: boolean;
    };
  };
}
