/**
 * Verity Protocol - Market Maker
 * 
 * @description Automated market maker for VRTY/XRP pair on XRPL DEX.
 * Maintains liquidity by placing orders on both sides of the book.
 */

import { Wallet } from 'xrpl';
import {
  MarketMakerConfig,
  DEFAULT_MARKET_MAKER_CONFIG,
  MarketMakerStatus,
  ActiveOffer,
} from './types.js';
import { DexService, getDexService } from './DexService.js';
import { logger } from '../utils/logger.js';

// ============================================================
// MARKET MAKER CLASS
// ============================================================

export class MarketMaker {
  private config: MarketMakerConfig;
  private dex: DexService;
  private wallet: Wallet | null = null;
  private running: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;
  private startTime: Date | null = null;
  
  // Statistics
  private tradesExecuted: number = 0;
  private volumeTraded: number = 0;
  private initialValue: number = 0;

  // Active orders
  private activeBids: ActiveOffer[] = [];
  private activeAsks: ActiveOffer[] = [];

  constructor(config: Partial<MarketMakerConfig> = {}) {
    this.config = { ...DEFAULT_MARKET_MAKER_CONFIG, ...config };
    this.dex = getDexService();
  }

  // ============================================================
  // LIFECYCLE
  // ============================================================

  /**
   * Initialize the market maker with a wallet
   */
  async initialize(wallet: Wallet): Promise<void> {
    this.wallet = wallet;
    await this.dex.connect();
    
    // Record initial balances
    const xrpBalance = await this.dex.getXRPBalance(wallet.address);
    const vrtyBalance = await this.dex.getVRTYBalance(wallet.address);
    const currentPrice = await this.dex.getCurrentPrice(this.config.pair);
    
    // Calculate initial value in XRP
    this.initialValue = parseFloat(xrpBalance) + 
      (parseFloat(vrtyBalance) * parseFloat(currentPrice || '0'));
    
    logger.info(`Market maker initialized for ${wallet.address}`);
    logger.info(`Initial XRP: ${xrpBalance}, VRTY: ${vrtyBalance}`);
  }

  /**
   * Start the market maker
   */
  async start(): Promise<void> {
    if (!this.wallet) {
      throw new Error('Market maker not initialized. Call initialize() first.');
    }
    
    if (this.running) {
      logger.warn('Market maker already running');
      return;
    }

    this.running = true;
    this.startTime = new Date();
    
    logger.info('Starting market maker...');
    
    // Initial order placement
    await this.updateOrders();
    
    // Start update loop
    this.intervalId = setInterval(async () => {
      try {
        await this.updateOrders();
      } catch (error) {
        logger.error('Error updating orders:', error);
      }
    }, this.config.updateInterval);
    
    logger.info(`Market maker started with ${this.config.updateInterval}ms update interval`);
  }

  /**
   * Stop the market maker
   */
  async stop(): Promise<void> {
    if (!this.running) {
      return;
    }

    this.running = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    // Cancel all active orders
    await this.cancelAllOrders();
    
    logger.info('Market maker stopped');
  }

  // ============================================================
  // ORDER MANAGEMENT
  // ============================================================

  /**
   * Update orders based on current market state
   */
  private async updateOrders(): Promise<void> {
    if (!this.wallet) return;

    // Get current balances
    const xrpBalance = parseFloat(await this.dex.getXRPBalance(this.wallet.address));
    const vrtyBalance = parseFloat(await this.dex.getVRTYBalance(this.wallet.address));

    // Check minimum balances
    if (xrpBalance < parseFloat(this.config.minQuoteBalance)) {
      logger.warn(`XRP balance (${xrpBalance}) below minimum (${this.config.minQuoteBalance})`);
      // Could trigger rebalancing here
    }

    if (vrtyBalance < parseFloat(this.config.minBaseBalance)) {
      logger.warn(`VRTY balance (${vrtyBalance}) below minimum (${this.config.minBaseBalance})`);
    }

    // Get current market price
    const orderBook = await this.dex.getOrderBook(this.config.pair, 5);
    let midPrice = parseFloat(orderBook.midPrice || '0.02'); // Default price if no market

    if (midPrice === 0) {
      // No market exists, use configured default
      midPrice = 0.02; // 0.02 XRP per VRTY ($0.01 at $0.50 XRP)
      logger.info(`No market price, using default: ${midPrice} XRP/VRTY`);
    }

    // Calculate spread
    const halfSpread = (this.config.targetSpread / 100) / 2;
    const bidPrice = midPrice * (1 - halfSpread);
    const askPrice = midPrice * (1 + halfSpread);

    // Cancel existing orders
    await this.cancelAllOrders();

    // Place new orders at multiple levels
    const orderSize = parseFloat(this.config.orderSize);
    const levelIncrement = parseFloat(this.config.levelIncrement);

    for (let level = 0; level < this.config.levels; level++) {
      const priceOffset = level * levelIncrement;

      // Place bid (buy order)
      const bidPriceLevel = (bidPrice - priceOffset).toFixed(8);
      const bidResult = await this.dex.createOffer(this.wallet, {
        account: this.wallet.address,
        side: 'buy',
        amount: orderSize.toString(),
        price: bidPriceLevel,
        pair: this.config.pair,
      });

      if (bidResult.success) {
        this.activeBids.push({
          sequence: bidResult.offerSequence!,
          account: this.wallet.address,
          side: 'buy',
          originalAmount: orderSize.toString(),
          remainingAmount: orderSize.toString(),
          price: bidPriceLevel,
          createdAt: new Date().toISOString(),
        });
      }

      // Place ask (sell order)
      const askPriceLevel = (askPrice + priceOffset).toFixed(8);
      const askResult = await this.dex.createOffer(this.wallet, {
        account: this.wallet.address,
        side: 'sell',
        amount: orderSize.toString(),
        price: askPriceLevel,
        pair: this.config.pair,
      });

      if (askResult.success) {
        this.activeAsks.push({
          sequence: askResult.offerSequence!,
          account: this.wallet.address,
          side: 'sell',
          originalAmount: orderSize.toString(),
          remainingAmount: orderSize.toString(),
          price: askPriceLevel,
          createdAt: new Date().toISOString(),
        });
      }
    }

    logger.info(`Orders updated: ${this.activeBids.length} bids, ${this.activeAsks.length} asks`);
    logger.info(`Mid price: ${midPrice.toFixed(6)} XRP/VRTY, Spread: ${this.config.targetSpread}%`);
  }

  /**
   * Cancel all active orders
   */
  private async cancelAllOrders(): Promise<void> {
    if (!this.wallet) return;

    for (const bid of this.activeBids) {
      await this.dex.cancelOffer(this.wallet, bid.sequence);
    }

    for (const ask of this.activeAsks) {
      await this.dex.cancelOffer(this.wallet, ask.sequence);
    }

    this.activeBids = [];
    this.activeAsks = [];
  }

  // ============================================================
  // STATUS & REPORTING
  // ============================================================

  /**
   * Get market maker status
   */
  async getStatus(): Promise<MarketMakerStatus> {
    const xrpBalance = this.wallet 
      ? await this.dex.getXRPBalance(this.wallet.address)
      : '0';
    const vrtyBalance = this.wallet
      ? await this.dex.getVRTYBalance(this.wallet.address)
      : '0';
    
    const currentPrice = await this.dex.getCurrentPrice(this.config.pair);
    const currentValue = parseFloat(xrpBalance) + 
      (parseFloat(vrtyBalance) * parseFloat(currentPrice || '0'));
    
    const pnl = currentValue - this.initialValue;
    const uptime = this.startTime 
      ? Date.now() - this.startTime.getTime()
      : 0;

    return {
      running: this.running,
      config: this.config,
      activeBids: this.activeBids,
      activeAsks: this.activeAsks,
      quoteBalance: xrpBalance,
      baseBalance: vrtyBalance,
      totalValue: currentValue.toString(),
      pnl: pnl.toString(),
      tradesExecuted: this.tradesExecuted,
      volumeTraded: this.volumeTraded.toString(),
      lastUpdate: new Date().toISOString(),
      uptime,
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<MarketMakerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Market maker config updated');
  }
}

// ============================================================
// SINGLETON
// ============================================================

let marketMaker: MarketMaker | null = null;

export function getMarketMaker(config?: Partial<MarketMakerConfig>): MarketMaker {
  if (!marketMaker) {
    marketMaker = new MarketMaker(config);
  }
  return marketMaker;
}

export default MarketMaker;
