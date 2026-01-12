/**
 * Verity Protocol - Asset Manager
 * Comprehensive RWA tokenization engine with verification
 * 
 * Fee Structure:
 * - Asset Tokenization Fee: 0.25% (25 basis points)
 * - Maximum Fee Cap: $25,000 USD
 * - Minimum Fee: $100 USD (or equivalent in XRP)
 */

import { Wallet, Payment, OfferCreate, CheckCreate } from 'xrpl';
import { EventEmitter } from 'eventemitter3';
import { XRPLClient, TransactionResult } from '../core/XRPLClient.js';
import { VerityXAODOW, VerifiedAssetIssuance } from '../core/XAO_DOW.js';
import { logger, logAuditAction } from '../utils/logger.js';
import { generateId, generateVerificationHash, encodeMemoData } from '../utils/crypto.js';
import type {
  AssetConfig,
  VerifiedAsset,
  AssetStatus,
  AssetClassification,
  AssetCategory,
  DividendSchedule,
  TransferRestriction,
  PropertyDetails,
} from '../types/index.js';

// Fee Constants
const ASSET_TOKENIZATION_FEE_BPS = 25; // 0.25% in basis points
const MAXIMUM_FEE_USD = 25000; // $25,000 USD cap
const MINIMUM_FEE_USD = 100; // $100 USD minimum

export interface AssetHolder {
  wallet: string;
  balance: string;
  isWhitelisted: boolean;
  kycVerified: boolean;
  accredited: boolean;
  acquiredAt: Date;
}

export interface DividendDistribution {
  id: string;
  assetId: string;
  totalAmount: string;
  currency: string;
  perTokenAmount: string;
  eligibleHolders: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  distributedAt?: Date;
  transactionHashes: string[];
}

export interface DEXListing {
  assetId: string;
  currencyCode: string;
  issuer: string;
  basePrice: string;
  baseCurrency: string;
  listed: boolean;
  listedAt?: Date;
}

/**
 * Asset tokenization fee calculation result
 */
export interface TokenizationFee {
  feeAmount: string;
  feeCurrency: string;
  feePercentage: number;
  isCapped: boolean;
  originalFee: string;
  cappedAt?: string;
}

/**
 * Verity Asset Manager
 * Handles tokenization, distribution, dividends, and DEX operations
 */
export class VerityAssetManager extends EventEmitter {
  private xrplClient: XRPLClient;
  private xaoDow: VerityXAODOW;
  private issuerWallet: Wallet;
  
  // In-memory storage (would be database in production)
  private assets: Map<string, VerifiedAsset> = new Map();
  private assetHolders: Map<string, Map<string, AssetHolder>> = new Map();
  private whitelists: Map<string, Set<string>> = new Map();
  private dividendHistory: Map<string, DividendDistribution[]> = new Map();

  constructor(
    xrplClient: XRPLClient,
    xaoDow: VerityXAODOW,
    issuerWallet: Wallet
  ) {
    super();
    this.xrplClient = xrplClient;
    this.xaoDow = xaoDow;
    this.issuerWallet = issuerWallet;

    logger.info('Verity Asset Manager initialized');
  }

  /**
   * Calculate tokenization fee with $25K USD cap
   * Fee: 0.25% of asset value, capped at $25,000 USD
   * 
   * @param assetValueUSD - Total asset value in USD
   * @returns TokenizationFee object with calculated fee details
   */
  calculateTokenizationFee(assetValueUSD: number): TokenizationFee {
    // Calculate base fee (0.25%)
    const baseFee = (assetValueUSD * ASSET_TOKENIZATION_FEE_BPS) / 10000;
    
    // Apply fee cap
    let finalFee = baseFee;
    let isCapped = false;
    let cappedAt: string | undefined;

    // Apply $25K maximum cap
    if (baseFee > MAXIMUM_FEE_USD) {
      finalFee = MAXIMUM_FEE_USD;
      isCapped = true;
      cappedAt = `$${MAXIMUM_FEE_USD.toLocaleString()} USD`;
      logger.info(`Tokenization fee capped at $${MAXIMUM_FEE_USD}`, {
        originalFee: baseFee,
        assetValue: assetValueUSD,
      });
    }

    // Apply minimum fee
    if (finalFee < MINIMUM_FEE_USD) {
      finalFee = MINIMUM_FEE_USD;
    }

    return {
      feeAmount: finalFee.toFixed(2),
      feeCurrency: 'USD',
      feePercentage: ASSET_TOKENIZATION_FEE_BPS / 100,
      isCapped,
      originalFee: baseFee.toFixed(2),
      cappedAt,
    };
  }

  /**
   * Get fee structure documentation
   */
  getFeeStructure(): Record<string, unknown> {
    return {
      assetTokenization: {
        percentage: `${ASSET_TOKENIZATION_FEE_BPS / 100}%`,
        basisPoints: ASSET_TOKENIZATION_FEE_BPS,
        minimumFee: `$${MINIMUM_FEE_USD} USD`,
        maximumFee: `$${MAXIMUM_FEE_USD.toLocaleString()} USD`,
        description: 'Fee for tokenizing real-world assets on XRPL',
        examples: [
          {
            assetValue: '$100,000',
            fee: '$250',
            calculation: '0.25% × $100,000',
          },
          {
            assetValue: '$1,000,000',
            fee: '$2,500',
            calculation: '0.25% × $1,000,000',
          },
          {
            assetValue: '$50,000,000',
            fee: '$25,000 (capped)',
            calculation: '0.25% = $125,000, capped at $25,000',
          },
        ],
      },
      feeDistribution: {
        stakerPool: '80%',
        buybackBurn: '20%',
      },
      discounts: {
        payWithVRTY: '10% additional discount',
        stakingTiers: [
          { tier: 'BASIC', minStake: '1,000 VRTY', discount: '25%' },
          { tier: 'PROFESSIONAL', minStake: '10,000 VRTY', discount: '50%' },
          { tier: 'INSTITUTIONAL', minStake: '50,000 VRTY', discount: '75%' },
          { tier: 'DEVELOPER', minStake: '5,000 VRTY', discount: '50%' },
        ],
      },
    };
  }

  /**
   * Tokenize a real estate property
   */
  async tokenizeRealEstate(
    propertyDetails: PropertyDetails,
    tokenConfig: {
      name: string;
      symbol: string;
      totalTokens: string;
      jurisdiction: string;
      dividendSchedule?: DividendSchedule;
    }
  ): Promise<VerifiedAsset> {
    logger.info(`Tokenizing real estate: ${propertyDetails.address}`);

    const assetConfig: AssetConfig = {
      name: tokenConfig.name,
      symbol: tokenConfig.symbol,
      totalSupply: tokenConfig.totalTokens,
      decimals: 6,
      classification: 'VERIFIED',
      category: 'REAL_ESTATE',
      clawbackEnabled: true,
      transferRate: 0, // No transfer fee by default
      verification: {
        publicAuditTrail: true,
        complianceLevel: 'INSTITUTIONAL',
      },
      compliance: {
        jurisdiction: tokenConfig.jurisdiction,
        requiresKYC: true,
        accreditedOnly: true,
        transferRestrictions: [
          { type: 'WHITELIST', params: { enabled: true } },
        ],
        dividendSchedule: tokenConfig.dividendSchedule,
      },
      metadata: {
        description: `Tokenized ownership of property at ${propertyDetails.address}`,
        propertyDetails,
      },
    };

    return this.createVerifiedAsset(assetConfig);
  }

  /**
   * Tokenize private equity
   */
  async tokenizePrivateEquity(
    companyDetails: {
      name: string;
      description: string;
      valuation: string;
      legalEntityId: string;
    },
    tokenConfig: {
      symbol: string;
      totalShares: string;
      jurisdiction: string;
    }
  ): Promise<VerifiedAsset> {
    logger.info(`Tokenizing private equity: ${companyDetails.name}`);

    const assetConfig: AssetConfig = {
      name: `${companyDetails.name} Equity Token`,
      symbol: tokenConfig.symbol,
      totalSupply: tokenConfig.totalShares,
      decimals: 0, // Whole shares only
      classification: 'VERIFIED',
      category: 'PRIVATE_EQUITY',
      clawbackEnabled: true,
      verification: {
        publicAuditTrail: true,
        complianceLevel: 'INSTITUTIONAL',
      },
      compliance: {
        jurisdiction: tokenConfig.jurisdiction,
        requiresKYC: true,
        accreditedOnly: true,
        transferRestrictions: [
          { type: 'WHITELIST', params: { enabled: true } },
          { type: 'HOLDING_PERIOD', params: { days: 365 } }, // 1 year lockup
        ],
      },
      metadata: {
        description: companyDetails.description,
        legalEntityId: companyDetails.legalEntityId,
      },
    };

    return this.createVerifiedAsset(assetConfig);
  }

  /**
   * Create a community/creator token (no clawback)
   */
  async createCommunityToken(
    tokenConfig: {
      name: string;
      symbol: string;
      totalSupply: string;
      description: string;
      imageUrl?: string;
    }
  ): Promise<VerifiedAsset> {
    logger.info(`Creating community token: ${tokenConfig.symbol}`);

    const assetConfig: AssetConfig = {
      name: tokenConfig.name,
      symbol: tokenConfig.symbol,
      totalSupply: tokenConfig.totalSupply,
      decimals: 6,
      classification: 'COMMUNITY',
      category: 'CREATOR_TOKEN',
      clawbackEnabled: false,
      verification: {
        publicAuditTrail: true,
        complianceLevel: 'BASIC',
      },
      compliance: {
        jurisdiction: 'GLOBAL',
        requiresKYC: false,
        accreditedOnly: false,
        transferRestrictions: [],
      },
      metadata: {
        description: tokenConfig.description,
        imageUrl: tokenConfig.imageUrl,
      },
    };

    return this.createVerifiedAsset(assetConfig);
  }

  /**
   * Create a verified asset on XRPL
   */
  async createVerifiedAsset(config: AssetConfig): Promise<VerifiedAsset> {
    // Issue the asset through XAO-DOW
    const issuance = await this.xaoDow.issueVerifiedAsset(config);

    // Create the asset record
    const assetId = generateId('AST');
    const verifiedAsset: VerifiedAsset = {
      id: assetId,
      issuer: this.issuerWallet.address,
      currencyCode: issuance.currencyCode,
      config,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
      verificationHash: issuance.verificationHash,
    };

    // Store the asset
    this.assets.set(assetId, verifiedAsset);
    this.assetHolders.set(assetId, new Map());
    this.whitelists.set(assetId, new Set());
    this.dividendHistory.set(assetId, []);

    // Emit event
    this.emit('assetCreated', verifiedAsset);

    logAuditAction('ASSET_CREATED', this.issuerWallet.address, {
      assetId,
      symbol: config.symbol,
      classification: config.classification,
      transactionHash: issuance.transactionHash,
    });

    logger.info(`Verified asset created: ${config.symbol}`, {
      assetId,
      currencyCode: issuance.currencyCode,
    });

    return verifiedAsset;
  }

  /**
   * Add wallet to asset whitelist
   */
  addToWhitelist(assetId: string, wallet: string, kycVerified: boolean, accredited: boolean): void {
    const asset = this.assets.get(assetId);
    if (!asset) {
      throw new Error(`Asset ${assetId} not found`);
    }

    if (asset.config.compliance.requiresKYC && !kycVerified) {
      throw new Error('KYC verification required for this asset');
    }

    if (asset.config.compliance.accreditedOnly && !accredited) {
      throw new Error('Accredited investor status required for this asset');
    }

    const whitelist = this.whitelists.get(assetId);
    if (whitelist) {
      whitelist.add(wallet);
    }

    logAuditAction('WHITELIST_ADD', this.issuerWallet.address, {
      assetId,
      wallet,
      kycVerified,
      accredited,
    });

    logger.info(`Added ${wallet} to whitelist for asset ${assetId}`);
  }

  /**
   * Remove wallet from whitelist
   */
  removeFromWhitelist(assetId: string, wallet: string): void {
    const whitelist = this.whitelists.get(assetId);
    if (whitelist) {
      whitelist.delete(wallet);
    }

    logAuditAction('WHITELIST_REMOVE', this.issuerWallet.address, {
      assetId,
      wallet,
    });
  }

  /**
   * Check if wallet is whitelisted
   */
  isWhitelisted(assetId: string, wallet: string): boolean {
    const asset = this.assets.get(assetId);
    if (!asset) return false;

    // Community assets don't require whitelist
    if (asset.config.classification === 'COMMUNITY') {
      return true;
    }

    const whitelist = this.whitelists.get(assetId);
    return whitelist?.has(wallet) ?? false;
  }

  /**
   * Distribute tokens to an investor
   */
  async distributeTokens(
    assetId: string,
    toWallet: string,
    amount: string,
    investmentDetails?: {
      purchasePrice: string;
      purchaseCurrency: string;
    }
  ): Promise<TransactionResult> {
    const asset = this.assets.get(assetId);
    if (!asset) {
      throw new Error(`Asset ${assetId} not found`);
    }

    // Verify whitelist for verified assets
    if (asset.config.classification === 'VERIFIED' && !this.isWhitelisted(assetId, toWallet)) {
      throw new Error('Wallet is not whitelisted for this asset');
    }

    // First, ensure trust line exists (this would be handled by the recipient)
    // Then transfer the tokens
    const result = await this.xaoDow.transferTokens(
      toWallet,
      asset.config.symbol,
      amount,
      investmentDetails 
        ? `Investment: ${investmentDetails.purchasePrice} ${investmentDetails.purchaseCurrency}`
        : undefined
    );

    if (result.success) {
      // Update holder record
      const holders = this.assetHolders.get(assetId);
      if (holders) {
        const existingHolder = holders.get(toWallet);
        const newBalance = existingHolder 
          ? (parseFloat(existingHolder.balance) + parseFloat(amount)).toString()
          : amount;

        holders.set(toWallet, {
          wallet: toWallet,
          balance: newBalance,
          isWhitelisted: this.isWhitelisted(assetId, toWallet),
          kycVerified: true, // Assumed if whitelisted
          accredited: asset.config.compliance.accreditedOnly,
          acquiredAt: existingHolder?.acquiredAt ?? new Date(),
        });
      }

      this.emit('tokensDistributed', {
        assetId,
        toWallet,
        amount,
        transactionHash: result.hash,
      });
    }

    return result;
  }

  /**
   * Distribute dividends to all token holders
   */
  async distributeDividends(
    assetId: string,
    totalAmount: string,
    currency: string
  ): Promise<DividendDistribution> {
    const asset = this.assets.get(assetId);
    if (!asset) {
      throw new Error(`Asset ${assetId} not found`);
    }

    const holders = this.assetHolders.get(assetId);
    if (!holders || holders.size === 0) {
      throw new Error('No token holders found');
    }

    logger.info(`Distributing ${totalAmount} ${currency} dividends for ${asset.config.symbol}`);

    // Calculate total outstanding tokens
    let totalTokens = 0;
    for (const holder of holders.values()) {
      totalTokens += parseFloat(holder.balance);
    }

    // Calculate per-token dividend
    const perTokenAmount = (parseFloat(totalAmount) / totalTokens).toFixed(6);

    // Create distribution record
    const distributionId = generateId('DIV');
    const distribution: DividendDistribution = {
      id: distributionId,
      assetId,
      totalAmount,
      currency,
      perTokenAmount,
      eligibleHolders: holders.size,
      status: 'processing',
      transactionHashes: [],
    };

    // Distribute to each holder using XRPL Checks
    for (const [walletAddress, holder] of holders) {
      const dividendAmount = (parseFloat(holder.balance) * parseFloat(perTokenAmount)).toFixed(6);
      
      if (parseFloat(dividendAmount) <= 0) continue;

      // Create a Check for the dividend payment
      const checkTx: CheckCreate = {
        TransactionType: 'CheckCreate',
        Account: this.issuerWallet.address,
        Destination: walletAddress,
        SendMax: currency === 'XRP' 
          ? XRPLClient.xrpToDrops(dividendAmount)
          : {
              currency: currency,
              issuer: this.issuerWallet.address,
              value: dividendAmount,
            },
        Memos: [
          {
            Memo: {
              MemoType: Buffer.from('VERITY_DIVIDEND').toString('hex').toUpperCase(),
              MemoData: encodeMemoData({
                distributionId,
                assetId,
                assetSymbol: asset.config.symbol,
                period: new Date().toISOString().substring(0, 7),
              }),
              MemoFormat: Buffer.from('application/json').toString('hex').toUpperCase(),
            },
          },
        ],
      };

      const result = await this.xrplClient.submitAndWait(checkTx, this.issuerWallet);
      
      if (result.success) {
        distribution.transactionHashes.push(result.hash);
      } else {
        logger.error(`Failed to create dividend check for ${walletAddress}: ${result.error}`);
      }
    }

    distribution.status = 'completed';
    distribution.distributedAt = new Date();

    // Store distribution history
    const history = this.dividendHistory.get(assetId) || [];
    history.push(distribution);
    this.dividendHistory.set(assetId, history);

    logAuditAction('DIVIDEND_DISTRIBUTED', this.issuerWallet.address, {
      distributionId,
      assetId,
      totalAmount,
      currency,
      eligibleHolders: distribution.eligibleHolders,
    });

    this.emit('dividendsDistributed', distribution);

    return distribution;
  }

  /**
   * List asset on XRPL DEX
   */
  async listOnDEX(
    assetId: string,
    basePrice: string,
    baseCurrency: string,
    quantity: string
  ): Promise<TransactionResult> {
    const asset = this.assets.get(assetId);
    if (!asset) {
      throw new Error(`Asset ${assetId} not found`);
    }

    logger.info(`Listing ${asset.config.symbol} on DEX at ${basePrice} ${baseCurrency}`);

    // Create an offer on the DEX
    const offerTx: OfferCreate = {
      TransactionType: 'OfferCreate',
      Account: this.issuerWallet.address,
      TakerGets: {
        currency: asset.currencyCode,
        issuer: this.issuerWallet.address,
        value: quantity,
      },
      TakerPays: baseCurrency === 'XRP'
        ? XRPLClient.xrpToDrops(
            (parseFloat(basePrice) * parseFloat(quantity)).toString()
          )
        : {
            currency: baseCurrency,
            issuer: this.issuerWallet.address,
            value: (parseFloat(basePrice) * parseFloat(quantity)).toString(),
          },
      Memos: [
        {
          Memo: {
            MemoType: Buffer.from('VERITY_DEX_LISTING').toString('hex').toUpperCase(),
            MemoData: encodeMemoData({
              assetId,
              symbol: asset.config.symbol,
              basePrice,
              baseCurrency,
            }),
            MemoFormat: Buffer.from('application/json').toString('hex').toUpperCase(),
          },
        },
      ],
    };

    const result = await this.xrplClient.submitAndWait(offerTx, this.issuerWallet);

    if (result.success) {
      logAuditAction('DEX_LISTING', this.issuerWallet.address, {
        assetId,
        symbol: asset.config.symbol,
        basePrice,
        baseCurrency,
        quantity,
        transactionHash: result.hash,
      });

      this.emit('assetListed', {
        assetId,
        currencyCode: asset.currencyCode,
        basePrice,
        baseCurrency,
        transactionHash: result.hash,
      });
    }

    return result;
  }

  /**
   * Get asset by ID
   */
  getAsset(assetId: string): VerifiedAsset | undefined {
    return this.assets.get(assetId);
  }

  /**
   * Get all assets
   */
  getAllAssets(): VerifiedAsset[] {
    return Array.from(this.assets.values());
  }

  /**
   * Get assets by classification
   */
  getAssetsByClassification(classification: AssetClassification): VerifiedAsset[] {
    return Array.from(this.assets.values()).filter(
      (a) => a.config.classification === classification
    );
  }

  /**
   * Get assets by category
   */
  getAssetsByCategory(category: AssetCategory): VerifiedAsset[] {
    return Array.from(this.assets.values()).filter(
      (a) => a.config.category === category
    );
  }

  /**
   * Get asset holders
   */
  getAssetHolders(assetId: string): AssetHolder[] {
    const holders = this.assetHolders.get(assetId);
    return holders ? Array.from(holders.values()) : [];
  }

  /**
   * Get dividend history for an asset
   */
  getDividendHistory(assetId: string): DividendDistribution[] {
    return this.dividendHistory.get(assetId) || [];
  }

  /**
   * Update asset status
   */
  updateAssetStatus(assetId: string, status: AssetStatus): void {
    const asset = this.assets.get(assetId);
    if (!asset) {
      throw new Error(`Asset ${assetId} not found`);
    }

    asset.status = status;
    asset.updatedAt = new Date();

    logAuditAction('ASSET_STATUS_UPDATED', this.issuerWallet.address, {
      assetId,
      newStatus: status,
    });

    this.emit('assetStatusUpdated', { assetId, status });
  }

  /**
   * Get verification dashboard data for an asset
   */
  getAssetVerificationDashboard(assetId: string): Record<string, unknown> {
    const asset = this.assets.get(assetId);
    if (!asset) {
      throw new Error(`Asset ${assetId} not found`);
    }

    const holders = this.getAssetHolders(assetId);
    const dividends = this.getDividendHistory(assetId);

    return {
      asset: {
        id: asset.id,
        name: asset.config.name,
        symbol: asset.config.symbol,
        classification: asset.config.classification,
        category: asset.config.category,
        status: asset.status,
        verificationHash: asset.verificationHash,
        createdAt: asset.createdAt,
      },
      compliance: {
        jurisdiction: asset.config.compliance.jurisdiction,
        requiresKYC: asset.config.compliance.requiresKYC,
        accreditedOnly: asset.config.compliance.accreditedOnly,
        clawbackEnabled: asset.config.clawbackEnabled,
        complianceLevel: asset.config.verification.complianceLevel,
      },
      metrics: {
        totalHolders: holders.length,
        totalSupply: asset.config.totalSupply,
        whitelistedWallets: this.whitelists.get(assetId)?.size || 0,
        totalDividendsPaid: dividends.reduce(
          (sum, d) => sum + parseFloat(d.totalAmount),
          0
        ),
        dividendDistributions: dividends.length,
      },
      auditTrail: {
        publicAuditTrail: asset.config.verification.publicAuditTrail,
        lastUpdated: asset.updatedAt,
      },
    };
  }
}

export default VerityAssetManager;
