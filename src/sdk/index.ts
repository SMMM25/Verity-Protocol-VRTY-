/**
 * Verity Protocol SDK
 * Developer-friendly interface for the Verified Financial Operating System
 */

import { Wallet } from 'xrpl';
import { XRPLClient, VerityXAODOW } from '../core/index.js';
import { VerityAssetManager } from '../assets/index.js';
import { VeritySignalsProtocol } from '../signals/index.js';
import { VerityGuildTreasury } from '../guilds/index.js';
import { VRTYTokenManager } from '../token/index.js';
import { VerityAutoTaxEngine } from '../tax/index.js';
import { logger } from '../utils/logger.js';
import type {
  VerityConfig,
  XRPLNetwork,
  AssetConfig,
  SignalType,
  GuildConfig,
  ClawbackConfig,
  ClawbackReason,
} from '../types/index.js';

export interface VeritySDKConfig extends VerityConfig {
  issuerSeed?: string;
  governanceSigners?: string[];
  clawbackConfig?: Partial<ClawbackConfig>;
}

/**
 * Verity Protocol SDK
 * Main entry point for developers integrating with Verity Protocol
 */
export class VeritySDK {
  private config: VeritySDKConfig;
  private xrplClient: XRPLClient;
  private issuerWallet?: Wallet;
  private xaoDow?: VerityXAODOW;
  private assetManager?: VerityAssetManager;
  private signalsProtocol?: VeritySignalsProtocol;
  private guildTreasury?: VerityGuildTreasury;
  private tokenManager?: VRTYTokenManager;
  private taxEngine?: VerityAutoTaxEngine;
  private initialized = false;

  constructor(config: VeritySDKConfig) {
    this.config = {
      ...config,
      enableVerification: config.enableVerification ?? true,
    };

    this.xrplClient = new XRPLClient({
      network: config.network,
      customUrl: config.customRpcUrl,
      timeout: config.timeout,
    });

    logger.info(`Verity SDK initialized for ${config.network}`);
  }

  /**
   * Initialize the SDK and connect to XRPL
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      logger.warn('SDK already initialized');
      return;
    }

    // Connect to XRPL
    await this.xrplClient.connect();

    // Set up issuer wallet if provided
    if (this.config.issuerSeed) {
      this.issuerWallet = this.xrplClient.walletFromSeed(this.config.issuerSeed);
      logger.info(`Issuer wallet configured: ${this.issuerWallet.address}`);
    }

    // Initialize modules
    if (this.issuerWallet) {
      // XAO-DOW Clawback module
      const clawbackConfig: ClawbackConfig = {
        enabled: true,
        requiresGovernance: true,
        governanceQuorum: this.config.clawbackConfig?.governanceQuorum || 3,
        allowedReasons: this.config.clawbackConfig?.allowedReasons || [
          'REGULATORY_REQUIREMENT',
          'COURT_ORDER',
          'FRAUD_DETECTION',
          'SANCTIONS_COMPLIANCE',
        ],
      };

      this.xaoDow = new VerityXAODOW(
        this.xrplClient,
        this.issuerWallet,
        clawbackConfig
      );

      if (this.config.governanceSigners) {
        this.xaoDow.setGovernanceSigners(this.config.governanceSigners);
      }

      // Asset Manager
      this.assetManager = new VerityAssetManager(
        this.xrplClient,
        this.xaoDow,
        this.issuerWallet
      );

      // Token Manager
      this.tokenManager = new VRTYTokenManager(
        this.xrplClient,
        this.issuerWallet
      );
    }

    // Signals Protocol (doesn't require issuer)
    this.signalsProtocol = new VeritySignalsProtocol(this.xrplClient);

    // Guild Treasury (doesn't require issuer)
    this.guildTreasury = new VerityGuildTreasury(this.xrplClient);

    // Tax Engine (standalone)
    this.taxEngine = new VerityAutoTaxEngine();

    this.initialized = true;
    logger.info('Verity SDK fully initialized');
  }

  /**
   * Disconnect from XRPL
   */
  async disconnect(): Promise<void> {
    await this.xrplClient.disconnect();
    this.initialized = false;
    logger.info('Verity SDK disconnected');
  }

  /**
   * Check if SDK is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Get the XRPL client
   */
  getXRPLClient(): XRPLClient {
    return this.xrplClient;
  }

  // ===========================================
  // Wallet Utilities
  // ===========================================

  /**
   * Generate a new wallet
   */
  generateWallet(): Wallet {
    return this.xrplClient.generateWallet();
  }

  /**
   * Create wallet from seed
   */
  walletFromSeed(seed: string): Wallet {
    return this.xrplClient.walletFromSeed(seed);
  }

  /**
   * Fund a wallet (testnet/devnet only)
   */
  async fundWallet(wallet: Wallet): Promise<{ balance: number; wallet: Wallet }> {
    return this.xrplClient.fundWallet(wallet);
  }

  /**
   * Get XRP balance for an address
   */
  async getBalance(address: string): Promise<string> {
    return this.xrplClient.getXRPBalance(address);
  }

  // ===========================================
  // Assets Module
  // ===========================================

  /**
   * Access the assets module
   */
  get assets(): VerityAssetModule {
    this.ensureInitialized();
    if (!this.assetManager) {
      throw new Error('Assets module requires issuer configuration');
    }
    return new VerityAssetModule(this.assetManager);
  }

  // ===========================================
  // Signals Module
  // ===========================================

  /**
   * Access the signals module
   */
  get signals(): VeritySignalsModule {
    this.ensureInitialized();
    if (!this.signalsProtocol) {
      throw new Error('Signals module not initialized');
    }
    return new VeritySignalsModule(this.signalsProtocol);
  }

  // ===========================================
  // Guilds Module
  // ===========================================

  /**
   * Access the guilds module
   */
  get guilds(): VerityGuildsModule {
    this.ensureInitialized();
    if (!this.guildTreasury) {
      throw new Error('Guilds module not initialized');
    }
    return new VerityGuildsModule(this.guildTreasury);
  }

  // ===========================================
  // Token Module
  // ===========================================

  /**
   * Access the VRTY token module
   */
  get token(): VerityTokenModule {
    this.ensureInitialized();
    if (!this.tokenManager) {
      throw new Error('Token module requires issuer configuration');
    }
    return new VerityTokenModule(this.tokenManager);
  }

  // ===========================================
  // Tax Module
  // ===========================================

  /**
   * Access the tax module
   */
  get tax(): VerityTaxModule {
    this.ensureInitialized();
    if (!this.taxEngine) {
      throw new Error('Tax module not initialized');
    }
    return new VerityTaxModule(this.taxEngine);
  }

  // ===========================================
  // Compliance Module (XAO-DOW)
  // ===========================================

  /**
   * Access the compliance/clawback module
   */
  get compliance(): VerityComplianceModule {
    this.ensureInitialized();
    if (!this.xaoDow) {
      throw new Error('Compliance module requires issuer configuration');
    }
    return new VerityComplianceModule(this.xaoDow);
  }

  // ===========================================
  // Helper Methods
  // ===========================================

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('SDK not initialized. Call initialize() first.');
    }
  }
}

// ===========================================
// Module Wrapper Classes
// ===========================================

class VerityAssetModule {
  constructor(private manager: VerityAssetManager) {}

  async issue(config: AssetConfig) {
    return this.manager.createVerifiedAsset(config);
  }

  async tokenizeRealEstate(propertyDetails: any, tokenConfig: any) {
    return this.manager.tokenizeRealEstate(propertyDetails, tokenConfig);
  }

  async tokenizePrivateEquity(companyDetails: any, tokenConfig: any) {
    return this.manager.tokenizePrivateEquity(companyDetails, tokenConfig);
  }

  async createCommunityToken(config: any) {
    return this.manager.createCommunityToken(config);
  }

  addToWhitelist(assetId: string, wallet: string, kycVerified: boolean, accredited: boolean) {
    return this.manager.addToWhitelist(assetId, wallet, kycVerified, accredited);
  }

  async distribute(assetId: string, toWallet: string, amount: string, details?: any) {
    return this.manager.distributeTokens(assetId, toWallet, amount, details);
  }

  async distributeDividends(assetId: string, totalAmount: string, currency: string) {
    return this.manager.distributeDividends(assetId, totalAmount, currency);
  }

  async listOnDEX(assetId: string, basePrice: string, baseCurrency: string, quantity: string) {
    return this.manager.listOnDEX(assetId, basePrice, baseCurrency, quantity);
  }

  get(assetId: string) {
    return this.manager.getAsset(assetId);
  }

  getAll() {
    return this.manager.getAllAssets();
  }

  getVerificationDashboard(assetId: string) {
    return this.manager.getAssetVerificationDashboard(assetId);
  }
}

class VeritySignalsModule {
  constructor(private protocol: VeritySignalsProtocol) {}

  async mintContentNFT(wallet: Wallet, contentHash: string, contentUri: string, contentType: string) {
    return this.protocol.mintContentNFT(wallet, contentHash, contentUri, contentType);
  }

  async send(wallet: Wallet, contentNFTId: string, amount: string, signalType: SignalType, message?: string) {
    return this.protocol.sendVerifiedSignal(wallet, contentNFTId, amount, signalType, message);
  }

  async sendBatch(wallet: Wallet, signals: Array<{ contentNFTId: string; amount: string; signalType: SignalType }>) {
    return this.protocol.sendBatchSignals(wallet, signals);
  }

  getContentStats(contentNFTId: string) {
    return this.protocol.getContentSignalStats(contentNFTId);
  }

  getReputation(wallet: string) {
    return this.protocol.getReputationScore(wallet);
  }

  getLeaderboard(limit?: number) {
    return this.protocol.getReputationLeaderboard(limit);
  }

  discover(criteria: any) {
    return this.protocol.discoverContent(criteria);
  }

  async verify(signalId: string) {
    return this.protocol.verifySignal(signalId);
  }

  getAlgorithm() {
    return this.protocol.getReputationAlgorithm();
  }
}

class VerityGuildsModule {
  constructor(private treasury: VerityGuildTreasury) {}

  async create(founderWallet: Wallet, config: GuildConfig, initialSigners: string[]) {
    return this.treasury.createGuild(founderWallet, config, initialSigners);
  }

  addMember(guildId: string, member: any) {
    return this.treasury.addMember(guildId, member);
  }

  updateShares(guildId: string, shares: any[]) {
    return this.treasury.updateMemberShares(guildId, shares);
  }

  createPaymentRequest(guildId: string, requester: string, payee: string, amount: string, currency: string, description: string) {
    return this.treasury.createPaymentRequest(guildId, requester, payee, amount, currency, description);
  }

  signPayment(requestId: string, signer: string, approved: boolean) {
    return this.treasury.signPaymentRequest(requestId, signer, approved);
  }

  async executePayment(requestId: string, treasuryWallet: Wallet) {
    return this.treasury.executePayment(requestId, treasuryWallet);
  }

  async executePayroll(guildId: string, treasuryWallet: Wallet) {
    return this.treasury.executeVerifiedPayroll(guildId, treasuryWallet);
  }

  async distributeRevenue(guildId: string, treasuryWallet: Wallet, totalAmount: string, currency: string) {
    return this.treasury.distributeRevenue(guildId, treasuryWallet, totalAmount, currency);
  }

  get(guildId: string) {
    return this.treasury.getGuild(guildId);
  }

  getAll() {
    return this.treasury.getAllGuilds();
  }

  getByMember(wallet: string) {
    return this.treasury.getGuildsByMember(wallet);
  }

  getAuditTrail(guildId: string) {
    return this.treasury.getGuildAuditTrail(guildId);
  }
}

class VerityTokenModule {
  constructor(private manager: VRTYTokenManager) {}

  getInfo() {
    return this.manager.getTokenInfo();
  }

  async createTrustLine(wallet: Wallet, limit?: string) {
    return this.manager.createVRTYTrustLine(wallet, limit);
  }

  async transfer(toAddress: string, amount: string, memo?: string) {
    return this.manager.transferVRTY(toAddress, amount, memo);
  }

  async stake(wallet: Wallet, amount: string, lockPeriodDays?: number) {
    return this.manager.stakeVRTY(wallet, amount, lockPeriodDays);
  }

  async unstake(wallet: Wallet, amount: string) {
    return this.manager.unstakeVRTY(wallet, amount);
  }

  async claimRewards(wallet: Wallet) {
    return this.manager.claimRewards(wallet);
  }

  calculateFee(feeType: any, amount: string, payerWallet: string, payWithVRTY: boolean) {
    return this.manager.calculateFee(feeType, amount, payerWallet, payWithVRTY);
  }

  getStake(wallet: string) {
    return this.manager.getStake(wallet);
  }

  getTiers() {
    return this.manager.getStakingTiers();
  }
}

class VerityTaxModule {
  constructor(private engine: VerityAutoTaxEngine) {}

  setProfile(userId: string, profile: any) {
    return this.engine.setTaxProfile(userId, profile);
  }

  getProfile(userId: string) {
    return this.engine.getTaxProfile(userId);
  }

  recordTransaction(userId: string, transaction: any) {
    return this.engine.recordTransaction(userId, transaction);
  }

  calculate(userId: string, transaction: any) {
    return this.engine.calculateVerifiedTransactionTax(userId, transaction);
  }

  generateReport(userId: string, taxYear: number, format?: any) {
    return this.engine.generateTaxReport(userId, taxYear, format);
  }

  getSummary(userId: string, taxYear: number) {
    return this.engine.getTaxSummary(userId, taxYear);
  }

  getJurisdictions() {
    return this.engine.getSupportedJurisdictions();
  }

  getJurisdictionRules(code: string) {
    return this.engine.getJurisdictionRules(code);
  }

  getMethodology() {
    return this.engine.getMethodologyDocumentation();
  }

  getAuditLedger(userId: string) {
    return this.engine.getAuditLedger(userId);
  }
}

class VerityComplianceModule {
  constructor(private xaoDow: VerityXAODOW) {}

  async enableClawback() {
    return this.xaoDow.enableClawback();
  }

  async initiateClawback(asset: string, fromWallet: string, amount: string, reason: ClawbackReason, justification: string) {
    return this.xaoDow.initiateClawback(asset, fromWallet, amount, reason, justification);
  }

  addApproval(clawbackId: string, signer: string, signature: string, approved: boolean) {
    return this.xaoDow.addGovernanceApproval(clawbackId, signer, signature, approved);
  }

  async executeClawback(clawbackId: string) {
    return this.xaoDow.executeClawback(clawbackId);
  }

  getPendingClawbacks() {
    return this.xaoDow.getPendingClawbacks();
  }

  getClawback(clawbackId: string) {
    return this.xaoDow.getClawback(clawbackId);
  }
}

// Export the SDK and types
export default VeritySDK;
export * from '../types/index.js';
