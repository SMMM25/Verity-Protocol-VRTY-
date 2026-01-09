/**
 * Verity Protocol - Full Integration Example
 * 
 * This example demonstrates the complete protocol workflow combining:
 * - Asset tokenization
 * - Guild treasury management
 * - Signals and reputation
 * - Tax calculations
 * - Compliance governance
 * 
 * @module examples/full-integration
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
// SCENARIO: Real Estate Investment Guild
// ============================================================

async function runFullIntegrationScenario() {
  console.log('\n' + '='.repeat(70));
  console.log('🏢 SCENARIO: Real Estate Investment Guild on XRPL');
  console.log('='.repeat(70));

  // ============================================================
  // PHASE 1: Guild Creation & Setup
  // ============================================================
  console.log('\n📋 PHASE 1: Guild Creation & Setup');
  console.log('-'.repeat(50));

  console.log('\n1.1 Create Investment Guild');
  console.log('    • Name: "Manhattan Real Estate Guild"');
  console.log('    • Multi-sig: 3 of 5 signers');
  console.log('    • Treasury rules configured');
  console.log('    • Governance: 7-day voting, 50% quorum');

  console.log('\n1.2 Onboard Guild Members');
  console.log('    • Lead Investor: 30% shares, signer');
  console.log('    • Co-Investor A: 25% shares, signer');
  console.log('    • Co-Investor B: 25% shares, signer');
  console.log('    • Advisor: 10% shares, signer');
  console.log('    • Manager: 10% shares, signer');

  console.log('\n1.3 Fund Treasury');
  console.log('    • Total raised: 500,000 XRP');
  console.log('    • Multi-sig wallet created');
  console.log('    • Funds deposited');

  // ============================================================
  // PHASE 2: Asset Tokenization
  // ============================================================
  console.log('\n📋 PHASE 2: Asset Tokenization');
  console.log('-'.repeat(50));

  console.log('\n2.1 Due Diligence');
  console.log('    • Property: 123 Park Avenue, Unit 42A');
  console.log('    • Appraisal: $2,500,000');
  console.log('    • Legal review completed');
  console.log('    • Title verified');

  console.log('\n2.2 Create Tokenized Asset');
  console.log('    • Symbol: PARK42A');
  console.log('    • Total supply: 100 tokens (fractions)');
  console.log('    • Each token = 1% ownership');
  console.log('    • Clawback enabled for compliance');
  console.log('    • KYC required for holders');

  console.log('\n2.3 Guild Acquires Tokens');
  console.log('    • Multi-sig payment: 500,000 XRP');
  console.log('    • 3 of 5 signers approve');
  console.log('    • Guild receives 20 PARK42A tokens (20%)');
  console.log('    • Transaction on XRPL: TX_ABC123...');

  // ============================================================
  // PHASE 3: Content & Reputation
  // ============================================================
  console.log('\n📋 PHASE 3: Content & Reputation Building');
  console.log('-'.repeat(50));

  console.log('\n3.1 Guild Publishes Content NFT');
  console.log('    • Investment thesis: "Manhattan Condo Market 2024"');
  console.log('    • Content hash: Qm123...');
  console.log('    • NFT minted on XRPL');

  console.log('\n3.2 Community Engagement');
  console.log('    • 50 ENDORSEMENT signals received');
  console.log('    • 10 BOOST signals (500,000 drops total)');
  console.log('    • 25 SUPPORT signals');
  console.log('    • Total engagement: 750,000 drops');

  console.log('\n3.3 Reputation Update');
  console.log('    • Guild reputation score: 450');
  console.log('    • Leaderboard rank: #12');
  console.log('    • Increased visibility in discovery');

  // ============================================================
  // PHASE 4: Revenue & Distributions
  // ============================================================
  console.log('\n📋 PHASE 4: Revenue & Distributions');
  console.log('-'.repeat(50));

  console.log('\n4.1 Rental Income');
  console.log('    • Property rented: $8,000/month');
  console.log('    • Guild share (20%): $1,600/month');
  console.log('    • Converted to XRP: ~2,000 XRP');

  console.log('\n4.2 Monthly Distribution');
  console.log('    • Lead Investor (30%): 600 XRP');
  console.log('    • Co-Investor A (25%): 500 XRP');
  console.log('    • Co-Investor B (25%): 500 XRP');
  console.log('    • Advisor (10%): 200 XRP');
  console.log('    • Manager (10%): 200 XRP');
  console.log('    • All payments logged with verification hash');

  // ============================================================
  // PHASE 5: Tax Compliance
  // ============================================================
  console.log('\n📋 PHASE 5: Tax Compliance');
  console.log('-'.repeat(50));

  console.log('\n5.1 Transaction Tracking');
  console.log('    • All distributions tracked');
  console.log('    • Cost basis: FIFO method');
  console.log('    • Holding periods calculated');

  console.log('\n5.2 Tax Calculations (US Member)');
  console.log('    • Rental income: Ordinary income');
  console.log('    • Capital gains: Short-term (if < 1 year)');
  console.log('    • Estimated quarterly tax: $XXX');

  console.log('\n5.3 Tax Report Generation');
  console.log('    • Form 8949 compatible');
  console.log('    • Schedule D summary');
  console.log('    • Audit trail included');

  // ============================================================
  // PHASE 6: Governance & Compliance
  // ============================================================
  console.log('\n📋 PHASE 6: Governance & Compliance');
  console.log('-'.repeat(50));

  console.log('\n6.1 Governance Proposal');
  console.log('    • Proposal: "Acquire additional property share"');
  console.log('    • 7-day voting period');
  console.log('    • Vote results: 4 For, 1 Against');
  console.log('    • Proposal passed, 24h execution delay');

  console.log('\n6.2 Compliance Event');
  console.log('    • Suspicious activity detected');
  console.log('    • Compliance Oracle creates clawback proposal');
  console.log('    • 24-hour public comment period');
  console.log('    • Governance votes: 3 Approve, 2 Reject');
  console.log('    • Clawback executed with full transparency');

  // ============================================================
  // SUMMARY
  // ============================================================
  console.log('\n' + '='.repeat(70));
  console.log('📊 INTEGRATION SUMMARY');
  console.log('='.repeat(70));

  console.log('\nModules Used:');
  console.log('  ✓ Guild Treasury - Multi-sig management');
  console.log('  ✓ Asset Tokenization - Real estate tokens');
  console.log('  ✓ Signals Protocol - Content engagement');
  console.log('  ✓ Auto-Tax Engine - Compliance tracking');
  console.log('  ✓ Compliance Oracle - XAO-DOW governance');
  console.log('  ✓ VRTY Token - Protocol fees & staking');

  console.log('\nKey Benefits:');
  console.log('  • Fractional real estate ownership');
  console.log('  • Transparent governance');
  console.log('  • Automated distributions');
  console.log('  • Built-in tax compliance');
  console.log('  • Regulatory-ready clawback');
  console.log('  • On-chain audit trail');
}

// ============================================================
// API HEALTH CHECK
// ============================================================

async function checkAPIHealth() {
  console.log('\n🏥 API Health Check\n');

  const endpoints = [
    '/health',
    '/health/detailed',
  ];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, { headers });
      const data = await response.json();
      console.log(`  ${endpoint}: ${data.data?.status || data.status || 'OK'}`);
    } catch (error) {
      console.log(`  ${endpoint}: Error - ${error}`);
    }
  }
}

// ============================================================
// AVAILABLE ENDPOINTS
// ============================================================

async function listAvailableEndpoints() {
  console.log('\n📚 Available API Endpoints\n');

  try {
    const response = await fetch(`${API_BASE}/docs`, { headers });
    const data = await response.json();

    console.log('Verity Protocol API v1');
    console.log('-'.repeat(40));

    if (data.endpoints) {
      for (const [category, details] of Object.entries(data.endpoints)) {
        console.log(`\n${category.toUpperCase()}:`);
        if (typeof details === 'object' && details !== null) {
          const detailsObj = details as Record<string, unknown>;
          if (detailsObj.path) {
            console.log(`  Base: ${detailsObj.path}`);
          }
          if (Array.isArray(detailsObj.routes)) {
            for (const route of detailsObj.routes) {
              console.log(`    ${route}`);
            }
          }
        }
      }
    }
  } catch (error) {
    console.log('Could not fetch endpoint documentation');
  }
}

// ============================================================
// QUICK START GUIDE
// ============================================================

function printQuickStartGuide() {
  console.log('\n📖 QUICK START GUIDE');
  console.log('='.repeat(70));

  console.log(`
1. AUTHENTICATION
   All requests require an API key:
   
   curl -X GET "${API_BASE}/health" \\
     -H "X-API-Key: your_api_key"

2. WALLET CONNECTION
   For write operations, include wallet address:
   
   curl -X POST "${API_BASE}/guilds/treasury" \\
     -H "X-API-Key: your_api_key" \\
     -H "X-Wallet-Address: rYourXRPLWallet..." \\
     -H "Content-Type: application/json" \\
     -d '{"name": "My Guild", ...}'

3. ERROR HANDLING
   All errors return structured responses:
   
   {
     "success": false,
     "error": {
       "code": "VALIDATION_ERROR",
       "message": "Description of the error",
       "details": [...]
     }
   }

4. PAGINATION
   List endpoints support pagination:
   
   GET /api/v1/guilds?page=1&limit=20

5. RESPONSE FORMAT
   All successful responses include:
   
   {
     "success": true,
     "data": { ... },
     "meta": {
       "requestId": "uuid",
       "timestamp": "ISO8601"
     }
   }
`);
}

// ============================================================
// SDK USAGE EXAMPLE
// ============================================================

function printSDKExample() {
  console.log('\n💻 SDK USAGE EXAMPLE');
  console.log('='.repeat(70));

  console.log(`
// Install the SDK
npm install verity-protocol

// Initialize
import { VeritySDK } from 'verity-protocol';

const verity = new VeritySDK({
  network: 'testnet',
  apiKey: process.env.VERITY_API_KEY,
});

// Connect to XRPL
await verity.connect();

// Create a guild
const guild = await verity.guilds.create({
  name: 'My Investment Guild',
  treasuryRules: {
    requiredSigners: 2,
    totalSigners: 3,
  },
});

// Tokenize an asset
const asset = await verity.assets.create({
  name: 'Property Token',
  symbol: 'PROP1',
  type: 'REAL_ESTATE',
  classification: 'VERIFIED',
});

// Send a signal
const signal = await verity.signals.send({
  contentNFTId: 'token123',
  amount: '100000',  // 0.1 XRP in drops
  signalType: 'ENDORSEMENT',
});

// Calculate taxes
const taxReport = await verity.tax.calculate({
  jurisdiction: 'US',
  taxYear: 2024,
  transactions: [...],
});

// Disconnect
await verity.disconnect();
`);
}

// ============================================================
// MAIN EXECUTION
// ============================================================

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║          Verity Protocol - Full Integration Example              ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');

  try {
    // Health check
    await checkAPIHealth();

    // List endpoints
    await listAvailableEndpoints();

    // Print quick start guide
    printQuickStartGuide();

    // Print SDK example
    printSDKExample();

    // Run full scenario
    await runFullIntegrationScenario();

    console.log('\n' + '='.repeat(70));
    console.log('✅ Full integration example completed!');
    console.log('='.repeat(70));
    console.log('\n🚀 Ready to build on Verity Protocol!');
    console.log('   Documentation: https://docs.verity.finance');
    console.log('   GitHub: https://github.com/SMMM25/Verity-Protocol-VRTY-');
    console.log('   Support: support@verity.finance\n');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run if executed directly
main().catch(console.error);

export {
  runFullIntegrationScenario,
  checkAPIHealth,
  listAvailableEndpoints,
};
