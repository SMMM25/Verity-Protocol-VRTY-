/**
 * AI Sentinel v1 - Configuration
 * Default settings and rule definitions
 */

import {
  SentinelConfig,
  RuleDefinition,
  RuleType,
  AlertSeverity,
} from './types.js';

/**
 * Default rule definitions for AI Sentinel v1
 */
export const DEFAULT_RULES: RuleDefinition[] = [
  {
    id: 'rule-high-velocity',
    type: 'HIGH_VELOCITY',
    name: 'High Transaction Velocity',
    description: 'Detects wallets with unusually high transaction frequency (>50 txs/hour)',
    enabled: true,
    severity: 'WARNING',
    parameters: {
      maxTransactionsPerHour: 50,
    },
    thresholds: {
      warningThreshold: 50,
      criticalThreshold: 100,
      riskScoreWeight: 0.2,
    },
  },
  {
    id: 'rule-large-transfer',
    type: 'LARGE_TRANSFER',
    name: 'Large Transfer Alert',
    description: 'Flags single transactions exceeding 100,000 VRTY',
    enabled: true,
    severity: 'WARNING',
    parameters: {
      largeTransferThreshold: '100000',
    },
    thresholds: {
      warningThreshold: 100000,
      criticalThreshold: 500000,
      riskScoreWeight: 0.25,
    },
  },
  {
    id: 'rule-wash-trading',
    type: 'WASH_TRADING',
    name: 'Wash Trading Pattern',
    description: 'Detects circular transactions (A→B→A) within 24 hours',
    enabled: true,
    severity: 'CRITICAL',
    parameters: {
      washTradingWindow: 24,  // hours
      minWashAmount: '1000',
    },
    thresholds: {
      warningThreshold: 1,
      criticalThreshold: 3,
      riskScoreWeight: 0.35,
    },
  },
  {
    id: 'rule-new-wallet-large',
    type: 'NEW_WALLET_LARGE',
    name: 'New Wallet Large Activity',
    description: 'Flags new wallets (<24h old) with large transactions (>10,000 VRTY)',
    enabled: true,
    severity: 'WARNING',
    parameters: {
      newWalletAge: 24,  // hours
      newWalletThreshold: '10000',
    },
    thresholds: {
      warningThreshold: 10000,
      criticalThreshold: 50000,
      riskScoreWeight: 0.2,
    },
  },
  {
    id: 'rule-structuring',
    type: 'STRUCTURING',
    name: 'Transaction Structuring',
    description: 'Detects multiple transactions just below reporting thresholds',
    enabled: true,
    severity: 'CRITICAL',
    parameters: {
      structuringThreshold: '9500',  // Just below 10,000
      structuringWindow: 24,  // hours
      structuringMinCount: 3,
    },
    thresholds: {
      warningThreshold: 3,
      criticalThreshold: 5,
      riskScoreWeight: 0.4,
    },
  },
  {
    id: 'rule-bridge-abuse',
    type: 'BRIDGE_ABUSE',
    name: 'Bridge Abuse Detection',
    description: 'Monitors for suspicious cross-chain bridge activity',
    enabled: true,
    severity: 'WARNING',
    parameters: {
      bridgeVelocityLimit: 10,  // max bridge txs per hour
      bridgeAmountThreshold: '50000',
    },
    thresholds: {
      warningThreshold: 10,
      criticalThreshold: 20,
      riskScoreWeight: 0.25,
    },
  },
  {
    id: 'rule-cluster-activity',
    type: 'CLUSTER_ACTIVITY',
    name: 'Wallet Cluster Activity',
    description: 'Detects coordinated activity from linked wallet clusters',
    enabled: true,
    severity: 'WARNING',
    parameters: {
      clusterMinSize: 3,
      clusterTimeWindow: 1,  // hours
    },
    thresholds: {
      warningThreshold: 3,
      criticalThreshold: 5,
      riskScoreWeight: 0.3,
    },
  },
];

/**
 * Default Sentinel configuration
 */
export const DEFAULT_SENTINEL_CONFIG: SentinelConfig = {
  enabled: true,
  
  // Processing settings
  batchSize: 100,
  processingInterval: 5000,  // 5 seconds
  
  // Alert settings
  alertRetentionDays: 90,
  maxPendingAlerts: 1000,
  
  // Notification settings (configure via environment)
  webhookUrl: process.env['SENTINEL_WEBHOOK_URL'],
  emailRecipients: process.env['SENTINEL_EMAIL_RECIPIENTS']?.split(','),
  slackChannel: process.env['SENTINEL_SLACK_CHANNEL'],
  
  // Rules
  rules: DEFAULT_RULES,
};

/**
 * Risk score calculation weights
 */
export const RISK_WEIGHTS = {
  HIGH_VELOCITY: 0.2,
  LARGE_TRANSFER: 0.25,
  WASH_TRADING: 0.35,
  NEW_WALLET_LARGE: 0.2,
  STRUCTURING: 0.4,
  BRIDGE_ABUSE: 0.25,
  CLUSTER_ACTIVITY: 0.3,
  CUSTOM: 0.15,
};

/**
 * Severity thresholds for risk scores
 */
export const SEVERITY_THRESHOLDS = {
  INFO: 25,
  WARNING: 50,
  CRITICAL: 75,
};

/**
 * Time windows for analysis (in milliseconds)
 */
export const TIME_WINDOWS = {
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000,
};

/**
 * Guardian permission levels
 */
export const GUARDIAN_PERMISSIONS = {
  GUARDIAN: {
    canDismiss: true,
    canFlag: true,
    canFreeze: false,
    canEscalate: true,
    canInitiateClawback: false,
  },
  ADMIN: {
    canDismiss: true,
    canFlag: true,
    canFreeze: true,
    canEscalate: true,
    canInitiateClawback: false,
  },
  SUPER_ADMIN: {
    canDismiss: true,
    canFlag: true,
    canFreeze: true,
    canEscalate: true,
    canInitiateClawback: true,
  },
};

/**
 * Alert status transitions
 */
export const STATUS_TRANSITIONS: Record<string, string[]> = {
  PENDING: ['REVIEWING', 'DISMISSED'],
  REVIEWING: ['RESOLVED', 'DISMISSED', 'ESCALATED'],
  ESCALATED: ['RESOLVED', 'DISMISSED'],
  RESOLVED: [],  // Terminal state
  DISMISSED: [],  // Terminal state
};

/**
 * Get rule by type
 */
export function getRuleByType(type: RuleType): RuleDefinition | undefined {
  return DEFAULT_RULES.find(rule => rule.type === type);
}

/**
 * Get severity from risk score
 */
export function getSeverityFromScore(score: number): AlertSeverity {
  if (score >= SEVERITY_THRESHOLDS.CRITICAL) return 'CRITICAL';
  if (score >= SEVERITY_THRESHOLDS.WARNING) return 'WARNING';
  return 'INFO';
}

/**
 * Check if status transition is valid
 */
export function isValidStatusTransition(from: string, to: string): boolean {
  const validTransitions = STATUS_TRANSITIONS[from];
  return validTransitions ? validTransitions.includes(to) : false;
}
