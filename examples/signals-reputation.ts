/**
 * Verity Protocol - Signals & Reputation Example
 * 
 * This example demonstrates the proof-of-engagement system:
 * - Minting content NFTs
 * - Sending micro-XRP signals
 * - Building reputation scores
 * - Content discovery
 * 
 * @module examples/signals-reputation
 */

// ============================================================
// SETUP
// ============================================================

const API_BASE = process.env.API_BASE || 'http://localhost:3000/api/v1';
const API_KEY = process.env.VERITY_API_KEY || 'your_api_key';

const headers = {
  'Content-Type': 'application/json',
  'X-API-Key': API_KEY,
};

// ============================================================
// EXAMPLE 1: Mint Content NFT
// ============================================================

async function mintContentNFT() {
  console.log('\n🎨 Minting Content NFT...\n');

  const response = await fetch(`${API_BASE}/signals/content/mint`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      contentHash: 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG',
      contentUri: 'https://content.example.com/article/blockchain-future',
      contentType: 'article',
    }),
  });

  const data = await response.json();
  console.log('NFT Minted:', JSON.stringify(data, null, 2));
  
  return data.data;
}

// ============================================================
// EXAMPLE 2: Send Engagement Signal
// ============================================================

async function sendSignal(contentNFTId: string, signalType: string, amount: string) {
  console.log(`\n⚡ Sending ${signalType} Signal (${amount} drops)...\n`);

  const response = await fetch(`${API_BASE}/signals/send`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      contentNFTId,
      amount, // In XRP drops (1 XRP = 1,000,000 drops)
      signalType, // ENDORSEMENT, BOOST, SUPPORT, CHALLENGE, REPLY
      message: `Great content! Supporting with ${signalType}.`,
    }),
  });

  const data = await response.json();
  console.log('Signal Sent:', JSON.stringify(data, null, 2));
  
  return data.data;
}

// ============================================================
// EXAMPLE 3: Get Content Stats
// ============================================================

async function getContentStats(tokenId: string) {
  console.log('\n📊 Getting Content Stats...\n');

  const response = await fetch(`${API_BASE}/signals/content/${tokenId}`, { headers });
  const data = await response.json();

  if (data.data.signalStats) {
    console.log('Content Statistics:');
    console.log(`  - Total Signals: ${data.data.signalStats.totalSignals}`);
    console.log(`  - Total Value: ${data.data.signalStats.totalValue} drops`);
    console.log(`  - Unique Endorsers: ${data.data.signalStats.uniqueEndorsers}`);
    console.log(`  - Average Signal: ${data.data.signalStats.averageSignalValue} drops`);
  }

  return data.data;
}

// ============================================================
// EXAMPLE 4: Get Wallet Reputation
// ============================================================

async function getWalletReputation(walletAddress: string) {
  console.log('\n🏆 Getting Wallet Reputation...\n');

  const response = await fetch(`${API_BASE}/signals/reputation/${walletAddress}`, { headers });
  const data = await response.json();

  if (data.data) {
    console.log(`Reputation for ${walletAddress}:`);
    console.log(`  - Total Signals Received: ${data.data.totalSignalsReceived || 0}`);
    console.log(`  - Total Signals Sent: ${data.data.totalSignalsSent || 0}`);
    console.log(`  - Total XRP Received: ${data.data.totalXRPReceived || 0}`);
    console.log(`  - Total XRP Sent: ${data.data.totalXRPSent || 0}`);
    console.log(`  - Reputation Score: ${data.data.reputationScore || 0}`);
    console.log(`  - Rank: ${data.data.rank || 'Unranked'}`);
  }

  return data.data;
}

// ============================================================
// EXAMPLE 5: View Leaderboard
// ============================================================

async function viewLeaderboard(limit: number = 10) {
  console.log('\n🏅 Reputation Leaderboard...\n');

  const response = await fetch(`${API_BASE}/signals/leaderboard?limit=${limit}`, { headers });
  const data = await response.json();

  console.log(`Top ${limit} Reputation Scores:`);
  if (data.data.leaderboard?.length) {
    data.data.leaderboard.forEach((entry: any, index: number) => {
      console.log(`  ${index + 1}. ${entry.wallet}: ${entry.reputationScore} points`);
    });
  } else {
    console.log('  No entries yet');
  }

  return data.data;
}

// ============================================================
// EXAMPLE 6: Discover Content
// ============================================================

async function discoverContent(filters: {
  minSignals?: number;
  minValue?: number;
  contentType?: string;
  creator?: string;
  sortBy?: string;
}) {
  console.log('\n🔍 Discovering Content...\n');

  const params = new URLSearchParams();
  if (filters.minSignals) params.append('minSignals', filters.minSignals.toString());
  if (filters.minValue) params.append('minValue', filters.minValue.toString());
  if (filters.contentType) params.append('contentType', filters.contentType);
  if (filters.creator) params.append('creator', filters.creator);
  if (filters.sortBy) params.append('sortBy', filters.sortBy);

  const response = await fetch(`${API_BASE}/signals/discover?${params}`, { headers });
  const data = await response.json();

  console.log('Discovered Content:');
  if (data.data.content?.length) {
    for (const content of data.data.content) {
      console.log(`  - ${content.tokenId}: ${content.totalSignals} signals, ${content.totalValue} drops`);
    }
  } else {
    console.log('  No content found matching filters');
  }

  return data.data;
}

// ============================================================
// EXAMPLE 7: View Reputation Algorithm
// ============================================================

async function viewReputationAlgorithm() {
  console.log('\n🧮 Reputation Algorithm (Public & Transparent)...\n');

  const response = await fetch(`${API_BASE}/signals/algorithm`, { headers });
  const data = await response.json();

  console.log('Algorithm:', data.data.version || '1.0.0');
  console.log('\nFormula Components:');
  
  const components = data.data.components || data.data.formula?.components || {};
  console.log(`  - Received Score: ${components.receivedScore || 'log10(totalXRPReceived + 1) * 100'}`);
  console.log(`  - Sent Score: ${components.sentScore || 'log10(totalXRPSent + 1) * 50'}`);
  console.log(`  - Engagement Bonus: ${components.engagementBonus || 'min(signalsSent, signalsReceived) * 0.5'}`);
  console.log(`  - Final Score: ${components.finalScore || 'round(receivedScore + sentScore + engagementBonus)'}`);

  console.log('\nAnti-Manipulation Measures:');
  const measures = data.data.antiManipulation || [];
  for (const measure of measures) {
    console.log(`  • ${measure}`);
  }

  return data.data;
}

// ============================================================
// EXAMPLE 8: Complete Engagement Workflow
// ============================================================

async function completeEngagementWorkflow() {
  console.log('\n🔄 Complete Engagement Workflow\n');
  console.log('='.repeat(60));

  // Step 1: Creator mints content NFT
  console.log('\n📝 Step 1: Creator Mints Content NFT');
  console.log('  - Content hash verified');
  console.log('  - NFT minted on XRPL');
  console.log('  - Token ID generated');

  // Step 2: Community sends signals
  console.log('\n⚡ Step 2: Community Sends Signals');
  console.log('  - User A sends ENDORSEMENT (100,000 drops)');
  console.log('  - User B sends BOOST (500,000 drops)');
  console.log('  - User C sends SUPPORT (50,000 drops)');
  console.log('  - Each signal requires on-chain XRP payment');

  // Step 3: Reputation updates
  console.log('\n📈 Step 3: Reputation Updates');
  console.log('  - Creator reputation increases');
  console.log('  - Signaler reputation increases');
  console.log('  - Leaderboard updated');

  // Step 4: Content discovery
  console.log('\n🔍 Step 4: Content Discovery');
  console.log('  - Content appears in trending');
  console.log('  - Sorted by signal value');
  console.log('  - Quality content surfaces');

  // View the algorithm for transparency
  await viewReputationAlgorithm();

  console.log('\n' + '='.repeat(60));
  console.log('✅ Engagement workflow complete!');
}

// ============================================================
// EXAMPLE 9: Reputation Calculation Demo
// ============================================================

function calculateReputation(
  totalXRPReceived: number,
  totalXRPSent: number,
  totalSignalsReceived: number,
  totalSignalsSent: number
): number {
  // Exact formula from the protocol
  const receivedScore = Math.log10(totalXRPReceived + 1) * 100;
  const sentScore = Math.log10(totalXRPSent + 1) * 50;
  const engagementBonus = Math.min(totalSignalsSent, totalSignalsReceived) * 0.5;
  const finalScore = Math.round(receivedScore + sentScore + engagementBonus);

  return finalScore;
}

async function demonstrateReputationCalculation() {
  console.log('\n🧮 Reputation Calculation Demo\n');

  const scenarios = [
    { name: 'New User', received: 0, sent: 0, signalsReceived: 0, signalsSent: 0 },
    { name: 'Content Creator', received: 1000000, sent: 100000, signalsReceived: 50, signalsSent: 10 },
    { name: 'Active Engager', received: 100000, sent: 1000000, signalsReceived: 20, signalsSent: 100 },
    { name: 'Power User', received: 10000000, sent: 5000000, signalsReceived: 200, signalsSent: 150 },
  ];

  console.log('Scenario Analysis:');
  console.log('-'.repeat(70));
  
  for (const scenario of scenarios) {
    const score = calculateReputation(
      scenario.received,
      scenario.sent,
      scenario.signalsReceived,
      scenario.signalsSent
    );
    
    console.log(`${scenario.name}:`);
    console.log(`  Received: ${scenario.received} drops | Sent: ${scenario.sent} drops`);
    console.log(`  Signals In: ${scenario.signalsReceived} | Signals Out: ${scenario.signalsSent}`);
    console.log(`  → Reputation Score: ${score}`);
    console.log('');
  }
}

// ============================================================
// MAIN EXECUTION
// ============================================================

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║       Verity Protocol - Signals & Reputation Example         ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  try {
    // View algorithm for transparency
    await viewReputationAlgorithm();

    // Demonstrate reputation calculation
    await demonstrateReputationCalculation();

    // View leaderboard
    await viewLeaderboard(5);

    // Complete workflow demonstration
    await completeEngagementWorkflow();

    console.log('\n✅ Signals & reputation example completed!');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run if executed directly
main().catch(console.error);

export {
  mintContentNFT,
  sendSignal,
  getContentStats,
  getWalletReputation,
  viewLeaderboard,
  discoverContent,
  viewReputationAlgorithm,
  calculateReputation,
};
