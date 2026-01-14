/**
 * Verity Protocol - DEX Types
 * 
 * @description Type definitions for XRPL DEX integration
 */

// ============================================================
// TRADING PAIRS
// ============================================================

export interface TradingPair {
  /** Base currency (e.g., VRTY) */
  base: {
    currency: string;
    issuer?: string;
  };
  
  /** Quote currency (e.g., XRP) */
  quote: {
    currency: string;
    issuer?: string;
  };
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
  /** Trading pair */
  pair: TradingPair;
  
  /** Buy orders (bids) - sorted high to low */
  bids: OrderBookEntry[];
  
  /** Sell orders (asks) - sorted low to high */
  asks: OrderBookEntry[];
  
  /** Spread percentage */
  spread?: number;
  
  /** Mid price */
  midPrice?: string;
  
  /** Timestamp */
  timestamp: string;
}

// ============================================================
// OFFERS
// ============================================================

export type OfferSide = 'buy' | 'sell';

export interface CreateOfferParams {
  /** Wallet address */
  account: string;
  
  /** Buy or sell */
  side: OfferSide;
  
  /** Amount of base currency */
  amount: string;
  
  /** Price per unit in quote currency */
  price: string;
  
  /** Trading pair */
  pair: TradingPair;
  
  /** Time to live in seconds (optional) */
  expiration?: number;
  
  /** Fill or kill (optional) */
  fillOrKill?: boolean;
  
  /** Immediate or cancel (optional) */
  immediateOrCancel?: boolean;
}

export interface OfferResult {
  success: boolean;
  offerSequence?: number;
  txHash?: string;
  filled?: string;
  remaining?: string;
  error?: string;
}

export interface ActiveOffer {
  /** Offer sequence */
  sequence: number;
  
  /** Account */
  account: string;
  
  /** Side (buy/sell) */
  side: OfferSide;
  
  /** Original amount */
  originalAmount: string;
  
  /** Remaining amount */
  remainingAmount: string;
  
  /** Price */
  price: string;
  
  /** Creation time */
  createdAt: string;
  
  /** Expiration (if set) */
  expiresAt?: string;
}

// ============================================================
// MARKET DATA
// ============================================================

export interface TradeRecord {
  /** Transaction hash */
  txHash: string;
  
  /** Timestamp */
  timestamp: string;
  
  /** Side (buy/sell from taker perspective) */
  side: OfferSide;
  
  /** Amount of base currency */
  amount: string;
  
  /** Price */
  price: string;
  
  /** Total in quote currency */
  total: string;
  
  /** Maker account */
  maker: string;
  
  /** Taker account */
  taker: string;
}

export interface MarketStats {
  /** Trading pair */
  pair: TradingPair;
  
  /** Last trade price */
  lastPrice: string;
  
  /** 24h high */
  high24h: string;
  
  /** 24h low */
  low24h: string;
  
  /** 24h volume (base) */
  volume24h: string;
  
  /** 24h volume (quote) */
  volumeQuote24h: string;
  
  /** 24h price change */
  change24h: string;
  
  /** 24h price change percentage */
  changePercent24h: string;
  
  /** Number of trades in 24h */
  trades24h: number;
  
  /** Timestamp */
  timestamp: string;
}

// ============================================================
// MARKET MAKER
// ============================================================

export interface MarketMakerConfig {
  /** Trading pair */
  pair: TradingPair;
  
  /** Target spread percentage (e.g., 2 for 2%) */
  targetSpread: number;
  
  /** Order size per level */
  orderSize: string;
  
  /** Number of price levels on each side */
  levels: number;
  
  /** Price increment between levels */
  levelIncrement: string;
  
  /** Minimum quote balance to maintain */
  minQuoteBalance: string;
  
  /** Minimum base balance to maintain */
  minBaseBalance: string;
  
  /** Rebalance threshold */
  rebalanceThreshold: number;
  
  /** Update interval in milliseconds */
  updateInterval: number;
  
  /** Enable auto-rebalancing */
  autoRebalance: boolean;
}

export const DEFAULT_MARKET_MAKER_CONFIG: MarketMakerConfig = {
  pair: VRTY_XRP_PAIR,
  targetSpread: 2, // 2%
  orderSize: '10000', // 10,000 VRTY per order
  levels: 5, // 5 price levels each side
  levelIncrement: '0.001', // 0.001 XRP between levels
  minQuoteBalance: '1000', // 1000 XRP minimum
  minBaseBalance: '100000', // 100,000 VRTY minimum
  rebalanceThreshold: 20, // Rebalance if imbalanced by 20%
  updateInterval: 60000, // Update every minute
  autoRebalance: false,
};

export interface MarketMakerStatus {
  /** Is running */
  running: boolean;
  
  /** Configuration */
  config: MarketMakerConfig;
  
  /** Current bids */
  activeBids: ActiveOffer[];
  
  /** Current asks */
  activeAsks: ActiveOffer[];
  
  /** Quote balance */
  quoteBalance: string;
  
  /** Base balance */
  baseBalance: string;
  
  /** Total value (in quote) */
  totalValue: string;
  
  /** Profit/Loss */
  pnl: string;
  
  /** Trades executed */
  tradesExecuted: number;
  
  /** Volume traded */
  volumeTraded: string;
  
  /** Last update */
  lastUpdate: string;
  
  /** Uptime */
  uptime: number;
}

// ============================================================
// LIQUIDITY
// ============================================================

export interface LiquidityParams {
  /** Initial XRP liquidity */
  xrpAmount: string;
  
  /** Initial VRTY liquidity */
  vrtyAmount: string;
  
  /** Starting price (XRP per VRTY) */
  initialPrice: string;
  
  /** Spread percentage */
  spread: number;
}

export interface LiquidityStatus {
  /** Total XRP in orders */
  xrpInOrders: string;
  
  /** Total VRTY in orders */
  vrtyInOrders: string;
  
  /** Available XRP */
  xrpAvailable: string;
  
  /** Available VRTY */
  vrtyAvailable: string;
  
  /** Current mid price */
  midPrice: string;
  
  /** Current spread */
  spread: number;
  
  /** Depth (total value on both sides) */
  depth: string;
}

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
