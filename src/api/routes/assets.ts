/**
 * Verity Protocol - Assets Routes
 * Verified asset tokenization endpoints with real XRPL transactions
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Wallet } from 'xrpl';
import { getAssetManager, getXAODOW, getXRPLClient, areServicesInitialized, ensureServicesInitialized } from '../services.js';
import { logger } from '../../utils/logger.js';
import type { AssetConfig, PropertyDetails } from '../../types/index.js';

const router = Router();

// Validation schemas
const issueAssetSchema = z.object({
  name: z.string().min(1).max(100),
  symbol: z.string().min(1).max(20),
  totalSupply: z.string(),
  classification: z.enum(['VERIFIED', 'COMMUNITY']),
  category: z.enum([
    'REAL_ESTATE',
    'PRIVATE_EQUITY',
    'SECURITIES',
    'COMMODITIES',
    'CREATOR_TOKEN',
    'DAO_GOVERNANCE',
    'UTILITY',
  ]),
  clawbackEnabled: z.boolean(),
  jurisdiction: z.string().optional(),
  requiresKYC: z.boolean().optional(),
  accreditedOnly: z.boolean().optional(),
  description: z.string().optional(),
});

const tokenizeRealEstateSchema = z.object({
  property: z.object({
    address: z.string(),
    type: z.enum(['COMMERCIAL', 'RESIDENTIAL', 'INDUSTRIAL', 'LAND', 'MIXED_USE']),
    appraisedValue: z.string(),
    lastAppraisalDate: z.string(),
    legalEntityId: z.string().optional(),
    coordinates: z.object({
      latitude: z.number(),
      longitude: z.number(),
    }).optional(),
  }),
  token: z.object({
    name: z.string(),
    symbol: z.string(),
    totalTokens: z.string(),
    jurisdiction: z.string(),
    dividendSchedule: z.object({
      frequency: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUALLY']),
      minimumDistribution: z.string().optional(),
    }).optional(),
  }),
});

/**
 * GET /assets
 * List all assets
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { classification, category, page = '1', limit = '20' } = req.query;

    if (!areServicesInitialized()) {
      return res.json({
        success: true,
        data: {
          assets: [],
          message: 'Services not initialized. No assets available.',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date(),
        },
      });
    }

    const assetManager = getAssetManager();
    let assets = assetManager.getAllAssets();

    // Apply filters
    if (classification) {
      assets = assetManager.getAssetsByClassification(classification as any);
    }
    if (category) {
      assets = assets.filter(a => a.config.category === category);
    }

    // Pagination
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedAssets = assets.slice(startIndex, startIndex + limitNum);

    res.json({
      success: true,
      data: {
        assets: paginatedAssets.map(asset => ({
          id: asset.id,
          name: asset.config.name,
          symbol: asset.config.symbol,
          classification: asset.config.classification,
          category: asset.config.category,
          totalSupply: asset.config.totalSupply,
          status: asset.status,
          issuer: asset.issuer,
          currencyCode: asset.currencyCode,
          clawbackEnabled: asset.config.clawbackEnabled,
          createdAt: asset.createdAt,
          verificationHash: asset.verificationHash,
        })),
        filters: { classification, category },
      },
      meta: {
        requestId: req.requestId,
        timestamp: new Date(),
        pagination: {
          page: pageNum,
          pageSize: limitNum,
          totalItems: assets.length,
          totalPages: Math.ceil(assets.length / limitNum),
          hasNext: startIndex + limitNum < assets.length,
          hasPrevious: pageNum > 1,
        },
      },
    });
  } catch (error) {
    logger.error('Error listing assets:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to list assets',
      },
    });
  }
});

/**
 * POST /assets/issue
 * Issue a new verified asset with real XRPL transaction
 */
router.post('/issue', async (req: Request, res: Response) => {
  try {
    const validatedData = issueAssetSchema.parse(req.body);

    await ensureServicesInitialized();
    const assetManager = getAssetManager();

    // Build asset configuration
    const assetConfig: AssetConfig = {
      name: validatedData.name,
      symbol: validatedData.symbol,
      totalSupply: validatedData.totalSupply,
      decimals: 6,
      classification: validatedData.classification,
      category: validatedData.category,
      clawbackEnabled: validatedData.clawbackEnabled,
      verification: {
        publicAuditTrail: true,
        complianceLevel: validatedData.classification === 'VERIFIED' ? 'INSTITUTIONAL' : 'BASIC',
      },
      compliance: {
        jurisdiction: validatedData.jurisdiction || 'US',
        requiresKYC: validatedData.requiresKYC ?? (validatedData.classification === 'VERIFIED'),
        accreditedOnly: validatedData.accreditedOnly ?? false,
        transferRestrictions: validatedData.classification === 'VERIFIED' 
          ? [{ type: 'WHITELIST', params: { enabled: true } }]
          : [],
      },
      metadata: {
        description: validatedData.description ?? '',
      },
    };

    // Create the verified asset on XRPL
    const verifiedAsset = await assetManager.createVerifiedAsset(assetConfig);

    res.status(201).json({
      success: true,
      data: {
        asset: {
          id: verifiedAsset.id,
          name: verifiedAsset.config.name,
          symbol: verifiedAsset.config.symbol,
          issuer: verifiedAsset.issuer,
          currencyCode: verifiedAsset.currencyCode,
          classification: verifiedAsset.config.classification,
          category: verifiedAsset.config.category,
          totalSupply: verifiedAsset.config.totalSupply,
          clawbackEnabled: verifiedAsset.config.clawbackEnabled,
          status: verifiedAsset.status,
          verificationHash: verifiedAsset.verificationHash,
          createdAt: verifiedAsset.createdAt,
        },
        message: 'Asset successfully issued on XRPL',
      },
      meta: {
        requestId: req.requestId,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: error.errors,
        },
      });
    }
    logger.error('Error issuing asset:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ISSUANCE_FAILED',
        message: (error as Error).message || 'Failed to issue asset',
      },
    });
  }
});

/**
 * POST /assets/tokenize/real-estate
 * Tokenize a real estate property with full compliance
 */
router.post('/tokenize/real-estate', async (req: Request, res: Response) => {
  try {
    const validatedData = tokenizeRealEstateSchema.parse(req.body);

    await ensureServicesInitialized();
    const assetManager = getAssetManager();

    const propertyDetails: PropertyDetails = {
      address: validatedData.property.address,
      type: validatedData.property.type,
      appraisedValue: validatedData.property.appraisedValue,
      appraisalDate: new Date(validatedData.property.lastAppraisalDate),
    };

    const verifiedAsset = await assetManager.tokenizeRealEstate(propertyDetails, {
      name: validatedData.token.name,
      symbol: validatedData.token.symbol,
      totalTokens: validatedData.token.totalTokens,
      jurisdiction: validatedData.token.jurisdiction,
      dividendSchedule: validatedData.token.dividendSchedule ? {
        frequency: validatedData.token.dividendSchedule.frequency,
        paymentCurrency: 'VRTY',
        autoDistribute: true,
      } : undefined,
    });

    res.status(201).json({
      success: true,
      data: {
        asset: {
          id: verifiedAsset.id,
          name: verifiedAsset.config.name,
          symbol: verifiedAsset.config.symbol,
          issuer: verifiedAsset.issuer,
          currencyCode: verifiedAsset.currencyCode,
          classification: 'VERIFIED',
          category: 'REAL_ESTATE',
          totalSupply: verifiedAsset.config.totalSupply,
          clawbackEnabled: true,
          property: propertyDetails,
          status: verifiedAsset.status,
          verificationHash: verifiedAsset.verificationHash,
          createdAt: verifiedAsset.createdAt,
        },
        message: 'Real estate successfully tokenized on XRPL with XAO-DOW compliance',
      },
      meta: {
        requestId: req.requestId,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid request data',
          details: error.errors,
        },
      });
    }
    logger.error('Error tokenizing real estate:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'TOKENIZATION_FAILED',
        message: (error as Error).message || 'Failed to tokenize real estate',
      },
    });
  }
});

/**
 * GET /assets/:assetId
 * Get asset details
 */
router.get('/:assetId', async (req: Request, res: Response) => {
  try {
    const assetId = req.params['assetId'] || '';

    if (!areServicesInitialized()) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Asset not found',
        },
      });
    }

    const assetManager = getAssetManager();
    const asset = assetManager.getAsset(assetId);

    if (!asset) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Asset ${assetId} not found`,
        },
      });
    }

    const holders = assetManager.getAssetHolders(assetId);
    const dividendHistory = assetManager.getDividendHistory(assetId);

    res.json({
      success: true,
      data: {
        asset: {
          id: asset.id,
          name: asset.config.name,
          symbol: asset.config.symbol,
          issuer: asset.issuer,
          currencyCode: asset.currencyCode,
          classification: asset.config.classification,
          category: asset.config.category,
          totalSupply: asset.config.totalSupply,
          decimals: asset.config.decimals,
          clawbackEnabled: asset.config.clawbackEnabled,
          status: asset.status,
          verificationHash: asset.verificationHash,
          compliance: asset.config.compliance,
          verification: asset.config.verification,
          metadata: asset.config.metadata,
          createdAt: asset.createdAt,
          updatedAt: asset.updatedAt,
        },
        holders: holders.length,
        dividendDistributions: dividendHistory.length,
        totalDividendsPaid: dividendHistory.reduce(
          (sum, d) => sum + parseFloat(d.totalAmount),
          0
        ).toFixed(2),
      },
      meta: {
        requestId: req.requestId,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    logger.error('Error getting asset:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get asset details',
      },
    });
  }
});

/**
 * GET /assets/:assetId/verification
 * Get asset verification dashboard
 */
router.get('/:assetId/verification', async (req: Request, res: Response) => {
  try {
    const assetId = req.params['assetId'] || '';

    if (!areServicesInitialized()) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Asset not found',
        },
      });
    }

    const assetManager = getAssetManager();
    
    try {
      const dashboard = assetManager.getAssetVerificationDashboard(assetId);
      
      res.json({
        success: true,
        data: dashboard,
        meta: {
          requestId: req.requestId,
          timestamp: new Date(),
        },
      });
    } catch {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Asset ${assetId} not found`,
        },
      });
    }
  } catch (error) {
    logger.error('Error getting verification dashboard:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to get verification dashboard',
      },
    });
  }
});

/**
 * POST /assets/:assetId/whitelist
 * Add wallet to asset whitelist
 */
router.post('/:assetId/whitelist', async (req: Request, res: Response) => {
  try {
    const assetId = req.params['assetId'] || '';
    const { wallet, kycVerified, accredited } = req.body;

    if (!wallet) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Wallet address is required',
        },
      });
    }

    await ensureServicesInitialized();
    const assetManager = getAssetManager();

    try {
      assetManager.addToWhitelist(assetId, wallet, kycVerified ?? false, accredited ?? false);

      res.json({
        success: true,
        data: {
          assetId,
          wallet,
          whitelisted: true,
          kycVerified: kycVerified ?? false,
          accredited: accredited ?? false,
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'WHITELIST_FAILED',
          message: (error as Error).message,
        },
      });
    }
  } catch (error) {
    logger.error('Error adding to whitelist:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to add to whitelist',
      },
    });
  }
});

/**
 * POST /assets/:assetId/distribute
 * Distribute tokens to an investor (real XRPL transaction)
 */
router.post('/:assetId/distribute', async (req: Request, res: Response) => {
  try {
    const assetId = req.params['assetId'] || '';
    const { toWallet, amount, purchasePrice, purchaseCurrency } = req.body;

    if (!toWallet || !amount) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Wallet and amount are required',
        },
      });
    }

    await ensureServicesInitialized();
    const assetManager = getAssetManager();

    const result = await assetManager.distributeTokens(
      assetId,
      toWallet,
      amount,
      purchasePrice && purchaseCurrency
        ? { purchasePrice, purchaseCurrency }
        : undefined
    );

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'DISTRIBUTION_FAILED',
          message: result.error || 'Token distribution failed',
        },
      });
    }

    res.json({
      success: true,
      data: {
        assetId,
        toWallet,
        amount,
        transactionHash: result.hash,
        ledgerIndex: result.ledgerIndex,
      },
      meta: {
        requestId: req.requestId,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    logger.error('Error distributing tokens:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: (error as Error).message || 'Failed to distribute tokens',
      },
    });
  }
});

/**
 * POST /assets/:assetId/dividends
 * Distribute dividends (real XRPL transactions)
 */
router.post('/:assetId/dividends', async (req: Request, res: Response) => {
  try {
    const assetId = req.params['assetId'] || '';
    const { totalAmount, currency } = req.body;

    if (!totalAmount || !currency) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Total amount and currency are required',
        },
      });
    }

    await ensureServicesInitialized();
    const assetManager = getAssetManager();

    const distribution = await assetManager.distributeDividends(
      assetId,
      totalAmount,
      currency
    );

    res.json({
      success: true,
      data: {
        distribution: {
          id: distribution.id,
          assetId: distribution.assetId,
          totalAmount: distribution.totalAmount,
          currency: distribution.currency,
          perTokenAmount: distribution.perTokenAmount,
          eligibleHolders: distribution.eligibleHolders,
          status: distribution.status,
          transactionHashes: distribution.transactionHashes,
          distributedAt: distribution.distributedAt,
        },
      },
      meta: {
        requestId: req.requestId,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    logger.error('Error distributing dividends:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DIVIDEND_FAILED',
        message: (error as Error).message || 'Failed to distribute dividends',
      },
    });
  }
});

/**
 * POST /assets/:assetId/dex/list
 * List asset on XRPL DEX (real transaction)
 */
router.post('/:assetId/dex/list', async (req: Request, res: Response) => {
  try {
    const assetId = req.params['assetId'] || '';
    const { basePrice, baseCurrency, quantity } = req.body;

    if (!basePrice || !baseCurrency || !quantity) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Base price, base currency, and quantity are required',
        },
      });
    }

    await ensureServicesInitialized();
    const assetManager = getAssetManager();

    const result = await assetManager.listOnDEX(assetId, basePrice, baseCurrency, quantity);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'DEX_LISTING_FAILED',
          message: result.error || 'Failed to list on DEX',
        },
      });
    }

    res.json({
      success: true,
      data: {
        assetId,
        listed: true,
        basePrice,
        baseCurrency,
        quantity,
        transactionHash: result.hash,
        ledgerIndex: result.ledgerIndex,
      },
      meta: {
        requestId: req.requestId,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    logger.error('Error listing on DEX:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: (error as Error).message || 'Failed to list on DEX',
      },
    });
  }
});

export { router as assetsRoutes };
