/**
 * Verity Protocol - DEX Service
 * 
 * @description Service for XRPL DEX integration.
 * Handles order book queries, offer creation, and market data.
 */

import { Client, Wallet, xrpToDrops, dropsToXrp } from 'xrpl';
import {
  TradingPair,
  VRTY_XRP_PAIR,
  OrderBook,
  OrderBookEntry,
  CreateOfferParams,
  OfferResult,
  ActiveOffer,
  MarketStats,
} from './types.js';
import { logger } from '../utils/logger.js';
import { XRPL_ENDPOINTS, XRPLNetwork, safeDivide } from '../config/xrpl.js';

// ============================================================
// DEX SERVICE CLASS
// ============================================================

export class DexService {
  private client: Client | null = null;
  private network: XRPLNetwork;

  constructor(network: XRPLNetwork = 'mainnet') {
    this.network = network;
  }

  // ============================================================
  // CONNECTION MANAGEMENT
  // ============================================================

  async connect(): Promise<void> {
    if (this.client?.isConnected()) {
      return;
    }

    const endpoint = XRPL_ENDPOINTS[this.network];
    this.client = new Client(endpoint);
    
    await this.client.connect();
    logger.info(`Connected to XRPL ${this.network} DEX`);
  }

  async disconnect(): Promise<void> {
    if (this.client?.isConnected()) {
      await this.client.disconnect();
      logger.info('Disconnected from XRPL');
    }
  }

  private async ensureConnected(): Promise<Client> {
    if (!this.client?.isConnected()) {
      await this.connect();
    }
    return this.client!;
  }

  // ============================================================
  // ORDER BOOK
  // ============================================================

  /**
   * Get order book for a trading pair
   */
  async getOrderBook(pair: TradingPair = VRTY_XRP_PAIR, limit: number = 20): Promise<OrderBook> {
    const client = await this.ensureConnected();

    // Format taker_gets and taker_pays for the request
    const takerGets = pair.quote.currency === 'XRP'
      ? { currency: 'XRP' }
      : { currency: pair.quote.currency, issuer: pair.quote.issuer };

    const takerPays = pair.base.currency === 'XRP'
      ? { currency: 'XRP' }
      : { currency: pair.base.currency, issuer: pair.base.issuer };

    // Get asks (sell orders) - people selling VRTY for XRP
    const asksResponse = await client.request({
      command: 'book_offers',
      taker_gets: takerGets,
      taker_pays: takerPays,
      limit,
    });

    // Get bids (buy orders) - people buying VRTY with XRP
    const bidsResponse = await client.request({
      command: 'book_offers',
      taker_gets: takerPays,
      taker_pays: takerGets,
      limit,
    });

    const asks = this.parseOffers(asksResponse.result.offers || [], 'ask', pair);
    const bids = this.parseOffers(bidsResponse.result.offers || [], 'bid', pair);

    // Calculate spread
    let spread: number | undefined;
    let midPrice: string | undefined;

    if (asks.length > 0 && bids.length > 0) {
      const bestAsk = parseFloat(asks[0]?.price || '0');
      const bestBid = parseFloat(bids[0]?.price || '0');
      if (bestBid > 0) {
        spread = ((bestAsk - bestBid) / bestBid) * 100;
      }
      midPrice = ((bestAsk + bestBid) / 2).toString();
    }

    return {
      pair,
      asks,
      bids,
      spread,
      midPrice,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Parse raw XRPL offers into OrderBookEntry format
   */
  private parseOffers(
    offers: any[],
    type: 'ask' | 'bid',
    pair: TradingPair
  ): OrderBookEntry[] {
    return offers.map(offer => {
      let price: number;
      let amount: string;
      let total: string;

      if (type === 'ask') {
        // Selling VRTY for XRP
        const vrtyAmount = typeof offer.TakerPays === 'object'
          ? parseFloat(offer.TakerPays.value)
          : dropsToXrp(offer.TakerPays || 0);
        
        const xrpAmount = typeof offer.TakerGets === 'object'
          ? parseFloat(offer.TakerGets.value)
          : dropsToXrp(offer.TakerGets || 0);

        // BUG-003 FIX: Safe division to prevent NaN/Infinity
        price = safeDivide(xrpAmount, vrtyAmount, 0);
        amount = vrtyAmount.toString();
        total = xrpAmount.toString();
      } else {
        // Buying VRTY with XRP
        const xrpAmount = typeof offer.TakerPays === 'object'
          ? parseFloat(offer.TakerPays.value)
          : dropsToXrp(offer.TakerPays || 0);
        
        const vrtyAmount = typeof offer.TakerGets === 'object'
          ? parseFloat(offer.TakerGets.value)
          : dropsToXrp(offer.TakerGets || 0);

        // BUG-003 FIX: Safe division to prevent NaN/Infinity
        price = safeDivide(xrpAmount, vrtyAmount, 0);
        amount = vrtyAmount.toString();
        total = xrpAmount.toString();
      }

      return {
        price: price.toFixed(8),
        amount,
        total,
        account: offer.Account,
        sequence: offer.Sequence,
      };
    }).sort((a, b) => {
      // Asks: low to high, Bids: high to low
      return type === 'ask'
        ? parseFloat(a.price) - parseFloat(b.price)
        : parseFloat(b.price) - parseFloat(a.price);
    });
  }

  // ============================================================
  // OFFER MANAGEMENT
  // ============================================================

  /**
   * Create a new offer (limit order)
   */
  async createOffer(
    wallet: Wallet,
    params: CreateOfferParams
  ): Promise<OfferResult> {
    try {
      const client = await this.ensureConnected();

      // Calculate amounts
      const baseAmount = parseFloat(params.amount);
      const quoteAmount = baseAmount * parseFloat(params.price);

      let takerGets: any;
      let takerPays: any;

      if (params.side === 'buy') {
        // Buying VRTY with XRP
        // We get VRTY, we pay XRP
        takerGets = {
          currency: params.pair.base.currency,
          issuer: params.pair.base.issuer,
          value: params.amount,
        };
        
        takerPays = params.pair.quote.currency === 'XRP'
          ? xrpToDrops(quoteAmount.toString())
          : {
              currency: params.pair.quote.currency,
              issuer: params.pair.quote.issuer,
              value: quoteAmount.toString(),
            };
      } else {
        // Selling VRTY for XRP
        // We get XRP, we pay VRTY
        takerGets = params.pair.quote.currency === 'XRP'
          ? xrpToDrops(quoteAmount.toString())
          : {
              currency: params.pair.quote.currency,
              issuer: params.pair.quote.issuer,
              value: quoteAmount.toString(),
            };
        
        takerPays = {
          currency: params.pair.base.currency,
          issuer: params.pair.base.issuer,
          value: params.amount,
        };
      }

      const offerCreate: any = {
        TransactionType: 'OfferCreate',
        Account: wallet.address,
        TakerGets: takerGets,
        TakerPays: takerPays,
      };

      // Add flags
      let flags = 0;
      if (params.fillOrKill) {
        flags |= 0x00010000; // tfFillOrKill
      }
      if (params.immediateOrCancel) {
        flags |= 0x00020000; // tfImmediateOrCancel
      }
      if (flags > 0) {
        offerCreate.Flags = flags;
      }

      // Add expiration
      if (params.expiration) {
        // XRPL uses Ripple epoch (seconds since 2000-01-01)
        const rippleEpoch = 946684800;
        offerCreate.Expiration = Math.floor(Date.now() / 1000) - rippleEpoch + params.expiration;
      }

      const prepared = await client.autofill(offerCreate);
      const signed = wallet.sign(prepared);
      const result = await client.submitAndWait(signed.tx_blob);

      if (result.result.meta && typeof result.result.meta === 'object') {
        const meta = result.result.meta as any;
        if (meta.TransactionResult === 'tesSUCCESS') {
          logger.info(`Offer created: ${params.side} ${params.amount} VRTY @ ${params.price}`);
          
          return {
            success: true,
            offerSequence: prepared.Sequence,
            txHash: signed.hash,
          };
        }
      }

      return {
        success: false,
        error: 'Offer creation failed',
      };
    } catch (error: any) {
      logger.error('Failed to create offer:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Cancel an existing offer
   */
  async cancelOffer(
    wallet: Wallet,
    offerSequence: number
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const client = await this.ensureConnected();

      const offerCancel = {
        TransactionType: 'OfferCancel' as const,
        Account: wallet.address,
        OfferSequence: offerSequence,
      };

      const prepared = await client.autofill(offerCancel);
      const signed = wallet.sign(prepared);
      const result = await client.submitAndWait(signed.tx_blob);

      if (result.result.meta && typeof result.result.meta === 'object') {
        const meta = result.result.meta as any;
        if (meta.TransactionResult === 'tesSUCCESS') {
          logger.info(`Offer cancelled: ${offerSequence}`);
          return {
            success: true,
            txHash: signed.hash,
          };
        }
      }

      return {
        success: false,
        error: 'Offer cancellation failed',
      };
    } catch (error: any) {
      logger.error('Failed to cancel offer:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get active offers for an account
   */
  async getAccountOffers(account: string): Promise<ActiveOffer[]> {
    try {
      const client = await this.ensureConnected();

      const response = await client.request({
        command: 'account_offers',
        account,
      });

      return (response.result.offers || []).map((offer: any) => {
        const isVRTYGets = typeof offer.taker_gets === 'object' &&
          offer.taker_gets.currency === 'VRTY';

        return {
          sequence: offer.seq,
          account,
          side: isVRTYGets ? 'buy' : 'sell',
          originalAmount: '0', // Not available from this endpoint
          remainingAmount: isVRTYGets
            ? offer.taker_gets.value
            : (typeof offer.taker_pays === 'object' ? offer.taker_pays.value : '0'),
          price: '0', // Would need calculation
          createdAt: new Date().toISOString(),
        } as ActiveOffer;
      });
    } catch (error: any) {
      logger.error('Failed to get account offers:', error);
      return [];
    }
  }

  // ============================================================
  // MARKET DATA
  // ============================================================

  /**
   * Get current market price
   */
  async getCurrentPrice(pair: TradingPair = VRTY_XRP_PAIR): Promise<string | null> {
    const orderBook = await this.getOrderBook(pair, 1);
    return orderBook.midPrice || null;
  }

  /**
   * Get market stats (basic implementation)
   */
  async getMarketStats(pair: TradingPair = VRTY_XRP_PAIR): Promise<MarketStats> {
    const orderBook = await this.getOrderBook(pair, 10);

    return {
      pair,
      lastPrice: orderBook.midPrice || '0',
      high24h: '0', // Would need historical data
      low24h: '0',
      volume24h: '0',
      volumeQuote24h: '0',
      change24h: '0',
      changePercent24h: '0',
      trades24h: 0,
      timestamp: new Date().toISOString(),
    };
  }

  // ============================================================
  // BALANCE QUERIES
  // ============================================================

  /**
   * Get XRP balance
   */
  async getXRPBalance(account: string): Promise<string> {
    try {
      const client = await this.ensureConnected();
      const response = await client.request({
        command: 'account_info',
        account,
      });
      return dropsToXrp(response.result.account_data.Balance || 0).toString();
    } catch (error: any) {
      logger.error('Failed to get XRP balance:', error);
      return '0';
    }
  }

  /**
   * Get VRTY balance
   */
  async getVRTYBalance(account: string, issuer: string = VRTY_XRP_PAIR.base.issuer!): Promise<string> {
    try {
      const client = await this.ensureConnected();
      const response = await client.request({
        command: 'account_lines',
        account,
        peer: issuer,
      });

      const vrtyLine = response.result.lines.find(
        (line: any) => line.currency === 'VRTY'
      );

      return vrtyLine?.balance || '0';
    } catch (error: any) {
      logger.error('Failed to get VRTY balance:', error);
      return '0';
    }
  }
}

// ============================================================
// SINGLETON
// ============================================================

let dexService: DexService | null = null;

export function getDexService(network?: XRPLNetwork): DexService {
  if (!dexService) {
    dexService = new DexService(network);
  }
  return dexService;
}

export default DexService;
