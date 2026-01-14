#!/usr/bin/env npx ts-node
/**
 * Verity Protocol - VRTY Launch Operations Script
 * 
 * @description Complete operational script to:
 * 1. Verify VRTY token setup on XRPL
 * 2. Set up and fund escrow with VRTY tokens
 * 3. Create initial DEX liquidity
 * 4. Start market maker (optional)
 * 
 * CRITICAL: This script handles REAL FUNDS. Review all operations carefully.
 * 
 * Prerequisites:
 * - VRTY token already issued on XRPL
 * - Treasury wallet funded with VRTY + XRP for fees
 * - Environment variables configured
 * 
 * Usage:
 *   npx ts-node scripts/operations/launch-vrty.ts [command]
 * 
 * Commands:
 *   check          - Verify all prerequisites and current state
 *   setup-escrow   - Initialize escrow and transfer VRTY
 *   list-dex       - Create initial DEX offers
 *   full-launch    - Complete launch sequence (escrow + DEX)
 *   status         - Show current operational status
 */

import { Client, Wallet, xrpToDrops, dropsToXrp } from 'xrpl';
import * as readline from 'readline';
import * as fs from 'fs';

// ============================================================
// CONFIGURATION
// ============================================================

const CONFIG = {
  // Network (change to 'mainnet' for production)
  network: (process.env['XRPL_NETWORK'] as 'mainnet' | 'testnet' | 'devnet') || 'testnet',
  
  // VRTY Token Configuration
  vrty: {
    currencyCode: 'VRTY',
    issuerAddress: process.env['VRTY_ISSUER_ADDRESS'] || 'rBeHfq9vRjZ8Cth1sMbp2nJvExmxSxAH8f',
    totalSupply: '1000000000', // 1 billion
  },
  
  // Wallet Addresses
  wallets: {
    treasury: process.env['VRTY_TREASURY_WALLET'] || 'rLmLMErLKDzWXyYmcZGHqQ3SCgTVJCVjA3',
    escrow: process.env['VRTY_ESCROW_WALLET'] || '', // Will be generated or provided
    dexLiquidity: process.env['VRTY_DEX_WALLET'] || '', // Can be same as treasury
  },
  
  // Token Distribution
  distribution: {
    treasury: { percent: 65, amount: '650000000' },
    founder: { percent: 20, amount: '200000000' },
    ecosystem: { percent: 15, amount: '150000000' },
  },
  
  // DEX Listing Parameters
  dex: {
    initialPrice: process.env['VRTY_INITIAL_PRICE'] || '0.02', // XRP per VRTY
    initialLiquidity: process.env['VRTY_INITIAL_LIQUIDITY'] || '10000000', // 10M VRTY
    spread: 2, // 2%
    levels: 5, // Order book depth
    orderSize: '500000', // 500K VRTY per level
  },
};

const XRPL_ENDPOINTS = {
  mainnet: 'wss://xrplcluster.com',
  testnet: 'wss://s.altnet.rippletest.net:51233',
  devnet: 'wss://s.devnet.rippletest.net:51233',
};

// ============================================================
// HELPERS
// ============================================================

function formatNumber(num: string | number): string {
  return Number(num).toLocaleString();
}

function formatXRP(drops: string | number): string {
  const xrp = typeof drops === 'string' ? parseFloat(drops) : drops;
  return `${xrp.toLocaleString()} XRP`;
}

async function prompt(message: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(message, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function confirm(message: string): Promise<boolean> {
  const answer = await prompt(`\n⚠️  ${message} (yes/no): `);
  return answer.toLowerCase() === 'yes';
}

function printHeader(title: string): void {
  console.log('\n' + '═'.repeat(70));
  console.log(`  ${title}`);
  console.log('═'.repeat(70) + '\n');
}

function printSection(title: string): void {
  console.log('\n' + '─'.repeat(50));
  console.log(`  ${title}`);
  console.log('─'.repeat(50));
}

// ============================================================
// XRPL CLIENT
// ============================================================

class XRPLOperations {
  private client: Client | null = null;

  async connect(): Promise<Client> {
    if (this.client?.isConnected()) {
      return this.client;
    }
    
    const endpoint = XRPL_ENDPOINTS[CONFIG.network];
    console.log(`🔗 Connecting to XRPL ${CONFIG.network}...`);
    
    this.client = new Client(endpoint);
    await this.client.connect();
    
    console.log(`✅ Connected to ${endpoint}`);
    return this.client;
  }

  async disconnect(): Promise<void> {
    if (this.client?.isConnected()) {
      await this.client.disconnect();
      console.log('🔌 Disconnected from XRPL');
    }
  }

  async getAccountInfo(address: string): Promise<any> {
    const client = await this.connect();
    try {
      const response = await client.request({
        command: 'account_info',
        account: address,
      });
      return response.result.account_data;
    } catch (error: any) {
      if (error.data?.error === 'actNotFound') {
        return null;
      }
      throw error;
    }
  }

  async getXRPBalance(address: string): Promise<string> {
    const accountInfo = await this.getAccountInfo(address);
    if (!accountInfo) return '0';
    return dropsToXrp(accountInfo.Balance).toString();
  }

  async getVRTYBalance(address: string): Promise<string> {
    const client = await this.connect();
    try {
      const response = await client.request({
        command: 'account_lines',
        account: address,
        peer: CONFIG.vrty.issuerAddress,
      });
      
      const vrtyLine = response.result.lines.find(
        (line: any) => line.currency === CONFIG.vrty.currencyCode
      );
      
      return vrtyLine?.balance || '0';
    } catch {
      return '0';
    }
  }

  async checkTrustline(address: string, issuer: string, currency: string): Promise<boolean> {
    const client = await this.connect();
    try {
      const response = await client.request({
        command: 'account_lines',
        account: address,
        peer: issuer,
      });
      
      return response.result.lines.some(
        (line: any) => line.currency === currency
      );
    } catch {
      return false;
    }
  }

  async createTrustline(
    wallet: Wallet,
    issuer: string,
    currency: string,
    limit: string = '1000000000'
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    const client = await this.connect();
    
    try {
      const trustSet = {
        TransactionType: 'TrustSet' as const,
        Account: wallet.address,
        LimitAmount: {
          currency,
          issuer,
          value: limit,
        },
      };

      const prepared = await client.autofill(trustSet);
      const signed = wallet.sign(prepared);
      const result = await client.submitAndWait(signed.tx_blob);

      const meta = result.result.meta as any;
      if (meta?.TransactionResult === 'tesSUCCESS') {
        return { success: true, txHash: signed.hash };
      }
      return { success: false, error: meta?.TransactionResult || 'Unknown error' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async transferVRTY(
    sourceWallet: Wallet,
    destination: string,
    amount: string,
    memo?: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    const client = await this.connect();
    
    try {
      const payment: any = {
        TransactionType: 'Payment',
        Account: sourceWallet.address,
        Destination: destination,
        Amount: {
          currency: CONFIG.vrty.currencyCode,
          issuer: CONFIG.vrty.issuerAddress,
          value: amount,
        },
      };

      if (memo) {
        payment.Memos = [{
          Memo: {
            MemoType: Buffer.from('vrty-operation', 'utf8').toString('hex').toUpperCase(),
            MemoData: Buffer.from(memo, 'utf8').toString('hex').toUpperCase(),
          },
        }];
      }

      const prepared = await client.autofill(payment);
      const signed = sourceWallet.sign(prepared);
      const result = await client.submitAndWait(signed.tx_blob);

      const meta = result.result.meta as any;
      if (meta?.TransactionResult === 'tesSUCCESS') {
        return { success: true, txHash: signed.hash };
      }
      return { success: false, error: meta?.TransactionResult || 'Unknown error' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async createDEXOffer(
    wallet: Wallet,
    side: 'buy' | 'sell',
    vrtyAmount: string,
    priceXRP: string
  ): Promise<{ success: boolean; txHash?: string; sequence?: number; error?: string }> {
    const client = await this.connect();
    
    try {
      const xrpAmount = (parseFloat(vrtyAmount) * parseFloat(priceXRP)).toString();
      
      let takerGets: any;
      let takerPays: any;

      if (side === 'sell') {
        // Selling VRTY for XRP
        takerGets = xrpToDrops(xrpAmount);
        takerPays = {
          currency: CONFIG.vrty.currencyCode,
          issuer: CONFIG.vrty.issuerAddress,
          value: vrtyAmount,
        };
      } else {
        // Buying VRTY with XRP
        takerGets = {
          currency: CONFIG.vrty.currencyCode,
          issuer: CONFIG.vrty.issuerAddress,
          value: vrtyAmount,
        };
        takerPays = xrpToDrops(xrpAmount);
      }

      const offerCreate = {
        TransactionType: 'OfferCreate' as const,
        Account: wallet.address,
        TakerGets: takerGets,
        TakerPays: takerPays,
      };

      const prepared = await client.autofill(offerCreate);
      const signed = wallet.sign(prepared);
      const result = await client.submitAndWait(signed.tx_blob);

      const meta = result.result.meta as any;
      if (meta?.TransactionResult === 'tesSUCCESS') {
        return { 
          success: true, 
          txHash: signed.hash,
          sequence: (prepared as any).Sequence,
        };
      }
      return { success: false, error: meta?.TransactionResult || 'Unknown error' };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async getOrderBook(): Promise<{ asks: any[]; bids: any[] }> {
    const client = await this.connect();
    
    const takerGets = { currency: 'XRP' };
    const takerPays = { 
      currency: CONFIG.vrty.currencyCode, 
      issuer: CONFIG.vrty.issuerAddress 
    };

    // Get asks (selling VRTY for XRP)
    const asksResponse = await client.request({
      command: 'book_offers',
      taker_gets: takerGets,
      taker_pays: takerPays,
      limit: 10,
    });

    // Get bids (buying VRTY with XRP)
    const bidsResponse = await client.request({
      command: 'book_offers',
      taker_gets: takerPays,
      taker_pays: takerGets,
      limit: 10,
    });

    return {
      asks: asksResponse.result.offers || [],
      bids: bidsResponse.result.offers || [],
    };
  }
}

// ============================================================
// COMMANDS
// ============================================================

const xrpl = new XRPLOperations();

/**
 * Check prerequisites and current state
 */
async function checkPrerequisites(): Promise<void> {
  printHeader('VRTY LAUNCH PRE-CHECK');
  
  console.log('📋 Configuration:');
  console.log(`   Network: ${CONFIG.network.toUpperCase()}`);
  console.log(`   VRTY Issuer: ${CONFIG.vrty.issuerAddress}`);
  console.log(`   Treasury: ${CONFIG.wallets.treasury}`);
  console.log(`   Total Supply: ${formatNumber(CONFIG.vrty.totalSupply)} VRTY`);
  console.log(`   Initial DEX Price: ${CONFIG.dex.initialPrice} XRP/VRTY`);

  printSection('Checking XRPL Accounts');

  // Check issuer account
  console.log('\n🏦 Issuer Account:');
  const issuerInfo = await xrpl.getAccountInfo(CONFIG.vrty.issuerAddress);
  if (issuerInfo) {
    const issuerXRP = await xrpl.getXRPBalance(CONFIG.vrty.issuerAddress);
    console.log(`   ✅ Account exists`);
    console.log(`   XRP Balance: ${formatXRP(issuerXRP)}`);
  } else {
    console.log(`   ❌ Account NOT FOUND - Token not issued yet!`);
    return;
  }

  // Check treasury account
  console.log('\n💰 Treasury Account:');
  const treasuryInfo = await xrpl.getAccountInfo(CONFIG.wallets.treasury);
  if (treasuryInfo) {
    const treasuryXRP = await xrpl.getXRPBalance(CONFIG.wallets.treasury);
    const treasuryVRTY = await xrpl.getVRTYBalance(CONFIG.wallets.treasury);
    console.log(`   ✅ Account exists`);
    console.log(`   XRP Balance: ${formatXRP(treasuryXRP)}`);
    console.log(`   VRTY Balance: ${formatNumber(treasuryVRTY)}`);
    
    if (parseFloat(treasuryVRTY) === 0) {
      console.log(`   ⚠️  WARNING: No VRTY in treasury!`);
      console.log(`   You need to transfer VRTY from issuer to treasury first.`);
    }
  } else {
    console.log(`   ❌ Account NOT FOUND`);
  }

  // Check trustline
  const hasTrustline = await xrpl.checkTrustline(
    CONFIG.wallets.treasury, 
    CONFIG.vrty.issuerAddress, 
    CONFIG.vrty.currencyCode
  );
  console.log(`   Trustline: ${hasTrustline ? '✅ Established' : '❌ Not set'}`);

  // Check DEX order book
  printSection('DEX Order Book');
  const orderBook = await xrpl.getOrderBook();
  
  console.log(`\n📊 Current Market:`);
  console.log(`   Sell Orders: ${orderBook.asks.length}`);
  console.log(`   Buy Orders: ${orderBook.bids.length}`);
  
  if (orderBook.asks.length === 0 && orderBook.bids.length === 0) {
    console.log(`\n   ℹ️  No market exists yet - VRTY not listed on DEX`);
  }

  printSection('Summary');
  console.log('\nNext Steps:');
  console.log('1. Ensure treasury wallet has VRTY tokens');
  console.log('2. Run: npx ts-node scripts/operations/launch-vrty.ts list-dex');
  console.log('3. Or run full launch: npx ts-node scripts/operations/launch-vrty.ts full-launch');
}

/**
 * Create DEX listing
 */
async function listOnDEX(): Promise<void> {
  printHeader('VRTY DEX LISTING');

  const walletSecret = process.env['TREASURY_WALLET_SECRET'];
  if (!walletSecret) {
    console.log('❌ TREASURY_WALLET_SECRET environment variable not set.');
    console.log('\nTo list on DEX, set the treasury wallet secret:');
    console.log('TREASURY_WALLET_SECRET=sXXXX npx ts-node scripts/operations/launch-vrty.ts list-dex');
    return;
  }

  const wallet = Wallet.fromSecret(walletSecret);
  console.log(`🔑 Using wallet: ${wallet.address}`);

  // Check balances
  const xrpBalance = await xrpl.getXRPBalance(wallet.address);
  const vrtyBalance = await xrpl.getVRTYBalance(wallet.address);

  console.log(`\n💰 Wallet Balances:`);
  console.log(`   XRP: ${formatXRP(xrpBalance)}`);
  console.log(`   VRTY: ${formatNumber(vrtyBalance)}`);

  if (parseFloat(vrtyBalance) < parseFloat(CONFIG.dex.initialLiquidity)) {
    console.log(`\n❌ Insufficient VRTY balance for listing.`);
    console.log(`   Required: ${formatNumber(CONFIG.dex.initialLiquidity)} VRTY`);
    console.log(`   Available: ${formatNumber(vrtyBalance)} VRTY`);
    return;
  }

  if (parseFloat(xrpBalance) < 100) {
    console.log(`\n❌ Insufficient XRP for transaction fees.`);
    console.log(`   Recommended: At least 100 XRP`);
    return;
  }

  printSection('DEX Listing Plan');
  
  const basePrice = parseFloat(CONFIG.dex.initialPrice);
  const halfSpread = CONFIG.dex.spread / 200;
  const orderSize = parseFloat(CONFIG.dex.orderSize);
  
  console.log(`\n📊 Listing Parameters:`);
  console.log(`   Base Price: ${CONFIG.dex.initialPrice} XRP/VRTY`);
  console.log(`   Spread: ${CONFIG.dex.spread}%`);
  console.log(`   Levels: ${CONFIG.dex.levels}`);
  console.log(`   Order Size: ${formatNumber(CONFIG.dex.orderSize)} VRTY per level`);
  
  const totalVRTY = orderSize * CONFIG.dex.levels * 2; // Both sides
  const totalXRP = totalVRTY * basePrice;
  
  console.log(`\n   Total VRTY for listing: ${formatNumber(totalVRTY)}`);
  console.log(`   Total XRP value: ~${formatNumber(totalXRP)} XRP`);
  
  // Price at $0.50 XRP
  const usdValue = totalXRP * 0.5;
  console.log(`   USD value (at $0.50/XRP): ~$${formatNumber(usdValue)}`);

  const confirmed = await confirm('Proceed with DEX listing?');
  if (!confirmed) {
    console.log('\n🚫 Listing cancelled.');
    return;
  }

  printSection('Creating Orders');
  
  const levelIncrement = 0.001; // 0.001 XRP between levels
  let successCount = 0;
  let failCount = 0;

  for (let level = 0; level < CONFIG.dex.levels; level++) {
    const priceOffset = level * levelIncrement;

    // Create SELL order (selling VRTY for XRP)
    const sellPrice = (basePrice * (1 + halfSpread) + priceOffset).toFixed(8);
    console.log(`\n   [Level ${level + 1}] SELL ${formatNumber(orderSize)} VRTY @ ${sellPrice} XRP`);
    
    const sellResult = await xrpl.createDEXOffer(wallet, 'sell', orderSize.toString(), sellPrice);
    if (sellResult.success) {
      console.log(`   ✅ Sell order created: ${sellResult.txHash?.slice(0, 20)}...`);
      successCount++;
    } else {
      console.log(`   ❌ Sell order failed: ${sellResult.error}`);
      failCount++;
    }

    // Create BUY order (buying VRTY with XRP)
    const buyPrice = (basePrice * (1 - halfSpread) - priceOffset).toFixed(8);
    console.log(`   [Level ${level + 1}] BUY ${formatNumber(orderSize)} VRTY @ ${buyPrice} XRP`);
    
    const buyResult = await xrpl.createDEXOffer(wallet, 'buy', orderSize.toString(), buyPrice);
    if (buyResult.success) {
      console.log(`   ✅ Buy order created: ${buyResult.txHash?.slice(0, 20)}...`);
      successCount++;
    } else {
      console.log(`   ❌ Buy order failed: ${buyResult.error}`);
      failCount++;
    }
  }

  printSection('Listing Complete');
  console.log(`\n📊 Results:`);
  console.log(`   Successful orders: ${successCount}`);
  console.log(`   Failed orders: ${failCount}`);
  
  if (successCount > 0) {
    console.log(`\n🎉 VRTY is now listed on XRPL DEX!`);
    console.log(`\n📈 View on XRPL Explorer:`);
    if (CONFIG.network === 'mainnet') {
      console.log(`   https://livenet.xrpl.org/accounts/${wallet.address}`);
    } else {
      console.log(`   https://${CONFIG.network}.xrpl.org/accounts/${wallet.address}`);
    }
  }
}

/**
 * Show current status
 */
async function showStatus(): Promise<void> {
  printHeader('VRTY OPERATIONAL STATUS');

  console.log('📋 Configuration:');
  console.log(`   Network: ${CONFIG.network.toUpperCase()}`);
  console.log(`   VRTY Issuer: ${CONFIG.vrty.issuerAddress}`);
  console.log(`   Treasury: ${CONFIG.wallets.treasury}`);

  // Get balances
  printSection('Account Balances');
  
  const treasuryXRP = await xrpl.getXRPBalance(CONFIG.wallets.treasury);
  const treasuryVRTY = await xrpl.getVRTYBalance(CONFIG.wallets.treasury);
  
  console.log(`\n💰 Treasury:`);
  console.log(`   XRP: ${formatXRP(treasuryXRP)}`);
  console.log(`   VRTY: ${formatNumber(treasuryVRTY)}`);

  // Get order book
  printSection('DEX Market');
  const orderBook = await xrpl.getOrderBook();
  
  if (orderBook.asks.length === 0 && orderBook.bids.length === 0) {
    console.log('\n   ℹ️  No active market');
  } else {
    console.log(`\n   Sell Orders: ${orderBook.asks.length}`);
    if (orderBook.asks.length > 0) {
      // Show best ask
      const bestAsk = orderBook.asks[0];
      const askVRTY = typeof bestAsk.TakerPays === 'object' ? bestAsk.TakerPays.value : '0';
      const askXRP = typeof bestAsk.TakerGets === 'string' ? dropsToXrp(bestAsk.TakerGets) : 0;
      console.log(`   Best Ask: ${formatNumber(askVRTY)} VRTY @ ${(Number(askXRP) / Number(askVRTY)).toFixed(6)} XRP`);
    }
    
    console.log(`\n   Buy Orders: ${orderBook.bids.length}`);
    if (orderBook.bids.length > 0) {
      // Show best bid
      const bestBid = orderBook.bids[0];
      const bidVRTY = typeof bestBid.TakerGets === 'object' ? bestBid.TakerGets.value : '0';
      const bidXRP = typeof bestBid.TakerPays === 'string' ? dropsToXrp(bestBid.TakerPays) : 0;
      console.log(`   Best Bid: ${formatNumber(bidVRTY)} VRTY @ ${(Number(bidXRP) / Number(bidVRTY)).toFixed(6)} XRP`);
    }
  }

  // Token valuation
  printSection('Token Valuation');
  const price = parseFloat(CONFIG.dex.initialPrice);
  const supply = parseFloat(CONFIG.vrty.totalSupply);
  const fdvXRP = price * supply;
  const fdvUSD = fdvXRP * 0.5; // Assuming $0.50/XRP
  
  console.log(`\n   Price: ${price} XRP/VRTY (~$${(price * 0.5).toFixed(4)}/VRTY)`);
  console.log(`   FDV: ${formatNumber(fdvXRP)} XRP (~$${formatNumber(fdvUSD)})`);
  console.log(`   Treasury Value: ${formatNumber(parseFloat(treasuryVRTY) * price)} XRP`);
}

// ============================================================
// CLI
// ============================================================

async function main(): Promise<void> {
  const command = process.argv[2] || 'help';

  try {
    switch (command) {
      case 'check':
        await checkPrerequisites();
        break;

      case 'list-dex':
        await listOnDEX();
        break;

      case 'status':
        await showStatus();
        break;

      case 'full-launch':
        await checkPrerequisites();
        const proceed = await confirm('Continue with DEX listing?');
        if (proceed) {
          await listOnDEX();
        }
        break;

      case 'help':
      default:
        console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║     VRTY Launch Operations                                           ║
║     Verity Protocol - Token Launch & DEX Listing                     ║
╚══════════════════════════════════════════════════════════════════════╝

Commands:
  check         Check prerequisites and current state
  list-dex      Create initial DEX liquidity offers
  status        Show current operational status
  full-launch   Complete launch sequence (check + list)

Environment Variables:
  XRPL_NETWORK              Network (mainnet, testnet, devnet)
  VRTY_ISSUER_ADDRESS       VRTY token issuer address
  VRTY_TREASURY_WALLET      Treasury wallet address
  TREASURY_WALLET_SECRET    Treasury wallet secret (for transactions)
  VRTY_INITIAL_PRICE        Initial listing price (default: 0.02 XRP)
  VRTY_INITIAL_LIQUIDITY    Initial liquidity amount (default: 10M VRTY)

Examples:
  # Check current state (safe, no transactions)
  npx ts-node scripts/operations/launch-vrty.ts check

  # List on DEX (requires wallet secret)
  TREASURY_WALLET_SECRET=sXXXX npx ts-node scripts/operations/launch-vrty.ts list-dex

  # Full launch with testnet first
  XRPL_NETWORK=testnet TREASURY_WALLET_SECRET=sXXXX npx ts-node scripts/operations/launch-vrty.ts full-launch

Current Configuration:
  Network: ${CONFIG.network}
  Initial Price: ${CONFIG.dex.initialPrice} XRP/VRTY (~$${(parseFloat(CONFIG.dex.initialPrice) * 0.5).toFixed(4)}/VRTY)
  Initial Liquidity: ${formatNumber(CONFIG.dex.initialLiquidity)} VRTY

⚠️  WARNING: This script handles REAL FUNDS on ${CONFIG.network.toUpperCase()}.
   Always test on testnet first!
        `);
    }
  } catch (error) {
    console.error('\n❌ Error:', (error as Error).message);
    process.exit(1);
  } finally {
    await xrpl.disconnect();
  }
}

main();
