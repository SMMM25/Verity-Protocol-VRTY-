/**
 * Verity Protocol - Token Distribution Types
 * 
 * @description Type definitions for the VRTY token distribution and
 * escrow system that manages the 50-month release schedule.
 */

// ============================================================
// DISTRIBUTION CONFIGURATION
// ============================================================

export interface DistributionConfig {
  /** XRPL network (mainnet, testnet, devnet) */
  network: 'mainnet' | 'testnet' | 'devnet';
  
  /** VRTY token issuer address */
  issuerAddress: string;
  
  /** Currency code for VRTY */
  currencyCode: string;
  
  /** Total tokens to escrow */
  totalAmount: string;
  
  /** Number of months for release schedule */
  totalMonths: number;
  
  /** Destination for released tokens */
  releaseDestination: string;
}

export const DEFAULT_DISTRIBUTION_CONFIG: DistributionConfig = {
  network: 'mainnet',
  issuerAddress: 'rBeHfq9vRjZ8Cth1sMbp2nJvExmxSxAH8f',
  currencyCode: 'VRTY',
  totalAmount: '1000000000', // 1 billion VRTY
  totalMonths: 50,
  releaseDestination: 'rLmLMErLKDzWXyYmcZGHqQ3SCgTVJCVjA3', // Distribution wallet
};

// ============================================================
// RELEASE SCHEDULE
// ============================================================

export interface ReleaseScheduleEntry {
  /** Month number (1-50) */
  month: number;
  
  /** Release date (ISO string) */
  releaseDate: string;
  
  /** Amount to release this month */
  amount: string;
  
  /** Percentage of total */
  percentage: number;
  
  /** Cumulative released after this month */
  cumulativeReleased: string;
  
  /** Cumulative percentage */
  cumulativePercentage: number;
  
  /** Status */
  status: 'pending' | 'created' | 'released' | 'cancelled';
  
  /** Transaction hash (if released) */
  releaseTxHash?: string;
}

export interface ReleaseSchedule {
  /** Configuration used */
  config: DistributionConfig;
  
  /** Schedule entries */
  entries: ReleaseScheduleEntry[];
  
  /** Creation timestamp */
  createdAt: string;
  
  /** Last updated timestamp */
  updatedAt: string;
  
  /** Total amount in escrow */
  totalEscrowed: string;
  
  /** Total amount released so far */
  totalReleased: string;
  
  /** Next release date */
  nextReleaseDate?: string;
  
  /** Next release amount */
  nextReleaseAmount?: string;
}

// ============================================================
// DISTRIBUTION STATUS
// ============================================================

export interface DistributionStatus {
  /** Total scheduled releases */
  totalScheduled: number;
  
  /** Pending releases */
  pendingReleases: number;
  
  /** Released count */
  releasedCount: number;
  
  /** Cancelled count */
  cancelledCount: number;
  
  /** Total amount scheduled */
  totalInSchedule: string;
  
  /** Total amount released */
  totalReleased: string;
  
  /** Next release info */
  nextRelease?: {
    date: string;
    amount: string;
  };
}

// ============================================================
// DISTRIBUTION TRACKING
// ============================================================

export type AllocationCategory = 
  | 'TREASURY'
  | 'FOUNDER'
  | 'ECOSYSTEM'
  | 'LIQUIDITY'
  | 'COMMUNITY'
  | 'GRANTS'
  | 'MARKETING'
  | 'DEVELOPMENT';

export interface AllocationEntry {
  /** Category */
  category: AllocationCategory;
  
  /** Total allocated */
  totalAllocated: string;
  
  /** Percentage of total supply */
  percentage: number;
  
  /** Amount released */
  released: string;
  
  /** Amount remaining */
  remaining: string;
  
  /** Vesting schedule (if applicable) */
  vestingMonths?: number;
  
  /** Cliff period (if applicable) */
  cliffMonths?: number;
  
  /** Start date */
  startDate: string;
  
  /** Wallet address */
  walletAddress: string;
}

export interface TokenDistribution {
  /** Total supply */
  totalSupply: string;
  
  /** Circulating supply */
  circulatingSupply: string;
  
  /** In escrow/vesting */
  inEscrow: string;
  
  /** Allocations */
  allocations: AllocationEntry[];
  
  /** Last updated */
  updatedAt: string;
}
