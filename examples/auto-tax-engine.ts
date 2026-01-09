/**
 * Verity Protocol - Auto-Tax Engine Example
 * 
 * This example demonstrates the tax calculation system:
 * - 200+ jurisdiction support
 * - Capital gains calculations
 * - Tax-friendly jurisdiction identification
 * - Holding period exemptions
 * - Transaction reporting
 * 
 * @module examples/auto-tax-engine
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
// EXAMPLE 1: Get All Supported Jurisdictions
// ============================================================

async function getAllJurisdictions() {
  console.log('\n🌍 Getting All Supported Jurisdictions...\n');

  const response = await fetch(`${API_BASE}/tax/jurisdictions`, { headers });
  const data = await response.json();

  console.log(`Total Jurisdictions: ${data.data.totalCount}`);
  console.log('\nFirst 10 Jurisdictions:');
  for (const j of (data.data.jurisdictions || []).slice(0, 10)) {
    console.log(`  - ${j.code}: ${j.name} (${j.region})`);
    console.log(`    Short-term: ${j.shortTermRate}% | Long-term: ${j.longTermRate}%`);
  }

  return data.data;
}

// ============================================================
// EXAMPLE 2: Get Tax-Friendly Jurisdictions
// ============================================================

async function getTaxFriendlyJurisdictions() {
  console.log('\n💚 Tax-Friendly Jurisdictions (0% Capital Gains)...\n');

  const response = await fetch(`${API_BASE}/tax/jurisdictions?taxFriendly=true`, { headers });
  const data = await response.json();

  console.log(`Found ${data.data.jurisdictions?.length || 0} tax-friendly jurisdictions:`);
  for (const j of (data.data.jurisdictions || []).slice(0, 15)) {
    console.log(`  • ${j.name} (${j.code}) - ${j.region}`);
  }

  return data.data;
}

// ============================================================
// EXAMPLE 3: Get Holding Period Exemption Jurisdictions
// ============================================================

async function getHoldingPeriodExemptions() {
  console.log('\n⏳ Holding Period Exemption Jurisdictions...\n');

  const response = await fetch(`${API_BASE}/tax/jurisdictions?holdingExemption=true`, { headers });
  const data = await response.json();

  console.log('Jurisdictions with holding period exemptions:');
  for (const j of data.data.jurisdictions || []) {
    console.log(`  • ${j.name} (${j.code})`);
    if (j.cryptoSpecificRules?.exemptionDays) {
      console.log(`    Hold for ${j.cryptoSpecificRules.exemptionDays} days → Tax-free`);
    }
  }

  return data.data;
}

// ============================================================
// EXAMPLE 4: Get Jurisdiction Details
// ============================================================

async function getJurisdictionDetails(code: string) {
  console.log(`\n📋 Jurisdiction Details: ${code}\n`);

  const response = await fetch(`${API_BASE}/tax/jurisdictions/${code}`, { headers });
  const data = await response.json();

  if (data.data.jurisdiction) {
    const j = data.data.jurisdiction;
    console.log(`${j.name} (${j.code})`);
    console.log(`  Region: ${j.region}`);
    console.log(`  Currency: ${j.currency}`);
    console.log(`  Short-term Rate: ${j.shortTermRate}%`);
    console.log(`  Long-term Rate: ${j.longTermRate}%`);
    console.log(`  Holding Threshold: ${j.holdingPeriodThreshold} days`);
    console.log(`  Tax Treaty: ${j.hasTaxTreaty ? 'Yes' : 'No'}`);
    
    if (j.cryptoSpecificRules) {
      console.log('  Crypto-Specific Rules:');
      console.log(`    Classification: ${j.cryptoSpecificRules.classification}`);
      console.log(`    Reporting Required: ${j.cryptoSpecificRules.reportingRequired}`);
    }
  }

  return data.data;
}

// ============================================================
// EXAMPLE 5: Calculate Capital Gains Tax
// ============================================================

async function calculateCapitalGains(
  jurisdiction: string,
  transactions: Array<{
    type: 'BUY' | 'SELL';
    asset: string;
    amount: string;
    price: string;
    date: string;
    transactionHash?: string;
  }>
) {
  console.log('\n💰 Calculating Capital Gains Tax...\n');

  const response = await fetch(`${API_BASE}/tax/calculate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      jurisdiction,
      taxYear: 2024,
      costBasisMethod: 'FIFO', // First In, First Out
      transactions,
    }),
  });

  const data = await response.json();
  console.log('Tax Calculation:', JSON.stringify(data, null, 2));
  
  return data.data;
}

// ============================================================
// EXAMPLE 6: Create Tax Profile
// ============================================================

async function createTaxProfile(jurisdiction: string, walletAddresses: string[]) {
  console.log('\n👤 Creating Tax Profile...\n');

  const response = await fetch(`${API_BASE}/tax/profile`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      jurisdiction,
      taxYear: 2024,
      costBasisMethod: 'FIFO',
      wallets: walletAddresses,
      trackingEnabled: true,
    }),
  });

  const data = await response.json();
  console.log('Profile Created:', JSON.stringify(data, null, 2));
  
  return data.data;
}

// ============================================================
// EXAMPLE 7: Generate Tax Report
// ============================================================

async function generateTaxReport(profileId: string, format: 'PDF' | 'CSV' | 'JSON') {
  console.log(`\n📄 Generating Tax Report (${format})...\n`);

  const response = await fetch(`${API_BASE}/tax/report/${profileId}?format=${format}`, {
    headers,
  });

  const data = await response.json();
  console.log('Report Generated:', JSON.stringify(data, null, 2));
  
  return data.data;
}

// ============================================================
// EXAMPLE 8: View Tax Methodology
// ============================================================

async function viewTaxMethodology() {
  console.log('\n📚 Tax Calculation Methodology...\n');

  const response = await fetch(`${API_BASE}/tax/methodology`, { headers });
  const data = await response.json();

  console.log('Supported Cost Basis Methods:');
  for (const method of data.data.supportedMethods || []) {
    console.log(`  • ${method}`);
  }

  console.log('\nSupported Transaction Types:');
  for (const type of data.data.transactionTypes || []) {
    console.log(`  • ${type}`);
  }

  console.log('\nDisclaimer:', data.data.disclaimer || 'Consult a tax professional');

  return data.data;
}

// ============================================================
// EXAMPLE 9: View Tax Coverage Statistics
// ============================================================

async function viewTaxCoverage() {
  console.log('\n📊 Tax Coverage Statistics...\n');

  const response = await fetch(`${API_BASE}/transparency/tax-coverage`, { headers });
  const data = await response.json();

  console.log(`Total Jurisdictions: ${data.data.totalJurisdictions}`);
  console.log('\nBy Region:');
  for (const [region, count] of Object.entries(data.data.byRegion || {})) {
    console.log(`  • ${region}: ${count}`);
  }

  console.log('\nSpecial Categories:');
  if (data.data.specialCategories?.taxFriendly) {
    console.log(`  • Tax-Friendly: ${data.data.specialCategories.taxFriendly.count}`);
  }
  if (data.data.specialCategories?.holdingPeriodExemption) {
    console.log(`  • Holding Exemption: ${data.data.specialCategories.holdingPeriodExemption.count}`);
  }

  return data.data;
}

// ============================================================
// EXAMPLE 10: Complete Tax Workflow
// ============================================================

async function completeTaxWorkflow() {
  console.log('\n🔄 Complete Tax Calculation Workflow\n');
  console.log('='.repeat(60));

  // Step 1: Set up tax profile
  console.log('\n📋 Step 1: Set Up Tax Profile');
  console.log('  - Select jurisdiction: United States (US)');
  console.log('  - Tax year: 2024');
  console.log('  - Cost basis method: FIFO');
  console.log('  - Add wallet addresses to track');

  // Step 2: Record transactions
  console.log('\n📝 Step 2: Record Transactions');
  const sampleTransactions = [
    { type: 'BUY' as const, asset: 'XRP', amount: '10000', price: '0.50', date: '2024-01-15' },
    { type: 'SELL' as const, asset: 'XRP', amount: '5000', price: '0.75', date: '2024-06-15' },
    { type: 'BUY' as const, asset: 'XRP', amount: '5000', price: '0.60', date: '2024-08-01' },
    { type: 'SELL' as const, asset: 'XRP', amount: '3000', price: '0.90', date: '2024-12-01' },
  ];

  console.log('  Transactions:');
  for (const tx of sampleTransactions) {
    console.log(`    ${tx.type}: ${tx.amount} ${tx.asset} @ $${tx.price} on ${tx.date}`);
  }

  // Step 3: Calculate gains
  console.log('\n💰 Step 3: Calculate Capital Gains');
  console.log('  Using FIFO method:');
  console.log('  Trade 1: Sold 5000 XRP (bought at $0.50, sold at $0.75)');
  console.log('    → Gain: $1,250 (short-term, held < 1 year)');
  console.log('  Trade 2: Sold 3000 XRP (bought at $0.50, sold at $0.90)');
  console.log('    → Gain: $1,200 (short-term, held < 1 year)');
  console.log('  Total Gain: $2,450');

  // Step 4: Apply tax rates
  console.log('\n📊 Step 4: Apply Tax Rates');
  console.log('  US Short-term rate: 37% (income tax rate)');
  console.log('  Estimated tax liability: $906.50');

  // Step 5: Generate report
  console.log('\n📄 Step 5: Generate Tax Report');
  console.log('  - Summary of all trades');
  console.log('  - Cost basis calculations');
  console.log('  - Gain/loss breakdown');
  console.log('  - Form 8949 compatible');

  // View methodology
  await viewTaxMethodology();

  console.log('\n' + '='.repeat(60));
  console.log('✅ Tax workflow complete!');
}

// ============================================================
// EXAMPLE 11: Compare Jurisdictions
// ============================================================

async function compareJurisdictions() {
  console.log('\n⚖️ Jurisdiction Comparison for Crypto Traders\n');
  console.log('-'.repeat(70));

  const comparisons = [
    { code: 'US', name: 'United States', shortTerm: 37, longTerm: 20, notes: 'Complex reporting' },
    { code: 'DE', name: 'Germany', shortTerm: 45, longTerm: 0, notes: 'Tax-free after 1 year' },
    { code: 'PT', name: 'Portugal', shortTerm: 0, longTerm: 0, notes: 'Tax-free for individuals' },
    { code: 'AE', name: 'UAE', shortTerm: 0, longTerm: 0, notes: 'No income tax' },
    { code: 'SG', name: 'Singapore', shortTerm: 0, longTerm: 0, notes: 'No capital gains tax' },
    { code: 'CH', name: 'Switzerland', shortTerm: 0, longTerm: 0, notes: 'Tax-free for individuals' },
    { code: 'GB', name: 'United Kingdom', shortTerm: 20, longTerm: 20, notes: '£12,300 annual exemption' },
    { code: 'JP', name: 'Japan', shortTerm: 55, longTerm: 55, notes: 'Miscellaneous income' },
  ];

  console.log('Jurisdiction        Short-term   Long-term   Notes');
  console.log('-'.repeat(70));
  for (const j of comparisons) {
    console.log(
      `${j.name.padEnd(18)} ${(j.shortTerm + '%').padEnd(12)} ${(j.longTerm + '%').padEnd(11)} ${j.notes}`
    );
  }

  console.log('\n💡 Key Insights:');
  console.log('  • Portugal, UAE, Singapore: Tax havens for crypto');
  console.log('  • Germany: Hold > 1 year = tax-free');
  console.log('  • US, Japan: High tax rates, complex reporting');
}

// ============================================================
// MAIN EXECUTION
// ============================================================

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║         Verity Protocol - Auto-Tax Engine Example            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  try {
    // View tax coverage
    await viewTaxCoverage();

    // Get tax-friendly jurisdictions
    await getTaxFriendlyJurisdictions();

    // Get holding period exemptions
    await getHoldingPeriodExemptions();

    // Get US details
    await getJurisdictionDetails('US');

    // Compare jurisdictions
    await compareJurisdictions();

    // Complete workflow
    await completeTaxWorkflow();

    console.log('\n✅ Auto-tax engine example completed!');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run if executed directly
main().catch(console.error);

export {
  getAllJurisdictions,
  getTaxFriendlyJurisdictions,
  getHoldingPeriodExemptions,
  getJurisdictionDetails,
  calculateCapitalGains,
  createTaxProfile,
  generateTaxReport,
  viewTaxMethodology,
  viewTaxCoverage,
};
