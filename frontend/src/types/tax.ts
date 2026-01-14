export interface TaxProfile {
  userId: string;
  taxResidence: string;
  taxId?: string;
  costBasisMethod: 'FIFO' | 'LIFO' | 'HIFO' | 'SPECIFIC_ID' | 'AVERAGE';
  treatyBenefits?: string[];
  filingStatus?: string;
}

export interface TaxTransaction {
  id: string;
  type: 'BUY' | 'SELL' | 'TRANSFER' | 'DIVIDEND' | 'STAKING_REWARD' | 'AIRDROP';
  asset: string;
  amount: string;
  pricePerUnit: string;
  totalValue: string;
  fee?: string;
  timestamp: string;
  transactionHash: string;
}

export interface TaxCalculation {
  transactionId: string;
  transactionType: 'CAPITAL_GAIN' | 'CAPITAL_LOSS' | 'DIVIDEND_INCOME' | 'ORDINARY_INCOME' | 'NON_TAXABLE';
  proceeds: string;
  costBasis: string;
  gainLoss: string;
  taxableAmount: string;
  taxRate: number;
  taxOwed: string;
  jurisdiction: string;
  methodology: string;
  calculatedAt: string;
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

export interface TaxReport {
  userId: string;
  taxYear: number;
  jurisdiction: string;
  totalGains: string;
  totalLosses: string;
  netGainLoss: string;
  totalTaxOwed: string;
  transactions: TaxCalculation[];
  generatedAt: string;
  reportFormat: string;
}

export interface Jurisdiction {
  code: string;
  name: string;
  region: string;
  shortTermRate?: number;
  longTermRate?: number;
}

export interface JurisdictionRules {
  code: string;
  name: string;
  region: string;
  shortTermRate: number;
  longTermRate: number;
  longTermThresholdDays: number;
  dividendRate: number;
  cryptoSpecificRules?: Record<string, unknown>;
  treatyPartners?: string[];
  currency: string;
  notes?: string;
}

export interface CostBasisLot {
  id: string;
  asset: string;
  amount: string;
  costBasis: string;
  acquiredAt: string;
  transactionHash?: string;
}
