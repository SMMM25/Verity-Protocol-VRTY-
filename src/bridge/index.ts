/**
 * Verity Protocol - Cross-Chain Bridge Module
 * Production-ready bridges for multi-chain VRTY interoperability
 * 
 * Supported Chains:
 * - Ethereum (ERC-20 wVRTY)
 * - Polygon (ERC-20 wVRTY)
 * - Arbitrum (ERC-20 wVRTY)
 * - Optimism (ERC-20 wVRTY)
 * - BSC (BEP-20 wVRTY)
 * - Solana (SPL Token wVRTY)
 */

// EVM Bridge (Ethereum, Polygon, Arbitrum, Optimism, BSC)
export {
  VerityCrossChainBridge,
  type SupportedChain,
  type BridgeStatus,
  type BridgeDirection,
  type ChainConfig,
  type BridgeTransaction,
  type ValidatorSignature,
  type BridgeFee,
  type BridgeConfig,
} from './CrossChainBridge.js';

// Solana Bridge
export {
  VeritySolanaBridge,
  type SolanaBridgeStatus,
  type SolanaBridgeDirection,
  type SolanaBridgeTransaction,
  type SolanaValidatorSignature,
  type SolanaBridgeConfig,
  type SolanaPublicKey,
  type SolanaKeypair,
  type SolanaConnection,
} from './SolanaBridge.js';

// Default exports
export { default as CrossChainBridge } from './CrossChainBridge.js';
export { default as SolanaBridge } from './SolanaBridge.js';
