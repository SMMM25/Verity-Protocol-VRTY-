#!/usr/bin/env npx ts-node
/**
 * Verity Protocol - VRTY Token Deployment on XRPL MAINNET
 * 
 * This script deploys the VRTY token on XRPL MAINNET:
 * 1. Creates issuer wallet (funded from your wallet)
 * 2. Configures issuer account settings (DefaultRipple)
 * 3. Creates a distribution wallet
 * 4. Sets up trust line
 * 5. Issues initial VRTY supply
 * 6. Saves wallet credentials securely
 * 
 * REQUIRES: ~25 XRP for deployment
 */

import { Client, Wallet, AccountSet, AccountSetAsfFlags, TrustSet, Payment, xrpToDrops } from 'xrpl';
import * as fs from 'fs';
import * as path from 'path';

// MAINNET Configuration
const XRPL_MAINNET = 'wss://xrplcluster.com';
const VRTY_CURRENCY_HEX = '5652545900000000000000000000000000000000'; // "VRTY" in hex + padding
const VRTY_CURRENCY_DISPLAY = 'VRTY';
const VRTY_TOTAL_SUPPLY = '1000000000'; // 1 billion tokens
const CREDENTIALS_FILE = path.join(process.cwd(), '.vrty-mainnet-credentials.json');

// Your funding wallet (XUMM)
const FUNDING_WALLET_ADDRESS = 'rBeHfq9vRjZ8Cth1sMbp2nJvExmxSxAH8f';

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
  console.log('║       VRTY Token Deployment on XRPL MAINNET                  ║');
  console.log('║                                                              ║');
  console.log('║   ⚠️  THIS IS MAINNET - REAL XRP WILL BE USED ⚠️              ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  const client = new Client(XRPL_MAINNET);

  try {
    // ============================================================
    // STEP 1: Connect to XRPL Mainnet
    // ============================================================
    console.log('📡 Step 1: Connecting to XRPL Mainnet...');
    await client.connect();
    console.log('   ✓ Connected to', XRPL_MAINNET);
    console.log('');

    // ============================================================
    // STEP 2: Generate Issuer & Distribution Wallets
    // ============================================================
    console.log('🔑 Step 2: Generating new wallets...');
    const issuerWallet = Wallet.generate();
    const distributionWallet = Wallet.generate();
    
    console.log('   Issuer Address:', issuerWallet.address);
    console.log('   Distribution Address:', distributionWallet.address);
    console.log('');

    // ============================================================
    // STEP 3: Display Funding Instructions
    // ============================================================
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                    FUNDING REQUIRED                          ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('Please send XRP from your XUMM wallet to fund these accounts:');
    console.log('');
    console.log('1️⃣  ISSUER WALLET (send 12 XRP):');
    console.log(`    ${issuerWallet.address}`);
    console.log('');
    console.log('2️⃣  DISTRIBUTION WALLET (send 12 XRP):');
    console.log(`    ${distributionWallet.address}`);
    console.log('');
    console.log('💡 In XUMM:');
    console.log('   • Tap "Send"');
    console.log('   • Paste the address above');
    console.log('   • Enter 12 XRP');
    console.log('   • Confirm and sign');
    console.log('');
    console.log('⏳ Waiting for funding... (checking every 10 seconds)');
    console.log('');

    // Wait for issuer funding
    let issuerFunded = false;
    let attempts = 0;
    const maxAttempts = 60; // 10 minutes max

    while (!issuerFunded && attempts < maxAttempts) {
      try {
        const issuerInfo = await client.request({
          command: 'account_info',
          account: issuerWallet.address,
        });
        const balance = Number(issuerInfo.result.account_data.Balance) / 1000000;
        if (balance >= 10) {
          console.log(`   ✓ Issuer funded! Balance: ${balance} XRP`);
          issuerFunded = true;
        }
      } catch (e: any) {
        if (e.data?.error !== 'actNotFound') {
          console.log('   Checking issuer...', e.message);
        }
      }
      
      if (!issuerFunded) {
        attempts++;
        process.stdout.write(`\r   Waiting for issuer funding... (${attempts * 10}s)`);
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }

    if (!issuerFunded) {
      throw new Error('Timeout waiting for issuer funding');
    }

    // Wait for distribution funding
    let distFunded = false;
    attempts = 0;

    while (!distFunded && attempts < maxAttempts) {
      try {
        const distInfo = await client.request({
          command: 'account_info',
          account: distributionWallet.address,
        });
        const balance = Number(distInfo.result.account_data.Balance) / 1000000;
        if (balance >= 10) {
          console.log(`   ✓ Distribution funded! Balance: ${balance} XRP`);
          distFunded = true;
        }
      } catch (e: any) {
        if (e.data?.error !== 'actNotFound') {
          console.log('   Checking distribution...', e.message);
        }
      }
      
      if (!distFunded) {
        attempts++;
        process.stdout.write(`\r   Waiting for distribution funding... (${attempts * 10}s)`);
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }

    if (!distFunded) {
      throw new Error('Timeout waiting for distribution funding');
    }

    console.log('');
    console.log('✅ Both wallets funded! Proceeding with deployment...');
    console.log('');

    // ============================================================
    // STEP 4: Configure Issuer Account Settings
    // ============================================================
    console.log('⚙️  Step 4: Configuring issuer account settings...');
    
    const accountSetTx: AccountSet = {
      TransactionType: 'AccountSet',
      Account: issuerWallet.address,
      SetFlag: AccountSetAsfFlags.asfDefaultRipple,
    };

    const accountSetResult = await client.submitAndWait(accountSetTx, {
      wallet: issuerWallet,
    });

    let accountSetHash = '';
    if (accountSetResult.result.meta && 
        typeof accountSetResult.result.meta === 'object' &&
        'TransactionResult' in accountSetResult.result.meta) {
      const txResult = accountSetResult.result.meta.TransactionResult;
      if (txResult === 'tesSUCCESS') {
        console.log('   ✓ DefaultRipple enabled');
        console.log('   Transaction:', accountSetResult.result.hash);
        accountSetHash = accountSetResult.result.hash || '';
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
    console.log('🪙 Step 6: Issuing 1,000,000,000 VRTY tokens...');
    
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
            MemoType: Buffer.from('VRTY_MAINNET_ISSUANCE').toString('hex').toUpperCase(),
            MemoData: Buffer.from(JSON.stringify({
              type: 'VRTY_TOKEN_ISSUANCE',
              network: 'mainnet',
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
        console.log('   Amount: 1,000,000,000 VRTY');
        console.log('   Transaction:', paymentResult.result.hash);
        issuanceTxHash = paymentResult.result.hash || '';
      } else {
        throw new Error(`Payment failed: ${txResult}`);
      }
    }
    console.log('');

    // ============================================================
    // STEP 7: Save Credentials
    // ============================================================
    console.log('💾 Step 7: Saving credentials...');
    
    const deploymentResult: DeploymentResult = {
      network: 'mainnet',
      issuerAddress: issuerWallet.address,
      issuerSeed: issuerWallet.seed!,
      distributionAddress: distributionWallet.address,
      distributionSeed: distributionWallet.seed!,
      currencyCode: VRTY_CURRENCY_HEX,
      currencyDisplay: VRTY_CURRENCY_DISPLAY,
      totalSupply: VRTY_TOTAL_SUPPLY,
      deployedAt: new Date().toISOString(),
      transactions: {
        accountSetup: accountSetHash,
        trustLine: trustLineTxHash,
        initialIssuance: issuanceTxHash,
      },
    };

    fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(deploymentResult, null, 2));
    console.log('   ✓ Credentials saved to', CREDENTIALS_FILE);
    console.log('   ⚠️  KEEP THIS FILE SECURE! Contains private keys.');
    console.log('');

    // ============================================================
    // DEPLOYMENT SUMMARY
    // ============================================================
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║           🎉 MAINNET DEPLOYMENT SUCCESSFUL! 🎉               ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('📋 VRTY Token Details:');
    console.log('   Network:      XRPL MAINNET');
    console.log('   Currency:     VRTY');
    console.log('   Total Supply: 1,000,000,000 VRTY');
    console.log('');
    console.log('🔑 Issuer Account:');
    console.log('   Address:', issuerWallet.address);
    console.log('   Explorer: https://livenet.xrpl.org/accounts/' + issuerWallet.address);
    console.log('');
    console.log('📦 Distribution Account:');
    console.log('   Address:', distributionWallet.address);
    console.log('   Balance: 1,000,000,000 VRTY');
    console.log('   Explorer: https://livenet.xrpl.org/accounts/' + distributionWallet.address);
    console.log('');
    console.log('🔗 Transaction Links:');
    console.log('   Setup:    https://livenet.xrpl.org/transactions/' + accountSetHash);
    console.log('   Trust:    https://livenet.xrpl.org/transactions/' + trustLineTxHash);
    console.log('   Issuance: https://livenet.xrpl.org/transactions/' + issuanceTxHash);
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log('📱 TO RECEIVE VRTY IN YOUR XUMM WALLET:');
    console.log('');
    console.log('   1. Open XUMM');
    console.log('   2. Tap "+" or "Add token"');
    console.log('   3. Search/paste this issuer address:');
    console.log(`      ${issuerWallet.address}`);
    console.log('   4. Select VRTY and confirm trustline');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');

    return deploymentResult;
  } catch (error) {
    console.error('❌ Deployment failed:', error);
    throw error;
  } finally {
    await client.disconnect();
    console.log('');
    console.log('📡 Disconnected from XRPL');
  }
}

// Run the deployment
main()
  .then((result) => {
    console.log('');
    console.log('✅ Mainnet deployment completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Deployment failed:', error);
    process.exit(1);
  });
