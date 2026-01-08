/**
 * Verity Protocol - Signals Protocol
 * Verified Proof-of-Engagement System
 * 
 * Micro-XRP signals create sybil-resistant engagement metrics
 * that provide verifiable social proof on the XRP Ledger.
 */

import { Wallet, Payment, NFTokenMint, NFTokenCreateOffer } from 'xrpl';
import { EventEmitter } from 'eventemitter3';
import { XRPLClient, TransactionResult } from '../core/XRPLClient.js';
import { logger, logAuditAction } from '../utils/logger.js';
import { generateId, generateVerificationHash, encodeMemoData, sha256 } from '../utils/crypto.js';
import type {
  Signal,
  SignalType,
  SignalConfig,
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
 */
export class VeritySignalsProtocol extends EventEmitter {
  private xrplClient: XRPLClient;
  
  // In-memory storage (would be database in production)
  private signals: Map<string, Signal> = new Map();
  private contentNFTs: Map<string, ContentNFT> = new Map();
  private reputationScores: Map<string, ReputationScore> = new Map();
  private contentCreators: Map<string, ContentCreator> = new Map();
  
  // Signal aggregation by content
  private signalsByContent: Map<string, Signal[]> = new Map();
  // Signal aggregation by sender
  private signalsBySender: Map<string, Signal[]> = new Map();
  // Signal aggregation by recipient
  private signalsByRecipient: Map<string, Signal[]> = new Map();

  constructor(xrplClient: XRPLClient) {
    super();
    this.xrplClient = xrplClient;
    logger.info('Verity Signals Protocol initialized');
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
      NFTokenTaxon: 1, // Verity Content taxon
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

    // Extract NFT ID from transaction result (simplified - would parse from meta in production)
    const tokenId = generateId('NFT');

    const contentNFT: ContentNFT = {
      tokenId,
      creator: creatorWallet.address,
      contentHash,
      contentType,
      uri: contentUri,
      totalSignals: 0,
      totalValue: '0',
      createdAt: new Date(),
    };

    // Store the NFT
    this.contentNFTs.set(tokenId, contentNFT);
    this.signalsByContent.set(tokenId, []);

    // Update or create content creator profile
    this.updateContentCreator(creatorWallet.address, true);

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
    amount: string, // XRP drops
    signalType: SignalType,
    message?: string
  ): Promise<{ signal: Signal; result: TransactionResult }> {
    // Validate minimum amount
    if (BigInt(amount) < BigInt(MIN_SIGNAL_DROPS)) {
      throw new Error(`Signal amount must be at least ${MIN_SIGNAL_DROPS} drops`);
    }

    const contentNFT = this.contentNFTs.get(contentNFTId);
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

    // Create signal record
    const signal: Signal = {
      id: signalId,
      sender: senderWallet.address,
      recipient: contentNFT.creator,
      contentNFTId,
      signalType,
      amount,
      timestamp: new Date(),
      transactionHash: result.hash,
      verificationHash,
    };

    // Store signal
    this.signals.set(signalId, signal);

    // Update aggregations
    this.addSignalToAggregations(signal);

    // Update content NFT stats
    contentNFT.totalSignals++;
    contentNFT.totalValue = (BigInt(contentNFT.totalValue) + BigInt(amount)).toString();

    // Update reputation scores
    await this.updateVerifiedReputationScores(contentNFT, senderWallet.address, amount);

    logAuditAction('SIGNAL_SENT', senderWallet.address, {
      signalId,
      contentNFTId,
      signalType,
      amount,
      recipient: contentNFT.creator,
      transactionHash: result.hash,
    });

    this.emit('signalSent', signal);

    return { signal, result };
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
   * Update reputation scores after a signal
   */
  private async updateVerifiedReputationScores(
    contentNFT: ContentNFT,
    senderAddress: string,
    amount: string
  ): Promise<void> {
    // Update sender reputation
    let senderScore = this.reputationScores.get(senderAddress);
    if (!senderScore) {
      senderScore = {
        wallet: senderAddress,
        totalSignalsReceived: 0,
        totalSignalsSent: 0,
        totalXRPReceived: '0',
        totalXRPSent: '0',
        reputationScore: 0,
        lastUpdated: new Date(),
      };
    }
    senderScore.totalSignalsSent++;
    senderScore.totalXRPSent = (BigInt(senderScore.totalXRPSent) + BigInt(amount)).toString();
    senderScore.reputationScore = this.calculateReputationScore(senderScore);
    senderScore.lastUpdated = new Date();
    this.reputationScores.set(senderAddress, senderScore);

    // Update recipient reputation
    let recipientScore = this.reputationScores.get(contentNFT.creator);
    if (!recipientScore) {
      recipientScore = {
        wallet: contentNFT.creator,
        totalSignalsReceived: 0,
        totalSignalsSent: 0,
        totalXRPReceived: '0',
        totalXRPSent: '0',
        reputationScore: 0,
        lastUpdated: new Date(),
      };
    }
    recipientScore.totalSignalsReceived++;
    recipientScore.totalXRPReceived = (BigInt(recipientScore.totalXRPReceived) + BigInt(amount)).toString();
    recipientScore.reputationScore = this.calculateReputationScore(recipientScore);
    recipientScore.lastUpdated = new Date();
    this.reputationScores.set(contentNFT.creator, recipientScore);

    // Update content creator profile
    this.updateContentCreator(contentNFT.creator, false);
  }

  /**
   * Calculate reputation score based on signal activity
   * Algorithm is publicly transparent for verification
   */
  private calculateReputationScore(score: ReputationScore): number {
    // Base score from signals received (weighted by value)
    const receivedValue = Number(BigInt(score.totalXRPReceived) / BigInt(1000000)); // Convert to XRP
    const sentValue = Number(BigInt(score.totalXRPSent) / BigInt(1000000));

    // Reputation formula (transparent)
    // - Receiving signals increases reputation
    // - Sending signals also increases reputation (shows engagement)
    // - Logarithmic scaling to prevent runaway scores
    const receivedScore = Math.log10(receivedValue + 1) * 100;
    const sentScore = Math.log10(sentValue + 1) * 50;
    const engagementBonus = Math.min(score.totalSignalsSent, score.totalSignalsReceived) * 0.5;

    return Math.round(receivedScore + sentScore + engagementBonus);
  }

  /**
   * Add signal to aggregation maps
   */
  private addSignalToAggregations(signal: Signal): void {
    // By content
    const contentSignals = this.signalsByContent.get(signal.contentNFTId) || [];
    contentSignals.push(signal);
    this.signalsByContent.set(signal.contentNFTId, contentSignals);

    // By sender
    const senderSignals = this.signalsBySender.get(signal.sender) || [];
    senderSignals.push(signal);
    this.signalsBySender.set(signal.sender, senderSignals);

    // By recipient
    const recipientSignals = this.signalsByRecipient.get(signal.recipient) || [];
    recipientSignals.push(signal);
    this.signalsByRecipient.set(signal.recipient, recipientSignals);
  }

  /**
   * Update content creator profile
   */
  private updateContentCreator(wallet: string, newContent: boolean): void {
    let creator = this.contentCreators.get(wallet);
    if (!creator) {
      creator = {
        wallet,
        totalContent: 0,
        totalSignalsReceived: 0,
        totalValueReceived: '0',
        reputationScore: 0,
        joinedAt: new Date(),
      };
    }

    if (newContent) {
      creator.totalContent++;
    }

    // Recalculate from reputation score
    const repScore = this.reputationScores.get(wallet);
    if (repScore) {
      creator.totalSignalsReceived = repScore.totalSignalsReceived;
      creator.totalValueReceived = repScore.totalXRPReceived;
      creator.reputationScore = repScore.reputationScore;
    }

    this.contentCreators.set(wallet, creator);
  }

  /**
   * Get signal statistics for a content NFT
   */
  getContentSignalStats(contentNFTId: string): SignalStats | null {
    const signals = this.signalsByContent.get(contentNFTId);
    if (!signals || signals.length === 0) {
      return null;
    }

    // Calculate stats
    const totalValue = signals.reduce(
      (sum, s) => BigInt(sum) + BigInt(s.amount),
      BigInt(0)
    );

    const uniqueEndorsers = new Set(signals.map((s) => s.sender)).size;

    // Calculate top endorsers
    const endorserValues: Map<string, { total: bigint; count: number }> = new Map();
    for (const signal of signals) {
      const existing = endorserValues.get(signal.sender) || { total: BigInt(0), count: 0 };
      existing.total += BigInt(signal.amount);
      existing.count++;
      endorserValues.set(signal.sender, existing);
    }

    const topEndorsers = Array.from(endorserValues.entries())
      .map(([wallet, data]) => ({
        wallet,
        totalValue: data.total.toString(),
        count: data.count,
      }))
      .sort((a, b) => Number(BigInt(b.totalValue) - BigInt(a.totalValue)))
      .slice(0, 10);

    return {
      totalSignals: signals.length,
      totalValue: totalValue.toString(),
      uniqueEndorsers,
      averageSignalValue: (totalValue / BigInt(signals.length)).toString(),
      topEndorsers,
    };
  }

  /**
   * Get reputation score for a wallet
   */
  getReputationScore(wallet: string): ReputationScore | undefined {
    return this.reputationScores.get(wallet);
  }

  /**
   * Get reputation leaderboard
   */
  getReputationLeaderboard(limit = 100): ReputationScore[] {
    return Array.from(this.reputationScores.values())
      .sort((a, b) => b.reputationScore - a.reputationScore)
      .slice(0, limit)
      .map((score, index) => ({
        ...score,
        rank: index + 1,
      }));
  }

  /**
   * Get content NFT by ID
   */
  getContentNFT(tokenId: string): ContentNFT | undefined {
    return this.contentNFTs.get(tokenId);
  }

  /**
   * Get all content NFTs by creator
   */
  getContentByCreator(wallet: string): ContentNFT[] {
    return Array.from(this.contentNFTs.values()).filter(
      (nft) => nft.creator === wallet
    );
  }

  /**
   * Get signals sent by a wallet
   */
  getSignalsSentBy(wallet: string): Signal[] {
    return this.signalsBySender.get(wallet) || [];
  }

  /**
   * Get signals received by a wallet
   */
  getSignalsReceivedBy(wallet: string): Signal[] {
    return this.signalsByRecipient.get(wallet) || [];
  }

  /**
   * Get content creator profile
   */
  getContentCreator(wallet: string): ContentCreator | undefined {
    return this.contentCreators.get(wallet);
  }

  /**
   * Search content by various criteria
   */
  discoverContent(
    criteria: {
      minSignals?: number;
      minValue?: string;
      contentType?: string;
      creator?: string;
      sortBy?: 'signals' | 'value' | 'recent';
      limit?: number;
    }
  ): ContentNFT[] {
    let results = Array.from(this.contentNFTs.values());

    // Apply filters
    if (criteria.minSignals !== undefined) {
      results = results.filter((nft) => nft.totalSignals >= criteria.minSignals!);
    }
    if (criteria.minValue !== undefined) {
      results = results.filter(
        (nft) => BigInt(nft.totalValue) >= BigInt(criteria.minValue!)
      );
    }
    if (criteria.contentType) {
      results = results.filter((nft) => nft.contentType === criteria.contentType);
    }
    if (criteria.creator) {
      results = results.filter((nft) => nft.creator === criteria.creator);
    }

    // Sort
    switch (criteria.sortBy) {
      case 'signals':
        results.sort((a, b) => b.totalSignals - a.totalSignals);
        break;
      case 'value':
        results.sort((a, b) => Number(BigInt(b.totalValue) - BigInt(a.totalValue)));
        break;
      case 'recent':
      default:
        results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }

    // Limit
    if (criteria.limit) {
      results = results.slice(0, criteria.limit);
    }

    return results;
  }

  /**
   * Verify a signal exists on-chain
   */
  async verifySignal(signalId: string): Promise<{
    verified: boolean;
    signal?: Signal;
    onChainData?: Record<string, unknown>;
  }> {
    const signal = this.signals.get(signalId);
    if (!signal) {
      return { verified: false };
    }

    try {
      const txData = await this.xrplClient.getTransaction(signal.transactionHash);
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
