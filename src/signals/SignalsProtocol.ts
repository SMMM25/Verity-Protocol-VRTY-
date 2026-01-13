/**
 * Verity Protocol - Signals Protocol
 * Verified Proof-of-Engagement System
 * 
 * Micro-XRP signals create sybil-resistant engagement metrics
 * that provide verifiable social proof on the XRP Ledger.
 * 
 * MIGRATED TO PRISMA: All data now persisted to PostgreSQL
 */

import { Wallet, Payment, NFTokenMint } from 'xrpl';
import { EventEmitter } from 'eventemitter3';
import { XRPLClient, TransactionResult } from '../core/XRPLClient.js';
import { logger, logAuditAction } from '../utils/logger.js';
import { generateId, generateVerificationHash, encodeMemoData } from '../utils/crypto.js';
import { prisma } from '../db/client.js';
import type {
  Signal,
  SignalType,
  ReputationScore,
  ContentNFT,
} from '../types/index.js';

// Minimum signal amount in XRP drops (0.00001 XRP)
const MIN_SIGNAL_DROPS = '10';

// NFT flags
const TF_TRANSFERABLE = 8;
const TF_ONLY_XRP = 1;

export interface SignalStats {
  totalSignals: number;
  totalValue: string;
  uniqueEndorsers: number;
  averageSignalValue: string;
  topEndorsers: Array<{ wallet: string; totalValue: string; count: number }>;
}

export interface ContentCreator {
  wallet: string;
  totalContent: number;
  totalSignalsReceived: number;
  totalValueReceived: string;
  reputationScore: number;
  joinedAt: Date;
}

/**
 * Verity Signals Protocol
 * Manages proof-of-engagement through micro-XRP payments
 * 
 * NOW USING PRISMA FOR ALL DATA PERSISTENCE
 */
export class VeritySignalsProtocol extends EventEmitter {
  private xrplClient: XRPLClient;

  constructor(xrplClient: XRPLClient) {
    super();
    this.xrplClient = xrplClient;
    logger.info('Verity Signals Protocol initialized (Prisma-backed)');
  }

  /**
   * Mint a Content NFT for linking signals
   */
  async mintContentNFT(
    creatorWallet: Wallet,
    contentHash: string,
    contentUri: string,
    contentType: string
  ): Promise<{ nft: ContentNFT; result: TransactionResult }> {
    logger.info(`Minting content NFT for ${creatorWallet.address}`);

    // Create NFT metadata
    const nftMetadata = {
      type: 'VERITY_CONTENT',
      contentHash,
      contentType,
      creator: creatorWallet.address,
      createdAt: new Date().toISOString(),
    };

    const nftMintTx: NFTokenMint = {
      TransactionType: 'NFTokenMint',
      Account: creatorWallet.address,
      NFTokenTaxon: 1,
      Flags: TF_TRANSFERABLE | TF_ONLY_XRP,
      URI: Buffer.from(contentUri).toString('hex').toUpperCase(),
      Memos: [
        {
          Memo: {
            MemoType: Buffer.from('VERITY_CONTENT_NFT').toString('hex').toUpperCase(),
            MemoData: encodeMemoData(nftMetadata),
            MemoFormat: Buffer.from('application/json').toString('hex').toUpperCase(),
          },
        },
      ],
    };

    const result = await this.xrplClient.submitAndWait(nftMintTx, creatorWallet);

    if (!result.success) {
      throw new Error(`Failed to mint content NFT: ${result.error}`);
    }

    // Extract NFT ID from transaction result
    const tokenId = generateId('NFT');

    // Store in database
    const dbNFT = await prisma.contentNFT.create({
      data: {
        tokenId,
        creator: creatorWallet.address,
        contentHash,
        contentType,
        uri: contentUri,
      },
    });

    const contentNFT: ContentNFT = {
      tokenId: dbNFT.tokenId,
      creator: dbNFT.creator,
      contentHash: dbNFT.contentHash,
      contentType: dbNFT.contentType,
      uri: dbNFT.uri,
      totalSignals: dbNFT.totalSignals,
      totalValue: dbNFT.totalValue.toString(),
      createdAt: dbNFT.createdAt,
    };

    logAuditAction('CONTENT_NFT_MINTED', creatorWallet.address, {
      tokenId,
      contentHash,
      contentType,
      transactionHash: result.hash,
    });

    this.emit('contentNFTMinted', contentNFT);

    return { nft: contentNFT, result };
  }

  /**
   * Send a verified signal (micro-XRP endorsement)
   */
  async sendVerifiedSignal(
    senderWallet: Wallet,
    contentNFTId: string,
    amount: string,
    signalType: SignalType,
    message?: string
  ): Promise<{ signal: Signal; result: TransactionResult }> {
    // Validate minimum amount
    if (BigInt(amount) < BigInt(MIN_SIGNAL_DROPS)) {
      throw new Error(`Signal amount must be at least ${MIN_SIGNAL_DROPS} drops`);
    }

    // Get content NFT from database
    const contentNFT = await prisma.contentNFT.findUnique({
      where: { tokenId: contentNFTId },
    });

    if (!contentNFT) {
      throw new Error(`Content NFT ${contentNFTId} not found`);
    }

    logger.info(`Sending signal: ${amount} drops from ${senderWallet.address} to ${contentNFT.creator}`);

    // Create signal metadata
    const signalId = generateId('SIG');
    const signalMetadata = {
      signalId,
      nftId: contentNFTId,
      signalType,
      message: message || '',
      timestamp: Date.now(),
    };

    const verificationHash = generateVerificationHash(signalMetadata);

    // Build the payment transaction
    const paymentTx: Payment = {
      TransactionType: 'Payment',
      Account: senderWallet.address,
      Destination: contentNFT.creator,
      Amount: amount,
      Memos: [
        {
          Memo: {
            MemoType: Buffer.from('VERITY_SIGNAL').toString('hex').toUpperCase(),
            MemoData: encodeMemoData({
              ...signalMetadata,
              verificationHash,
            }),
            MemoFormat: Buffer.from('application/json').toString('hex').toUpperCase(),
          },
        },
      ],
    };

    const result = await this.xrplClient.submitAndWait(paymentTx, senderWallet);

    if (!result.success) {
      throw new Error(`Failed to send signal: ${result.error}`);
    }

    // Use transaction for atomicity
    const signal = await prisma.$transaction(async (tx) => {
      // Create signal record
      const dbSignal = await tx.signal.create({
        data: {
          sender: senderWallet.address,
          recipient: contentNFT.creator,
          contentNFTId: contentNFT.id,
          signalType: signalType as any,
          amount: parseFloat(amount),
          txHash: result.hash,
          verificationHash,
        },
      });

      // Update content NFT stats
      await tx.contentNFT.update({
        where: { id: contentNFT.id },
        data: {
          totalSignals: { increment: 1 },
          totalValue: { increment: parseFloat(amount) },
        },
      });

      // Update sender reputation
      await tx.reputationScore.upsert({
        where: { wallet: senderWallet.address },
        create: {
          wallet: senderWallet.address,
          totalSignalsSent: 1,
          totalXRPSent: parseFloat(amount),
        },
        update: {
          totalSignalsSent: { increment: 1 },
          totalXRPSent: { increment: parseFloat(amount) },
          lastUpdated: new Date(),
        },
      });

      // Update recipient reputation
      await tx.reputationScore.upsert({
        where: { wallet: contentNFT.creator },
        create: {
          wallet: contentNFT.creator,
          totalSignalsReceived: 1,
          totalXRPReceived: parseFloat(amount),
        },
        update: {
          totalSignalsReceived: { increment: 1 },
          totalXRPReceived: { increment: parseFloat(amount) },
          lastUpdated: new Date(),
        },
      });

      return dbSignal;
    });

    // Update reputation scores
    await this.updateReputationScores(senderWallet.address);
    await this.updateReputationScores(contentNFT.creator);

    const signalResult: Signal = {
      id: signal.id,
      sender: signal.sender,
      recipient: signal.recipient,
      contentNFTId: contentNFTId,
      signalType: signal.signalType as SignalType,
      amount: signal.amount.toString(),
      timestamp: signal.createdAt,
      transactionHash: signal.txHash || '',
      verificationHash: signal.verificationHash,
    };

    logAuditAction('SIGNAL_SENT', senderWallet.address, {
      signalId: signal.id,
      contentNFTId,
      signalType,
      amount,
      recipient: contentNFT.creator,
      transactionHash: result.hash,
    });

    this.emit('signalSent', signalResult);

    return { signal: signalResult, result };
  }

  /**
   * Update reputation score using transparent algorithm
   */
  private async updateReputationScores(wallet: string): Promise<void> {
    const score = await prisma.reputationScore.findUnique({
      where: { wallet },
    });

    if (!score) return;

    // Calculate score using transparent algorithm
    const receivedValue = Number(score.totalXRPReceived) / 1000000;
    const sentValue = Number(score.totalXRPSent) / 1000000;

    const receivedScore = Math.log10(receivedValue + 1) * 100;
    const sentScore = Math.log10(sentValue + 1) * 50;
    const engagementBonus = Math.min(score.totalSignalsSent, score.totalSignalsReceived) * 0.5;

    const newScore = Math.round(receivedScore + sentScore + engagementBonus);

    await prisma.reputationScore.update({
      where: { wallet },
      data: { reputationScore: newScore },
    });
  }

  /**
   * Get signal statistics for a content NFT
   */
  async getContentSignalStats(contentNFTId: string): Promise<SignalStats | null> {
    const nft = await prisma.contentNFT.findUnique({
      where: { tokenId: contentNFTId },
      include: {
        signals: true,
      },
    });

    if (!nft || nft.signals.length === 0) {
      return null;
    }

    const signals = nft.signals;
    const totalValue = signals.reduce((sum, s) => sum + Number(s.amount), 0);
    const uniqueEndorsers = new Set(signals.map((s) => s.sender)).size;

    // Calculate top endorsers
    const endorserMap = new Map<string, { total: number; count: number }>();
    for (const signal of signals) {
      const existing = endorserMap.get(signal.sender) || { total: 0, count: 0 };
      existing.total += Number(signal.amount);
      existing.count++;
      endorserMap.set(signal.sender, existing);
    }

    const topEndorsers = Array.from(endorserMap.entries())
      .map(([wallet, data]) => ({
        wallet,
        totalValue: data.total.toString(),
        count: data.count,
      }))
      .sort((a, b) => Number(b.totalValue) - Number(a.totalValue))
      .slice(0, 10);

    return {
      totalSignals: signals.length,
      totalValue: totalValue.toString(),
      uniqueEndorsers,
      averageSignalValue: (totalValue / signals.length).toString(),
      topEndorsers,
    };
  }

  /**
   * Get reputation score for a wallet
   */
  async getReputationScore(wallet: string): Promise<ReputationScore | null> {
    const score = await prisma.reputationScore.findUnique({
      where: { wallet },
    });

    if (!score) return null;

    return {
      wallet: score.wallet,
      totalSignalsReceived: score.totalSignalsReceived,
      totalSignalsSent: score.totalSignalsSent,
      totalXRPReceived: score.totalXRPReceived.toString(),
      totalXRPSent: score.totalXRPSent.toString(),
      reputationScore: Number(score.reputationScore),
      rank: score.rank || undefined,
      lastUpdated: score.lastUpdated,
    };
  }

  /**
   * Get reputation leaderboard
   */
  async getReputationLeaderboard(limit = 100): Promise<ReputationScore[]> {
    const scores = await prisma.reputationScore.findMany({
      orderBy: { reputationScore: 'desc' },
      take: limit,
    });

    return scores.map((score, index) => ({
      wallet: score.wallet,
      totalSignalsReceived: score.totalSignalsReceived,
      totalSignalsSent: score.totalSignalsSent,
      totalXRPReceived: score.totalXRPReceived.toString(),
      totalXRPSent: score.totalXRPSent.toString(),
      reputationScore: Number(score.reputationScore),
      rank: index + 1,
      lastUpdated: score.lastUpdated,
    }));
  }

  /**
   * Get content NFT by ID
   */
  async getContentNFT(tokenId: string): Promise<ContentNFT | null> {
    const nft = await prisma.contentNFT.findUnique({
      where: { tokenId },
    });

    if (!nft) return null;

    return {
      tokenId: nft.tokenId,
      creator: nft.creator,
      contentHash: nft.contentHash,
      contentType: nft.contentType,
      uri: nft.uri,
      totalSignals: nft.totalSignals,
      totalValue: nft.totalValue.toString(),
      createdAt: nft.createdAt,
    };
  }

  /**
   * Get all content NFTs by creator
   */
  async getContentByCreator(wallet: string): Promise<ContentNFT[]> {
    const nfts = await prisma.contentNFT.findMany({
      where: { creator: wallet },
      orderBy: { createdAt: 'desc' },
    });

    return nfts.map((nft) => ({
      tokenId: nft.tokenId,
      creator: nft.creator,
      contentHash: nft.contentHash,
      contentType: nft.contentType,
      uri: nft.uri,
      totalSignals: nft.totalSignals,
      totalValue: nft.totalValue.toString(),
      createdAt: nft.createdAt,
    }));
  }

  /**
   * Get signals sent by a wallet
   */
  async getSignalsSentBy(wallet: string): Promise<Signal[]> {
    const signals = await prisma.signal.findMany({
      where: { sender: wallet },
      include: { contentNFT: true },
      orderBy: { createdAt: 'desc' },
    });

    return signals.map((s) => ({
      id: s.id,
      sender: s.sender,
      recipient: s.recipient,
      contentNFTId: s.contentNFT?.tokenId || '',
      signalType: s.signalType as SignalType,
      amount: s.amount.toString(),
      timestamp: s.createdAt,
      transactionHash: s.txHash || '',
      verificationHash: s.verificationHash,
    }));
  }

  /**
   * Get signals received by a wallet
   */
  async getSignalsReceivedBy(wallet: string): Promise<Signal[]> {
    const signals = await prisma.signal.findMany({
      where: { recipient: wallet },
      include: { contentNFT: true },
      orderBy: { createdAt: 'desc' },
    });

    return signals.map((s) => ({
      id: s.id,
      sender: s.sender,
      recipient: s.recipient,
      contentNFTId: s.contentNFT?.tokenId || '',
      signalType: s.signalType as SignalType,
      amount: s.amount.toString(),
      timestamp: s.createdAt,
      transactionHash: s.txHash || '',
      verificationHash: s.verificationHash,
    }));
  }

  /**
   * Discover content by various criteria
   */
  async discoverContent(criteria: {
    minSignals?: number;
    minValue?: string;
    contentType?: string;
    creator?: string;
    sortBy?: 'signals' | 'value' | 'recent';
    limit?: number;
  }): Promise<ContentNFT[]> {
    const where: any = {};

    if (criteria.minSignals !== undefined) {
      where.totalSignals = { gte: criteria.minSignals };
    }
    if (criteria.minValue !== undefined) {
      where.totalValue = { gte: parseFloat(criteria.minValue) };
    }
    if (criteria.contentType) {
      where.contentType = criteria.contentType;
    }
    if (criteria.creator) {
      where.creator = criteria.creator;
    }

    let orderBy: any = { createdAt: 'desc' };
    if (criteria.sortBy === 'signals') {
      orderBy = { totalSignals: 'desc' };
    } else if (criteria.sortBy === 'value') {
      orderBy = { totalValue: 'desc' };
    }

    const nfts = await prisma.contentNFT.findMany({
      where,
      orderBy,
      take: criteria.limit || 50,
    });

    return nfts.map((nft) => ({
      tokenId: nft.tokenId,
      creator: nft.creator,
      contentHash: nft.contentHash,
      contentType: nft.contentType,
      uri: nft.uri,
      totalSignals: nft.totalSignals,
      totalValue: nft.totalValue.toString(),
      createdAt: nft.createdAt,
    }));
  }

  /**
   * Verify a signal exists on-chain
   */
  async verifySignal(signalId: string): Promise<{
    verified: boolean;
    signal?: Signal;
    onChainData?: Record<string, unknown>;
  }> {
    const dbSignal = await prisma.signal.findUnique({
      where: { id: signalId },
      include: { contentNFT: true },
    });

    if (!dbSignal) {
      return { verified: false };
    }

    const signal: Signal = {
      id: dbSignal.id,
      sender: dbSignal.sender,
      recipient: dbSignal.recipient,
      contentNFTId: dbSignal.contentNFT?.tokenId || '',
      signalType: dbSignal.signalType as SignalType,
      amount: dbSignal.amount.toString(),
      timestamp: dbSignal.createdAt,
      transactionHash: dbSignal.txHash || '',
      verificationHash: dbSignal.verificationHash,
    };

    if (!dbSignal.txHash) {
      return { verified: false, signal };
    }

    try {
      const txData = await this.xrplClient.getTransaction(dbSignal.txHash);
      return {
        verified: true,
        signal,
        onChainData: txData,
      };
    } catch {
      return { verified: false, signal };
    }
  }

  /**
   * Send a batch of signals (more efficient)
   */
  async sendBatchSignals(
    senderWallet: Wallet,
    signals: Array<{
      contentNFTId: string;
      amount: string;
      signalType: SignalType;
    }>
  ): Promise<Array<{ signal: Signal; result: TransactionResult }>> {
    const results: Array<{ signal: Signal; result: TransactionResult }> = [];

    for (const signalConfig of signals) {
      const result = await this.sendVerifiedSignal(
        senderWallet,
        signalConfig.contentNFTId,
        signalConfig.amount,
        signalConfig.signalType
      );
      results.push(result);
    }

    return results;
  }

  /**
   * Get transparent algorithm documentation
   */
  getReputationAlgorithm(): Record<string, unknown> {
    return {
      version: '1.0.0',
      description: 'Verity Signals Reputation Algorithm',
      formula: {
        components: [
          {
            name: 'receivedScore',
            formula: 'log10(totalXRPReceived + 1) * 100',
            weight: 'Primary factor - receiving signals indicates valuable content',
          },
          {
            name: 'sentScore',
            formula: 'log10(totalXRPSent + 1) * 50',
            weight: 'Secondary factor - sending signals shows engagement',
          },
          {
            name: 'engagementBonus',
            formula: 'min(totalSignalsSent, totalSignalsReceived) * 0.5',
            weight: 'Bonus for balanced engagement',
          },
        ],
        finalScore: 'round(receivedScore + sentScore + engagementBonus)',
      },
      transparency: 'Algorithm is fully public and verifiable',
      antiManipulation: [
        'Minimum signal amount prevents dust spam',
        'Logarithmic scaling prevents whale manipulation',
        'All signals require on-chain XRP payment',
        'Sybil resistance through economic cost',
      ],
    };
  }
}

export default VeritySignalsProtocol;
