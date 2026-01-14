/**
 * Verity Protocol - Tokenized Assets Type Definitions
 * Comprehensive types for RWA tokenization platform
 */

// ============================================================
// CORE CONSTANTS (used as const objects to avoid enum issues)
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

export type AssetType = (typeof AssetType)[keyof typeof AssetType];

export const AssetStatus = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
  FROZEN: 'FROZEN',
  REDEEMED: 'REDEEMED',
} as const;

export type AssetStatus = (typeof AssetStatus)[keyof typeof AssetStatus];

export const ComplianceStatus = {
  COMPLIANT: 'COMPLIANT',
  PENDING_REVIEW: 'PENDING_REVIEW',
  UNDER_REVIEW: 'UNDER_REVIEW',
  NON_COMPLIANT: 'NON_COMPLIANT',
} as const;

export type ComplianceStatus = (typeof ComplianceStatus)[keyof typeof ComplianceStatus];

export type AssetClassification = 'VERIFIED' | 'COMMUNITY';

export type AssetCategory =
  | 'REAL_ESTATE'
  | 'PRIVATE_EQUITY'
  | 'SECURITIES'
  | 'COMMODITIES'
  | 'CREATOR_TOKEN'
  | 'DAO_GOVERNANCE'
  | 'UTILITY';

export type PropertyType = 'COMMERCIAL' | 'RESIDENTIAL' | 'INDUSTRIAL' | 'LAND' | 'MIXED_USE';

export type ComplianceLevel = 'BASIC' | 'STANDARD' | 'INSTITUTIONAL';

export type TransferRestrictionType = 'WHITELIST' | 'BLACKLIST' | 'HOLDING_PERIOD' | 'MAX_HOLDERS';

export type DividendFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';

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
  coordinates?: {
    latitude: number;
    longitude: number;
  };
  documents?: PropertyDocument[];
  images?: string[];
}

export interface PropertyDocument {
  id?: string;
  name: string;
  type: string;
  hash?: string;
  url?: string;
  uploadedAt: string;
  verified?: boolean;
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
  marketMakerEnabled?: boolean;
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
  socialLinks?: Record<string, string>;
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
  
  // Additional details
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

export interface PortfolioSummary {
  totalValue: number;
  totalCost: number;
  totalGain: number;
  totalGainPercent: number;
  totalDividendsReceived: number;
  numberOfHoldings: number;
  holdings: PortfolioHolding[];
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

export interface DividendClaim {
  distributionId: string;
  holderAddress: string;
  amount: string;
  claimed: boolean;
  claimedAt?: string;
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
// COMPLIANCE TYPES
// ============================================================

export interface AssetCompliance {
  jurisdiction: string;
  requiresKYC: boolean;
  accreditedOnly: boolean;
  qualifiedPurchaserOnly: boolean;
  maxInvestors?: number;
  transferRestrictions?: TransferRestriction[];
  regulatoryFilings?: RegulatoryFiling[];
}

export interface TransferRestriction {
  type: TransferRestrictionType;
  params: {
    enabled?: boolean;
    days?: number;
    maxHolders?: number;
    addresses?: string[];
  };
}

export interface RegulatoryFiling {
  type: string;
  jurisdiction: string;
  filingDate: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  documentUrl?: string;
}

// ============================================================
// CLAWBACK (XLS-39D) TYPES
// ============================================================

export type ClawbackReason =
  | 'REGULATORY_REQUIREMENT'
  | 'REGULATORY_COMPLIANCE'
  | 'COURT_ORDER'
  | 'FRAUD_DETECTION'
  | 'FRAUD_PREVENTION'
  | 'SANCTIONS_COMPLIANCE'
  | 'INVESTOR_PROTECTION'
  | 'AML_VIOLATION'
  | 'ERROR_CORRECTION';

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
// DEX LISTING
// ============================================================

export interface DEXListing {
  assetId: string;
  tradingPair: string;
  basePrice: string;
  quoteCurrency: string;
  minOrderSize: string;
  maxOrderSize?: string;
  tradingEnabled: boolean;
  marketMakerEnabled: boolean;
  listedAt: string;
  volume24h?: string;
  priceChange24h?: number;
}

export interface OrderBookEntry {
  price: string;
  amount: string;
  total: string;
  cumulative?: string;
}

export interface AssetOrderBook {
  assetId: string;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  spread?: string;
  midPrice?: string;
}

// ============================================================
// ASSET CREATION / ISSUANCE
// ============================================================

export interface CreateAssetRequest {
  name: string;
  symbol: string;
  totalSupply: string;
  decimals?: number;
  assetType: AssetType;
  requiresKYC?: boolean;
  enableClawback?: boolean;
  description?: string;
  jurisdictions?: string[];
  metadata?: Record<string, unknown>;
}

export interface TokenizeRealEstateRequest {
  name: string;
  symbol: string;
  totalSupply: string;
  assetType: 'REAL_ESTATE';
  propertyAddress: string;
  propertyType: string;
  valuationUSD: number;
  squareFootage?: number;
  yearBuilt?: number;
  legalEntity?: string;
  titleDeedHash?: string;
  appraisalDocumentHash?: string;
  insuranceDocumentHash?: string;
  legalOpinionHash?: string;
  dividendYield?: number;
  minInvestmentUSD?: number;
  enableClawback?: boolean;
  jurisdictions?: string[];
}

export interface TokenizePrivateEquityRequest {
  name: string;
  symbol: string;
  totalSupply: string;
  assetType: 'PRIVATE_EQUITY';
  companyName: string;
  valuationUSD: number;
  equityPercentage: number;
  legalEntity?: string;
  memorandumHash?: string;
  financialStatementsHash?: string;
  legalOpinionHash?: string;
  enableClawback?: boolean;
  jurisdictions?: string[];
}

// ============================================================
// FEE STRUCTURE
// ============================================================

export interface TokenizationFee {
  feeAmount: string;
  feeCurrency: string;
  feePercentage: number;
  isCapped: boolean;
  originalFee: string;
  cappedAt?: string;
}

export interface FeeStructure {
  assetTokenization: {
    percentage: string;
    basisPoints: number;
    minimumFee: string;
    maximumFee: string;
    description: string;
    examples: Array<{
      assetValue: string;
      fee: string;
      calculation: string;
    }>;
  };
  tradingFee: {
    percentage: string;
    basisPoints: number;
  };
  dividendProcessingFee: {
    percentage: string;
    basisPoints: number;
  };
  discounts: {
    payWithVRTY: string;
    stakingTiers: Array<{
      tier: string;
      minStake: string;
      discount: string;
    }>;
  };
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
  assetsByType: Record<AssetType, number>;
  volumeLast24h: number;
  volumeLast7d: number;
}

// ============================================================
// API RESPONSE TYPES
// ============================================================

export interface AssetsListResponse {
  data: TokenizedAsset[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export interface AssetDetailResponse {
  data: TokenizedAsset;
  holders: AssetHolders;
  recentDividends: DividendDistribution[];
  orderBook?: AssetOrderBook;
}

// ============================================================
// FILTER & SORT OPTIONS
// ============================================================

export interface AssetFilters {
  type?: AssetType;
  status?: AssetStatus;
  complianceStatus?: ComplianceStatus;
  jurisdiction?: string;
  minValue?: number;
  maxValue?: number;
  verified?: boolean;
  tradingEnabled?: boolean;
}

export type AssetSortField = 
  | 'createdAt' 
  | 'name' 
  | 'totalSupply' 
  | 'totalHolders' 
  | 'marketCap' 
  | 'dividendYield'
  | 'value';

export type SortDirection = 'asc' | 'desc';

// ============================================================
// HELPER CONSTANTS
// ============================================================

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  [AssetType.REAL_ESTATE]: 'Real Estate',
  [AssetType.PRIVATE_EQUITY]: 'Private Equity',
  [AssetType.SECURITY]: 'Security',
  [AssetType.COMMUNITY]: 'Community',
  [AssetType.DEBT]: 'Debt',
  [AssetType.COMMODITY]: 'Commodity',
  [AssetType.COLLECTIBLE]: 'Collectible',
  [AssetType.INFRASTRUCTURE]: 'Infrastructure',
};

export const ASSET_STATUS_LABELS: Record<AssetStatus, string> = {
  [AssetStatus.PENDING]: 'Pending',
  [AssetStatus.ACTIVE]: 'Active',
  [AssetStatus.SUSPENDED]: 'Suspended',
  [AssetStatus.FROZEN]: 'Frozen',
  [AssetStatus.REDEEMED]: 'Redeemed',
};

export const COMPLIANCE_STATUS_LABELS: Record<ComplianceStatus, string> = {
  [ComplianceStatus.COMPLIANT]: 'Compliant',
  [ComplianceStatus.PENDING_REVIEW]: 'Pending Review',
  [ComplianceStatus.UNDER_REVIEW]: 'Under Review',
  [ComplianceStatus.NON_COMPLIANT]: 'Non-Compliant',
};

export const CLAWBACK_REASON_LABELS: Record<ClawbackReason, string> = {
  REGULATORY_REQUIREMENT: 'Regulatory Requirement',
  REGULATORY_COMPLIANCE: 'Regulatory Compliance',
  COURT_ORDER: 'Court Order',
  FRAUD_DETECTION: 'Fraud Detection',
  FRAUD_PREVENTION: 'Fraud Prevention',
  SANCTIONS_COMPLIANCE: 'Sanctions Compliance',
  INVESTOR_PROTECTION: 'Investor Protection',
  AML_VIOLATION: 'AML Violation',
  ERROR_CORRECTION: 'Error Correction',
};
