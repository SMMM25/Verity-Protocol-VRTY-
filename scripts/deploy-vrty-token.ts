#!/usr/bin/env npx ts-node
/**
 * Verity Protocol - VRTY Token Deployment Script
 * 
 * This script deploys the VRTY token on XRPL testnet:
 * 1. Creates/funds issuer wallet from testnet faucet
 * 2. Configures issuer account settings (DefaultRipple, clawback)
 * 3. Creates a distribution wallet
 * 4. Sets up trust line
 * 5. Issues initial VRTY supply
 * 6. Saves wallet credentials securely
 * 
 * Run: npx ts-node scripts/deploy-vrty-token.ts
 */

import { Client, Wallet, AccountSet, AccountSetAsfFlags, TrustSet, Payment } from 'xrpl';
import * as fs from 'fs';
import * as path from 'path';

// Configuration
const XRPL_TESTNET = 'wss://s.altnet.rippletest.net:51233';
// XRPL requires non-XRP currencies to be 3 chars OR 40 hex chars
// For "VRTY", we use the 40-char hex format (padded with zeros)
const VRTY_CURRENCY_HEX = '5652545900000000000000000000000000000000'; // "VRTY" in hex + padding
const VRTY_CURRENCY_DISPLAY = 'VRTY';
const VRTY_TOTAL_SUPPLY = '1000000000'; // 1 billion tokens
const CREDENTIALS_FILE = path.join(process.cwd(), '.vrty-credentials.json');

// Helper function to convert currency to hex format
function currencyToHex(currency: string): string {
  if (currency.length === 3) {
    return currency; // Standard 3-char currency codes work as-is
  }
  // For longer codes, convert to 40-char hex (padded)
  const hex = Buffer.from(currency, 'utf8').toString('hex').toUpperCase();
  return hex.padEnd(40, '0');
}

interface DeploymentResult {
  network: string;
  issuerAddress: string;
  issuerSeed: string;
  distributionAddress: string;
  distributionSeed: string;
  currencyCode: string;
  currencyDisplay: string;
  totalSupply: string;
  deployedAt: string;
  transactions: {
    accountSetup: string;
    trustLine: string;
    initialIssuance: string;
  };
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║         VRTY Token Deployment on XRPL Testnet                ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  const client = new Client(XRPL_TESTNET);

  try {
    // ============================================================
    // STEP 1: Connect to XRPL Testnet
    // ============================================================
    console.log('📡 Step 1: Connecting to XRPL Testnet...');
    await client.connect();
    console.log('   ✓ Connected to', XRPL_TESTNET);
    console.log('');

    // ============================================================
    // STEP 2: Create & Fund Issuer Wallet
    // ============================================================
    console.log('💰 Step 2: Creating & funding issuer wallet...');
    const issuerWallet = Wallet.generate();
    console.log('   Issuer Address:', issuerWallet.address);
    
    // Fund from testnet faucet
    const fundIssuerResult = await client.fundWallet(issuerWallet);
    console.log('   ✓ Funded with', fundIssuerResult.balance, 'XRP');
    console.log('');

    // ============================================================
    // STEP 3: Create & Fund Distribution Wallet
    // ============================================================
    console.log('💰 Step 3: Creating & funding distribution wallet...');
    const distributionWallet = Wallet.generate();
    console.log('   Distribution Address:', distributionWallet.address);
    
    // Fund from testnet faucet
    const fundDistResult = await client.fundWallet(distributionWallet);
    console.log('   ✓ Funded with', fundDistResult.balance, 'XRP');
    console.log('');

    // ============================================================
    // STEP 4: Configure Issuer Account Settings
    // ============================================================
    console.log('⚙️  Step 4: Configuring issuer account settings...');
    
    // Enable DefaultRipple (required for issued tokens)
    const accountSetTx: AccountSet = {
      TransactionType: 'AccountSet',
      Account: issuerWallet.address,
      SetFlag: AccountSetAsfFlags.asfDefaultRipple,
    };

    const accountSetResult = await client.submitAndWait(accountSetTx, {
      wallet: issuerWallet,
    });

    if (accountSetResult.result.meta && 
        typeof accountSetResult.result.meta === 'object' &&
        'TransactionResult' in accountSetResult.result.meta) {
      const txResult = accountSetResult.result.meta.TransactionResult;
      if (txResult === 'tesSUCCESS') {
        console.log('   ✓ DefaultRipple enabled');
        console.log('   Transaction:', accountSetResult.result.hash);
      } else {
        throw new Error(`AccountSet failed: ${txResult}`);
      }
    }
    console.log('');

    // ============================================================
    // STEP 5: Create Trust Line from Distribution Wallet
    // ============================================================
    console.log('🤝 Step 5: Creating trust line for VRTY...');
    
    const trustSetTx: TrustSet = {
      TransactionType: 'TrustSet',
      Account: distributionWallet.address,
      LimitAmount: {
        currency: VRTY_CURRENCY_HEX,
        issuer: issuerWallet.address,
        value: VRTY_TOTAL_SUPPLY,
      },
    };

    const trustSetResult = await client.submitAndWait(trustSetTx, {
      wallet: distributionWallet,
    });

    let trustLineTxHash = '';
    if (trustSetResult.result.meta && 
        typeof trustSetResult.result.meta === 'object' &&
        'TransactionResult' in trustSetResult.result.meta) {
      const txResult = trustSetResult.result.meta.TransactionResult;
      if (txResult === 'tesSUCCESS') {
        console.log('   ✓ Trust line created');
        console.log('   Currency:', VRTY_CURRENCY_DISPLAY, '(' + VRTY_CURRENCY_HEX + ')');
        console.log('   Limit:', VRTY_TOTAL_SUPPLY);
        console.log('   Transaction:', trustSetResult.result.hash);
        trustLineTxHash = trustSetResult.result.hash || '';
      } else {
        throw new Error(`TrustSet failed: ${txResult}`);
      }
    }
    console.log('');

    // ============================================================
    // STEP 6: Issue Initial VRTY Supply
    // ============================================================
    console.log('🪙 Step 6: Issuing initial VRTY supply...');
    
    const paymentTx: Payment = {
      TransactionType: 'Payment',
      Account: issuerWallet.address,
      Destination: distributionWallet.address,
      Amount: {
        currency: VRTY_CURRENCY_HEX,
        issuer: issuerWallet.address,
        value: VRTY_TOTAL_SUPPLY,
      },
      Memos: [
        {
          Memo: {
            MemoType: Buffer.from('VRTY_INITIAL_ISSUANCE').toString('hex').toUpperCase(),
            MemoData: Buffer.from(JSON.stringify({
              type: 'VRTY_TOKEN_ISSUANCE',
              supply: VRTY_TOTAL_SUPPLY,
              timestamp: new Date().toISOString(),
            })).toString('hex').toUpperCase(),
          },
        },
      ],
    };

    const paymentResult = await client.submitAndWait(paymentTx, {
      wallet: issuerWallet,
    });

    let issuanceTxHash = '';
    if (paymentResult.result.meta && 
        typeof paymentResult.result.meta === 'object' &&
        'TransactionResult' in paymentResult.result.meta) {
      const txResult = paymentResult.result.meta.TransactionResult;
      if (txResult === 'tesSUCCESS') {
        console.log('   ✓ VRTY tokens issued!');
        console.log('   Amount:', VRTY_TOTAL_SUPPLY, 'VRTY');
        console.log('   To:', distributionWallet.address);
        console.log('   Transaction:', paymentResult.result.hash);
        issuanceTxHash = paymentResult.result.hash || '';
      } else {
        throw new Error(`Payment failed: ${txResult}`);
      }
    }
    console.log('');

    // ============================================================
    // STEP 7: Verify Token Balance
    // ============================================================
    console.log('✅ Step 7: Verifying token balance...');
    
    const accountLines = await client.request({
      command: 'account_lines',
      account: distributionWallet.address,
    });

    const vrtyLine = accountLines.result.lines.find(
      (line: any) => line.currency === VRTY_CURRENCY_HEX && line.account === issuerWallet.address
    );

    if (vrtyLine) {
      console.log('   ✓ Balance verified:', vrtyLine.balance, 'VRTY');
    }
    console.log('');

    // ============================================================
    // STEP 8: Save Credentials
    // ============================================================
    console.log('💾 Step 8: Saving deployment credentials...');
    
    const deploymentResult: DeploymentResult = {
      network: 'testnet',
      issuerAddress: issuerWallet.address,
      issuerSeed: issuerWallet.seed!,
      distributionAddress: distributionWallet.address,
      distributionSeed: distributionWallet.seed!,
      currencyCode: VRTY_CURRENCY_HEX,
      currencyDisplay: VRTY_CURRENCY_DISPLAY,
      totalSupply: VRTY_TOTAL_SUPPLY,
      deployedAt: new Date().toISOString(),
      transactions: {
        accountSetup: accountSetResult.result.hash || '',
        trustLine: trustLineTxHash,
        initialIssuance: issuanceTxHash,
      },
    };

    fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(deploymentResult, null, 2));
    console.log('   ✓ Credentials saved to', CREDENTIALS_FILE);
    console.log('   ⚠️  Keep this file secure! Contains private keys.');
    console.log('');

    // ============================================================
    // DEPLOYMENT SUMMARY
    // ============================================================
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                  DEPLOYMENT SUCCESSFUL! 🎉                    ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('📋 VRTY Token Details:');
    console.log('   Network:      XRPL Testnet');
    console.log('   Currency:     VRTY');
    console.log('   Total Supply: 1,000,000,000 VRTY');
    console.log('');
    console.log('🔑 Issuer Account:');
    console.log('   Address:', issuerWallet.address);
    console.log('   Explorer: https://testnet.xrpl.org/accounts/' + issuerWallet.address);
    console.log('');
    console.log('📦 Distribution Account:');
    console.log('   Address:', distributionWallet.address);
    console.log('   Balance: 1,000,000,000 VRTY');
    console.log('   Explorer: https://testnet.xrpl.org/accounts/' + distributionWallet.address);
    console.log('');
    console.log('🔗 Transaction Links:');
    console.log('   Account Setup: https://testnet.xrpl.org/transactions/' + accountSetResult.result.hash);
    console.log('   Trust Line:    https://testnet.xrpl.org/transactions/' + trustLineTxHash);
    console.log('   Issuance:      https://testnet.xrpl.org/transactions/' + issuanceTxHash);
    console.log('');
    console.log('🚀 Next Steps:');
    console.log('   1. Set VERITY_ISSUER_SEED=' + issuerWallet.seed + ' in .env');
    console.log('   2. Run the server: npm run dev');
    console.log('   3. Test token operations via API');
    console.log('');

    return deploymentResult;
  } catch (error) {
    console.error('❌ Deployment failed:', error);
    throw error;
  } finally {
    await client.disconnect();
    console.log('📡 Disconnected from XRPL');
  }
}

// Run the deployment
main()
  .then((result) => {
    console.log('Deployment completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Deployment failed:', error);
    process.exit(1);
  });
