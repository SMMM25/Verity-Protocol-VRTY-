/**
 * Cross-Chain Bridge - Frontend TypeScript Definitions
 * XRPL ↔ Solana bridging with wVRTY (wrapped VRTY)
 * 
 * Verity Protocol - Platform Oversight Hub
 */

// ============================================
// CORE ENUMS AND CONSTANTS
// ============================================

/**
 * Supported blockchain networks
 */
export const SupportedChain = {
  XRPL: 'XRPL',
  SOLANA: 'SOLANA',
  ETHEREUM: 'ETHEREUM',
  POLYGON: 'POLYGON',
  BSC: 'BSC',
  ARBITRUM: 'ARBITRUM',
  OPTIMISM: 'OPTIMISM'
} as const;
export type SupportedChain = typeof SupportedChain[keyof typeof SupportedChain];

/**
 * Bridge transaction status
 */
export const BridgeStatus = {
  INITIATED: 'INITIATED',
  LOCKED: 'LOCKED',
  VALIDATING: 'VALIDATING',
  MINTING: 'MINTING',
  RELEASING: 'RELEASING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED'
} as const;
export type BridgeStatus = typeof BridgeStatus[keyof typeof BridgeStatus];

/**
 * Bridge direction
 */
export const BridgeDirection = {
  XRPL_TO_SOLANA: 'XRPL_TO_SOLANA',
  SOLANA_TO_XRPL: 'SOLANA_TO_XRPL',
  XRPL_TO_EVM: 'XRPL_TO_EVM',
  EVM_TO_XRPL: 'EVM_TO_XRPL'
} as const;
export type BridgeDirection = typeof BridgeDirection[keyof typeof BridgeDirection];

// ============================================
// CHAIN CONFIGURATION
// ============================================

/**
 * Fee configuration for a chain
 */
export interface ChainFeeConfig {
  baseFee: number;
  percentageBps: number;
  minFee: number;
  maxFee: number;
}

/**
 * Bridge configuration for a chain
 */
export interface ChainBridgeConfig {
  type: 'native' | 'wrapped';
  issuerAddress?: string;
  wvrtyMint?: string;
  bridgeProgram?: string;
  bridgeContract?: string;
  wvrtyContract?: string;
}

/**
 * Supported chain configuration
 */
export interface ChainConfig {
  id: string;
  chainId: number | string;
  name: string;
  status: 'active' | 'coming_soon' | 'maintenance';
  confirmationsRequired: number;
  nativeToken: string;
  fees: ChainFeeConfig;
  bridgeConfig: ChainBridgeConfig;
  isActive?: boolean;
  health?: {
    connected: boolean;
    latency?: number;
  };
  explorerUrl?: string;
}

/**
 * Wrapped token info
 */
export interface WrappedTokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  description: string;
}

/**
 * Bridge info/limits
 */
export interface BridgeInfo {
  minAmount: number;
  maxAmount: number;
  requiredValidators: number;
  estimatedTime: string;
}

// ============================================
// BRIDGE TRANSACTIONS
// ============================================

/**
 * Validator signature
 */
export interface ValidatorSignature {
  validator: string;
  signature: string;
  timestamp: string;
}

/**
 * Bridge transaction progress
 */
export interface BridgeProgress {
  initiated: boolean;
  locked: boolean;
  validated: boolean;
  minted: boolean;
  completed: boolean;
}

/**
 * Bridge transaction
 */
export interface BridgeTransaction {
  id: string;
  bridgeId: string;
  direction: BridgeDirection;
  sourceChain: SupportedChain | string;
  destinationChain: SupportedChain | string;
  sourceAddress: string;
  destinationAddress: string;
  amount: string;
  fee: string;
  netAmount: string;
  status: BridgeStatus;
  sourceTxHash: string | null;
  destinationTxHash: string | null;
  validatorSignatures: ValidatorSignature[];
  verificationHash?: string;
  createdAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  progress: BridgeProgress;
  estimatedCompletionTime?: string;
}

/**
 * Fee estimation result
 */
export interface FeeEstimate {
  sourceChain: string;
  destinationChain: string;
  amount: string;
  estimatedFee: string;
  netAmount: string;
  feeBreakdown: {
    baseFee: string;
    percentageFee: string;
    percentageRate: string;
  };
  limits: {
    minimum: number;
    maximum: number;
  };
  estimatedTime: string;
  confirmationsRequired: number;
}

// ============================================
// WALLET BALANCES
// ============================================

/**
 * Wallet balance
 */
export interface WalletBalance {
  chain: SupportedChain | string;
  wallet: string;
  balance: string;
  decimals: number;
  symbol: string;
}

/**
 * wVRTY mint info
 */
export interface WVRTYMintInfo {
  address: string;
  supply: string;
  decimals: number;
  mintAuthority: string | null;
  freezeAuthority: string | null;
  status?: string;
}

// ============================================
// NETWORK STATUS
// ============================================

/**
 * Solana network info
 */
export interface SolanaNetworkInfo {
  slot: number;
  blockHeight: number;
  epochInfo?: {
    epoch: number;
    slotIndex: number;
    slotsInEpoch: number;
    absoluteSlot: number;
  };
  version?: {
    'solana-core': string;
    'feature-set': number;
  };
}

/**
 * Network health
 */
export interface NetworkHealth {
  connected: boolean;
  slot?: number;
  blockHeight?: number;
  latency?: number;
  error?: string;
}

/**
 * Solana status response
 */
export interface SolanaStatus {
  network: NetworkHealth;
  wvrty: WVRTYMintInfo;
  epochInfo?: SolanaNetworkInfo['epochInfo'];
  version?: SolanaNetworkInfo['version'];
}

// ============================================
// STATISTICS
// ============================================

/**
 * Bridge statistics
 */
export interface BridgeStatistics {
  totalTransactions: number;
  completedTransactions: number;
  pendingTransactions: number;
  failedTransactions: number;
  totalVolumeXRPLToSolana: string;
  totalVolumeSolanaToXRPL: string;
  totalFeesCollected: string;
  averageCompletionTime: string;
  activeChains: string[];
  validatorInfo: {
    requiredSignatures: number;
    activeValidators: number;
  };
}

/**
 * Bridge health status
 */
export interface BridgeHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  database: {
    connected: boolean;
    latency?: number;
  };
  solana: {
    connected: boolean;
    slot?: number;
    latency?: number;
    error?: string;
  };
  activeChains: string[];
}

// ============================================
// API TYPES
// ============================================

/**
 * Initiate bridge request
 */
export interface InitiateBridgeRequest {
  sourceChain: SupportedChain;
  destinationChain: SupportedChain;
  sourceAddress: string;
  destinationAddress: string;
  amount: string;
}

/**
 * Initiate bridge response
 */
export interface InitiateBridgeResponse {
  bridgeId: string;
  status: BridgeStatus;
  direction: BridgeDirection;
  sourceChain: string;
  destinationChain: string;
  sourceAddress: string;
  destinationAddress: string;
  amount: string;
  fee: string;
  netAmount: string;
  estimatedCompletionTime: string;
  nextSteps: string[];
}

/**
 * Validator signature request
 */
export interface ValidatorSignatureRequest {
  validatorAddress: string;
  signature: string;
}

/**
 * Validator signature response
 */
export interface ValidatorSignatureResponse {
  bridgeId: string;
  signatureCount: number;
  thresholdReached: boolean;
  message: string;
}

/**
 * Supported chains response
 */
export interface SupportedChainsResponse {
  chains: ChainConfig[];
  activeChains: string[];
  wrappedToken: WrappedTokenInfo;
  bridgeInfo: BridgeInfo;
}

/**
 * Bridge history response
 */
export interface BridgeHistoryResponse {
  address: string;
  transactions: BridgeTransaction[];
}

/**
 * Pagination info
 */
export interface PaginationInfo {
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================
// UI HELPER TYPES
// ============================================

/**
 * Bridge step for wizard
 */
export const BridgeStep = {
  SELECT_CHAINS: 'SELECT_CHAINS',
  ENTER_AMOUNT: 'ENTER_AMOUNT',
  REVIEW: 'REVIEW',
  SIGN_TRANSACTION: 'SIGN_TRANSACTION',
  PROCESSING: 'PROCESSING',
  COMPLETE: 'COMPLETE'
} as const;
export type BridgeStep = typeof BridgeStep[keyof typeof BridgeStep];

/**
 * Bridge form data
 */
export interface BridgeFormData {
  sourceChain: SupportedChain;
  destinationChain: SupportedChain;
  sourceAddress: string;
  destinationAddress: string;
  amount: string;
}

/**
 * Chain selection option
 */
export interface ChainOption {
  chain: ChainConfig;
  balance?: string;
  isSource: boolean;
}

// ============================================
// UI LABEL MAPPINGS
// ============================================

export const BRIDGE_STATUS_LABELS: Record<BridgeStatus, string> = {
  [BridgeStatus.INITIATED]: 'Initiated',
  [BridgeStatus.LOCKED]: 'Tokens Locked',
  [BridgeStatus.VALIDATING]: 'Validating',
  [BridgeStatus.MINTING]: 'Minting',
  [BridgeStatus.RELEASING]: 'Releasing',
  [BridgeStatus.COMPLETED]: 'Completed',
  [BridgeStatus.FAILED]: 'Failed',
  [BridgeStatus.REFUNDED]: 'Refunded'
};

export const BRIDGE_STATUS_COLORS: Record<BridgeStatus, string> = {
  [BridgeStatus.INITIATED]: 'blue',
  [BridgeStatus.LOCKED]: 'indigo',
  [BridgeStatus.VALIDATING]: 'purple',
  [BridgeStatus.MINTING]: 'violet',
  [BridgeStatus.RELEASING]: 'fuchsia',
  [BridgeStatus.COMPLETED]: 'green',
  [BridgeStatus.FAILED]: 'red',
  [BridgeStatus.REFUNDED]: 'orange'
};

export const CHAIN_LABELS: Record<string, string> = {
  XRPL: 'XRP Ledger',
  SOLANA: 'Solana',
  ETHEREUM: 'Ethereum',
  POLYGON: 'Polygon',
  BSC: 'BNB Chain',
  ARBITRUM: 'Arbitrum',
  OPTIMISM: 'Optimism'
};

export const CHAIN_ICONS: Record<string, string> = {
  XRPL: '💧',
  SOLANA: '☀️',
  ETHEREUM: '💎',
  POLYGON: '🟣',
  BSC: '🟡',
  ARBITRUM: '🔵',
  OPTIMISM: '🔴'
};

export const DIRECTION_LABELS: Record<BridgeDirection, string> = {
  [BridgeDirection.XRPL_TO_SOLANA]: 'XRPL → Solana',
  [BridgeDirection.SOLANA_TO_XRPL]: 'Solana → XRPL',
  [BridgeDirection.XRPL_TO_EVM]: 'XRPL → EVM',
  [BridgeDirection.EVM_TO_XRPL]: 'EVM → XRPL'
};

// ============================================
// CONSTANTS
// ============================================

export const MIN_BRIDGE_AMOUNT = 100;
export const MAX_BRIDGE_AMOUNT = 1000000;
export const WVRTY_DECIMALS = 6;
export const REQUIRED_VALIDATORS = 3;

// ============================================
// DEFAULT VALUES
// ============================================

export const DEFAULT_BRIDGE_FORM: BridgeFormData = {
  sourceChain: SupportedChain.XRPL,
  destinationChain: SupportedChain.SOLANA,
  sourceAddress: '',
  destinationAddress: '',
  amount: ''
};

export const ACTIVE_CHAINS: SupportedChain[] = [
  SupportedChain.XRPL,
  SupportedChain.SOLANA
];
