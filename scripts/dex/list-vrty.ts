#!/usr/bin/env npx ts-node
/**
 * Verity Protocol - VRTY DEX Listing Script
 * 
 * @description Lists VRTY on XRPL DEX by creating initial liquidity.
 * 
 * Usage:
 *   npx ts-node scripts/dex/list-vrty.ts [command]
 * 
 * Commands:
 *   check      - Check current order book and prices
 *   quote      - Get a quote for buying/selling
 *   list       - Create initial listing (requires wallet)
 *   status     - Show market maker status
 *   start-mm   - Start market maker bot
 *   stop-mm    - Stop market maker bot
 */

import { Wallet } from 'xrpl';
import * as readline from 'readline';
import { DexService, getDexService } from '../../src/dex/DexService.js';
import { MarketMaker, getMarketMaker } from '../../src/dex/MarketMaker.js';
import { VRTY_XRP_PAIR } from '../../src/dex/types.js';

// ============================================================
// CONFIGURATION
// ============================================================

const NETWORK = (process.env['XRPL_NETWORK'] as any) || 'mainnet';

// Initial listing parameters
const LISTING_CONFIG = {
  // Initial price: 0.02 XRP per VRTY (~$0.01 at $0.50 XRP)
  initialPrice: '0.02',
  
  // Initial liquidity
  vrtyLiquidity: '5000000', // 5 million VRTY
  xrpLiquidity: '100000',   // 100,000 XRP (~$50,000)
  
  // Spread
  spread: 2, // 2%
  
  // Order levels
  levels: 5,
  orderSize: '100000', // 100,000 VRTY per order
};

// ============================================================
// HELPERS
// ============================================================

function formatNumber(num: string | number): string {
  return Number(num).toLocaleString();
}

async function promptConfirmation(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`\n${message} (yes/no): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes');
    });
  });
}

// ============================================================
// COMMANDS
// ============================================================

/**
 * Check current order book
 */
async function checkOrderBook(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('  VRTY/XRP ORDER BOOK');
  console.log('='.repeat(60) + '\n');

  const dex = getDexService(NETWORK);
  await dex.connect();

  try {
    const orderBook = await dex.getOrderBook(VRTY_XRP_PAIR, 10);

    console.log(`📊 Network: ${NETWORK}`);
    console.log(`📊 Pair: VRTY/XRP`);
    console.log(`📊 Timestamp: ${orderBook.timestamp}`);

    if (orderBook.midPrice) {
      const xrpPrice = parseFloat(orderBook.midPrice);
      const usdPrice = xrpPrice * 0.5; // Assuming $0.50 XRP
      console.log(`\n💰 Mid Price: ${orderBook.midPrice} XRP (~$${usdPrice.toFixed(4)} USD)`);
      console.log(`📈 Spread: ${orderBook.spread?.toFixed(2)}%`);
    } else {
      console.log('\n⚠️  No market exists yet - be the first to list!');
    }

    // Display asks
    console.log('\n📕 ASKS (Sell Orders):');
    console.log('-'.repeat(60));
    if (orderBook.asks.length === 0) {
      console.log('   No sell orders');
    } else {
      console.log('   Price (XRP)    |    Amount (VRTY)    |    Total (XRP)');
      console.log('-'.repeat(60));
      for (const ask of orderBook.asks.slice(0, 5)) {
        console.log(`   ${ask.price.padStart(12)} | ${formatNumber(ask.amount).padStart(17)} | ${formatNumber(ask.total).padStart(15)}`);
      }
    }

    // Display bids
    console.log('\n📗 BIDS (Buy Orders):');
    console.log('-'.repeat(60));
    if (orderBook.bids.length === 0) {
      console.log('   No buy orders');
    } else {
      console.log('   Price (XRP)    |    Amount (VRTY)    |    Total (XRP)');
      console.log('-'.repeat(60));
      for (const bid of orderBook.bids.slice(0, 5)) {
        console.log(`   ${bid.price.padStart(12)} | ${formatNumber(bid.amount).padStart(17)} | ${formatNumber(bid.total).padStart(15)}`);
      }
    }

  } finally {
    await dex.disconnect();
  }
}

/**
 * Get quote for trading
 */
async function getQuote(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('  VRTY PRICE QUOTE');
  console.log('='.repeat(60) + '\n');

  const dex = getDexService(NETWORK);
  await dex.connect();

  try {
    const currentPrice = await dex.getCurrentPrice(VRTY_XRP_PAIR);
    
    if (!currentPrice) {
      console.log('⚠️  No market exists yet');
      console.log(`\nSuggested listing price: ${LISTING_CONFIG.initialPrice} XRP/VRTY`);
      
      const xrpPrice = parseFloat(LISTING_CONFIG.initialPrice);
      console.log(`\nAt this price:`);
      console.log(`   1 VRTY = ${xrpPrice} XRP (~$${(xrpPrice * 0.5).toFixed(4)} USD)`);
      console.log(`   1,000 VRTY = ${xrpPrice * 1000} XRP (~$${(xrpPrice * 1000 * 0.5).toFixed(2)} USD)`);
      console.log(`   1,000,000 VRTY = ${formatNumber(xrpPrice * 1000000)} XRP (~$${formatNumber(xrpPrice * 1000000 * 0.5)} USD)`);
      return;
    }

    const xrpPrice = parseFloat(currentPrice);
    const usdPrice = xrpPrice * 0.5; // Assuming $0.50 XRP

    console.log(`Current Market Price:`);
    console.log(`   1 VRTY = ${currentPrice} XRP (~$${usdPrice.toFixed(4)} USD)`);
    
    console.log(`\nBuy/Sell Quotes:`);
    console.log(`   Buy 1,000 VRTY = ${formatNumber(xrpPrice * 1000)} XRP (~$${formatNumber(xrpPrice * 1000 * 0.5)} USD)`);
    console.log(`   Buy 10,000 VRTY = ${formatNumber(xrpPrice * 10000)} XRP (~$${formatNumber(xrpPrice * 10000 * 0.5)} USD)`);
    console.log(`   Buy 100,000 VRTY = ${formatNumber(xrpPrice * 100000)} XRP (~$${formatNumber(xrpPrice * 100000 * 0.5)} USD)`);

    console.log(`\nFully Diluted Valuation (1B VRTY):`);
    const fdv = xrpPrice * 1000000000;
    console.log(`   ${formatNumber(fdv)} XRP (~$${formatNumber(fdv * 0.5)} USD)`);

  } finally {
    await dex.disconnect();
  }
}

/**
 * Create initial listing
 */
async function createListing(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('  VRTY DEX LISTING');
  console.log('='.repeat(60) + '\n');

  console.log('📋 Listing Configuration:');
  console.log(`   Initial Price: ${LISTING_CONFIG.initialPrice} XRP/VRTY`);
  console.log(`   VRTY Liquidity: ${formatNumber(LISTING_CONFIG.vrtyLiquidity)} VRTY`);
  console.log(`   XRP Liquidity: ${formatNumber(LISTING_CONFIG.xrpLiquidity)} XRP`);
  console.log(`   Spread: ${LISTING_CONFIG.spread}%`);
  console.log(`   Order Levels: ${LISTING_CONFIG.levels}`);
  console.log(`   Order Size: ${formatNumber(LISTING_CONFIG.orderSize)} VRTY`);

  const xrpValue = parseFloat(LISTING_CONFIG.vrtyLiquidity) * parseFloat(LISTING_CONFIG.initialPrice);
  console.log(`\n💰 Total Liquidity Value: ~${formatNumber(xrpValue)} XRP (~$${formatNumber(xrpValue * 0.5)} USD)`);

  console.log('\n⚠️  IMPORTANT:');
  console.log('   This will create sell orders on XRPL DEX.');
  console.log('   You need a funded XRPL wallet with:');
  console.log(`   - At least ${formatNumber(LISTING_CONFIG.vrtyLiquidity)} VRTY`);
  console.log(`   - At least ${formatNumber(LISTING_CONFIG.xrpLiquidity)} XRP`);

  const walletSecret = process.env['MARKET_MAKER_SECRET'];
  if (!walletSecret) {
    console.log('\n❌ MARKET_MAKER_SECRET environment variable not set.');
    console.log('   Set this to the secret of a funded XRPL wallet.');
    console.log('\n   Example:');
    console.log('   MARKET_MAKER_SECRET=sXXXX npx ts-node scripts/dex/list-vrty.ts list');
    return;
  }

  const confirmed = await promptConfirmation('Proceed with listing?');
  if (!confirmed) {
    console.log('\n🚫 Listing cancelled.');
    return;
  }

  const dex = getDexService(NETWORK);
  await dex.connect();

  try {
    const wallet = Wallet.fromSecret(walletSecret);
    console.log(`\n🔑 Using wallet: ${wallet.address}`);

    // Check balances
    const xrpBalance = await dex.getXRPBalance(wallet.address);
    const vrtyBalance = await dex.getVRTYBalance(wallet.address);

    console.log(`   XRP Balance: ${formatNumber(xrpBalance)}`);
    console.log(`   VRTY Balance: ${formatNumber(vrtyBalance)}`);

    if (parseFloat(vrtyBalance) < parseFloat(LISTING_CONFIG.vrtyLiquidity)) {
      console.log(`\n❌ Insufficient VRTY balance.`);
      return;
    }

    // Create sell orders at multiple price levels
    const halfSpread = LISTING_CONFIG.spread / 200;
    const basePrice = parseFloat(LISTING_CONFIG.initialPrice);
    const askPrice = basePrice * (1 + halfSpread);
    const bidPrice = basePrice * (1 - halfSpread);
    const levelIncrement = 0.001; // 0.001 XRP between levels
    const orderSize = LISTING_CONFIG.orderSize;

    console.log('\n📊 Creating orders...');

    for (let level = 0; level < LISTING_CONFIG.levels; level++) {
      const priceOffset = level * levelIncrement;

      // Create sell order
      const sellPrice = (askPrice + priceOffset).toFixed(8);
      console.log(`\n   Creating SELL order: ${formatNumber(orderSize)} VRTY @ ${sellPrice} XRP`);
      
      const sellResult = await dex.createOffer(wallet, {
        account: wallet.address,
        side: 'sell',
        amount: orderSize,
        price: sellPrice,
        pair: VRTY_XRP_PAIR,
      });

      if (sellResult.success) {
        console.log(`   ✅ Sell order created: ${sellResult.txHash}`);
      } else {
        console.log(`   ❌ Sell order failed: ${sellResult.error}`);
      }

      // Create buy order
      const buyPrice = (bidPrice - priceOffset).toFixed(8);
      console.log(`   Creating BUY order: ${formatNumber(orderSize)} VRTY @ ${buyPrice} XRP`);
      
      const buyResult = await dex.createOffer(wallet, {
        account: wallet.address,
        side: 'buy',
        amount: orderSize,
        price: buyPrice,
        pair: VRTY_XRP_PAIR,
      });

      if (buyResult.success) {
        console.log(`   ✅ Buy order created: ${buyResult.txHash}`);
      } else {
        console.log(`   ❌ Buy order failed: ${buyResult.error}`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('  LISTING COMPLETE!');
    console.log('='.repeat(60));
    console.log(`\n🎉 VRTY is now listed on XRPL DEX!`);
    console.log(`   Initial Price: ${LISTING_CONFIG.initialPrice} XRP/VRTY`);
    console.log(`   Trade at: https://xrpl.org/dex.html`);

  } finally {
    await dex.disconnect();
  }
}

/**
 * Start market maker
 */
async function startMarketMaker(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('  STARTING MARKET MAKER');
  console.log('='.repeat(60) + '\n');

  const walletSecret = process.env['MARKET_MAKER_SECRET'];
  if (!walletSecret) {
    console.log('❌ MARKET_MAKER_SECRET environment variable not set.');
    return;
  }

  const wallet = Wallet.fromSecret(walletSecret);
  console.log(`🔑 Wallet: ${wallet.address}`);

  const mm = getMarketMaker({
    targetSpread: 2,
    orderSize: '100000',
    levels: 3,
    updateInterval: 60000,
  });

  await mm.initialize(wallet);
  await mm.start();

  console.log('\n✅ Market maker started!');
  console.log('   Press Ctrl+C to stop.\n');

  // Keep process running
  process.on('SIGINT', async () => {
    console.log('\nStopping market maker...');
    await mm.stop();
    process.exit(0);
  });
}

/**
 * Show market maker status
 */
async function showStatus(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('  MARKET MAKER STATUS');
  console.log('='.repeat(60) + '\n');

  const mm = getMarketMaker();
  const status = await mm.getStatus();

  console.log(`Running: ${status.running ? '✅ Yes' : '❌ No'}`);
  console.log(`\nBalances:`);
  console.log(`   XRP: ${formatNumber(status.quoteBalance)}`);
  console.log(`   VRTY: ${formatNumber(status.baseBalance)}`);
  console.log(`   Total Value: ${formatNumber(status.totalValue)} XRP`);
  
  console.log(`\nOrders:`);
  console.log(`   Active Bids: ${status.activeBids.length}`);
  console.log(`   Active Asks: ${status.activeAsks.length}`);
  
  console.log(`\nPerformance:`);
  console.log(`   P&L: ${status.pnl} XRP`);
  console.log(`   Trades: ${status.tradesExecuted}`);
  console.log(`   Volume: ${formatNumber(status.volumeTraded)} VRTY`);
  console.log(`   Uptime: ${Math.floor(status.uptime / 1000 / 60)} minutes`);
}

// ============================================================
// CLI
// ============================================================

async function main(): Promise<void> {
  const command = process.argv[2] || 'help';

  try {
    switch (command) {
      case 'check':
        await checkOrderBook();
        break;

      case 'quote':
        await getQuote();
        break;

      case 'list':
        await createListing();
        break;

      case 'status':
        await showStatus();
        break;

      case 'start-mm':
        await startMarketMaker();
        break;

      case 'help':
      default:
        console.log(`
╔══════════════════════════════════════════════════════════════╗
║     VRTY DEX Listing Script                                  ║
║     List and trade VRTY on XRPL DEX                         ║
╚══════════════════════════════════════════════════════════════╝

Commands:
  check      Check current VRTY/XRP order book
  quote      Get price quotes for VRTY
  list       Create initial DEX listing (requires funded wallet)
  status     Show market maker status
  start-mm   Start automated market maker

Environment Variables:
  XRPL_NETWORK         Network (mainnet, testnet, devnet)
  MARKET_MAKER_SECRET  XRPL wallet secret for trading

Initial Listing Parameters:
  Price: ${LISTING_CONFIG.initialPrice} XRP/VRTY (~$${parseFloat(LISTING_CONFIG.initialPrice) * 0.5}/VRTY)
  VRTY Liquidity: ${formatNumber(LISTING_CONFIG.vrtyLiquidity)} VRTY
  XRP Liquidity: ${formatNumber(LISTING_CONFIG.xrpLiquidity)} XRP
  Spread: ${LISTING_CONFIG.spread}%

Examples:
  npx ts-node scripts/dex/list-vrty.ts check
  npx ts-node scripts/dex/list-vrty.ts quote
  MARKET_MAKER_SECRET=sXXXX npx ts-node scripts/dex/list-vrty.ts list

At Initial Price (${LISTING_CONFIG.initialPrice} XRP/VRTY):
  1 VRTY = ~$${parseFloat(LISTING_CONFIG.initialPrice) * 0.5} USD
  Total Supply Value = ~$${formatNumber(parseFloat(LISTING_CONFIG.initialPrice) * 0.5 * 1000000000)} USD (FDV)
        `);
    }
  } catch (error) {
    console.error('\n❌ Error:', (error as Error).message);
    process.exit(1);
  }
}

main();
