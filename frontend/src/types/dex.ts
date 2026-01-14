/**
 * Verity Protocol - Frontend DEX Types
 * 
 * @description Type definitions for Trading Dashboard
 */

// ============================================================
// TRADING PAIRS
// ============================================================

export interface Currency {
  currency: string;
  issuer?: string;
}

export interface TradingPair {
  base: Currency;
  quote: Currency;
}

export const VRTY_XRP_PAIR: TradingPair = {
  base: {
    currency: 'VRTY',
    issuer: 'rBeHfq9vRjZ8Cth1sMbp2nJvExmxSxAH8f',
  },
  quote: {
    currency: 'XRP',
  },
};

// ============================================================
// ORDER BOOK
// ============================================================

export interface OrderBookEntry {
  /** Price in quote currency */
  price: string;
  /** Amount of base currency */
  amount: string;
  /** Total value in quote currency */
  total: string;
  /** Cumulative amount */
  cumulative?: string;
  /** Account offering */
  account?: string;
  /** Offer sequence */
  sequence?: number;
}

export interface OrderBook {
  pair: TradingPair;
  bids: OrderBookEntry[];
  asks: OrderBookEntry[];
  spread?: number;
  midPrice?: string;
  timestamp: string;
}

// ============================================================
// OFFERS & ORDERS
// ============================================================

export type OfferSide = 'buy' | 'sell';
export type OrderType = 'limit' | 'market';
export type OrderStatus = 'open' | 'filled' | 'partial' | 'cancelled';

export interface CreateOrderParams {
  side: OfferSide;
  orderType: OrderType;
  amount: string;
  price?: string; // Required for limit orders
  pair: TradingPair;
}

export interface ActiveOffer {
  sequence: number;
  account: string;
  side: OfferSide;
  originalAmount: string;
  remainingAmount: string;
  price: string;
  createdAt: string;
  expiresAt?: string;
}

export interface OrderResult {
  success: boolean;
  offerSequence?: number;
  txHash?: string;
  filled?: string;
  remaining?: string;
  error?: string;
}

// ============================================================
// MARKET DATA
// ============================================================

export interface MarketStats {
  pair: TradingPair;
  lastPrice: string;
  high24h: string;
  low24h: string;
  volume24h: string;
  volumeQuote24h: string;
  change24h: string;
  changePercent24h: string;
  trades24h: number;
  timestamp: string;
}

export interface TradeRecord {
  txHash: string;
  timestamp: string;
  side: OfferSide;
  amount: string;
  price: string;
  total: string;
  maker: string;
  taker: string;
}

// ============================================================
// PORTFOLIO
// ============================================================

export interface TokenBalance {
  currency: string;
  balance: string;
  issuer?: string;
  value?: string; // USD value
}

export interface Portfolio {
  address: string;
  xrpBalance: string;
  tokens: TokenBalance[];
  totalValueXRP: string;
  totalValueUSD: string;
  timestamp: string;
}

export interface PortfolioHolding {
  symbol: string;
  name: string;
  balance: string;
  price: string;
  value: string;
  change24h: string;
  allocation: number;
  iconUrl?: string;
}

// ============================================================
// PRICE CHART DATA
// ============================================================

export interface PriceCandle {
  timestamp: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

export type TimeFrame = '1m' | '5m' | '15m' | '1h' | '4h' | '1d' | '1w';

// ============================================================
// API RESPONSES
// ============================================================

export interface DexApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta: {
    requestId: string;
    timestamp: string;
  };
}

// ============================================================
// XRPL NETWORK
// ============================================================

export interface XRPLNetworkInfo {
  network: 'mainnet' | 'testnet' | 'devnet';
  endpoints: Record<string, string>;
  features: string[];
}

export interface AccountInfo {
  address: string;
  balance: string;
  sequence: number;
  ownerCount: number;
  flags: number;
  exists: boolean;
}
