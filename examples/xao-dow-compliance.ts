/**
 * Verity Protocol - XAO-DOW Compliance Example
 * 
 * This example demonstrates the complete clawback governance workflow
 * using the Compliance Oracle with:
 * - 24-hour public comment period
 * - Multi-signature governance voting
 * - Dispute resolution
 * - Transparency ledger
 * 
 * @module examples/xao-dow-compliance
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
// EXAMPLE 1: Create a Clawback Proposal
// ============================================================

async function createClawbackProposal() {
  console.log('\n📋 Creating Clawback Proposal...\n');

  const response = await fetch(`${API_BASE}/compliance/proposals`, {
    method: 'POST',
    headers: {
      ...headers,
      'X-Wallet-Address': 'rGovernorWallet123456789012345',
    },
    body: JSON.stringify({
      asset: 'VRTY',
      targetWallet: 'rTargetWallet123456789012345678',
      amount: '1000',
      reason: 'FRAUD_DETECTION',
      legalJustification: 'Detected suspicious activity pattern matching known fraud indicators. Transaction analysis shows unauthorized access to compromised wallet.',
      documentationUrls: [
        'https://evidence.example.com/report-001.pdf',
        'https://evidence.example.com/analysis-002.pdf',
      ],
    }),
  });

  const data = await response.json();
  console.log('Response:', JSON.stringify(data, null, 2));
  
  return data.data;
}

// ============================================================
// EXAMPLE 2: Add Public Comments During Comment Period
// ============================================================

async function addPublicComments(proposalId: string) {
  console.log('\n💬 Adding Public Comments...\n');

  // Supporting comment
  const supportingResponse = await fetch(
    `${API_BASE}/compliance/proposals/${proposalId}/comments`,
    {
      method: 'POST',
      headers: {
        ...headers,
        'X-Wallet-Address': 'rCommenter1xxxxxxxxxxxxxxxxxxxxxxx',
      },
      body: JSON.stringify({
        content: 'I support this clawback. The evidence provided clearly shows fraudulent activity. The transaction patterns match known attack vectors.',
        supportClawback: true,
      }),
    }
  );

  console.log('Supporting comment:', await supportingResponse.json());

  // Opposing comment
  const opposingResponse = await fetch(
    `${API_BASE}/compliance/proposals/${proposalId}/comments`,
    {
      method: 'POST',
      headers: {
        ...headers,
        'X-Wallet-Address': 'rCommenter2xxxxxxxxxxxxxxxxxxxxxxx',
      },
      body: JSON.stringify({
        content: 'I oppose this clawback. The target wallet belongs to a legitimate user who may have been hacked. Please investigate further before proceeding.',
        supportClawback: false,
      }),
    }
  );

  console.log('Opposing comment:', await opposingResponse.json());
}

// ============================================================
// EXAMPLE 3: Cast Governance Votes
// ============================================================

async function castGovernanceVotes(proposalId: string) {
  console.log('\n🗳️ Casting Governance Votes...\n');

  const voters = [
    { address: 'rGovernor1xxxxxxxxxxxxxxxxxxxxxx', vote: 'approve', reason: 'Evidence is conclusive' },
    { address: 'rGovernor2xxxxxxxxxxxxxxxxxxxxxx', vote: 'approve', reason: 'Supports fraud prevention' },
    { address: 'rGovernor3xxxxxxxxxxxxxxxxxxxxxx', vote: 'reject', reason: 'Needs more investigation' },
  ];

  for (const voter of voters) {
    const response = await fetch(
      `${API_BASE}/compliance/proposals/${proposalId}/votes`,
      {
        method: 'POST',
        headers: {
          ...headers,
          'X-Wallet-Address': voter.address,
        },
        body: JSON.stringify({
          vote: voter.vote,
          reason: voter.reason,
        }),
      }
    );

    const data = await response.json();
    console.log(`Vote from ${voter.address}:`, data.success ? 'Recorded' : 'Failed');
  }
}

// ============================================================
// EXAMPLE 4: File a Dispute
// ============================================================

async function fileDispute(proposalId: string) {
  console.log('\n⚖️ Filing Dispute...\n');

  const response = await fetch(
    `${API_BASE}/compliance/proposals/${proposalId}/disputes`,
    {
      method: 'POST',
      headers: {
        ...headers,
        'X-Wallet-Address': 'rTargetWallet123456789012345678',
      },
      body: JSON.stringify({
        reason: 'I am the legitimate owner of this wallet. My wallet was compromised through a phishing attack, but I have recovered control. The funds were my legitimate holdings.',
        evidence: [
          'https://evidence.example.com/wallet-ownership-proof.pdf',
          'https://evidence.example.com/police-report.pdf',
          'https://evidence.example.com/recovery-verification.pdf',
        ],
        stakeAmount: '1000000', // 1 XRP in drops
      }),
    }
  );

  const data = await response.json();
  console.log('Dispute filed:', JSON.stringify(data, null, 2));
  
  return data.data;
}

// ============================================================
// EXAMPLE 5: View Transparency Ledger
// ============================================================

async function viewTransparencyLedger(proposalId?: string) {
  console.log('\n📊 Viewing Transparency Ledger...\n');

  const url = proposalId
    ? `${API_BASE}/compliance/transparency/${proposalId}`
    : `${API_BASE}/compliance/transparency?limit=10`;

  const response = await fetch(url, { headers });
  const data = await response.json();

  console.log('Transparency Entries:');
  for (const entry of data.data.entries || []) {
    console.log(`  - [${entry.type}] ${entry.action} (${entry.timestamp})`);
  }
}

// ============================================================
// EXAMPLE 6: Get Governance Statistics
// ============================================================

async function getGovernanceStats() {
  console.log('\n📈 Governance Statistics...\n');

  const response = await fetch(`${API_BASE}/compliance/stats`, { headers });
  const data = await response.json();

  console.log('Statistics:', JSON.stringify(data.data, null, 2));
}

// ============================================================
// EXAMPLE 7: View XAO-DOW Policy (Public)
// ============================================================

async function viewXaoDowPolicy() {
  console.log('\n📜 XAO-DOW Policy...\n');

  const response = await fetch(`${API_BASE}/transparency/xao-dow-policy`, { headers });
  const data = await response.json();

  console.log('Clawback Policy:');
  console.log(`  - Governance Controlled: ${data.data.policy.governanceControlled}`);
  console.log(`  - Minimum Quorum: ${data.data.policy.minimumQuorum}`);
  console.log(`  - Cooldown Period: ${data.data.policy.requirements.cooldownPeriodHours} hours`);
  console.log(`  - Allowed Reasons:`);
  for (const reason of data.data.policy.allowedReasons) {
    console.log(`    • ${reason.code}: ${reason.description}`);
  }
}

// ============================================================
// MAIN EXECUTION
// ============================================================

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║       Verity Protocol - XAO-DOW Compliance Example           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  try {
    // Step 1: View the policy
    await viewXaoDowPolicy();

    // Step 2: Create a clawback proposal
    const proposal = await createClawbackProposal();
    
    if (!proposal?.id) {
      console.log('\n⚠️  Proposal creation requires Compliance Oracle initialization.');
      console.log('    Run the server with proper configuration to test full workflow.');
      return;
    }

    // Step 3: Add public comments during comment period
    await addPublicComments(proposal.id);

    // Step 4: Wait for comment period (in production: 24 hours)
    console.log('\n⏳ Waiting for comment period to end...');
    // In production, this would be 24 hours
    // await new Promise(resolve => setTimeout(resolve, 24 * 60 * 60 * 1000));

    // Step 5: Cast governance votes
    await castGovernanceVotes(proposal.id);

    // Step 6: File a dispute (optional)
    // await fileDispute(proposal.id);

    // Step 7: View transparency ledger
    await viewTransparencyLedger(proposal.id);

    // Step 8: Get governance statistics
    await getGovernanceStats();

    console.log('\n✅ XAO-DOW Compliance workflow completed!');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run if executed directly
main().catch(console.error);

export { createClawbackProposal, addPublicComments, castGovernanceVotes, fileDispute, viewTransparencyLedger };
