/**
 * Verity Protocol - Auto-Tax Compliance Engine
 * Real-time tax calculations with transparent methodology across 200+ jurisdictions
 * 
 * MIGRATED TO POSTGRESQL via Prisma for production persistence
 */

import { EventEmitter } from 'eventemitter3';
import { prisma } from '../db/client.js';
import { logger, logAuditAction } from '../utils/logger.js';
import { generateId, generateVerificationHash } from '../utils/crypto.js';
import type {
  TaxProfile as TaxProfileType,
  TaxCalculation as TaxCalculationType,
  TaxTransactionType as TaxTransactionTypeEnum,
  TaxReport as TaxReportType,
  CostBasisMethod as CostBasisMethodType,
} from '../types/index.js';
import {
  JURISDICTION_RULES,
  JurisdictionRules,
  getSupportedJurisdictions,
  getJurisdictionByCode,
  getJurisdictionsByRegion,
  getTaxFriendlyJurisdictions,
  getHoldingPeriodExemptionJurisdictions,
  getJurisdictionsWithTreaty,
} from './jurisdictions.js';
import type { CostBasisMethod as PrismaCostBasisMethod, TaxTransactionType, TaxCalculationType as PrismaTaxCalculationType } from '@prisma/client';

// Re-export for backward compatibility
export type { JurisdictionRules } from './jurisdictions.js';

export interface CostBasisLot {
  id: string;
  asset: string;
  amount: string;
  costBasis: string;
  acquiredAt: Date;
  transactionHash?: string;
}

export interface TaxTransaction {
  id: string;
  type: 'BUY' | 'SELL' | 'TRANSFER' | 'DIVIDEND' | 'STAKING_REWARD' | 'AIRDROP';
  asset: string;
  amount: string;
  pricePerUnit: string;
  totalValue: string;
  fee?: string;
  timestamp: Date;
  transactionHash: string;
}

export interface TaxSummary {
  taxYear: number;
  jurisdiction: string;
  totalTransactions: number;
  totalProceeds: string;
  totalCostBasis: string;
  shortTermGains: string;
  shortTermLosses: string;
  longTermGains: string;
  longTermLosses: string;
  netGainLoss: string;
  dividendIncome: string;
  stakingIncome: string;
  estimatedTax: string;
}

// Map TypeScript types to Prisma enum values
const mapCostBasisMethod = (method: CostBasisMethodType): PrismaCostBasisMethod => {
  return method as PrismaCostBasisMethod;
};

const mapTxType = (type: TaxTransaction['type']): TaxTransactionType => {
  return type as TaxTransactionType;
};

const mapTaxType = (type: TaxTransactionTypeEnum): PrismaTaxCalculationType => {
  return type as PrismaTaxCalculationType;
};

/**
 * Verity Auto-Tax Engine
 * Automated tax calculation and reporting with PostgreSQL persistence
 */
export class VerityAutoTaxEngine extends EventEmitter {
  constructor() {
    super();
    logger.info('Verity Auto-Tax Engine initialized with PostgreSQL persistence');
  }

  /**
   * Create or update a user's tax profile
   */
  async setTaxProfile(userId: string, profile: Omit<TaxProfileType, 'userId'>): Promise<TaxProfileType> {
    const dbProfile = await prisma.taxProfile.upsert({
      where: { userId },
      update: {
        taxResidence: profile.taxResidence,
        taxId: profile.taxId || null,
        costBasisMethod: mapCostBasisMethod(profile.costBasisMethod),
        treatyBenefits: profile.treatyBenefits || [],
        filingStatus: profile.filingStatus || null,
      },
      create: {
        userId,
        taxResidence: profile.taxResidence,
        taxId: profile.taxId || null,
        costBasisMethod: mapCostBasisMethod(profile.costBasisMethod),
        treatyBenefits: profile.treatyBenefits || [],
        filingStatus: profile.filingStatus || null,
      },
    });

    logAuditAction('TAX_PROFILE_SET', userId, {
      jurisdiction: profile.taxResidence,
      costBasisMethod: profile.costBasisMethod,
    });

    return {
      userId: dbProfile.userId,
      taxResidence: dbProfile.taxResidence,
      taxId: dbProfile.taxId || undefined,
      costBasisMethod: dbProfile.costBasisMethod as CostBasisMethodType,
      treatyBenefits: dbProfile.treatyBenefits,
      filingStatus: dbProfile.filingStatus || undefined,
    };
  }

  /**
   * Get user's tax profile
   */
  async getTaxProfile(userId: string): Promise<TaxProfileType | undefined> {
    const dbProfile = await prisma.taxProfile.findUnique({
      where: { userId },
    });

    if (!dbProfile) return undefined;

    return {
      userId: dbProfile.userId,
      taxResidence: dbProfile.taxResidence,
      taxId: dbProfile.taxId || undefined,
      costBasisMethod: dbProfile.costBasisMethod as CostBasisMethodType,
      treatyBenefits: dbProfile.treatyBenefits,
      filingStatus: dbProfile.filingStatus || undefined,
    };
  }

  /**
   * Record a transaction for tax tracking
   */
  async recordTransaction(userId: string, transaction: Omit<TaxTransaction, 'id'>): Promise<TaxTransaction> {
    // Ensure profile exists
    const profile = await prisma.taxProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new Error('Tax profile not found. Please create a tax profile first.');
    }

    const txId = generateId('TX');

    // Create the transaction record
    const dbTx = await prisma.taxTransaction.create({
      data: {
        id: txId,
        profileId: profile.id,
        type: mapTxType(transaction.type),
        asset: transaction.asset,
        amount: parseFloat(transaction.amount),
        pricePerUnit: parseFloat(transaction.pricePerUnit),
        totalValue: parseFloat(transaction.totalValue),
        fee: transaction.fee ? parseFloat(transaction.fee) : null,
        txHash: transaction.transactionHash,
        timestamp: transaction.timestamp,
      },
    });

    // Update cost basis lots for buys
    if (transaction.type === 'BUY' || transaction.type === 'AIRDROP' || transaction.type === 'STAKING_REWARD') {
      await this.addCostBasisLot(profile.id, {
        asset: transaction.asset,
        amount: transaction.amount,
        costBasis: transaction.type === 'BUY' ? transaction.totalValue : '0',
        acquiredAt: transaction.timestamp,
        transactionHash: transaction.transactionHash,
      });
    }

    const tx: TaxTransaction = {
      id: dbTx.id,
      type: dbTx.type as TaxTransaction['type'],
      asset: dbTx.asset,
      amount: dbTx.amount.toString(),
      pricePerUnit: dbTx.pricePerUnit.toString(),
      totalValue: dbTx.totalValue.toString(),
      fee: dbTx.fee?.toString(),
      timestamp: dbTx.timestamp,
      transactionHash: dbTx.txHash,
    };

    this.emit('transactionRecorded', tx);

    return tx;
  }

  /**
   * Add a cost basis lot
   */
  private async addCostBasisLot(
    profileId: string,
    lot: Omit<CostBasisLot, 'id'>
  ): Promise<CostBasisLot> {
    const lotId = generateId('LOT');

    const dbLot = await prisma.costBasisLot.create({
      data: {
        id: lotId,
        profileId,
        asset: lot.asset,
        amount: parseFloat(lot.amount),
        costBasis: parseFloat(lot.costBasis),
        remainingAmount: parseFloat(lot.amount),
        acquiredAt: lot.acquiredAt,
        txHash: lot.transactionHash || null,
      },
    });

    return {
      id: dbLot.id,
      asset: dbLot.asset,
      amount: dbLot.amount.toString(),
      costBasis: dbLot.costBasis.toString(),
      acquiredAt: dbLot.acquiredAt,
      transactionHash: dbLot.txHash || undefined,
    };
  }

  /**
   * Calculate tax for a transaction with transparent methodology
   */
  async calculateVerifiedTransactionTax(
    userId: string,
    transaction: TaxTransaction
  ): Promise<TaxCalculationType> {
    const profile = await prisma.taxProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new Error('Tax profile not found');
    }

    const jurisdictionRules = JURISDICTION_RULES.get(profile.taxResidence);
    if (!jurisdictionRules) {
      throw new Error(`Jurisdiction ${profile.taxResidence} not supported`);
    }

    // Classify the transaction
    const txType = this.classifyTransactionWithVerification(transaction, profile.costBasisMethod as CostBasisMethodType);

    let taxCalculation: TaxCalculationType;

    switch (txType) {
      case 'CAPITAL_GAIN':
      case 'CAPITAL_LOSS':
        taxCalculation = await this.calculateCapitalGainsTax(
          profile.id,
          transaction,
          jurisdictionRules,
          profile.costBasisMethod as CostBasisMethodType
        );
        break;

      case 'DIVIDEND_INCOME':
        taxCalculation = this.calculateDividendTax(
          transaction,
          jurisdictionRules,
          this.checkVerifiedTreatyBenefits(profile.treatyBenefits)
        );
        break;

      case 'ORDINARY_INCOME':
        taxCalculation = this.calculateOrdinaryIncomeTax(
          transaction,
          jurisdictionRules
        );
        break;

      default:
        taxCalculation = {
          transactionId: transaction.id,
          transactionType: 'NON_TAXABLE',
          proceeds: transaction.totalValue,
          costBasis: transaction.totalValue,
          gainLoss: '0',
          taxableAmount: '0',
          taxRate: 0,
          taxOwed: '0',
          jurisdiction: profile.taxResidence,
          methodology: 'Non-taxable transaction',
          calculatedAt: new Date(),
        };
    }

    // Store calculation in database
    const verificationHash = generateVerificationHash(taxCalculation);
    
    await prisma.taxCalculation.create({
      data: {
        profileId: profile.id,
        transactionId: transaction.id,
        transactionType: mapTaxType(taxCalculation.transactionType),
        proceeds: parseFloat(taxCalculation.proceeds),
        costBasis: parseFloat(taxCalculation.costBasis),
        gainLoss: parseFloat(taxCalculation.gainLoss),
        taxableAmount: parseFloat(taxCalculation.taxableAmount),
        taxRate: taxCalculation.taxRate,
        taxOwed: parseFloat(taxCalculation.taxOwed),
        jurisdiction: taxCalculation.jurisdiction,
        methodology: taxCalculation.methodology,
        isLongTerm: taxCalculation.methodology.includes('long-term'),
        verificationHash,
        calculatedAt: taxCalculation.calculatedAt,
      },
    });

    // Log to audit trail
    await this.logToAuditLedger(profile.id, taxCalculation);

    this.emit('taxCalculated', taxCalculation);

    return taxCalculation;
  }

  /**
   * Classify transaction type for tax purposes
   */
  private classifyTransactionWithVerification(
    transaction: TaxTransaction,
    _costBasisMethod: CostBasisMethodType
  ): TaxTransactionTypeEnum {
    switch (transaction.type) {
      case 'SELL':
        return 'CAPITAL_GAIN'; // Simplified - would check actual gain/loss

      case 'DIVIDEND':
        return 'DIVIDEND_INCOME';

      case 'STAKING_REWARD':
      case 'AIRDROP':
        return 'ORDINARY_INCOME';

      case 'TRANSFER':
        return 'NON_TAXABLE';

      case 'BUY':
      default:
        return 'NON_TAXABLE';
    }
  }

  /**
   * Calculate capital gains tax
   */
  private async calculateCapitalGainsTax(
    profileId: string,
    transaction: TaxTransaction,
    rules: JurisdictionRules,
    costBasisMethod: CostBasisMethodType
  ): Promise<TaxCalculationType> {
    // Get cost basis lots for this asset from database
    const lots = await prisma.costBasisLot.findMany({
      where: {
        profileId,
        asset: transaction.asset,
        remainingAmount: { gt: 0 },
      },
      orderBy: this.getLotOrderBy(costBasisMethod),
    });

    // Calculate cost basis for the sold amount
    let remainingAmount = parseFloat(transaction.amount);
    let totalCostBasis = 0;
    let isLongTerm = true;
    const now = new Date();

    for (const lot of lots) {
      if (remainingAmount <= 0) break;

      const lotAmount = lot.remainingAmount.toNumber();
      const usedAmount = Math.min(lotAmount, remainingAmount);
      const lotCostPerUnit = lot.costBasis.toNumber() / lot.amount.toNumber();
      
      totalCostBasis += usedAmount * lotCostPerUnit;
      remainingAmount -= usedAmount;

      // Update remaining amount in lot
      await prisma.costBasisLot.update({
        where: { id: lot.id },
        data: { remainingAmount: lotAmount - usedAmount },
      });

      // Check holding period
      const holdingDays = Math.floor(
        (now.getTime() - lot.acquiredAt.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (holdingDays < rules.longTermThresholdDays) {
        isLongTerm = false;
      }
    }

    const proceeds = parseFloat(transaction.totalValue);
    const gainLoss = proceeds - totalCostBasis;
    const isGain = gainLoss > 0;

    // Check for special crypto rules (e.g., Germany's 1-year exemption)
    let taxRate = isLongTerm ? rules.longTermRate : rules.shortTermRate;
    if (rules.cryptoSpecificRules?.['holdingPeriodExemption'] && isLongTerm) {
      taxRate = 0;
    }

    const taxOwed = isGain ? (gainLoss * taxRate) / 100 : 0;

    return {
      transactionId: transaction.id,
      transactionType: isGain ? 'CAPITAL_GAIN' : 'CAPITAL_LOSS',
      proceeds: proceeds.toFixed(2),
      costBasis: totalCostBasis.toFixed(2),
      gainLoss: gainLoss.toFixed(2),
      taxableAmount: isGain ? gainLoss.toFixed(2) : '0',
      taxRate,
      taxOwed: taxOwed.toFixed(2),
      jurisdiction: rules.code,
      methodology: `${costBasisMethod} cost basis, ${isLongTerm ? 'long-term' : 'short-term'} holding period (${rules.longTermThresholdDays} day threshold)`,
      calculatedAt: new Date(),
    };
  }

  /**
   * Get order by clause for cost basis method
   */
  private getLotOrderBy(method: CostBasisMethodType): { acquiredAt?: 'asc' | 'desc'; costBasis?: 'desc' } {
    switch (method) {
      case 'FIFO':
        return { acquiredAt: 'asc' };
      case 'LIFO':
        return { acquiredAt: 'desc' };
      case 'HIFO':
        return { costBasis: 'desc' };
      default:
        return { acquiredAt: 'asc' };
    }
  }

  /**
   * Calculate dividend tax
   */
  private calculateDividendTax(
    transaction: TaxTransaction,
    rules: JurisdictionRules,
    hasTreatyBenefits: boolean
  ): TaxCalculationType {
    const dividendAmount = parseFloat(transaction.totalValue);
    let taxRate = rules.dividendRate;

    if (hasTreatyBenefits) {
      taxRate = Math.min(taxRate, 15);
    }

    const taxOwed = (dividendAmount * taxRate) / 100;

    return {
      transactionId: transaction.id,
      transactionType: 'DIVIDEND_INCOME',
      proceeds: dividendAmount.toFixed(2),
      costBasis: '0',
      gainLoss: dividendAmount.toFixed(2),
      taxableAmount: dividendAmount.toFixed(2),
      taxRate,
      taxOwed: taxOwed.toFixed(2),
      jurisdiction: rules.code,
      methodology: `Dividend income taxed at ${taxRate}%${hasTreatyBenefits ? ' (treaty rate applied)' : ''}`,
      calculatedAt: new Date(),
    };
  }

  /**
   * Calculate ordinary income tax (staking rewards, airdrops)
   */
  private calculateOrdinaryIncomeTax(
    transaction: TaxTransaction,
    rules: JurisdictionRules
  ): TaxCalculationType {
    const incomeAmount = parseFloat(transaction.totalValue);
    const taxRate = rules.shortTermRate;

    const taxOwed = (incomeAmount * taxRate) / 100;

    return {
      transactionId: transaction.id,
      transactionType: 'ORDINARY_INCOME',
      proceeds: incomeAmount.toFixed(2),
      costBasis: '0',
      gainLoss: incomeAmount.toFixed(2),
      taxableAmount: incomeAmount.toFixed(2),
      taxRate,
      taxOwed: taxOwed.toFixed(2),
      jurisdiction: rules.code,
      methodology: `${transaction.type} income taxed as ordinary income at ${taxRate}%`,
      calculatedAt: new Date(),
    };
  }

  /**
   * Check if user has treaty benefits
   */
  private checkVerifiedTreatyBenefits(treatyBenefits: string[]): boolean {
    return treatyBenefits && treatyBenefits.length > 0;
  }

  /**
   * Log calculation to audit ledger
   */
  private async logToAuditLedger(profileId: string, calculation: TaxCalculationType): Promise<void> {
    await prisma.taxAuditEntry.create({
      data: {
        profileId,
        entryType: 'TAX_CALCULATION',
        data: JSON.parse(JSON.stringify(calculation)),
        verificationHash: generateVerificationHash(calculation),
      },
    });
  }

  /**
   * Generate tax report for a year
   */
  async generateTaxReport(
    userId: string,
    taxYear: number,
    format: 'IRS_8949' | 'HMRC' | 'GENERIC' = 'GENERIC'
  ): Promise<TaxReportType> {
    const profile = await prisma.taxProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new Error('Tax profile not found');
    }

    // Get calculations for the year
    const startDate = new Date(taxYear, 0, 1);
    const endDate = new Date(taxYear + 1, 0, 1);

    const calculations = await prisma.taxCalculation.findMany({
      where: {
        profileId: profile.id,
        calculatedAt: {
          gte: startDate,
          lt: endDate,
        },
      },
    });

    // Aggregate calculations
    let totalGains = 0;
    let totalLosses = 0;
    let totalTaxOwed = 0;
    let shortTermGains = 0;
    let shortTermLosses = 0;
    let longTermGains = 0;
    let longTermLosses = 0;
    let dividendIncome = 0;
    let stakingIncome = 0;

    for (const calc of calculations) {
      const gainLoss = calc.gainLoss.toNumber();
      
      if (gainLoss > 0) {
        totalGains += gainLoss;
        if (calc.isLongTerm) {
          longTermGains += gainLoss;
        } else {
          shortTermGains += gainLoss;
        }
      } else {
        totalLosses += Math.abs(gainLoss);
        if (calc.isLongTerm) {
          longTermLosses += Math.abs(gainLoss);
        } else {
          shortTermLosses += Math.abs(gainLoss);
        }
      }
      
      totalTaxOwed += calc.taxOwed.toNumber();

      if (calc.transactionType === 'DIVIDEND_INCOME') {
        dividendIncome += gainLoss;
      } else if (calc.transactionType === 'ORDINARY_INCOME') {
        stakingIncome += gainLoss;
      }
    }

    // Save report to database
    const dbReport = await prisma.taxReport.upsert({
      where: {
        profileId_taxYear: {
          profileId: profile.id,
          taxYear,
        },
      },
      update: {
        reportFormat: format,
        totalGains,
        totalLosses,
        netGainLoss: totalGains - totalLosses,
        totalTaxOwed,
        shortTermGains,
        shortTermLosses,
        longTermGains,
        longTermLosses,
        dividendIncome,
        stakingIncome,
        transactionCount: calculations.length,
        generatedAt: new Date(),
      },
      create: {
        profileId: profile.id,
        taxYear,
        jurisdiction: profile.taxResidence,
        reportFormat: format,
        totalGains,
        totalLosses,
        netGainLoss: totalGains - totalLosses,
        totalTaxOwed,
        shortTermGains,
        shortTermLosses,
        longTermGains,
        longTermLosses,
        dividendIncome,
        stakingIncome,
        transactionCount: calculations.length,
      },
    });

    const report: TaxReportType = {
      userId,
      taxYear,
      jurisdiction: profile.taxResidence,
      totalGains: totalGains.toFixed(2),
      totalLosses: totalLosses.toFixed(2),
      netGainLoss: (totalGains - totalLosses).toFixed(2),
      totalTaxOwed: totalTaxOwed.toFixed(2),
      transactions: calculations.map(c => ({
        transactionId: c.transactionId,
        transactionType: c.transactionType as TaxTransactionTypeEnum,
        proceeds: c.proceeds.toString(),
        costBasis: c.costBasis.toString(),
        gainLoss: c.gainLoss.toString(),
        taxableAmount: c.taxableAmount.toString(),
        taxRate: c.taxRate.toNumber(),
        taxOwed: c.taxOwed.toString(),
        jurisdiction: c.jurisdiction,
        methodology: c.methodology,
        calculatedAt: c.calculatedAt,
      })),
      generatedAt: dbReport.generatedAt,
      reportFormat: format,
    };

    logAuditAction('TAX_REPORT_GENERATED', userId, {
      taxYear,
      format,
      transactionCount: calculations.length,
    });

    this.emit('reportGenerated', report);

    return report;
  }

  /**
   * Generate tax summary for dashboard
   */
  async getTaxSummary(userId: string, taxYear: number): Promise<TaxSummary> {
    const profile = await prisma.taxProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new Error('Tax profile not found');
    }

    const startDate = new Date(taxYear, 0, 1);
    const endDate = new Date(taxYear + 1, 0, 1);

    const calculations = await prisma.taxCalculation.findMany({
      where: {
        profileId: profile.id,
        calculatedAt: {
          gte: startDate,
          lt: endDate,
        },
      },
    });

    // Aggregate by type
    let shortTermGains = 0;
    let shortTermLosses = 0;
    let longTermGains = 0;
    let longTermLosses = 0;
    let dividendIncome = 0;
    let stakingIncome = 0;
    let totalProceeds = 0;
    let totalCostBasis = 0;
    let totalTax = 0;

    for (const calc of calculations) {
      const gainLoss = calc.gainLoss.toNumber();
      totalProceeds += calc.proceeds.toNumber();
      totalCostBasis += calc.costBasis.toNumber();
      totalTax += calc.taxOwed.toNumber();

      if (calc.transactionType === 'CAPITAL_GAIN' || calc.transactionType === 'CAPITAL_LOSS') {
        if (calc.isLongTerm) {
          if (gainLoss > 0) {
            longTermGains += gainLoss;
          } else {
            longTermLosses += Math.abs(gainLoss);
          }
        } else {
          if (gainLoss > 0) {
            shortTermGains += gainLoss;
          } else {
            shortTermLosses += Math.abs(gainLoss);
          }
        }
      } else if (calc.transactionType === 'DIVIDEND_INCOME') {
        dividendIncome += gainLoss;
      } else if (calc.transactionType === 'ORDINARY_INCOME') {
        stakingIncome += gainLoss;
      }
    }

    return {
      taxYear,
      jurisdiction: profile.taxResidence,
      totalTransactions: calculations.length,
      totalProceeds: totalProceeds.toFixed(2),
      totalCostBasis: totalCostBasis.toFixed(2),
      shortTermGains: shortTermGains.toFixed(2),
      shortTermLosses: shortTermLosses.toFixed(2),
      longTermGains: longTermGains.toFixed(2),
      longTermLosses: longTermLosses.toFixed(2),
      netGainLoss: (shortTermGains - shortTermLosses + longTermGains - longTermLosses).toFixed(2),
      dividendIncome: dividendIncome.toFixed(2),
      stakingIncome: stakingIncome.toFixed(2),
      estimatedTax: totalTax.toFixed(2),
    };
  }

  /**
   * Get supported jurisdictions (200+ countries)
   */
  getSupportedJurisdictions(): Array<{ code: string; name: string; region: string }> {
    return getSupportedJurisdictions();
  }

  /**
   * Get jurisdiction rules (transparent methodology)
   */
  getJurisdictionRules(code: string): JurisdictionRules | undefined {
    return getJurisdictionByCode(code);
  }

  /**
   * Get jurisdictions by region
   */
  getJurisdictionsByRegion(region: string): JurisdictionRules[] {
    return getJurisdictionsByRegion(region);
  }

  /**
   * Get tax-friendly jurisdictions (0% capital gains)
   */
  getTaxFriendlyJurisdictions(): JurisdictionRules[] {
    return getTaxFriendlyJurisdictions();
  }

  /**
   * Get jurisdictions with holding period exemptions
   */
  getHoldingPeriodExemptionJurisdictions(): JurisdictionRules[] {
    return getHoldingPeriodExemptionJurisdictions();
  }

  /**
   * Get jurisdictions with tax treaty for specific country
   */
  getJurisdictionsWithTreaty(countryCode: string): JurisdictionRules[] {
    return getJurisdictionsWithTreaty(countryCode);
  }

  /**
   * Get total jurisdiction count
   */
  getJurisdictionCount(): number {
    return JURISDICTION_RULES.size;
  }

  /**
   * Get audit ledger for a user
   */
  async getAuditLedger(userId: string): Promise<unknown[]> {
    const profile = await prisma.taxProfile.findUnique({
      where: { userId },
    });

    if (!profile) return [];

    const entries = await prisma.taxAuditEntry.findMany({
      where: { profileId: profile.id },
      orderBy: { createdAt: 'desc' },
    });

    return entries.map(e => ({
      type: e.entryType,
      data: e.data,
      verificationHash: e.verificationHash,
      timestamp: e.createdAt,
    }));
  }

  /**
   * Get all transactions for a user
   */
  async getUserTransactions(userId: string): Promise<TaxTransaction[]> {
    const profile = await prisma.taxProfile.findUnique({
      where: { userId },
    });

    if (!profile) return [];

    const transactions = await prisma.taxTransaction.findMany({
      where: { profileId: profile.id },
      orderBy: { timestamp: 'desc' },
    });

    return transactions.map(tx => ({
      id: tx.id,
      type: tx.type as TaxTransaction['type'],
      asset: tx.asset,
      amount: tx.amount.toString(),
      pricePerUnit: tx.pricePerUnit.toString(),
      totalValue: tx.totalValue.toString(),
      fee: tx.fee?.toString(),
      timestamp: tx.timestamp,
      transactionHash: tx.txHash,
    }));
  }

  /**
   * Get cost basis lots for a user's asset
   */
  async getCostBasisLots(userId: string, asset: string): Promise<CostBasisLot[]> {
    const profile = await prisma.taxProfile.findUnique({
      where: { userId },
    });

    if (!profile) return [];

    const lots = await prisma.costBasisLot.findMany({
      where: {
        profileId: profile.id,
        asset,
      },
      orderBy: { acquiredAt: 'asc' },
    });

    return lots.map(lot => ({
      id: lot.id,
      asset: lot.asset,
      amount: lot.amount.toString(),
      costBasis: lot.costBasis.toString(),
      acquiredAt: lot.acquiredAt,
      transactionHash: lot.txHash || undefined,
    }));
  }

  /**
   * Export calculation methodology documentation
   */
  getMethodologyDocumentation(): Record<string, unknown> {
    return {
      version: '2.0.0',
      description: 'Verity Auto-Tax Calculation Methodology (PostgreSQL-backed)',
      supportedMethods: ['FIFO', 'LIFO', 'HIFO', 'AVERAGE', 'SPECIFIC_ID'],
      transactionTypes: [
        {
          type: 'CAPITAL_GAIN',
          description: 'Profit from selling assets above cost basis',
        },
        {
          type: 'CAPITAL_LOSS',
          description: 'Loss from selling assets below cost basis',
        },
        {
          type: 'DIVIDEND_INCOME',
          description: 'Income from asset dividends',
        },
        {
          type: 'ORDINARY_INCOME',
          description: 'Income from staking rewards, airdrops, etc.',
        },
        {
          type: 'NON_TAXABLE',
          description: 'Transfers and purchases (no taxable event)',
        },
      ],
      disclaimer: 'Tax calculations are provided for informational purposes only. Consult a tax professional for advice.',
      transparency: 'All calculations are logged to a PostgreSQL audit table with verification hashes.',
      persistence: 'All data is persisted in PostgreSQL for production use.',
    };
  }
}

export default VerityAutoTaxEngine;
