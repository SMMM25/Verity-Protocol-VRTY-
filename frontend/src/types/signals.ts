/**
 * Verity Protocol - Frontend Signals Types
 * 
 * @description Type definitions for Signals/Creator Dashboard
 */

// ============================================================
// SIGNAL TYPES
// ============================================================

export type SignalType = 'ENDORSEMENT' | 'BOOST' | 'SUPPORT' | 'CHALLENGE' | 'REPLY';

export interface Signal {
  id: string;
  sender: string;
  recipient: string;
  contentNFTId: string;
  signalType: SignalType;
  amount: string;
  message?: string;
  timestamp: string;
  transactionHash: string;
  verificationHash: string;
}

// ============================================================
// CONTENT NFT TYPES
// ============================================================

export type ContentType = 'article' | 'video' | 'podcast' | 'image' | 'thread' | 'other';

export interface ContentNFT {
  tokenId: string;
  creator: string;
  contentHash: string;
  contentType: ContentType;
  uri: string;
  title?: string;
  description?: string;
  thumbnailUrl?: string;
  totalSignals: number;
  totalValue: string;
  createdAt: string;
}

// ============================================================
// REPUTATION TYPES
// ============================================================

export interface ReputationScore {
  wallet: string;
  totalSignalsReceived: number;
  totalSignalsSent: number;
  totalXRPReceived: string;
  totalXRPSent: string;
  reputationScore: number;
  rank?: number;
  lastUpdated: string;
}

// ============================================================
// CREATOR TYPES
// ============================================================

export interface Creator {
  wallet: string;
  displayName?: string;
  avatar?: string;
  bio?: string;
  totalContent: number;
  totalSignalsReceived: number;
  totalValueReceived: string;
  reputationScore: number;
  followers: number;
  following: number;
  joinedAt: string;
  verified?: boolean;
}

export interface CreatorStats {
  totalContent: number;
  totalSignals: number;
  totalValue: string;
  uniqueEndorsers: number;
  averageSignalValue: string;
  signalsByType: Record<SignalType, number>;
}

// ============================================================
// SIGNAL STATISTICS
// ============================================================

export interface SignalStats {
  totalSignals: number;
  totalValue: string;
  uniqueEndorsers: number;
  averageSignalValue: string;
  topEndorsers: Array<{
    wallet: string;
    totalValue: string;
    count: number;
  }>;
}

// ============================================================
// LEADERBOARD
// ============================================================

export interface LeaderboardEntry {
  rank: number;
  wallet: string;
  displayName?: string;
  avatar?: string;
  reputationScore: number;
  totalSignalsReceived: number;
  totalValueReceived: string;
  change24h?: number;
}

// ============================================================
// DISCOVERY
// ============================================================

export interface DiscoveryCriteria {
  minSignals?: number;
  minValue?: string;
  contentType?: ContentType;
  creator?: string;
  sortBy?: 'signals' | 'value' | 'recent';
  limit?: number;
}

export interface FeedItem {
  type: 'signal' | 'content' | 'milestone';
  data: Signal | ContentNFT | MilestoneEvent;
  timestamp: string;
}

export interface MilestoneEvent {
  id: string;
  wallet: string;
  milestone: string;
  description: string;
  timestamp: string;
}

// ============================================================
// REQUEST PARAMS
// ============================================================

export interface SendSignalParams {
  contentNFTId: string;
  amount: string;
  signalType: SignalType;
  message?: string;
}

export interface MintContentNFTParams {
  contentHash: string;
  contentUri: string;
  contentType: ContentType;
  title?: string;
  description?: string;
}

// ============================================================
// ALGORITHM
// ============================================================

export interface ReputationAlgorithm {
  version: string;
  description: string;
  formula: {
    components: Array<{
      name: string;
      formula: string;
      weight: string;
    }>;
    finalScore: string;
  };
  transparency: string;
  antiManipulation: string[];
}

// ============================================================
// API RESPONSE TYPES
// ============================================================

export interface SignalsApiResponse<T> {
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
