#!/usr/bin/env npx ts-node
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * VERITY PROTOCOL - VRTY TOKEN LAUNCH SCRIPT
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * THIS SCRIPT IS READY TO EXECUTE BUT SHOULD ONLY BE RUN WHEN:
 * 1. ✅ Utility/product is live and functional
 * 2. ✅ Legal review completed
 * 3. ✅ Geo-blocking in place (if needed)
 * 4. ✅ Treasury funded with sufficient XRP
 * 
 * WHAT THIS SCRIPT DOES:
 * - Creates full DEX order book (5 sell + 5 buy levels)
 * - Lists ~5M VRTY at various price points
 * - Establishes market with ~$50K liquidity
 * 
 * USAGE:
 *   # DRY RUN (shows what would happen, no transactions)
 *   TREASURY_WALLET_SECRET=xxx npx ts-node scripts/operations/LAUNCH_READY.ts --dry-run
 * 
 *   # LIVE EXECUTION (REAL TRANSACTIONS!)
 *   TREASURY_WALLET_SECRET=xxx npx ts-node scripts/operations/LAUNCH_READY.ts --execute
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { Client, Wallet, xrpToDrops, dropsToXrp } from 'xrpl';

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION - ADJUST THESE BEFORE LAUNCH
// ═══════════════════════════════════════════════════════════════════════════

const LAUNCH_CONFIG = {
  // Token details
  issuer: 'rBeHfq9vRjZ8Cth1sMbp2nJvExmxSxAH8f',
  currencyHex: '5652545900000000000000000000000000000000',
  
  // Pricing (adjust based on market conditions)
  basePrice: parseFloat(process.env['VRTY_PRICE'] || '0.02'), // XRP per VRTY
  
  // Order book structure
  spread: 0.02, // 2% spread
  levels: 5, // Number of price levels on each side
  orderSizeVRTY: '500000', // 500K VRTY per order level
  
  // Safety
  minXRPBalance: 50, // Minimum XRP required to proceed
};

// ═══════════════════════════════════════════════════════════════════════════
// LAUNCH SCRIPT
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isExecute = args.includes('--execute');

  if (!isDryRun && !isExecute) {
    printUsage();
    return;
  }

  const secret = process.env['TREASURY_WALLET_SECRET'];
  if (!secret) {
    console.log('❌ TREASURY_WALLET_SECRET environment variable required');
    return;
  }

  console.log('\n' + '═'.repeat(70));
  console.log('  VERITY PROTOCOL - VRTY TOKEN LAUNCH');
  console.log('═'.repeat(70));
  console.log(`\n  Mode: ${isDryRun ? '🔍 DRY RUN (no transactions)' : '🚀 LIVE EXECUTION'}\n`);

  const wallet = Wallet.fromSecret(secret);
  console.log(`  Wallet: ${wallet.address}`);

  const client = new Client('wss://xrplcluster.com');
  console.log('  Connecting to XRPL mainnet...');
  await client.connect();
  console.log('  ✅ Connected\n');

  try {
    // Check balances
    const accountInfo = await client.request({
      command: 'account_info',
      account: wallet.address,
    });
    const xrpBalance = Number(accountInfo.result.account_data.Balance) / 1000000;

    const linesResponse = await client.request({
      command: 'account_lines',
      account: wallet.address,
      peer: LAUNCH_CONFIG.issuer,
    });
    const vrtyLine = linesResponse.result.lines.find(
      (l: any) => l.currency === LAUNCH_CONFIG.currencyHex
    );
    const vrtyBalance = vrtyLine ? parseFloat(vrtyLine.balance) : 0;

    console.log('─'.repeat(70));
    console.log('  CURRENT BALANCES');
    console.log('─'.repeat(70));
    console.log(`  XRP:  ${xrpBalance.toLocaleString()} XRP`);
    console.log(`  VRTY: ${vrtyBalance.toLocaleString()} VRTY`);
    console.log('');

    // Validate
    if (xrpBalance < LAUNCH_CONFIG.minXRPBalance) {
      console.log(`  ❌ Insufficient XRP. Need at least ${LAUNCH_CONFIG.minXRPBalance} XRP.`);
      console.log(`     Current: ${xrpBalance} XRP`);
      console.log(`     Send more XRP to: ${wallet.address}`);
      return;
    }

    const totalVRTYNeeded = parseFloat(LAUNCH_CONFIG.orderSizeVRTY) * LAUNCH_CONFIG.levels;
    if (vrtyBalance < totalVRTYNeeded) {
      console.log(`  ❌ Insufficient VRTY for order book.`);
      console.log(`     Need: ${totalVRTYNeeded.toLocaleString()} VRTY`);
      console.log(`     Have: ${vrtyBalance.toLocaleString()} VRTY`);
      return;
    }

    // Calculate order book
    const orders = calculateOrderBook();
    
    console.log('─'.repeat(70));
    console.log('  ORDER BOOK TO CREATE');
    console.log('─'.repeat(70));
    console.log('');
    console.log('  SELL ORDERS (You sell VRTY, receive XRP):');
    for (const order of orders.filter(o => o.side === 'sell')) {
      const xrpValue = parseFloat(order.vrtyAmount) * order.price;
      console.log(`    ${order.vrtyAmount.toLocaleString().padStart(12)} VRTY @ ${order.price.toFixed(6)} XRP = ${xrpValue.toLocaleString()} XRP`);
    }
    
    console.log('');
    console.log('  BUY ORDERS (You buy VRTY, spend XRP):');
    for (const order of orders.filter(o => o.side === 'buy')) {
      const xrpValue = parseFloat(order.vrtyAmount) * order.price;
      console.log(`    ${order.vrtyAmount.toLocaleString().padStart(12)} VRTY @ ${order.price.toFixed(6)} XRP = ${xrpValue.toLocaleString()} XRP`);
    }

    const totalSellVRTY = orders.filter(o => o.side === 'sell').reduce((sum, o) => sum + parseFloat(o.vrtyAmount), 0);
    const totalSellXRP = orders.filter(o => o.side === 'sell').reduce((sum, o) => sum + parseFloat(o.vrtyAmount) * o.price, 0);
    const totalBuyXRP = orders.filter(o => o.side === 'buy').reduce((sum, o) => sum + parseFloat(o.vrtyAmount) * o.price, 0);

    console.log('');
    console.log('─'.repeat(70));
    console.log('  SUMMARY');
    console.log('─'.repeat(70));
    console.log(`  VRTY to list:    ${totalSellVRTY.toLocaleString()} VRTY`);
    console.log(`  Sell value:      ${totalSellXRP.toLocaleString()} XRP (~$${(totalSellXRP * 0.5).toLocaleString()})`);
    console.log(`  Buy liquidity:   ${totalBuyXRP.toLocaleString()} XRP (~$${(totalBuyXRP * 0.5).toLocaleString()})`);
    console.log(`  Base price:      ${LAUNCH_CONFIG.basePrice} XRP/VRTY (~$${(LAUNCH_CONFIG.basePrice * 0.5).toFixed(4)}/VRTY)`);
    console.log(`  FDV (1B VRTY):   ${(LAUNCH_CONFIG.basePrice * 1000000000).toLocaleString()} XRP (~$${(LAUNCH_CONFIG.basePrice * 1000000000 * 0.5).toLocaleString()})`);
    console.log('');

    if (isDryRun) {
      console.log('═'.repeat(70));
      console.log('  🔍 DRY RUN COMPLETE - No transactions executed');
      console.log('═'.repeat(70));
      console.log('');
      console.log('  To execute for real, run:');
      console.log('  TREASURY_WALLET_SECRET=xxx npx ts-node scripts/operations/LAUNCH_READY.ts --execute');
      console.log('');
      return;
    }

    // LIVE EXECUTION
    console.log('═'.repeat(70));
    console.log('  🚀 EXECUTING LIVE TRANSACTIONS');
    console.log('═'.repeat(70));
    console.log('');

    let successCount = 0;
    let failCount = 0;

    for (const order of orders) {
      const xrpAmount = (parseFloat(order.vrtyAmount) * order.price).toString();
      
      let takerGets: any;
      let takerPays: any;

      if (order.side === 'sell') {
        // Selling VRTY for XRP: taker gets VRTY, pays XRP
        takerGets = {
          currency: LAUNCH_CONFIG.currencyHex,
          issuer: LAUNCH_CONFIG.issuer,
          value: order.vrtyAmount,
        };
        takerPays = xrpToDrops(xrpAmount);
      } else {
        // Buying VRTY with XRP: taker gets XRP, pays VRTY
        takerGets = xrpToDrops(xrpAmount);
        takerPays = {
          currency: LAUNCH_CONFIG.currencyHex,
          issuer: LAUNCH_CONFIG.issuer,
          value: order.vrtyAmount,
        };
      }

      const offerTx = {
        TransactionType: 'OfferCreate' as const,
        Account: wallet.address,
        TakerGets: takerGets,
        TakerPays: takerPays,
      };

      console.log(`  ${order.side.toUpperCase().padEnd(4)} ${parseFloat(order.vrtyAmount).toLocaleString().padStart(10)} VRTY @ ${order.price.toFixed(6)}...`);

      try {
        const prepared = await client.autofill(offerTx);
        const signed = wallet.sign(prepared);
        const result = await client.submitAndWait(signed.tx_blob);

        const meta = result.result.meta as any;
        if (meta?.TransactionResult === 'tesSUCCESS') {
          console.log(`       ✅ ${signed.hash.slice(0, 20)}...`);
          successCount++;
        } else {
          console.log(`       ❌ ${meta?.TransactionResult}`);
          failCount++;
        }
      } catch (err: any) {
        console.log(`       ❌ ${err.message}`);
        failCount++;
      }
    }

    console.log('');
    console.log('═'.repeat(70));
    console.log('  🎉 LAUNCH COMPLETE!');
    console.log('═'.repeat(70));
    console.log(`  Successful orders: ${successCount}`);
    console.log(`  Failed orders:     ${failCount}`);
    console.log('');
    console.log(`  📈 View order book: https://livenet.xrpl.org/accounts/${wallet.address}`);
    console.log(`  🔗 Trade on Sologenic: https://sologenic.org/trade?market=VRTY%2B${LAUNCH_CONFIG.issuer}%2FXRP`);
    console.log('');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.disconnect();
  }
}

function calculateOrderBook(): Array<{ side: 'buy' | 'sell'; price: number; vrtyAmount: string }> {
  const orders: Array<{ side: 'buy' | 'sell'; price: number; vrtyAmount: string }> = [];
  const halfSpread = LAUNCH_CONFIG.spread / 2;
  const priceIncrement = 0.001; // 0.001 XRP between levels

  // Sell orders (above mid price)
  for (let i = 0; i < LAUNCH_CONFIG.levels; i++) {
    const price = LAUNCH_CONFIG.basePrice * (1 + halfSpread) + (i * priceIncrement);
    orders.push({
      side: 'sell',
      price,
      vrtyAmount: LAUNCH_CONFIG.orderSizeVRTY,
    });
  }

  // Buy orders (below mid price)
  for (let i = 0; i < LAUNCH_CONFIG.levels; i++) {
    const price = LAUNCH_CONFIG.basePrice * (1 - halfSpread) - (i * priceIncrement);
    orders.push({
      side: 'buy',
      price,
      vrtyAmount: LAUNCH_CONFIG.orderSizeVRTY,
    });
  }

  return orders;
}

function printUsage() {
  console.log(`
═══════════════════════════════════════════════════════════════════════════
  VERITY PROTOCOL - VRTY TOKEN LAUNCH SCRIPT
═══════════════════════════════════════════════════════════════════════════

  ⚠️  DO NOT EXECUTE UNTIL:
  1. ✅ Utility/product is live and functional
  2. ✅ Legal review completed  
  3. ✅ Geo-blocking in place (if needed)
  4. ✅ Treasury funded with 50+ XRP

  USAGE:

    # DRY RUN - See what would happen (safe, no transactions)
    TREASURY_WALLET_SECRET=xxx npx ts-node scripts/operations/LAUNCH_READY.ts --dry-run

    # LIVE EXECUTION - Create real orders (IRREVERSIBLE!)
    TREASURY_WALLET_SECRET=xxx npx ts-node scripts/operations/LAUNCH_READY.ts --execute

  CONFIGURATION:
    Base Price:  ${LAUNCH_CONFIG.basePrice} XRP/VRTY (~$${(LAUNCH_CONFIG.basePrice * 0.5).toFixed(4)}/VRTY)
    Spread:      ${LAUNCH_CONFIG.spread * 100}%
    Levels:      ${LAUNCH_CONFIG.levels} on each side
    Order Size:  ${parseInt(LAUNCH_CONFIG.orderSizeVRTY).toLocaleString()} VRTY per level

═══════════════════════════════════════════════════════════════════════════
`);
}

main();
