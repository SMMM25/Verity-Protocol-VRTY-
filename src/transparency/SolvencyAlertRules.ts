/**
 * Verity Protocol - Solvency Alert Rules for Sentinel
 * 
 * @description
 * Sentinel integration rules for monitoring solvency and transparency.
 * These rules trigger alerts when entities approach risk thresholds.
 * 
 * @version 1.0.0
 * @since 2026-01-17
 */

import { getTransparencyService, TransparencyReport, SolvencyStatus, RiskLevel } from './TransparencyService.js';
import { logger } from '../utils/logger.js';

// ============================================================
// TYPES
// ============================================================

export type SolvencyAlertType = 
  | 'COVERAGE_DROP'        // Coverage ratio dropped significantly
  | 'COVERAGE_WARNING'     // Coverage approaching threshold
  | 'COVERAGE_CRITICAL'    // Coverage below threshold
  | 'LARGE_OUTFLOW'        // Large asset outflow detected
  | 'CONCENTRATION_RISK'   // Asset concentration increased
  | 'SUDDEN_ISSUANCE'      // Sudden spike in token issuance
  | 'ESCROW_UNLOCK'        // Scheduled escrow unlock approaching
  | 'BRIDGE_IMBALANCE';    // Cross-chain bridge imbalance

export interface SolvencyAlert {
  id: string;
  type: SolvencyAlertType;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  entityId: string;
  entityName: string;
  
  title: string;
  description: string;
  
  // Metrics
  currentValue: number | string;
  threshold: number | string;
  previousValue?: number | string;
  changePercent?: number;
  
  // Evidence
  evidence: {
    ledgerIndex: number;
    timestamp: Date;
    addresses: string[];
    transactions?: string[];
  };
  
  // Status
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESOLVED';
  createdAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  
  // Actions
  recommendedActions: string[];
}

export interface SolvencyAlertRule {
  id: string;
  type: SolvencyAlertType;
  name: string;
  description: string;
  enabled: boolean;
  
  // Thresholds
  warningThreshold?: number;
  criticalThreshold?: number;
  
  // Check interval
  checkIntervalMs: number;
  
  // Entity filter (null = all entities)
  entityFilter?: string[];
}

// ============================================================
// DEFAULT RULES
// ============================================================

export const DEFAULT_SOLVENCY_RULES: SolvencyAlertRule[] = [
  {
    id: 'coverage-warning',
    type: 'COVERAGE_WARNING',
    name: 'Coverage Ratio Warning',
    description: 'Alert when coverage ratio drops below warning threshold',
    enabled: true,
    warningThreshold: 1.1,  // 110% coverage
    criticalThreshold: 1.0, // 100% coverage
    checkIntervalMs: 5 * 60 * 1000, // 5 minutes
  },
  {
    id: 'coverage-drop',
    type: 'COVERAGE_DROP',
    name: 'Sudden Coverage Drop',
    description: 'Alert when coverage ratio drops significantly in short period',
    enabled: true,
    warningThreshold: 10, // 10% drop
    criticalThreshold: 25, // 25% drop
    checkIntervalMs: 60 * 1000, // 1 minute
  },
  {
    id: 'large-outflow',
    type: 'LARGE_OUTFLOW',
    name: 'Large Asset Outflow',
    description: 'Alert when large amount of assets leave controlled wallets',
    enabled: true,
    warningThreshold: 5,  // 5% of total assets
    criticalThreshold: 15, // 15% of total assets
    checkIntervalMs: 60 * 1000, // 1 minute
  },
  {
    id: 'concentration-risk',
    type: 'CONCENTRATION_RISK',
    name: 'Asset Concentration Risk',
    description: 'Alert when single asset represents too much of total value',
    enabled: true,
    warningThreshold: 70, // 70% concentration
    criticalThreshold: 90, // 90% concentration
    checkIntervalMs: 15 * 60 * 1000, // 15 minutes
  },
  {
    id: 'sudden-issuance',
    type: 'SUDDEN_ISSUANCE',
    name: 'Sudden Token Issuance',
    description: 'Alert when issued supply increases rapidly',
    enabled: true,
    warningThreshold: 5,  // 5% increase in 1 hour
    criticalThreshold: 20, // 20% increase in 1 hour
    checkIntervalMs: 60 * 1000, // 1 minute
  },
];

// ============================================================
// ALERT SERVICE
// ============================================================

export class SolvencyAlertService {
  private rules: Map<string, SolvencyAlertRule> = new Map();
  private activeAlerts: Map<string, SolvencyAlert> = new Map();
  private previousReports: Map<string, { report: TransparencyReport; timestamp: Date }> = new Map();
  private checkIntervals: Map<string, NodeJS.Timeout> = new Map();
  
  constructor() {
    // Load default rules
    for (const rule of DEFAULT_SOLVENCY_RULES) {
      this.rules.set(rule.id, rule);
    }
  }
  
  /**
   * Start monitoring an entity
   */
  startMonitoring(entityId: string): void {
    const service = getTransparencyService();
    const entity = service.getEntity(entityId);
    
    if (!entity) {
      logger.warn(`Cannot start monitoring: entity ${entityId} not found`);
      return;
    }
    
    logger.info(`Starting solvency monitoring for entity: ${entityId}`);
    
    // Set up periodic checks for each enabled rule
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;
      if (rule.entityFilter && !rule.entityFilter.includes(entityId)) continue;
      
      const intervalKey = `${entityId}:${rule.id}`;
      
      // Clear existing interval if any
      if (this.checkIntervals.has(intervalKey)) {
        clearInterval(this.checkIntervals.get(intervalKey)!);
      }
      
      // Set up new interval
      const interval = setInterval(async () => {
        await this.checkRule(entityId, rule);
      }, rule.checkIntervalMs);
      
      this.checkIntervals.set(intervalKey, interval);
      
      // Run initial check
      this.checkRule(entityId, rule).catch(err => {
        logger.error(`Initial solvency check failed for ${entityId}:`, err);
      });
    }
  }
  
  /**
   * Stop monitoring an entity
   */
  stopMonitoring(entityId: string): void {
    logger.info(`Stopping solvency monitoring for entity: ${entityId}`);
    
    // Clear all intervals for this entity
    for (const [key, interval] of this.checkIntervals.entries()) {
      if (key.startsWith(`${entityId}:`)) {
        clearInterval(interval);
        this.checkIntervals.delete(key);
      }
    }
  }
  
  /**
   * Check a specific rule for an entity
   */
  private async checkRule(entityId: string, rule: SolvencyAlertRule): Promise<void> {
    try {
      const service = getTransparencyService();
      const report = await service.generateReport(entityId, true);
      
      const previousData = this.previousReports.get(entityId);
      
      let alert: SolvencyAlert | null = null;
      
      switch (rule.type) {
        case 'COVERAGE_WARNING':
        case 'COVERAGE_CRITICAL':
          alert = this.checkCoverageThreshold(entityId, report, rule);
          break;
        case 'COVERAGE_DROP':
          if (previousData) {
            alert = this.checkCoverageDrop(entityId, report, previousData.report, rule);
          }
          break;
        case 'LARGE_OUTFLOW':
          if (previousData) {
            alert = this.checkLargeOutflow(entityId, report, previousData.report, rule);
          }
          break;
        case 'CONCENTRATION_RISK':
          alert = this.checkConcentrationRisk(entityId, report, rule);
          break;
        case 'SUDDEN_ISSUANCE':
          if (previousData) {
            alert = this.checkSuddenIssuance(entityId, report, previousData.report, rule);
          }
          break;
      }
      
      if (alert) {
        this.raiseAlert(alert);
      }
      
      // Store report for comparison
      this.previousReports.set(entityId, { report, timestamp: new Date() });
      
    } catch (error) {
      logger.error(`Solvency check failed for ${entityId} (${rule.id}):`, error);
    }
  }
  
  /**
   * Check coverage ratio thresholds
   */
  private checkCoverageThreshold(
    entityId: string,
    report: TransparencyReport,
    rule: SolvencyAlertRule
  ): SolvencyAlert | null {
    const coverage = report.solvency.coverageRatio;
    
    if (coverage < (rule.criticalThreshold || 1.0)) {
      return this.createAlert(entityId, report, rule, 'CRITICAL', {
        currentValue: coverage,
        threshold: rule.criticalThreshold || 1.0,
        title: 'Critical: Coverage Below Minimum',
        description: `Coverage ratio (${coverage}x) is below critical threshold (${rule.criticalThreshold}x)`,
        recommendedActions: [
          'Immediately review asset holdings',
          'Consider reducing liabilities',
          'Investigate cause of low coverage',
        ],
      });
    }
    
    if (coverage < (rule.warningThreshold || 1.1)) {
      return this.createAlert(entityId, report, rule, 'WARNING', {
        currentValue: coverage,
        threshold: rule.warningThreshold || 1.1,
        title: 'Warning: Coverage Approaching Threshold',
        description: `Coverage ratio (${coverage}x) is approaching warning threshold (${rule.warningThreshold}x)`,
        recommendedActions: [
          'Monitor asset levels closely',
          'Prepare contingency plans',
        ],
      });
    }
    
    return null;
  }
  
  /**
   * Check for sudden coverage drop
   */
  private checkCoverageDrop(
    entityId: string,
    current: TransparencyReport,
    previous: TransparencyReport,
    rule: SolvencyAlertRule
  ): SolvencyAlert | null {
    const currentCoverage = current.solvency.coverageRatio;
    const previousCoverage = previous.solvency.coverageRatio;
    
    if (!isFinite(currentCoverage) || !isFinite(previousCoverage)) return null;
    
    const dropPercent = ((previousCoverage - currentCoverage) / previousCoverage) * 100;
    
    if (dropPercent >= (rule.criticalThreshold || 25)) {
      return this.createAlert(entityId, current, rule, 'CRITICAL', {
        currentValue: currentCoverage,
        threshold: rule.criticalThreshold || 25,
        previousValue: previousCoverage,
        changePercent: -dropPercent,
        title: 'Critical: Rapid Coverage Drop',
        description: `Coverage dropped ${dropPercent.toFixed(1)}% from ${previousCoverage}x to ${currentCoverage}x`,
        recommendedActions: [
          'Immediately investigate cause',
          'Verify all asset movements',
          'Check for unauthorized transactions',
        ],
      });
    }
    
    if (dropPercent >= (rule.warningThreshold || 10)) {
      return this.createAlert(entityId, current, rule, 'WARNING', {
        currentValue: currentCoverage,
        threshold: rule.warningThreshold || 10,
        previousValue: previousCoverage,
        changePercent: -dropPercent,
        title: 'Warning: Coverage Decreasing',
        description: `Coverage dropped ${dropPercent.toFixed(1)}% from ${previousCoverage}x to ${currentCoverage}x`,
        recommendedActions: [
          'Review recent asset movements',
          'Monitor trend closely',
        ],
      });
    }
    
    return null;
  }
  
  /**
   * Check for large asset outflows
   */
  private checkLargeOutflow(
    entityId: string,
    current: TransparencyReport,
    previous: TransparencyReport,
    rule: SolvencyAlertRule
  ): SolvencyAlert | null {
    // Compare XRP balances
    const currentXRP = current.assets.total.find(a => a.currency === 'XRP');
    const previousXRP = previous.assets.total.find(a => a.currency === 'XRP');
    
    if (!currentXRP || !previousXRP) return null;
    
    const currentBalance = parseFloat(currentXRP.balance);
    const previousBalance = parseFloat(previousXRP.balance);
    
    if (previousBalance === 0) return null;
    
    const outflowPercent = ((previousBalance - currentBalance) / previousBalance) * 100;
    
    if (outflowPercent >= (rule.criticalThreshold || 15)) {
      return this.createAlert(entityId, current, rule, 'CRITICAL', {
        currentValue: `${currentBalance} XRP`,
        threshold: `${rule.criticalThreshold}%`,
        previousValue: `${previousBalance} XRP`,
        changePercent: -outflowPercent,
        title: 'Critical: Large Asset Outflow',
        description: `${outflowPercent.toFixed(1)}% of XRP reserves have left controlled wallets`,
        recommendedActions: [
          'Verify all outgoing transactions',
          'Check for unauthorized access',
          'Review multi-sig approvals',
        ],
      });
    }
    
    return null;
  }
  
  /**
   * Check concentration risk
   */
  private checkConcentrationRisk(
    entityId: string,
    report: TransparencyReport,
    rule: SolvencyAlertRule
  ): SolvencyAlert | null {
    // Find highest concentration
    const totalXRP = report.assets.total
      .filter(a => a.currency === 'XRP')
      .reduce((sum, a) => sum + parseFloat(a.balance), 0);
    
    if (totalXRP === 0) return null;
    
    for (const asset of report.assets.total) {
      if (asset.currency === 'XRP') {
        const concentration = (parseFloat(asset.balance) / totalXRP) * 100;
        
        if (concentration >= (rule.criticalThreshold || 90)) {
          return this.createAlert(entityId, report, rule, 'CRITICAL', {
            currentValue: `${concentration.toFixed(1)}%`,
            threshold: `${rule.criticalThreshold}%`,
            title: 'Critical: High Asset Concentration',
            description: `Single asset represents ${concentration.toFixed(1)}% of total value`,
            recommendedActions: [
              'Consider diversifying reserves',
              'Review concentration policy',
            ],
          });
        }
      }
    }
    
    return null;
  }
  
  /**
   * Check for sudden token issuance
   */
  private checkSuddenIssuance(
    entityId: string,
    current: TransparencyReport,
    previous: TransparencyReport,
    rule: SolvencyAlertRule
  ): SolvencyAlert | null {
    // Compare issued supply in liabilities
    const currentIssued = current.liabilities.find(l => l.type === 'ISSUED_SUPPLY');
    const previousIssued = previous.liabilities.find(l => l.type === 'ISSUED_SUPPLY');
    
    if (!currentIssued || !previousIssued) return null;
    
    const currentAmount = parseFloat(currentIssued.amount);
    const previousAmount = parseFloat(previousIssued.amount);
    
    if (previousAmount === 0) return null;
    
    const increasePercent = ((currentAmount - previousAmount) / previousAmount) * 100;
    
    if (increasePercent >= (rule.criticalThreshold || 20)) {
      return this.createAlert(entityId, current, rule, 'CRITICAL', {
        currentValue: currentAmount.toString(),
        threshold: `${rule.criticalThreshold}%`,
        previousValue: previousAmount.toString(),
        changePercent: increasePercent,
        title: 'Critical: Sudden Token Issuance',
        description: `Issued supply increased ${increasePercent.toFixed(1)}% in short period`,
        recommendedActions: [
          'Verify issuance was authorized',
          'Review governance approvals',
          'Update public disclosure',
        ],
      });
    }
    
    return null;
  }
  
  /**
   * Create an alert object
   */
  private createAlert(
    entityId: string,
    report: TransparencyReport,
    rule: SolvencyAlertRule,
    severity: 'INFO' | 'WARNING' | 'CRITICAL',
    data: {
      currentValue: number | string;
      threshold: number | string;
      previousValue?: number | string;
      changePercent?: number;
      title: string;
      description: string;
      recommendedActions: string[];
    }
  ): SolvencyAlert {
    return {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: rule.type,
      severity,
      entityId,
      entityName: report.entityName,
      title: data.title,
      description: data.description,
      currentValue: data.currentValue,
      threshold: data.threshold,
      previousValue: data.previousValue,
      changePercent: data.changePercent,
      evidence: {
        ledgerIndex: report.ledgerState.ledgerIndex,
        timestamp: new Date(),
        addresses: report.addresses.map(a => a.address),
      },
      status: 'ACTIVE',
      createdAt: new Date(),
      recommendedActions: data.recommendedActions,
    };
  }
  
  /**
   * Raise an alert
   */
  private raiseAlert(alert: SolvencyAlert): void {
    // Check for duplicate active alerts
    const existingKey = `${alert.entityId}:${alert.type}`;
    const existing = this.activeAlerts.get(existingKey);
    
    if (existing && existing.status === 'ACTIVE') {
      // Update existing alert instead of creating duplicate
      logger.debug(`Updating existing ${alert.type} alert for ${alert.entityId}`);
      return;
    }
    
    this.activeAlerts.set(existingKey, alert);
    
    logger.warn(`SOLVENCY ALERT [${alert.severity}]: ${alert.title}`, {
      entityId: alert.entityId,
      type: alert.type,
      currentValue: alert.currentValue,
      threshold: alert.threshold,
    });
    
    // In production, this would:
    // 1. Store alert in database
    // 2. Send webhook notifications
    // 3. Send email/Discord alerts
    // 4. Update dashboard
  }
  
  /**
   * Get active alerts
   */
  getActiveAlerts(entityId?: string): SolvencyAlert[] {
    const alerts = Array.from(this.activeAlerts.values());
    if (entityId) {
      return alerts.filter(a => a.entityId === entityId && a.status === 'ACTIVE');
    }
    return alerts.filter(a => a.status === 'ACTIVE');
  }
  
  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    for (const alert of this.activeAlerts.values()) {
      if (alert.id === alertId) {
        alert.status = 'ACKNOWLEDGED';
        alert.acknowledgedAt = new Date();
        alert.acknowledgedBy = acknowledgedBy;
        return true;
      }
    }
    return false;
  }
  
  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    for (const alert of this.activeAlerts.values()) {
      if (alert.id === alertId) {
        alert.status = 'RESOLVED';
        alert.resolvedAt = new Date();
        return true;
      }
    }
    return false;
  }
}

// Singleton instance
let solvencyAlertService: SolvencyAlertService | null = null;

export function getSolvencyAlertService(): SolvencyAlertService {
  if (!solvencyAlertService) {
    solvencyAlertService = new SolvencyAlertService();
  }
  return solvencyAlertService;
}

export default SolvencyAlertService;
