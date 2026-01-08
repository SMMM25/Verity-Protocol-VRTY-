/**
 * Verity Protocol - Tax Module Exports
 * Auto-Tax Engine with 200+ jurisdiction support
 */

export {
  VerityAutoTaxEngine,
  type CostBasisLot,
  type TaxTransaction,
  type TaxSummary,
} from './AutoTaxEngine.js';

export {
  JURISDICTION_RULES,
  type JurisdictionRules,
  getSupportedJurisdictions,
  getJurisdictionByCode,
  getJurisdictionsByRegion,
  getTaxFriendlyJurisdictions,
  getHoldingPeriodExemptionJurisdictions,
  getJurisdictionsWithTreaty,
} from './jurisdictions.js';
