/**
 * AI Sentinel v1 - Module Exports
 * Rules-based fraud detection with human-in-the-loop governance
 */

// Main service
export { SentinelService, getSentinelService } from './SentinelService.js';

// Rules engine
export { RulesEngine } from './rules/RulesEngine.js';

// Alert management
export { AlertManager } from './alerts/AlertManager.js';

// Configuration
export {
  DEFAULT_SENTINEL_CONFIG,
  DEFAULT_RULES,
  RISK_WEIGHTS,
  SEVERITY_THRESHOLDS,
  TIME_WINDOWS,
  GUARDIAN_PERMISSIONS,
  getRuleByType,
  getSeverityFromScore,
  isValidStatusTransition,
} from './config.js';

// Types
export type {
  AlertSeverity,
  AlertStatus,
  AlertAction,
  RuleType,
  TransactionDirection,
  AnalyzedTransaction,
  SentinelAlert,
  AlertEvidence,
  PatternMatch,
  AlertAuditEntry,
  RuleDefinition,
  RuleParameters,
  RuleThresholds,
  WalletProfile,
  VelocityData,
  SentinelConfig,
  SentinelStats,
  Guardian,
  AlertFilter,
  AlertActionRequest,
  AlertActionResponse,
} from './types.js';
