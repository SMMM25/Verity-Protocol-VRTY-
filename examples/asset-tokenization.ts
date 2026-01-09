/**
 * Verity Protocol - Asset Tokenization Example
 * 
 * This example demonstrates real-world asset tokenization including:
 * - Creating verified assets with compliance controls
 * - Setting up KYC/AML verification
 * - Managing trust lines
 * - Token transfers with clawback capability
 * 
 * @module examples/asset-tokenization
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
// EXAMPLE 1: Tokenize Real Estate Property
// ============================================================

async function tokenizeRealEstate() {
  console.log('\n🏠 Tokenizing Real Estate Property...\n');

  const response = await fetch(`${API_BASE}/assets`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Manhattan Tower Unit 42A',
      symbol: 'MTWR42A',
      type: 'REAL_ESTATE',
      classification: 'VERIFIED',
      
      // Property details
      assetDetails: {
        propertyAddress: '123 Park Avenue, Manhattan, NY 10001',
        propertyType: 'Residential Condominium',
        totalUnits: 100,
        squareFeet: 2500,
        yearBuilt: 2020,
        appraisalValue: 2500000,
        appraisalDate: '2024-01-15',
        appraisalProvider: 'Manhattan Appraisal Corp',
      },

      // Total supply and distribution
      totalSupply: '100',
      decimals: 0, // Whole units only
      
      // Compliance configuration
      complianceConfig: {
        kycRequired: true,
        accreditedOnly: true,
        clawbackEnabled: true,
        transferRestrictions: {
          holdingPeriodDays: 365,
          maxTransfersPerYear: 12,
          whitelistOnly: true,
        },
      },

      // Verification data
      verificationData: {
        issuerKyc: 'KYC_VERIFIED_20240101',
        legalStructure: 'Delaware LLC',
        custodian: 'Prime Trust',
        auditor: 'Deloitte',
        regulatoryFiling: 'SEC Reg D 506(c)',
      },

      // Documentation
      documentUrls: [
        'ipfs://QmPropertyDeed123',
        'ipfs://QmAppraisalReport456',
        'ipfs://QmLegalOpinion789',
      ],
    }),
  });

  const data = await response.json();
  console.log('Asset Created:', JSON.stringify(data, null, 2));
  
  return data.data;
}

// ============================================================
// EXAMPLE 2: List Available Assets
// ============================================================

async function listAssets() {
  console.log('\n📋 Listing Available Assets...\n');

  const response = await fetch(`${API_BASE}/assets?classification=VERIFIED`, { headers });
  const data = await response.json();

  console.log('Available Assets:');
  for (const asset of data.data.assets || []) {
    console.log(`  - ${asset.symbol}: ${asset.name} (${asset.type})`);
  }

  return data.data.assets;
}

// ============================================================
// EXAMPLE 3: Get Asset Details
// ============================================================

async function getAssetDetails(assetId: string) {
  console.log('\n🔍 Getting Asset Details...\n');

  const response = await fetch(`${API_BASE}/assets/${assetId}`, { headers });
  const data = await response.json();

  console.log('Asset Details:', JSON.stringify(data.data, null, 2));
  
  return data.data;
}

// ============================================================
// EXAMPLE 4: Create Trust Line (Allow Holding Asset)
// ============================================================

async function createTrustLine(assetCurrency: string, issuerAddress: string, limit: string) {
  console.log('\n🤝 Creating Trust Line...\n');

  const response = await fetch(`${API_BASE}/assets/trustline`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      currency: assetCurrency,
      issuer: issuerAddress,
      limit: limit,
    }),
  });

  const data = await response.json();
  console.log('Trust Line Result:', JSON.stringify(data, null, 2));
  
  return data.data;
}

// ============================================================
// EXAMPLE 5: Transfer Asset Tokens
// ============================================================

async function transferAsset(
  currency: string,
  issuer: string,
  destination: string,
  amount: string
) {
  console.log('\n📤 Transferring Asset Tokens...\n');

  const response = await fetch(`${API_BASE}/assets/transfer`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      currency,
      issuer,
      destination,
      amount,
      memo: 'Property token transfer - Unit 42A fractional ownership',
    }),
  });

  const data = await response.json();
  console.log('Transfer Result:', JSON.stringify(data, null, 2));
  
  return data.data;
}

// ============================================================
// EXAMPLE 6: Check Compliance Requirements
// ============================================================

async function checkComplianceRequirements(assetId: string, walletAddress: string) {
  console.log('\n✅ Checking Compliance Requirements...\n');

  const response = await fetch(
    `${API_BASE}/assets/${assetId}/compliance/check?wallet=${walletAddress}`,
    { headers }
  );

  const data = await response.json();
  
  console.log('Compliance Check:');
  console.log(`  - KYC Status: ${data.data?.kycVerified ? '✓ Verified' : '✗ Not Verified'}`);
  console.log(`  - Accreditation: ${data.data?.accredited ? '✓ Accredited' : '✗ Not Accredited'}`);
  console.log(`  - Whitelisted: ${data.data?.whitelisted ? '✓ Yes' : '✗ No'}`);
  console.log(`  - Can Receive: ${data.data?.canReceive ? '✓ Yes' : '✗ No'}`);
  
  return data.data;
}

// ============================================================
// EXAMPLE 7: View Asset Verification Types
// ============================================================

async function viewVerificationTypes() {
  console.log('\n📊 Asset Verification Types...\n');

  const response = await fetch(`${API_BASE}/assets/types`, { headers });
  const data = await response.json();

  console.log('Supported Asset Types:');
  for (const type of data.data?.types || []) {
    console.log(`  • ${type.code}: ${type.name}`);
    if (type.requirements) {
      console.log(`    Requirements: ${type.requirements.join(', ')}`);
    }
  }

  console.log('\nVerification Classifications:');
  for (const classification of data.data?.classifications || []) {
    console.log(`  • ${classification.code}: ${classification.description}`);
  }
}

// ============================================================
// EXAMPLE 8: Complete Real Estate Tokenization Workflow
// ============================================================

async function completeTokenizationWorkflow() {
  console.log('\n🏗️ Complete Real Estate Tokenization Workflow\n');
  console.log('='.repeat(60));

  // Step 1: Verify issuer compliance
  console.log('\n📋 Step 1: Verify Issuer Compliance');
  console.log('  - Complete KYC/AML verification');
  console.log('  - Verify accredited investor status');
  console.log('  - Submit regulatory filings (SEC Reg D)');

  // Step 2: Prepare asset documentation
  console.log('\n📄 Step 2: Prepare Asset Documentation');
  console.log('  - Property deed verification');
  console.log('  - Professional appraisal');
  console.log('  - Title insurance');
  console.log('  - Legal opinion letter');

  // Step 3: Create tokenized asset
  console.log('\n🪙 Step 3: Create Tokenized Asset');
  const asset = await tokenizeRealEstate();

  // Step 4: Set up compliance controls
  console.log('\n🔒 Step 4: Compliance Controls Active');
  console.log('  - Clawback capability: Enabled');
  console.log('  - Transfer restrictions: Whitelist only');
  console.log('  - Holding period: 365 days');
  console.log('  - Max transfers/year: 12');

  // Step 5: Investor onboarding
  console.log('\n👤 Step 5: Investor Onboarding');
  console.log('  - Investor completes KYC');
  console.log('  - Accreditation verified');
  console.log('  - Added to whitelist');
  console.log('  - Trust line created');

  // Step 6: Token distribution
  console.log('\n📊 Step 6: Token Distribution');
  console.log('  - Fractional ownership tokens issued');
  console.log('  - Transfers recorded on XRPL');
  console.log('  - Audit trail maintained');

  console.log('\n' + '='.repeat(60));
  console.log('✅ Tokenization workflow complete!');
  
  return asset;
}

// ============================================================
// MAIN EXECUTION
// ============================================================

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║       Verity Protocol - Asset Tokenization Example           ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  try {
    // View supported types
    await viewVerificationTypes();

    // List existing assets
    await listAssets();

    // Complete tokenization workflow
    await completeTokenizationWorkflow();

    console.log('\n✅ Asset tokenization example completed!');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run if executed directly
main().catch(console.error);

export {
  tokenizeRealEstate,
  listAssets,
  getAssetDetails,
  createTrustLine,
  transferAsset,
  checkComplianceRequirements,
};
