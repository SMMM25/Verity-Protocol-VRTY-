import axios from 'axios';

// API base URL - uses proxy in development, direct URL in production
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for auth
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('verity_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('verity_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Tax API functions
export const taxApi = {
  // Profile
  getProfile: (userId: string) => 
    api.get(`/tax/profile/${userId}`).then(res => res.data),
  
  createProfile: (data: {
    userId: string;
    taxResidence: string;
    costBasisMethod: string;
    taxId?: string;
  }) => 
    api.post('/tax/profile', data).then(res => res.data),

  // Transactions
  getTransactions: (userId: string, params?: { taxYear?: number; asset?: string }) =>
    api.get(`/tax/transactions/${userId}`, { params }).then(res => res.data),

  recordTransaction: (userId: string, transaction: {
    type: string;
    asset: string;
    amount: string;
    pricePerUnit: string;
    totalValue: string;
    timestamp: string;
    transactionHash: string;
    fee?: string;
  }) =>
    api.post('/tax/calculate', { userId, transaction }).then(res => res.data),

  // Reports
  getSummary: (userId: string, taxYear: number) =>
    api.get(`/tax/summary/${userId}/${taxYear}`).then(res => res.data),

  generateReport: (userId: string, taxYear: number, format: string = 'GENERIC') =>
    api.post('/tax/report/generate', { userId, taxYear, format }).then(res => res.data),

  // Jurisdictions
  getJurisdictions: (params?: { region?: string; taxFriendly?: boolean }) =>
    api.get('/tax/jurisdictions', { params }).then(res => res.data),

  getJurisdictionRules: (code: string) =>
    api.get(`/tax/jurisdictions/${code}`).then(res => res.data),

  // Cost Basis
  getCostBasis: (userId: string, asset: string) =>
    api.get(`/tax/cost-basis/${userId}/${asset}`).then(res => res.data),

  // Methodology
  getMethodology: () =>
    api.get('/tax/methodology').then(res => res.data),
};

// ============================================================
// DEX API
// ============================================================

export const dexApi = {
  // Order Book
  getOrderBook: (pair?: string, limit?: number) =>
    api.get('/dex/orderbook', { params: { pair, limit } }).then(res => res.data),

  // Market Stats
  getMarketStats: (pair?: string) =>
    api.get('/dex/stats', { params: { pair } }).then(res => res.data),

  // Current Price
  getCurrentPrice: (pair?: string) =>
    api.get('/dex/price', { params: { pair } }).then(res => res.data),

  // Recent Trades
  getRecentTrades: (pair?: string, limit?: number) =>
    api.get('/dex/trades', { params: { pair, limit } }).then(res => res.data),

  // Create Order (requires wallet connection)
  createOrder: (data: {
    side: 'buy' | 'sell';
    amount: string;
    price: string;
    pair?: string;
  }) =>
    api.post('/dex/order', data).then(res => res.data),

  // Cancel Order
  cancelOrder: (offerSequence: number) =>
    api.delete(`/dex/order/${offerSequence}`).then(res => res.data),

  // Get Account Orders
  getAccountOrders: (account: string) =>
    api.get(`/dex/orders/${account}`).then(res => res.data),
};

// ============================================================
// XRPL API
// ============================================================

export const xrplApi = {
  // Network Info
  getNetworkInfo: () =>
    api.get('/xrpl/info').then(res => res.data),

  // Account Info
  getAccountInfo: (address: string) =>
    api.get(`/xrpl/account/${address}`).then(res => res.data),

  // Account Balances
  getBalances: (address: string) =>
    api.get(`/xrpl/balances/${address}`).then(res => res.data),

  // Account Trustlines
  getTrustlines: (address: string) =>
    api.get(`/xrpl/trustlines/${address}`).then(res => res.data),

  // Transaction History
  getTransactions: (address: string, limit?: number) =>
    api.get(`/xrpl/transactions/${address}`, { params: { limit } }).then(res => res.data),
};

// ============================================================
// GUILD API
// ============================================================

export const guildApi = {
  // List guilds
  getGuilds: (params?: { page?: number; limit?: number; member?: string; public?: boolean }) =>
    api.get('/guilds', { params }).then(res => res.data),

  // Get single guild
  getGuild: (guildId: string) =>
    api.get(`/guilds/${guildId}`).then(res => res.data),

  // Create guild
  createGuild: (data: {
    name: string;
    description?: string;
    treasuryWallet: string;
    ownerWallet: string;
    membershipFee?: number;
    minStakeToJoin?: number;
    isPublic?: boolean;
  }) =>
    api.post('/guilds/treasury', data).then(res => res.data),

  // Get guild audit trail
  getAudit: (guildId: string, params?: { page?: number; limit?: number; type?: string }) =>
    api.get(`/guilds/${guildId}/audit`, { params }).then(res => res.data),

  // Members
  getMembers: (guildId: string, params?: { includeFormer?: boolean }) =>
    api.get(`/guilds/${guildId}/members`, { params }).then(res => res.data),

  addMember: (guildId: string, data: {
    wallet: string;
    role?: 'ADMIN' | 'MEMBER';
    sharePercentage?: number;
    requesterWallet: string;
  }) =>
    api.post(`/guilds/${guildId}/members`, data).then(res => res.data),

  updateMember: (guildId: string, wallet: string, data: {
    role?: 'ADMIN' | 'MEMBER';
    sharePercentage?: number;
    requesterWallet: string;
  }) =>
    api.patch(`/guilds/${guildId}/members/${wallet}`, data).then(res => res.data),

  removeMember: (guildId: string, wallet: string, requesterWallet: string) =>
    api.delete(`/guilds/${guildId}/members/${wallet}`, { 
      params: { requesterWallet } 
    }).then(res => res.data),

  // Transactions
  getTransactions: (guildId: string, params?: { page?: number; limit?: number; type?: string }) =>
    api.get(`/guilds/${guildId}/transactions`, { params }).then(res => res.data),

  recordTransaction: (guildId: string, data: {
    type: string;
    amount: number;
    currency?: string;
    fromWallet?: string;
    toWallet?: string;
    description?: string;
    txHash?: string;
    requesterWallet: string;
  }) =>
    api.post(`/guilds/${guildId}/transactions`, data).then(res => res.data),

  // Revenue distribution
  distributeRevenue: (guildId: string, data: {
    totalAmount: number;
    currency?: string;
    requesterWallet: string;
    txHash?: string;
  }) =>
    api.post(`/guilds/${guildId}/revenue/distribute`, data).then(res => res.data),

  // Stats
  getStats: () =>
    api.get('/guilds/stats/global').then(res => res.data),

  // Dissolve guild
  dissolveGuild: (guildId: string, data: { wallet: string; reason?: string }) =>
    api.post(`/guilds/${guildId}/dissolve`, data).then(res => res.data),

  // Health check
  getHealth: () =>
    api.get('/guilds/health').then(res => res.data),
};

// ============================================================
// TOKENIZED ASSETS API
// ============================================================

export const assetsApi = {
  // ========== Asset Management ==========
  
  // Get all assets with filtering
  getAssets: (params?: {
    type?: string;
    status?: string;
    creator?: string;
    verified?: boolean;
    page?: number;
    limit?: number;
  }) =>
    api.get('/assets', { params }).then(res => res.data),

  // Get single asset by ID
  getAsset: (assetId: string) =>
    api.get(`/assets/${assetId}`).then(res => res.data),

  // Get asset verification dashboard
  getAssetVerification: (assetId: string) =>
    api.get(`/assets/${assetId}/verification`).then(res => res.data),

  // ========== Asset Creation ==========

  // Issue new token (generic)
  issueAsset: (data: {
    name: string;
    symbol: string;
    totalSupply: string;
    decimals?: number;
    assetType: string;
    requiresKYC?: boolean;
    enableClawback?: boolean;
    metadata?: Record<string, unknown>;
  }) =>
    api.post('/assets/issue', data).then(res => res.data),

  // Tokenize real estate
  tokenizeRealEstate: (data: {
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
  }) =>
    api.post('/assets/tokenize/real-estate', data).then(res => res.data),

  // Tokenize private equity
  tokenizePrivateEquity: (data: {
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
  }) =>
    api.post('/assets/tokenize/private-equity', data).then(res => res.data),

  // Tokenize securities
  tokenizeSecurities: (data: {
    name: string;
    symbol: string;
    totalSupply: string;
    assetType: 'SECURITY';
    securityType: string;
    cusipNumber?: string;
    isinNumber?: string;
    valuationUSD: number;
    issuerName: string;
    prospectusHash?: string;
    enableClawback?: boolean;
    jurisdictions?: string[];
  }) =>
    api.post('/assets/tokenize/securities', data).then(res => res.data),

  // Create community token
  createCommunityToken: (data: {
    name: string;
    symbol: string;
    totalSupply: string;
    assetType: 'COMMUNITY';
    description?: string;
    website?: string;
    socialLinks?: Record<string, string>;
    enableClawback?: boolean;
  }) =>
    api.post('/assets/community/create', data).then(res => res.data),

  // ========== Whitelist Management ==========
  
  // Add address to whitelist
  addToWhitelist: (assetId: string, data: {
    address: string;
    kycLevel: number;
    jurisdiction: string;
    accreditedInvestor?: boolean;
    qualifiedPurchaser?: boolean;
    investorType?: string;
    maxAllocation?: string;
    expiresAt?: string;
    verificationDocumentHash?: string;
  }) =>
    api.post(`/assets/${assetId}/whitelist`, data).then(res => res.data),

  // Remove from whitelist
  removeFromWhitelist: (assetId: string, address: string, reason?: string) =>
    api.delete(`/assets/${assetId}/whitelist/${address}`, { 
      data: { reason } 
    }).then(res => res.data),

  // Get whitelist for asset
  getWhitelist: (assetId: string, params?: { page?: number; limit?: number; status?: string }) =>
    api.get(`/assets/${assetId}/whitelist`, { params }).then(res => res.data),

  // Check if address is whitelisted
  checkWhitelist: (assetId: string, address: string) =>
    api.get(`/assets/${assetId}/whitelist/${address}`).then(res => res.data),

  // ========== Token Distribution ==========

  // Distribute tokens to holder
  distributeTokens: (assetId: string, data: {
    recipient: string;
    amount: string;
    lockupPeriodDays?: number;
    vestingSchedule?: {
      startDate: string;
      endDate: string;
      cliffMonths?: number;
      totalTokens: string;
    };
    memo?: string;
  }) =>
    api.post(`/assets/${assetId}/distribute`, data).then(res => res.data),

  // Batch distribute tokens
  batchDistribute: (assetId: string, distributions: Array<{
    recipient: string;
    amount: string;
    lockupPeriodDays?: number;
    memo?: string;
  }>) =>
    api.post(`/assets/${assetId}/distribute/batch`, { distributions }).then(res => res.data),

  // Get holders of an asset
  getHolders: (assetId: string, params?: { page?: number; limit?: number }) =>
    api.get(`/assets/${assetId}/holders`, { params }).then(res => res.data),

  // ========== Dividends ==========

  // Distribute dividends
  distributeDividends: (assetId: string, data: {
    totalAmount: string;
    currency: string;
    recordDate: string;
    paymentDate: string;
    dividendType: 'REGULAR' | 'SPECIAL' | 'INTERIM' | 'FINAL';
    taxWithholdingRate?: number;
    snapshotBlock?: number;
    memo?: string;
  }) =>
    api.post(`/assets/${assetId}/dividends`, data).then(res => res.data),

  // Get dividend history
  getDividendHistory: (assetId: string, params?: { page?: number; limit?: number }) =>
    api.get(`/assets/${assetId}/dividends`, { params }).then(res => res.data),

  // Get holder dividend claims
  getHolderDividends: (address: string, params?: { assetId?: string; claimed?: boolean }) =>
    api.get(`/dividends/holder/${address}`, { params }).then(res => res.data),

  // Claim dividend
  claimDividend: (distributionId: string) =>
    api.post(`/dividends/${distributionId}/claim`).then(res => res.data),

  // ========== DEX Integration ==========

  // List asset on DEX
  listOnDEX: (assetId: string, data: {
    basePrice: string;
    quoteCurrency: string;
    minOrderSize: string;
    maxOrderSize?: string;
    tradingEnabled?: boolean;
    marketMakerEnabled?: boolean;
    initialLiquidity?: string;
  }) =>
    api.post(`/assets/${assetId}/dex/list`, data).then(res => res.data),

  // Get DEX listing status
  getDEXListing: (assetId: string) =>
    api.get(`/assets/${assetId}/dex`).then(res => res.data),

  // Update DEX listing
  updateDEXListing: (assetId: string, data: {
    tradingEnabled?: boolean;
    minOrderSize?: string;
    maxOrderSize?: string;
  }) =>
    api.patch(`/assets/${assetId}/dex`, data).then(res => res.data),

  // Get asset order book
  getAssetOrderBook: (assetId: string, params?: { limit?: number }) =>
    api.get(`/assets/${assetId}/dex/orderbook`, { params }).then(res => res.data),

  // Get asset trades
  getAssetTrades: (assetId: string, params?: { limit?: number; since?: string }) =>
    api.get(`/assets/${assetId}/dex/trades`, { params }).then(res => res.data),

  // ========== Compliance ==========

  // Get compliance status
  getComplianceStatus: (assetId: string) =>
    api.get(`/assets/${assetId}/compliance`).then(res => res.data),

  // Update compliance status
  updateComplianceStatus: (assetId: string, data: {
    status: string;
    notes?: string;
    documentHashes?: string[];
  }) =>
    api.patch(`/assets/${assetId}/compliance`, data).then(res => res.data),

  // Get clawback proposals
  getClawbackProposals: (assetId: string) =>
    api.get(`/assets/${assetId}/clawback/proposals`).then(res => res.data),

  // Initiate clawback (governance required)
  initiateClawback: (assetId: string, data: {
    targetAddress: string;
    amount: string;
    reason: string;
    evidence?: string;
    governanceProposalId?: string;
  }) =>
    api.post(`/assets/${assetId}/clawback/initiate`, data).then(res => res.data),

  // ========== Asset Updates ==========

  // Update asset metadata
  updateAssetMetadata: (assetId: string, data: {
    description?: string;
    website?: string;
    documents?: Array<{ name: string; hash: string; type: string }>;
    images?: string[];
    valuationUSD?: number;
  }) =>
    api.patch(`/assets/${assetId}/metadata`, data).then(res => res.data),

  // Update asset status
  updateAssetStatus: (assetId: string, status: string, reason?: string) =>
    api.patch(`/assets/${assetId}/status`, { status, reason }).then(res => res.data),

  // ========== Portfolio ==========

  // Get user's asset holdings
  getPortfolio: (address: string) =>
    api.get(`/assets/portfolio/${address}`).then(res => res.data),

  // Get portfolio summary with metrics
  getPortfolioSummary: (address: string) =>
    api.get(`/assets/portfolio/${address}/summary`).then(res => res.data),

  // Get transaction history for portfolio
  getPortfolioTransactions: (address: string, params?: { 
    assetId?: string; 
    type?: string; 
    page?: number; 
    limit?: number 
  }) =>
    api.get(`/assets/portfolio/${address}/transactions`, { params }).then(res => res.data),

  // ========== Analytics ==========

  // Get asset metrics
  getAssetMetrics: (assetId: string, params?: { timeframe?: string }) =>
    api.get(`/assets/${assetId}/metrics`, { params }).then(res => res.data),

  // Get platform-wide asset stats
  getPlatformStats: () =>
    api.get('/assets/stats').then(res => res.data),

  // Get fee structure
  getFeeStructure: () =>
    api.get('/assets/fees').then(res => res.data),

  // ========== Documents ==========

  // Upload document for verification
  uploadDocument: (assetId: string, data: FormData) =>
    api.post(`/assets/${assetId}/documents`, data, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then(res => res.data),

  // Get document verification status
  getDocuments: (assetId: string) =>
    api.get(`/assets/${assetId}/documents`).then(res => res.data),
};

// ============================================================
// SIGNALS API
// ============================================================

export const signalsApi = {
  // Send signal
  sendSignal: (data: {
    contentNFTId: string;
    amount: string;
    signalType: string;
    message?: string;
  }) =>
    api.post('/signals/send', data).then(res => res.data),

  // Mint content NFT
  mintContentNFT: (data: {
    contentHash: string;
    contentUri: string;
    contentType: string;
  }) =>
    api.post('/signals/content/mint', data).then(res => res.data),

  // Get content NFT details
  getContentNFT: (tokenId: string) =>
    api.get(`/signals/content/${tokenId}`).then(res => res.data),

  // Get reputation score
  getReputation: (wallet: string) =>
    api.get(`/signals/reputation/${wallet}`).then(res => res.data),

  // Get leaderboard
  getLeaderboard: (params?: { limit?: number }) =>
    api.get('/signals/leaderboard', { params }).then(res => res.data),

  // Discover content
  discover: (params?: {
    minSignals?: number;
    minValue?: string;
    contentType?: string;
    creator?: string;
    sortBy?: 'signals' | 'value' | 'recent';
    limit?: number;
  }) =>
    api.get('/signals/discover', { params }).then(res => res.data),

  // Get algorithm documentation
  getAlgorithm: () =>
    api.get('/signals/algorithm').then(res => res.data),

  // Verify signal on-chain
  verifySignal: (signalId: string) =>
    api.get(`/signals/verify/${signalId}`).then(res => res.data),
};

// ============================================================
// AI SENTINEL API
// ============================================================

import type {
  AlertFilter,
  AlertActionRequest,
  AlertActionResponse,
  AlertsListResponse,
  SentinelAlert,
  SentinelStats,
  RuleDefinition,
  RuleUpdateRequest,
  Guardian,
  GuardianRegistrationRequest,
  WalletProfile,
  SentinelStatusResponse,
  RealTimeMetrics,
  ThreatCluster,
  ClawbackProposal,
  ClawbackVote
} from '../types/sentinel';

export const sentinelApi = {
  // ========== Alerts ==========
  
  // Get all alerts with filtering
  getAlerts: (filter?: AlertFilter): Promise<AlertsListResponse> =>
    api.get('/sentinel/alerts', { params: filter }).then(res => res.data),

  // Get single alert by ID
  getAlert: (alertId: string): Promise<SentinelAlert> =>
    api.get(`/sentinel/alerts/${alertId}`).then(res => res.data),

  // Start review of an alert
  startReview: (alertId: string, guardianWallet: string): Promise<SentinelAlert> =>
    api.post(`/sentinel/alerts/${alertId}/review`, { guardianWallet }).then(res => res.data),

  // Process action on an alert
  processAction: (request: AlertActionRequest): Promise<AlertActionResponse> =>
    api.post(`/sentinel/alerts/${request.alertId}/action`, request).then(res => res.data),

  // Get alert audit trail
  getAlertAudit: (alertId: string): Promise<SentinelAlert['auditLog']> =>
    api.get(`/sentinel/alerts/${alertId}/audit`).then(res => res.data),

  // ========== Rules ==========
  
  // Get all rules
  getRules: (): Promise<RuleDefinition[]> =>
    api.get('/sentinel/rules').then(res => res.data),

  // Get single rule
  getRule: (ruleId: string): Promise<RuleDefinition> =>
    api.get(`/sentinel/rules/${ruleId}`).then(res => res.data),

  // Update rule
  updateRule: (request: RuleUpdateRequest): Promise<RuleDefinition> =>
    api.patch(`/sentinel/rules/${request.ruleId}`, request).then(res => res.data),

  // Enable/disable rule
  setRuleEnabled: (ruleId: string, enabled: boolean): Promise<RuleDefinition> =>
    api.patch(`/sentinel/rules/${ruleId}/enabled`, { enabled }).then(res => res.data),

  // Create custom rule
  createRule: (data: Omit<RuleDefinition, 'id' | 'createdAt' | 'updatedAt'>): Promise<RuleDefinition> =>
    api.post('/sentinel/rules', data).then(res => res.data),

  // Delete rule (custom only)
  deleteRule: (ruleId: string): Promise<{ success: boolean }> =>
    api.delete(`/sentinel/rules/${ruleId}`).then(res => res.data),

  // ========== Guardians ==========
  
  // Get all guardians
  getGuardians: (): Promise<Guardian[]> =>
    api.get('/sentinel/guardians').then(res => res.data),

  // Get single guardian
  getGuardian: (wallet: string): Promise<Guardian> =>
    api.get(`/sentinel/guardians/${wallet}`).then(res => res.data),

  // Register new guardian
  registerGuardian: (data: GuardianRegistrationRequest): Promise<Guardian> =>
    api.post('/sentinel/guardians', data).then(res => res.data),

  // Update guardian role
  updateGuardianRole: (wallet: string, role: Guardian['role']): Promise<Guardian> =>
    api.patch(`/sentinel/guardians/${wallet}/role`, { role }).then(res => res.data),

  // Deactivate guardian
  deactivateGuardian: (wallet: string): Promise<{ success: boolean }> =>
    api.post(`/sentinel/guardians/${wallet}/deactivate`).then(res => res.data),

  // Get guardian leaderboard
  getGuardianLeaderboard: (params?: { limit?: number }): Promise<Array<{ guardian: Guardian; rank: number; score: number }>> =>
    api.get('/sentinel/guardians/leaderboard', { params }).then(res => res.data),

  // ========== Wallet Profiles ==========
  
  // Get wallet risk profile
  getWalletProfile: (wallet: string): Promise<WalletProfile> =>
    api.get(`/sentinel/wallets/${wallet}`).then(res => res.data),

  // Get wallets by risk score
  getHighRiskWallets: (params?: { minRiskScore?: number; limit?: number }): Promise<WalletProfile[]> =>
    api.get('/sentinel/wallets/high-risk', { params }).then(res => res.data),

  // Get wallet alerts
  getWalletAlerts: (wallet: string): Promise<SentinelAlert[]> =>
    api.get(`/sentinel/wallets/${wallet}/alerts`).then(res => res.data),

  // Get linked wallets (cluster analysis)
  getLinkedWallets: (wallet: string): Promise<string[]> =>
    api.get(`/sentinel/wallets/${wallet}/linked`).then(res => res.data),

  // ========== Statistics ==========
  
  // Get overall statistics
  getStats: (periodDays?: number): Promise<SentinelStats> =>
    api.get('/sentinel/stats', { params: { periodDays } }).then(res => res.data),

  // Get real-time metrics
  getRealTimeMetrics: (): Promise<RealTimeMetrics> =>
    api.get('/sentinel/metrics').then(res => res.data),

  // Get historical statistics
  getHistoricalStats: (params?: { startDate?: string; endDate?: string; granularity?: 'hour' | 'day' | 'week' }): Promise<Array<{ date: string; stats: SentinelStats }>> =>
    api.get('/sentinel/stats/historical', { params }).then(res => res.data),

  // ========== Threat Detection ==========
  
  // Get threat clusters
  getThreatClusters: (): Promise<ThreatCluster[]> =>
    api.get('/sentinel/threats/clusters').then(res => res.data),

  // Get specific cluster
  getThreatCluster: (clusterId: string): Promise<ThreatCluster> =>
    api.get(`/sentinel/threats/clusters/${clusterId}`).then(res => res.data),

  // Get threat timeline
  getThreatTimeline: (params?: { hours?: number }): Promise<Array<{ timestamp: string; alerts: number; severity: string }>> =>
    api.get('/sentinel/threats/timeline', { params }).then(res => res.data),

  // Get geographic threats
  getGeoThreats: (): Promise<Array<{ region: string; alertCount: number; volumeAtRisk: number }>> =>
    api.get('/sentinel/threats/geo').then(res => res.data),

  // ========== Clawback Integration (XLS-39D) ==========
  
  // Get clawback proposals
  getClawbackProposals: (params?: { status?: string }): Promise<ClawbackProposal[]> =>
    api.get('/sentinel/clawback/proposals', { params }).then(res => res.data),

  // Get single proposal
  getClawbackProposal: (proposalId: string): Promise<ClawbackProposal> =>
    api.get(`/sentinel/clawback/proposals/${proposalId}`).then(res => res.data),

  // Cast vote on proposal
  voteOnClawback: (vote: ClawbackVote): Promise<{ success: boolean }> =>
    api.post(`/sentinel/clawback/proposals/${vote.proposalId}/vote`, vote).then(res => res.data),

  // Execute approved clawback
  executeClawback: (proposalId: string): Promise<{ success: boolean; transactionHash?: string }> =>
    api.post(`/sentinel/clawback/proposals/${proposalId}/execute`).then(res => res.data),

  // ========== System ==========
  
  // Get system status
  getStatus: (): Promise<SentinelStatusResponse> =>
    api.get('/sentinel/status').then(res => res.data),

  // Get system configuration
  getConfig: (): Promise<Record<string, unknown>> =>
    api.get('/sentinel/config').then(res => res.data),

  // Health check
  healthCheck: (): Promise<{ status: 'healthy' | 'degraded' | 'critical'; details?: Record<string, unknown> }> =>
    api.get('/sentinel/health').then(res => res.data),

  // ========== Transaction Monitoring ==========
  
  // Submit transaction for analysis (manual)
  analyzeTransaction: (data: {
    hash: string;
    from: string;
    to: string;
    amount: number;
    asset: string;
    network: 'XRPL' | 'SOLANA' | 'ETHEREUM';
  }): Promise<{ analyzed: boolean; alertCreated: boolean; alertId?: string }> =>
    api.post('/sentinel/analyze', data).then(res => res.data),

  // Get processing queue status
  getQueueStatus: (): Promise<{ queueSize: number; processing: boolean; lastProcessed?: string }> =>
    api.get('/sentinel/queue').then(res => res.data),
};

// ============================================================
// CROSS-CHAIN BRIDGE API
// ============================================================

import type {
  SupportedChainsResponse,
  SolanaStatus,
  FeeEstimate,
  InitiateBridgeRequest,
  InitiateBridgeResponse,
  BridgeTransaction,
  BridgeHistoryResponse,
  WalletBalance,
  ValidatorSignatureRequest,
  ValidatorSignatureResponse,
  BridgeStatistics,
  BridgeHealth,
  BridgeStatus as BridgeStatusType
} from '../types/bridge';

export const bridgeApi = {
  // ========== Chain Information ==========
  
  // Get supported chains
  getSupportedChains: (): Promise<SupportedChainsResponse> =>
    api.get('/bridge/supported-chains').then(res => res.data.data),

  // Get Solana network status
  getSolanaStatus: (): Promise<SolanaStatus> =>
    api.get('/bridge/solana/status').then(res => res.data.data),

  // ========== Fee Estimation ==========
  
  // Estimate bridge fee
  estimateFee: (params: {
    sourceChain?: string;
    destinationChain: string;
    amount: string;
  }): Promise<FeeEstimate> =>
    api.get('/bridge/estimate-fee', { params }).then(res => res.data.data),

  // ========== Bridge Transactions ==========
  
  // Initiate bridge transaction
  initiateBridge: (data: InitiateBridgeRequest): Promise<InitiateBridgeResponse> =>
    api.post('/bridge/initiate', data).then(res => res.data.data),

  // Get bridge transaction status
  getBridgeStatus: (bridgeId: string): Promise<BridgeTransaction> =>
    api.get(`/bridge/transaction/${bridgeId}`).then(res => res.data.data),

  // Get bridge history for address
  getBridgeHistory: (address: string, params?: {
    page?: number;
    limit?: number;
    status?: BridgeStatusType;
  }): Promise<BridgeHistoryResponse> =>
    api.get(`/bridge/history/${address}`, { params }).then(res => res.data.data),

  // ========== Balances ==========
  
  // Get wVRTY balance on Solana
  getWVRTYBalance: (address: string): Promise<WalletBalance> =>
    api.get('/bridge/wvrty-balance', { params: { address } }).then(res => res.data.data),

  // ========== Validator Operations ==========
  
  // Add validator signature
  addValidatorSignature: (bridgeId: string, data: ValidatorSignatureRequest): Promise<ValidatorSignatureResponse> =>
    api.post(`/bridge/transaction/${bridgeId}/validate`, data).then(res => res.data.data),

  // ========== Statistics ==========
  
  // Get bridge statistics
  getStatistics: (): Promise<BridgeStatistics> =>
    api.get('/bridge/statistics').then(res => res.data.data),

  // ========== Health ==========
  
  // Check bridge health
  checkHealth: (): Promise<BridgeHealth> =>
    api.get('/bridge/health').then(res => res.data.data),
};

// ============================================================
// VRTY TOKEN API
// ============================================================

export interface VRTYTokenInfo {
  token: {
    symbol: string;
    name: string;
    decimals: number;
    currencyCode: string;
    currencyCodeHex: string;
  };
  supply: {
    total: string;
    circulating?: string;
    distributionWalletBalance?: string;
  };
  addresses: {
    issuer: string;
    distributionWallet: string;
  };
  network: string;
  explorer: {
    token: string;
    issuer: string;
    distribution: string;
  };
  bridge?: {
    solana: {
      devnet: string;
      mainnet: string;
    };
  };
}

export interface VRTYBalance {
  address: string;
  vrty: {
    balance: string;
    hasTrustline: boolean;
    trustlineLimit?: string;
  };
  xrp: {
    balance: string;
  };
  staking: {
    tier: string;
    tierDetails?: {
      minStake: number;
      maxStake: number;
      features: string[];
    };
    nextTier?: {
      name: string;
      required: number;
      progress: number;
    };
  };
}

export const vrtyApi = {
  // Get VRTY token information
  getTokenInfo: (): Promise<VRTYTokenInfo> =>
    api.get('/vrty/info').then(res => res.data.data),

  // Get VRTY balance for an address
  getBalance: (address: string, network?: 'mainnet' | 'testnet'): Promise<VRTYBalance> =>
    api.get(`/vrty/balance/${address}`, { params: { network } }).then(res => res.data.data),

  // Get staking tiers
  getStakingTiers: () =>
    api.get('/vrty/staking-tiers').then(res => res.data.data),

  // Get VRTY health status
  getHealth: () =>
    api.get('/vrty/health').then(res => res.data.data),
};

// ============================================================
// AUTH API
// ============================================================

export interface XummSignInPayload {
  payloadUuid: string;
  qrCodeUrl: string;
  deepLink: string;
  websocketUrl: string;
  expiresAt: string;
}

export interface AuthenticatedUser {
  wallet: string;
  network: string;
  authenticatedAt: string;
  expiresAt: string;
}

export const authApi = {
  // Initiate XUMM sign-in
  initiateXummSignIn: (): Promise<XummSignInPayload> =>
    api.post('/auth/xumm/signin').then(res => res.data.data),

  // Verify XUMM sign-in payload
  verifyXummSignIn: (uuid: string): Promise<{ status: string; user?: AuthenticatedUser }> =>
    api.get(`/auth/xumm/verify/${uuid}`).then(res => res.data.data),

  // Logout
  logout: () =>
    api.post('/auth/xumm/logout').then(res => res.data),

  // Get current session
  getSession: (): Promise<AuthenticatedUser> =>
    api.get('/auth/session').then(res => res.data.data?.user),

  // Get auth status
  getStatus: (): Promise<{ xummConfigured: boolean; developmentMode: boolean }> =>
    api.get('/auth/status').then(res => res.data.data),
};

export default api;
