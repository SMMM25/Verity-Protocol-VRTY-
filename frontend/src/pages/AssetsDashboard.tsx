/**
 * Verity Protocol - Tokenized Assets Dashboard (Phase 5)
 * Pillar-worthy implementation with:
 * - Real Estate Tokenization UI
 * - Fractional Ownership Interface ($10 minimum)
 * - Asset Issuance Wizard
 * - Investor Whitelist Management
 * - Dividend Distribution Tracker
 * - Compliance Status Display (XAO-DOW integration)
 * - XRPL DEX Secondary Market Integration
 */

import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '../App';
import { assetsApi } from '../api/client';
import {
  Building2,
  Briefcase,
  Coins,
  Users,
  TrendingUp,
  TrendingDown,
  Shield,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Plus,
  Filter,
  Search,
  LayoutGrid,
  List,
  ChevronRight,
  DollarSign,
  Landmark,
  Lock,
  PieChart,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Eye,
  FileText,
  Star,
  Layers,
  MapPin,
  Calendar,
  Percent,
  ArrowRightLeft,
  ShoppingCart,
  Gavel,
  BarChart3,
  Globe,
} from 'lucide-react';
import type {
  TokenizedAsset,
  PortfolioHolding,
  DividendDistribution,
} from '../types/assets';
import { AssetType, AssetStatus, ComplianceStatus } from '../types/assets';

// Import sub-components
import { IssuanceWizard, WhitelistManager, ComplianceDisplay } from '../components/assets';

// ============================================================
// DEMO DATA - Production-ready mock data
// ============================================================

const DEMO_ASSETS: TokenizedAsset[] = [
  {
    id: 'asset_001',
    name: 'Manhattan Tower REIT',
    symbol: 'MTWR',
    issuer: 'rBeHfq9vRjZ8Cth1sMbp2nJvExmxSxAH8f',
    totalSupply: '10000000',
    circulatingSupply: '7500000',
    decimals: 6,
    assetType: AssetType.REAL_ESTATE,
    status: AssetStatus.ACTIVE,
    complianceStatus: ComplianceStatus.COMPLIANT,
    isVerified: true,
    requiresKYC: true,
    enableClawback: true,
    jurisdictions: ['US', 'EU', 'UK', 'SG'],
    createdAt: '2025-06-15T00:00:00Z',
    updatedAt: '2026-01-10T00:00:00Z',
    metadata: {
      description: 'Premium Class A office tower in Manhattan Financial District. 45-story building with 1.2M sq ft of leasable space, 94.5% occupancy rate.',
      website: 'https://manhattantower.example.com',
    },
    propertyDetails: {
      address: '100 Wall Street, New York, NY 10005',
      propertyType: 'Commercial Office',
      squareFootage: 1200000,
      yearBuilt: 2018,
      occupancyRate: 94.5,
      annualRentIncome: 85000000,
    },
    financials: {
      totalValueUSD: 450000000,
      tokenPriceUSD: 45.0,
      priceChange24h: 1.25,
      priceChange7d: 3.45,
      volume24hUSD: 2500000,
      marketCapUSD: 450000000,
      dividendYield: 5.8,
      totalDividendsPaid: 26100000,
    },
    holders: {
      totalHolders: 1247,
      institutionalHolders: 89,
      retailHolders: 1158,
      topHolderPercentage: 12.5,
    },
    tradingInfo: {
      isListedOnDEX: true,
      tradingPair: 'MTWR/XRP',
      minOrderSize: '0.22', // ~$10 at $45/token
      maxOrderSize: '100000',
      tradingEnabled: true,
    },
  },
  {
    id: 'asset_002',
    name: 'TechVentures Growth Fund',
    symbol: 'TVGF',
    issuer: 'rBeHfq9vRjZ8Cth1sMbp2nJvExmxSxAH8f',
    totalSupply: '5000000',
    circulatingSupply: '4200000',
    decimals: 6,
    assetType: AssetType.PRIVATE_EQUITY,
    status: AssetStatus.ACTIVE,
    complianceStatus: ComplianceStatus.COMPLIANT,
    isVerified: true,
    requiresKYC: true,
    enableClawback: true,
    jurisdictions: ['US', 'EU'],
    createdAt: '2025-08-20T00:00:00Z',
    updatedAt: '2026-01-12T00:00:00Z',
    metadata: {
      description: 'Diversified private equity fund focused on late-stage technology companies with proven revenue models.',
    },
    financials: {
      totalValueUSD: 125000000,
      tokenPriceUSD: 25.0,
      priceChange24h: -0.85,
      priceChange7d: 2.15,
      volume24hUSD: 850000,
      marketCapUSD: 125000000,
      dividendYield: 0,
      totalDividendsPaid: 0,
    },
    holders: {
      totalHolders: 342,
      institutionalHolders: 67,
      retailHolders: 275,
      topHolderPercentage: 18.3,
    },
    tradingInfo: {
      isListedOnDEX: true,
      tradingPair: 'TVGF/XRP',
      minOrderSize: '0.4', // ~$10 at $25/token
      tradingEnabled: true,
    },
  },
  {
    id: 'asset_003',
    name: 'Green Energy Bond 2030',
    symbol: 'GEB30',
    issuer: 'rBeHfq9vRjZ8Cth1sMbp2nJvExmxSxAH8f',
    totalSupply: '100000000',
    circulatingSupply: '85000000',
    decimals: 2,
    assetType: AssetType.SECURITY,
    status: AssetStatus.ACTIVE,
    complianceStatus: ComplianceStatus.COMPLIANT,
    isVerified: true,
    requiresKYC: true,
    enableClawback: true,
    jurisdictions: ['US', 'EU', 'UK', 'JP', 'SG', 'AU'],
    createdAt: '2025-03-01T00:00:00Z',
    updatedAt: '2026-01-14T00:00:00Z',
    metadata: {
      description: 'Investment-grade green bond financing renewable energy infrastructure. AA rated by Moody\'s.',
    },
    financials: {
      totalValueUSD: 100000000,
      tokenPriceUSD: 1.0,
      priceChange24h: 0.02,
      priceChange7d: 0.15,
      volume24hUSD: 5200000,
      marketCapUSD: 85000000,
      dividendYield: 4.25,
      totalDividendsPaid: 3612500,
    },
    holders: {
      totalHolders: 5823,
      institutionalHolders: 412,
      retailHolders: 5411,
      topHolderPercentage: 8.2,
    },
    tradingInfo: {
      isListedOnDEX: true,
      tradingPair: 'GEB30/XRP',
      minOrderSize: '10', // $10 at $1/token
      tradingEnabled: true,
    },
  },
  {
    id: 'asset_004',
    name: 'Verity Community Token',
    symbol: 'VCT',
    issuer: 'rBeHfq9vRjZ8Cth1sMbp2nJvExmxSxAH8f',
    totalSupply: '1000000000',
    circulatingSupply: '450000000',
    decimals: 6,
    assetType: AssetType.COMMUNITY,
    status: AssetStatus.ACTIVE,
    complianceStatus: ComplianceStatus.PENDING_REVIEW,
    isVerified: false,
    requiresKYC: false,
    enableClawback: false,
    jurisdictions: [],
    createdAt: '2025-11-01T00:00:00Z',
    updatedAt: '2026-01-13T00:00:00Z',
    metadata: {
      description: 'Community governance token for the Verity ecosystem.',
    },
    financials: {
      totalValueUSD: 2250000,
      tokenPriceUSD: 0.005,
      priceChange24h: 5.25,
      priceChange7d: -2.15,
      volume24hUSD: 125000,
      marketCapUSD: 2250000,
      dividendYield: 0,
      totalDividendsPaid: 0,
    },
    holders: {
      totalHolders: 12458,
      institutionalHolders: 0,
      retailHolders: 12458,
      topHolderPercentage: 5.5,
    },
    tradingInfo: {
      isListedOnDEX: true,
      tradingPair: 'VCT/XRP',
      minOrderSize: '2000', // ~$10 at $0.005/token
      tradingEnabled: true,
    },
  },
  {
    id: 'asset_005',
    name: 'Sunset Beach Resort',
    symbol: 'SBR',
    issuer: 'rBeHfq9vRjZ8Cth1sMbp2nJvExmxSxAH8f',
    totalSupply: '2000000',
    circulatingSupply: '1500000',
    decimals: 6,
    assetType: AssetType.REAL_ESTATE,
    status: AssetStatus.ACTIVE,
    complianceStatus: ComplianceStatus.COMPLIANT,
    isVerified: true,
    requiresKYC: true,
    enableClawback: true,
    jurisdictions: ['US', 'EU'],
    createdAt: '2025-09-01T00:00:00Z',
    updatedAt: '2026-01-14T00:00:00Z',
    metadata: {
      description: 'Luxury beachfront resort property in Miami Beach. 250 rooms, 4 restaurants, private beach access.',
    },
    propertyDetails: {
      address: '1500 Ocean Drive, Miami Beach, FL 33139',
      propertyType: 'Hospitality',
      squareFootage: 450000,
      yearBuilt: 2020,
      occupancyRate: 78.5,
      annualRentIncome: 32000000,
    },
    financials: {
      totalValueUSD: 180000000,
      tokenPriceUSD: 90.0,
      priceChange24h: 0.45,
      priceChange7d: 1.23,
      volume24hUSD: 890000,
      marketCapUSD: 135000000,
      dividendYield: 6.2,
      totalDividendsPaid: 8370000,
    },
    holders: {
      totalHolders: 856,
      institutionalHolders: 45,
      retailHolders: 811,
      topHolderPercentage: 15.2,
    },
    tradingInfo: {
      isListedOnDEX: true,
      tradingPair: 'SBR/XRP',
      minOrderSize: '0.12', // ~$10 at $90/token
      tradingEnabled: true,
    },
  },
];

const DEMO_PORTFOLIO: PortfolioHolding[] = [
  {
    assetId: 'asset_001',
    asset: DEMO_ASSETS[0],
    balance: '5000',
    lockedBalance: '1000',
    availableBalance: '4000',
    vestingInfo: {
      totalVesting: '2000',
      vestedAmount: '1000',
      nextVestingDate: '2026-02-15T00:00:00Z',
      nextVestingAmount: '500',
    },
    costBasis: 42.5,
    currentValue: 225000,
    unrealizedGain: 12500,
    unrealizedGainPercent: 5.88,
    dividendsReceived: 13050,
    acquisitionDate: '2025-08-15T00:00:00Z',
  },
  {
    assetId: 'asset_002',
    asset: DEMO_ASSETS[1],
    balance: '2000',
    lockedBalance: '0',
    availableBalance: '2000',
    costBasis: 23.0,
    currentValue: 50000,
    unrealizedGain: 4000,
    unrealizedGainPercent: 8.7,
    dividendsReceived: 0,
    acquisitionDate: '2025-10-01T00:00:00Z',
  },
  {
    assetId: 'asset_005',
    asset: DEMO_ASSETS[4],
    balance: '500',
    lockedBalance: '100',
    availableBalance: '400',
    costBasis: 85.0,
    currentValue: 45000,
    unrealizedGain: 2500,
    unrealizedGainPercent: 5.88,
    dividendsReceived: 2790,
    acquisitionDate: '2025-09-15T00:00:00Z',
  },
];

const DEMO_DIVIDENDS: DividendDistribution[] = [
  {
    id: 'div_001',
    assetId: 'asset_001',
    totalAmount: '2175000',
    currency: 'XRP',
    amountPerToken: '0.29',
    recordDate: '2025-12-31T00:00:00Z',
    paymentDate: '2026-01-15T00:00:00Z',
    status: 'SCHEDULED',
    dividendType: 'REGULAR',
    eligibleHolders: 1247,
    totalEligibleTokens: '7500000',
    taxWithholdingRate: 0.15,
  },
  {
    id: 'div_002',
    assetId: 'asset_003',
    totalAmount: '903125',
    currency: 'XRP',
    amountPerToken: '0.01063',
    recordDate: '2025-12-15T00:00:00Z',
    paymentDate: '2025-12-20T00:00:00Z',
    status: 'COMPLETED',
    dividendType: 'REGULAR',
    eligibleHolders: 5823,
    totalEligibleTokens: '85000000',
    paidAt: '2025-12-20T00:00:00Z',
    transactionHash: '0xabc123...def456',
  },
  {
    id: 'div_003',
    assetId: 'asset_005',
    totalAmount: '930000',
    currency: 'XRP',
    amountPerToken: '0.62',
    recordDate: '2026-01-31T00:00:00Z',
    paymentDate: '2026-02-15T00:00:00Z',
    status: 'SCHEDULED',
    dividendType: 'REGULAR',
    eligibleHolders: 856,
    totalEligibleTokens: '1500000',
    taxWithholdingRate: 0.15,
  },
];

const DEMO_STATS = {
  totalAssetsTokenized: 5,
  totalValueLocked: 857250000,
  totalHolders: 19870,
  totalDividendsPaid: 38082500,
  platformFeeCollected: 2143125,
  averageDividendYield: 4.06,
  realEstateAssets: 2,
  privateEquityAssets: 1,
  securityAssets: 1,
  communityAssets: 1,
};

// Demo order book for DEX integration
const DEMO_ORDER_BOOK = {
  assetId: 'asset_001',
  tradingPair: 'MTWR/XRP',
  bids: [
    { price: 44.85, amount: 1250, total: 56062.50 },
    { price: 44.80, amount: 3000, total: 134400.00 },
    { price: 44.75, amount: 5500, total: 246125.00 },
    { price: 44.70, amount: 8000, total: 357600.00 },
    { price: 44.65, amount: 12000, total: 535800.00 },
  ],
  asks: [
    { price: 45.05, amount: 800, total: 36040.00 },
    { price: 45.10, amount: 2500, total: 112750.00 },
    { price: 45.15, amount: 4200, total: 189630.00 },
    { price: 45.20, amount: 6000, total: 271200.00 },
    { price: 45.25, amount: 9500, total: 429875.00 },
  ],
  lastPrice: 45.00,
  volume24h: 2500000,
  high24h: 45.50,
  low24h: 44.20,
};

// ============================================================
// ASSET TYPE CONFIGURATION
// ============================================================

const ASSET_TYPE_CONFIG: Record<AssetType, { icon: typeof Building2; color: string; bgColor: string; label: string }> = {
  [AssetType.REAL_ESTATE]: { icon: Building2, color: 'text-blue-600', bgColor: 'bg-blue-100', label: 'Real Estate' },
  [AssetType.PRIVATE_EQUITY]: { icon: Briefcase, color: 'text-purple-600', bgColor: 'bg-purple-100', label: 'Private Equity' },
  [AssetType.SECURITY]: { icon: Landmark, color: 'text-green-600', bgColor: 'bg-green-100', label: 'Security' },
  [AssetType.COMMUNITY]: { icon: Users, color: 'text-orange-600', bgColor: 'bg-orange-100', label: 'Community' },
  [AssetType.DEBT]: { icon: FileText, color: 'text-red-600', bgColor: 'bg-red-100', label: 'Debt' },
  [AssetType.COMMODITY]: { icon: Coins, color: 'text-yellow-600', bgColor: 'bg-yellow-100', label: 'Commodity' },
  [AssetType.COLLECTIBLE]: { icon: Star, color: 'text-pink-600', bgColor: 'bg-pink-100', label: 'Collectible' },
  [AssetType.INFRASTRUCTURE]: { icon: Layers, color: 'text-indigo-600', bgColor: 'bg-indigo-100', label: 'Infrastructure' },
};

// ============================================================
// HELPER COMPONENTS
// ============================================================

function StatusBadge({ status }: { status: AssetStatus | ComplianceStatus }) {
  const configs: Record<string, { color: string; bgColor: string; icon: typeof CheckCircle2 }> = {
    [AssetStatus.ACTIVE]: { color: 'text-green-700', bgColor: 'bg-green-100', icon: CheckCircle2 },
    [AssetStatus.PENDING]: { color: 'text-yellow-700', bgColor: 'bg-yellow-100', icon: Clock },
    [AssetStatus.SUSPENDED]: { color: 'text-red-700', bgColor: 'bg-red-100', icon: AlertTriangle },
    [AssetStatus.FROZEN]: { color: 'text-blue-700', bgColor: 'bg-blue-100', icon: Lock },
    [AssetStatus.REDEEMED]: { color: 'text-gray-700', bgColor: 'bg-gray-100', icon: XCircle },
    [ComplianceStatus.COMPLIANT]: { color: 'text-green-700', bgColor: 'bg-green-100', icon: Shield },
    [ComplianceStatus.PENDING_REVIEW]: { color: 'text-yellow-700', bgColor: 'bg-yellow-100', icon: Clock },
    [ComplianceStatus.UNDER_REVIEW]: { color: 'text-blue-700', bgColor: 'bg-blue-100', icon: Eye },
    [ComplianceStatus.NON_COMPLIANT]: { color: 'text-red-700', bgColor: 'bg-red-100', icon: XCircle },
  };
  
  const config = configs[status] || configs[AssetStatus.PENDING];
  const Icon = config.icon;
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}>
      <Icon className="w-3 h-3" />
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function formatCurrency(value: number, decimals: number = 0): string {
  if (value >= 1000000000) return `$${(value / 1000000000).toFixed(2)}B`;
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(decimals > 0 ? 1 : 0)}K`;
  return `$${value.toFixed(decimals)}`;
}

function formatNumber(value: number): string {
  return value.toLocaleString('en-US');
}

function PriceChange({ value }: { value: number }) {
  const isPositive = value >= 0;
  const Icon = isPositive ? ArrowUpRight : ArrowDownRight;
  
  return (
    <span className={`inline-flex items-center text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
      <Icon className="w-4 h-4" />
      {Math.abs(value).toFixed(2)}%
    </span>
  );
}

// ============================================================
// FRACTIONAL OWNERSHIP PURCHASE INTERFACE ($10 MINIMUM)
// ============================================================

function FractionalPurchaseInterface({ 
  asset, 
  onClose 
}: { 
  asset: TokenizedAsset; 
  onClose: () => void;
}) {
  const [amount, setAmount] = useState<string>('');
  const [purchaseType, setPurchaseType] = useState<'tokens' | 'usd'>('usd');
  const MINIMUM_PURCHASE_USD = 10;
  
  const tokenPrice = asset.financials?.tokenPriceUSD || 0;
  
  const calculatedTokens = purchaseType === 'usd' 
    ? (parseFloat(amount) || 0) / tokenPrice 
    : parseFloat(amount) || 0;
  
  const calculatedUSD = purchaseType === 'tokens' 
    ? (parseFloat(amount) || 0) * tokenPrice 
    : parseFloat(amount) || 0;
  
  const isValidAmount = calculatedUSD >= MINIMUM_PURCHASE_USD;
  const minimumTokens = MINIMUM_PURCHASE_USD / tokenPrice;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-lg w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-semibold">Buy {asset.symbol}</h2>
                <p className="text-sm text-white/80">${MINIMUM_PURCHASE_USD} minimum investment</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Asset Info */}
          <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
            <div className={`p-3 rounded-xl ${ASSET_TYPE_CONFIG[asset.assetType]?.bgColor}`}>
              {(() => {
                const Icon = ASSET_TYPE_CONFIG[asset.assetType]?.icon || Coins;
                return <Icon className={`w-6 h-6 ${ASSET_TYPE_CONFIG[asset.assetType]?.color}`} />;
              })()}
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900">{asset.name}</h3>
              <p className="text-sm text-gray-500">{asset.symbol} • ${tokenPrice.toFixed(2)} per token</p>
            </div>
            <PriceChange value={asset.financials?.priceChange24h || 0} />
          </div>

          {/* Purchase Type Toggle */}
          <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
            <button
              onClick={() => setPurchaseType('usd')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                purchaseType === 'usd' ? 'bg-white shadow text-indigo-600' : 'text-gray-600'
              }`}
            >
              Buy with USD
            </button>
            <button
              onClick={() => setPurchaseType('tokens')}
              className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
                purchaseType === 'tokens' ? 'bg-white shadow text-indigo-600' : 'text-gray-600'
              }`}
            >
              Buy Tokens
            </button>
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {purchaseType === 'usd' ? 'Amount (USD)' : 'Number of Tokens'}
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500">
                {purchaseType === 'usd' ? '$' : ''}
              </span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={purchaseType === 'usd' ? `Min ${MINIMUM_PURCHASE_USD}` : `Min ${minimumTokens.toFixed(4)}`}
                className={`w-full ${purchaseType === 'usd' ? 'pl-8' : 'pl-4'} pr-4 py-3 border rounded-xl text-lg font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500`}
              />
            </div>
            {amount && !isValidAmount && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Minimum purchase is ${MINIMUM_PURCHASE_USD}
              </p>
            )}
          </div>

          {/* Conversion Display */}
          {amount && (
            <div className="p-4 bg-indigo-50 rounded-xl space-y-3">
              <div className="flex justify-between">
                <span className="text-indigo-700">You'll receive</span>
                <span className="font-bold text-indigo-900">
                  {calculatedTokens.toFixed(6)} {asset.symbol}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-indigo-700">Total cost</span>
                <span className="font-bold text-indigo-900">
                  ${calculatedUSD.toFixed(2)}
                </span>
              </div>
              {asset.financials?.dividendYield && asset.financials.dividendYield > 0 && (
                <div className="flex justify-between pt-2 border-t border-indigo-200">
                  <span className="text-indigo-700">Est. Annual Dividend</span>
                  <span className="font-bold text-green-600">
                    ${(calculatedUSD * (asset.financials.dividendYield / 100)).toFixed(2)}/yr
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Quick Amount Buttons */}
          <div className="grid grid-cols-4 gap-2">
            {[10, 50, 100, 500].map((quickAmount) => (
              <button
                key={quickAmount}
                onClick={() => {
                  setPurchaseType('usd');
                  setAmount(quickAmount.toString());
                }}
                className="py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                ${quickAmount}
              </button>
            ))}
          </div>

          {/* KYC Notice */}
          {asset.requiresKYC && (
            <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <Shield className="w-5 h-5 text-amber-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-900">KYC Required</p>
                <p className="text-amber-700">This asset requires identity verification before purchase.</p>
              </div>
            </div>
          )}

          {/* Buy Button */}
          <button
            disabled={!isValidAmount}
            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <ShoppingCart className="w-5 h-5" />
            Buy {calculatedTokens.toFixed(4)} {asset.symbol}
          </button>

          <p className="text-xs text-center text-gray-500">
            By purchasing, you agree to the asset terms and conditions.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// XRPL DEX TRADING INTERFACE
// ============================================================

function DEXTradingInterface({ 
  asset, 
  onClose 
}: { 
  asset: TokenizedAsset; 
  onClose: () => void;
}) {
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [priceType, setPriceType] = useState<'market' | 'limit'>('market');
  const [amount, setAmount] = useState('');
  const [limitPrice, setLimitPrice] = useState('');
  
  const orderBook = DEMO_ORDER_BOOK;
  const MINIMUM_TRADE_USD = 10;
  const tokenPrice = asset.financials?.tokenPriceUSD || 0;
  const minimumTokens = MINIMUM_TRADE_USD / tokenPrice;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-100 rounded-xl">
                <ArrowRightLeft className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Trade {asset.symbol}</h2>
                <p className="text-sm text-gray-500">XRPL DEX • {orderBook.tradingPair}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <XCircle className="w-6 h-6 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Order Book */}
            <div className="lg:col-span-2 space-y-4">
              {/* Market Stats */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">Last Price</div>
                  <div className="font-bold text-gray-900">${orderBook.lastPrice.toFixed(2)}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">24h Volume</div>
                  <div className="font-bold text-gray-900">{formatCurrency(orderBook.volume24h)}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">24h High</div>
                  <div className="font-bold text-green-600">${orderBook.high24h.toFixed(2)}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">24h Low</div>
                  <div className="font-bold text-red-600">${orderBook.low24h.toFixed(2)}</div>
                </div>
              </div>

              {/* Order Book */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-indigo-600" />
                    Order Book
                  </h3>
                </div>
                <div className="grid grid-cols-2 divide-x divide-gray-200">
                  {/* Bids */}
                  <div>
                    <div className="grid grid-cols-3 gap-2 px-4 py-2 bg-gray-50 text-xs font-medium text-gray-500">
                      <span>Price</span>
                      <span className="text-right">Amount</span>
                      <span className="text-right">Total</span>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {orderBook.bids.map((bid, i) => (
                        <div key={i} className="grid grid-cols-3 gap-2 px-4 py-2 text-sm hover:bg-green-50 cursor-pointer">
                          <span className="text-green-600 font-medium">${bid.price.toFixed(2)}</span>
                          <span className="text-right text-gray-700">{formatNumber(bid.amount)}</span>
                          <span className="text-right text-gray-500">${formatNumber(bid.total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Asks */}
                  <div>
                    <div className="grid grid-cols-3 gap-2 px-4 py-2 bg-gray-50 text-xs font-medium text-gray-500">
                      <span>Price</span>
                      <span className="text-right">Amount</span>
                      <span className="text-right">Total</span>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {orderBook.asks.map((ask, i) => (
                        <div key={i} className="grid grid-cols-3 gap-2 px-4 py-2 text-sm hover:bg-red-50 cursor-pointer">
                          <span className="text-red-600 font-medium">${ask.price.toFixed(2)}</span>
                          <span className="text-right text-gray-700">{formatNumber(ask.amount)}</span>
                          <span className="text-right text-gray-500">${formatNumber(ask.total)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Order Form */}
            <div className="bg-gray-50 rounded-xl p-6">
              {/* Buy/Sell Toggle */}
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => setOrderType('buy')}
                  className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
                    orderType === 'buy' 
                      ? 'bg-green-600 text-white' 
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-green-50'
                  }`}
                >
                  Buy
                </button>
                <button
                  onClick={() => setOrderType('sell')}
                  className={`flex-1 py-3 rounded-lg font-semibold transition-all ${
                    orderType === 'sell' 
                      ? 'bg-red-600 text-white' 
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-red-50'
                  }`}
                >
                  Sell
                </button>
              </div>

              {/* Price Type */}
              <div className="flex gap-2 p-1 bg-white rounded-lg border border-gray-200 mb-6">
                <button
                  onClick={() => setPriceType('market')}
                  className={`flex-1 py-2 rounded text-sm font-medium ${
                    priceType === 'market' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600'
                  }`}
                >
                  Market
                </button>
                <button
                  onClick={() => setPriceType('limit')}
                  className={`flex-1 py-2 rounded text-sm font-medium ${
                    priceType === 'limit' ? 'bg-indigo-100 text-indigo-700' : 'text-gray-600'
                  }`}
                >
                  Limit
                </button>
              </div>

              {/* Limit Price */}
              {priceType === 'limit' && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Limit Price</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      value={limitPrice}
                      onChange={(e) => setLimitPrice(e.target.value)}
                      placeholder={orderBook.lastPrice.toFixed(2)}
                      className="w-full pl-7 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}

              {/* Amount */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount ({asset.symbol})</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={`Min ${minimumTokens.toFixed(4)}`}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Minimum trade: ${MINIMUM_TRADE_USD} (~{minimumTokens.toFixed(4)} {asset.symbol})
                </p>
              </div>

              {/* Quick Percentages */}
              <div className="grid grid-cols-4 gap-2 mb-6">
                {[25, 50, 75, 100].map((pct) => (
                  <button
                    key={pct}
                    className="py-2 border border-gray-300 rounded text-sm font-medium text-gray-700 hover:bg-white"
                  >
                    {pct}%
                  </button>
                ))}
              </div>

              {/* Order Summary */}
              {amount && (
                <div className="bg-white rounded-lg p-4 mb-6 border border-gray-200">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600">Total</span>
                    <span className="font-bold text-gray-900">
                      ${((parseFloat(amount) || 0) * (parseFloat(limitPrice) || orderBook.lastPrice)).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Fee (0.1%)</span>
                    <span className="text-gray-700">
                      ${(((parseFloat(amount) || 0) * (parseFloat(limitPrice) || orderBook.lastPrice)) * 0.001).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                className={`w-full py-4 rounded-xl font-semibold text-white ${
                  orderType === 'buy' 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {orderType === 'buy' ? 'Buy' : 'Sell'} {asset.symbol}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// ASSET DETAIL MODAL
// ============================================================

function AssetDetailModal({ 
  asset, 
  onClose,
  onBuy,
  onTrade,
}: { 
  asset: TokenizedAsset; 
  onClose: () => void;
  onBuy: () => void;
  onTrade: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'property' | 'holders' | 'compliance'>('overview');
  const typeConfig = ASSET_TYPE_CONFIG[asset.assetType];
  const TypeIcon = typeConfig?.icon || Coins;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${typeConfig?.bgColor}`}>
                <TypeIcon className={`w-6 h-6 ${typeConfig?.color}`} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  {asset.name}
                  {asset.isVerified && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                </h2>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-sm font-mono text-gray-500">{asset.symbol}</span>
                  <StatusBadge status={asset.status} />
                  <StatusBadge status={asset.complianceStatus} />
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <XCircle className="w-6 h-6 text-gray-400" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4 -mb-px">
            {[
              { id: 'overview', label: 'Overview', icon: Eye },
              { id: 'property', label: asset.assetType === AssetType.REAL_ESTATE ? 'Property' : 'Details', icon: Building2 },
              { id: 'holders', label: 'Holders', icon: Users },
              { id: 'compliance', label: 'Compliance', icon: Shield },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600 bg-indigo-50'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Description */}
              {asset.metadata?.description && (
                <p className="text-gray-600">{asset.metadata.description}</p>
              )}

              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-xs text-gray-500 mb-1">Token Price</div>
                  <div className="text-xl font-bold text-gray-900">
                    ${asset.financials?.tokenPriceUSD?.toFixed(2)}
                  </div>
                  <PriceChange value={asset.financials?.priceChange24h || 0} />
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-xs text-gray-500 mb-1">Market Cap</div>
                  <div className="text-xl font-bold text-gray-900">
                    {formatCurrency(asset.financials?.marketCapUSD || 0)}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-xs text-gray-500 mb-1">Dividend Yield</div>
                  <div className="text-xl font-bold text-green-600">
                    {asset.financials?.dividendYield?.toFixed(2) || '0.00'}%
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-xs text-gray-500 mb-1">Total Holders</div>
                  <div className="text-xl font-bold text-gray-900">
                    {formatNumber(asset.holders?.totalHolders || 0)}
                  </div>
                </div>
              </div>

              {/* Trading Info */}
              <div className="bg-indigo-50 rounded-xl p-6">
                <h3 className="font-semibold text-indigo-900 mb-4 flex items-center gap-2">
                  <ArrowRightLeft className="w-5 h-5" />
                  Trading Information
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-xs text-indigo-600 mb-1">Trading Pair</div>
                    <div className="font-medium text-indigo-900">{asset.tradingInfo?.tradingPair || 'N/A'}</div>
                  </div>
                  <div>
                    <div className="text-xs text-indigo-600 mb-1">24h Volume</div>
                    <div className="font-medium text-indigo-900">
                      {formatCurrency(asset.financials?.volume24hUSD || 0)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-indigo-600 mb-1">Min Order ($10)</div>
                    <div className="font-medium text-indigo-900">
                      {asset.tradingInfo?.minOrderSize} {asset.symbol}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-indigo-600 mb-1">Status</div>
                    <div className={`font-medium ${asset.tradingInfo?.tradingEnabled ? 'text-green-600' : 'text-red-600'}`}>
                      {asset.tradingInfo?.tradingEnabled ? 'Active' : 'Disabled'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4">
                <button 
                  onClick={onBuy}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold rounded-xl hover:opacity-90 flex items-center justify-center gap-2"
                >
                  <ShoppingCart className="w-5 h-5" />
                  Buy {asset.symbol}
                </button>
                {asset.tradingInfo?.tradingEnabled && (
                  <button 
                    onClick={onTrade}
                    className="flex-1 py-3 px-4 border-2 border-indigo-600 text-indigo-600 font-semibold rounded-xl hover:bg-indigo-50 flex items-center justify-center gap-2"
                  >
                    <ArrowRightLeft className="w-5 h-5" />
                    Trade on DEX
                  </button>
                )}
              </div>
            </div>
          )}

          {activeTab === 'property' && asset.propertyDetails && (
            <div className="space-y-6">
              <div className="bg-blue-50 rounded-xl p-6">
                <h3 className="font-semibold text-blue-900 mb-4 flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Property Details
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  <div>
                    <div className="text-xs text-blue-600 mb-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Address
                    </div>
                    <div className="font-medium text-blue-900">{asset.propertyDetails.address}</div>
                  </div>
                  <div>
                    <div className="text-xs text-blue-600 mb-1">Property Type</div>
                    <div className="font-medium text-blue-900">{asset.propertyDetails.propertyType}</div>
                  </div>
                  <div>
                    <div className="text-xs text-blue-600 mb-1">Square Footage</div>
                    <div className="font-medium text-blue-900">
                      {formatNumber(asset.propertyDetails.squareFootage || 0)} sq ft
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-blue-600 mb-1 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Year Built
                    </div>
                    <div className="font-medium text-blue-900">{asset.propertyDetails.yearBuilt}</div>
                  </div>
                  <div>
                    <div className="text-xs text-blue-600 mb-1">Occupancy Rate</div>
                    <div className="font-medium text-green-600">{asset.propertyDetails.occupancyRate}%</div>
                  </div>
                  <div>
                    <div className="text-xs text-blue-600 mb-1">Annual Rent Income</div>
                    <div className="font-medium text-blue-900">
                      {formatCurrency(asset.propertyDetails.annualRentIncome || 0)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'holders' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-xs text-gray-500 mb-1">Total Holders</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {formatNumber(asset.holders?.totalHolders || 0)}
                  </div>
                </div>
                <div className="bg-purple-50 rounded-xl p-4">
                  <div className="text-xs text-purple-600 mb-1">Institutional</div>
                  <div className="text-2xl font-bold text-purple-900">
                    {formatNumber(asset.holders?.institutionalHolders || 0)}
                  </div>
                </div>
                <div className="bg-blue-50 rounded-xl p-4">
                  <div className="text-xs text-blue-600 mb-1">Retail</div>
                  <div className="text-2xl font-bold text-blue-900">
                    {formatNumber(asset.holders?.retailHolders || 0)}
                  </div>
                </div>
                <div className="bg-amber-50 rounded-xl p-4">
                  <div className="text-xs text-amber-600 mb-1">Top Holder %</div>
                  <div className="text-2xl font-bold text-amber-900">
                    {asset.holders?.topHolderPercentage || 0}%
                  </div>
                </div>
              </div>

              {/* Holder Distribution Chart Placeholder */}
              <div className="bg-gray-50 rounded-xl p-6 text-center">
                <PieChart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Holder distribution chart coming soon</p>
              </div>
            </div>
          )}

          {activeTab === 'compliance' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className={`rounded-xl p-4 ${asset.requiresKYC ? 'bg-green-50' : 'bg-gray-50'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {asset.requiresKYC ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-gray-400" />
                    )}
                    <span className="font-medium text-gray-900">KYC Verification</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {asset.requiresKYC ? 'Required for all investors' : 'Not required'}
                  </p>
                </div>
                <div className={`rounded-xl p-4 ${asset.enableClawback ? 'bg-amber-50' : 'bg-gray-50'}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {asset.enableClawback ? (
                      <Lock className="w-5 h-5 text-amber-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-gray-400" />
                    )}
                    <span className="font-medium text-gray-900">XLS-39D Clawback</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {asset.enableClawback ? 'Enabled with governance' : 'Disabled'}
                  </p>
                </div>
                <div className="bg-blue-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Globe className="w-5 h-5 text-blue-600" />
                    <span className="font-medium text-gray-900">Jurisdictions</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {asset.jurisdictions?.length ? asset.jurisdictions.join(', ') : 'No restrictions'}
                  </p>
                </div>
              </div>

              {asset.enableClawback && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <Gavel className="w-5 h-5 text-amber-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-amber-900">XAO-DOW Governance</h4>
                      <p className="text-sm text-amber-700 mt-1">
                        Clawback requires 72-hour comment period, 5-day voting, and Guardian Council approval.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// VIEW MODE TYPE
// ============================================================

type ViewMode = 'grid' | 'list';
type DashboardTab = 'marketplace' | 'portfolio' | 'dividends' | 'issuance' | 'whitelist' | 'compliance' | 'dex';

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function AssetsDashboard() {
  const { user } = useUser();
  const isDemo = true;
  
  // State
  const [activeTab, setActiveTab] = useState<DashboardTab>('marketplace');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<AssetType | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<AssetStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<'value' | 'yield' | 'holders' | 'recent'>('value');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<TokenizedAsset | null>(null);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [showTradeModal, setShowTradeModal] = useState(false);
  const [showIssuanceWizard, setShowIssuanceWizard] = useState(false);
  const [managingAsset, setManagingAsset] = useState<TokenizedAsset | null>(null);

  // Queries (disabled in demo mode)
  const { data: assetsData } = useQuery({
    queryKey: ['tokenizedAssets', selectedType, selectedStatus, sortBy],
    queryFn: () => assetsApi.getAssets({ 
      type: selectedType !== 'all' ? selectedType : undefined,
      status: selectedStatus !== 'all' ? selectedStatus : undefined,
    }),
    enabled: !isDemo,
  });

  const { data: portfolioData } = useQuery({
    queryKey: ['portfolio', user?.wallet],
    queryFn: () => assetsApi.getPortfolio(user?.wallet || ''),
    enabled: !isDemo && !!user?.wallet,
  });

  const { data: statsData } = useQuery({
    queryKey: ['platformStats'],
    queryFn: () => assetsApi.getPlatformStats(),
    enabled: !isDemo,
  });

  // Use demo data
  const assets = isDemo ? DEMO_ASSETS : (assetsData?.data || []);
  const portfolio = isDemo ? DEMO_PORTFOLIO : (portfolioData?.data || []);
  const stats = isDemo ? DEMO_STATS : (statsData?.data || {});
  const dividends = isDemo ? DEMO_DIVIDENDS : [];

  // Filter and sort assets
  const filteredAssets = useMemo(() => {
    let filtered = [...assets];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((asset: TokenizedAsset) => 
        asset.name.toLowerCase().includes(query) ||
        asset.symbol.toLowerCase().includes(query) ||
        asset.metadata?.description?.toLowerCase().includes(query)
      );
    }

    if (selectedType !== 'all') {
      filtered = filtered.filter((asset: TokenizedAsset) => asset.assetType === selectedType);
    }

    if (selectedStatus !== 'all') {
      filtered = filtered.filter((asset: TokenizedAsset) => asset.status === selectedStatus);
    }

    filtered.sort((a: TokenizedAsset, b: TokenizedAsset) => {
      switch (sortBy) {
        case 'value':
          return (b.financials?.totalValueUSD || 0) - (a.financials?.totalValueUSD || 0);
        case 'yield':
          return (b.financials?.dividendYield || 0) - (a.financials?.dividendYield || 0);
        case 'holders':
          return (b.holders?.totalHolders || 0) - (a.holders?.totalHolders || 0);
        case 'recent':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default:
          return 0;
      }
    });

    return filtered;
  }, [assets, searchQuery, selectedType, selectedStatus, sortBy]);

  // Calculate portfolio totals
  const portfolioTotals = useMemo(() => {
    return portfolio.reduce((acc: { totalValue: number; totalGain: number; totalDividends: number }, holding: PortfolioHolding) => ({
      totalValue: acc.totalValue + holding.currentValue,
      totalGain: acc.totalGain + holding.unrealizedGain,
      totalDividends: acc.totalDividends + holding.dividendsReceived,
    }), { totalValue: 0, totalGain: 0, totalDividends: 0 });
  }, [portfolio]);

  // Handle buy action
  const handleBuyAsset = useCallback((asset: TokenizedAsset) => {
    setSelectedAsset(asset);
    setShowPurchaseModal(true);
  }, []);

  // Handle trade action
  const handleTradeAsset = useCallback((asset: TokenizedAsset) => {
    setSelectedAsset(asset);
    setShowTradeModal(true);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Landmark className="w-7 h-7 text-indigo-600" />
                Tokenized Assets
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Real-world asset tokenization with XLS-39D compliance • $10 minimum investment
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              {isDemo && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span className="text-sm font-medium text-amber-700">Demo Mode</span>
                </div>
              )}
              <button 
                onClick={() => setShowIssuanceWizard(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Issue Asset
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 mt-6 border-b border-gray-200 -mb-px overflow-x-auto">
            {[
              { id: 'marketplace', label: 'Marketplace', icon: LayoutGrid },
              { id: 'portfolio', label: 'My Portfolio', icon: Wallet },
              { id: 'dividends', label: 'Dividends', icon: DollarSign },
              { id: 'dex', label: 'DEX Trading', icon: ArrowRightLeft },
              { id: 'whitelist', label: 'Whitelist', icon: Users },
              { id: 'compliance', label: 'Compliance', icon: Shield },
              { id: 'issuance', label: 'Issue Asset', icon: Plus },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as DashboardTab)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Platform Stats */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-white/70 text-xs font-medium mb-1">Total Value Locked</div>
              <div className="text-xl font-bold">{formatCurrency(stats.totalValueLocked || 0)}</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-white/70 text-xs font-medium mb-1">Assets Tokenized</div>
              <div className="text-xl font-bold">{stats.totalAssetsTokenized || 0}</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-white/70 text-xs font-medium mb-1">Total Holders</div>
              <div className="text-xl font-bold">{formatNumber(stats.totalHolders || 0)}</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-white/70 text-xs font-medium mb-1">Dividends Paid</div>
              <div className="text-xl font-bold">{formatCurrency(stats.totalDividendsPaid || 0)}</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-white/70 text-xs font-medium mb-1">Avg. Yield</div>
              <div className="text-xl font-bold">{(stats.averageDividendYield || 0).toFixed(2)}%</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-white/70 text-xs font-medium mb-1">Min Investment</div>
              <div className="text-xl font-bold">$10</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Marketplace Tab */}
        {activeTab === 'marketplace' && (
          <div className="space-y-6">
            {/* Search and Filters */}
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search assets..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-2 border border-gray-300 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded ${viewMode === 'grid' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-500'}`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded ${viewMode === 'list' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-500'}`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg ${showFilters ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-gray-300'}`}
                >
                  <Filter className="w-4 h-4" />
                  Filters
                </button>
              </div>

              {showFilters && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Asset Type</label>
                    <select
                      value={selectedType}
                      onChange={(e) => setSelectedType(e.target.value as AssetType | 'all')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="all">All Types</option>
                      {Object.entries(ASSET_TYPE_CONFIG).map(([type, config]) => (
                        <option key={type} value={type}>{config.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value as AssetStatus | 'all')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="all">All Statuses</option>
                      {Object.values(AssetStatus).map(status => (
                        <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    >
                      <option value="value">Total Value</option>
                      <option value="yield">Dividend Yield</option>
                      <option value="holders">Number of Holders</option>
                      <option value="recent">Most Recent</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Results Count */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Showing <span className="font-medium">{filteredAssets.length}</span> assets
              </p>
              <button className="flex items-center gap-1 text-sm text-indigo-600">
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>

            {/* Asset Grid */}
            <div className={viewMode === 'grid' 
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" 
              : "space-y-4"
            }>
              {filteredAssets.map((asset: TokenizedAsset) => {
                const typeConfig = ASSET_TYPE_CONFIG[asset.assetType];
                const TypeIcon = typeConfig?.icon || Coins;
                
                if (viewMode === 'list') {
                  return (
                    <div
                      key={asset.id}
                      className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-lg transition-all cursor-pointer"
                      onClick={() => setSelectedAsset(asset)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-xl ${typeConfig?.bgColor}`}>
                            <TypeIcon className={`w-6 h-6 ${typeConfig?.color}`} />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                              {asset.name}
                              {asset.isVerified && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                            </h3>
                            <span className="text-sm font-mono text-gray-500">{asset.symbol}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-8">
                          <div className="text-right">
                            <div className="text-lg font-bold text-gray-900">
                              ${asset.financials?.tokenPriceUSD?.toFixed(2)}
                            </div>
                            <PriceChange value={asset.financials?.priceChange24h || 0} />
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-gray-500">Market Cap</div>
                            <div className="font-semibold">{formatCurrency(asset.financials?.marketCapUSD || 0)}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-gray-500">Yield</div>
                            <div className="font-semibold text-green-600">{asset.financials?.dividendYield?.toFixed(2)}%</div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleBuyAsset(asset);
                            }}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                          >
                            Buy
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }
                
                return (
                  <div
                    key={asset.id}
                    className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all cursor-pointer group"
                  >
                    <div className="p-5 border-b border-gray-100" onClick={() => setSelectedAsset(asset)}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-xl ${typeConfig?.bgColor}`}>
                            <TypeIcon className={`w-6 h-6 ${typeConfig?.color}`} />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600">
                              {asset.name}
                            </h3>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-sm font-mono text-gray-500">{asset.symbol}</span>
                              {asset.isVerified && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                            </div>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600" />
                      </div>
                    </div>

                    <div className="p-5 space-y-4">
                      <div className="flex items-end justify-between">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Token Price</div>
                          <div className="text-xl font-bold text-gray-900">
                            ${asset.financials?.tokenPriceUSD?.toFixed(2) || '0.00'}
                          </div>
                        </div>
                        <PriceChange value={asset.financials?.priceChange24h || 0} />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="text-xs text-gray-500 mb-1">Market Cap</div>
                          <div className="font-semibold text-gray-900">
                            {formatCurrency(asset.financials?.marketCapUSD || 0)}
                          </div>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-3">
                          <div className="text-xs text-gray-500 mb-1">Dividend Yield</div>
                          <div className="font-semibold text-green-600">
                            {asset.financials?.dividendYield?.toFixed(2) || '0.00'}%
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <StatusBadge status={asset.status} />
                        <StatusBadge status={asset.complianceStatus} />
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBuyAsset(asset);
                          }}
                          className="flex-1 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-1"
                        >
                          <ShoppingCart className="w-4 h-4" />
                          Buy
                        </button>
                        {asset.tradingInfo?.tradingEnabled && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTradeAsset(asset);
                            }}
                            className="flex-1 py-2 border border-indigo-600 text-indigo-600 text-sm font-medium rounded-lg hover:bg-indigo-50 flex items-center justify-center gap-1"
                          >
                            <ArrowRightLeft className="w-4 h-4" />
                            Trade
                          </button>
                        )}
                      </div>
                    </div>

                    <div className={`px-5 py-3 ${asset.tradingInfo?.tradingEnabled ? 'bg-green-50' : 'bg-gray-50'}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {asset.tradingInfo?.tradingEnabled ? (
                            <>
                              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                              <span className="text-xs font-medium text-green-700">Trading Active</span>
                            </>
                          ) : (
                            <>
                              <div className="w-2 h-2 rounded-full bg-gray-400" />
                              <span className="text-xs font-medium text-gray-500">Trading Disabled</span>
                            </>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          Min: $10 (~{asset.tradingInfo?.minOrderSize} {asset.symbol})
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Portfolio Tab */}
        {activeTab === 'portfolio' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <Wallet className="w-5 h-5 text-indigo-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-500">Total Value</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatCurrency(portfolioTotals.totalValue)}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`p-2 rounded-lg ${portfolioTotals.totalGain >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                    {portfolioTotals.totalGain >= 0 ? (
                      <TrendingUp className="w-5 h-5 text-green-600" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                  <span className="text-sm font-medium text-gray-500">Unrealized P/L</span>
                </div>
                <div className={`text-2xl font-bold ${portfolioTotals.totalGain >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {portfolioTotals.totalGain >= 0 ? '+' : ''}{formatCurrency(portfolioTotals.totalGain)}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <DollarSign className="w-5 h-5 text-green-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-500">Dividends Received</span>
                </div>
                <div className="text-2xl font-bold text-green-600">
                  +{formatCurrency(portfolioTotals.totalDividends)}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <PieChart className="w-5 h-5 text-purple-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-500">Holdings</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {portfolio.length} Assets
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">My Holdings</h2>
              </div>
              <div className="divide-y divide-gray-200">
                {portfolio.map((holding: PortfolioHolding) => {
                  const asset = holding.asset;
                  const typeConfig = asset ? ASSET_TYPE_CONFIG[asset.assetType] : null;
                  const TypeIcon = typeConfig?.icon || Coins;
                  
                  return (
                    <div 
                      key={holding.assetId} 
                      className="p-6 hover:bg-gray-50 cursor-pointer"
                      onClick={() => asset && setSelectedAsset(asset)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`p-3 rounded-xl ${typeConfig?.bgColor || 'bg-gray-100'}`}>
                            <TypeIcon className={`w-6 h-6 ${typeConfig?.color || 'text-gray-600'}`} />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                              {asset?.name || 'Unknown Asset'}
                              {asset?.isVerified && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                            </h3>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-sm text-gray-500 font-mono">{asset?.symbol}</span>
                              <span className="text-sm text-gray-500">
                                Balance: <span className="font-medium text-gray-700">{formatNumber(Number(holding.balance))}</span>
                              </span>
                              {holding.lockedBalance !== '0' && (
                                <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded">
                                  {holding.lockedBalance} locked
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-gray-900">
                            {formatCurrency(holding.currentValue)}
                          </div>
                          <div className={`flex items-center justify-end gap-1 mt-1 ${
                            holding.unrealizedGain >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {holding.unrealizedGain >= 0 ? (
                              <ArrowUpRight className="w-4 h-4" />
                            ) : (
                              <ArrowDownRight className="w-4 h-4" />
                            )}
                            <span className="text-sm font-medium">
                              {holding.unrealizedGain >= 0 ? '+' : ''}{formatCurrency(holding.unrealizedGain)}
                              ({holding.unrealizedGainPercent.toFixed(2)}%)
                            </span>
                          </div>
                          {holding.dividendsReceived > 0 && (
                            <div className="text-sm text-green-600 mt-1">
                              +{formatCurrency(holding.dividendsReceived)} dividends
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Dividends Tab */}
        {activeTab === 'dividends' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <DollarSign className="w-5 h-5 text-green-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-500">Total Received</span>
                </div>
                <div className="text-2xl font-bold text-green-600">
                  +{formatCurrency(portfolioTotals.totalDividends)}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Calendar className="w-5 h-5 text-blue-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-500">Upcoming Payments</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {dividends.filter((d: DividendDistribution) => d.status === 'SCHEDULED').length}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Percent className="w-5 h-5 text-purple-600" />
                  </div>
                  <span className="text-sm font-medium text-gray-500">Avg Portfolio Yield</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {portfolioTotals.totalValue > 0 
                    ? ((portfolioTotals.totalDividends / portfolioTotals.totalValue) * 100).toFixed(2)
                    : '0.00'}%
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Dividend Schedule</h2>
              </div>
              <div className="divide-y divide-gray-200">
                {dividends.map((dividend: DividendDistribution) => {
                  const asset = assets.find((a: TokenizedAsset) => a.id === dividend.assetId);
                  
                  return (
                    <div key={dividend.id} className="p-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900">{asset?.name || 'Unknown Asset'}</h3>
                          <div className="flex items-center gap-4 mt-2">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              dividend.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                              dividend.status === 'SCHEDULED' ? 'bg-blue-100 text-blue-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {dividend.status}
                            </span>
                            <span className="text-sm text-gray-500">{dividend.dividendType} Dividend</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-green-600">
                            {formatNumber(Number(dividend.totalAmount))} {dividend.currency}
                          </div>
                          <div className="text-sm text-gray-500 mt-1">
                            {dividend.amountPerToken} per token
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Record Date</div>
                          <div className="font-medium text-gray-900">
                            {new Date(dividend.recordDate).toLocaleDateString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Payment Date</div>
                          <div className="font-medium text-gray-900">
                            {new Date(dividend.paymentDate).toLocaleDateString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Eligible Holders</div>
                          <div className="font-medium text-gray-900">
                            {formatNumber(dividend.eligibleHolders)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Tax Withholding</div>
                          <div className="font-medium text-gray-900">
                            {((dividend.taxWithholdingRate || 0) * 100).toFixed(0)}%
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* DEX Trading Tab */}
        {activeTab === 'dex' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-8 text-white">
              <h2 className="text-2xl font-bold mb-2 flex items-center gap-3">
                <ArrowRightLeft className="w-8 h-8" />
                XRPL DEX Secondary Market
              </h2>
              <p className="text-indigo-100 max-w-2xl">
                Trade tokenized assets directly on the XRPL decentralized exchange with deep liquidity and low fees.
                Minimum trade: $10.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {assets.filter((a: TokenizedAsset) => a.tradingInfo?.tradingEnabled).map((asset: TokenizedAsset) => {
                const typeConfig = ASSET_TYPE_CONFIG[asset.assetType];
                const TypeIcon = typeConfig?.icon || Coins;
                
                return (
                  <div key={asset.id} className="bg-white rounded-xl border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${typeConfig?.bgColor}`}>
                          <TypeIcon className={`w-5 h-5 ${typeConfig?.color}`} />
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">{asset.tradingInfo?.tradingPair}</div>
                          <div className="text-xs text-gray-500">{asset.name}</div>
                        </div>
                      </div>
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    </div>
                    
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Last Price</span>
                        <span className="font-bold">${asset.financials?.tokenPriceUSD?.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">24h Change</span>
                        <PriceChange value={asset.financials?.priceChange24h || 0} />
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">24h Volume</span>
                        <span className="font-medium">{formatCurrency(asset.financials?.volume24hUSD || 0)}</span>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleTradeAsset(asset)}
                      className="w-full mt-4 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2"
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                      Trade
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Whitelist Management Tab */}
        {activeTab === 'whitelist' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Select Asset to Manage Whitelist</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {assets.filter((a: TokenizedAsset) => a.requiresKYC).map((asset: TokenizedAsset) => (
                  <button
                    key={asset.id}
                    onClick={() => setManagingAsset(asset)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      managingAsset?.id === asset.id 
                        ? 'border-indigo-500 bg-indigo-50' 
                        : 'border-gray-200 hover:border-indigo-300'
                    }`}
                  >
                    <div className="font-semibold text-gray-900">{asset.name}</div>
                    <div className="text-sm text-gray-500">{asset.symbol}</div>
                    <div className="text-xs text-gray-400 mt-2">
                      {asset.holders?.totalHolders || 0} holders
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            {managingAsset && (
              <WhitelistManager asset={managingAsset} isDemo={isDemo} />
            )}
          </div>
        )}

        {/* Compliance Tab */}
        {activeTab === 'compliance' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Select Asset to View Compliance</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {assets.map((asset: TokenizedAsset) => (
                  <button
                    key={asset.id}
                    onClick={() => setManagingAsset(asset)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      managingAsset?.id === asset.id 
                        ? 'border-indigo-500 bg-indigo-50' 
                        : 'border-gray-200 hover:border-indigo-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold text-gray-900">{asset.name}</div>
                      <StatusBadge status={asset.complianceStatus} />
                    </div>
                    <div className="text-sm text-gray-500">{asset.symbol}</div>
                    <div className="flex items-center gap-2 mt-2">
                      {asset.enableClawback && (
                        <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded">XLS-39D</span>
                      )}
                      {asset.requiresKYC && (
                        <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">KYC</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            
            {managingAsset && (
              <ComplianceDisplay asset={managingAsset} isDemo={isDemo} />
            )}
          </div>
        )}

        {/* Issue Asset Tab */}
        {activeTab === 'issuance' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-8 text-white">
              <h2 className="text-2xl font-bold mb-2">Tokenize Real-World Assets</h2>
              <p className="text-indigo-100 max-w-2xl">
                Launch your own tokenized asset on XRPL with built-in compliance, investor whitelisting, 
                and automated dividend distribution. Starting at just 0.25% tokenization fee.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { type: AssetType.REAL_ESTATE, title: 'Real Estate', desc: 'Tokenize properties and REITs', icon: Building2, color: 'blue' },
                { type: AssetType.PRIVATE_EQUITY, title: 'Private Equity', desc: 'Company shares and funds', icon: Briefcase, color: 'purple' },
                { type: AssetType.SECURITY, title: 'Securities', desc: 'Bonds and regulated instruments', icon: Landmark, color: 'green' },
                { type: AssetType.COMMUNITY, title: 'Community Token', desc: 'Governance and utility tokens', icon: Users, color: 'orange' },
              ].map(option => (
                <div 
                  key={option.type} 
                  className="bg-white border-2 border-gray-200 rounded-xl p-6 hover:border-indigo-500 cursor-pointer transition-all"
                  onClick={() => setShowIssuanceWizard(true)}
                >
                  <div className={`inline-flex p-3 rounded-xl mb-4 bg-${option.color}-100`}>
                    <option.icon className={`w-6 h-6 text-${option.color}-600`} />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{option.title}</h3>
                  <p className="text-sm text-gray-600 mb-4">{option.desc}</p>
                  <button className="w-full py-2 rounded-lg font-medium text-indigo-600 border border-indigo-200 hover:bg-indigo-50">
                    Start Issuance
                  </button>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-indigo-600" />
                Fee Structure
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-indigo-600 mb-1">0.25%</div>
                  <div className="text-sm font-medium text-gray-900">Tokenization Fee</div>
                  <div className="text-xs text-gray-500 mt-1">Min $100 - Max $25,000</div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-indigo-600 mb-1">0.1%</div>
                  <div className="text-sm font-medium text-gray-900">Trading Fee</div>
                  <div className="text-xs text-gray-500 mt-1">Secondary market trades</div>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-indigo-600 mb-1">0.05%</div>
                  <div className="text-sm font-medium text-gray-900">Dividend Processing</div>
                  <div className="text-xs text-gray-500 mt-1">Per distribution event</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {selectedAsset && !showPurchaseModal && !showTradeModal && (
        <AssetDetailModal
          asset={selectedAsset}
          onClose={() => setSelectedAsset(null)}
          onBuy={() => setShowPurchaseModal(true)}
          onTrade={() => setShowTradeModal(true)}
        />
      )}

      {showPurchaseModal && selectedAsset && (
        <FractionalPurchaseInterface
          asset={selectedAsset}
          onClose={() => {
            setShowPurchaseModal(false);
            setSelectedAsset(null);
          }}
        />
      )}

      {showTradeModal && selectedAsset && (
        <DEXTradingInterface
          asset={selectedAsset}
          onClose={() => {
            setShowTradeModal(false);
            setSelectedAsset(null);
          }}
        />
      )}

      {showIssuanceWizard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            <IssuanceWizard 
              onComplete={(assetId) => {
                console.log('Asset created:', assetId);
                setShowIssuanceWizard(false);
              }}
              onCancel={() => setShowIssuanceWizard(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
