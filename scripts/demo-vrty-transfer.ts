#!/usr/bin/env npx ts-node
/**
 * Verity Protocol - VRTY Token Transfer Demo
 * 
 * This script demonstrates actual VRTY token transfers on XRPL testnet:
 * 1. Creates a new user wallet
 * 2. Funds it from the testnet faucet  
 * 3. Sets up trust line for VRTY
 * 4. Transfers VRTY tokens from distribution wallet
 * 5. Verifies the balance
 * 
 * Run: npx ts-node scripts/demo-vrty-transfer.ts
 */

import { Client, Wallet, TrustSet, Payment } from 'xrpl';
import * as fs from 'fs';
import * as path from 'path';

// Load credentials
const CREDENTIALS_FILE = path.join(process.cwd(), '.vrty-credentials.json');
const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_FILE, 'utf-8'));

const XRPL_TESTNET = 'wss://s.altnet.rippletest.net:51233';

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║         VRTY Token Transfer Demo on XRPL Testnet             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log('');

  const client = new Client(XRPL_TESTNET);

  try {
    // Connect
    console.log('📡 Connecting to XRPL Testnet...');
    await client.connect();
    console.log('   ✓ Connected\n');

    // Load distribution wallet
    console.log('🔑 Loading distribution wallet...');
    const distributionWallet = Wallet.fromSeed(credentials.distributionSeed);
    console.log('   Address:', distributionWallet.address);

    // Check distribution wallet balance
    const distLines = await client.request({
      command: 'account_lines',
      account: distributionWallet.address,
    });
    const distVrtyLine = distLines.result.lines.find(
      (line: any) => line.currency === credentials.currencyCode
    );
    console.log('   VRTY Balance:', distVrtyLine?.balance || '0', 'VRTY\n');

    // Create new user wallet
    console.log('👤 Creating new user wallet...');
    const userWallet = Wallet.generate();
    console.log('   Address:', userWallet.address);

    // Fund from faucet
    console.log('   Funding from faucet...');
    await client.fundWallet(userWallet);
    console.log('   ✓ Funded with XRP\n');

    // Create trust line
    console.log('🤝 Setting up VRTY trust line for user...');
    const trustSetTx: TrustSet = {
      TransactionType: 'TrustSet',
      Account: userWallet.address,
      LimitAmount: {
        currency: credentials.currencyCode,
        issuer: credentials.issuerAddress,
        value: '1000000', // User can hold up to 1M VRTY
      },
    };

    const trustResult = await client.submitAndWait(trustSetTx, {
      wallet: userWallet,
    });

    if (trustResult.result.meta && 
        typeof trustResult.result.meta === 'object' &&
        'TransactionResult' in trustResult.result.meta &&
        trustResult.result.meta.TransactionResult === 'tesSUCCESS') {
      console.log('   ✓ Trust line created');
      console.log('   Transaction:', trustResult.result.hash);
    }
    console.log('');

    // Transfer VRTY tokens
    const transferAmount = '1000'; // Transfer 1000 VRTY
    console.log(`💸 Transferring ${transferAmount} VRTY to user...`);
    
    const paymentTx: Payment = {
      TransactionType: 'Payment',
      Account: distributionWallet.address,
      Destination: userWallet.address,
      Amount: {
        currency: credentials.currencyCode,
        issuer: credentials.issuerAddress,
        value: transferAmount,
      },
      Memos: [
        {
          Memo: {
            MemoType: Buffer.from('VRTY_TRANSFER').toString('hex').toUpperCase(),
            MemoData: Buffer.from(JSON.stringify({
              type: 'DEMO_TRANSFER',
              timestamp: new Date().toISOString(),
            })).toString('hex').toUpperCase(),
          },
        },
      ],
    };

    const paymentResult = await client.submitAndWait(paymentTx, {
      wallet: distributionWallet,
    });

    if (paymentResult.result.meta && 
        typeof paymentResult.result.meta === 'object' &&
        'TransactionResult' in paymentResult.result.meta &&
        paymentResult.result.meta.TransactionResult === 'tesSUCCESS') {
      console.log('   ✓ Transfer successful!');
      console.log('   Transaction:', paymentResult.result.hash);
      console.log('   Explorer: https://testnet.xrpl.org/transactions/' + paymentResult.result.hash);
    }
    console.log('');

    // Verify user balance
    console.log('✅ Verifying user balance...');
    const userLines = await client.request({
      command: 'account_lines',
      account: userWallet.address,
    });
    const userVrtyLine = userLines.result.lines.find(
      (line: any) => line.currency === credentials.currencyCode
    );
    console.log('   User VRTY Balance:', userVrtyLine?.balance || '0', 'VRTY');
    console.log('');

    // Summary
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║                  TRANSFER COMPLETE! 🎉                        ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('📋 Summary:');
    console.log('   User Wallet:', userWallet.address);
    console.log('   User Seed:', userWallet.seed);
    console.log('   VRTY Balance:', userVrtyLine?.balance || '0', 'VRTY');
    console.log('');
    console.log('🔗 View on Explorer:');
    console.log('   https://testnet.xrpl.org/accounts/' + userWallet.address);
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await client.disconnect();
    console.log('📡 Disconnected from XRPL');
  }
}

main()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
