/**
 * Trading Dashboard - VRTY/XRP XRPL Native DEX
 * Polished with shared UI components
 * 
 * API Integration: Uses live DEX API with demo fallback
 */
import { useState, useMemo } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  ArrowUpRight,
  Activity,
  BarChart3,
  RefreshCw,
  Clock,
  Wallet,
  AlertCircle,
  Radio,
} from 'lucide-react';
import { dexApi } from '../api/client';
import type { OrderBook, OrderBookEntry, MarketStats } from '../types/dex';
import { 
  Card, 
  Button, 
  StatusBadge,
  SkeletonOrderBook,
  SkeletonStatCard,
  Skeleton,
} from '@/components/ui';
import { useApiWithFallback, useApiContext, ModeToggle } from '../hooks/useApiWithFallback';

// ============================================================
// MOCK DATA (for demo before live DEX listing)
// ============================================================

const MOCK_ORDER_BOOK: OrderBook = {
  pair: {
    base: { currency: 'VRTY', issuer: 'rBeHfq9vRjZ8Cth1sMbp2nJvExmxSxAH8f' },
    quote: { currency: 'XRP' },
  },
  asks: [
    { price: '0.02050000', amount: '50000', total: '1025.00' },
    { price: '0.02040000', amount: '75000', total: '1530.00' },
    { price: '0.02030000', amount: '100000', total: '2030.00' },
    { price: '0.02020000', amount: '150000', total: '3030.00' },
    { price: '0.02010000', amount: '200000', total: '4020.00' },
  ],
  bids: [
    { price: '0.01990000', amount: '200000', total: '3980.00' },
    { price: '0.01980000', amount: '150000', total: '2970.00' },
    { price: '0.01970000', amount: '100000', total: '1970.00' },
    { price: '0.01960000', amount: '75000', total: '1470.00' },
    { price: '0.01950000', amount: '50000', total: '975.00' },
  ],
  spread: 1.0,
  midPrice: '0.02000000',
  timestamp: new Date().toISOString(),
};

const MOCK_MARKET_STATS: MarketStats = {
  pair: MOCK_ORDER_BOOK.pair,
  lastPrice: '0.02000000',
  high24h: '0.02100000',
  low24h: '0.01900000',
  volume24h: '5000000',
  volumeQuote24h: '100000',
  change24h: '+0.00020000',
  changePercent24h: '+1.01',
  trades24h: 127,
  timestamp: new Date().toISOString(),
};

// ============================================================
// ORDER BOOK COMPONENT
// ============================================================

function OrderBookDisplay({ orderBook, isLoading }: { orderBook: OrderBook; isLoading?: boolean }) {
  const maxAskTotal = useMemo(() => {
    return Math.max(...orderBook.asks.map(o => parseFloat(o.total)));
  }, [orderBook.asks]);

  const maxBidTotal = useMemo(() => {
    return Math.max(...orderBook.bids.map(o => parseFloat(o.total)));
  }, [orderBook.bids]);

  if (isLoading) {
    return <SkeletonOrderBook rows={5} />;
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-violet-400" />
          Order Book
        </h3>
        <span className="text-xs text-slate-400">VRTY/XRP</span>
      </div>

      {/* Header */}
      <div className="grid grid-cols-3 text-xs text-slate-400 pb-2 border-b border-slate-700">
        <span>Price (XRP)</span>
        <span className="text-right">Amount (VRTY)</span>
        <span className="text-right">Total (XRP)</span>
      </div>

      {/* Asks (Sell Orders) - Red */}
      <div className="py-2">
        {orderBook.asks.slice().reverse().map((ask, idx) => (
          <OrderBookRow
            key={`ask-${idx}`}
            entry={ask}
            side="ask"
            maxTotal={maxAskTotal}
          />
        ))}
      </div>

      {/* Spread */}
      <div className="py-2 px-2 bg-slate-700/50 rounded flex items-center justify-between">
        <span className="text-white font-semibold">
          {orderBook.midPrice ? parseFloat(orderBook.midPrice).toFixed(4) : '-'}
        </span>
        <span className="text-xs text-slate-400">
          Spread: {orderBook.spread?.toFixed(2) || '-'}%
        </span>
      </div>

      {/* Bids (Buy Orders) - Green */}
      <div className="py-2">
        {orderBook.bids.map((bid, idx) => (
          <OrderBookRow
            key={`bid-${idx}`}
            entry={bid}
            side="bid"
            maxTotal={maxBidTotal}
          />
        ))}
      </div>
    </Card>
  );
}

function OrderBookRow({ 
  entry, 
  side, 
  maxTotal 
}: { 
  entry: OrderBookEntry; 
  side: 'ask' | 'bid'; 
  maxTotal: number;
}) {
  const percentage = (parseFloat(entry.total) / maxTotal) * 100;
  const bgColor = side === 'ask' ? 'bg-red-500/20' : 'bg-emerald-500/20';
  const textColor = side === 'ask' ? 'text-red-400' : 'text-emerald-400';

  return (
    <div className="relative grid grid-cols-3 text-sm py-1 hover:bg-slate-700/30 cursor-pointer transition-colors">
      <div
        className={`absolute inset-0 ${bgColor} transition-all`}
        style={{ width: `${percentage}%`, right: 0, left: 'auto' }}
      />
      <span className={`relative z-10 ${textColor}`}>
        {parseFloat(entry.price).toFixed(4)}
      </span>
      <span className="relative z-10 text-right text-slate-300">
        {formatNumber(parseFloat(entry.amount))}
      </span>
      <span className="relative z-10 text-right text-slate-400">
        {formatNumber(parseFloat(entry.total))}
      </span>
    </div>
  );
}

// ============================================================
// MARKET STATS COMPONENT
// ============================================================

function MarketStatsDisplay({ stats, isLoading }: { stats: MarketStats; isLoading?: boolean }) {
  const priceChange = parseFloat(stats.changePercent24h || '0');
  const isPositive = priceChange >= 0;
  const xrpPrice = 0.50; // Assumed XRP/USD for display

  if (isLoading) {
    return (
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="text-right">
            <Skeleton className="h-10 w-24 mb-2" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <SkeletonStatCard key={i} />)}
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-white">VRTY/XRP</h2>
          <p className="text-sm text-slate-400">Verity Protocol</p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-white">
            {parseFloat(stats.lastPrice).toFixed(4)}
          </div>
          <div className="text-sm text-slate-400">
            ${(parseFloat(stats.lastPrice) * xrpPrice).toFixed(4)} USD
          </div>
        </div>
      </div>

      <div className={`flex items-center gap-2 mb-4 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
        {isPositive ? (
          <TrendingUp className="w-5 h-5" />
        ) : (
          <TrendingDown className="w-5 h-5" />
        )}
        <span className="text-lg font-semibold">
          {isPositive ? '+' : ''}{priceChange.toFixed(2)}%
        </span>
        <span className="text-sm text-slate-400">24h</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatBox label="24h High" value={parseFloat(stats.high24h).toFixed(4)} unit="XRP" />
        <StatBox label="24h Low" value={parseFloat(stats.low24h).toFixed(4)} unit="XRP" />
        <StatBox label="24h Volume" value={formatNumber(parseFloat(stats.volume24h))} unit="VRTY" />
        <StatBox label="Trades" value={stats.trades24h.toString()} unit="24h" />
      </div>
    </Card>
  );
}

function StatBox({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="bg-slate-700/50 rounded-lg p-3">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className="text-lg font-semibold text-white">{value}</p>
      <p className="text-xs text-slate-500">{unit}</p>
    </div>
  );
}

// ============================================================
// ORDER FORM COMPONENT
// ============================================================

function OrderForm() {
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'limit' | 'market'>('limit');
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('0.02');

  const total = useMemo(() => {
    const amt = parseFloat(amount) || 0;
    const prc = parseFloat(price) || 0;
    return (amt * prc).toFixed(4);
  }, [amount, price]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Connect wallet to place orders. DEX listing coming soon!');
  };

  return (
    <Card>
      <h3 className="text-lg font-semibold text-white mb-4">Place Order</h3>

      {/* Buy/Sell Tabs */}
      <div className="flex mb-4">
        <button
          onClick={() => setSide('buy')}
          className={`flex-1 py-2 rounded-l-lg font-semibold transition-colors ${
            side === 'buy'
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => setSide('sell')}
          className={`flex-1 py-2 rounded-r-lg font-semibold transition-colors ${
            side === 'sell'
              ? 'bg-red-600 text-white'
              : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
          }`}
        >
          Sell
        </button>
      </div>

      {/* Order Type */}
      <div className="flex gap-4 mb-4">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="orderType"
            checked={orderType === 'limit'}
            onChange={() => setOrderType('limit')}
            className="text-violet-600 focus:ring-violet-500"
          />
          <span className="text-sm text-slate-300">Limit</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="orderType"
            checked={orderType === 'market'}
            onChange={() => setOrderType('market')}
            className="text-violet-600 focus:ring-violet-500"
          />
          <span className="text-sm text-slate-300">Market</span>
        </label>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Price Input */}
        {orderType === 'limit' && (
          <div>
            <label className="block text-sm text-slate-400 mb-1">Price (XRP)</label>
            <input
              type="number"
              step="0.0001"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
              placeholder="0.0200"
            />
          </div>
        )}

        {/* Amount Input */}
        <div>
          <label className="block text-sm text-slate-400 mb-1">Amount (VRTY)</label>
          <input
            type="number"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500"
            placeholder="1000"
          />
          {/* Quick Amount Buttons */}
          <div className="flex gap-2 mt-2">
            {['1000', '10000', '50000', '100000'].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setAmount(amt)}
                className="flex-1 py-1 text-xs bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition-colors"
              >
                {formatNumber(parseInt(amt))}
              </button>
            ))}
          </div>
        </div>

        {/* Total */}
        <div className="bg-slate-700/50 rounded-lg p-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Total</span>
            <span className="text-white font-semibold">{total} XRP</span>
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-slate-500">Est. USD</span>
            <span className="text-slate-400">${(parseFloat(total) * 0.5).toFixed(2)}</span>
          </div>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          variant={side === 'buy' ? 'primary' : 'danger'}
          className="w-full"
        >
          <Wallet className="w-4 h-4" />
          {side === 'buy' ? 'Buy VRTY' : 'Sell VRTY'}
        </Button>

        {/* Warning */}
        <div className="flex items-start gap-2 text-xs text-amber-400/80 bg-amber-400/10 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>
            Connect your XRPL wallet (Xumm/Crossmark) to place real orders. 
            DEX listing coming soon after utility launch.
          </span>
        </div>
      </form>
    </Card>
  );
}

// ============================================================
// RECENT TRADES COMPONENT
// ============================================================

function RecentTrades() {
  const trades = [
    { time: '12:34:56', side: 'buy' as const, price: '0.0200', amount: '5000', total: '100.00' },
    { time: '12:33:21', side: 'sell' as const, price: '0.0199', amount: '2500', total: '49.75' },
    { time: '12:32:45', side: 'buy' as const, price: '0.0200', amount: '10000', total: '200.00' },
    { time: '12:31:12', side: 'buy' as const, price: '0.0199', amount: '7500', total: '149.25' },
    { time: '12:30:00', side: 'sell' as const, price: '0.0198', amount: '15000', total: '297.00' },
  ];

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Clock className="w-5 h-5 text-violet-400" />
          Recent Trades
        </h3>
        <StatusBadge status="ACTIVE" size="sm" />
      </div>

      {/* Header */}
      <div className="grid grid-cols-4 text-xs text-slate-400 pb-2 border-b border-slate-700">
        <span>Time</span>
        <span className="text-right">Price</span>
        <span className="text-right">Amount</span>
        <span className="text-right">Total</span>
      </div>

      {/* Trades */}
      <div className="py-2 space-y-1">
        {trades.map((trade, idx) => (
          <div key={idx} className="grid grid-cols-4 text-sm py-1 hover:bg-slate-700/30 transition-colors">
            <span className="text-slate-400">{trade.time}</span>
            <span className={`text-right ${trade.side === 'buy' ? 'text-emerald-400' : 'text-red-400'}`}>
              {trade.price}
            </span>
            <span className="text-right text-slate-300">{formatNumber(parseInt(trade.amount))}</span>
            <span className="text-right text-slate-400">{trade.total}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ============================================================
// PRICE CHART PLACEHOLDER
// ============================================================

function PriceChart() {
  return (
    <Card className="h-64 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-violet-400" />
          Price Chart
        </h3>
        <div className="flex gap-2">
          {['1H', '4H', '1D', '1W'].map((tf) => (
            <button
              key={tf}
              className="px-2 py-1 text-xs bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition-colors"
            >
              {tf}
            </button>
          ))}
        </div>
      </div>
      
      <div className="flex-1 flex items-center justify-center bg-slate-700/30 rounded-lg">
        <div className="text-center text-slate-400">
          <Activity className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Chart will display live data</p>
          <p className="text-xs">after DEX listing</p>
        </div>
      </div>
    </Card>
  );
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toLocaleString();
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function TradingDashboard() {
  const { isLiveMode, apiStatus } = useApiContext();

  // API integration with demo fallback
  const { 
    data: orderBook, 
    isLoading: orderBookLoading, 
    refetch: refetchOrderBook,
    isDemo: orderBookIsDemo,
    isLive: orderBookIsLive,
  } = useApiWithFallback(
    ['orderBook'],
    async () => {
      const response = await dexApi.getOrderBook();
      return response.data as OrderBook;
    },
    MOCK_ORDER_BOOK
  );

  const { 
    data: marketStats, 
    isLoading: statsLoading,
    isDemo: statsIsDemo,
    isLive: statsIsLive,
  } = useApiWithFallback(
    ['marketStats'],
    async () => {
      const response = await dexApi.getMarketStats();
      return response.data as MarketStats;
    },
    MOCK_MARKET_STATS
  );

  const isDemo = orderBookIsDemo || statsIsDemo;
  const isLive = orderBookIsLive && statsIsLive;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Trading Dashboard</h1>
          <p className="text-slate-400">XRPL Native DEX - Zero Fees</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Live/Demo Mode Toggle */}
          <ModeToggle showLatency />
          <Button variant="secondary" onClick={() => refetchOrderBook()}>
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Mode Banner */}
      {isDemo && (
        <Card glass className="flex items-center gap-3 border-violet-500/30">
          <AlertCircle className="w-5 h-5 text-violet-400" />
          <div>
            <p className="text-violet-300 font-medium">
              {isLiveMode && !apiStatus.isOnline ? 'API Offline - Using Demo Data' : 'Demo Mode Active'}
            </p>
            <p className="text-sm text-violet-400/80">
              {isLiveMode && !apiStatus.isOnline 
                ? 'Unable to connect to live API. Showing simulated data until connection is restored.'
                : 'Showing simulated data. Toggle to live mode to connect to the DEX API. Initial price: 0.02 XRP/VRTY (~$0.01)'}
            </p>
          </div>
        </Card>
      )}

      {/* Live Data Indicator */}
      {isLive && (
        <Card glass className="flex items-center gap-3 border-emerald-500/30">
          <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
          <div>
            <p className="text-emerald-300 font-medium">Live Data</p>
            <p className="text-sm text-emerald-400/80">
              Connected to XRPL DEX. Data refreshes automatically.
              {apiStatus.latency && ` Latency: ${apiStatus.latency}ms`}
            </p>
          </div>
        </Card>
      )}

      {/* Market Stats */}
      <MarketStatsDisplay stats={orderBook ? marketStats : MOCK_MARKET_STATS} isLoading={isLiveMode && statsLoading} />

      {/* Main Trading Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Order Book */}
        <div className="lg:col-span-1">
          <OrderBookDisplay orderBook={orderBook || MOCK_ORDER_BOOK} isLoading={isLiveMode && orderBookLoading} />
        </div>

        {/* Price Chart & Recent Trades */}
        <div className="lg:col-span-1 space-y-6">
          <PriceChart />
          <RecentTrades />
        </div>

        {/* Order Form */}
        <div className="lg:col-span-1">
          <OrderForm />
        </div>
      </div>

      {/* Trading Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card hover>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-violet-600/20 flex items-center justify-center">
              <ArrowUpRight className="w-4 h-4 text-violet-400" />
            </div>
            <span className="text-white font-medium">Zero Trading Fees</span>
          </div>
          <p className="text-sm text-slate-400">
            XRPL native DEX has no trading fees. Only minimal XRP network fees (~0.00001 XRP).
          </p>
        </Card>

        <Card hover>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-emerald-600/20 flex items-center justify-center">
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="text-white font-medium">Instant Settlement</span>
          </div>
          <p className="text-sm text-slate-400">
            Trades settle in 3-5 seconds on XRPL. No waiting for confirmations.
          </p>
        </Card>

        <Card hover>
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-blue-400" />
            </div>
            <span className="text-white font-medium">Non-Custodial</span>
          </div>
          <p className="text-sm text-slate-400">
            Trade directly from your wallet. Your keys, your crypto. No centralized custody.
          </p>
        </Card>
      </div>

      {/* Token Info */}
      <Card>
        <h3 className="text-lg font-semibold text-white mb-4">VRTY Token Information</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-slate-400">Total Supply</p>
            <p className="text-lg font-semibold text-white">1,000,000,000</p>
          </div>
          <div>
            <p className="text-sm text-slate-400">Blockchain</p>
            <p className="text-lg font-semibold text-white">XRPL Mainnet</p>
          </div>
          <div>
            <p className="text-sm text-slate-400">Issuer</p>
            <p className="text-lg font-semibold text-white font-mono text-sm truncate">
              rBeHfq9vRj...SxAH8f
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-400">Listing Status</p>
            <StatusBadge status="PENDING" />
          </div>
        </div>
      </Card>
    </div>
  );
}
