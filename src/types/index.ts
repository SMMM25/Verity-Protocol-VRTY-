/**
 * Verity Protocol - Core Type Definitions
 * The Verified Financial Operating System for XRP Ledger
 */

// ===========================================
// Network & Configuration Types
// ===========================================

export type XRPLNetwork = 'mainnet' | 'testnet' | 'devnet';

export interface VerityConfig {
  network: XRPLNetwork;
  apiKey?: string;
  enableVerification: boolean;
  issuerAddress?: string;
  customRpcUrl?: string;
  timeout?: number;
}

export interface NetworkConfig {
  url: string;
  network: XRPLNetwork;
  explorerUrl: string;
  faucetUrl?: string;
}

// ===========================================
// XAO-DOW (XLS-39D) Clawback Types
// ===========================================

export interface ClawbackConfig {
  enabled: boolean;
  requiresGovernance: boolean;
  governanceQuorum: number;
  allowedReasons: ClawbackReason[];
}

export type ClawbackReason =
  | 'REGULATORY_REQUIREMENT'
  | 'COURT_ORDER'
  | 'FRAUD_DETECTION'
  | 'SANCTIONS_COMPLIANCE'
  | 'INVESTOR_PROTECTION'
  | 'ERROR_CORRECTION';

export interface ClawbackExecution {
  asset: string;
  fromWallet: string;
  amount: string;
  reason: ClawbackReason;
  legalJustification: string;
  governanceApprovals: GovernanceApproval[];
  executedAt?: Date;
  transactionHash?: string;
}

export interface GovernanceApproval {
  signer: string;
  signature: string;
  timestamp: Date;
  approved: boolean;
}

// ===========================================
// Asset Types (Verity Assets)
// ===========================================

export type AssetClassification = 'VERIFIED' | 'COMMUNITY';

export type AssetCategory =
  | 'REAL_ESTATE'
  | 'PRIVATE_EQUITY'
  | 'SECURITIES'
  | 'COMMODITIES'
  | 'CREATOR_TOKEN'
  | 'DAO_GOVERNANCE'
  | 'UTILITY';

export interface AssetConfig {
  name: string;
  symbol: string;
  totalSupply: string;
  decimals?: number;
  classification: AssetClassification;
  category: AssetCategory;
  clawbackEnabled: boolean;
  transferRate?: number;
  verification: AssetVerification;
  compliance: AssetCompliance;
  metadata: AssetMetadata;
}

export interface AssetVerification {
  publicAuditTrail: boolean;
  complianceLevel: 'BASIC' | 'STANDARD' | 'INSTITUTIONAL';
  verificationDomain?: string;
  thirdPartyAuditor?: string;
}

export interface AssetCompliance {
  jurisdiction: string;
  requiresKYC: boolean;
  accreditedOnly: boolean;
  transferRestrictions: TransferRestriction[];
  dividendSchedule?: DividendSchedule;
}

export interface TransferRestriction {
  type: 'WHITELIST' | 'BLACKLIST' | 'HOLDING_PERIOD' | 'MAX_HOLDERS';
  params: Record<string, unknown>;
}

export interface DividendSchedule {
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUALLY';
  paymentCurrency: string;
  autoDistribute: boolean;
}

export interface AssetMetadata {
  description: string;
  imageUrl?: string;
  documentUrls?: string[];
  externalUrl?: string;
  legalEntityId?: string;
  propertyDetails?: PropertyDetails;
}

export interface PropertyDetails {
  address: string;
  type: string;
  appraisedValue: string;
  appraisalDate: Date;
  squareFootage?: number;
  yearBuilt?: number;
}

export interface VerifiedAsset {
  id: string;
  issuer: string;
  currencyCode: string;
  config: AssetConfig;
  status: AssetStatus;
  createdAt: Date;
  updatedAt: Date;
  verificationHash: string;
}

export type AssetStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'RETIRED';

// ===========================================
// Signal Types (Verity Signals)
// ===========================================

export interface SignalConfig {
  contentNFTId: string;
  signalType: SignalType;
  amount: string; // XRP drops
  message?: string;
}

export type SignalType =
  | 'ENDORSEMENT'
  | 'BOOST'
  | 'SUPPORT'
  | 'CHALLENGE'
  | 'REPLY';

export interface Signal {
  id: string;
  sender: string;
  recipient: string;
  contentNFTId: string;
  signalType: SignalType;
  amount: string;
  timestamp: Date;
  transactionHash: string;
  verificationHash: string;
}

export interface ReputationScore {
  wallet: string;
  totalSignalsReceived: number;
  totalSignalsSent: number;
  totalXRPReceived: string;
  totalXRPSent: string;
  reputationScore: number;
  rank?: number;
  lastUpdated: Date;
}

export interface ContentNFT {
  tokenId: string;
  creator: string;
  contentHash: string;
  contentType: string;
  uri: string;
  totalSignals: number;
  totalValue: string;
  createdAt: Date;
}

// ===========================================
// Guild Types (Verity Guilds)
// ===========================================

export interface GuildConfig {
  name: string;
  description: string;
  treasuryRules: TreasuryRules;
  membershipRules: MembershipRules;
  governanceRules: GovernanceRules;
}

export interface TreasuryRules {
  requiredSigners: number;
  totalSigners: number;
  autoXRPConversion: boolean;
  recurringPayments: RecurringPayment[];
  revenueSharing: RevenueShareConfig;
  withdrawalLimits: WithdrawalLimit[];
}

export interface RecurringPayment {
  payee: string;
  amount: string;
  currency: string;
  frequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';
  description: string;
  enabled: boolean;
}

export interface RevenueShareConfig {
  enabled: boolean;
  distributionFrequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  memberShares: MemberShare[];
}

export interface MemberShare {
  member: string;
  sharePercentage: number; // Basis points (10000 = 100%)
}

export interface WithdrawalLimit {
  currency: string;
  maxAmount: string;
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY';
}

export interface MembershipRules {
  openMembership: boolean;
  requiredStake?: string;
  requiredVRTY?: string;
  approvalRequired: boolean;
  maxMembers?: number;
}

export interface GovernanceRules {
  proposalThreshold: string; // VRTY required to propose
  votingPeriod: number; // Hours
  quorumPercentage: number; // Basis points
  executionDelay: number; // Hours after passing
}

export interface Guild {
  id: string;
  name: string;
  treasuryWallet: string;
  config: GuildConfig;
  members: GuildMember[];
  totalTreasuryValue: string;
  status: GuildStatus;
  createdAt: Date;
  verificationHash: string;
}

export interface GuildMember {
  wallet: string;
  role: GuildRole;
  shares: number;
  joinedAt: Date;
  isSigner: boolean;
}

export type GuildRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'OBSERVER';
export type GuildStatus = 'ACTIVE' | 'SUSPENDED' | 'DISSOLVED';

// ===========================================
// VRTY Token Types
// ===========================================

export interface VRTYStake {
  wallet: string;
  stakedAmount: string;
  stakingTier: StakingTier;
  rewardsEarned: string;
  rewardsClaimed: string;
  stakedAt: Date;
  lockEndDate?: Date;
}

export type StakingTier = 'BASIC' | 'PROFESSIONAL' | 'INSTITUTIONAL' | 'DEVELOPER';

export interface StakingTierConfig {
  tier: StakingTier;
  minStake: string;
  feeDiscount: number; // Basis points
  features: string[];
}

export interface FeeCalculation {
  baseFee: string;
  vrtyDiscount: string;
  finalFee: string;
  paidInVRTY: boolean;
}

export interface GovernanceVote {
  proposalId: string;
  voter: string;
  voteWeight: string;
  support: boolean;
  timestamp: Date;
  transactionHash: string;
}

export interface GovernanceProposal {
  id: string;
  proposer: string;
  title: string;
  description: string;
  category: ProposalCategory;
  forVotes: string;
  againstVotes: string;
  status: ProposalStatus;
  executionPayload?: string;
  createdAt: Date;
  votingEndsAt: Date;
  executedAt?: Date;
}

export type ProposalCategory =
  | 'FEE_CHANGE'
  | 'CLAWBACK_POLICY'
  | 'ASSET_VERIFICATION'
  | 'TREASURY_ALLOCATION'
  | 'PROTOCOL_UPGRADE';

export type ProposalStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'PASSED'
  | 'FAILED'
  | 'EXECUTED'
  | 'CANCELLED';

// ===========================================
// Auto-Tax Types
// ===========================================

export interface TaxProfile {
  userId: string;
  taxResidence: string;
  taxId?: string;
  costBasisMethod: CostBasisMethod;
  treatyBenefits: string[];
  filingStatus?: string;
}

export type CostBasisMethod = 'FIFO' | 'LIFO' | 'HIFO' | 'SPECIFIC_ID' | 'AVERAGE';

export interface TaxCalculation {
  transactionId: string;
  transactionType: TaxTransactionType;
  proceeds: string;
  costBasis: string;
  gainLoss: string;
  taxableAmount: string;
  taxRate: number;
  taxOwed: string;
  jurisdiction: string;
  methodology: string;
  calculatedAt: Date;
}

export type TaxTransactionType =
  | 'CAPITAL_GAIN'
  | 'CAPITAL_LOSS'
  | 'DIVIDEND_INCOME'
  | 'INTEREST_INCOME'
  | 'ORDINARY_INCOME'
  | 'GIFT'
  | 'NON_TAXABLE';

export interface TaxReport {
  userId: string;
  taxYear: number;
  jurisdiction: string;
  totalGains: string;
  totalLosses: string;
  netGainLoss: string;
  totalTaxOwed: string;
  transactions: TaxCalculation[];
  generatedAt: Date;
  reportFormat: 'IRS_8949' | 'HMRC' | 'GENERIC';
}

// ===========================================
// API Types
// ===========================================

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: APIError;
  meta?: APIMetadata;
}

export interface APIError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface APIMetadata {
  requestId: string;
  timestamp: Date;
  processingTime: number;
  pagination?: PaginationInfo;
}

export interface PaginationInfo {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface WebSocketMessage {
  type: string;
  channel: string;
  data: unknown;
  timestamp: Date;
}

// ===========================================
// Transaction Types
// ===========================================

export interface VerityTransaction {
  id: string;
  type: VerityTransactionType;
  from: string;
  to?: string;
  amount?: string;
  currency?: string;
  status: TransactionStatus;
  xrplTxHash?: string;
  verificationHash: string;
  memo?: TransactionMemo;
  createdAt: Date;
  confirmedAt?: Date;
}

export type VerityTransactionType =
  | 'ASSET_ISSUANCE'
  | 'ASSET_TRANSFER'
  | 'ASSET_CLAWBACK'
  | 'SIGNAL_SEND'
  | 'GUILD_PAYMENT'
  | 'STAKING'
  | 'UNSTAKING'
  | 'GOVERNANCE_VOTE'
  | 'FEE_PAYMENT';

export type TransactionStatus =
  | 'PENDING'
  | 'SUBMITTED'
  | 'CONFIRMED'
  | 'FAILED'
  | 'CANCELLED';

export interface TransactionMemo {
  type: string;
  data: string;
  format: string;
}

// ===========================================
// Audit & Compliance Types
// ===========================================

export interface AuditLogEntry {
  id: string;
  action: string;
  actor: string;
  target?: string;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  verificationHash: string;
}

export interface ComplianceCheck {
  checkType: ComplianceCheckType;
  wallet: string;
  status: ComplianceStatus;
  details: Record<string, unknown>;
  checkedAt: Date;
  expiresAt?: Date;
}

export type ComplianceCheckType =
  | 'KYC'
  | 'AML'
  | 'SANCTIONS'
  | 'ACCREDITATION'
  | 'JURISDICTION';

export type ComplianceStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
