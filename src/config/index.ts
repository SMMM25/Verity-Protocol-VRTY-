/**
 * Verity Protocol - Configuration Index
 * 
 * @description Exports all configuration modules for easy importing.
 * 
 * @version 1.0.0
 */

// VRTY Token Configuration
export {
  VRTY_TOKEN,
  VRTY_ADDRESSES,
  WVRTY_TOKEN,
  XRPL_NETWORKS,
  SOLANA_NETWORKS,
  BRIDGE_CONFIG,
  STAKING_TIERS,
  GUILD_CONFIG,
  getEnvironmentConfig,
  isValidVRTYIssuer,
  isValidVRTYCurrency,
  getVRTYExplorerUrl,
  getAddressExplorerUrl,
} from './vrty-token.js';

// Bridge Configuration
export {
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
} from './bridge.js';

// Re-export types
export type {
  BridgeFeeConfig,
  NetworkBridgeConfig,
  ValidatorConfig,
  BridgeTransactionCreate,
} from './bridge.js';
