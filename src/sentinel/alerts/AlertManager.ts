/**
 * AI Sentinel v1 - Alert Manager
 * Manages alerts, reviews, and actions
 */

import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../db/index.js';
import {
  SentinelAlert,
  AlertStatus,
  AlertSeverity,
  AlertAction,
  AlertFilter,
  AlertActionRequest,
  AlertActionResponse,
  AlertAuditEntry,
  Guardian,
  SentinelStats,
  RuleType,
} from '../types.js';
import {
  isValidStatusTransition,
  GUARDIAN_PERMISSIONS,
} from '../config.js';
import { logger } from '../../utils/logger.js';

/**
 * Alert Manager - Handles alert lifecycle and actions
 */
export class AlertManager {
  private guardians: Map<string, Guardian> = new Map();
  private webhookUrl?: string;

  constructor(webhookUrl?: string) {
    this.webhookUrl = webhookUrl;
    logger.info('AlertManager initialized');
  }

  /**
   * Save alert to database
   */
  async saveAlert(alert: SentinelAlert): Promise<SentinelAlert> {
    try {
      const saved = await prisma.sentinelAlert.create({
        data: {
          id: alert.id,
          ruleType: alert.ruleType,
          ruleName: alert.ruleName,
          severity: alert.severity,
          status: alert.status,
          primaryWallet: alert.primaryWallet,
          relatedWallets: alert.relatedWallets,
          triggerTransactions: alert.triggerTransactions,
          title: alert.title,
          description: alert.description,
          evidence: alert.evidence as any,
          riskScore: alert.riskScore,
          confidence: alert.confidence,
          detectedAt: alert.detectedAt,
          auditLog: alert.auditLog as any,
        },
      });

      // Send notification
      await this.sendNotification(alert);

      logger.info(`Alert saved: ${alert.id} - ${alert.title}`);
      return this.mapToSentinelAlert(saved);
    } catch (error) {
      logger.error('Failed to save alert', { error, alertId: alert.id });
      throw error;
    }
  }

  /**
   * Get alerts with filters
   */
  async getAlerts(filter: AlertFilter): Promise<SentinelAlert[]> {
    try {
      const where: any = {};

      if (filter.status && filter.status.length > 0) {
        where.status = { in: filter.status };
      }
      if (filter.severity && filter.severity.length > 0) {
        where.severity = { in: filter.severity };
      }
      if (filter.ruleType && filter.ruleType.length > 0) {
        where.ruleType = { in: filter.ruleType };
      }
      if (filter.wallet) {
        where.OR = [
          { primaryWallet: filter.wallet },
          { relatedWallets: { has: filter.wallet } },
        ];
      }
      if (filter.dateFrom || filter.dateTo) {
        where.detectedAt = {};
        if (filter.dateFrom) where.detectedAt.gte = filter.dateFrom;
        if (filter.dateTo) where.detectedAt.lte = filter.dateTo;
      }

      const alerts = await prisma.sentinelAlert.findMany({
        where,
        orderBy: [
          { severity: 'desc' },
          { detectedAt: 'desc' },
        ],
        take: filter.limit || 50,
        skip: filter.offset || 0,
      });

      return alerts.map(a => this.mapToSentinelAlert(a));
    } catch (error) {
      logger.error('Failed to get alerts', { error, filter });
      throw error;
    }
  }

  /**
   * Get single alert by ID
   */
  async getAlert(alertId: string): Promise<SentinelAlert | null> {
    try {
      const alert = await prisma.sentinelAlert.findUnique({
        where: { id: alertId },
      });

      return alert ? this.mapToSentinelAlert(alert) : null;
    } catch (error) {
      logger.error('Failed to get alert', { error, alertId });
      throw error;
    }
  }

  /**
   * Process an action on an alert
   */
  async processAction(request: AlertActionRequest): Promise<AlertActionResponse> {
    const { alertId, action, guardianWallet, reason } = request;

    // Get the alert
    const alert = await this.getAlert(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    // Verify guardian permissions
    const guardian = this.guardians.get(guardianWallet);
    if (!guardian) {
      throw new Error(`Guardian not found: ${guardianWallet}`);
    }

    if (!this.hasPermission(guardian, action)) {
      throw new Error(`Guardian lacks permission for action: ${action}`);
    }

    // Determine new status based on action
    const newStatus = this.getNewStatus(alert.status, action);
    if (!isValidStatusTransition(alert.status, newStatus)) {
      throw new Error(`Invalid status transition: ${alert.status} → ${newStatus}`);
    }

    // Create audit entry
    const auditEntry: AlertAuditEntry = {
      action: `ACTION_${action}`,
      actor: guardianWallet,
      timestamp: new Date(),
      details: { reason, previousStatus: alert.status },
    };

    // Update alert
    const updatedAlert = await prisma.sentinelAlert.update({
      where: { id: alertId },
      data: {
        status: newStatus as any,
        reviewedAt: new Date(),
        reviewedBy: guardianWallet,
        resolution: reason,
        actionTaken: action,
        resolvedAt: ['RESOLVED', 'DISMISSED'].includes(newStatus) ? new Date() : undefined,
        auditLog: {
          push: auditEntry as any,
        },
      },
    });

    // Handle special actions
    let clawbackProposalId: string | undefined;

    if (action === 'FREEZE') {
      await this.handleFreezeAction(alert, guardianWallet, reason);
    } else if (action === 'CLAWBACK_PROPOSAL') {
      clawbackProposalId = await this.initiateClawbackProposal(alert, guardianWallet, reason);
    }

    // Log action
    await this.logGuardianAction(guardian, alertId, action);

    logger.info(`Alert action processed`, {
      alertId,
      action,
      newStatus,
      guardian: guardianWallet,
    });

    return {
      success: true,
      alertId,
      action,
      newStatus: newStatus as AlertStatus,
      timestamp: new Date(),
      clawbackProposalId,
    };
  }

  /**
   * Register a guardian
   */
  registerGuardian(guardian: Guardian): void {
    this.guardians.set(guardian.wallet, guardian);
    logger.info(`Guardian registered: ${guardian.wallet}`);
  }

  /**
   * Get guardian by wallet
   */
  getGuardian(wallet: string): Guardian | undefined {
    return this.guardians.get(wallet);
  }

  /**
   * Get sentinel statistics
   */
  async getStats(periodDays: number = 30): Promise<SentinelStats> {
    const periodStart = new Date();
    periodStart.setDate(periodStart.getDate() - periodDays);
    const periodEnd = new Date();

    try {
      // Get alert counts by status
      const alertsByStatus = await prisma.sentinelAlert.groupBy({
        by: ['status'],
        _count: { status: true },
        where: { detectedAt: { gte: periodStart } },
      });

      // Get alert counts by severity
      const alertsBySeverity = await prisma.sentinelAlert.groupBy({
        by: ['severity'],
        _count: { severity: true },
        where: { detectedAt: { gte: periodStart } },
      });

      // Get alert counts by rule type
      const alertsByRule = await prisma.sentinelAlert.groupBy({
        by: ['ruleType'],
        _count: { ruleType: true },
        where: { detectedAt: { gte: periodStart } },
      });

      // Get total alerts
      const totalAlerts = await prisma.sentinelAlert.count({
        where: { detectedAt: { gte: periodStart } },
      });

      // Get false positive rate (dismissed / total resolved)
      const dismissedCount = await prisma.sentinelAlert.count({
        where: {
          detectedAt: { gte: periodStart },
          status: 'DISMISSED',
        },
      });
      const resolvedCount = await prisma.sentinelAlert.count({
        where: {
          detectedAt: { gte: periodStart },
          status: { in: ['RESOLVED', 'DISMISSED'] },
        },
      });

      const statusMap: Record<AlertStatus, number> = {
        PENDING: 0,
        REVIEWING: 0,
        RESOLVED: 0,
        DISMISSED: 0,
        ESCALATED: 0,
      };
      alertsByStatus.forEach(s => {
        statusMap[s.status as AlertStatus] = s._count.status;
      });

      const severityMap: Record<AlertSeverity, number> = {
        INFO: 0,
        WARNING: 0,
        CRITICAL: 0,
      };
      alertsBySeverity.forEach(s => {
        severityMap[s.severity as AlertSeverity] = s._count.severity;
      });

      const ruleMap: Record<RuleType, number> = {
        HIGH_VELOCITY: 0,
        LARGE_TRANSFER: 0,
        WASH_TRADING: 0,
        NEW_WALLET_LARGE: 0,
        STRUCTURING: 0,
        BRIDGE_ABUSE: 0,
        CLUSTER_ACTIVITY: 0,
        CUSTOM: 0,
      };
      alertsByRule.forEach(r => {
        ruleMap[r.ruleType as RuleType] = r._count.ruleType;
      });

      return {
        totalAlerts,
        alertsByStatus: statusMap,
        alertsBySeverity: severityMap,
        alertsByRule: ruleMap,
        transactionsProcessed: 0, // Would need separate tracking
        averageProcessingTime: 0,
        actionsToday: 0, // Would need separate tracking
        falsePositiveRate: resolvedCount > 0 ? (dismissedCount / resolvedCount) * 100 : 0,
        periodStart,
        periodEnd,
      };
    } catch (error) {
      logger.error('Failed to get stats', { error });
      throw error;
    }
  }

  /**
   * Mark alert as reviewing
   */
  async startReview(alertId: string, guardianWallet: string): Promise<SentinelAlert> {
    const alert = await this.getAlert(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    if (alert.status !== 'PENDING') {
      throw new Error(`Alert is not pending: ${alert.status}`);
    }

    const auditEntry: AlertAuditEntry = {
      action: 'REVIEW_STARTED',
      actor: guardianWallet,
      timestamp: new Date(),
    };

    const updated = await prisma.sentinelAlert.update({
      where: { id: alertId },
      data: {
        status: 'REVIEWING',
        reviewedBy: guardianWallet,
        reviewedAt: new Date(),
        auditLog: {
          push: auditEntry as any,
        },
      },
    });

    return this.mapToSentinelAlert(updated);
  }

  /**
   * Check if guardian has permission for action
   */
  private hasPermission(guardian: Guardian, action: AlertAction): boolean {
    const permissions = GUARDIAN_PERMISSIONS[guardian.role];
    
    switch (action) {
      case 'DISMISS':
        return permissions.canDismiss;
      case 'FLAG':
        return permissions.canFlag;
      case 'FREEZE':
        return permissions.canFreeze;
      case 'ESCALATE':
        return permissions.canEscalate;
      case 'CLAWBACK_PROPOSAL':
        return permissions.canInitiateClawback;
      default:
        return false;
    }
  }

  /**
   * Get new status based on action
   */
  private getNewStatus(currentStatus: AlertStatus, action: AlertAction): string {
    switch (action) {
      case 'DISMISS':
        return 'DISMISSED';
      case 'FLAG':
      case 'FREEZE':
        return 'RESOLVED';
      case 'ESCALATE':
        return 'ESCALATED';
      case 'CLAWBACK_PROPOSAL':
        return 'RESOLVED';
      default:
        return currentStatus;
    }
  }

  /**
   * Handle freeze action - flags wallet for compliance review
   */
  private async handleFreezeAction(
    alert: SentinelAlert,
    guardianWallet: string,
    reason: string
  ): Promise<void> {
    // Log to audit
    await prisma.auditLog.create({
      data: {
        action: 'SENTINEL_FREEZE',
        actor: guardianWallet,
        entityType: 'WALLET',
        entityId: alert.primaryWallet,
        metadata: {
          alertId: alert.id,
          reason,
          relatedWallets: alert.relatedWallets,
        },
      },
    });

    logger.warn(`Wallet flagged for freeze: ${alert.primaryWallet}`, {
      alertId: alert.id,
      guardian: guardianWallet,
    });
  }

  /**
   * Initiate clawback proposal from alert
   */
  private async initiateClawbackProposal(
    alert: SentinelAlert,
    guardianWallet: string,
    reason: string
  ): Promise<string> {
    // This would integrate with the ComplianceOracle
    const proposalId = uuidv4();
    
    // Log to audit
    await prisma.auditLog.create({
      data: {
        action: 'SENTINEL_CLAWBACK_INITIATED',
        actor: guardianWallet,
        entityType: 'CLAWBACK_PROPOSAL',
        entityId: proposalId,
        metadata: {
          alertId: alert.id,
          wallet: alert.primaryWallet,
          reason,
          evidence: alert.evidence as any,
        },
      },
    });

    logger.info(`Clawback proposal initiated from alert`, {
      proposalId,
      alertId: alert.id,
      wallet: alert.primaryWallet,
    });

    return proposalId;
  }

  /**
   * Log guardian action
   */
  private async logGuardianAction(
    guardian: Guardian,
    alertId: string,
    action: AlertAction
  ): Promise<void> {
    guardian.alertsReviewed++;
    guardian.lastActive = new Date();
    this.guardians.set(guardian.wallet, guardian);
  }

  /**
   * Send notification for new alert
   */
  private async sendNotification(alert: SentinelAlert): Promise<void> {
    if (!this.webhookUrl) return;

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'SENTINEL_ALERT',
          alert: {
            id: alert.id,
            title: alert.title,
            severity: alert.severity,
            riskScore: alert.riskScore,
            wallet: alert.primaryWallet,
            detectedAt: alert.detectedAt,
          },
        }),
      });

      if (!response.ok) {
        logger.warn('Failed to send webhook notification', { status: response.status });
      }
    } catch (error) {
      logger.error('Error sending webhook notification', { error });
    }
  }

  /**
   * Map database record to SentinelAlert
   */
  private mapToSentinelAlert(record: any): SentinelAlert {
    return {
      id: record.id,
      ruleType: record.ruleType as RuleType,
      ruleName: record.ruleName,
      severity: record.severity as AlertSeverity,
      status: record.status as AlertStatus,
      primaryWallet: record.primaryWallet,
      relatedWallets: record.relatedWallets || [],
      triggerTransactions: record.triggerTransactions || [],
      title: record.title,
      description: record.description,
      evidence: record.evidence || {},
      riskScore: record.riskScore,
      confidence: record.confidence,
      detectedAt: record.detectedAt,
      reviewedAt: record.reviewedAt,
      resolvedAt: record.resolvedAt,
      reviewedBy: record.reviewedBy,
      resolution: record.resolution,
      actionTaken: record.actionTaken as AlertAction,
      auditLog: record.auditLog || [],
    };
  }
}

export default AlertManager;
