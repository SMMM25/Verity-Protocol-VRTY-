/**
 * Verity Protocol - Guild Treasury Example
 * 
 * This example demonstrates multi-signature DAO treasury management:
 * - Creating guilds with multi-sig
 * - Managing members and shares
 * - Creating and signing payment requests
 * - Revenue distribution
 * - Governance proposals
 * 
 * @module examples/guild-treasury
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
// EXAMPLE 1: Create a Guild with Multi-Sig Treasury
// ============================================================

async function createGuild() {
  console.log('\n🏛️ Creating Guild with Multi-Sig Treasury...\n');

  const response = await fetch(`${API_BASE}/guilds/treasury`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'DeFi Builders Guild',
      description: 'A guild for DeFi protocol developers on XRPL',
      
      treasuryRules: {
        requiredSigners: 2,    // 2 of 3 multi-sig
        totalSigners: 3,
        autoXRPConversion: false,
        recurringPayments: [],
        revenueSharing: {
          enabled: true,
          distributionFrequency: 'MONTHLY',
          memberShares: [],
        },
        withdrawalLimits: [
          { currency: 'XRP', dailyLimit: '10000' },
        ],
      },

      membershipRules: {
        openMembership: false,
        approvalRequired: true,
        maxMembers: 50,
      },

      governanceRules: {
        proposalThreshold: '1000',  // Min VRTY to propose
        votingPeriod: 168,          // 7 days in hours
        quorumPercentage: 5000,     // 50% in basis points
        executionDelay: 24,         // 24 hour delay
      },
    }),
  });

  const data = await response.json();
  console.log('Guild Created:', JSON.stringify(data, null, 2));
  
  return data.data;
}

// ============================================================
// EXAMPLE 2: List All Guilds
// ============================================================

async function listGuilds() {
  console.log('\n📋 Listing All Guilds...\n');

  const response = await fetch(`${API_BASE}/guilds`, { headers });
  const data = await response.json();

  console.log('Available Guilds:');
  for (const guild of data.data.guilds || []) {
    console.log(`  - ${guild.id}: ${guild.name}`);
    console.log(`    Members: ${guild.memberCount || 'N/A'} | Treasury: ${guild.treasuryBalance || 'N/A'}`);
  }

  return data.data;
}

// ============================================================
// EXAMPLE 3: Add Member to Guild
// ============================================================

async function addMember(guildId: string, memberWallet: string, role: string) {
  console.log('\n👤 Adding Member to Guild...\n');

  const response = await fetch(`${API_BASE}/guilds/${guildId}/members`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      wallet: memberWallet,
      role: role, // OWNER, ADMIN, MEMBER
      shares: 1000, // Initial share allocation (out of 10000)
      isSigner: role === 'ADMIN' || role === 'OWNER',
    }),
  });

  const data = await response.json();
  console.log('Member Added:', JSON.stringify(data, null, 2));
  
  return data.data;
}

// ============================================================
// EXAMPLE 4: Create Payment Request
// ============================================================

async function createPaymentRequest(
  guildId: string,
  payeeAddress: string,
  amount: string,
  description: string
) {
  console.log('\n💰 Creating Payment Request...\n');

  const response = await fetch(`${API_BASE}/guilds/${guildId}/payments`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      payee: payeeAddress,
      amount: amount,
      currency: 'XRP',
      description: description,
    }),
  });

  const data = await response.json();
  console.log('Payment Request Created:', JSON.stringify(data, null, 2));
  
  return data.data;
}

// ============================================================
// EXAMPLE 5: Sign Payment Request
// ============================================================

async function signPaymentRequest(guildId: string, requestId: string, approve: boolean) {
  console.log(`\n✍️ ${approve ? 'Approving' : 'Rejecting'} Payment Request...\n`);

  const response = await fetch(
    `${API_BASE}/guilds/${guildId}/payments/${requestId}/sign`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        approve: approve,
        signature: 'MOCK_SIGNATURE_' + Date.now(), // Would be real signature
      }),
    }
  );

  const data = await response.json();
  console.log('Signature Result:', JSON.stringify(data, null, 2));
  
  return data.data;
}

// ============================================================
// EXAMPLE 6: Distribute Revenue to Members
// ============================================================

async function distributeRevenue(guildId: string, totalAmount: string, currency: string) {
  console.log('\n💸 Distributing Revenue...\n');

  const response = await fetch(
    `${API_BASE}/guilds/${guildId}/revenue/distribute`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        totalAmount: totalAmount,
        currency: currency,
      }),
    }
  );

  const data = await response.json();
  console.log('Revenue Distribution:', JSON.stringify(data, null, 2));
  
  return data.data;
}

// ============================================================
// EXAMPLE 7: Get Guild Audit Trail
// ============================================================

async function getAuditTrail(guildId: string) {
  console.log('\n📜 Getting Guild Audit Trail...\n');

  const response = await fetch(`${API_BASE}/guilds/${guildId}/audit`, { headers });
  const data = await response.json();

  console.log('Audit Trail:');
  if (data.data.activities) {
    for (const activity of data.data.activities.slice(0, 10)) {
      console.log(`  - [${activity.timestamp}] ${activity.action} by ${activity.actor}`);
    }
  }

  return data.data;
}

// ============================================================
// EXAMPLE 8: Get Guild Proposals
// ============================================================

async function getGuildProposals(guildId: string) {
  console.log('\n🗳️ Getting Guild Proposals...\n');

  const response = await fetch(`${API_BASE}/guilds/${guildId}/proposals`, { headers });
  const data = await response.json();

  console.log('Guild Proposals:');
  if (data.data.proposals?.length) {
    for (const proposal of data.data.proposals) {
      console.log(`  - ${proposal.id}: ${proposal.title} (${proposal.status})`);
      console.log(`    Type: ${proposal.type} | Votes: ${proposal.votes?.length || 0}`);
    }
  } else {
    console.log('  No proposals yet');
  }

  return data.data;
}

// ============================================================
// EXAMPLE 9: Complete Guild Workflow
// ============================================================

async function completeGuildWorkflow() {
  console.log('\n🔄 Complete Guild Treasury Workflow\n');
  console.log('='.repeat(60));

  // Step 1: Create guild
  console.log('\n🏛️ Step 1: Create Guild');
  console.log('  - Set up multi-sig (2 of 3)');
  console.log('  - Configure treasury rules');
  console.log('  - Set governance parameters');
  
  const guild = await createGuild();

  // Step 2: Add members
  console.log('\n👥 Step 2: Add Members');
  console.log('  - Founder: 40% shares, signer');
  console.log('  - Co-founder: 30% shares, signer');
  console.log('  - Advisor: 20% shares, signer');
  console.log('  - Member: 10% shares');

  // Step 3: Payment workflow
  console.log('\n💰 Step 3: Multi-Sig Payment Workflow');
  console.log('  1. Admin creates payment request');
  console.log('  2. First signer approves → Pending (1/2)');
  console.log('  3. Second signer approves → Approved (2/2)');
  console.log('  4. Payment executed on XRPL');

  // Step 4: Revenue distribution
  console.log('\n💸 Step 4: Revenue Distribution');
  console.log('  - Guild earns protocol fees');
  console.log('  - Monthly distribution triggered');
  console.log('  - Each member receives proportional share');
  console.log('  - Payments recorded with verification hash');

  // Step 5: Governance
  console.log('\n🗳️ Step 5: Governance');
  console.log('  - Members can create proposals');
  console.log('  - 7-day voting period');
  console.log('  - 50% quorum required');
  console.log('  - Passed proposals execute after 24h delay');

  console.log('\n' + '='.repeat(60));
  console.log('✅ Guild workflow complete!');

  return guild;
}

// ============================================================
// EXAMPLE 10: Multi-Sig Flow Demonstration
// ============================================================

async function demonstrateMultiSig() {
  console.log('\n🔐 Multi-Signature Flow Demonstration\n');
  console.log('-'.repeat(60));

  console.log('\nGuild Treasury Configuration:');
  console.log('  • Total Signers: 3');
  console.log('  • Required Signatures: 2');
  console.log('  • Signers: Founder, Co-founder, Advisor');

  console.log('\nPayment Request Lifecycle:');
  console.log('  1. [PENDING] Request created by Founder');
  console.log('     └── Amount: 1000 XRP');
  console.log('     └── Payee: rContractor123...');
  console.log('     └── Description: Development milestone payment');
  console.log('');
  console.log('  2. [PENDING] First signature by Founder');
  console.log('     └── Signatures: 1/2');
  console.log('     └── Status: Waiting for second signer');
  console.log('');
  console.log('  3. [APPROVED] Second signature by Co-founder');
  console.log('     └── Signatures: 2/2');
  console.log('     └── Status: Approved, ready for execution');
  console.log('');
  console.log('  4. [EXECUTED] Payment executed on XRPL');
  console.log('     └── Transaction Hash: ABC123...');
  console.log('     └── Timestamp: 2024-01-15T10:30:00Z');
  console.log('     └── Audit logged with verification hash');

  console.log('\nRejection Scenario:');
  console.log('  • If 2 signers reject → Payment request cancelled');
  console.log('  • Rejection reason logged for transparency');

  console.log('\nShare Distribution:');
  console.log('  • Total: 10,000 basis points (100%)');
  console.log('  • Founder: 4,000 (40%)');
  console.log('  • Co-founder: 3,000 (30%)');
  console.log('  • Advisor: 2,000 (20%)');
  console.log('  • Member: 1,000 (10%)');
}

// ============================================================
// MAIN EXECUTION
// ============================================================

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║         Verity Protocol - Guild Treasury Example             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  try {
    // List existing guilds
    await listGuilds();

    // Demonstrate multi-sig flow
    await demonstrateMultiSig();

    // Complete workflow
    await completeGuildWorkflow();

    console.log('\n✅ Guild treasury example completed!');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run if executed directly
main().catch(console.error);

export {
  createGuild,
  listGuilds,
  addMember,
  createPaymentRequest,
  signPaymentRequest,
  distributeRevenue,
  getAuditTrail,
  getGuildProposals,
};
