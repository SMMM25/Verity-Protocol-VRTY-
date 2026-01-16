/**
 * Verity Protocol - Bridge Module Index
 * 
 * Exports all bridge-related functionality.
 */

export { SolanaBridge, solanaBridge } from './SolanaBridge.js';
export type {
  SolanaBridgeConfig,
  BridgeRequest,
  BridgeResult,
  WalletBalance,
  ValidatorSignature,
} from './SolanaBridge.js';

export { CrossChainVestingBridge, crossChainVestingBridge } from './VestingBridge.js';
export type {
  CrossChainVestingConfig,
  CrossChainVestingSchedule,
  CrossChainVestingRelease,
  CreateVestingResult,
} from './VestingBridge.js';
export { CrossChainVestingStatus, ReleaseStatus } from './VestingBridge.js';
