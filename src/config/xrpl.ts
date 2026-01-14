/**
 * Verity Protocol - XRPL Configuration
 * 
 * @description Centralized XRPL network configuration and utility functions.
 * Consolidates all XRPL-related constants to avoid duplication.
 */

// ============================================================
// NETWORK ENDPOINTS
// ============================================================

/**
 * XRPL WebSocket endpoints by network
 */
export const XRPL_ENDPOINTS = {
  mainnet: 'wss://xrplcluster.com',
  testnet: 'wss://s.altnet.rippletest.net:51233',
  devnet: 'wss://s.devnet.rippletest.net:51233',
} as const;

/**
 * Alternative/backup XRPL endpoints
 */
export const XRPL_BACKUP_ENDPOINTS = {
  mainnet: [
    'wss://xrplcluster.com',
    'wss://s1.ripple.com',
    'wss://s2.ripple.com',
  ],
  testnet: [
    'wss://s.altnet.rippletest.net:51233',
    'wss://testnet.xrpl-labs.com',
  ],
  devnet: [
    'wss://s.devnet.rippletest.net:51233',
  ],
} as const;

export type XRPLNetwork = keyof typeof XRPL_ENDPOINTS;

// ============================================================
// TOKEN CONFIGURATION
// ============================================================

/**
 * VRTY Token configuration
 */
export const VRTY_CONFIG = {
  currencyCode: 'VRTY',
  issuerAddress: process.env['VRTY_ISSUER_ADDRESS'] || 'rBeHfq9vRjZ8Cth1sMbp2nJvExmxSxAH8f',
  distributionWallet: process.env['VRTY_DISTRIBUTION_WALLET'] || 'rLmLMErLKDzWXyYmcZGHqQ3SCgTVJCVjA3',
  totalSupply: '1000000000', // 1 billion
  decimals: 6,
} as const;

// ============================================================
// TIME UTILITIES
// ============================================================

/**
 * Ripple epoch offset (seconds from Unix epoch to Ripple epoch)
 * Ripple epoch: January 1, 2000 00:00:00 UTC
 * Unix epoch: January 1, 1970 00:00:00 UTC
 */
export const RIPPLE_EPOCH_OFFSET = 946684800;

/**
 * Convert Unix timestamp to Ripple epoch
 */
export function unixToRippleTime(unixTimestamp: number): number {
  return unixTimestamp - RIPPLE_EPOCH_OFFSET;
}

/**
 * Convert Ripple epoch to Unix timestamp
 */
export function rippleTimeToUnix(rippleTimestamp: number): number {
  return rippleTimestamp + RIPPLE_EPOCH_OFFSET;
}

/**
 * Get current time in Ripple epoch
 */
export function getCurrentRippleTime(): number {
  return unixToRippleTime(Math.floor(Date.now() / 1000));
}

// ============================================================
// XRPL EXPLORER URLS
// ============================================================

/**
 * Get XRPL explorer URL for a transaction
 */
export function getExplorerTxUrl(txHash: string, network: XRPLNetwork = 'mainnet'): string {
  const baseUrls = {
    mainnet: 'https://livenet.xrpl.org/transactions',
    testnet: 'https://testnet.xrpl.org/transactions',
    devnet: 'https://devnet.xrpl.org/transactions',
  };
  return `${baseUrls[network]}/${txHash}`;
}

/**
 * Get XRPL explorer URL for an account
 */
export function getExplorerAccountUrl(address: string, network: XRPLNetwork = 'mainnet'): string {
  const baseUrls = {
    mainnet: 'https://livenet.xrpl.org/accounts',
    testnet: 'https://testnet.xrpl.org/accounts',
    devnet: 'https://devnet.xrpl.org/accounts',
  };
  return `${baseUrls[network]}/${address}`;
}

// ============================================================
// VALIDATION UTILITIES
// ============================================================

/**
 * Validate XRPL address format
 */
export function isValidXRPLAddress(address: string): boolean {
  return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(address);
}

/**
 * Validate amount is a positive number string
 */
export function isValidAmount(amount: string): boolean {
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0 && /^\d+(\.\d+)?$/.test(amount);
}

/**
 * Safe division with zero check
 */
export function safeDivide(numerator: number, denominator: number, fallback: number = 0): number {
  if (denominator === 0 || !isFinite(denominator)) {
    return fallback;
  }
  const result = numerator / denominator;
  return isFinite(result) ? result : fallback;
}

// ============================================================
// NETWORK UTILITIES
// ============================================================

/**
 * Get endpoint for network
 */
export function getXRPLEndpoint(network: XRPLNetwork = 'mainnet'): string {
  return XRPL_ENDPOINTS[network];
}

/**
 * Get network from environment or default
 */
export function getNetworkFromEnv(): XRPLNetwork {
  const network = process.env['XRPL_NETWORK'] as XRPLNetwork;
  if (network && network in XRPL_ENDPOINTS) {
    return network;
  }
  return 'mainnet';
}

// ============================================================
// TRANSACTION DEFAULTS
// ============================================================

/**
 * Default transaction settings
 */
export const TX_DEFAULTS = {
  /** Maximum ledger gap for transaction submission */
  maxLedgerVersionOffset: 20,
  /** Default fee cushion multiplier */
  feeCushion: 1.2,
  /** Maximum fee in drops */
  maxFeeXRP: '2',
} as const;

// ============================================================
// EXPORTS
// ============================================================

export default {
  XRPL_ENDPOINTS,
  XRPL_BACKUP_ENDPOINTS,
  VRTY_CONFIG,
  RIPPLE_EPOCH_OFFSET,
  TX_DEFAULTS,
  unixToRippleTime,
  rippleTimeToUnix,
  getCurrentRippleTime,
  getExplorerTxUrl,
  getExplorerAccountUrl,
  isValidXRPLAddress,
  isValidAmount,
  safeDivide,
  getXRPLEndpoint,
  getNetworkFromEnv,
};
