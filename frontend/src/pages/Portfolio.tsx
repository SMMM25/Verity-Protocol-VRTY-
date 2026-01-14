import { useState } from 'react';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  Copy,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  DollarSign,
  Coins,
} from 'lucide-react';
import type { PortfolioHolding } from '../types/dex';

// ============================================================
// MOCK DATA (for demo before wallet connection)
// ============================================================

const MOCK_PORTFOLIO = {
  address: 'rExampleWallet123456789',
  xrpBalance: '1000.00',
  vrtyBalance: '50000',
  totalValueXRP: '2000.00',
  totalValueUSD: '1000.00',
};

const MOCK_HOLDINGS: PortfolioHolding[] = [
  {
    symbol: 'XRP',
    name: 'XRP Ledger',
    balance: '1000.00',
    price: '0.50',
    value: '500.00',
    change24h: '+2.5',
    allocation: 50,
    iconUrl: '/xrp-icon.png',
  },
  {
    symbol: 'VRTY',
    name: 'Verity Protocol',
    balance: '50000',
    price: '0.01',
    value: '500.00',
    change24h: '+5.0',
    allocation: 50,
  },
];

const MOCK_TRANSACTIONS = [
  {
    type: 'buy',
    asset: 'VRTY',
    amount: '10000',
    price: '0.0195',
    total: '195.00',
    hash: '4F1FC1B2...',
    timestamp: '2026-01-14 10:30:00',
  },
  {
    type: 'buy',
    asset: 'VRTY',
    amount: '15000',
    price: '0.0200',
    total: '300.00',
    hash: '7A2CD3E4...',
    timestamp: '2026-01-13 15:45:00',
  },
  {
    type: 'sell',
    asset: 'VRTY',
    amount: '5000',
    price: '0.0210',
    total: '105.00',
    hash: '9B3DE5F6...',
    timestamp: '2026-01-12 09:15:00',
  },
];

// ============================================================
// PORTFOLIO SUMMARY COMPONENT
// ============================================================

function PortfolioSummary({ 
  totalValueUSD, 
  totalValueXRP, 
  change24h,
  changePercent24h,
}: { 
  totalValueUSD: string; 
  totalValueXRP: string; 
  change24h: string;
  changePercent24h: string;
}) {
  const isPositive = parseFloat(change24h) >= 0;

  return (
    <div className="bg-gradient-to-br from-purple-900/50 to-gray-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-sm text-gray-400 mb-1">Total Portfolio Value</h2>
          <div className="flex items-baseline gap-3">
            <span className="text-4xl font-bold text-white">
              ${formatNumber(parseFloat(totalValueUSD))}
            </span>
            <span className="text-lg text-gray-400">
              {formatNumber(parseFloat(totalValueXRP))} XRP
            </span>
          </div>
        </div>
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
          isPositive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
        }`}>
          {isPositive ? (
            <TrendingUp className="w-5 h-5" />
          ) : (
            <TrendingDown className="w-5 h-5" />
          )}
          <span className="font-semibold">
            {isPositive ? '+' : ''}{changePercent24h}%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <QuickStat 
          label="XRP Balance" 
          value="1,000.00" 
          subvalue="$500.00" 
          icon={<Coins className="w-4 h-4" />}
          color="blue"
        />
        <QuickStat 
          label="VRTY Balance" 
          value="50,000" 
          subvalue="$500.00" 
          icon={<DollarSign className="w-4 h-4" />}
          color="purple"
        />
        <QuickStat 
          label="24h P&L" 
          value={`${isPositive ? '+' : ''}$${change24h}`} 
          subvalue={`${isPositive ? '+' : ''}${changePercent24h}%`} 
          icon={isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
          color={isPositive ? "green" : "red"}
        />
        <QuickStat 
          label="Total Trades" 
          value="127" 
          subvalue="All time" 
          icon={<PieChart className="w-4 h-4" />}
          color="yellow"
        />
      </div>
    </div>
  );
}

function QuickStat({ 
  label, 
  value, 
  subvalue, 
  icon,
  color,
}: { 
  label: string; 
  value: string; 
  subvalue: string; 
  icon: React.ReactNode;
  color: 'blue' | 'purple' | 'green' | 'red' | 'yellow';
}) {
  const colorClasses = {
    blue: 'bg-blue-500/20 text-blue-400',
    purple: 'bg-purple-500/20 text-purple-400',
    green: 'bg-green-500/20 text-green-400',
    red: 'bg-red-500/20 text-red-400',
    yellow: 'bg-yellow-500/20 text-yellow-400',
  };

  return (
    <div className="bg-gray-700/30 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-6 h-6 rounded flex items-center justify-center ${colorClasses[color]}`}>
          {icon}
        </div>
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <p className="text-lg font-semibold text-white">{value}</p>
      <p className="text-xs text-gray-500">{subvalue}</p>
    </div>
  );
}

// ============================================================
// HOLDINGS TABLE COMPONENT
// ============================================================

function HoldingsTable({ holdings }: { holdings: PortfolioHolding[] }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Wallet className="w-5 h-5 text-purple-400" />
          Holdings
        </h3>
        <button className="text-sm text-purple-400 hover:text-purple-300 transition-colors">
          View All
        </button>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-6 text-xs text-gray-400 pb-2 border-b border-gray-700">
        <span>Asset</span>
        <span className="text-right">Balance</span>
        <span className="text-right">Price</span>
        <span className="text-right">Value</span>
        <span className="text-right">24h Change</span>
        <span className="text-right">Allocation</span>
      </div>

      {/* Holdings Rows */}
      <div className="py-2 space-y-2">
        {holdings.map((holding) => (
          <HoldingRow key={holding.symbol} holding={holding} />
        ))}
      </div>
    </div>
  );
}

function HoldingRow({ holding }: { holding: PortfolioHolding }) {
  const isPositive = parseFloat(holding.change24h) >= 0;

  return (
    <div className="grid grid-cols-6 items-center py-3 hover:bg-gray-700/30 rounded-lg px-2 transition-colors">
      {/* Asset */}
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
          holding.symbol === 'XRP' ? 'bg-blue-500/20' : 'bg-purple-500/20'
        }`}>
          <span className={`font-bold text-sm ${
            holding.symbol === 'XRP' ? 'text-blue-400' : 'text-purple-400'
          }`}>
            {holding.symbol.slice(0, 2)}
          </span>
        </div>
        <div>
          <p className="text-white font-medium">{holding.symbol}</p>
          <p className="text-xs text-gray-400">{holding.name}</p>
        </div>
      </div>

      {/* Balance */}
      <div className="text-right">
        <p className="text-white">{formatNumber(parseFloat(holding.balance))}</p>
      </div>

      {/* Price */}
      <div className="text-right">
        <p className="text-white">${parseFloat(holding.price).toFixed(4)}</p>
      </div>

      {/* Value */}
      <div className="text-right">
        <p className="text-white">${formatNumber(parseFloat(holding.value))}</p>
      </div>

      {/* 24h Change */}
      <div className={`text-right ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
        <div className="flex items-center justify-end gap-1">
          {isPositive ? (
            <ArrowUpRight className="w-3 h-3" />
          ) : (
            <ArrowDownRight className="w-3 h-3" />
          )}
          <span>{isPositive ? '+' : ''}{holding.change24h}%</span>
        </div>
      </div>

      {/* Allocation */}
      <div className="text-right">
        <div className="flex items-center justify-end gap-2">
          <div className="w-16 h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full ${
                holding.symbol === 'XRP' ? 'bg-blue-500' : 'bg-purple-500'
              }`}
              style={{ width: `${holding.allocation}%` }}
            />
          </div>
          <span className="text-gray-400 text-sm">{holding.allocation}%</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// TRANSACTION HISTORY COMPONENT
// ============================================================

function TransactionHistory() {
  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Recent Transactions</h3>
        <button className="text-sm text-purple-400 hover:text-purple-300 transition-colors">
          View All
        </button>
      </div>

      <div className="space-y-3">
        {MOCK_TRANSACTIONS.map((tx, idx) => (
          <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                tx.type === 'buy' ? 'bg-green-500/20' : 'bg-red-500/20'
              }`}>
                {tx.type === 'buy' ? (
                  <ArrowDownRight className={`w-4 h-4 text-green-400`} />
                ) : (
                  <ArrowUpRight className={`w-4 h-4 text-red-400`} />
                )}
              </div>
              <div>
                <p className="text-white font-medium">
                  {tx.type === 'buy' ? 'Bought' : 'Sold'} {tx.asset}
                </p>
                <p className="text-xs text-gray-400">{tx.timestamp}</p>
              </div>
            </div>
            <div className="text-right">
              <p className={`font-medium ${tx.type === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                {tx.type === 'buy' ? '+' : '-'}{formatNumber(parseInt(tx.amount))} {tx.asset}
              </p>
              <p className="text-xs text-gray-400">${tx.total} XRP</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// WALLET CONNECTION COMPONENT
// ============================================================

function WalletConnection() {
  const [walletAddress, setWalletAddress] = useState('');
  const [copied, setCopied] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = () => {
    // This will integrate with Xumm/Crossmark wallet
    setIsConnecting(true);
    setTimeout(() => {
      setIsConnecting(false);
      alert('Wallet connection coming soon! Use demo mode for now.');
    }, 1000);
  };

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(walletAddress || MOCK_PORTFOLIO.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Wallet className="w-5 h-5 text-purple-400" />
          Wallet
        </h3>
        {walletAddress ? (
          <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded">
            Connected
          </span>
        ) : (
          <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">
            Demo Mode
          </span>
        )}
      </div>

      {walletAddress ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-gray-300 truncate flex-1">
              {walletAddress}
            </span>
            <button
              onClick={handleCopyAddress}
              className="p-1.5 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
            >
              {copied ? (
                <CheckCircle className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4 text-gray-400" />
              )}
            </button>
            <a
              href={`https://livenet.xrpl.org/accounts/${walletAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
            >
              <ExternalLink className="w-4 h-4 text-gray-400" />
            </a>
          </div>
          <button
            onClick={() => setWalletAddress('')}
            className="w-full py-2 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition-colors"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-400">
            Connect your XRPL wallet to view real balances and trade.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleConnect}
              disabled={isConnecting}
              className="flex-1 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isConnecting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Wallet className="w-4 h-4" />
              )}
              {isConnecting ? 'Connecting...' : 'Connect Wallet'}
            </button>
          </div>
          <div className="flex items-start gap-2 text-xs text-gray-400 bg-gray-700/50 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              Supported wallets: Xumm, Crossmark, GemWallet (coming soon)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// ALLOCATION CHART COMPONENT
// ============================================================

function AllocationChart({ holdings }: { holdings: PortfolioHolding[] }) {
  const totalValue = holdings.reduce((sum, h) => sum + parseFloat(h.value), 0);

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <PieChart className="w-5 h-5 text-purple-400" />
          Allocation
        </h3>
      </div>

      {/* Simple visual allocation */}
      <div className="space-y-4">
        {holdings.map((holding) => {
          const percentage = (parseFloat(holding.value) / totalValue) * 100;
          return (
            <div key={holding.symbol}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-white">{holding.symbol}</span>
                <span className="text-sm text-gray-400">{percentage.toFixed(1)}%</span>
              </div>
              <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${
                    holding.symbol === 'XRP' ? 'bg-blue-500' : 'bg-purple-500'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                ${formatNumber(parseFloat(holding.value))}
              </p>
            </div>
          );
        })}
      </div>
    </div>
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
    return (num / 1000).toFixed(2) + 'K';
  }
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function Portfolio() {
  const [isDemo] = useState(true);
  const holdings = MOCK_HOLDINGS;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Portfolio</h1>
          <p className="text-gray-400">Track your XRPL assets</p>
        </div>
        <button
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Demo Mode Banner */}
      {isDemo && (
        <div className="bg-purple-600/20 border border-purple-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-purple-400" />
          <div>
            <p className="text-purple-300 font-medium">Demo Mode</p>
            <p className="text-sm text-purple-400/80">
              Connect your wallet to see real balances. Demo data shown below.
            </p>
          </div>
        </div>
      )}

      {/* Portfolio Summary */}
      <PortfolioSummary
        totalValueUSD="1000.00"
        totalValueXRP="2000.00"
        change24h="35.00"
        changePercent24h="3.5"
      />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Holdings Table */}
        <div className="lg:col-span-2">
          <HoldingsTable holdings={holdings} />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <WalletConnection />
          <AllocationChart holdings={holdings} />
        </div>
      </div>

      {/* Transaction History */}
      <TransactionHistory />

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button className="bg-gray-800 rounded-xl p-4 text-left hover:bg-gray-700 transition-colors">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <ArrowDownRight className="w-5 h-5 text-green-400" />
            </div>
            <span className="text-white font-medium">Buy VRTY</span>
          </div>
          <p className="text-sm text-gray-400">
            Purchase VRTY tokens from the XRPL DEX
          </p>
        </button>

        <button className="bg-gray-800 rounded-xl p-4 text-left hover:bg-gray-700 transition-colors">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
              <ArrowUpRight className="w-5 h-5 text-red-400" />
            </div>
            <span className="text-white font-medium">Sell VRTY</span>
          </div>
          <p className="text-sm text-gray-400">
            Sell VRTY tokens on the XRPL DEX
          </p>
        </button>

        <button className="bg-gray-800 rounded-xl p-4 text-left hover:bg-gray-700 transition-colors">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
              <ExternalLink className="w-5 h-5 text-purple-400" />
            </div>
            <span className="text-white font-medium">View on Explorer</span>
          </div>
          <p className="text-sm text-gray-400">
            Check your account on XRPL Explorer
          </p>
        </button>
      </div>
    </div>
  );
}
