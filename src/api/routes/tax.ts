/**
 * Verity Protocol - Tax Routes
 * Auto-Tax Compliance Engine endpoints with 200+ jurisdiction support
 * 
 * Updated to support PostgreSQL-backed AutoTaxEngine (async methods)
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getTaxEngine } from '../services.js';
import { logger } from '../../utils/logger.js';

const router = Router();

// Validation schemas
const taxProfileSchema = z.object({
  taxResidence: z.string().length(2),
  taxId: z.string().optional(),
  costBasisMethod: z.enum(['FIFO', 'LIFO', 'HIFO', 'SPECIFIC_ID', 'AVERAGE']),
  treatyBenefits: z.array(z.string()).optional(),
  filingStatus: z.string().optional(),
});

const transactionSchema = z.object({
  type: z.enum(['BUY', 'SELL', 'TRANSFER', 'DIVIDEND', 'STAKING_REWARD', 'AIRDROP']),
  asset: z.string(),
  amount: z.string(),
  pricePerUnit: z.string(),
  totalValue: z.string(),
  fee: z.string().optional(),
  timestamp: z.string(),
  transactionHash: z.string(),
});

/**
 * POST /tax/calculate
 * Calculate tax for a transaction
 */
router.post('/calculate', async (req: Request, res: Response) => {
  try {
    const { transaction, userId } = req.body;

    if (!transaction || !userId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Transaction and userId are required',
        },
      });
    }

    const validatedTx = transactionSchema.parse(transaction);
    const taxEngine = getTaxEngine();

    // Check if user has a profile
    const profile = await taxEngine.getTaxProfile(userId);
    if (!profile) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'PROFILE_NOT_FOUND',
          message: 'Tax profile not found. Create a profile first.',
        },
      });
    }

    // Record the transaction
    const recordedTx = await taxEngine.recordTransaction(userId, {
      type: validatedTx.type,
      asset: validatedTx.asset,
      amount: validatedTx.amount,
      pricePerUnit: validatedTx.pricePerUnit,
      totalValue: validatedTx.totalValue,
      fee: validatedTx.fee,
      timestamp: new Date(validatedTx.timestamp),
      transactionHash: validatedTx.transactionHash,
    });

    // Calculate tax
    const taxCalculation = await taxEngine.calculateVerifiedTransactionTax(userId, recordedTx);

    res.json({
      success: true,
      data: {
        calculation: {
          transactionId: taxCalculation.transactionId,
          transactionType: taxCalculation.transactionType,
          proceeds: taxCalculation.proceeds,
          costBasis: taxCalculation.costBasis,
          gainLoss: taxCalculation.gainLoss,
          taxableAmount: taxCalculation.taxableAmount,
          taxRate: taxCalculation.taxRate,
          taxOwed: taxCalculation.taxOwed,
          jurisdiction: taxCalculation.jurisdiction,
          methodology: taxCalculation.methodology,
          calculatedAt: taxCalculation.calculatedAt,
        },
        transaction: recordedTx,
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
    logger.error('Tax calculation error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CALCULATION_FAILED',
        message: (error as Error).message || 'Tax calculation failed',
      },
    });
  }
});

/**
 * POST /tax/profile
 * Create or update tax profile
 */
router.post('/profile', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'userId is required',
        },
      });
    }

    const validatedData = taxProfileSchema.parse(req.body);
    const taxEngine = getTaxEngine();

    // Verify jurisdiction is supported
    const jurisdictionRules = taxEngine.getJurisdictionRules(validatedData.taxResidence);
    if (!jurisdictionRules) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_JURISDICTION',
          message: `Jurisdiction ${validatedData.taxResidence} is not supported`,
        },
      });
    }

    const profile = await taxEngine.setTaxProfile(userId, {
      taxResidence: validatedData.taxResidence,
      taxId: validatedData.taxId,
      costBasisMethod: validatedData.costBasisMethod,
      treatyBenefits: validatedData.treatyBenefits || [],
    });

    res.status(201).json({
      success: true,
      data: {
        profile: {
          userId: profile.userId,
          taxResidence: profile.taxResidence,
          taxId: profile.taxId,
          costBasisMethod: profile.costBasisMethod,
          treatyBenefits: profile.treatyBenefits,
          jurisdiction: {
            code: jurisdictionRules.code,
            name: jurisdictionRules.name,
            shortTermRate: jurisdictionRules.shortTermRate,
            longTermRate: jurisdictionRules.longTermRate,
          },
        },
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
    logger.error('Profile creation error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PROFILE_FAILED',
        message: (error as Error).message || 'Failed to create profile',
      },
    });
  }
});

/**
 * GET /tax/profile/:userId
 * Get user's tax profile
 */
router.get('/profile/:userId', async (req: Request, res: Response) => {
  try {
    const userId = req.params['userId'] || '';
    const taxEngine = getTaxEngine();

    const profile = await taxEngine.getTaxProfile(userId);

    if (!profile) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Tax profile for user ${userId} not found`,
        },
      });
    }

    res.json({
      success: true,
      data: { profile },
      meta: {
        requestId: req.requestId,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    logger.error('Profile fetch error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch profile',
      },
    });
  }
});

/**
 * GET /tax/transactions/:userId
 * Get user's transactions
 */
router.get('/transactions/:userId', async (req: Request, res: Response) => {
  try {
    const userId = req.params['userId'] || '';
    const { taxYear, asset, page = '1', limit = '50' } = req.query;

    const taxEngine = getTaxEngine();
    let transactions = await taxEngine.getUserTransactions(userId);

    // Filter by tax year if provided
    if (taxYear) {
      const year = parseInt(taxYear as string, 10);
      transactions = transactions.filter(
        (tx) => tx.timestamp.getFullYear() === year
      );
    }

    // Filter by asset if provided
    if (asset) {
      transactions = transactions.filter((tx) => tx.asset === asset);
    }

    // Pagination
    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedTxs = transactions.slice(startIndex, startIndex + limitNum);

    res.json({
      success: true,
      data: {
        transactions: paginatedTxs,
        filters: { taxYear, asset },
      },
      meta: {
        requestId: req.requestId,
        timestamp: new Date(),
        pagination: {
          page: pageNum,
          pageSize: limitNum,
          totalItems: transactions.length,
          totalPages: Math.ceil(transactions.length / limitNum),
          hasNext: startIndex + limitNum < transactions.length,
          hasPrevious: pageNum > 1,
        },
      },
    });
  } catch (error) {
    logger.error('Transactions fetch error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch transactions',
      },
    });
  }
});

/**
 * GET /tax/summary/:userId/:taxYear
 * Get tax summary for a year
 */
router.get('/summary/:userId/:taxYear', async (req: Request, res: Response) => {
  try {
    const userId = req.params['userId'] || '';
    const taxYear = req.params['taxYear'] || '';
    const taxEngine = getTaxEngine();

    const profile = await taxEngine.getTaxProfile(userId);
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'PROFILE_NOT_FOUND',
          message: `Tax profile for user ${userId} not found`,
        },
      });
    }

    const summary = await taxEngine.getTaxSummary(userId, parseInt(taxYear, 10));

    res.json({
      success: true,
      data: { summary },
      meta: {
        requestId: req.requestId,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    logger.error('Summary fetch error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: (error as Error).message || 'Failed to fetch summary',
      },
    });
  }
});

/**
 * POST /tax/report/generate
 * Generate tax report
 */
router.post('/report/generate', async (req: Request, res: Response) => {
  try {
    const { userId, taxYear, format = 'GENERIC' } = req.body;

    if (!userId || !taxYear) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'userId and taxYear are required',
        },
      });
    }

    const taxEngine = getTaxEngine();
    const report = await taxEngine.generateTaxReport(
      userId,
      taxYear,
      format as 'IRS_8949' | 'HMRC' | 'GENERIC'
    );

    res.json({
      success: true,
      data: { report },
      meta: {
        requestId: req.requestId,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    logger.error('Report generation error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'REPORT_FAILED',
        message: (error as Error).message || 'Failed to generate report',
      },
    });
  }
});

/**
 * GET /tax/jurisdictions
 * Get all supported jurisdictions (200+)
 */
router.get('/jurisdictions', async (req: Request, res: Response) => {
  try {
    const { region, taxFriendly } = req.query;
    const taxEngine = getTaxEngine();

    let jurisdictions;

    if (taxFriendly === 'true') {
      jurisdictions = taxEngine.getTaxFriendlyJurisdictions().map((j) => ({
        code: j.code,
        name: j.name,
        region: j.region,
        shortTermRate: j.shortTermRate,
        longTermRate: j.longTermRate,
      }));
    } else if (region) {
      jurisdictions = taxEngine.getJurisdictionsByRegion(region as string).map((j) => ({
        code: j.code,
        name: j.name,
        region: j.region,
        shortTermRate: j.shortTermRate,
        longTermRate: j.longTermRate,
      }));
    } else {
      jurisdictions = taxEngine.getSupportedJurisdictions();
    }

    res.json({
      success: true,
      data: {
        jurisdictions,
        totalCount: taxEngine.getJurisdictionCount(),
        regions: [
          'North America',
          'Europe',
          'Asia-Pacific',
          'Middle East',
          'Africa',
          'Latin America',
          'Caribbean',
          'Central Asia',
          'Caucasus',
          'Oceania',
        ],
      },
      meta: {
        requestId: req.requestId,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    logger.error('Jurisdictions fetch error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch jurisdictions',
      },
    });
  }
});

/**
 * GET /tax/jurisdictions/:code
 * Get detailed jurisdiction rules (transparent methodology)
 */
router.get('/jurisdictions/:code', async (req: Request, res: Response) => {
  try {
    const code = req.params['code'] || '';
    const taxEngine = getTaxEngine();

    const rules = taxEngine.getJurisdictionRules(code.toUpperCase());

    if (!rules) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Jurisdiction ${code} not found`,
          suggestion: 'Use GET /tax/jurisdictions to see all supported jurisdictions',
        },
      });
    }

    res.json({
      success: true,
      data: {
        rules: {
          code: rules.code,
          name: rules.name,
          region: rules.region,
          shortTermRate: rules.shortTermRate,
          longTermRate: rules.longTermRate,
          longTermThresholdDays: rules.longTermThresholdDays,
          dividendRate: rules.dividendRate,
          cryptoSpecificRules: rules.cryptoSpecificRules,
          treatyPartners: rules.treatyPartners,
          currency: rules.currency,
          notes: rules.notes,
        },
        transparency: {
          methodology: 'Rates are simplified representations. Actual rates vary by income bracket, filing status, and exemptions.',
          disclaimer: 'Consult a qualified tax professional for specific advice.',
          lastUpdated: '2024-01-01',
        },
      },
      meta: {
        requestId: req.requestId,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    logger.error('Jurisdiction rules fetch error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch jurisdiction rules',
      },
    });
  }
});

/**
 * GET /tax/jurisdictions/treaty/:code
 * Get jurisdictions with tax treaty to specified country
 */
router.get('/jurisdictions/treaty/:code', async (req: Request, res: Response) => {
  try {
    const code = req.params['code'] || '';
    const taxEngine = getTaxEngine();

    const treatyJurisdictions = taxEngine.getJurisdictionsWithTreaty(code.toUpperCase());

    res.json({
      success: true,
      data: {
        baseCountry: code.toUpperCase(),
        treatyPartners: treatyJurisdictions.map((j) => ({
          code: j.code,
          name: j.name,
          region: j.region,
        })),
        totalPartners: treatyJurisdictions.length,
      },
      meta: {
        requestId: req.requestId,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    logger.error('Treaty fetch error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch treaty partners',
      },
    });
  }
});

/**
 * GET /tax/holding-period-exemptions
 * Get jurisdictions with holding period exemptions (0% after N days)
 */
router.get('/holding-period-exemptions', async (req: Request, res: Response) => {
  try {
    const taxEngine = getTaxEngine();
    const exemptJurisdictions = taxEngine.getHoldingPeriodExemptionJurisdictions();

    res.json({
      success: true,
      data: {
        jurisdictions: exemptJurisdictions.map((j) => ({
          code: j.code,
          name: j.name,
          region: j.region,
          exemptionDays: j.cryptoSpecificRules?.exemptionDays || j.longTermThresholdDays,
          notes: j.notes,
        })),
        count: exemptJurisdictions.length,
      },
      meta: {
        requestId: req.requestId,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    logger.error('Exemptions fetch error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch exemption jurisdictions',
      },
    });
  }
});

/**
 * GET /tax/methodology
 * Get calculation methodology documentation
 */
router.get('/methodology', async (req: Request, res: Response) => {
  try {
    const taxEngine = getTaxEngine();
    const methodology = taxEngine.getMethodologyDocumentation();

    res.json({
      success: true,
      data: {
        ...methodology,
        supportedJurisdictions: taxEngine.getJurisdictionCount(),
        features: {
          costBasisMethods: ['FIFO', 'LIFO', 'HIFO', 'SPECIFIC_ID', 'AVERAGE'],
          holdingPeriodTracking: true,
          washSaleDetection: true,
          treatyBenefitCalculation: true,
          auditTrailGeneration: true,
          multiJurisdictionSupport: true,
        },
      },
      meta: {
        requestId: req.requestId,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    logger.error('Methodology fetch error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch methodology',
      },
    });
  }
});

/**
 * GET /tax/audit/:userId
 * Get audit ledger for user
 */
router.get('/audit/:userId', async (req: Request, res: Response) => {
  try {
    const userId = req.params['userId'] || '';
    const taxEngine = getTaxEngine();

    const auditLedger = await taxEngine.getAuditLedger(userId);

    res.json({
      success: true,
      data: {
        userId,
        auditLedger,
        entryCount: auditLedger.length,
      },
      meta: {
        requestId: req.requestId,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    logger.error('Audit ledger fetch error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch audit ledger',
      },
    });
  }
});

/**
 * GET /tax/cost-basis/:userId/:asset
 * Get cost basis lots for user's asset
 */
router.get('/cost-basis/:userId/:asset', async (req: Request, res: Response) => {
  try {
    const userId = req.params['userId'] || '';
    const asset = req.params['asset'] || '';
    const taxEngine = getTaxEngine();

    const lots = await taxEngine.getCostBasisLots(userId, asset);

    res.json({
      success: true,
      data: {
        userId,
        asset,
        lots,
        totalLots: lots.length,
        totalAmount: lots.reduce((sum, lot) => sum + parseFloat(lot.amount), 0).toString(),
        totalCostBasis: lots.reduce((sum, lot) => sum + parseFloat(lot.costBasis), 0).toFixed(2),
      },
      meta: {
        requestId: req.requestId,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    logger.error('Cost basis fetch error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to fetch cost basis',
      },
    });
  }
});

export { router as taxRoutes };
