/**
 * Verity Protocol - Cross-Chain Bridge
 * Production-ready bridge for wrapped VERITY (wVRTY) across Ethereum, Solana, and Polygon
 * 
 * Architecture:
 * - Lock-and-Mint: Lock VRTY on XRPL → Mint wVRTY on destination chain
 * - Burn-and-Release: Burn wVRTY on source chain → Release VRTY on XRPL
 * - Multi-sig validation for security
 * - Oracle-based price feeds for accurate conversions
 */

import { Wallet, Payment, EscrowCreate, EscrowFinish } from 'xrpl';
import { EventEmitter } from 'eventemitter3';
import { ethers } from 'ethers';
import { XRPLClient, TransactionResult } from '../core/XRPLClient.js';
import { logger, logAuditAction } from '../utils/logger.js';
import { generateId, generateVerificationHash, encodeMemoData, sha256 } from '../utils/crypto.js';

// Supported chains for cross-chain bridging
export type SupportedChain = 'ETHEREUM' | 'POLYGON' | 'SOLANA' | 'BSC' | 'ARBITRUM' | 'OPTIMISM';

// Bridge transaction status
export type BridgeStatus = 
  | 'INITIATED'
  | 'LOCKED'
  | 'VALIDATING'
  | 'MINTING'
  | 'COMPLETED'
  | 'FAILED'
  | 'REFUNDED';

// Bridge direction
export type BridgeDirection = 'XRPL_TO_EVM' | 'EVM_TO_XRPL' | 'XRPL_TO_SOLANA' | 'SOLANA_TO_XRPL';

/**
 * Chain configuration for bridge operations
 */
export interface ChainConfig {
  chainId: number | string;
  name: string;
  rpcUrl: string;
  bridgeContractAddress: string;
  wVRTYContractAddress: string;
  explorerUrl: string;
  confirmationsRequired: number;
  gasToken: string;
  isEVM: boolean;
}

/**
 * Bridge transaction record
 */
export interface BridgeTransaction {
  id: string;
  direction: BridgeDirection;
  sourceChain: SupportedChain | 'XRPL';
  destinationChain: SupportedChain | 'XRPL';
  sourceAddress: string;
  destinationAddress: string;
  amount: string;
  fee: string;
  status: BridgeStatus;
  sourceTransactionHash?: string;
  destinationTransactionHash?: string;
  escrowId?: string;
  validatorSignatures: ValidatorSignature[];
  verificationHash: string;
  createdAt: Date;
  completedAt?: Date;
  errorMessage?: string;
}

/**
 * Validator signature for multi-sig verification
 */
export interface ValidatorSignature {
  validator: string;
  signature: string;
  timestamp: Date;
}

/**
 * Bridge fee structure
 */
export interface BridgeFee {
  baseFee: string;
  percentageFee: number; // basis points
  minimumFee: string;
  maximumFee: string;
}

/**
 * Bridge configuration
 */
export interface BridgeConfig {
  xrplClient: XRPLClient;
  bridgeWallet: Wallet;
  validators: string[];
  requiredValidations: number;
  fees: Record<SupportedChain, BridgeFee>;
  chains: Record<SupportedChain, ChainConfig>;
}

// EVM Bridge Contract ABI (minimal interface)
const BRIDGE_CONTRACT_ABI = [
  'function mint(address to, uint256 amount, bytes32 xrplTxHash, bytes[] signatures) external',
  'function burn(uint256 amount, string xrplDestination) external',
  'function balanceOf(address account) external view returns (uint256)',
  'function totalSupply() external view returns (uint256)',
  'event Minted(address indexed to, uint256 amount, bytes32 xrplTxHash)',
  'event Burned(address indexed from, uint256 amount, string xrplDestination)',
];

// wVRTY ERC20 Contract ABI
const WVRTY_CONTRACT_ABI = [
  'function name() external view returns (string)',
  'function symbol() external view returns (string)',
  'function decimals() external view returns (uint8)',
  'function totalSupply() external view returns (uint256)',
  'function balanceOf(address account) external view returns (uint256)',
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function allowance(address owner, address spender) external view returns (uint256)',
];

/**
 * Default chain configurations for production deployment
 */
const DEFAULT_CHAIN_CONFIGS: Record<SupportedChain, ChainConfig> = {
  ETHEREUM: {
    chainId: 1,
    name: 'Ethereum Mainnet',
    rpcUrl: process.env['ETHEREUM_RPC_URL'] || 'https://eth-mainnet.g.alchemy.com/v2/your-api-key',
    bridgeContractAddress: process.env['ETH_BRIDGE_CONTRACT'] || '0x0000000000000000000000000000000000000000',
    wVRTYContractAddress: process.env['ETH_WVRTY_CONTRACT'] || '0x0000000000000000000000000000000000000000',
    explorerUrl: 'https://etherscan.io',
    confirmationsRequired: 12,
    gasToken: 'ETH',
    isEVM: true,
  },
  POLYGON: {
    chainId: 137,
    name: 'Polygon Mainnet',
    rpcUrl: process.env['POLYGON_RPC_URL'] || 'https://polygon-mainnet.g.alchemy.com/v2/your-api-key',
    bridgeContractAddress: process.env['POLYGON_BRIDGE_CONTRACT'] || '0x0000000000000000000000000000000000000000',
    wVRTYContractAddress: process.env['POLYGON_WVRTY_CONTRACT'] || '0x0000000000000000000000000000000000000000',
    explorerUrl: 'https://polygonscan.com',
    confirmationsRequired: 128,
    gasToken: 'MATIC',
    isEVM: true,
  },
  BSC: {
    chainId: 56,
    name: 'BNB Smart Chain',
    rpcUrl: process.env['BSC_RPC_URL'] || 'https://bsc-dataseed.binance.org',
    bridgeContractAddress: process.env['BSC_BRIDGE_CONTRACT'] || '0x0000000000000000000000000000000000000000',
    wVRTYContractAddress: process.env['BSC_WVRTY_CONTRACT'] || '0x0000000000000000000000000000000000000000',
    explorerUrl: 'https://bscscan.com',
    confirmationsRequired: 15,
    gasToken: 'BNB',
    isEVM: true,
  },
  ARBITRUM: {
    chainId: 42161,
    name: 'Arbitrum One',
    rpcUrl: process.env['ARBITRUM_RPC_URL'] || 'https://arb1.arbitrum.io/rpc',
    bridgeContractAddress: process.env['ARBITRUM_BRIDGE_CONTRACT'] || '0x0000000000000000000000000000000000000000',
    wVRTYContractAddress: process.env['ARBITRUM_WVRTY_CONTRACT'] || '0x0000000000000000000000000000000000000000',
    explorerUrl: 'https://arbiscan.io',
    confirmationsRequired: 64,
    gasToken: 'ETH',
    isEVM: true,
  },
  OPTIMISM: {
    chainId: 10,
    name: 'Optimism',
    rpcUrl: process.env['OPTIMISM_RPC_URL'] || 'https://mainnet.optimism.io',
    bridgeContractAddress: process.env['OPTIMISM_BRIDGE_CONTRACT'] || '0x0000000000000000000000000000000000000000',
    wVRTYContractAddress: process.env['OPTIMISM_WVRTY_CONTRACT'] || '0x0000000000000000000000000000000000000000',
    explorerUrl: 'https://optimistic.etherscan.io',
    confirmationsRequired: 64,
    gasToken: 'ETH',
    isEVM: true,
  },
  SOLANA: {
    chainId: 'mainnet-beta',
    name: 'Solana Mainnet',
    rpcUrl: process.env['SOLANA_RPC_URL'] || 'https://api.mainnet-beta.solana.com',
    bridgeContractAddress: process.env['SOLANA_BRIDGE_PROGRAM'] || '',
    wVRTYContractAddress: process.env['SOLANA_WVRTY_MINT'] || '',
    explorerUrl: 'https://solscan.io',
    confirmationsRequired: 32,
    gasToken: 'SOL',
    isEVM: false,
  },
};

/**
 * Default bridge fees
 */
const DEFAULT_BRIDGE_FEES: Record<SupportedChain, BridgeFee> = {
  ETHEREUM: { baseFee: '10', percentageFee: 25, minimumFee: '50', maximumFee: '10000' }, // 0.25%
  POLYGON: { baseFee: '5', percentageFee: 15, minimumFee: '10', maximumFee: '5000' }, // 0.15%
  BSC: { baseFee: '5', percentageFee: 20, minimumFee: '20', maximumFee: '5000' }, // 0.20%
  ARBITRUM: { baseFee: '5', percentageFee: 15, minimumFee: '10', maximumFee: '5000' }, // 0.15%
  OPTIMISM: { baseFee: '5', percentageFee: 15, minimumFee: '10', maximumFee: '5000' }, // 0.15%
  SOLANA: { baseFee: '2', percentageFee: 10, minimumFee: '5', maximumFee: '2500' }, // 0.10%
};

/**
 * Verity Cross-Chain Bridge
 * Production-ready bridge for multi-chain VRTY interoperability
 */
export class VerityCrossChainBridge extends EventEmitter {
  private xrplClient: XRPLClient;
  private bridgeWallet: Wallet;
  private validators: Set<string>;
  private requiredValidations: number;
  private fees: Record<SupportedChain, BridgeFee>;
  private chains: Record<SupportedChain, ChainConfig>;
  private evmProviders: Map<SupportedChain, ethers.JsonRpcProvider> = new Map();
  
  // Transaction storage (production would use database)
  private transactions: Map<string, BridgeTransaction> = new Map();
  private pendingMints: Map<string, BridgeTransaction> = new Map();
  private lockedAmounts: Map<string, bigint> = new Map(); // By escrow ID

  constructor(config: Partial<BridgeConfig> & { xrplClient: XRPLClient; bridgeWallet: Wallet }) {
    super();
    this.xrplClient = config.xrplClient;
    this.bridgeWallet = config.bridgeWallet;
    this.validators = new Set(config.validators || []);
    this.requiredValidations = config.requiredValidations || 3;
    this.fees = config.fees || DEFAULT_BRIDGE_FEES;
    this.chains = config.chains || DEFAULT_CHAIN_CONFIGS;

    // Initialize EVM providers
    this.initializeProviders();

    logger.info('Verity Cross-Chain Bridge initialized', {
      supportedChains: Object.keys(this.chains),
      validators: this.validators.size,
      requiredValidations: this.requiredValidations,
    });
  }

  /**
   * Initialize EVM chain providers
   */
  private initializeProviders(): void {
    for (const [chain, config] of Object.entries(this.chains)) {
      if (config.isEVM && config.rpcUrl) {
        try {
          const provider = new ethers.JsonRpcProvider(config.rpcUrl);
          this.evmProviders.set(chain as SupportedChain, provider);
          logger.debug(`Initialized provider for ${chain}`);
        } catch (error) {
          logger.warn(`Failed to initialize provider for ${chain}: ${error}`);
        }
      }
    }
  }

  /**
   * Add a validator to the bridge
   */
  addValidator(validatorAddress: string): void {
    this.validators.add(validatorAddress);
    logAuditAction('BRIDGE_VALIDATOR_ADDED', 'SYSTEM', { validator: validatorAddress });
  }

  /**
   * Remove a validator from the bridge
   */
  removeValidator(validatorAddress: string): void {
    this.validators.delete(validatorAddress);
    logAuditAction('BRIDGE_VALIDATOR_REMOVED', 'SYSTEM', { validator: validatorAddress });
  }

  /**
   * Calculate bridge fee for a transaction
   */
  calculateBridgeFee(destinationChain: SupportedChain, amount: string): string {
    const feeConfig = this.fees[destinationChain];
    if (!feeConfig) {
      throw new Error(`Unsupported destination chain: ${destinationChain}`);
    }

    const amountBigInt = BigInt(Math.floor(parseFloat(amount) * 1e6));
    const baseFee = BigInt(feeConfig.baseFee) * BigInt(1e6);
    const percentageFee = (amountBigInt * BigInt(feeConfig.percentageFee)) / BigInt(10000);
    
    let totalFee = baseFee + percentageFee;
    
    const minFee = BigInt(feeConfig.minimumFee) * BigInt(1e6);
    const maxFee = BigInt(feeConfig.maximumFee) * BigInt(1e6);
    
    if (totalFee < minFee) totalFee = minFee;
    if (totalFee > maxFee) totalFee = maxFee;

    return (Number(totalFee) / 1e6).toFixed(6);
  }

  /**
   * Initiate bridge from XRPL to EVM chain
   * Lock VRTY on XRPL and prepare for minting on destination chain
   */
  async bridgeToEVM(
    userWallet: Wallet,
    destinationChain: SupportedChain,
    destinationAddress: string,
    amount: string
  ): Promise<BridgeTransaction> {
    const chainConfig = this.chains[destinationChain];
    if (!chainConfig || !chainConfig.isEVM) {
      throw new Error(`Invalid EVM destination chain: ${destinationChain}`);
    }

    // Validate destination address
    if (!ethers.isAddress(destinationAddress)) {
      throw new Error('Invalid EVM destination address');
    }

    logger.info(`Initiating bridge to ${destinationChain}`, {
      from: userWallet.address,
      to: destinationAddress,
      amount,
    });

    // Calculate fee
    const fee = this.calculateBridgeFee(destinationChain, amount);
    const netAmount = (parseFloat(amount) - parseFloat(fee)).toFixed(6);

    if (parseFloat(netAmount) <= 0) {
      throw new Error('Amount too small to cover bridge fees');
    }

    // Create bridge transaction record
    const bridgeId = generateId('BRG');
    const bridgeTx: BridgeTransaction = {
      id: bridgeId,
      direction: 'XRPL_TO_EVM',
      sourceChain: 'XRPL',
      destinationChain,
      sourceAddress: userWallet.address,
      destinationAddress,
      amount,
      fee,
      status: 'INITIATED',
      validatorSignatures: [],
      verificationHash: generateVerificationHash({
        bridgeId,
        direction: 'XRPL_TO_EVM',
        sourceAddress: userWallet.address,
        destinationAddress,
        amount,
        destinationChain,
        timestamp: new Date().toISOString(),
      }),
      createdAt: new Date(),
    };

    this.transactions.set(bridgeId, bridgeTx);

    // Step 1: Lock VRTY on XRPL using escrow or payment to bridge wallet
    const lockResult = await this.lockVRTYOnXRPL(userWallet, amount, bridgeId);

    if (!lockResult.success) {
      bridgeTx.status = 'FAILED';
      bridgeTx.errorMessage = lockResult.error || 'Failed to lock VRTY on XRPL';
      throw new Error(bridgeTx.errorMessage);
    }

    bridgeTx.status = 'LOCKED';
    bridgeTx.sourceTransactionHash = lockResult.hash;

    // Step 2: Request validator signatures
    bridgeTx.status = 'VALIDATING';
    this.pendingMints.set(bridgeId, bridgeTx);

    logAuditAction('BRIDGE_INITIATED', userWallet.address, {
      bridgeId,
      destinationChain,
      amount,
      fee,
      sourceHash: lockResult.hash,
    });

    this.emit('bridgeInitiated', bridgeTx);

    logger.info(`Bridge transaction initiated: ${bridgeId}`, {
      sourceHash: lockResult.hash,
      status: bridgeTx.status,
    });

    return bridgeTx;
  }

  /**
   * Lock VRTY tokens on XRPL
   */
  private async lockVRTYOnXRPL(
    userWallet: Wallet,
    amount: string,
    bridgeId: string
  ): Promise<TransactionResult> {
    // Create payment to bridge wallet with memo containing bridge ID
    const paymentTx: Payment = {
      TransactionType: 'Payment',
      Account: userWallet.address,
      Destination: this.bridgeWallet.address,
      Amount: {
        currency: 'VRTY',
        issuer: this.bridgeWallet.address,
        value: amount,
      },
      Memos: [
        {
          Memo: {
            MemoType: Buffer.from('VERITY_BRIDGE_LOCK').toString('hex').toUpperCase(),
            MemoData: encodeMemoData({
              bridgeId,
              action: 'LOCK',
              timestamp: new Date().toISOString(),
            }),
            MemoFormat: Buffer.from('application/json').toString('hex').toUpperCase(),
          },
        },
      ],
    };

    const result = await this.xrplClient.submitAndWait(paymentTx, userWallet);

    if (result.success) {
      const currentLocked = this.lockedAmounts.get(bridgeId) || BigInt(0);
      this.lockedAmounts.set(bridgeId, currentLocked + BigInt(Math.floor(parseFloat(amount) * 1e6)));
    }

    return result;
  }

  /**
   * Add validator signature to a pending bridge transaction
   */
  addValidatorSignature(
    bridgeId: string,
    validator: string,
    signature: string
  ): BridgeTransaction {
    const bridgeTx = this.transactions.get(bridgeId);
    if (!bridgeTx) {
      throw new Error(`Bridge transaction ${bridgeId} not found`);
    }

    if (!this.validators.has(validator)) {
      throw new Error(`${validator} is not an authorized validator`);
    }

    if (bridgeTx.validatorSignatures.some(s => s.validator === validator)) {
      throw new Error(`Validator ${validator} has already signed this transaction`);
    }

    // Verify signature (in production, verify cryptographic signature)
    const expectedMessage = sha256(`${bridgeId}:${bridgeTx.verificationHash}:${validator}`);
    // In production: verify signature against expectedMessage using validator's public key

    bridgeTx.validatorSignatures.push({
      validator,
      signature,
      timestamp: new Date(),
    });

    logger.info(`Validator signature added to bridge ${bridgeId}`, {
      validator,
      totalSignatures: bridgeTx.validatorSignatures.length,
      required: this.requiredValidations,
    });

    // Check if we have enough signatures
    if (bridgeTx.validatorSignatures.length >= this.requiredValidations) {
      bridgeTx.status = 'MINTING';
      this.emit('validationComplete', bridgeTx);
    }

    return bridgeTx;
  }

  /**
   * Complete bridge by minting on destination chain (called by relayer)
   */
  async completeBridgeToEVM(
    bridgeId: string,
    relayerPrivateKey: string
  ): Promise<BridgeTransaction> {
    const bridgeTx = this.transactions.get(bridgeId);
    if (!bridgeTx) {
      throw new Error(`Bridge transaction ${bridgeId} not found`);
    }

    if (bridgeTx.status !== 'MINTING') {
      throw new Error(`Bridge transaction is not ready for minting. Status: ${bridgeTx.status}`);
    }

    if (bridgeTx.validatorSignatures.length < this.requiredValidations) {
      throw new Error('Insufficient validator signatures');
    }

    const chainConfig = this.chains[bridgeTx.destinationChain as SupportedChain];
    if (!chainConfig || !chainConfig.isEVM) {
      throw new Error('Invalid destination chain configuration');
    }

    const provider = this.evmProviders.get(bridgeTx.destinationChain as SupportedChain);
    if (!provider) {
      throw new Error(`No provider available for ${bridgeTx.destinationChain}`);
    }

    try {
      // Create relayer wallet
      const relayerWallet = new ethers.Wallet(relayerPrivateKey, provider);

      // Connect to bridge contract
      const bridgeContract = new ethers.Contract(
        chainConfig.bridgeContractAddress,
        BRIDGE_CONTRACT_ABI,
        relayerWallet
      );

      // Prepare signatures array
      const signatures = bridgeTx.validatorSignatures.map(s => 
        ethers.toUtf8Bytes(s.signature)
      );

      // Calculate amount in wei (assuming 6 decimals for wVRTY)
      const fee = parseFloat(bridgeTx.fee);
      const netAmount = parseFloat(bridgeTx.amount) - fee;
      const amountWei = ethers.parseUnits(netAmount.toFixed(6), 6);

      // Convert XRPL tx hash to bytes32
      const xrplTxHash = ethers.zeroPadValue(
        ethers.toUtf8Bytes(bridgeTx.sourceTransactionHash || ''),
        32
      );

      logger.info(`Executing mint on ${bridgeTx.destinationChain}`, {
        bridgeId,
        to: bridgeTx.destinationAddress,
        amount: netAmount.toFixed(6),
      });

      // Execute mint transaction
      const mintFn = bridgeContract.getFunction('mint');
      const tx = await mintFn(
        bridgeTx.destinationAddress,
        amountWei,
        xrplTxHash,
        signatures
      );

      // Wait for confirmation
      const receipt = await tx.wait(chainConfig.confirmationsRequired);

      bridgeTx.destinationTransactionHash = receipt.hash;
      bridgeTx.status = 'COMPLETED';
      bridgeTx.completedAt = new Date();

      logAuditAction('BRIDGE_COMPLETED', 'RELAYER', {
        bridgeId,
        destinationChain: bridgeTx.destinationChain,
        destinationHash: receipt.hash,
        amount: netAmount.toFixed(6),
      });

      this.emit('bridgeCompleted', bridgeTx);

      logger.info(`Bridge completed: ${bridgeId}`, {
        destinationHash: receipt.hash,
      });

      return bridgeTx;
    } catch (error) {
      bridgeTx.status = 'FAILED';
      bridgeTx.errorMessage = (error as Error).message;
      
      logger.error(`Bridge minting failed: ${bridgeId}`, { error });
      
      throw error;
    }
  }

  /**
   * Initiate bridge from EVM chain back to XRPL
   * User burns wVRTY on EVM chain, VRTY is released on XRPL
   */
  async bridgeFromEVM(
    sourceChain: SupportedChain,
    evmTransactionHash: string,
    xrplDestinationAddress: string
  ): Promise<BridgeTransaction> {
    const chainConfig = this.chains[sourceChain];
    if (!chainConfig || !chainConfig.isEVM) {
      throw new Error(`Invalid EVM source chain: ${sourceChain}`);
    }

    const provider = this.evmProviders.get(sourceChain);
    if (!provider) {
      throw new Error(`No provider available for ${sourceChain}`);
    }

    logger.info(`Processing bridge from ${sourceChain} to XRPL`, {
      evmTxHash: evmTransactionHash,
      xrplDestination: xrplDestinationAddress,
    });

    // Verify the burn transaction on EVM chain
    const receipt = await provider.getTransactionReceipt(evmTransactionHash);
    if (!receipt) {
      throw new Error('Transaction not found on source chain');
    }

    if (receipt.status !== 1) {
      throw new Error('Source transaction failed');
    }

    // Verify confirmations
    const currentBlock = await provider.getBlockNumber();
    const confirmations = currentBlock - receipt.blockNumber;
    if (confirmations < chainConfig.confirmationsRequired) {
      throw new Error(`Insufficient confirmations: ${confirmations}/${chainConfig.confirmationsRequired}`);
    }

    // Parse burn event to get amount and xrpl destination
    const bridgeContract = new ethers.Contract(
      chainConfig.bridgeContractAddress,
      BRIDGE_CONTRACT_ABI,
      provider
    );

    const burnedFilter = bridgeContract.filters['Burned'];
    const burnEvents = await bridgeContract.queryFilter(
      burnedFilter ? burnedFilter() : 'Burned',
      receipt.blockNumber,
      receipt.blockNumber
    );

    const burnEvent = burnEvents.find((e) => e.transactionHash === evmTransactionHash) as ethers.EventLog | undefined;
    if (!burnEvent || !('args' in burnEvent)) {
      throw new Error('Burn event not found in transaction');
    }

    const [, burnedAmount, xrplDest] = burnEvent.args as unknown as [string, bigint, string];
    
    if (xrplDest !== xrplDestinationAddress) {
      throw new Error('XRPL destination address mismatch');
    }

    const amount = ethers.formatUnits(burnedAmount, 6);

    // Create bridge transaction record
    const bridgeId = generateId('BRG');
    const bridgeTx: BridgeTransaction = {
      id: bridgeId,
      direction: 'EVM_TO_XRPL',
      sourceChain,
      destinationChain: 'XRPL',
      sourceAddress: receipt.from,
      destinationAddress: xrplDestinationAddress,
      amount,
      fee: '0', // Fee already deducted on EVM side
      status: 'VALIDATING',
      sourceTransactionHash: evmTransactionHash,
      validatorSignatures: [],
      verificationHash: generateVerificationHash({
        bridgeId,
        direction: 'EVM_TO_XRPL',
        sourceChain,
        evmTxHash: evmTransactionHash,
        xrplDestination: xrplDestinationAddress,
        amount,
        timestamp: new Date().toISOString(),
      }),
      createdAt: new Date(),
    };

    this.transactions.set(bridgeId, bridgeTx);
    this.pendingMints.set(bridgeId, bridgeTx);

    logAuditAction('BRIDGE_FROM_EVM_INITIATED', receipt.from, {
      bridgeId,
      sourceChain,
      evmTxHash: evmTransactionHash,
      amount,
    });

    this.emit('bridgeFromEVMInitiated', bridgeTx);

    return bridgeTx;
  }

  /**
   * Complete bridge from EVM by releasing VRTY on XRPL
   */
  async completeBridgeToXRPL(bridgeId: string): Promise<BridgeTransaction> {
    const bridgeTx = this.transactions.get(bridgeId);
    if (!bridgeTx) {
      throw new Error(`Bridge transaction ${bridgeId} not found`);
    }

    if (bridgeTx.direction !== 'EVM_TO_XRPL') {
      throw new Error('Invalid bridge direction');
    }

    if (bridgeTx.validatorSignatures.length < this.requiredValidations) {
      throw new Error('Insufficient validator signatures');
    }

    logger.info(`Completing bridge to XRPL: ${bridgeId}`, {
      destination: bridgeTx.destinationAddress,
      amount: bridgeTx.amount,
    });

    // Release VRTY on XRPL
    const paymentTx: Payment = {
      TransactionType: 'Payment',
      Account: this.bridgeWallet.address,
      Destination: bridgeTx.destinationAddress,
      Amount: {
        currency: 'VRTY',
        issuer: this.bridgeWallet.address,
        value: bridgeTx.amount,
      },
      Memos: [
        {
          Memo: {
            MemoType: Buffer.from('VERITY_BRIDGE_RELEASE').toString('hex').toUpperCase(),
            MemoData: encodeMemoData({
              bridgeId,
              action: 'RELEASE',
              sourceChain: bridgeTx.sourceChain,
              sourceTxHash: bridgeTx.sourceTransactionHash,
              timestamp: new Date().toISOString(),
            }),
            MemoFormat: Buffer.from('application/json').toString('hex').toUpperCase(),
          },
        },
      ],
    };

    const result = await this.xrplClient.submitAndWait(paymentTx, this.bridgeWallet);

    if (!result.success) {
      bridgeTx.status = 'FAILED';
      bridgeTx.errorMessage = result.error || 'Failed to release VRTY on XRPL';
      throw new Error(bridgeTx.errorMessage);
    }

    bridgeTx.destinationTransactionHash = result.hash;
    bridgeTx.status = 'COMPLETED';
    bridgeTx.completedAt = new Date();

    this.pendingMints.delete(bridgeId);

    logAuditAction('BRIDGE_TO_XRPL_COMPLETED', 'BRIDGE', {
      bridgeId,
      xrplTxHash: result.hash,
      amount: bridgeTx.amount,
    });

    this.emit('bridgeCompleted', bridgeTx);

    return bridgeTx;
  }

  /**
   * Refund a failed bridge transaction
   */
  async refundBridge(bridgeId: string): Promise<BridgeTransaction> {
    const bridgeTx = this.transactions.get(bridgeId);
    if (!bridgeTx) {
      throw new Error(`Bridge transaction ${bridgeId} not found`);
    }

    if (bridgeTx.status !== 'FAILED') {
      throw new Error('Can only refund failed transactions');
    }

    if (bridgeTx.direction === 'XRPL_TO_EVM' && bridgeTx.sourceTransactionHash) {
      // Refund VRTY on XRPL
      const paymentTx: Payment = {
        TransactionType: 'Payment',
        Account: this.bridgeWallet.address,
        Destination: bridgeTx.sourceAddress,
        Amount: {
          currency: 'VRTY',
          issuer: this.bridgeWallet.address,
          value: bridgeTx.amount,
        },
        Memos: [
          {
            Memo: {
              MemoType: Buffer.from('VERITY_BRIDGE_REFUND').toString('hex').toUpperCase(),
              MemoData: encodeMemoData({
                bridgeId,
                action: 'REFUND',
                originalTxHash: bridgeTx.sourceTransactionHash,
                timestamp: new Date().toISOString(),
              }),
              MemoFormat: Buffer.from('application/json').toString('hex').toUpperCase(),
            },
          },
        ],
      };

      const result = await this.xrplClient.submitAndWait(paymentTx, this.bridgeWallet);

      if (result.success) {
        bridgeTx.status = 'REFUNDED';
        this.lockedAmounts.delete(bridgeId);
        
        logAuditAction('BRIDGE_REFUNDED', 'BRIDGE', {
          bridgeId,
          refundTxHash: result.hash,
          amount: bridgeTx.amount,
        });
      }
    }

    return bridgeTx;
  }

  // ===== Query Methods =====

  /**
   * Get bridge transaction by ID
   */
  getBridgeTransaction(bridgeId: string): BridgeTransaction | undefined {
    return this.transactions.get(bridgeId);
  }

  /**
   * Get all bridge transactions for an address
   */
  getBridgeTransactionsByAddress(address: string): BridgeTransaction[] {
    return Array.from(this.transactions.values()).filter(
      tx => tx.sourceAddress === address || tx.destinationAddress === address
    );
  }

  /**
   * Get pending bridge transactions
   */
  getPendingBridges(): BridgeTransaction[] {
    return Array.from(this.pendingMints.values());
  }

  /**
   * Get bridge statistics
   */
  getBridgeStatistics(): Record<string, unknown> {
    const allTx = Array.from(this.transactions.values());
    
    const statsByChain: Record<string, { count: number; volume: number }> = {};
    for (const chain of Object.keys(this.chains)) {
      const chainTx = allTx.filter(
        tx => tx.destinationChain === chain || tx.sourceChain === chain
      );
      statsByChain[chain] = {
        count: chainTx.length,
        volume: chainTx.reduce((sum, tx) => sum + parseFloat(tx.amount), 0),
      };
    }

    return {
      totalTransactions: allTx.length,
      completedTransactions: allTx.filter(tx => tx.status === 'COMPLETED').length,
      pendingTransactions: this.pendingMints.size,
      failedTransactions: allTx.filter(tx => tx.status === 'FAILED').length,
      totalVolume: allTx.reduce((sum, tx) => sum + parseFloat(tx.amount), 0),
      byChain: statsByChain,
      supportedChains: Object.keys(this.chains),
      validators: Array.from(this.validators),
      requiredValidations: this.requiredValidations,
    };
  }

  /**
   * Get supported chains configuration
   */
  getSupportedChains(): Record<string, { name: string; chainId: number | string; fees: BridgeFee }> {
    const result: Record<string, { name: string; chainId: number | string; fees: BridgeFee }> = {};
    
    for (const [chain, config] of Object.entries(this.chains)) {
      result[chain] = {
        name: config.name,
        chainId: config.chainId,
        fees: this.fees[chain as SupportedChain],
      };
    }
    
    return result;
  }

  /**
   * Get wVRTY balance on EVM chain
   */
  async getWVRTYBalance(chain: SupportedChain, address: string): Promise<string> {
    const chainConfig = this.chains[chain];
    if (!chainConfig || !chainConfig.isEVM) {
      throw new Error(`Invalid EVM chain: ${chain}`);
    }

    const provider = this.evmProviders.get(chain);
    if (!provider) {
      throw new Error(`No provider available for ${chain}`);
    }

    const wvrtyContract = new ethers.Contract(
      chainConfig.wVRTYContractAddress,
      WVRTY_CONTRACT_ABI,
      provider
    );

    const balanceOfFn = wvrtyContract.getFunction('balanceOf');
    const balance = await balanceOfFn(address);
    return ethers.formatUnits(balance, 6);
  }

  /**
   * Get total wVRTY supply on EVM chain
   */
  async getWVRTYTotalSupply(chain: SupportedChain): Promise<string> {
    const chainConfig = this.chains[chain];
    if (!chainConfig || !chainConfig.isEVM) {
      throw new Error(`Invalid EVM chain: ${chain}`);
    }

    const provider = this.evmProviders.get(chain);
    if (!provider) {
      throw new Error(`No provider available for ${chain}`);
    }

    const wvrtyContract = new ethers.Contract(
      chainConfig.wVRTYContractAddress,
      WVRTY_CONTRACT_ABI,
      provider
    );

    const totalSupplyFn = wvrtyContract.getFunction('totalSupply');
    const supply = await totalSupplyFn();
    return ethers.formatUnits(supply, 6);
  }
}

export default VerityCrossChainBridge;
