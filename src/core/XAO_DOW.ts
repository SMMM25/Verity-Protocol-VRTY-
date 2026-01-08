/**
 * Verity Protocol - XAO-DOW (XLS-39D) Implementation
 * Verifiable Clawback for Compliance on XRPL
 * 
 * XLS-39D enables issuers to reclaim tokens under specific regulatory
 * circumstances while maintaining full transparency and governance.
 */

import { Wallet, AccountSetAsfFlags, Payment, TrustSet } from 'xrpl';
import { XRPLClient, TransactionResult } from './XRPLClient.js';
import { logger, logAuditAction } from '../utils/logger.js';
import { encodeMemoData, generateVerificationHash, generateId } from '../utils/crypto.js';
import type {
  ClawbackConfig,
  ClawbackReason,
  ClawbackExecution,
  GovernanceApproval,
  AssetConfig,
  AssetVerification,
} from '../types/index.js';

// XLS-39D Flag Constants
const ASF_ALLOW_TRUSTLINE_CLAWBACK = 16; // asfAllowTrustLineClawback
const TF_SET_NO_RIPPLE = 131072;

export interface VerifiedAssetIssuance {
  currencyCode: string;
  issuerAddress: string;
  transactionHash: string;
  verificationHash: string;
  clawbackEnabled: boolean;
  createdAt: Date;
}

export interface ClawbackTransaction {
  id: string;
  asset: string;
  issuer: string;
  fromWallet: string;
  amount: string;
  reason: ClawbackReason;
  legalJustification: string;
  governanceApprovals: GovernanceApproval[];
  status: 'pending' | 'approved' | 'executed' | 'rejected';
  transactionHash?: string;
  verificationHash: string;
  createdAt: Date;
  executedAt?: Date;
}

/**
 * XAO-DOW (XLS-39D) Clawback Manager
 * Manages the issuance of clawback-enabled assets and governance-controlled clawback execution
 */
export class VerityXAODOW {
  private xrplClient: XRPLClient;
  private issuerWallet: Wallet;
  private config: ClawbackConfig;
  private pendingClawbacks: Map<string, ClawbackTransaction> = new Map();
  private governanceSigners: string[] = [];

  constructor(
    xrplClient: XRPLClient,
    issuerWallet: Wallet,
    config: ClawbackConfig
  ) {
    this.xrplClient = xrplClient;
    this.issuerWallet = issuerWallet;
    this.config = config;
    
    logger.info('XAO-DOW module initialized', {
      issuer: issuerWallet.address,
      clawbackEnabled: config.enabled,
      governanceQuorum: config.governanceQuorum,
    });
  }

  /**
   * Set the governance committee signers
   */
  setGovernanceSigners(signers: string[]): void {
    this.governanceSigners = signers;
    logger.info(`Governance signers set: ${signers.length} signers`);
  }

  /**
   * Enable clawback capability on the issuer account
   * This must be done BEFORE any trust lines are created
   * WARNING: This is a one-way operation - cannot be disabled once trust lines exist
   */
  async enableClawback(): Promise<TransactionResult> {
    logger.info('Enabling clawback on issuer account...');

    const accountSetTx = {
      TransactionType: 'AccountSet' as const,
      Account: this.issuerWallet.address,
      SetFlag: ASF_ALLOW_TRUSTLINE_CLAWBACK,
    };

    const result = await this.xrplClient.submitAndWait(
      accountSetTx,
      this.issuerWallet
    );

    if (result.success) {
      logAuditAction('CLAWBACK_ENABLED', this.issuerWallet.address, {
        transactionHash: result.hash,
      });
      logger.info(`Clawback enabled successfully: ${result.hash}`);
    } else {
      logger.error(`Failed to enable clawback: ${result.error}`);
    }

    return result;
  }

  /**
   * Issue a verified asset with XAO-DOW clawback capability
   */
  async issueVerifiedAsset(
    assetConfig: AssetConfig
  ): Promise<VerifiedAssetIssuance> {
    logger.info(`Issuing verified asset: ${assetConfig.symbol}`);

    // Validate asset configuration
    this.validateAssetConfig(assetConfig);

    // Create verification data
    const verificationData = {
      name: assetConfig.name,
      symbol: assetConfig.symbol,
      totalSupply: assetConfig.totalSupply,
      classification: assetConfig.classification,
      category: assetConfig.category,
      clawbackEnabled: assetConfig.clawbackEnabled,
      jurisdiction: assetConfig.compliance.jurisdiction,
      requiresKYC: assetConfig.compliance.requiresKYC,
      verificationLevel: assetConfig.verification.complianceLevel,
      issuedAt: new Date().toISOString(),
    };

    const verificationHash = generateVerificationHash(verificationData);

    // Build the AccountSet transaction with domain and memos
    const accountSetTx = {
      TransactionType: 'AccountSet' as const,
      Account: this.issuerWallet.address,
      // Set transfer rate if specified (1000000000 = 0%, 2000000000 = 100% fee)
      TransferRate: assetConfig.transferRate 
        ? 1000000000 + (assetConfig.transferRate * 10000000)
        : undefined,
      Domain: assetConfig.verification.verificationDomain
        ? Buffer.from(assetConfig.verification.verificationDomain).toString('hex').toUpperCase()
        : undefined,
      Memos: [
        {
          Memo: {
            MemoType: Buffer.from('VERITY_ASSET_ISSUANCE').toString('hex').toUpperCase(),
            MemoData: encodeMemoData({
              ...verificationData,
              verificationHash,
            }),
            MemoFormat: Buffer.from('application/json').toString('hex').toUpperCase(),
          },
        },
      ],
    };

    // Submit the configuration transaction
    const result = await this.xrplClient.submitAndWait(
      accountSetTx,
      this.issuerWallet
    );

    if (!result.success) {
      throw new Error(`Failed to configure asset issuer: ${result.error}`);
    }

    // Log the audit action
    logAuditAction('VERIFIED_ASSET_ISSUED', this.issuerWallet.address, {
      asset: assetConfig.symbol,
      classification: assetConfig.classification,
      transactionHash: result.hash,
      verificationHash,
    });

    logger.info(`Verified asset issued: ${assetConfig.symbol}`, {
      hash: result.hash,
      verificationHash,
    });

    return {
      currencyCode: this.formatCurrencyCode(assetConfig.symbol),
      issuerAddress: this.issuerWallet.address,
      transactionHash: result.hash,
      verificationHash,
      clawbackEnabled: assetConfig.clawbackEnabled,
      createdAt: new Date(),
    };
  }

  /**
   * Create a trust line with clawback awareness
   */
  async createTrustLine(
    holderWallet: Wallet,
    currencyCode: string,
    limit: string
  ): Promise<TransactionResult> {
    logger.info(`Creating trust line for ${currencyCode}`);

    const trustSetTx: TrustSet = {
      TransactionType: 'TrustSet',
      Account: holderWallet.address,
      LimitAmount: {
        currency: this.formatCurrencyCode(currencyCode),
        issuer: this.issuerWallet.address,
        value: limit,
      },
      Flags: TF_SET_NO_RIPPLE,
    };

    const result = await this.xrplClient.submitAndWait(
      trustSetTx,
      holderWallet
    );

    if (result.success) {
      logAuditAction('TRUST_LINE_CREATED', holderWallet.address, {
        currency: currencyCode,
        issuer: this.issuerWallet.address,
        limit,
        transactionHash: result.hash,
      });
    }

    return result;
  }

  /**
   * Transfer tokens from issuer to holder
   */
  async transferTokens(
    toAddress: string,
    currencyCode: string,
    amount: string,
    memo?: string
  ): Promise<TransactionResult> {
    logger.info(`Transferring ${amount} ${currencyCode} to ${toAddress}`);

    const paymentTx: Payment = {
      TransactionType: 'Payment',
      Account: this.issuerWallet.address,
      Destination: toAddress,
      Amount: {
        currency: this.formatCurrencyCode(currencyCode),
        issuer: this.issuerWallet.address,
        value: amount,
      },
      Memos: memo
        ? [
            {
              Memo: {
                MemoType: Buffer.from('VERITY_TRANSFER').toString('hex').toUpperCase(),
                MemoData: Buffer.from(memo).toString('hex').toUpperCase(),
                MemoFormat: Buffer.from('text/plain').toString('hex').toUpperCase(),
              },
            },
          ]
        : undefined,
    };

    const result = await this.xrplClient.submitAndWait(
      paymentTx,
      this.issuerWallet
    );

    if (result.success) {
      logAuditAction('TOKEN_TRANSFER', this.issuerWallet.address, {
        to: toAddress,
        currency: currencyCode,
        amount,
        transactionHash: result.hash,
      });
    }

    return result;
  }

  /**
   * Initiate a clawback request (requires governance approval)
   */
  async initiateClawback(
    asset: string,
    fromWallet: string,
    amount: string,
    reason: ClawbackReason,
    legalJustification: string
  ): Promise<ClawbackTransaction> {
    logger.info(`Initiating clawback request for ${amount} ${asset} from ${fromWallet}`);

    // Validate the reason is allowed
    if (!this.config.allowedReasons.includes(reason)) {
      throw new Error(`Clawback reason '${reason}' is not allowed`);
    }

    // Create the clawback request
    const clawbackId = generateId('CLB');
    const clawbackData: ClawbackTransaction = {
      id: clawbackId,
      asset,
      issuer: this.issuerWallet.address,
      fromWallet,
      amount,
      reason,
      legalJustification,
      governanceApprovals: [],
      status: 'pending',
      verificationHash: generateVerificationHash({
        id: clawbackId,
        asset,
        fromWallet,
        amount,
        reason,
        legalJustification,
        timestamp: new Date().toISOString(),
      }),
      createdAt: new Date(),
    };

    this.pendingClawbacks.set(clawbackId, clawbackData);

    logAuditAction('CLAWBACK_INITIATED', this.issuerWallet.address, {
      clawbackId,
      asset,
      fromWallet,
      amount,
      reason,
    });

    logger.info(`Clawback request created: ${clawbackId}`, {
      requiredApprovals: this.config.governanceQuorum,
    });

    return clawbackData;
  }

  /**
   * Add governance approval to a pending clawback
   */
  addGovernanceApproval(
    clawbackId: string,
    signer: string,
    signature: string,
    approved: boolean
  ): ClawbackTransaction {
    const clawback = this.pendingClawbacks.get(clawbackId);
    if (!clawback) {
      throw new Error(`Clawback ${clawbackId} not found`);
    }

    if (clawback.status !== 'pending') {
      throw new Error(`Clawback ${clawbackId} is not pending`);
    }

    // Verify signer is in governance committee
    if (!this.governanceSigners.includes(signer)) {
      throw new Error(`${signer} is not a governance signer`);
    }

    // Check if already voted
    if (clawback.governanceApprovals.some((a) => a.signer === signer)) {
      throw new Error(`${signer} has already voted on this clawback`);
    }

    // Add the approval
    const approval: GovernanceApproval = {
      signer,
      signature,
      timestamp: new Date(),
      approved,
    };
    clawback.governanceApprovals.push(approval);

    // Check if quorum is reached
    const approvalCount = clawback.governanceApprovals.filter(
      (a) => a.approved
    ).length;
    const rejectionCount = clawback.governanceApprovals.filter(
      (a) => !a.approved
    ).length;

    if (approvalCount >= this.config.governanceQuorum) {
      clawback.status = 'approved';
      logger.info(`Clawback ${clawbackId} approved by governance`);
    } else if (rejectionCount > this.governanceSigners.length - this.config.governanceQuorum) {
      clawback.status = 'rejected';
      logger.info(`Clawback ${clawbackId} rejected by governance`);
    }

    logAuditAction('CLAWBACK_VOTE', signer, {
      clawbackId,
      approved,
      currentApprovals: approvalCount,
      requiredApprovals: this.config.governanceQuorum,
    });

    return clawback;
  }

  /**
   * Execute an approved clawback
   */
  async executeClawback(clawbackId: string): Promise<TransactionResult> {
    const clawback = this.pendingClawbacks.get(clawbackId);
    if (!clawback) {
      throw new Error(`Clawback ${clawbackId} not found`);
    }

    if (clawback.status !== 'approved') {
      throw new Error(`Clawback ${clawbackId} is not approved`);
    }

    logger.info(`Executing clawback: ${clawbackId}`);

    // Build the Clawback transaction
    const clawbackTx = {
      TransactionType: 'Clawback' as const,
      Account: this.issuerWallet.address,
      Amount: {
        currency: this.formatCurrencyCode(clawback.asset),
        issuer: clawback.fromWallet, // Note: In Clawback, the issuer field is the holder
        value: clawback.amount,
      },
      Memos: [
        {
          Memo: {
            MemoType: Buffer.from('CLAWBACK_JUSTIFICATION').toString('hex').toUpperCase(),
            MemoData: encodeMemoData({
              clawbackId: clawback.id,
              reason: clawback.reason,
              legalJustification: clawback.legalJustification,
              verificationHash: clawback.verificationHash,
              approvals: clawback.governanceApprovals.map((a) => ({
                signer: a.signer,
                timestamp: a.timestamp.toISOString(),
              })),
            }),
            MemoFormat: Buffer.from('application/json').toString('hex').toUpperCase(),
          },
        },
      ],
    };

    const result = await this.xrplClient.submitAndWait(
      clawbackTx,
      this.issuerWallet
    );

    if (result.success) {
      clawback.status = 'executed';
      clawback.transactionHash = result.hash;
      clawback.executedAt = new Date();

      logAuditAction('CLAWBACK_EXECUTED', this.issuerWallet.address, {
        clawbackId,
        asset: clawback.asset,
        fromWallet: clawback.fromWallet,
        amount: clawback.amount,
        reason: clawback.reason,
        transactionHash: result.hash,
      });

      logger.info(`Clawback executed successfully: ${result.hash}`);
    } else {
      logger.error(`Clawback execution failed: ${result.error}`);
    }

    return result;
  }

  /**
   * Execute a verified clawback with full governance (convenience method)
   */
  async executeVerifiedClawback(
    asset: string,
    fromWallet: string,
    amount: string,
    legalReason: ClawbackReason,
    legalJustification: string,
    governanceApprovals: GovernanceApproval[]
  ): Promise<TransactionResult> {
    // Create the clawback request
    const clawback = await this.initiateClawback(
      asset,
      fromWallet,
      amount,
      legalReason,
      legalJustification
    );

    // Add all governance approvals
    for (const approval of governanceApprovals) {
      this.addGovernanceApproval(
        clawback.id,
        approval.signer,
        approval.signature,
        approval.approved
      );
    }

    // Check if approved
    const updatedClawback = this.pendingClawbacks.get(clawback.id);
    if (!updatedClawback || updatedClawback.status !== 'approved') {
      throw new Error('Clawback did not receive sufficient governance approvals');
    }

    // Execute the clawback
    return this.executeClawback(clawback.id);
  }

  /**
   * Get pending clawback requests
   */
  getPendingClawbacks(): ClawbackTransaction[] {
    return Array.from(this.pendingClawbacks.values()).filter(
      (c) => c.status === 'pending'
    );
  }

  /**
   * Get a specific clawback by ID
   */
  getClawback(clawbackId: string): ClawbackTransaction | undefined {
    return this.pendingClawbacks.get(clawbackId);
  }

  /**
   * Format currency code for XRPL
   */
  private formatCurrencyCode(code: string): string {
    if (code.length <= 3) {
      return code.toUpperCase();
    }
    // For longer codes, convert to 40-character hex
    const hex = Buffer.from(code, 'utf8').toString('hex').toUpperCase();
    return hex.padEnd(40, '0');
  }

  /**
   * Validate asset configuration
   */
  private validateAssetConfig(config: AssetConfig): void {
    if (!config.name || config.name.length < 1) {
      throw new Error('Asset name is required');
    }
    if (!config.symbol || config.symbol.length < 1) {
      throw new Error('Asset symbol is required');
    }
    if (!config.totalSupply || parseFloat(config.totalSupply) <= 0) {
      throw new Error('Total supply must be positive');
    }
    if (config.classification === 'VERIFIED' && !config.clawbackEnabled) {
      throw new Error('Verified assets must have clawback enabled');
    }
    if (config.classification === 'VERIFIED' && !config.compliance.requiresKYC) {
      throw new Error('Verified assets require KYC');
    }
  }
}

export default VerityXAODOW;
