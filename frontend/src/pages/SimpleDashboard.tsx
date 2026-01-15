/**
 * Simple Mode Dashboard
 * Unified dashboard for new users - Phase 2 MVP
 * 
 * Verity Protocol - P2-01
 * 
 * Features:
 * - Overview of VRTY holdings
 * - Quick access to all platform features
 * - Real-time portfolio value
 * - Activity feed
 * - Quick actions
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  FileText,
  Building2,
  Users,
  Sparkles,
  Shield,
  ArrowRightLeft,
  RefreshCw,
  ExternalLink,
  Copy,
  Check,
  ChevronRight,
  Bell,
  Settings,
  HelpCircle,
  Zap,
  Activity,
} from 'lucide-react';
import { useUser } from '../App';
import { useApiContext } from '../hooks/useApiWithFallback';

// API client for VRTY data
const vrtyApi = {
  getBalance: async (address: string) => {
    const response = await fetch(`/api/v1/vrty/balance/${address}`);
    if (!response.ok) throw new Error('Failed to fetch balance');
    return response.json();
  },
  getTokenInfo: async () => {
    const response = await fetch('/api/v1/vrty/info');
    if (!response.ok) throw new Error('Failed to fetch token info');
    return response.json();
  },
};

// Demo data for when API is unavailable
const DEMO_PORTFOLIO = {
  vrty: {
    balance: '25000.000000',
    hasTrustline: true,
    trustlineLimit: '1000000000',
  },
  xrp: {
    balance: '150.50',
  },
  staking: {
    tier: 'PROFESSIONAL',
    nextTier: {
      name: 'COMMODORE',
      required: 50000,
      progress: 50,
    },
  },
};

const DEMO_TOKEN_INFO = {
  token: {
    symbol: 'VRTY',
    name: 'Verity Protocol',
    decimals: 6,
  },
  supply: {
    total: '1000000000',
    circulating: '0',
  },
  addresses: {
    issuer: 'rBeHfq9vRjZ8Cth1sMbp2nJvExmxSxAH8f',
    distributionWallet: 'rLmLMErLKDzWXyYmcZGHqQ3SCgTVJCVjA3',
  },
};

// Feature cards configuration
const featureCards = [
  {
    id: 'tax',
    title: 'Tax Dashboard',
    description: 'Automated tax reports for 200+ jurisdictions',
    icon: FileText,
    href: '/app/tax',
    color: 'from-blue-500 to-indigo-600',
    badge: 'Popular',
  },
  {
    id: 'trading',
    title: 'Trading',
    description: 'XRPL DEX with instant settlement',
    icon: TrendingUp,
    href: '/app/trading',
    color: 'from-emerald-500 to-teal-600',
    badge: null,
  },
  {
    id: 'assets',
    title: 'Tokenized Assets',
    description: 'Real estate, securities, equity tokens',
    icon: Building2,
    href: '/app/assets',
    color: 'from-purple-500 to-violet-600',
    badge: 'New',
  },
  {
    id: 'guilds',
    title: 'Guild Treasury',
    description: 'Multi-sig DAO management',
    icon: Users,
    href: '/app/guilds',
    color: 'from-orange-500 to-amber-600',
    badge: null,
  },
  {
    id: 'signals',
    title: 'Signals',
    description: 'Proof-of-engagement rewards',
    icon: Sparkles,
    href: '/app/signals',
    color: 'from-pink-500 to-rose-600',
    badge: null,
  },
  {
    id: 'sentinel',
    title: 'AI Sentinel',
    description: 'Fraud detection & compliance',
    icon: Shield,
    href: '/app/sentinel',
    color: 'from-red-500 to-rose-600',
    badge: 'Enterprise',
  },
  {
    id: 'bridge',
    title: 'Bridge',
    description: 'Cross-chain XRPL ↔ Solana',
    icon: ArrowRightLeft,
    href: '/app/bridge',
    color: 'from-cyan-500 to-blue-600',
    badge: null,
  },
];

// Quick actions configuration
const quickActions = [
  { id: 'send', label: 'Send VRTY', icon: ArrowRightLeft },
  { id: 'stake', label: 'Stake', icon: Zap },
  { id: 'trade', label: 'Trade', icon: TrendingUp },
  { id: 'bridge', label: 'Bridge', icon: ArrowRightLeft },
];

// Recent activity demo data
const DEMO_ACTIVITY = [
  { id: '1', type: 'receive', amount: '1,000 VRTY', from: 'rXXX...ABC', time: '2 hours ago', status: 'completed' },
  { id: '2', type: 'stake', amount: '5,000 VRTY', from: 'Staking Pool', time: '1 day ago', status: 'completed' },
  { id: '3', type: 'trade', amount: '500 VRTY', from: 'DEX Swap', time: '3 days ago', status: 'completed' },
];

// Format number with commas
function formatNumber(num: string | number, decimals = 2): string {
  const n = typeof num === 'string' ? parseFloat(num) : num;
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// Copy to clipboard component
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="p-1 hover:bg-gray-100 rounded transition-colors"
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="w-4 h-4 text-green-500" />
      ) : (
        <Copy className="w-4 h-4 text-gray-400" />
      )}
    </button>
  );
}

// Portfolio card component
function PortfolioCard({ portfolio, isLoading }: { 
  portfolio: typeof DEMO_PORTFOLIO; 
  isLoading: boolean;
}) {
  const { user } = useUser();
  const vrtyValue = parseFloat(portfolio.vrty.balance) * 0.01; // Assuming 0.01 USD per VRTY
  const xrpValue = parseFloat(portfolio.xrp.balance) * 0.50; // Assuming 0.50 USD per XRP
  const totalValue = vrtyValue + xrpValue;

  return (
    <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-6 text-white">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-indigo-200 text-sm">Total Portfolio Value</p>
          <h2 className="text-3xl font-bold">
            ${isLoading ? '---' : formatNumber(totalValue)}
          </h2>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full">
          <TrendingUp className="w-4 h-4" />
          <span className="text-sm font-medium">+2.5%</span>
        </div>
      </div>

      {/* Wallet Address */}
      {user?.wallet && (
        <div className="flex items-center gap-2 mb-6 p-3 bg-white/10 rounded-lg">
          <Wallet className="w-5 h-5 text-indigo-200" />
          <span className="font-mono text-sm truncate flex-1">{user.wallet}</span>
          <CopyButton text={user.wallet} />
        </div>
      )}

      {/* Token Balances */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-white/10 rounded-xl">
          <p className="text-indigo-200 text-xs mb-1">VRTY Balance</p>
          <p className="text-xl font-bold">
            {isLoading ? '---' : formatNumber(portfolio.vrty.balance)}
          </p>
          <p className="text-indigo-200 text-xs">
            ≈ ${isLoading ? '---' : formatNumber(vrtyValue)}
          </p>
        </div>
        <div className="p-4 bg-white/10 rounded-xl">
          <p className="text-indigo-200 text-xs mb-1">XRP Balance</p>
          <p className="text-xl font-bold">
            {isLoading ? '---' : formatNumber(portfolio.xrp.balance)}
          </p>
          <p className="text-indigo-200 text-xs">
            ≈ ${isLoading ? '---' : formatNumber(xrpValue)}
          </p>
        </div>
      </div>

      {/* Staking Tier */}
      <div className="mt-4 p-4 bg-white/10 rounded-xl">
        <div className="flex items-center justify-between mb-2">
          <span className="text-indigo-200 text-xs">Staking Tier</span>
          <span className="text-sm font-bold">{portfolio.staking.tier}</span>
        </div>
        <div className="w-full bg-white/20 rounded-full h-2">
          <div 
            className="bg-white rounded-full h-2 transition-all duration-500"
            style={{ width: `${portfolio.staking.nextTier?.progress || 0}%` }}
          />
        </div>
        {portfolio.staking.nextTier && (
          <p className="text-indigo-200 text-xs mt-1">
            {formatNumber(portfolio.staking.nextTier.required - parseFloat(portfolio.vrty.balance), 0)} VRTY to {portfolio.staking.nextTier.name}
          </p>
        )}
      </div>
    </div>
  );
}

// Feature card component
function FeatureCard({ feature }: { feature: typeof featureCards[0] }) {
  const navigate = useNavigate();
  const Icon = feature.icon;

  return (
    <button
      onClick={() => navigate(feature.href)}
      className="group relative p-5 bg-white rounded-xl border border-gray-200 hover:border-gray-300 hover:shadow-lg transition-all duration-200 text-left"
    >
      {feature.badge && (
        <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-indigo-600 text-white text-xs font-medium rounded-full">
          {feature.badge}
        </span>
      )}
      <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${feature.color} flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <h3 className="font-semibold text-gray-900 mb-1">{feature.title}</h3>
      <p className="text-sm text-gray-500 mb-3">{feature.description}</p>
      <div className="flex items-center text-indigo-600 text-sm font-medium group-hover:translate-x-1 transition-transform">
        Open <ChevronRight className="w-4 h-4 ml-1" />
      </div>
    </button>
  );
}

// Activity item component
function ActivityItem({ activity }: { activity: typeof DEMO_ACTIVITY[0] }) {
  const getIcon = () => {
    switch (activity.type) {
      case 'receive': return <TrendingDown className="w-4 h-4 text-green-500" />;
      case 'send': return <TrendingUp className="w-4 h-4 text-red-500" />;
      case 'stake': return <Zap className="w-4 h-4 text-yellow-500" />;
      case 'trade': return <ArrowRightLeft className="w-4 h-4 text-blue-500" />;
      default: return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-lg transition-colors">
      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
        {getIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 capitalize">{activity.type}</p>
        <p className="text-xs text-gray-500 truncate">{activity.from}</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-medium text-gray-900">{activity.amount}</p>
        <p className="text-xs text-gray-500">{activity.time}</p>
      </div>
    </div>
  );
}

// Main Dashboard Component
export default function SimpleDashboard() {
  const { user, isLoggedIn } = useUser();
  const { isLiveMode } = useApiContext();
  const navigate = useNavigate();

  // Fetch portfolio data
  const { data: balanceData, isLoading: balanceLoading, refetch: refetchBalance } = useQuery({
    queryKey: ['vrty-balance', user?.wallet],
    queryFn: () => vrtyApi.getBalance(user?.wallet || ''),
    enabled: !!user?.wallet && isLiveMode && !user.wallet.includes('demo'),
    staleTime: 30000, // 30 seconds
  });

  // Fetch token info
  const { data: tokenData, isLoading: tokenLoading } = useQuery({
    queryKey: ['vrty-info'],
    queryFn: vrtyApi.getTokenInfo,
    enabled: isLiveMode,
    staleTime: 60000, // 1 minute
  });

  // Use demo data if not in live mode or no data
  const portfolio = balanceData?.data || DEMO_PORTFOLIO;
  const tokenInfo = tokenData?.data || DEMO_TOKEN_INFO;
  const isLoading = balanceLoading || tokenLoading;

  // Redirect if not logged in
  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/');
    }
  }, [isLoggedIn, navigate]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">V</span>
              </div>
              <span className="font-bold text-xl text-gray-900">Verity</span>
            </div>
            <div className="flex items-center gap-4">
              <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                <Bell className="w-5 h-5" />
              </button>
              <button className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                <HelpCircle className="w-5 h-5" />
              </button>
              <button 
                onClick={() => navigate('/app/tax/settings')}
                className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back{user?.name ? `, ${user.name}` : ''}!
          </h1>
          <p className="text-gray-500 mt-1">
            Here's your portfolio overview for today.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Portfolio */}
          <div className="lg:col-span-1 space-y-6">
            {/* Portfolio Card */}
            <PortfolioCard 
              portfolio={portfolio} 
              isLoading={isLoading}
            />

            {/* Quick Actions */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.id}
                      className="flex flex-col items-center gap-2 p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                      onClick={() => {
                        if (action.id === 'trade') navigate('/app/trading');
                        if (action.id === 'bridge') navigate('/app/bridge');
                      }}
                    >
                      <Icon className="w-5 h-5 text-indigo-600" />
                      <span className="text-sm font-medium text-gray-700">{action.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">Recent Activity</h3>
                <button className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                  View All
                </button>
              </div>
              <div className="space-y-2">
                {DEMO_ACTIVITY.map((activity) => (
                  <ActivityItem key={activity.id} activity={activity} />
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Features */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Platform Features</h2>
              <button
                onClick={() => refetchBalance()}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {/* Feature Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {featureCards.map((feature) => (
                <FeatureCard key={feature.id} feature={feature} />
              ))}
            </div>

            {/* Token Info Banner */}
            <div className="mt-6 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-5 border border-indigo-100">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Zap className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">VRTY Token</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Total Supply: {formatNumber(tokenInfo.supply?.total || '1000000000', 0)} VRTY
                  </p>
                  <p className="text-sm text-gray-600">
                    Issuer: {tokenInfo.addresses?.issuer?.substring(0, 12)}...
                  </p>
                  <a
                    href={`https://livenet.xrpl.org/accounts/${tokenInfo.addresses?.issuer}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700 mt-2"
                  >
                    View on XRPL Explorer <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
