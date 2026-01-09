/**
 * Verity Protocol - Signals Protocol Tests
 * Tests for micro-XRP endorsements and reputation scoring
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the XRPL Client
vi.mock('../../src/core/XRPLClient.js', () => ({
  XRPLClient: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    connected: vi.fn().mockReturnValue(true),
    submitAndWait: vi.fn().mockResolvedValue({
      success: true,
      hash: 'MOCK_TX_HASH_' + Math.random().toString(36).slice(2),
    }),
    getTransaction: vi.fn().mockResolvedValue({
      result: { validated: true },
    }),
  })),
}));

// Import after mocks
import { VeritySignalsProtocol } from '../../src/signals/SignalsProtocol.js';

describe('VeritySignalsProtocol', () => {
  let signalsProtocol: VeritySignalsProtocol;
  let mockXrplClient: any;
  let mockCreatorWallet: any;
  let mockSenderWallet: any;

  beforeEach(() => {
    mockXrplClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      connected: vi.fn().mockReturnValue(true),
      submitAndWait: vi.fn().mockResolvedValue({
        success: true,
        hash: 'MOCK_TX_HASH_' + Math.random().toString(36).slice(2),
      }),
      getTransaction: vi.fn().mockResolvedValue({
        result: { validated: true },
      }),
    };

    mockCreatorWallet = {
      address: 'rCreatorWalletxxxxxxxxxxxxxxxx',
      seed: 'sCreatorSeedxxxxxxxxxxxxxxxxxxxxxx',
    };

    mockSenderWallet = {
      address: 'rSenderWalletxxxxxxxxxxxxxxxxx',
      seed: 'sSenderSeedxxxxxxxxxxxxxxxxxxxxxx',
    };

    signalsProtocol = new VeritySignalsProtocol(mockXrplClient as any);
  });

  describe('Content NFT Minting', () => {
    it('should mint a content NFT', async () => {
      const result = await signalsProtocol.mintContentNFT(
        mockCreatorWallet as any,
        'abc123contenthashabc123contenthash',
        'https://example.com/content/123',
        'article'
      );

      expect(result.nft).toBeDefined();
      expect(result.nft.creator).toBe(mockCreatorWallet.address);
      expect(result.nft.contentType).toBe('article');
      expect(result.nft.totalSignals).toBe(0);
      expect(result.nft.totalValue).toBe('0');
      expect(result.result.success).toBe(true);
    });

    it('should store content NFT for retrieval', async () => {
      const { nft } = await signalsProtocol.mintContentNFT(
        mockCreatorWallet as any,
        'uniquecontenthash1234567890',
        'https://example.com/content/456',
        'video'
      );

      const retrieved = signalsProtocol.getContentNFT(nft.tokenId);
      expect(retrieved).toBeDefined();
      expect(retrieved?.tokenId).toBe(nft.tokenId);
      expect(retrieved?.contentType).toBe('video');
    });

    it('should update content creator profile', async () => {
      await signalsProtocol.mintContentNFT(
        mockCreatorWallet as any,
        'contenthash1',
        'https://example.com/1',
        'article'
      );

      await signalsProtocol.mintContentNFT(
        mockCreatorWallet as any,
        'contenthash2',
        'https://example.com/2',
        'article'
      );

      const creator = signalsProtocol.getContentCreator(mockCreatorWallet.address);
      expect(creator).toBeDefined();
      expect(creator?.totalContent).toBe(2);
    });
  });

  describe('Signal Sending', () => {
    let contentNFT: any;

    beforeEach(async () => {
      const result = await signalsProtocol.mintContentNFT(
        mockCreatorWallet as any,
        'contenthashforsignals',
        'https://example.com/content',
        'article'
      );
      contentNFT = result.nft;
    });

    it('should send a verified signal', async () => {
      const result = await signalsProtocol.sendVerifiedSignal(
        mockSenderWallet as any,
        contentNFT.tokenId,
        '100000', // 0.1 XRP in drops
        'ENDORSEMENT',
        'Great content!'
      );

      expect(result.signal).toBeDefined();
      expect(result.signal.sender).toBe(mockSenderWallet.address);
      expect(result.signal.recipient).toBe(mockCreatorWallet.address);
      expect(result.signal.amount).toBe('100000');
      expect(result.signal.signalType).toBe('ENDORSEMENT');
      expect(result.signal.verificationHash).toBeDefined();
    });

    it('should reject signals below minimum amount', async () => {
      await expect(
        signalsProtocol.sendVerifiedSignal(
          mockSenderWallet as any,
          contentNFT.tokenId,
          '5', // Below minimum of 10 drops
          'ENDORSEMENT'
        )
      ).rejects.toThrow('Signal amount must be at least');
    });

    it('should update content NFT stats after signal', async () => {
      await signalsProtocol.sendVerifiedSignal(
        mockSenderWallet as any,
        contentNFT.tokenId,
        '100000',
        'ENDORSEMENT'
      );

      await signalsProtocol.sendVerifiedSignal(
        mockSenderWallet as any,
        contentNFT.tokenId,
        '50000',
        'BOOST'
      );

      const updated = signalsProtocol.getContentNFT(contentNFT.tokenId);
      expect(updated?.totalSignals).toBe(2);
      expect(updated?.totalValue).toBe('150000');
    });

    it('should reject signals for non-existent content', async () => {
      await expect(
        signalsProtocol.sendVerifiedSignal(
          mockSenderWallet as any,
          'NON_EXISTENT_NFT',
          '100000',
          'ENDORSEMENT'
        )
      ).rejects.toThrow('Content NFT');
    });

    it('should support different signal types', async () => {
      const signalTypes = ['ENDORSEMENT', 'BOOST', 'SUPPORT', 'CHALLENGE', 'REPLY'] as const;

      for (const signalType of signalTypes) {
        const { signal } = await signalsProtocol.sendVerifiedSignal(
          mockSenderWallet as any,
          contentNFT.tokenId,
          '10000',
          signalType
        );
        expect(signal.signalType).toBe(signalType);
      }
    });
  });

  describe('Batch Signals', () => {
    let contentNFTs: any[] = [];

    beforeEach(async () => {
      for (let i = 0; i < 3; i++) {
        const { nft } = await signalsProtocol.mintContentNFT(
          mockCreatorWallet as any,
          `contenthash${i}`,
          `https://example.com/content/${i}`,
          'article'
        );
        contentNFTs.push(nft);
      }
    });

    it('should send batch signals', async () => {
      const results = await signalsProtocol.sendBatchSignals(
        mockSenderWallet as any,
        contentNFTs.map((nft, i) => ({
          contentNFTId: nft.tokenId,
          amount: String((i + 1) * 10000),
          signalType: 'ENDORSEMENT' as const,
        }))
      );

      expect(results.length).toBe(3);
      results.forEach((result, i) => {
        expect(result.signal).toBeDefined();
        expect(result.signal.amount).toBe(String((i + 1) * 10000));
      });
    });
  });

  describe('Reputation Scoring', () => {
    let contentNFT: any;

    beforeEach(async () => {
      const result = await signalsProtocol.mintContentNFT(
        mockCreatorWallet as any,
        'contenthashforreputation',
        'https://example.com/content',
        'article'
      );
      contentNFT = result.nft;
    });

    it('should track sender reputation', async () => {
      await signalsProtocol.sendVerifiedSignal(
        mockSenderWallet as any,
        contentNFT.tokenId,
        '1000000', // 1 XRP
        'ENDORSEMENT'
      );

      const senderScore = signalsProtocol.getReputationScore(mockSenderWallet.address);
      expect(senderScore).toBeDefined();
      expect(senderScore?.totalSignalsSent).toBe(1);
      expect(senderScore?.totalXRPSent).toBe('1000000');
      expect(senderScore?.reputationScore).toBeGreaterThan(0);
    });

    it('should track recipient reputation', async () => {
      await signalsProtocol.sendVerifiedSignal(
        mockSenderWallet as any,
        contentNFT.tokenId,
        '1000000',
        'ENDORSEMENT'
      );

      const recipientScore = signalsProtocol.getReputationScore(mockCreatorWallet.address);
      expect(recipientScore).toBeDefined();
      expect(recipientScore?.totalSignalsReceived).toBe(1);
      expect(recipientScore?.totalXRPReceived).toBe('1000000');
    });

    it('should calculate reputation with logarithmic scaling', async () => {
      // Send multiple signals of increasing value
      for (let i = 0; i < 5; i++) {
        await signalsProtocol.sendVerifiedSignal(
          mockSenderWallet as any,
          contentNFT.tokenId,
          '1000000000', // 1000 XRP each
          'ENDORSEMENT'
        );
      }

      const score = signalsProtocol.getReputationScore(mockCreatorWallet.address);
      // Score should be significant but not astronomical due to log scaling
      expect(score?.reputationScore).toBeGreaterThan(100);
      expect(score?.reputationScore).toBeLessThan(10000);
    });

    it('should provide reputation leaderboard', async () => {
      // Create multiple content creators with signals
      const creators = ['rCreator1xxx', 'rCreator2xxx', 'rCreator3xxx'];
      
      for (const creator of creators) {
        const { nft } = await signalsProtocol.mintContentNFT(
          { address: creator } as any,
          `hash${creator}`,
          `https://example.com/${creator}`,
          'article'
        );

        await signalsProtocol.sendVerifiedSignal(
          mockSenderWallet as any,
          nft.tokenId,
          '100000',
          'ENDORSEMENT'
        );
      }

      const leaderboard = signalsProtocol.getReputationLeaderboard(10);
      expect(leaderboard.length).toBeGreaterThan(0);
      expect(leaderboard[0].rank).toBe(1);
    });
  });

  describe('Signal Statistics', () => {
    let contentNFT: any;

    beforeEach(async () => {
      const result = await signalsProtocol.mintContentNFT(
        mockCreatorWallet as any,
        'contenthashforstats',
        'https://example.com/content',
        'article'
      );
      contentNFT = result.nft;
    });

    it('should calculate content signal stats', async () => {
      // Send signals from multiple wallets
      const wallets = [
        { address: 'rSender1xxxx' },
        { address: 'rSender2xxxx' },
        { address: 'rSender3xxxx' },
      ];

      for (const wallet of wallets) {
        await signalsProtocol.sendVerifiedSignal(
          wallet as any,
          contentNFT.tokenId,
          '100000',
          'ENDORSEMENT'
        );
      }

      const stats = signalsProtocol.getContentSignalStats(contentNFT.tokenId);
      expect(stats).toBeDefined();
      expect(stats?.totalSignals).toBe(3);
      expect(stats?.totalValue).toBe('300000');
      expect(stats?.uniqueEndorsers).toBe(3);
      expect(stats?.averageSignalValue).toBe('100000');
    });

    it('should track top endorsers', async () => {
      // Send varying amounts from different wallets
      await signalsProtocol.sendVerifiedSignal(
        { address: 'rBigSpender' } as any,
        contentNFT.tokenId,
        '1000000',
        'ENDORSEMENT'
      );

      await signalsProtocol.sendVerifiedSignal(
        { address: 'rSmallSender' } as any,
        contentNFT.tokenId,
        '10000',
        'ENDORSEMENT'
      );

      const stats = signalsProtocol.getContentSignalStats(contentNFT.tokenId);
      expect(stats?.topEndorsers[0].wallet).toBe('rBigSpender');
      expect(stats?.topEndorsers[0].totalValue).toBe('1000000');
    });

    it('should return null for content with no signals', async () => {
      const { nft } = await signalsProtocol.mintContentNFT(
        mockCreatorWallet as any,
        'nosingalscontenthash',
        'https://example.com/empty',
        'article'
      );

      const stats = signalsProtocol.getContentSignalStats(nft.tokenId);
      expect(stats).toBeNull();
    });
  });

  describe('Content Discovery', () => {
    beforeEach(async () => {
      // Create various content with different signal levels
      const contents = [
        { type: 'article', signals: 5, value: '500000' },
        { type: 'video', signals: 10, value: '1000000' },
        { type: 'article', signals: 2, value: '100000' },
        { type: 'podcast', signals: 8, value: '800000' },
      ];

      for (const content of contents) {
        const { nft } = await signalsProtocol.mintContentNFT(
          mockCreatorWallet as any,
          `hash${content.type}${content.signals}`,
          `https://example.com/${content.type}`,
          content.type
        );

        for (let i = 0; i < content.signals; i++) {
          await signalsProtocol.sendVerifiedSignal(
            { address: `rSender${i}` } as any,
            nft.tokenId,
            String(parseInt(content.value) / content.signals),
            'ENDORSEMENT'
          );
        }
      }
    });

    it('should discover content by minimum signals', () => {
      const results = signalsProtocol.discoverContent({
        minSignals: 5,
        sortBy: 'signals',
      });

      expect(results.length).toBeGreaterThanOrEqual(2);
      results.forEach(nft => {
        expect(nft.totalSignals).toBeGreaterThanOrEqual(5);
      });
    });

    it('should filter by content type', () => {
      const results = signalsProtocol.discoverContent({
        contentType: 'article',
      });

      results.forEach(nft => {
        expect(nft.contentType).toBe('article');
      });
    });

    it('should sort by value', () => {
      const results = signalsProtocol.discoverContent({
        sortBy: 'value',
        limit: 10,
      });

      for (let i = 1; i < results.length; i++) {
        expect(BigInt(results[i - 1].totalValue)).toBeGreaterThanOrEqual(
          BigInt(results[i].totalValue)
        );
      }
    });

    it('should limit results', () => {
      const results = signalsProtocol.discoverContent({
        limit: 2,
      });

      expect(results.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Signal Verification', () => {
    let contentNFT: any;
    let signal: any;

    beforeEach(async () => {
      const result = await signalsProtocol.mintContentNFT(
        mockCreatorWallet as any,
        'verifyhash',
        'https://example.com/verify',
        'article'
      );
      contentNFT = result.nft;

      const signalResult = await signalsProtocol.sendVerifiedSignal(
        mockSenderWallet as any,
        contentNFT.tokenId,
        '100000',
        'ENDORSEMENT'
      );
      signal = signalResult.signal;
    });

    it('should verify signal on-chain', async () => {
      const verification = await signalsProtocol.verifySignal(signal.id);
      expect(verification.verified).toBe(true);
      expect(verification.signal).toBeDefined();
      expect(verification.onChainData).toBeDefined();
    });

    it('should return not verified for unknown signals', async () => {
      const verification = await signalsProtocol.verifySignal('UNKNOWN_SIGNAL_ID');
      expect(verification.verified).toBe(false);
    });
  });

  describe('Reputation Algorithm Transparency', () => {
    it('should expose the reputation algorithm', () => {
      const algorithm = signalsProtocol.getReputationAlgorithm();

      expect(algorithm.version).toBeDefined();
      expect(algorithm.description).toBeDefined();
      expect(algorithm.formula).toBeDefined();
      expect(algorithm.formula.components).toBeInstanceOf(Array);
      expect(algorithm.transparency).toBeDefined();
      expect(algorithm.antiManipulation).toBeInstanceOf(Array);
    });

    it('should document anti-manipulation measures', () => {
      const algorithm = signalsProtocol.getReputationAlgorithm();
      const measures = algorithm.antiManipulation as string[];

      expect(measures.some(m => m.includes('Minimum'))).toBe(true);
      expect(measures.some(m => m.includes('Logarithmic'))).toBe(true);
      expect(measures.some(m => m.includes('Sybil'))).toBe(true);
    });
  });

  describe('Signal Retrieval', () => {
    let contentNFT: any;

    beforeEach(async () => {
      const result = await signalsProtocol.mintContentNFT(
        mockCreatorWallet as any,
        'retrievalhash',
        'https://example.com/retrieval',
        'article'
      );
      contentNFT = result.nft;

      // Send signals from multiple senders
      await signalsProtocol.sendVerifiedSignal(
        mockSenderWallet as any,
        contentNFT.tokenId,
        '100000',
        'ENDORSEMENT'
      );

      await signalsProtocol.sendVerifiedSignal(
        { address: 'rAnotherSender' } as any,
        contentNFT.tokenId,
        '200000',
        'BOOST'
      );
    });

    it('should get signals sent by wallet', () => {
      const signals = signalsProtocol.getSignalsSentBy(mockSenderWallet.address);
      expect(signals.length).toBe(1);
      expect(signals[0].sender).toBe(mockSenderWallet.address);
    });

    it('should get signals received by wallet', () => {
      const signals = signalsProtocol.getSignalsReceivedBy(mockCreatorWallet.address);
      expect(signals.length).toBe(2);
      signals.forEach(s => {
        expect(s.recipient).toBe(mockCreatorWallet.address);
      });
    });

    it('should get content by creator', () => {
      const content = signalsProtocol.getContentByCreator(mockCreatorWallet.address);
      expect(content.length).toBeGreaterThan(0);
      content.forEach(nft => {
        expect(nft.creator).toBe(mockCreatorWallet.address);
      });
    });
  });
});
