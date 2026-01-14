/**
 * AI Sentinel v1 - Frontend TypeScript Definitions
 * Real-time fraud detection and compliance monitoring types
 * 
 * Verity Protocol - Platform Oversight Hub
 * Human-in-the-loop Guardian governance system
 */

// ============================================
// CORE ENUMS AND CONSTANTS
// ============================================

/**
 * Alert severity levels - determines urgency and response priority
 */
export const AlertSeverity = {
  INFO: 'INFO',
  WARNING: 'WARNING', 
  CRITICAL: 'CRITICAL'
} as const;
export type AlertSeverity = typeof AlertSeverity[keyof typeof AlertSeverity];

/**
 * Alert lifecycle status
 */
export const AlertStatus = {
  PENDING: 'PENDING',
  REVIEWING: 'REVIEWING',
  RESOLVED: 'RESOLVED',
  DISMISSED: 'DISMISSED',
  ESCALATED: 'ESCALATED'
} as const;
export type AlertStatus = typeof AlertStatus[keyof typeof AlertStatus];

/**
 * Actions that can be taken on alerts by Guardians
 */
export const AlertAction = {
  DISMISS: 'DISMISS',
  FLAG: 'FLAG',
  FREEZE: 'FREEZE',
  ESCALATE: 'ESCALATE',
  CLAWBACK_PROPOSAL: 'CLAWBACK_PROPOSAL'
} as const;
export type AlertAction = typeof AlertAction[keyof typeof AlertAction];

/**
 * Types of detection rules
 */
export const RuleType = {
  HIGH_VELOCITY: 'HIGH_VELOCITY',
  LARGE_TRANSFER: 'LARGE_TRANSFER',
  WASH_TRADING: 'WASH_TRADING',
  NEW_WALLET_LARGE: 'NEW_WALLET_LARGE',
  STRUCTURING: 'STRUCTURING',
  BRIDGE_ABUSE: 'BRIDGE_ABUSE',
  CLUSTER_ACTIVITY: 'CLUSTER_ACTIVITY',
  CUSTOM: 'CUSTOM'
} as const;
export type RuleType = typeof RuleType[keyof typeof RuleType];

/**
 * Network types for cross-chain monitoring
 */
export const NetworkType = {
  XRPL: 'XRPL',
  SOLANA: 'SOLANA',
  ETHEREUM: 'ETHEREUM'
} as const;
export type NetworkType = typeof NetworkType[keyof typeof NetworkType];

/**
 * Transaction direction
 */
export const TransactionDirection = {
  IN: 'IN',
  OUT: 'OUT'
} as const;
export type TransactionDirection = typeof TransactionDirection[keyof typeof TransactionDirection];

/**
 * Guardian role levels
 */
export const GuardianRole = {
  GUARDIAN: 'GUARDIAN',
  ADMIN: 'ADMIN',
  SUPER_ADMIN: 'SUPER_ADMIN'
} as const;
export type GuardianRole = typeof GuardianRole[keyof typeof GuardianRole];

/**
 * Time window presets for analysis
 */
export const TimeWindow = {
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000
} as const;
export type TimeWindow = typeof TimeWindow[keyof typeof TimeWindow];

// ============================================
// CORE DATA STRUCTURES
// ============================================

/**
 * Transaction data from analysis
 */
export interface AnalyzedTransaction {
  hash: string;
  from: string;
  to: string;
  amount: number;
  asset: string;
  timestamp: string;
  direction: TransactionDirection;
  network: NetworkType;
  metadata?: Record<string, unknown>;
}

/**
 * Pattern match evidence
 */
export interface PatternMatch {
  type: string;
  description: string;
  transactions: string[];
  timestamp: string;
  confidence?: number;
}

/**
 * Evidence gathered for an alert
 */
export interface AlertEvidence {
  transactionCount: number;
  transactionVolume: number;
  timeWindow: string;
  walletAge?: number;
  walletBalance?: number;
  linkedWallets?: string[];
  patternDescription: string;
  patternMatches?: PatternMatch[];
  rawData?: Record<string, unknown>;
}

/**
 * Audit log entry for Guardian actions
 */
export interface AuditEntry {
  action: AlertAction | string;
  actor: string;
  timestamp: string;
  details?: Record<string, unknown>;
  previousStatus?: AlertStatus;
  newStatus?: AlertStatus;
  reason?: string;
}

/**
 * Review data for an alert
 */
export interface AlertReview {
  reviewedBy: string;
  reviewedAt: string;
  resolution?: string;
  actionTaken?: AlertAction;
  notes?: string;
}

/**
 * Main alert structure
 */
export interface SentinelAlert {
  id: string;
  ruleType: RuleType;
  ruleName: string;
  severity: AlertSeverity;
  status: AlertStatus;
  primaryWallet: string;
  relatedWallets: string[];
  triggerTransactions: AnalyzedTransaction[];
  title: string;
  description: string;
  evidence: AlertEvidence;
  riskScore: number; // 0-100
  confidence: number; // 0-100
  detectedAt: string;
  reviewedAt?: string;
  resolvedAt?: string;
  review?: AlertReview;
  auditLog: AuditEntry[];
}

// ============================================
// RULE DEFINITIONS
// ============================================

/**
 * Rule thresholds
 */
export interface RuleThresholds {
  warningThreshold: number;
  criticalThreshold: number;
  riskScoreWeight: number;
}

/**
 * Rule-specific parameters
 */
export interface RuleParameters {
  // HIGH_VELOCITY
  maxTransactionsPerHour?: number;
  // LARGE_TRANSFER
  largeTransferThreshold?: number;
  // WASH_TRADING
  washTradingWindow?: string;
  minWashAmount?: number;
  // NEW_WALLET_LARGE
  newWalletAge?: string;
  newWalletThreshold?: number;
  // STRUCTURING
  structuringThreshold?: number;
  structuringWindow?: string;
  structuringMinCount?: number;
  // BRIDGE_ABUSE
  bridgeVelocityLimit?: number;
  bridgeAmountThreshold?: number;
  // CLUSTER_ACTIVITY
  clusterMinSize?: number;
  clusterTimeWindow?: string;
  // CUSTOM
  customLogic?: string;
}

/**
 * Rule definition
 */
export interface RuleDefinition {
  id: string;
  type: RuleType;
  name: string;
  description: string;
  enabled: boolean;
  severity: AlertSeverity;
  parameters: RuleParameters;
  thresholds: RuleThresholds;
  createdAt?: string;
  updatedAt?: string;
}

// ============================================
// WALLET PROFILES
// ============================================

/**
 * Wallet risk profile
 */
export interface WalletProfile {
  address: string;
  network: NetworkType;
  firstSeen: string;
  lastActive: string;
  totalTransactions: number;
  totalVolume: number;
  averageTransactionSize: number;
  riskScore: number;
  flagCount: number;
  alertCount: number;
  linkedWallets: string[];
  clusterScore: number;
  kycVerified: boolean;
  kycLevel?: string;
  tags?: string[];
}

/**
 * Velocity data for a wallet
 */
export interface VelocityData {
  wallet: string;
  period: string;
  transactionCount: number;
  totalVolume: number;
  averageAmount: number;
  uniqueCounterparties: number;
  timestamp: string;
}

// ============================================
// GUARDIAN SYSTEM
// ============================================

/**
 * Guardian permissions
 */
export interface GuardianPermissions {
  canDismiss: boolean;
  canFlag: boolean;
  canFreeze: boolean;
  canEscalate: boolean;
  canInitiateClawback: boolean;
}

/**
 * Guardian activity metrics
 */
export interface GuardianActivity {
  alertsReviewed: number;
  alertsDismissed: number;
  alertsEscalated: number;
  alertsFlagged: number;
  alertsFrozen: number;
  clawbacksInitiated: number;
  lastActive: string;
}

/**
 * Guardian definition
 */
export interface Guardian {
  wallet: string;
  name?: string;
  role: GuardianRole;
  permissions: GuardianPermissions;
  activity: GuardianActivity;
  registeredAt: string;
  isActive: boolean;
}

// ============================================
// STATISTICS AND METRICS
// ============================================

/**
 * Alert statistics by status
 */
export interface AlertStatusCounts {
  pending: number;
  reviewing: number;
  resolved: number;
  dismissed: number;
  escalated: number;
}

/**
 * Alert statistics by severity
 */
export interface AlertSeverityCounts {
  info: number;
  warning: number;
  critical: number;
}

/**
 * Alert statistics by rule type
 */
export interface AlertRuleTypeCounts {
  highVelocity: number;
  largeTransfer: number;
  washTrading: number;
  newWalletLarge: number;
  structuring: number;
  bridgeAbuse: number;
  clusterActivity: number;
  custom: number;
}

/**
 * Overall sentinel statistics
 */
export interface SentinelStats {
  totalAlerts: number;
  byStatus: AlertStatusCounts;
  bySeverity: AlertSeverityCounts;
  byRuleType: AlertRuleTypeCounts;
  transactionsProcessed: number;
  transactionsPerSecond: number;
  averageResponseTime: number;
  falsePositiveRate: number;
  truePositiveRate: number;
  actionsToday: number;
  periodStart: string;
  periodEnd: string;
}

/**
 * Real-time monitoring metrics
 */
export interface RealTimeMetrics {
  activeAlerts: number;
  criticalAlerts: number;
  transactionsMonitored: number;
  walletsTracked: number;
  guardianOnline: number;
  systemHealth: 'healthy' | 'degraded' | 'critical';
  lastUpdate: string;
}

// ============================================
// THREAT DETECTION
// ============================================

/**
 * Threat cluster - group of related suspicious wallets
 */
export interface ThreatCluster {
  id: string;
  wallets: string[];
  centerWallet: string;
  totalVolume: number;
  transactionCount: number;
  riskScore: number;
  detectedAt: string;
  lastActivity: string;
  status: 'active' | 'inactive' | 'neutralized';
  relatedAlerts: string[];
}

/**
 * Geographic threat indicator
 */
export interface GeoThreat {
  region: string;
  country?: string;
  alertCount: number;
  volumeAtRisk: number;
  primaryThreats: RuleType[];
  lastDetected: string;
}

/**
 * Threat timeline entry
 */
export interface ThreatTimelineEntry {
  timestamp: string;
  alertId: string;
  ruleType: RuleType;
  severity: AlertSeverity;
  wallet: string;
  amount: number;
  action?: AlertAction;
  resolved: boolean;
}

// ============================================
// CONFIGURATION
// ============================================

/**
 * Sentinel system configuration
 */
export interface SentinelConfig {
  enabled: boolean;
  batchSize: number;
  processingInterval: number;
  alertRetentionDays: number;
  maxPendingAlerts: number;
  webhookUrl?: string;
  emailRecipients?: string[];
  slackChannel?: string;
  rules: RuleDefinition[];
}

/**
 * Notification settings
 */
export interface NotificationSettings {
  email: boolean;
  slack: boolean;
  webhook: boolean;
  pushNotifications: boolean;
  severityThreshold: AlertSeverity;
  quietHours?: {
    start: string;
    end: string;
  };
}

// ============================================
// API TYPES
// ============================================

/**
 * Alert filter options
 */
export interface AlertFilter {
  status?: AlertStatus | AlertStatus[];
  severity?: AlertSeverity | AlertSeverity[];
  ruleType?: RuleType | RuleType[];
  wallet?: string;
  startDate?: string;
  endDate?: string;
  minRiskScore?: number;
  maxRiskScore?: number;
  page?: number;
  limit?: number;
  sortBy?: 'detectedAt' | 'riskScore' | 'severity';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Alert action request
 */
export interface AlertActionRequest {
  alertId: string;
  action: AlertAction;
  guardianWallet: string;
  reason?: string;
  notes?: string;
}

/**
 * Alert action response
 */
export interface AlertActionResponse {
  success: boolean;
  alert?: SentinelAlert;
  clawbackProposalId?: string;
  message?: string;
  error?: string;
}

/**
 * Paginated alerts response
 */
export interface AlertsListResponse {
  alerts: SentinelAlert[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Guardian registration request
 */
export interface GuardianRegistrationRequest {
  wallet: string;
  name?: string;
  role: GuardianRole;
}

/**
 * Rule update request
 */
export interface RuleUpdateRequest {
  ruleId: string;
  enabled?: boolean;
  parameters?: Partial<RuleParameters>;
  thresholds?: Partial<RuleThresholds>;
}

/**
 * System status response
 */
export interface SentinelStatusResponse {
  isRunning: boolean;
  queueSize: number;
  config: SentinelConfig;
  uptime: number;
  version: string;
}

// ============================================
// UI HELPER TYPES
// ============================================

/**
 * Dashboard view modes
 */
export const DashboardView = {
  OVERVIEW: 'overview',
  ALERTS: 'alerts',
  RULES: 'rules',
  GUARDIANS: 'guardians',
  THREATS: 'threats',
  ANALYTICS: 'analytics'
} as const;
export type DashboardView = typeof DashboardView[keyof typeof DashboardView];

/**
 * Alert card display data
 */
export interface AlertCardData {
  alert: SentinelAlert;
  isSelected: boolean;
  isExpanded: boolean;
  showActions: boolean;
}

/**
 * Rule card display data
 */
export interface RuleCardData {
  rule: RuleDefinition;
  alertCount: number;
  lastTriggered?: string;
  effectiveness: number; // percentage
}

/**
 * Guardian leaderboard entry
 */
export interface GuardianLeaderboardEntry {
  guardian: Guardian;
  rank: number;
  score: number;
  streak: number; // days active
}

// ============================================
// UI LABEL MAPPINGS
// ============================================

export const ALERT_SEVERITY_LABELS: Record<AlertSeverity, string> = {
  [AlertSeverity.INFO]: 'Informational',
  [AlertSeverity.WARNING]: 'Warning',
  [AlertSeverity.CRITICAL]: 'Critical'
};

export const ALERT_SEVERITY_COLORS: Record<AlertSeverity, string> = {
  [AlertSeverity.INFO]: 'blue',
  [AlertSeverity.WARNING]: 'yellow',
  [AlertSeverity.CRITICAL]: 'red'
};

export const ALERT_STATUS_LABELS: Record<AlertStatus, string> = {
  [AlertStatus.PENDING]: 'Pending Review',
  [AlertStatus.REVIEWING]: 'Under Review',
  [AlertStatus.RESOLVED]: 'Resolved',
  [AlertStatus.DISMISSED]: 'Dismissed',
  [AlertStatus.ESCALATED]: 'Escalated'
};

export const ALERT_STATUS_COLORS: Record<AlertStatus, string> = {
  [AlertStatus.PENDING]: 'yellow',
  [AlertStatus.REVIEWING]: 'blue',
  [AlertStatus.RESOLVED]: 'green',
  [AlertStatus.DISMISSED]: 'gray',
  [AlertStatus.ESCALATED]: 'red'
};

export const RULE_TYPE_LABELS: Record<RuleType, string> = {
  [RuleType.HIGH_VELOCITY]: 'High Transaction Velocity',
  [RuleType.LARGE_TRANSFER]: 'Large Transfer Detection',
  [RuleType.WASH_TRADING]: 'Wash Trading Pattern',
  [RuleType.NEW_WALLET_LARGE]: 'New Wallet Large Transfer',
  [RuleType.STRUCTURING]: 'Transaction Structuring',
  [RuleType.BRIDGE_ABUSE]: 'Cross-Chain Bridge Abuse',
  [RuleType.CLUSTER_ACTIVITY]: 'Coordinated Cluster Activity',
  [RuleType.CUSTOM]: 'Custom Rule'
};

export const RULE_TYPE_ICONS: Record<RuleType, string> = {
  [RuleType.HIGH_VELOCITY]: 'Zap',
  [RuleType.LARGE_TRANSFER]: 'DollarSign',
  [RuleType.WASH_TRADING]: 'RefreshCw',
  [RuleType.NEW_WALLET_LARGE]: 'UserPlus',
  [RuleType.STRUCTURING]: 'Layers',
  [RuleType.BRIDGE_ABUSE]: 'GitBranch',
  [RuleType.CLUSTER_ACTIVITY]: 'Users',
  [RuleType.CUSTOM]: 'Code'
};

export const ALERT_ACTION_LABELS: Record<AlertAction, string> = {
  [AlertAction.DISMISS]: 'Dismiss Alert',
  [AlertAction.FLAG]: 'Flag for Review',
  [AlertAction.FREEZE]: 'Freeze Wallet',
  [AlertAction.ESCALATE]: 'Escalate to Admin',
  [AlertAction.CLAWBACK_PROPOSAL]: 'Initiate Clawback'
};

export const GUARDIAN_ROLE_LABELS: Record<GuardianRole, string> = {
  [GuardianRole.GUARDIAN]: 'Guardian',
  [GuardianRole.ADMIN]: 'Admin',
  [GuardianRole.SUPER_ADMIN]: 'Super Admin'
};

export const NETWORK_LABELS: Record<NetworkType, string> = {
  [NetworkType.XRPL]: 'XRP Ledger',
  [NetworkType.SOLANA]: 'Solana',
  [NetworkType.ETHEREUM]: 'Ethereum'
};

// ============================================
// DEFAULT VALUES
// ============================================

export const DEFAULT_GUARDIAN_PERMISSIONS: Record<GuardianRole, GuardianPermissions> = {
  [GuardianRole.GUARDIAN]: {
    canDismiss: true,
    canFlag: true,
    canFreeze: false,
    canEscalate: true,
    canInitiateClawback: false
  },
  [GuardianRole.ADMIN]: {
    canDismiss: true,
    canFlag: true,
    canFreeze: true,
    canEscalate: true,
    canInitiateClawback: false
  },
  [GuardianRole.SUPER_ADMIN]: {
    canDismiss: true,
    canFlag: true,
    canFreeze: true,
    canEscalate: true,
    canInitiateClawback: true
  }
};

export const DEFAULT_ALERT_FILTER: AlertFilter = {
  page: 1,
  limit: 20,
  sortBy: 'detectedAt',
  sortOrder: 'desc'
};

// ============================================
// CLAWBACK TYPES (XLS-39D Integration)
// ============================================

/**
 * Clawback proposal status
 */
export const ClawbackStatus = {
  PROPOSED: 'PROPOSED',
  VOTING: 'VOTING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  EXECUTED: 'EXECUTED',
  CANCELLED: 'CANCELLED'
} as const;
export type ClawbackStatus = typeof ClawbackStatus[keyof typeof ClawbackStatus];

/**
 * Clawback proposal
 */
export interface ClawbackProposal {
  id: string;
  alertId: string;
  targetWallet: string;
  amount: number;
  asset: string;
  reason: string;
  evidence: AlertEvidence;
  proposedBy: string;
  proposedAt: string;
  status: ClawbackStatus;
  votes: {
    for: number;
    against: number;
    abstain: number;
  };
  votingEndsAt: string;
  executedAt?: string;
  transactionHash?: string;
}

/**
 * Clawback vote
 */
export interface ClawbackVote {
  proposalId: string;
  voter: string;
  vote: 'for' | 'against' | 'abstain';
  weight: number;
  timestamp: string;
  reason?: string;
}

// All types are already exported inline
