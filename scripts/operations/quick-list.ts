#!/usr/bin/env npx ts-node
/**
 * Quick VRTY DEX Listing - Minimal XRP Version
 * Creates a single sell order to establish the market
 */

import { Client, Wallet, xrpToDrops } from 'xrpl';

const ISSUER = 'rBeHfq9vRjZ8Cth1sMbp2nJvExmxSxAH8f';
const VRTY_HEX = '5652545900000000000000000000000000000000';

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
    // Check balance
    const accountInfo = await client.request({
      command: 'account_info',
      account: wallet.address,
    });
    const xrpBalance = Number(accountInfo.result.account_data.Balance) / 1000000;
    console.log(`💰 XRP Balance: ${xrpBalance} XRP`);

    if (xrpBalance < 5) {
      console.log('❌ Need at least 5 XRP for reserve + fees');
      return;
    }

    // Create a SELL order
    // Selling 1,000,000 VRTY for XRP at 0.02 XRP/VRTY = 20,000 XRP total
    const vrtyAmount = '1000000'; // 1 million VRTY
    const pricePerVRTY = 0.02; // 0.02 XRP per VRTY
    const xrpAmount = (parseFloat(vrtyAmount) * pricePerVRTY).toString();

    console.log(`\n📊 Creating SELL order:`);
    console.log(`   Selling: ${Number(vrtyAmount).toLocaleString()} VRTY`);
    console.log(`   Price: ${pricePerVRTY} XRP/VRTY (~$${(pricePerVRTY * 0.5).toFixed(4)}/VRTY)`);
    console.log(`   Total: ${Number(xrpAmount).toLocaleString()} XRP (~$${(parseFloat(xrpAmount) * 0.5).toLocaleString()})`);

    // SELL VRTY for XRP means:
    // - TakerGets = VRTY (what the taker receives from us)
    // - TakerPays = XRP (what the taker pays us)
    const sellOffer = {
      TransactionType: 'OfferCreate' as const,
      Account: wallet.address,
      TakerGets: {
        currency: VRTY_HEX,
        issuer: ISSUER,
        value: vrtyAmount,
      },
      TakerPays: xrpToDrops(xrpAmount),
    };

    console.log('\n⏳ Submitting transaction...');
    
    const prepared = await client.autofill(sellOffer);
    const signed = wallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);

    const meta = result.result.meta as any;
    if (meta?.TransactionResult === 'tesSUCCESS') {
      console.log(`\n✅ SUCCESS! VRTY is now listed on XRPL DEX!`);
      console.log(`   TX Hash: ${signed.hash}`);
      console.log(`   Explorer: https://livenet.xrpl.org/transactions/${signed.hash}`);
      console.log(`\n🎉 Anyone can now buy VRTY at 0.02 XRP (~$0.01) per token!`);
      console.log(`\n📈 View order book: https://livenet.xrpl.org/accounts/${wallet.address}`);
    } else {
      console.log(`\n❌ Transaction failed: ${meta?.TransactionResult}`);
      console.log(JSON.stringify(result.result, null, 2));
    }

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.data) {
      console.error('Details:', JSON.stringify(error.data, null, 2));
    }
  } finally {
    await client.disconnect();
    console.log('\n🔌 Disconnected');
  }
}

main();
