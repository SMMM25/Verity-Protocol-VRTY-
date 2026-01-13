/**
 * Verity Protocol - API Services Initialization
 * Initializes and manages all service instances for API routes
 */

import { Wallet } from 'xrpl';
import { XRPLClient } from '../core/XRPLClient.js';
import { VerityXAODOW } from '../core/XAO_DOW.js';
import { VerityAssetManager } from '../assets/AssetManager.js';
import { VeritySignalsProtocol } from '../signals/SignalsProtocol.js';
import { VerityGuildTreasury } from '../guilds/GuildTreasury.js';
import { VRTYTokenManager } from '../token/VRTYToken.js';
import { VerityAutoTaxEngine } from '../tax/AutoTaxEngine.js';
import { ComplianceOracle } from '../compliance/ComplianceOracle.js';
import { setComplianceOracle } from './routes/compliance.js';
import { logger } from '../utils/logger.js';
import type { ClawbackConfig, XRPLNetwork } from '../types/index.js';

// Service instances
let xrplClient: XRPLClient | null = null;
let xaoDow: VerityXAODOW | null = null;
let assetManager: VerityAssetManager | null = null;
let signalsProtocol: VeritySignalsProtocol | null = null;
let guildTreasury: VerityGuildTreasury | null = null;
let tokenManager: VRTYTokenManager | null = null;
let taxEngine: VerityAutoTaxEngine | null = null;
let complianceOracle: ComplianceOracle | null = null;
let issuerWallet: Wallet | null = null;

// Configuration
interface ServiceConfig {
  network: XRPLNetwork;
  issuerSeed?: string;
  governanceSigners?: string[];
  clawbackConfig?: ClawbackConfig;
}

// Default clawback configuration
const DEFAULT_CLAWBACK_CONFIG: ClawbackConfig = {
  enabled: true,
  governanceQuorum: 2,
  allowedReasons: [
    'REGULATORY_COMPLIANCE',
    'FRAUD_PREVENTION',
    'COURT_ORDER',
    'AML_VIOLATION',
    'SANCTIONS_COMPLIANCE',
    'INVESTOR_PROTECTION',
  ],
  publicJustificationRequired: true,
  cooldownPeriod: 86400, // 24 hours
};

/**
 * Initialize all services
 */
export async function initializeServices(config: ServiceConfig): Promise<void> {
  logger.info('Initializing Verity Protocol services...');

  // Initialize XRPL Client
  xrplClient = new XRPLClient({
    network: config.network,
    timeout: 30000,
  });

  await xrplClient.connect();
  logger.info(`Connected to XRPL ${config.network}`);

  // Generate or load issuer wallet
  if (config.issuerSeed) {
    issuerWallet = xrplClient.walletFromSeed(config.issuerSeed);
    logger.info(`Loaded issuer wallet: ${issuerWallet.address}`);
  } else if (config.network !== 'mainnet') {
    // Generate and fund a new wallet on testnet/devnet
    issuerWallet = xrplClient.generateWallet();
    const funded = await xrplClient.fundWallet(issuerWallet);
    logger.info(`Generated and funded issuer wallet: ${issuerWallet.address} with ${funded.balance} XRP`);
  } else {
    throw new Error('Issuer seed required for mainnet');
  }

  // Initialize XAO-DOW (Clawback Manager)
  const clawbackConfig = config.clawbackConfig || DEFAULT_CLAWBACK_CONFIG;
  xaoDow = new VerityXAODOW(xrplClient, issuerWallet, clawbackConfig);
  
  if (config.governanceSigners && config.governanceSigners.length > 0) {
    xaoDow.setGovernanceSigners(config.governanceSigners);
  }
  logger.info('XAO-DOW module initialized');

  // Initialize Asset Manager
  assetManager = new VerityAssetManager(xrplClient, xaoDow, issuerWallet);
  logger.info('Asset Manager initialized');

  // Initialize Signals Protocol
  signalsProtocol = new VeritySignalsProtocol(xrplClient);
  logger.info('Signals Protocol initialized');

  // Initialize Guild Treasury
  guildTreasury = new VerityGuildTreasury(xrplClient);
  logger.info('Guild Treasury initialized');

  // Initialize VRTY Token Manager
  tokenManager = new VRTYTokenManager(xrplClient, issuerWallet);
  logger.info('VRTY Token Manager initialized');

  // Initialize Tax Engine (no dependencies)
  taxEngine = new VerityAutoTaxEngine();
  logger.info('Auto-Tax Engine initialized');

  // Initialize Compliance Oracle
  complianceOracle = new ComplianceOracle(xrplClient, xaoDow, {
    governanceQuorum: clawbackConfig.governanceQuorum,
    publicJustificationRequired: clawbackConfig.publicJustificationRequired,
  });
  if (config.governanceSigners && config.governanceSigners.length > 0) {
    complianceOracle.setGovernanceSigners(config.governanceSigners);
  }
  setComplianceOracle(complianceOracle);
  logger.info('Compliance Oracle initialized');

  logger.info('All Verity Protocol services initialized successfully');
}

/**
 * Initialize services with lazy loading (for routes that need services)
 */
export async function ensureServicesInitialized(): Promise<void> {
  if (!xrplClient) {
    const network = (process.env['XRPL_NETWORK'] as XRPLNetwork) || 'testnet';
    const issuerSeed = process.env['ISSUER_SEED'];
    const governanceSigners = process.env['GOVERNANCE_SIGNERS']?.split(',').filter(Boolean);

    await initializeServices({
      network,
      issuerSeed,
      governanceSigners,
    });
  }
}

/**
 * Get XRPL Client instance
 */
export function getXRPLClient(): XRPLClient {
  if (!xrplClient) {
    throw new Error('Services not initialized. Call initializeServices() first.');
  }
  return xrplClient;
}

/**
 * Get XAO-DOW instance
 */
export function getXAODOW(): VerityXAODOW {
  if (!xaoDow) {
    throw new Error('Services not initialized. Call initializeServices() first.');
  }
  return xaoDow;
}

/**
 * Get Asset Manager instance
 */
export function getAssetManager(): VerityAssetManager {
  if (!assetManager) {
    throw new Error('Services not initialized. Call initializeServices() first.');
  }
  return assetManager;
}

/**
 * Get Signals Protocol instance
 */
export function getSignalsProtocol(): VeritySignalsProtocol {
  if (!signalsProtocol) {
    throw new Error('Services not initialized. Call initializeServices() first.');
  }
  return signalsProtocol;
}

/**
 * Get Guild Treasury instance
 */
export function getGuildTreasury(): VerityGuildTreasury {
  if (!guildTreasury) {
    throw new Error('Services not initialized. Call initializeServices() first.');
  }
  return guildTreasury;
}

/**
 * Get VRTY Token Manager instance
 */
export function getTokenManager(): VRTYTokenManager {
  if (!tokenManager) {
    throw new Error('Services not initialized. Call initializeServices() first.');
  }
  return tokenManager;
}

/**
 * Get Tax Engine instance
 */
export function getTaxEngine(): VerityAutoTaxEngine {
  if (!taxEngine) {
    // Tax engine can be initialized without XRPL connection
    taxEngine = new VerityAutoTaxEngine();
  }
  return taxEngine;
}

/**
 * Get Compliance Oracle instance
 */
export function getComplianceOracle(): ComplianceOracle {
  if (!complianceOracle) {
    throw new Error('Services not initialized. Call initializeServices() first.');
  }
  return complianceOracle;
}

/**
 * Get Issuer Wallet
 */
export function getIssuerWallet(): Wallet {
  if (!issuerWallet) {
    throw new Error('Services not initialized. Call initializeServices() first.');
  }
  return issuerWallet;
}

/**
 * Check if services are initialized
 */
export function areServicesInitialized(): boolean {
  return xrplClient !== null && xrplClient.connected();
}

/**
 * Shutdown all services
 */
export async function shutdownServices(): Promise<void> {
  logger.info('Shutting down Verity Protocol services...');
  
  if (xrplClient) {
    await xrplClient.disconnect();
    logger.info('XRPL Client disconnected');
  }

  // Reset all instances
  xrplClient = null;
  xaoDow = null;
  assetManager = null;
  signalsProtocol = null;
  guildTreasury = null;
  tokenManager = null;
  taxEngine = null;
  complianceOracle = null;
  issuerWallet = null;

  logger.info('All services shut down');
}

/**
 * Get service status
 */
export function getServiceStatus(): Record<string, unknown> {
  return {
    xrplClient: {
      initialized: xrplClient !== null,
      connected: xrplClient?.connected() ?? false,
    },
    xaoDow: {
      initialized: xaoDow !== null,
    },
    assetManager: {
      initialized: assetManager !== null,
    },
    signalsProtocol: {
      initialized: signalsProtocol !== null,
    },
    guildTreasury: {
      initialized: guildTreasury !== null,
    },
    tokenManager: {
      initialized: tokenManager !== null,
    },
    taxEngine: {
      initialized: taxEngine !== null,
    },
    complianceOracle: {
      initialized: complianceOracle !== null,
    },
    issuerWallet: {
      initialized: issuerWallet !== null,
      address: issuerWallet?.address,
    },
  };
}
