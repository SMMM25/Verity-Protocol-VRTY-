/**
 * Verity Protocol - Asset Tokenization Example
 * 
 * This example demonstrates how to tokenize real estate
 * using the Verity Assets module with XAO-DOW compliance.
 */

import { VeritySDK } from '@verity-protocol/sdk';

async function tokenizeRealEstate() {
  // Initialize SDK with issuer configuration
  const verity = new VeritySDK({
    network: 'testnet',
    enableVerification: true,
    issuerSeed: process.env.VERITY_ISSUER_SECRET,
    governanceSigners: [
      'rCompliance1...',
      'rCompliance2...',
      'rCompliance3...',
    ],
    clawbackConfig: {
      governanceQuorum: 2,
      allowedReasons: [
        'REGULATORY_REQUIREMENT',
        'COURT_ORDER',
        'FRAUD_DETECTION',
      ],
    },
  });

  await verity.initialize();

  try {
    // Tokenize a real estate property
    const asset = await verity.assets.tokenizeRealEstate(
      {
        address: '123 Main Street, New York, NY 10001',
        type: 'Commercial Office Building',
        appraisedValue: '10000000', // $10M
        appraisalDate: new Date(),
        squareFootage: 50000,
        yearBuilt: 2015,
      },
      {
        name: 'NYC Office Tower Token',
        symbol: 'NYCT',
        totalTokens: '10000000', // 10M tokens = $1 per token
        jurisdiction: 'US',
        dividendSchedule: {
          frequency: 'MONTHLY',
          paymentCurrency: 'USD',
          autoDistribute: true,
        },
      }
    );

    console.log('✓ Real estate tokenized:', asset);
    console.log(`  Asset ID: ${asset.id}`);
    console.log(`  Currency Code: ${asset.currencyCode}`);
    console.log(`  Verification Hash: ${asset.verificationHash}`);

    // Add an investor to the whitelist
    const investorWallet = 'rInvestor123...';
    verity.assets.addToWhitelist(
      asset.id,
      investorWallet,
      true, // KYC verified
      true  // Accredited investor
    );
    console.log('✓ Investor added to whitelist');

    // Distribute tokens to the investor
    const distribution = await verity.assets.distribute(
      asset.id,
      investorWallet,
      '10000', // 10,000 tokens = $10,000 investment
      {
        purchasePrice: '10000',
        purchaseCurrency: 'USD',
      }
    );
    console.log('✓ Tokens distributed:', distribution.hash);

    // Get verification dashboard
    const dashboard = verity.assets.getVerificationDashboard(asset.id);
    console.log('✓ Verification Dashboard:', JSON.stringify(dashboard, null, 2));

  } finally {
    await verity.disconnect();
  }
}

tokenizeRealEstate().catch(console.error);
