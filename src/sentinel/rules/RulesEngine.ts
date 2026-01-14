/**
 * AI Sentinel v1 - Rules Engine
 * Core rules processing engine for fraud detection
 */

import { v4 as uuidv4 } from 'uuid';
import {
  AnalyzedTransaction,
  SentinelAlert,
  RuleDefinition,
  RuleType,
  AlertSeverity,
  AlertEvidence,
  WalletProfile,
  VelocityData,
  PatternMatch,
} from '../types.js';
import {
  DEFAULT_RULES,
  RISK_WEIGHTS,
  getSeverityFromScore,
  TIME_WINDOWS,
} from '../config.js';
import { logger } from '../../utils/logger.js';

/**
 * Rules Engine - Processes transactions and generates alerts
 */
export class RulesEngine {
  private rules: RuleDefinition[];
  private walletProfiles: Map<string, WalletProfile> = new Map();
  private velocityCache: Map<string, VelocityData[]> = new Map();
  private transactionHistory: Map<string, AnalyzedTransaction[]> = new Map();
  private alerts: SentinelAlert[] = [];

  constructor(rules: RuleDefinition[] = DEFAULT_RULES) {
    this.rules = rules.filter(r => r.enabled);
    logger.info(`RulesEngine initialized with ${this.rules.length} active rules`);
  }

  /**
   * Process a batch of transactions
   */
  async processTransactions(transactions: AnalyzedTransaction[]): Promise<SentinelAlert[]> {
    const newAlerts: SentinelAlert[] = [];

    for (const tx of transactions) {
      // Update wallet profiles and history
      this.updateWalletProfile(tx);
      this.updateTransactionHistory(tx);
      this.updateVelocityCache(tx);

      // Check each rule
      for (const rule of this.rules) {
        const alert = await this.evaluateRule(rule, tx);
        if (alert) {
          newAlerts.push(alert);
          this.alerts.push(alert);
        }
      }
    }

    if (newAlerts.length > 0) {
      logger.info(`Generated ${newAlerts.length} new alerts from ${transactions.length} transactions`);
    }

    return newAlerts;
  }

  /**
   * Evaluate a single rule against a transaction
   */
  private async evaluateRule(
    rule: RuleDefinition,
    tx: AnalyzedTransaction
  ): Promise<SentinelAlert | null> {
    switch (rule.type) {
      case 'HIGH_VELOCITY':
        return this.checkHighVelocity(rule, tx);
      case 'LARGE_TRANSFER':
        return this.checkLargeTransfer(rule, tx);
      case 'WASH_TRADING':
        return this.checkWashTrading(rule, tx);
      case 'NEW_WALLET_LARGE':
        return this.checkNewWalletLarge(rule, tx);
      case 'STRUCTURING':
        return this.checkStructuring(rule, tx);
      case 'BRIDGE_ABUSE':
        return this.checkBridgeAbuse(rule, tx);
      case 'CLUSTER_ACTIVITY':
        return this.checkClusterActivity(rule, tx);
      default:
        return null;
    }
  }

  /**
   * Rule 1: High Velocity - >50 txs/hour from single wallet
   */
  private checkHighVelocity(
    rule: RuleDefinition,
    tx: AnalyzedTransaction
  ): SentinelAlert | null {
    const maxTxPerHour = rule.parameters.maxTransactionsPerHour || 50;
    const velocityData = this.getVelocityData(tx.from, 'HOUR');
    
    if (velocityData && velocityData.transactionCount >= maxTxPerHour) {
      const riskScore = Math.min(100, (velocityData.transactionCount / maxTxPerHour) * 50);
      
      return this.createAlert(rule, tx, {
        title: `High Transaction Velocity: ${velocityData.transactionCount} txs/hour`,
        description: `Wallet ${tx.from} has executed ${velocityData.transactionCount} transactions in the last hour, exceeding the threshold of ${maxTxPerHour}.`,
        evidence: {
          transactionCount: velocityData.transactionCount,
          transactionVolume: velocityData.totalVolume,
          timeWindow: '1 hour',
          patternDescription: 'Unusually high transaction frequency',
        },
        riskScore,
        relatedWallets: [],
      });
    }
    
    return null;
  }

  /**
   * Rule 2: Large Transfer - >100,000 VRTY single transaction
   */
  private checkLargeTransfer(
    rule: RuleDefinition,
    tx: AnalyzedTransaction
  ): SentinelAlert | null {
    const threshold = parseFloat(rule.parameters.largeTransferThreshold || '100000');
    const amount = parseFloat(tx.amount);
    
    if (amount >= threshold) {
      const riskScore = Math.min(100, (amount / threshold) * 40);
      const severity: AlertSeverity = amount >= threshold * 5 ? 'CRITICAL' : 'WARNING';
      
      return this.createAlert(rule, tx, {
        title: `Large Transfer: ${tx.amount} ${tx.asset}`,
        description: `Single transaction of ${tx.amount} ${tx.asset} from ${tx.from} to ${tx.to} exceeds threshold of ${threshold}.`,
        evidence: {
          transactionVolume: tx.amount,
          patternDescription: 'Large single transfer',
        },
        riskScore,
        severity,
        relatedWallets: [tx.to],
      });
    }
    
    return null;
  }

  /**
   * Rule 3: Wash Trading - A→B→A within 24 hours
   */
  private checkWashTrading(
    rule: RuleDefinition,
    tx: AnalyzedTransaction
  ): SentinelAlert | null {
    const windowHours = rule.parameters.washTradingWindow || 24;
    const minAmount = parseFloat(rule.parameters.minWashAmount || '1000');
    const amount = parseFloat(tx.amount);
    
    if (amount < minAmount) return null;
    
    // Get transaction history for the recipient
    const recipientHistory = this.transactionHistory.get(tx.to) || [];
    const windowMs = windowHours * TIME_WINDOWS.HOUR;
    const cutoff = new Date(tx.timestamp.getTime() - windowMs);
    
    // Look for reverse transactions (B→A) within window
    const reverseTransactions = recipientHistory.filter(
      prevTx => 
        prevTx.to === tx.from &&
        prevTx.timestamp >= cutoff &&
        parseFloat(prevTx.amount) >= minAmount * 0.9 && // Within 10% of original
        parseFloat(prevTx.amount) <= minAmount * 1.1
    );
    
    if (reverseTransactions.length > 0) {
      const riskScore = 75 + (reverseTransactions.length * 5);
      
      return this.createAlert(rule, tx, {
        title: `Wash Trading Pattern Detected`,
        description: `Circular transaction pattern detected: ${tx.from} ↔ ${tx.to}. Found ${reverseTransactions.length} reverse transaction(s) within ${windowHours} hours.`,
        evidence: {
          transactionCount: reverseTransactions.length + 1,
          transactionVolume: tx.amount,
          timeWindow: `${windowHours} hours`,
          patternDescription: 'Circular A→B→A transaction pattern',
          patternMatches: reverseTransactions.map(rt => ({
            type: 'REVERSE_TRANSACTION',
            description: `${rt.from} → ${rt.to}: ${rt.amount} ${rt.asset}`,
            transactions: [rt.hash],
            timestamp: rt.timestamp,
          })),
        },
        riskScore: Math.min(100, riskScore),
        severity: 'CRITICAL',
        relatedWallets: [tx.to],
      });
    }
    
    return null;
  }

  /**
   * Rule 4: New Wallet Large - <24h old wallet + >10,000 VRTY
   */
  private checkNewWalletLarge(
    rule: RuleDefinition,
    tx: AnalyzedTransaction
  ): SentinelAlert | null {
    const maxAgeHours = rule.parameters.newWalletAge || 24;
    const threshold = parseFloat(rule.parameters.newWalletThreshold || '10000');
    const amount = parseFloat(tx.amount);
    
    if (amount < threshold) return null;
    
    const profile = this.walletProfiles.get(tx.from);
    if (!profile) return null;
    
    const walletAgeMs = Date.now() - profile.firstSeen.getTime();
    const walletAgeHours = walletAgeMs / TIME_WINDOWS.HOUR;
    
    if (walletAgeHours <= maxAgeHours) {
      const riskScore = 50 + ((threshold / amount) * 20);
      
      return this.createAlert(rule, tx, {
        title: `New Wallet Large Transaction`,
        description: `Wallet ${tx.from} is only ${walletAgeHours.toFixed(1)} hours old and made a transaction of ${tx.amount} ${tx.asset}.`,
        evidence: {
          walletAge: `${walletAgeHours.toFixed(1)} hours`,
          transactionVolume: tx.amount,
          patternDescription: 'New wallet with large activity',
        },
        riskScore: Math.min(100, riskScore),
        relatedWallets: [tx.to],
      });
    }
    
    return null;
  }

  /**
   * Rule 5: Structuring - Multiple txs just below threshold
   */
  private checkStructuring(
    rule: RuleDefinition,
    tx: AnalyzedTransaction
  ): SentinelAlert | null {
    const threshold = parseFloat(rule.parameters.structuringThreshold || '9500');
    const windowHours = rule.parameters.structuringWindow || 24;
    const minCount = rule.parameters.structuringMinCount || 3;
    const amount = parseFloat(tx.amount);
    
    // Check if this transaction is just below threshold (within 10%)
    const lowerBound = threshold * 0.9;
    if (amount < lowerBound || amount > threshold * 1.05) return null;
    
    // Get recent transactions from this wallet
    const history = this.transactionHistory.get(tx.from) || [];
    const windowMs = windowHours * TIME_WINDOWS.HOUR;
    const cutoff = new Date(tx.timestamp.getTime() - windowMs);
    
    // Count transactions just below threshold
    const structuringTxs = history.filter(
      prevTx => 
        prevTx.timestamp >= cutoff &&
        parseFloat(prevTx.amount) >= lowerBound &&
        parseFloat(prevTx.amount) <= threshold * 1.05
    );
    
    if (structuringTxs.length >= minCount - 1) { // -1 because current tx counts
      const totalAmount = structuringTxs.reduce(
        (sum, t) => sum + parseFloat(t.amount), 
        amount
      );
      const riskScore = 70 + (structuringTxs.length * 5);
      
      return this.createAlert(rule, tx, {
        title: `Transaction Structuring Detected`,
        description: `${structuringTxs.length + 1} transactions just below ${threshold} threshold from ${tx.from} within ${windowHours} hours. Total: ${totalAmount.toFixed(2)} ${tx.asset}`,
        evidence: {
          transactionCount: structuringTxs.length + 1,
          transactionVolume: totalAmount.toString(),
          timeWindow: `${windowHours} hours`,
          patternDescription: 'Multiple transactions just below reporting threshold',
          patternMatches: structuringTxs.map(st => ({
            type: 'STRUCTURING_TRANSACTION',
            description: `${st.amount} ${st.asset}`,
            transactions: [st.hash],
            timestamp: st.timestamp,
          })),
        },
        riskScore: Math.min(100, riskScore),
        severity: 'CRITICAL',
        relatedWallets: [...new Set(structuringTxs.map(t => t.to))],
      });
    }
    
    return null;
  }

  /**
   * Rule 6: Bridge Abuse - Suspicious cross-chain activity
   */
  private checkBridgeAbuse(
    rule: RuleDefinition,
    tx: AnalyzedTransaction
  ): SentinelAlert | null {
    // Check if this is a bridge transaction (metadata should indicate)
    if (!tx.metadata?.['isBridgeTransaction']) return null;
    
    const velocityLimit = rule.parameters.bridgeVelocityLimit || 10;
    const amountThreshold = parseFloat(rule.parameters.bridgeAmountThreshold || '50000');
    
    // Get bridge transactions for this wallet
    const history = this.transactionHistory.get(tx.from) || [];
    const hourAgo = new Date(Date.now() - TIME_WINDOWS.HOUR);
    
    const bridgeTxs = history.filter(
      t => t.metadata?.['isBridgeTransaction'] && t.timestamp >= hourAgo
    );
    
    const amount = parseFloat(tx.amount);
    
    if (bridgeTxs.length >= velocityLimit || amount >= amountThreshold) {
      const riskScore = Math.max(
        (bridgeTxs.length / velocityLimit) * 50,
        (amount / amountThreshold) * 50
      );
      
      return this.createAlert(rule, tx, {
        title: `Bridge Abuse Pattern Detected`,
        description: `Suspicious bridge activity from ${tx.from}: ${bridgeTxs.length + 1} bridge transactions in last hour, amount: ${tx.amount} ${tx.asset}`,
        evidence: {
          transactionCount: bridgeTxs.length + 1,
          transactionVolume: tx.amount,
          timeWindow: '1 hour',
          patternDescription: 'High frequency or large amount bridge transactions',
        },
        riskScore: Math.min(100, riskScore),
        relatedWallets: [],
      });
    }
    
    return null;
  }

  /**
   * Rule 7: Cluster Activity - Coordinated linked wallet activity
   */
  private checkClusterActivity(
    rule: RuleDefinition,
    tx: AnalyzedTransaction
  ): SentinelAlert | null {
    const minClusterSize = rule.parameters.clusterMinSize || 3;
    const timeWindowHours = rule.parameters.clusterTimeWindow || 1;
    
    const profile = this.walletProfiles.get(tx.from);
    if (!profile || profile.linkedWallets.length < minClusterSize - 1) return null;
    
    const windowMs = timeWindowHours * TIME_WINDOWS.HOUR;
    const cutoff = new Date(tx.timestamp.getTime() - windowMs);
    
    // Check activity from linked wallets
    let activeLinkedWallets = 0;
    const clusterTransactions: AnalyzedTransaction[] = [];
    
    for (const linkedWallet of profile.linkedWallets) {
      const linkedHistory = this.transactionHistory.get(linkedWallet) || [];
      const recentTxs = linkedHistory.filter(t => t.timestamp >= cutoff);
      
      if (recentTxs.length > 0) {
        activeLinkedWallets++;
        clusterTransactions.push(...recentTxs);
      }
    }
    
    if (activeLinkedWallets >= minClusterSize - 1) {
      const totalVolume = clusterTransactions.reduce(
        (sum, t) => sum + parseFloat(t.amount), 
        parseFloat(tx.amount)
      );
      const riskScore = 60 + (activeLinkedWallets * 10);
      
      return this.createAlert(rule, tx, {
        title: `Cluster Activity Detected`,
        description: `Coordinated activity from wallet cluster: ${activeLinkedWallets + 1} linked wallets active within ${timeWindowHours} hour(s).`,
        evidence: {
          transactionCount: clusterTransactions.length + 1,
          transactionVolume: totalVolume.toString(),
          timeWindow: `${timeWindowHours} hour(s)`,
          linkedWallets: profile.linkedWallets,
          patternDescription: 'Coordinated activity from linked wallet cluster',
        },
        riskScore: Math.min(100, riskScore),
        relatedWallets: profile.linkedWallets,
      });
    }
    
    return null;
  }

  /**
   * Create an alert from rule evaluation
   */
  private createAlert(
    rule: RuleDefinition,
    tx: AnalyzedTransaction,
    params: {
      title: string;
      description: string;
      evidence: AlertEvidence;
      riskScore: number;
      severity?: AlertSeverity;
      relatedWallets: string[];
    }
  ): SentinelAlert {
    const severity = params.severity || getSeverityFromScore(params.riskScore);
    
    return {
      id: uuidv4(),
      ruleType: rule.type,
      ruleName: rule.name,
      severity,
      status: 'PENDING',
      primaryWallet: tx.from,
      relatedWallets: params.relatedWallets,
      triggerTransactions: [tx.hash],
      title: params.title,
      description: params.description,
      evidence: params.evidence,
      riskScore: params.riskScore,
      confidence: this.calculateConfidence(rule, params.evidence),
      detectedAt: new Date(),
      auditLog: [{
        action: 'ALERT_CREATED',
        actor: 'SENTINEL',
        timestamp: new Date(),
        details: { ruleId: rule.id, transactionHash: tx.hash },
      }],
    };
  }

  /**
   * Calculate confidence score for an alert
   */
  private calculateConfidence(rule: RuleDefinition, evidence: AlertEvidence): number {
    let confidence = 50; // Base confidence
    
    // Increase confidence based on evidence strength
    if (evidence.transactionCount && evidence.transactionCount > 3) {
      confidence += 15;
    }
    if (evidence.patternMatches && evidence.patternMatches.length > 0) {
      confidence += 20;
    }
    if (evidence.linkedWallets && evidence.linkedWallets.length > 2) {
      confidence += 10;
    }
    
    return Math.min(100, confidence);
  }

  /**
   * Update wallet profile with new transaction
   */
  private updateWalletProfile(tx: AnalyzedTransaction): void {
    const profile = this.walletProfiles.get(tx.from) || {
      address: tx.from,
      network: tx.network,
      firstSeen: tx.timestamp,
      lastActive: tx.timestamp,
      totalTransactions: 0,
      totalVolume: '0',
      averageTransactionSize: '0',
      riskScore: 0,
      flagCount: 0,
      alertCount: 0,
      linkedWallets: [],
      clusterScore: 0,
      kycVerified: false,
    };

    profile.lastActive = tx.timestamp;
    profile.totalTransactions++;
    profile.totalVolume = (parseFloat(profile.totalVolume) + parseFloat(tx.amount)).toString();
    profile.averageTransactionSize = (
      parseFloat(profile.totalVolume) / profile.totalTransactions
    ).toString();

    // Add recipient to linked wallets if not already there
    if (!profile.linkedWallets.includes(tx.to)) {
      profile.linkedWallets.push(tx.to);
    }

    this.walletProfiles.set(tx.from, profile);
  }

  /**
   * Update transaction history
   */
  private updateTransactionHistory(tx: AnalyzedTransaction): void {
    const history = this.transactionHistory.get(tx.from) || [];
    history.push(tx);
    
    // Keep only last 1000 transactions per wallet
    if (history.length > 1000) {
      history.shift();
    }
    
    this.transactionHistory.set(tx.from, history);
  }

  /**
   * Update velocity cache
   */
  private updateVelocityCache(tx: AnalyzedTransaction): void {
    const velocityData = this.velocityCache.get(tx.from) || [];
    
    velocityData.push({
      wallet: tx.from,
      period: 'HOUR',
      transactionCount: 1,
      totalVolume: tx.amount,
      averageAmount: tx.amount,
      uniqueCounterparties: 1,
      timestamp: tx.timestamp,
    });
    
    // Clean old entries (older than 24 hours)
    const dayAgo = new Date(Date.now() - TIME_WINDOWS.DAY);
    const filtered = velocityData.filter(v => v.timestamp >= dayAgo);
    
    this.velocityCache.set(tx.from, filtered);
  }

  /**
   * Get velocity data for a wallet
   */
  private getVelocityData(wallet: string, period: 'HOUR' | 'DAY'): VelocityData | null {
    const data = this.velocityCache.get(wallet);
    if (!data || data.length === 0) return null;
    
    const windowMs = period === 'HOUR' ? TIME_WINDOWS.HOUR : TIME_WINDOWS.DAY;
    const cutoff = new Date(Date.now() - windowMs);
    const relevantData = data.filter(v => v.timestamp >= cutoff);
    
    if (relevantData.length === 0) return null;
    
    const totalVolume = relevantData.reduce((sum, v) => sum + parseFloat(v.totalVolume), 0);
    const counterparties = new Set(relevantData.map(v => v.wallet));
    
    return {
      wallet,
      period,
      transactionCount: relevantData.length,
      totalVolume: totalVolume.toString(),
      averageAmount: (totalVolume / relevantData.length).toString(),
      uniqueCounterparties: counterparties.size,
      timestamp: new Date(),
    };
  }

  /**
   * Get all pending alerts
   */
  getAlerts(status?: string): SentinelAlert[] {
    if (status) {
      return this.alerts.filter(a => a.status === status);
    }
    return this.alerts;
  }

  /**
   * Get alert by ID
   */
  getAlert(id: string): SentinelAlert | undefined {
    return this.alerts.find(a => a.id === id);
  }

  /**
   * Get wallet profile
   */
  getWalletProfile(address: string): WalletProfile | undefined {
    return this.walletProfiles.get(address);
  }

  /**
   * Link wallets (for cluster detection)
   */
  linkWallets(wallet1: string, wallet2: string): void {
    const profile1 = this.walletProfiles.get(wallet1);
    const profile2 = this.walletProfiles.get(wallet2);
    
    if (profile1 && !profile1.linkedWallets.includes(wallet2)) {
      profile1.linkedWallets.push(wallet2);
    }
    if (profile2 && !profile2.linkedWallets.includes(wallet1)) {
      profile2.linkedWallets.push(wallet1);
    }
  }

  /**
   * Get rules
   */
  getRules(): RuleDefinition[] {
    return this.rules;
  }

  /**
   * Enable/disable a rule
   */
  setRuleEnabled(ruleId: string, enabled: boolean): boolean {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      rule.enabled = enabled;
      return true;
    }
    return false;
  }
}

export default RulesEngine;
