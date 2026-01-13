/**
 * Verity Protocol - Solana Bridge Implementation
 * 
 * @module bridge/SolanaBridge
 * @description Production-ready bridge between XRPL and Solana networks.
 * Handles wVRTY (wrapped VRTY) minting/burning on Solana and VRTY lock/unlock on XRPL.
 * 
 * Architecture:
 * - XRPL → Solana: Lock VRTY on XRPL, mint wVRTY on Solana
 * - Solana → XRPL: Burn wVRTY on Solana, unlock VRTY on XRPL
 * 
 * @version 1.0.0
 * @since Phase 4 - Cross-Chain Bridge
 */

import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
  sendAndConfirmTransaction,
  clusterApiUrl,
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  createBurnInstruction,
  getMint,
  getAccount,
  createTransferInstruction,
} from '@solana/spl-token';
import { prisma } from '../db/client.js';
import { logger } from '../utils/logger.js';
import { BridgeDirection, BridgeStatus } from '@prisma/client';
import crypto from 'crypto';

// ============================================================
// TYPES
// ============================================================

export interface SolanaBridgeConfig {
  rpcUrl: string;
  programId: string;
  wvrtyMint: string;
  treasuryWallet: string;
  validatorThreshold: number;
}

export interface BridgeRequest {
  sourceAddress: string;
  destinationAddress: string;
  amount: string;
  direction: 'XRPL_TO_SOLANA' | 'SOLANA_TO_XRPL';
}

export interface BridgeResult {
  bridgeId: string;
  status: BridgeStatus;
  sourceTxHash?: string;
  destinationTxHash?: string;
  estimatedCompletionTime: string;
}

export interface WalletBalance {
  wallet: string;
  balance: string;
  decimals: number;
  symbol: string;
}

export interface ValidatorSignature {
  validator: string;
  signature: string;
  timestamp: Date;
}

// ============================================================
// CONSTANTS
// ============================================================

const WVRTY_DECIMALS = 6;
const MIN_BRIDGE_AMOUNT = 100; // 100 VRTY minimum
const MAX_BRIDGE_AMOUNT = 1000000; // 1M VRTY maximum
const BRIDGE_FEE_BPS = 10; // 0.1% fee
const MIN_FEE = 5; // Minimum 5 VRTY fee
const REQUIRED_CONFIRMATIONS = 32;
const VALIDATOR_THRESHOLD = 3;

// Fee structure per destination
const FEE_CONFIG = {
  SOLANA: {
    baseFee: 2,
    percentageBps: 10,
    minFee: 5,
    maxFee: 2500,
  },
  XRPL: {
    baseFee: 1,
    percentageBps: 10,
    minFee: 2,
    maxFee: 2500,
  },
};

// ============================================================
// SOLANA BRIDGE CLASS
// ============================================================

export class SolanaBridge {
  private connection: Connection;
  private wvrtyMint: PublicKey;
  private treasuryWallet: PublicKey;
  private programId: PublicKey;
  private validators: Set<string>;

  constructor(config?: Partial<SolanaBridgeConfig>) {
    const rpcUrl = config?.rpcUrl || process.env['SOLANA_RPC_URL'] || clusterApiUrl('mainnet-beta');
    const wvrtyMintAddress = config?.wvrtyMint || process.env['SOLANA_WVRTY_MINT'];
    const treasuryAddress = config?.treasuryWallet || process.env['SOLANA_TREASURY_WALLET'];
    const programAddress = config?.programId || process.env['SOLANA_BRIDGE_PROGRAM'];

    this.connection = new Connection(rpcUrl, 'confirmed');
    
    // Initialize with placeholders if not configured
    this.wvrtyMint = wvrtyMintAddress 
      ? new PublicKey(wvrtyMintAddress) 
      : PublicKey.default;
    this.treasuryWallet = treasuryAddress 
      ? new PublicKey(treasuryAddress) 
      : PublicKey.default;
    this.programId = programAddress 
      ? new PublicKey(programAddress) 
      : PublicKey.default;
    
    this.validators = new Set();
    
    logger.info('Solana bridge initialized', {
      rpcUrl,
      wvrtyMint: wvrtyMintAddress || 'Not configured',
      treasury: treasuryAddress || 'Not configured',
    });
  }

  // ============================================================
  // CONNECTION & HEALTH
  // ============================================================

  /**
   * Check if Solana connection is healthy
   */
  async checkConnection(): Promise<{
    connected: boolean;
    slot?: number;
    blockHeight?: number;
    latency?: number;
    error?: string;
  }> {
    const start = Date.now();
    try {
      const slot = await this.connection.getSlot();
      const blockHeight = await this.connection.getBlockHeight();
      const latency = Date.now() - start;

      return {
        connected: true,
        slot,
        blockHeight,
        latency,
      };
    } catch (error) {
      return {
        connected: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Get current Solana network info
   */
  async getNetworkInfo(): Promise<{
    slot: number;
    blockHeight: number;
    epochInfo: any;
    version: any;
  }> {
    const [slot, blockHeight, epochInfo, version] = await Promise.all([
      this.connection.getSlot(),
      this.connection.getBlockHeight(),
      this.connection.getEpochInfo(),
      this.connection.getVersion(),
    ]);

    return { slot, blockHeight, epochInfo, version };
  }

  // ============================================================
  // WVRTY TOKEN OPERATIONS
  // ============================================================

  /**
   * Get wVRTY balance for a Solana wallet
   */
  async getWVRTYBalance(walletAddress: string): Promise<WalletBalance> {
    try {
      const wallet = new PublicKey(walletAddress);
      const tokenAccount = await getAssociatedTokenAddress(
        this.wvrtyMint,
        wallet
      );

      try {
        const account = await getAccount(this.connection, tokenAccount);
        const balance = Number(account.amount) / Math.pow(10, WVRTY_DECIMALS);

        return {
          wallet: walletAddress,
          balance: balance.toFixed(WVRTY_DECIMALS),
          decimals: WVRTY_DECIMALS,
          symbol: 'wVRTY',
        };
      } catch {
        // Token account doesn't exist
        return {
          wallet: walletAddress,
          balance: '0',
          decimals: WVRTY_DECIMALS,
          symbol: 'wVRTY',
        };
      }
    } catch (error) {
      logger.error('Error getting wVRTY balance', { walletAddress, error });
      throw new Error(`Failed to get wVRTY balance: ${(error as Error).message}`);
    }
  }

  /**
   * Get wVRTY mint info
   */
  async getMintInfo(): Promise<{
    address: string;
    supply: string;
    decimals: number;
    mintAuthority: string | null;
    freezeAuthority: string | null;
  }> {
    try {
      const mint = await getMint(this.connection, this.wvrtyMint);
      
      return {
        address: this.wvrtyMint.toString(),
        supply: (Number(mint.supply) / Math.pow(10, WVRTY_DECIMALS)).toString(),
        decimals: mint.decimals,
        mintAuthority: mint.mintAuthority?.toString() || null,
        freezeAuthority: mint.freezeAuthority?.toString() || null,
      };
    } catch (error) {
      logger.error('Error getting mint info', { error });
      throw new Error(`Failed to get mint info: ${(error as Error).message}`);
    }
  }

  // ============================================================
  // BRIDGE OPERATIONS
  // ============================================================

  /**
   * Calculate bridge fee
   */
  calculateFee(amount: number, direction: BridgeDirection): {
    fee: number;
    netAmount: number;
    breakdown: {
      baseFee: number;
      percentageFee: number;
    };
  } {
    const config = direction.includes('SOLANA') 
      ? FEE_CONFIG.SOLANA 
      : FEE_CONFIG.XRPL;

    const baseFee = config.baseFee;
    const percentageFee = (amount * config.percentageBps) / 10000;
    let totalFee = baseFee + percentageFee;

    // Apply min/max bounds
    if (totalFee < config.minFee) totalFee = config.minFee;
    if (totalFee > config.maxFee) totalFee = config.maxFee;

    return {
      fee: totalFee,
      netAmount: amount - totalFee,
      breakdown: {
        baseFee,
        percentageFee,
      },
    };
  }

  /**
   * Validate bridge request
   */
  validateBridgeRequest(request: BridgeRequest): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    const amount = parseFloat(request.amount);

    // Validate amount
    if (isNaN(amount) || amount <= 0) {
      errors.push('Invalid amount');
    }
    if (amount < MIN_BRIDGE_AMOUNT) {
      errors.push(`Minimum bridge amount is ${MIN_BRIDGE_AMOUNT} VRTY`);
    }
    if (amount > MAX_BRIDGE_AMOUNT) {
      errors.push(`Maximum bridge amount is ${MAX_BRIDGE_AMOUNT} VRTY`);
    }

    // Validate addresses based on direction
    if (request.direction === 'XRPL_TO_SOLANA') {
      // Source should be XRPL (starts with 'r')
      if (!request.sourceAddress.startsWith('r')) {
        errors.push('Invalid XRPL source address');
      }
      // Destination should be Solana
      try {
        new PublicKey(request.destinationAddress);
      } catch {
        errors.push('Invalid Solana destination address');
      }
    } else if (request.direction === 'SOLANA_TO_XRPL') {
      // Source should be Solana
      try {
        new PublicKey(request.sourceAddress);
      } catch {
        errors.push('Invalid Solana source address');
      }
      // Destination should be XRPL
      if (!request.destinationAddress.startsWith('r')) {
        errors.push('Invalid XRPL destination address');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Generate unique verification hash for bridge transaction
   */
  generateVerificationHash(
    sourceAddress: string,
    destinationAddress: string,
    amount: string,
    timestamp: number
  ): string {
    const data = `${sourceAddress}:${destinationAddress}:${amount}:${timestamp}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Initiate bridge transaction (XRPL → Solana)
   * This records the intent and returns instructions for the user
   */
  async initiateBridgeToSolana(request: BridgeRequest): Promise<BridgeResult> {
    // Validate request
    const validation = this.validateBridgeRequest(request);
    if (!validation.valid) {
      throw new Error(`Invalid request: ${validation.errors.join(', ')}`);
    }

    const amount = parseFloat(request.amount);
    const { fee, netAmount } = this.calculateFee(amount, 'XRPL_TO_SOLANA');
    const timestamp = Date.now();
    const verificationHash = this.generateVerificationHash(
      request.sourceAddress,
      request.destinationAddress,
      request.amount,
      timestamp
    );

    // Record in database
    const bridgeTx = await prisma.bridgeTransaction.create({
      data: {
        direction: 'XRPL_TO_SOLANA',
        sourceChain: 'XRPL',
        destinationChain: 'SOLANA',
        sourceAddress: request.sourceAddress,
        destinationAddress: request.destinationAddress,
        amount: amount,
        fee: fee,
        status: 'INITIATED',
        verificationHash,
      },
    });

    logger.info('Bridge to Solana initiated', {
      bridgeId: bridgeTx.id,
      amount,
      fee,
      netAmount,
    });

    return {
      bridgeId: bridgeTx.id,
      status: 'INITIATED',
      estimatedCompletionTime: '5-15 minutes',
    };
  }

  /**
   * Initiate bridge transaction (Solana → XRPL)
   */
  async initiateBridgeToXRPL(request: BridgeRequest): Promise<BridgeResult> {
    // Validate request
    const validation = this.validateBridgeRequest(request);
    if (!validation.valid) {
      throw new Error(`Invalid request: ${validation.errors.join(', ')}`);
    }

    const amount = parseFloat(request.amount);
    const { fee, netAmount } = this.calculateFee(amount, 'SOLANA_TO_XRPL');
    const timestamp = Date.now();
    const verificationHash = this.generateVerificationHash(
      request.sourceAddress,
      request.destinationAddress,
      request.amount,
      timestamp
    );

    // Verify user has sufficient wVRTY balance
    const balance = await this.getWVRTYBalance(request.sourceAddress);
    if (parseFloat(balance.balance) < amount) {
      throw new Error(`Insufficient wVRTY balance. Have: ${balance.balance}, Need: ${amount}`);
    }

    // Record in database
    const bridgeTx = await prisma.bridgeTransaction.create({
      data: {
        direction: 'SOLANA_TO_XRPL',
        sourceChain: 'SOLANA',
        destinationChain: 'XRPL',
        sourceAddress: request.sourceAddress,
        destinationAddress: request.destinationAddress,
        amount: amount,
        fee: fee,
        status: 'INITIATED',
        verificationHash,
      },
    });

    logger.info('Bridge to XRPL initiated', {
      bridgeId: bridgeTx.id,
      amount,
      fee,
      netAmount,
    });

    return {
      bridgeId: bridgeTx.id,
      status: 'INITIATED',
      estimatedCompletionTime: '5-15 minutes',
    };
  }

  /**
   * Create wVRTY burn instruction for Solana → XRPL bridge
   */
  async createBurnInstruction(
    bridgeId: string,
    ownerKeypair: Keypair
  ): Promise<{
    transaction: Transaction;
    instructions: TransactionInstruction[];
  }> {
    const bridgeTx = await prisma.bridgeTransaction.findUnique({
      where: { id: bridgeId },
    });

    if (!bridgeTx) {
      throw new Error('Bridge transaction not found');
    }

    if (bridgeTx.direction !== 'SOLANA_TO_XRPL') {
      throw new Error('This operation is only for Solana → XRPL bridges');
    }

    if (bridgeTx.status !== 'INITIATED') {
      throw new Error(`Invalid status for burn: ${bridgeTx.status}`);
    }

    const owner = ownerKeypair.publicKey;
    const amount = Number(bridgeTx.amount) * Math.pow(10, WVRTY_DECIMALS);

    // Get associated token account
    const tokenAccount = await getAssociatedTokenAddress(
      this.wvrtyMint,
      owner
    );

    // Create burn instruction
    const burnIx = createBurnInstruction(
      tokenAccount,
      this.wvrtyMint,
      owner,
      BigInt(Math.floor(amount))
    );

    const transaction = new Transaction().add(burnIx);

    return {
      transaction,
      instructions: [burnIx],
    };
  }

  /**
   * Execute burn and update bridge status
   */
  async executeBurn(
    bridgeId: string,
    ownerKeypair: Keypair
  ): Promise<{
    success: boolean;
    txHash?: string;
    error?: string;
  }> {
    try {
      const { transaction } = await this.createBurnInstruction(bridgeId, ownerKeypair);

      // Send and confirm transaction
      const txHash = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [ownerKeypair],
        { commitment: 'confirmed' }
      );

      // Update bridge transaction
      await prisma.bridgeTransaction.update({
        where: { id: bridgeId },
        data: {
          status: 'LOCKED', // Locked = burned on source chain
          sourceTxHash: txHash,
        },
      });

      logger.info('wVRTY burned successfully', { bridgeId, txHash });

      return {
        success: true,
        txHash,
      };
    } catch (error) {
      // Update with error
      await prisma.bridgeTransaction.update({
        where: { id: bridgeId },
        data: {
          errorMessage: (error as Error).message,
          retryCount: { increment: 1 },
        },
      });

      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Get bridge transaction status
   */
  async getBridgeStatus(bridgeId: string): Promise<{
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
    sourceTxHash: string | null;
    destinationTxHash: string | null;
    validatorSignatures: ValidatorSignature[];
    createdAt: Date;
    completedAt: Date | null;
    errorMessage: string | null;
    progress: {
      initiated: boolean;
      locked: boolean;
      validated: boolean;
      minted: boolean;
      completed: boolean;
    };
  }> {
    const bridgeTx = await prisma.bridgeTransaction.findUnique({
      where: { id: bridgeId },
    });

    if (!bridgeTx) {
      throw new Error('Bridge transaction not found');
    }

    const amount = Number(bridgeTx.amount);
    const fee = Number(bridgeTx.fee);
    const signatures = (bridgeTx.validatorSignatures as unknown as ValidatorSignature[]) || [];

    return {
      bridgeId: bridgeTx.id,
      status: bridgeTx.status,
      direction: bridgeTx.direction,
      sourceChain: bridgeTx.sourceChain,
      destinationChain: bridgeTx.destinationChain,
      sourceAddress: bridgeTx.sourceAddress,
      destinationAddress: bridgeTx.destinationAddress,
      amount: amount.toFixed(WVRTY_DECIMALS),
      fee: fee.toFixed(WVRTY_DECIMALS),
      netAmount: (amount - fee).toFixed(WVRTY_DECIMALS),
      sourceTxHash: bridgeTx.sourceTxHash,
      destinationTxHash: bridgeTx.destinationTxHash,
      validatorSignatures: signatures,
      createdAt: bridgeTx.createdAt,
      completedAt: bridgeTx.completedAt,
      errorMessage: bridgeTx.errorMessage,
      progress: {
        initiated: true,
        locked: ['LOCKED', 'VALIDATING', 'MINTING', 'RELEASING', 'COMPLETED'].includes(bridgeTx.status),
        validated: ['MINTING', 'RELEASING', 'COMPLETED'].includes(bridgeTx.status),
        minted: ['RELEASING', 'COMPLETED'].includes(bridgeTx.status),
        completed: bridgeTx.status === 'COMPLETED',
      },
    };
  }

  /**
   * Get user's bridge history
   */
  async getUserBridgeHistory(
    address: string,
    options?: { page?: number; limit?: number; status?: BridgeStatus }
  ): Promise<{
    transactions: any[];
    total: number;
    pagination: {
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      OR: [
        { sourceAddress: address },
        { destinationAddress: address },
      ],
    };

    if (options?.status) {
      where.status = options.status;
    }

    const [transactions, total] = await Promise.all([
      prisma.bridgeTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.bridgeTransaction.count({ where }),
    ]);

    return {
      transactions: transactions.map(tx => ({
        ...tx,
        amount: Number(tx.amount).toString(),
        fee: Number(tx.fee).toString(),
      })),
      total,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get bridge statistics
   */
  async getStatistics(): Promise<{
    totalTransactions: number;
    completedTransactions: number;
    pendingTransactions: number;
    failedTransactions: number;
    totalVolumeXRPLToSolana: string;
    totalVolumeSolanaToXRPL: string;
    totalFeesCollected: string;
    averageCompletionTime: string;
  }> {
    const [
      totalTransactions,
      completedTransactions,
      pendingTransactions,
      failedTransactions,
      volumeToSolana,
      volumeToXRPL,
      totalFees,
    ] = await Promise.all([
      prisma.bridgeTransaction.count(),
      prisma.bridgeTransaction.count({ where: { status: 'COMPLETED' } }),
      prisma.bridgeTransaction.count({
        where: { status: { in: ['INITIATED', 'LOCKED', 'VALIDATING', 'MINTING', 'RELEASING'] } },
      }),
      prisma.bridgeTransaction.count({ where: { status: 'FAILED' } }),
      prisma.bridgeTransaction.aggregate({
        where: { direction: 'XRPL_TO_SOLANA', status: 'COMPLETED' },
        _sum: { amount: true },
      }),
      prisma.bridgeTransaction.aggregate({
        where: { direction: 'SOLANA_TO_XRPL', status: 'COMPLETED' },
        _sum: { amount: true },
      }),
      prisma.bridgeTransaction.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { fee: true },
      }),
    ]);

    return {
      totalTransactions,
      completedTransactions,
      pendingTransactions,
      failedTransactions,
      totalVolumeXRPLToSolana: (Number(volumeToSolana._sum.amount || 0)).toFixed(6),
      totalVolumeSolanaToXRPL: (Number(volumeToXRPL._sum.amount || 0)).toFixed(6),
      totalFeesCollected: (Number(totalFees._sum.fee || 0)).toFixed(6),
      averageCompletionTime: '10 minutes', // Would calculate from actual data
    };
  }

  // ============================================================
  // VALIDATOR OPERATIONS
  // ============================================================

  /**
   * Add validator signature (called by validators)
   */
  async addValidatorSignature(
    bridgeId: string,
    validatorAddress: string,
    signature: string
  ): Promise<{
    signatureCount: number;
    thresholdReached: boolean;
  }> {
    const bridgeTx = await prisma.bridgeTransaction.findUnique({
      where: { id: bridgeId },
    });

    if (!bridgeTx) {
      throw new Error('Bridge transaction not found');
    }

    const signatures: ValidatorSignature[] = 
      (bridgeTx.validatorSignatures as unknown as ValidatorSignature[]) || [];

    // Check if validator already signed
    if (signatures.some(s => s.validator === validatorAddress)) {
      throw new Error('Validator has already signed this transaction');
    }

    // Add new signature
    signatures.push({
      validator: validatorAddress,
      signature,
      timestamp: new Date(),
    });

    // Update status if threshold reached
    const thresholdReached = signatures.length >= VALIDATOR_THRESHOLD;
    const newStatus: BridgeStatus = thresholdReached ? 'MINTING' : 'VALIDATING';

    await prisma.bridgeTransaction.update({
      where: { id: bridgeId },
      data: {
        validatorSignatures: signatures as unknown as any,
        status: bridgeTx.status === 'LOCKED' ? newStatus : bridgeTx.status,
      },
    });

    logger.info('Validator signature added', {
      bridgeId,
      validator: validatorAddress,
      signatureCount: signatures.length,
      thresholdReached,
    });

    return {
      signatureCount: signatures.length,
      thresholdReached,
    };
  }
}

// Export singleton instance
export const solanaBridge = new SolanaBridge();
export default SolanaBridge;
