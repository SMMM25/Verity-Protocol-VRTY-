/**
 * Verity Protocol - Auto-Tax Engine Unit Tests
 * Tests for tax calculations across 200+ jurisdictions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { VerityAutoTaxEngine } from '../../src/tax/AutoTaxEngine.js';
import {
  getSupportedJurisdictions,
  getJurisdictionByCode,
  getTaxFriendlyJurisdictions,
  getHoldingPeriodExemptionJurisdictions,
  getJurisdictionsByRegion,
} from '../../src/tax/jurisdictions.js';

describe('VerityAutoTaxEngine', () => {
  let taxEngine: VerityAutoTaxEngine;

  beforeEach(() => {
    taxEngine = new VerityAutoTaxEngine();
  });

  describe('Jurisdiction Database', () => {
    it('should have 200+ jurisdictions', () => {
      const jurisdictions = getSupportedJurisdictions();
      expect(jurisdictions.length).toBeGreaterThanOrEqual(200);
    });

    it('should have all major trading jurisdictions', () => {
      const majorJurisdictions = ['US', 'GB', 'DE', 'JP', 'SG', 'HK', 'CH', 'AE'];
      for (const code of majorJurisdictions) {
        const jurisdiction = getJurisdictionByCode(code);
        expect(jurisdiction).toBeDefined();
        expect(jurisdiction?.code).toBe(code);
      }
    });

    it('should have tax-friendly jurisdictions', () => {
      const taxFriendly = getTaxFriendlyJurisdictions();
      expect(taxFriendly.length).toBeGreaterThan(20);
      
      // All tax-friendly jurisdictions should have 0% rates
      for (const j of taxFriendly) {
        expect(j.shortTermRate).toBe(0);
        expect(j.longTermRate).toBe(0);
      }
    });

    it('should have jurisdictions with holding period exemptions', () => {
      const exemptionJurisdictions = getHoldingPeriodExemptionJurisdictions();
      expect(exemptionJurisdictions.length).toBeGreaterThan(5);
      
      // Germany should be included
      const germany = exemptionJurisdictions.find(j => j.code === 'DE');
      expect(germany).toBeDefined();
      expect(germany?.cryptoSpecificRules?.exemptionDays).toBe(365);
    });

    it('should support all regions', () => {
      const regions = [
        'North America',
        'Europe',
        'Asia-Pacific',
        'Middle East',
        'Africa',
        'Latin America',
        'Caribbean',
        'Oceania',
        'Central Asia',
        'Caucasus',
      ];

      for (const region of regions) {
        const jurisdictions = getJurisdictionsByRegion(region);
        expect(jurisdictions.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Tax Profile Management', () => {
    it('should create and retrieve tax profiles', () => {
      const profile = {
        userId: 'user_123',
        taxResidence: 'US',
        costBasisMethod: 'FIFO' as const,
        treatyBenefits: [],
      };

      taxEngine.setTaxProfile('user_123', profile);
      const retrieved = taxEngine.getTaxProfile('user_123');
      
      expect(retrieved).toBeDefined();
      expect(retrieved?.taxResidence).toBe('US');
      expect(retrieved?.costBasisMethod).toBe('FIFO');
    });

    it('should support all cost basis methods', () => {
      const methods = ['FIFO', 'LIFO', 'HIFO', 'AVERAGE', 'SPECIFIC_ID'] as const;
      
      for (const method of methods) {
        taxEngine.setTaxProfile('test_user', {
          userId: 'test_user',
          taxResidence: 'US',
          costBasisMethod: method,
          treatyBenefits: [],
        });
        
        const profile = taxEngine.getTaxProfile('test_user');
        expect(profile?.costBasisMethod).toBe(method);
      }
    });
  });

  describe('Transaction Recording', () => {
    beforeEach(() => {
      taxEngine.setTaxProfile('user_123', {
        userId: 'user_123',
        taxResidence: 'US',
        costBasisMethod: 'FIFO',
        treatyBenefits: [],
      });
    });

    it('should record buy transactions', () => {
      taxEngine.recordTransaction('user_123', {
        type: 'BUY',
        asset: 'XRP',
        amount: '1000',
        pricePerUnit: '0.50',
        totalValue: '500',
        timestamp: new Date(),
        transactionHash: 'tx_123',
      });

      const transactions = taxEngine.getUserTransactions('user_123');
      expect(transactions.length).toBe(1);
      expect(transactions[0].type).toBe('BUY');
    });

    it('should create cost basis lots for buys', () => {
      taxEngine.recordTransaction('user_123', {
        type: 'BUY',
        asset: 'XRP',
        amount: '1000',
        pricePerUnit: '0.50',
        totalValue: '500',
        timestamp: new Date(),
        transactionHash: 'tx_123',
      });

      const lots = taxEngine.getCostBasisLots('user_123', 'XRP');
      expect(lots.length).toBe(1);
      expect(lots[0].amount).toBe('1000');
      expect(lots[0].costBasis).toBe('500');
    });
  });

  describe('Tax Calculations', () => {
    beforeEach(() => {
      // Set up US tax profile
      taxEngine.setTaxProfile('us_user', {
        userId: 'us_user',
        taxResidence: 'US',
        costBasisMethod: 'FIFO',
        treatyBenefits: [],
      });

      // Record a buy transaction
      taxEngine.recordTransaction('us_user', {
        type: 'BUY',
        asset: 'XRP',
        amount: '1000',
        pricePerUnit: '0.50',
        totalValue: '500',
        timestamp: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000), // 400 days ago
        transactionHash: 'tx_buy_1',
      });
    });

    it('should calculate capital gains tax', async () => {
      const sellTransaction = {
        type: 'SELL' as const,
        asset: 'XRP',
        amount: '500',
        pricePerUnit: '1.00',
        totalValue: '500',
        timestamp: new Date(),
        transactionHash: 'tx_sell_1',
      };

      const result = await taxEngine.calculateVerifiedTransactionTax('us_user', sellTransaction);
      
      expect(result).toBeDefined();
      expect(result.gainLoss).toBe('250'); // Sold for $500, cost basis $250
      expect(result.taxableAmount).toBe('250');
    });

    it('should apply long-term rates for US after 365 days', async () => {
      const sellTransaction = {
        type: 'SELL' as const,
        asset: 'XRP',
        amount: '500',
        pricePerUnit: '1.00',
        totalValue: '500',
        timestamp: new Date(),
        transactionHash: 'tx_sell_1',
      };

      const result = await taxEngine.calculateVerifiedTransactionTax('us_user', sellTransaction);
      
      expect(result.taxRate).toBe(20); // Long-term rate for US
    });
  });

  describe('Methodology Documentation', () => {
    it('should provide methodology documentation', () => {
      const methodology = taxEngine.getMethodologyDocumentation();
      
      expect(methodology).toBeDefined();
      expect(methodology.version).toBeDefined();
      expect(methodology.supportedMethods).toContain('FIFO');
      expect(methodology.transactionTypes).toBeDefined();
    });
  });

  describe('Audit Trail', () => {
    beforeEach(() => {
      taxEngine.setTaxProfile('audit_user', {
        userId: 'audit_user',
        taxResidence: 'US',
        costBasisMethod: 'FIFO',
        treatyBenefits: [],
      });
    });

    it('should maintain audit ledger', async () => {
      taxEngine.recordTransaction('audit_user', {
        type: 'BUY',
        asset: 'XRP',
        amount: '1000',
        pricePerUnit: '0.50',
        totalValue: '500',
        timestamp: new Date(),
        transactionHash: 'tx_1',
      });

      const sellTransaction = {
        type: 'SELL' as const,
        asset: 'XRP',
        amount: '500',
        pricePerUnit: '1.00',
        totalValue: '500',
        timestamp: new Date(),
        transactionHash: 'tx_2',
      };

      await taxEngine.calculateVerifiedTransactionTax('audit_user', sellTransaction);
      
      const auditLedger = taxEngine.getAuditLedger('audit_user');
      expect(auditLedger.length).toBeGreaterThan(0);
    });
  });

  describe('German Tax Rules', () => {
    beforeEach(() => {
      taxEngine.setTaxProfile('de_user', {
        userId: 'de_user',
        taxResidence: 'DE',
        costBasisMethod: 'FIFO',
        treatyBenefits: [],
      });
    });

    it('should apply German holding period exemption', async () => {
      // Buy 400+ days ago
      taxEngine.recordTransaction('de_user', {
        type: 'BUY',
        asset: 'XRP',
        amount: '1000',
        pricePerUnit: '0.50',
        totalValue: '500',
        timestamp: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000),
        transactionHash: 'tx_buy_1',
      });

      const sellTransaction = {
        type: 'SELL' as const,
        asset: 'XRP',
        amount: '500',
        pricePerUnit: '1.00',
        totalValue: '500',
        timestamp: new Date(),
        transactionHash: 'tx_sell_1',
      };

      const result = await taxEngine.calculateVerifiedTransactionTax('de_user', sellTransaction);
      
      // Germany has 0% long-term rate after 1 year
      expect(result.taxRate).toBe(0);
    });
  });
});

describe('Jurisdiction-Specific Rules', () => {
  describe('United States', () => {
    const us = getJurisdictionByCode('US');

    it('should have correct US tax rates', () => {
      expect(us?.shortTermRate).toBe(37);
      expect(us?.longTermRate).toBe(20);
      expect(us?.longTermThresholdDays).toBe(365);
    });

    it('should have crypto-specific rules', () => {
      expect(us?.cryptoSpecificRules?.miningTaxed).toBe(true);
      expect(us?.cryptoSpecificRules?.stakingTaxed).toBe(true);
      expect(us?.cryptoSpecificRules?.specificIdAllowed).toBe(true);
    });
  });

  describe('Germany', () => {
    const de = getJurisdictionByCode('DE');

    it('should have holding period exemption', () => {
      expect(de?.cryptoSpecificRules?.holdingPeriodExemption).toBe(true);
      expect(de?.cryptoSpecificRules?.exemptionDays).toBe(365);
    });

    it('should have 0% long-term rate', () => {
      expect(de?.longTermRate).toBe(0);
    });
  });

  describe('Singapore', () => {
    const sg = getJurisdictionByCode('SG');

    it('should have 0% capital gains tax', () => {
      expect(sg?.shortTermRate).toBe(0);
      expect(sg?.longTermRate).toBe(0);
    });
  });

  describe('UAE', () => {
    const ae = getJurisdictionByCode('AE');

    it('should have no taxes', () => {
      expect(ae?.shortTermRate).toBe(0);
      expect(ae?.longTermRate).toBe(0);
      expect(ae?.dividendRate).toBe(0);
    });
  });

  describe('El Salvador', () => {
    const sv = getJurisdictionByCode('SV');

    it('should have Bitcoin-friendly rules', () => {
      expect(sv?.cryptoSpecificRules?.miningTaxed).toBe(false);
      expect(sv?.cryptoSpecificRules?.stakingTaxed).toBe(false);
    });
  });
});
