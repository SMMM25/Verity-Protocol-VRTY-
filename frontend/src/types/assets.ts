/**
 * Verity Protocol - Tokenized Assets Type Definitions
 */

// ============================================================
// CORE ENUMS (as const objects for erasableSyntaxOnly)
// ============================================================

export const AssetType = {
  REAL_ESTATE: 'REAL_ESTATE',
  PRIVATE_EQUITY: 'PRIVATE_EQUITY',
  SECURITY: 'SECURITY',
  COMMUNITY: 'COMMUNITY',
  DEBT: 'DEBT',
  COMMODITY: 'COMMODITY',
  COLLECTIBLE: 'COLLECTIBLE',
  INFRASTRUCTURE: 'INFRASTRUCTURE',
} as const;
export type AssetType = typeof AssetType[keyof typeof AssetType];

export const AssetStatus = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  FROZEN: 'FROZEN',
  REDEEMED: 'REDEEMED',
} as const;
export type AssetStatus = typeof AssetStatus[keyof typeof AssetStatus];

export const ComplianceStatus = {
  COMPLIANT: 'COMPLIANT',
  PENDING_REVIEW: 'PENDING_REVIEW',
  UNDER_REVIEW: 'UNDER_REVIEW',
  NON_COMPLIANT: 'NON_COMPLIANT',
} as const;
export type ComplianceStatus = typeof ComplianceStatus[keyof typeof ComplianceStatus];

// ============================================================
// CLAWBACK TYPES
// ============================================================

export const ClawbackReason = {
  REGULATORY_REQUIREMENT: 'REGULATORY_REQUIREMENT',
  REGULATORY_COMPLIANCE: 'REGULATORY_COMPLIANCE',
  COURT_ORDER: 'COURT_ORDER',
  FRAUD_DETECTION: 'FRAUD_DETECTION',
  FRAUD_PREVENTION: 'FRAUD_PREVENTION',
  SANCTIONS_COMPLIANCE: 'SANCTIONS_COMPLIANCE',
  INVESTOR_PROTECTION: 'INVESTOR_PROTECTION',
  AML_VIOLATION: 'AML_VIOLATION',
  ERROR_CORRECTION: 'ERROR_CORRECTION',
} as const;
export type ClawbackReason = typeof ClawbackReason[keyof typeof ClawbackReason];

export interface ClawbackProposal {
  id: string;
  assetId: string;
  targetWallet: string;
  amount: string;
  reason: ClawbackReason;
  legalJustification: string;
  status: 'COMMENT_PERIOD' | 'VOTING' | 'APPROVED' | 'EXECUTED' | 'CANCELLED' | 'DISPUTED';
  commentPeriodEnds: string;
  votingEndsAt?: string;
  approveVotes: number;
  rejectVotes: number;
  createdAt: string;
  executedAt?: string;
  executionTxHash?: string;
}

// ============================================================
// PROPERTY DETAILS
// ============================================================

export interface PropertyDetails {
  address: string;
  propertyType: string;
  squareFootage?: number;
  yearBuilt?: number;
  occupancyRate?: number;
  annualRentIncome?: number;
  propertyManagement?: string;
  legalEntity?: string;
  insurance?: {
    provider: string;
    coverage: number;
    expiresAt: string;
  };
}

// ============================================================
// ASSET FINANCIALS
// ============================================================

export interface AssetFinancials {
  totalValueUSD: number;
  tokenPriceUSD: number;
  priceChange24h: number;
  priceChange7d: number;
  volume24hUSD: number;
  marketCapUSD: number;
  dividendYield: number;
  totalDividendsPaid: number;
}

// ============================================================
// ASSET HOLDERS
// ============================================================

export interface AssetHolders {
  totalHolders: number;
  institutionalHolders: number;
  retailHolders: number;
  topHolderPercentage: number;
}

// ============================================================
// TRADING INFO
// ============================================================

export interface TradingInfo {
  isListedOnDEX: boolean;
  tradingPair?: string;
  minOrderSize?: string;
  maxOrderSize?: string;
  tradingEnabled: boolean;
}

// ============================================================
// ASSET METADATA
// ============================================================

export interface AssetMetadata {
  description?: string;
  website?: string;
  images?: string[];
  documents?: Array<{
    name: string;
    hash: string;
    type: string;
    uploadedAt: string;
  }>;
}

// ============================================================
// MAIN ASSET INTERFACE
// ============================================================

export interface TokenizedAsset {
  id: string;
  name: string;
  symbol: string;
  issuer: string;
  totalSupply: string;
  circulatingSupply?: string;
  decimals: number;
  assetType: AssetType;
  status: AssetStatus;
  complianceStatus: ComplianceStatus;
  isVerified: boolean;
  requiresKYC: boolean;
  enableClawback: boolean;
  jurisdictions?: string[];
  createdAt: string;
  updatedAt: string;
  metadata?: AssetMetadata;
  propertyDetails?: PropertyDetails;
  financials?: AssetFinancials;
  holders?: AssetHolders;
  tradingInfo?: TradingInfo;
}

// ============================================================
// PORTFOLIO TYPES
// ============================================================

export interface VestingInfo {
  totalVesting: string;
  vestedAmount: string;
  nextVestingDate: string;
  nextVestingAmount: string;
}

export interface PortfolioHolding {
  assetId: string;
  asset?: TokenizedAsset;
  balance: string;
  lockedBalance: string;
  availableBalance: string;
  vestingInfo?: VestingInfo;
  costBasis: number;
  currentValue: number;
  unrealizedGain: number;
  unrealizedGainPercent: number;
  dividendsReceived: number;
  acquisitionDate: string;
}

// ============================================================
// DIVIDEND DISTRIBUTION
// ============================================================

export interface DividendDistribution {
  id: string;
  assetId: string;
  totalAmount: string;
  currency: string;
  amountPerToken: string;
  recordDate: string;
  paymentDate: string;
  status: 'SCHEDULED' | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  dividendType: 'REGULAR' | 'SPECIAL' | 'INTERIM' | 'FINAL';
  eligibleHolders: number;
  totalEligibleTokens: string;
  taxWithholdingRate?: number;
  paidAt?: string;
  transactionHash?: string;
}

// ============================================================
// WHITELIST TYPES
// ============================================================

export interface WhitelistEntry {
  address: string;
  kycLevel: number;
  jurisdiction: string;
  accreditedInvestor: boolean;
  qualifiedPurchaser: boolean;
  investorType?: string;
  maxAllocation?: string;
  addedAt: string;
  expiresAt?: string;
  status: 'ACTIVE' | 'PENDING' | 'EXPIRED' | 'REVOKED';
  verificationDocumentHash?: string;
}

// ============================================================
// PLATFORM STATS
// ============================================================

export interface PlatformStats {
  totalAssetsTokenized: number;
  totalValueLocked: number;
  totalHolders: number;
  totalDividendsPaid: number;
  platformFeeCollected: number;
  averageDividendYield: number;
}
