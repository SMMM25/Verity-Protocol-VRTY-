#!/usr/bin/env npx ts-node
/**
 * Cancel all DEX offers for the treasury wallet
 */

import { Client, Wallet } from 'xrpl';

async function main() {
  const secret = process.env['TREASURY_WALLET_SECRET'];
  if (!secret) {
    console.log('❌ Set TREASURY_WALLET_SECRET environment variable');
    return;
  }

  const wallet = Wallet.fromSecret(secret);
  console.log(`\n🔑 Wallet: ${wallet.address}`);

  const client = new Client('wss://xrplcluster.com');
  console.log('🔗 Connecting to XRPL mainnet...');
  await client.connect();
  console.log('✅ Connected\n');

  try {
    // Get all offers for this account
    const offersResponse = await client.request({
      command: 'account_offers',
      account: wallet.address,
    });

    const offers = offersResponse.result.offers || [];
    console.log(`📊 Found ${offers.length} active offer(s)\n`);

    if (offers.length === 0) {
      console.log('✅ No offers to cancel');
      return;
    }

    // Cancel each offer
    for (const offer of offers) {
      console.log(`🗑️  Cancelling offer #${offer.seq}...`);
      
      const cancelTx = {
        TransactionType: 'OfferCancel' as const,
        Account: wallet.address,
        OfferSequence: offer.seq,
      };

      const prepared = await client.autofill(cancelTx);
      const signed = wallet.sign(prepared);
      const result = await client.submitAndWait(signed.tx_blob);

      const meta = result.result.meta as any;
      if (meta?.TransactionResult === 'tesSUCCESS') {
        console.log(`   ✅ Cancelled! TX: ${signed.hash}`);
      } else {
        console.log(`   ❌ Failed: ${meta?.TransactionResult}`);
      }
    }

    console.log(`\n✅ All offers cancelled!`);
    console.log(`📈 VRTY is no longer listed on DEX`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.disconnect();
    console.log('\n🔌 Disconnected');
  }
}

main();
