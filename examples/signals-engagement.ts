/**
 * Verity Protocol - Signals Engagement Example
 * 
 * This example demonstrates the proof-of-engagement
 * signals system for content verification.
 */

import { VeritySDK } from '@verity-protocol/sdk';

async function demonstrateSignals() {
  const verity = new VeritySDK({
    network: 'testnet',
    enableVerification: true,
  });

  await verity.initialize();

  try {
    // Generate wallets for creator and endorser
    const creatorWallet = verity.generateWallet();
    const endorserWallet = verity.generateWallet();

    // Fund wallets (testnet)
    await verity.fundWallet(creatorWallet);
    await verity.fundWallet(endorserWallet);

    console.log('✓ Wallets funded');

    // Creator mints a content NFT
    const { nft } = await verity.signals.mintContentNFT(
      creatorWallet,
      'QmHash123...', // Content hash (IPFS, etc.)
      'https://content.example.com/article/123',
      'article'
    );

    console.log('✓ Content NFT minted:', nft.tokenId);

    // Endorser sends signals to the content
    const signals = [
      { amount: '100000', type: 'ENDORSEMENT' },  // 0.1 XRP
      { amount: '50000', type: 'BOOST' },         // 0.05 XRP
      { amount: '25000', type: 'SUPPORT' },       // 0.025 XRP
    ];

    for (const signal of signals) {
      const { signal: sentSignal } = await verity.signals.send(
        endorserWallet,
        nft.tokenId,
        signal.amount,
        signal.type as any,
        'Great content!'
      );
      console.log(`✓ Signal sent: ${signal.type} - ${signal.amount} drops`);
    }

    // Get content signal statistics
    const stats = verity.signals.getContentStats(nft.tokenId);
    console.log('✓ Content Stats:', stats);

    // Get reputation scores
    const creatorRep = verity.signals.getReputation(creatorWallet.address);
    const endorserRep = verity.signals.getReputation(endorserWallet.address);

    console.log('✓ Creator Reputation:', creatorRep?.reputationScore);
    console.log('✓ Endorser Reputation:', endorserRep?.reputationScore);

    // Get leaderboard
    const leaderboard = verity.signals.getLeaderboard(10);
    console.log('✓ Top 10 Reputation:', leaderboard);

    // Discover high-engagement content
    const trending = verity.signals.discover({
      minSignals: 3,
      sortBy: 'value',
      limit: 10,
    });
    console.log('✓ Trending Content:', trending);

    // View the transparent algorithm
    const algorithm = verity.signals.getAlgorithm();
    console.log('✓ Reputation Algorithm:', JSON.stringify(algorithm, null, 2));

  } finally {
    await verity.disconnect();
  }
}

demonstrateSignals().catch(console.error);
