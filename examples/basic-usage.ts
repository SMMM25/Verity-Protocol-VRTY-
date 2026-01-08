/**
 * Verity Protocol - Basic Usage Example
 * 
 * This example demonstrates the basic setup and usage of the Verity SDK
 * for interacting with the XRP Ledger.
 */

import { VeritySDK } from '@verity-protocol/sdk';

async function main() {
  // Initialize the SDK
  const verity = new VeritySDK({
    network: 'testnet',
    enableVerification: true,
  });

  try {
    // Connect to XRPL
    await verity.initialize();
    console.log('✓ Connected to XRPL testnet');

    // Generate a new wallet
    const wallet = verity.generateWallet();
    console.log(`✓ Generated wallet: ${wallet.address}`);

    // Fund the wallet (testnet only)
    const { balance } = await verity.fundWallet(wallet);
    console.log(`✓ Funded wallet with ${balance} XRP`);

    // Check balance
    const currentBalance = await verity.getBalance(wallet.address);
    console.log(`✓ Current balance: ${currentBalance} XRP`);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Disconnect
    await verity.disconnect();
    console.log('✓ Disconnected from XRPL');
  }
}

main();
