/**
 * Verity Protocol - Cross-Chain Bridge Configuration
 * 
 * @description Production configuration for XRPL ↔ Solana bridge.
 * Supports mainnet and testnet/devnet deployments.
 * 
 * @version 1.0.0
 */

import { VRTY_TOKEN, VRTY_ADDRESSES, WVRTY_TOKEN, XRPL_NETWORKS, SOLANA_NETWORKS } from './vrty-token.js';

/**
 * Bridge direction enum
 */
export enum BridgeDirection {
  XRPL_TO_SOLANA = 'XRPL_TO_SOLANA',
  SOLANA_TO_XRPL = 'SOLANA_TO_XRPL',
}

/**
 * Bridge transaction status
 */
export enum BridgeStatus {
  INITIATED = 'INITIATED',
  LOCKED = 'LOCKED',
  VALIDATING = 'VALIDATING',
  MINTING = 'MINTING',
  RELEASING = 'RELEASING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

/**
 * Bridge fee configuration
 */
export interface BridgeFeeConfig {
  baseFee: number;       // Fixed fee in VRTY
  percentageFee: number; // Basis points (100 = 1%)
  minFee: number;        // Minimum fee
  maxFee: number;        // Maximum fee cap
}

/**
 * Network-specific bridge configuration
 */
export interface NetworkBridgeConfig {
  xrpl: {
    network: keyof typeof XRPL_NETWORKS;
    server: string;
    escrowAddress: string;
    vrtyIssuer: string;
    vrtyCurrencyCode: string;
  };
  solana: {
    network: keyof typeof SOLANA_NETWORKS;
    rpcUrl: string;
    wvrtyMint: string;
    mintAuthority: string;
    freezeAuthority: string;
    treasuryAccount: string;
    treasuryAuthority: string;
  };
  fees: BridgeFeeConfig;
  limits: {
    minAmount: number;
    maxAmount: number;
  };
  confirmations: {
    xrpl: number;
    solana: number;
  };
  validators: {
    threshold: number;
    total: number;
  };
}

/**
 * Mainnet bridge configuration
 */
export const MAINNET_BRIDGE_CONFIG: NetworkBridgeConfig = {
  xrpl: {
    network: 'mainnet',
    server: XRPL_NETWORKS.mainnet.server,
    escrowAddress: process.env['XRPL_BRIDGE_ESCROW_MAINNET'] || '',
    vrtyIssuer: VRTY_ADDRESSES.issuer,
    vrtyCurrencyCode: VRTY_TOKEN.currencyCodeHex,
  },
  solana: {
    network: 'mainnet-beta',
    rpcUrl: process.env['SOLANA_RPC_URL_MAINNET'] || SOLANA_NETWORKS['mainnet-beta'].rpcUrl,
    wvrtyMint: WVRTY_TOKEN.mainnet.mint,
    mintAuthority: WVRTY_TOKEN.mainnet.mintAuthority,
    freezeAuthority: WVRTY_TOKEN.mainnet.freezeAuthority,
    treasuryAccount: WVRTY_TOKEN.mainnet.treasuryAccount,
    treasuryAuthority: '',
  },
  fees: {
    baseFee: 10,        // 10 VRTY base fee
    percentageFee: 25,  // 0.25%
    minFee: 10,         // Minimum 10 VRTY
    maxFee: 10000,      // Maximum 10,000 VRTY
  },
  limits: {
    minAmount: 100,       // Minimum 100 VRTY
    maxAmount: 1000000,   // Maximum 1,000,000 VRTY
  },
  confirmations: {
    xrpl: 1,    // XRPL has fast finality
    solana: 32, // ~12 seconds on Solana
  },
  validators: {
    threshold: 3,  // 3 of 5 validators required
    total: 5,
  },
};

/**
 * Testnet/Devnet bridge configuration (for testing)
 */
export const TESTNET_BRIDGE_CONFIG: NetworkBridgeConfig = {
  xrpl: {
    network: 'testnet',
    server: XRPL_NETWORKS.testnet.server,
    escrowAddress: 'rMSx5CkHJqZA4QVwp9gbwNi2JqCqK4kMPQ', // Deployed testnet escrow
    vrtyIssuer: VRTY_ADDRESSES.issuer, // Mainnet issuer (for reference)
    vrtyCurrencyCode: VRTY_TOKEN.currencyCodeHex,
  },
  solana: {
    network: 'devnet',
    rpcUrl: SOLANA_NETWORKS.devnet.rpcUrl,
    wvrtyMint: WVRTY_TOKEN.devnet.mint,
    mintAuthority: WVRTY_TOKEN.devnet.mintAuthority,
    freezeAuthority: WVRTY_TOKEN.devnet.freezeAuthority,
    treasuryAccount: WVRTY_TOKEN.devnet.treasuryAccount,
    treasuryAuthority: WVRTY_TOKEN.devnet.treasuryAuthority,
  },
  fees: {
    baseFee: 5,         // Lower fees for testing
    percentageFee: 10,  // 0.1%
    minFee: 5,
    maxFee: 1000,
  },
  limits: {
    minAmount: 10,        // Lower minimum for testing
    maxAmount: 100000,    // Lower maximum for testing
  },
  confirmations: {
    xrpl: 1,
    solana: 1,  // Faster confirmations for testing
  },
  validators: {
    threshold: 1,  // Single validator for testing
    total: 1,
  },
};

/**
 * Get bridge configuration based on environment
 */
export function getBridgeConfig(): NetworkBridgeConfig {
  const env = process.env['NODE_ENV'] || 'development';
  const isMainnet = env === 'production' && process.env['BRIDGE_NETWORK'] === 'mainnet';
  
  return isMainnet ? MAINNET_BRIDGE_CONFIG : TESTNET_BRIDGE_CONFIG;
}

/**
 * Calculate bridge fee for a given amount
 */
export function calculateBridgeFee(amount: number, config?: BridgeFeeConfig): {
  baseFee: number;
  percentageFee: number;
  totalFee: number;
  netAmount: number;
} {
  const feeConfig = config || getBridgeConfig().fees;
  
  const percentageFee = Math.floor(amount * feeConfig.percentageFee / 10000);
  let totalFee = feeConfig.baseFee + percentageFee;
  
  // Apply min/max constraints
  totalFee = Math.max(feeConfig.minFee, Math.min(feeConfig.maxFee, totalFee));
  
  return {
    baseFee: feeConfig.baseFee,
    percentageFee,
    totalFee,
    netAmount: amount - totalFee,
  };
}

/**
 * Validate bridge amount
 */
export function validateBridgeAmount(amount: number, config?: NetworkBridgeConfig): {
  valid: boolean;
  error?: string;
} {
  const bridgeConfig = config || getBridgeConfig();
  
  if (amount < bridgeConfig.limits.minAmount) {
    return {
      valid: false,
      error: `Amount too small. Minimum: ${bridgeConfig.limits.minAmount} VRTY`,
    };
  }
  
  if (amount > bridgeConfig.limits.maxAmount) {
    return {
      valid: false,
      error: `Amount too large. Maximum: ${bridgeConfig.limits.maxAmount} VRTY`,
    };
  }
  
  return { valid: true };
}

/**
 * Validator node configuration
 */
export interface ValidatorConfig {
  id: string;
  name: string;
  publicKey: string;
  endpoint: string;
  active: boolean;
}

/**
 * Get validator configuration
 * In production, this would be loaded from a secure configuration
 */
export function getValidatorConfig(): ValidatorConfig[] {
  const env = process.env['NODE_ENV'] || 'development';
  
  if (env === 'production') {
    // Production validators would be loaded from secure config
    return JSON.parse(process.env['BRIDGE_VALIDATORS'] || '[]');
  }
  
  // Testnet validators
  return [
    {
      id: 'v1',
      name: 'Validator 1 (Test)',
      publicKey: process.env['VALIDATOR_1_PUBKEY'] || '',
      endpoint: process.env['VALIDATOR_1_ENDPOINT'] || 'http://localhost:3001',
      active: true,
    },
  ];
}

/**
 * Bridge transaction type for database
 */
export interface BridgeTransactionCreate {
  direction: BridgeDirection;
  sourceChain: string;
  destinationChain: string;
  sourceAddress: string;
  destinationAddress: string;
  amount: number;
  fee: number;
  status: BridgeStatus;
  verificationHash: string;
  sourceTxHash?: string;
}

/**
 * Generate verification hash for bridge transaction
 */
export function generateVerificationHash(
  sourceAddress: string,
  destinationAddress: string,
  amount: number,
  timestamp: number
): string {
  const crypto = require('crypto');
  const data = `${sourceAddress}:${destinationAddress}:${amount}:${timestamp}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Bridge status transitions
 */
export const BRIDGE_STATUS_TRANSITIONS: Record<BridgeStatus, BridgeStatus[]> = {
  [BridgeStatus.INITIATED]: [BridgeStatus.LOCKED, BridgeStatus.FAILED],
  [BridgeStatus.LOCKED]: [BridgeStatus.VALIDATING, BridgeStatus.FAILED, BridgeStatus.REFUNDED],
  [BridgeStatus.VALIDATING]: [BridgeStatus.MINTING, BridgeStatus.RELEASING, BridgeStatus.FAILED],
  [BridgeStatus.MINTING]: [BridgeStatus.COMPLETED, BridgeStatus.FAILED],
  [BridgeStatus.RELEASING]: [BridgeStatus.COMPLETED, BridgeStatus.FAILED],
  [BridgeStatus.COMPLETED]: [],
  [BridgeStatus.FAILED]: [BridgeStatus.REFUNDED],
  [BridgeStatus.REFUNDED]: [],
};

/**
 * Validate status transition
 */
export function isValidStatusTransition(
  currentStatus: BridgeStatus,
  newStatus: BridgeStatus
): boolean {
  return BRIDGE_STATUS_TRANSITIONS[currentStatus]?.includes(newStatus) || false;
}

/**
 * Bridge event types
 */
export enum BridgeEventType {
  INITIATED = 'BRIDGE_INITIATED',
  LOCKED = 'VRTY_LOCKED',
  VALIDATED = 'SIGNATURE_VALIDATED',
  MINTED = 'WVRTY_MINTED',
  BURNED = 'WVRTY_BURNED',
  RELEASED = 'VRTY_RELEASED',
  COMPLETED = 'BRIDGE_COMPLETED',
  FAILED = 'BRIDGE_FAILED',
  REFUNDED = 'BRIDGE_REFUNDED',
}

export default {
  BridgeDirection,
  BridgeStatus,
  MAINNET_BRIDGE_CONFIG,
  TESTNET_BRIDGE_CONFIG,
  getBridgeConfig,
  calculateBridgeFee,
  validateBridgeAmount,
  getValidatorConfig,
  generateVerificationHash,
  isValidStatusTransition,
  BridgeEventType,
};
