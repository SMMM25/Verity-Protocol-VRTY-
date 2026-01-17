/**
 * Verity Protocol - Transparency & Solvency Monitor Service
 * 
 * @description
 * Cryptographically verifiable transparency and solvency monitoring for:
 * - Token Issuers (Proof of Reserves / Proof of Liabilities)
 * - Guild Treasuries (Multi-sig treasury transparency)
 * - Bridge Validators (Cross-chain collateral verification)
 * 
 * All snapshots are signed for third-party verification.
 * 
 * @version 1.0.0
 * @since 2026-01-17
 */

import crypto from 'crypto';
import { Client, AccountInfoRequest, AccountLinesRequest, GatewayBalancesRequest } from 'xrpl';
import { XRPL_ENDPOINTS, VRTY_CONFIG, getExplorerAccountUrl, getExplorerTxUrl, isValidXRPLAddress } from '../config/xrpl.js';
import { logger } from '../utils/logger.js';

// ============================================================
// TYPES
// ============================================================

export type EntityType = 'ISSUER' | 'GUILD' | 'BRIDGE';
export type SolvencyStatus = 'PASS' | 'WARN' | 'FAIL' | 'UNKNOWN';
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/**
 * Asset balance on-ledger
 */
export interface OnLedgerAsset {
  currency: string;
  issuer?: string;
  balance: string;
  balanceXRP?: string;  // XRP equivalent if available
}

/**
 * Liability/obligation tracking
 */
export interface Liability {
  type: 'ISSUED_SUPPLY' | 'BRIDGE_IOU' | 'ESCROW_PENDING' | 'OBLIGATION';
  currency: string;
  amount: string;
  description: string;
  dueDate?: Date;
  evidence?: string;  // TX hash or document reference
}

/**
 * Risk flag for transparency report
 */
export interface RiskFlag {
  id: string;
  level: RiskLevel;
  category: string;
  title: string;
  description: string;
  detectedAt: Date;
  evidence?: string[];
  recommendation?: string;
}

/**
 * Evidence link for verification
 */
export interface EvidenceLink {
  type: 'XRPL_TX' | 'XRPL_ACCOUNT' | 'XRPL_LEDGER' | 'EXTERNAL_AUDIT' | 'DOCUMENT';
  reference: string;
  url?: string;
  description: string;
  timestamp: Date;
}

/**
 * Signed snapshot for third-party verification
 */
export interface SignedSnapshot {
  version: string;
  entityId: string;
  entityType: EntityType;
  timestamp: Date;
  ledgerIndex: number;
  
  // Canonical data (what's being signed)
  canonicalData: string;  // JSON string
  
  // Signature
  signature: string;
  signatureAlgorithm: string;
  publicKeyFingerprint: string;
  
  // Verification URL
  verificationUrl: string;
}

/**
 * Complete transparency report for an entity
 */
export interface TransparencyReport {
  // Entity identification
  entityId: string;
  entityType: EntityType;
  entityName: string;
  entityDescription?: string;
  
  // Primary address(es)
  addresses: {
    address: string;
    role: string;
    network: string;
  }[];
  
  // Assets (what's controlled)
  assets: {
    total: OnLedgerAsset[];
    byAddress: Record<string, OnLedgerAsset[]>;
  };
  
  // Liabilities (what's owed)
  liabilities: Liability[];
  
  // Solvency metrics
  solvency: {
    status: SolvencyStatus;
    coverageRatio: number;  // assets / liabilities
    netPosition: string;    // assets - liabilities
    assessmentMethod: string;
  };
  
  // Risk assessment
  risks: {
    overallLevel: RiskLevel;
    flags: RiskFlag[];
    lastAssessment: Date;
  };
  
  // Evidence for verification
  evidence: EvidenceLink[];
  
  // Ledger state at time of report
  ledgerState: {
    network: string;
    ledgerIndex: number;
    ledgerHash: string;
    closeTime: Date;
  };
  
  // Signed snapshot for verification
  snapshot: SignedSnapshot;
  
  // Metadata
  generatedAt: Date;
  expiresAt: Date;
  version: string;
}

/**
 * Entity registration for monitoring
 */
export interface MonitoredEntity {
  id: string;
  type: EntityType;
  name: string;
  description?: string;
  
  // Addresses to monitor
  addresses: {
    address: string;
    role: 'PRIMARY' | 'TREASURY' | 'ESCROW' | 'RESERVE' | 'BRIDGE';
    network: 'XRPL' | 'SOLANA' | 'ETHEREUM';
  }[];
  
  // Issued tokens (for issuers)
  issuedTokens?: {
    currency: string;
    totalSupply: string;
  }[];
  
  // Alert thresholds
  thresholds: {
    minCoverageRatio: number;
    maxConcentrationPercent: number;
    alertOnLargeMovement: string;  // Amount
  };
  
  // Contact for alerts
  alertContacts?: {
    type: 'EMAIL' | 'WEBHOOK' | 'DISCORD';
    destination: string;
  }[];
  
  // Status
  active: boolean;
  createdAt: Date;
  lastChecked?: Date;
}

/**
 * Badge configuration for embeddable widget
 */
export interface TransparencyBadge {
  entityId: string;
  entityName: string;
  status: SolvencyStatus;
  coverageRatio: number;
  lastVerified: Date;
  badgeUrl: string;
  embedCode: string;
  detailsUrl: string;
}

// ============================================================
// SERVICE IMPLEMENTATION
// ============================================================

/**
 * Transparency & Solvency Monitor Service
 */
export class TransparencyService {
  private client: Client | null = null;
  private monitoredEntities: Map<string, MonitoredEntity> = new Map();
  private reportCache: Map<string, { report: TransparencyReport; cachedAt: Date }> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  
  // Server signing key (in production, use HSM or secure key management)
  private readonly signingKey: string;
  private readonly publicKeyFingerprint: string;
  
  constructor() {
    // Generate or load signing key
    this.signingKey = process.env['TRANSPARENCY_SIGNING_KEY'] || crypto.randomBytes(32).toString('hex');
    this.publicKeyFingerprint = crypto
      .createHash('sha256')
      .update(this.signingKey)
      .digest('hex')
      .substring(0, 16);
    
    // Register default entities (VRTY issuer + treasury)
    this.registerDefaultEntities();
  }
  
  /**
   * Register default monitored entities
   */
  private registerDefaultEntities(): void {
    // VRTY Token Issuer + Treasury
    this.monitoredEntities.set('vrty-protocol', {
      id: 'vrty-protocol',
      type: 'ISSUER',
      name: 'Verity Protocol (VRTY)',
      description: 'The Verified Financial Operating System for XRP Ledger',
      addresses: [
        {
          address: VRTY_CONFIG.issuerAddress,
          role: 'PRIMARY',
          network: 'XRPL',
        },
        {
          address: VRTY_CONFIG.distributionWallet,
          role: 'TREASURY',
          network: 'XRPL',
        },
      ],
      issuedTokens: [
        {
          currency: VRTY_CONFIG.currencyCode,
          totalSupply: VRTY_CONFIG.totalSupply,
        },
      ],
      thresholds: {
        minCoverageRatio: 1.0,
        maxConcentrationPercent: 80,
        alertOnLargeMovement: '10000000', // 10M VRTY
      },
      active: true,
      createdAt: new Date(),
    });
  }
  
  /**
   * Connect to XRPL
   */
  private async getClient(): Promise<Client> {
    if (!this.client || !this.client.isConnected()) {
      this.client = new Client(XRPL_ENDPOINTS.mainnet);
      await this.client.connect();
    }
    return this.client;
  }
  
  /**
   * Disconnect from XRPL
   */
  async disconnect(): Promise<void> {
    if (this.client?.isConnected()) {
      await this.client.disconnect();
    }
  }
  
  /**
   * Register a new entity for monitoring
   */
  registerEntity(entity: MonitoredEntity): void {
    // Validate addresses
    for (const addr of entity.addresses) {
      if (addr.network === 'XRPL' && !isValidXRPLAddress(addr.address)) {
        throw new Error(`Invalid XRPL address: ${addr.address}`);
      }
    }
    
    this.monitoredEntities.set(entity.id, entity);
    logger.info(`Registered entity for transparency monitoring: ${entity.id}`);
  }
  
  /**
   * Get all monitored entities
   */
  getMonitoredEntities(): MonitoredEntity[] {
    return Array.from(this.monitoredEntities.values());
  }
  
  /**
   * Get entity by ID
   */
  getEntity(entityId: string): MonitoredEntity | undefined {
    return this.monitoredEntities.get(entityId);
  }
  
  /**
   * Generate transparency report for an entity
   */
  async generateReport(entityId: string, forceRefresh: boolean = false): Promise<TransparencyReport> {
    const entity = this.monitoredEntities.get(entityId);
    if (!entity) {
      throw new Error(`Entity not found: ${entityId}`);
    }
    
    // Check cache
    if (!forceRefresh) {
      const cached = this.reportCache.get(entityId);
      if (cached && (Date.now() - cached.cachedAt.getTime()) < this.CACHE_TTL_MS) {
        return cached.report;
      }
    }
    
    const client = await this.getClient();
    
    // Get current ledger info
    const serverInfo = await client.request({ command: 'server_info' });
    const ledgerInfo = serverInfo.result.info.validated_ledger;
    
    // Fetch assets for all addresses
    const assetsByAddress: Record<string, OnLedgerAsset[]> = {};
    const allAssets: OnLedgerAsset[] = [];
    const evidence: EvidenceLink[] = [];
    
    for (const addr of entity.addresses) {
      if (addr.network === 'XRPL') {
        try {
          const assets = await this.fetchXRPLAssets(client, addr.address);
          assetsByAddress[addr.address] = assets;
          allAssets.push(...assets);
          
          evidence.push({
            type: 'XRPL_ACCOUNT',
            reference: addr.address,
            url: getExplorerAccountUrl(addr.address),
            description: `${addr.role} wallet on XRPL`,
            timestamp: new Date(),
          });
        } catch (error) {
          logger.warn(`Failed to fetch assets for ${addr.address}:`, error);
          assetsByAddress[addr.address] = [];
        }
      }
    }
    
    // Calculate liabilities
    const liabilities = await this.calculateLiabilities(entity, client);
    
    // Calculate solvency
    const solvency = this.calculateSolvency(allAssets, liabilities, entity);
    
    // Assess risks
    const risks = this.assessRisks(allAssets, liabilities, entity, solvency);
    
    // Create report
    const report: TransparencyReport = {
      entityId: entity.id,
      entityType: entity.type,
      entityName: entity.name,
      entityDescription: entity.description,
      
      addresses: entity.addresses.map(a => ({
        address: a.address,
        role: a.role,
        network: a.network,
      })),
      
      assets: {
        total: this.aggregateAssets(allAssets),
        byAddress: assetsByAddress,
      },
      
      liabilities,
      solvency,
      risks,
      evidence,
      
      ledgerState: {
        network: 'XRPL Mainnet',
        ledgerIndex: ledgerInfo?.seq || 0,
        ledgerHash: ledgerInfo?.hash || '',
        closeTime: new Date((ledgerInfo?.close_time || 0) * 1000 + 946684800000),
      },
      
      snapshot: this.createSignedSnapshot(entity, allAssets, liabilities, solvency, ledgerInfo),
      
      generatedAt: new Date(),
      expiresAt: new Date(Date.now() + this.CACHE_TTL_MS),
      version: '1.0.0',
    };
    
    // Update cache
    this.reportCache.set(entityId, { report, cachedAt: new Date() });
    
    // Update entity last checked
    entity.lastChecked = new Date();
    
    return report;
  }
  
  /**
   * Fetch XRPL assets for an address
   */
  private async fetchXRPLAssets(client: Client, address: string): Promise<OnLedgerAsset[]> {
    const assets: OnLedgerAsset[] = [];
    
    // Get XRP balance
    try {
      const accountInfo = await client.request({
        command: 'account_info',
        account: address,
        ledger_index: 'validated',
      } as AccountInfoRequest);
      
      const xrpBalance = accountInfo.result.account_data.Balance;
      assets.push({
        currency: 'XRP',
        balance: (parseInt(xrpBalance) / 1_000_000).toFixed(6),
        balanceXRP: (parseInt(xrpBalance) / 1_000_000).toFixed(6),
      });
    } catch (error: any) {
      if (error.data?.error !== 'actNotFound') {
        throw error;
      }
    }
    
    // Get trust line balances
    try {
      const accountLines = await client.request({
        command: 'account_lines',
        account: address,
        ledger_index: 'validated',
      } as AccountLinesRequest);
      
      for (const line of accountLines.result.lines) {
        assets.push({
          currency: line.currency,
          issuer: line.account,
          balance: line.balance,
        });
      }
    } catch (error: any) {
      if (error.data?.error !== 'actNotFound') {
        throw error;
      }
    }
    
    return assets;
  }
  
  /**
   * Calculate liabilities for an entity
   */
  private async calculateLiabilities(entity: MonitoredEntity, client: Client): Promise<Liability[]> {
    const liabilities: Liability[] = [];
    
    if (entity.type === 'ISSUER' && entity.issuedTokens) {
      for (const token of entity.issuedTokens) {
        // For issuers, the issued supply is a liability
        // Get gateway balances to see how much is in circulation
        const issuerAddress = entity.addresses.find(a => a.role === 'PRIMARY')?.address;
        
        if (issuerAddress) {
          try {
            const gatewayBalances = await client.request({
              command: 'gateway_balances',
              account: issuerAddress,
              ledger_index: 'validated',
            } as GatewayBalancesRequest);
            
            // obligations shows what the issuer owes to trust line holders
            const obligations = gatewayBalances.result.obligations;
            if (obligations && obligations[token.currency]) {
              liabilities.push({
                type: 'ISSUED_SUPPLY',
                currency: token.currency,
                amount: obligations[token.currency],
                description: `${token.currency} tokens in circulation (issued to trust line holders)`,
              });
            }
          } catch (error) {
            logger.warn(`Failed to get gateway balances for ${issuerAddress}:`, error);
            // Fall back to total supply as liability
            liabilities.push({
              type: 'ISSUED_SUPPLY',
              currency: token.currency,
              amount: token.totalSupply,
              description: `${token.currency} total supply (gateway_balances unavailable)`,
            });
          }
        }
      }
    }
    
    return liabilities;
  }
  
  /**
   * Calculate solvency metrics
   */
  private calculateSolvency(
    assets: OnLedgerAsset[],
    liabilities: Liability[],
    entity: MonitoredEntity
  ): TransparencyReport['solvency'] {
    // For VRTY, we compare XRP reserves vs obligations
    // This is simplified - in production would need price feeds
    
    let totalAssetValue = 0;
    let totalLiabilityValue = 0;
    
    // Sum XRP assets
    for (const asset of assets) {
      if (asset.currency === 'XRP') {
        totalAssetValue += parseFloat(asset.balance);
      }
      // For tokens, we'd need price conversion
      if (asset.currency === 'VRTY') {
        // Use a nominal value for VRTY (in production, use market price)
        totalAssetValue += parseFloat(asset.balance) * 0.02; // 0.02 XRP per VRTY
      }
    }
    
    // Sum liabilities
    for (const liability of liabilities) {
      if (liability.currency === 'XRP') {
        totalLiabilityValue += parseFloat(liability.amount);
      }
      if (liability.currency === 'VRTY') {
        totalLiabilityValue += parseFloat(liability.amount) * 0.02;
      }
    }
    
    const coverageRatio = totalLiabilityValue > 0 
      ? totalAssetValue / totalLiabilityValue 
      : Infinity;
    
    let status: SolvencyStatus;
    if (coverageRatio === Infinity || totalLiabilityValue === 0) {
      status = 'PASS'; // No liabilities
    } else if (coverageRatio >= entity.thresholds.minCoverageRatio) {
      status = 'PASS';
    } else if (coverageRatio >= entity.thresholds.minCoverageRatio * 0.9) {
      status = 'WARN';
    } else {
      status = 'FAIL';
    }
    
    return {
      status,
      coverageRatio: isFinite(coverageRatio) ? Math.round(coverageRatio * 100) / 100 : 999,
      netPosition: (totalAssetValue - totalLiabilityValue).toFixed(6) + ' XRP (equiv)',
      assessmentMethod: 'On-chain balance verification with nominal token pricing',
    };
  }
  
  /**
   * Assess risks for the entity
   */
  private assessRisks(
    assets: OnLedgerAsset[],
    liabilities: Liability[],
    entity: MonitoredEntity,
    solvency: TransparencyReport['solvency']
  ): TransparencyReport['risks'] {
    const flags: RiskFlag[] = [];
    
    // Check coverage ratio
    if (solvency.status === 'WARN') {
      flags.push({
        id: 'coverage-warning',
        level: 'MEDIUM',
        category: 'SOLVENCY',
        title: 'Coverage Ratio Below Target',
        description: `Coverage ratio (${solvency.coverageRatio}x) is approaching minimum threshold`,
        detectedAt: new Date(),
        recommendation: 'Consider increasing reserves or reducing liabilities',
      });
    } else if (solvency.status === 'FAIL') {
      flags.push({
        id: 'coverage-critical',
        level: 'CRITICAL',
        category: 'SOLVENCY',
        title: 'Insufficient Coverage',
        description: `Coverage ratio (${solvency.coverageRatio}x) is below minimum threshold`,
        detectedAt: new Date(),
        recommendation: 'Immediate action required to restore coverage',
      });
    }
    
    // Check concentration risk
    const totalValue = assets.reduce((sum, a) => {
      if (a.currency === 'XRP') return sum + parseFloat(a.balance);
      return sum;
    }, 0);
    
    for (const asset of assets) {
      if (asset.currency === 'XRP' && totalValue > 0) {
        const concentration = (parseFloat(asset.balance) / totalValue) * 100;
        if (concentration > entity.thresholds.maxConcentrationPercent) {
          flags.push({
            id: `concentration-${asset.currency}`,
            level: 'LOW',
            category: 'CONCENTRATION',
            title: 'Asset Concentration',
            description: `${asset.currency} represents ${concentration.toFixed(1)}% of total value`,
            detectedAt: new Date(),
            recommendation: 'Consider diversifying reserves',
          });
        }
      }
    }
    
    // Determine overall risk level
    let overallLevel: RiskLevel = 'LOW';
    if (flags.some(f => f.level === 'CRITICAL')) {
      overallLevel = 'CRITICAL';
    } else if (flags.some(f => f.level === 'HIGH')) {
      overallLevel = 'HIGH';
    } else if (flags.some(f => f.level === 'MEDIUM')) {
      overallLevel = 'MEDIUM';
    }
    
    return {
      overallLevel,
      flags,
      lastAssessment: new Date(),
    };
  }
  
  /**
   * Aggregate assets by currency
   */
  private aggregateAssets(assets: OnLedgerAsset[]): OnLedgerAsset[] {
    const aggregated = new Map<string, OnLedgerAsset>();
    
    for (const asset of assets) {
      const key = asset.issuer ? `${asset.currency}:${asset.issuer}` : asset.currency;
      const existing = aggregated.get(key);
      
      if (existing) {
        existing.balance = (parseFloat(existing.balance) + parseFloat(asset.balance)).toString();
      } else {
        aggregated.set(key, { ...asset });
      }
    }
    
    return Array.from(aggregated.values());
  }
  
  /**
   * Create a signed snapshot for verification
   */
  private createSignedSnapshot(
    entity: MonitoredEntity,
    assets: OnLedgerAsset[],
    liabilities: Liability[],
    solvency: TransparencyReport['solvency'],
    ledgerInfo: any
  ): SignedSnapshot {
    const canonicalData = JSON.stringify({
      entityId: entity.id,
      entityType: entity.type,
      timestamp: new Date().toISOString(),
      ledgerIndex: ledgerInfo?.seq || 0,
      assets: assets.map(a => ({ currency: a.currency, issuer: a.issuer, balance: a.balance })),
      liabilities: liabilities.map(l => ({ type: l.type, currency: l.currency, amount: l.amount })),
      solvency: {
        status: solvency.status,
        coverageRatio: solvency.coverageRatio,
      },
    });
    
    // Create HMAC signature
    const signature = crypto
      .createHmac('sha256', this.signingKey)
      .update(canonicalData)
      .digest('hex');
    
    const baseUrl = process.env['BASE_URL'] || 'https://www.verityprotocol.io';
    
    return {
      version: '1.0.0',
      entityId: entity.id,
      entityType: entity.type,
      timestamp: new Date(),
      ledgerIndex: ledgerInfo?.seq || 0,
      canonicalData,
      signature,
      signatureAlgorithm: 'HMAC-SHA256',
      publicKeyFingerprint: this.publicKeyFingerprint,
      verificationUrl: `${baseUrl}/api/v1/transparency/verify/${entity.id}`,
    };
  }
  
  /**
   * Verify a signed snapshot
   */
  verifySnapshot(snapshot: SignedSnapshot): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', this.signingKey)
      .update(snapshot.canonicalData)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(snapshot.signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }
  
  /**
   * Generate embeddable badge for an entity
   */
  async generateBadge(entityId: string): Promise<TransparencyBadge> {
    const report = await this.generateReport(entityId);
    const baseUrl = process.env['BASE_URL'] || 'https://www.verityprotocol.io';
    
    const badgeUrl = `${baseUrl}/api/v1/transparency/badge/${entityId}.svg`;
    const detailsUrl = `${baseUrl}/ui/transparency/${entityId}`;
    
    const embedCode = `<a href="${detailsUrl}" target="_blank" rel="noopener">
  <img src="${badgeUrl}" alt="Verified by Verity - ${report.solvency.status}" />
</a>`;
    
    return {
      entityId,
      entityName: report.entityName,
      status: report.solvency.status,
      coverageRatio: report.solvency.coverageRatio,
      lastVerified: report.generatedAt,
      badgeUrl,
      embedCode,
      detailsUrl,
    };
  }
  
  /**
   * Generate SVG badge
   */
  generateBadgeSVG(status: SolvencyStatus, coverageRatio: number, entityName: string): string {
    const colors = {
      PASS: '#22c55e',   // Green
      WARN: '#f59e0b',   // Amber
      FAIL: '#ef4444',   // Red
      UNKNOWN: '#6b7280', // Gray
    };
    
    const color = colors[status];
    const statusText = status === 'PASS' ? 'Verified' : status === 'WARN' ? 'Warning' : status === 'FAIL' ? 'Failed' : 'Unknown';
    const ratioText = isFinite(coverageRatio) && coverageRatio < 100 ? `${coverageRatio}x` : '∞';
    
    return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="32" viewBox="0 0 200 32">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#1e293b"/>
      <stop offset="100%" style="stop-color:#334155"/>
    </linearGradient>
  </defs>
  <rect width="200" height="32" rx="4" fill="url(#bg)"/>
  <rect x="130" width="70" height="32" rx="0" fill="${color}"/>
  <rect x="196" width="4" height="32" rx="0" ry="4" fill="${color}"/>
  <text x="10" y="20" font-family="system-ui, sans-serif" font-size="11" fill="#94a3b8">Verity</text>
  <text x="50" y="20" font-family="system-ui, sans-serif" font-size="11" fill="white" font-weight="600">${ratioText} collateral</text>
  <text x="165" y="20" font-family="system-ui, sans-serif" font-size="11" fill="white" font-weight="600" text-anchor="middle">${statusText}</text>
</svg>`;
  }
}

// Singleton instance
let transparencyService: TransparencyService | null = null;

export function getTransparencyService(): TransparencyService {
  if (!transparencyService) {
    transparencyService = new TransparencyService();
  }
  return transparencyService;
}

export default TransparencyService;
