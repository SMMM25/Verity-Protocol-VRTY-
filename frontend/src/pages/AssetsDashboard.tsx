import { useState, useMemo } from 'react';
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
  ExternalLink,
  Percent,
  DollarSign,
  Landmark,
  FileCheck,
  Globe,
  Lock,
  PieChart,
  Activity,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Eye,
  FileText,
  Calendar,
  MapPin,
  Star,
  Layers,
} from 'lucide-react';
import type {
  TokenizedAsset,
  PortfolioHolding,
  DividendDistribution,
} from '../types/assets';
import { AssetType, AssetStatus, ComplianceStatus } from '../types/assets';

// Demo data for showcase mode
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
      description: 'Premium Class A office tower in Manhattan Financial District. 45-story building with 1.2M sq ft of leasable space.',
      website: 'https://manhattantower.example.com',
      images: ['/assets/manhattan-tower.jpg'],
      documents: [
        { name: 'Title Deed', hash: '0x123...abc', type: 'legal', uploadedAt: '2025-06-01T00:00:00Z' },
        { name: 'Appraisal Report', hash: '0x456...def', type: 'valuation', uploadedAt: '2025-06-01T00:00:00Z' },
      ],
    },
    propertyDetails: {
      address: '100 Wall Street, New York, NY 10005',
      propertyType: 'Commercial Office',
      squareFootage: 1200000,
      yearBuilt: 2018,
      occupancyRate: 94.5,
      annualRentIncome: 85000000,
      propertyManagement: 'Verity Property Management LLC',
      legalEntity: 'Manhattan Tower Holdings LLC',
      insurance: {
        provider: 'Lloyd\'s of London',
        coverage: 500000000,
        expiresAt: '2027-06-15T00:00:00Z',
      },
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
      minOrderSize: '10',
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
      website: 'https://techventures.example.com',
      documents: [
        { name: 'PPM', hash: '0x789...ghi', type: 'legal', uploadedAt: '2025-08-15T00:00:00Z' },
        { name: 'Financial Statements', hash: '0xabc...jkl', type: 'financial', uploadedAt: '2025-12-31T00:00:00Z' },
      ],
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
      minOrderSize: '100',
      maxOrderSize: '50000',
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
      description: 'Investment-grade green bond financing renewable energy infrastructure projects globally. AA rated by major agencies.',
      website: 'https://greenenergybond.example.com',
      documents: [
        { name: 'Bond Prospectus', hash: '0xdef...mno', type: 'legal', uploadedAt: '2025-02-20T00:00:00Z' },
        { name: 'Green Bond Framework', hash: '0xpqr...stu', type: 'compliance', uploadedAt: '2025-02-20T00:00:00Z' },
      ],
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
      minOrderSize: '100',
      maxOrderSize: '1000000',
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
      description: 'Community governance token for the Verity ecosystem. Enables participation in platform decisions.',
      website: 'https://community.verityprotocol.io',
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
      minOrderSize: '1000',
      maxOrderSize: '10000000',
      tradingEnabled: true,
    },
  },
  {
    id: 'asset_005',
    name: 'Miami Beach Resort',
    symbol: 'MBR',
    issuer: 'rBeHfq9vRjZ8Cth1sMbp2nJvExmxSxAH8f',
    totalSupply: '2000000',
    circulatingSupply: '1800000',
    decimals: 6,
    assetType: AssetType.REAL_ESTATE,
    status: AssetStatus.PENDING,
    complianceStatus: ComplianceStatus.UNDER_REVIEW,
    isVerified: false,
    requiresKYC: true,
    enableClawback: true,
    jurisdictions: ['US'],
    createdAt: '2026-01-10T00:00:00Z',
    updatedAt: '2026-01-14T00:00:00Z',
    metadata: {
      description: 'Luxury beachfront resort in Miami Beach with 300 rooms and world-class amenities. Currently in compliance review.',
      website: 'https://miamibeachresort.example.com',
    },
    propertyDetails: {
      address: '4525 Collins Avenue, Miami Beach, FL 33140',
      propertyType: 'Hospitality',
      squareFootage: 450000,
      yearBuilt: 2022,
      occupancyRate: 78.5,
      annualRentIncome: 28000000,
      propertyManagement: 'Verity Hospitality Group',
      legalEntity: 'Miami Beach Resort Holdings LLC',
    },
    financials: {
      totalValueUSD: 180000000,
      tokenPriceUSD: 90.0,
      priceChange24h: 0,
      priceChange7d: 0,
      volume24hUSD: 0,
      marketCapUSD: 162000000,
      dividendYield: 6.2,
      totalDividendsPaid: 0,
    },
    holders: {
      totalHolders: 0,
      institutionalHolders: 0,
      retailHolders: 0,
      topHolderPercentage: 0,
    },
    tradingInfo: {
      isListedOnDEX: false,
      tradingEnabled: false,
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
    assetId: 'asset_003',
    asset: DEMO_ASSETS[2],
    balance: '50000',
    lockedBalance: '0',
    availableBalance: '50000',
    costBasis: 0.98,
    currentValue: 50000,
    unrealizedGain: 1000,
    unrealizedGainPercent: 2.04,
    dividendsReceived: 2125,
    acquisitionDate: '2025-06-01T00:00:00Z',
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
];

const DEMO_STATS = {
  totalAssetsTokenized: 5,
  totalValueLocked: 857250000,
  totalHolders: 19870,
  totalDividendsPaid: 29712500,
  platformFeeCollected: 2143125,
  averageDividendYield: 4.06,
};

// Asset type configuration
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

// Status badge component
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

// Format currency
function formatCurrency(value: number, decimals: number = 0): string {
  if (value >= 1000000000) return `$${(value / 1000000000).toFixed(2)}B`;
  if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(decimals > 0 ? 1 : 0)}K`;
  return `$${value.toFixed(decimals)}`;
}

// Format number with commas
function formatNumber(value: number): string {
  return value.toLocaleString('en-US');
}

// Price change component
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

// View mode type
type ViewMode = 'grid' | 'list';
type DashboardTab = 'marketplace' | 'portfolio' | 'dividends' | 'issuance';

export default function AssetsDashboard() {
  const { user } = useUser();
  const isDemo = true; // Demo mode active
  
  // State
  const [activeTab, setActiveTab] = useState<DashboardTab>('marketplace');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<AssetType | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<AssetStatus | 'all'>('all');
  const [sortBy, setSortBy] = useState<'value' | 'yield' | 'holders' | 'recent'>('value');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<TokenizedAsset | null>(null);

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
  const assets: TokenizedAsset[] = isDemo ? DEMO_ASSETS : (assetsData?.data || []);
  const portfolio: PortfolioHolding[] = isDemo ? DEMO_PORTFOLIO : (portfolioData?.data || []);
  const stats = isDemo ? DEMO_STATS : (statsData?.data || {});
  const dividends: DividendDistribution[] = isDemo ? DEMO_DIVIDENDS : [];

  // Filter and sort assets
  const filteredAssets = useMemo((): TokenizedAsset[] => {
    let filtered: TokenizedAsset[] = assets;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(asset => 
        asset.name.toLowerCase().includes(query) ||
        asset.symbol.toLowerCase().includes(query) ||
        asset.metadata?.description?.toLowerCase().includes(query)
      );
    }

    // Type filter
    if (selectedType !== 'all') {
      filtered = filtered.filter(asset => asset.assetType === selectedType);
    }

    // Status filter
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(asset => asset.status === selectedStatus);
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
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
                Real-world asset tokenization with XLS-39D compliance
              </p>
            </div>
            
            {isDemo && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-700">Demo Mode</span>
              </div>
            )}
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-1 mt-6 border-b border-gray-200 -mb-px">
            {[
              { id: 'marketplace', label: 'Marketplace', icon: LayoutGrid },
              { id: 'portfolio', label: 'My Portfolio', icon: Wallet },
              { id: 'dividends', label: 'Dividends', icon: DollarSign },
              { id: 'issuance', label: 'Issue Asset', icon: Plus },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as DashboardTab)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
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
              <div className="text-white/70 text-xs font-medium mb-1">Platform Fee (0.25%)</div>
              <div className="text-xl font-bold">{formatCurrency(stats.platformFeeCollected || 0)}</div>
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
                {/* Search */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search assets by name, symbol, or description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                {/* View Toggle */}
                <div className="flex items-center gap-2 border border-gray-300 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded ${viewMode === 'grid' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-500 hover:bg-gray-100'}`}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded ${viewMode === 'list' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-500 hover:bg-gray-100'}`}
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>

                {/* Filter Toggle */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg transition-colors ${
                    showFilters ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  Filters
                </button>
              </div>

              {/* Expanded Filters */}
              {showFilters && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Asset Type</label>
                    <select
                      value={selectedType}
                      onChange={(e) => setSelectedType(e.target.value as AssetType | 'all')}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
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
              <button className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700">
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>

            {/* Asset Grid/List */}
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredAssets.map(asset => {
                  const typeConfig = ASSET_TYPE_CONFIG[asset.assetType];
                  const TypeIcon = typeConfig?.icon || Coins;
                  
                  return (
                    <div
                      key={asset.id}
                      onClick={() => setSelectedAsset(asset)}
                      className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-all cursor-pointer group"
                    >
                      {/* Asset Header */}
                      <div className="p-5 border-b border-gray-100">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl ${typeConfig?.bgColor || 'bg-gray-100'}`}>
                              <TypeIcon className={`w-6 h-6 ${typeConfig?.color || 'text-gray-600'}`} />
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                                {asset.name}
                              </h3>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-sm font-mono text-gray-500">{asset.symbol}</span>
                                {asset.isVerified && (
                                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                                )}
                              </div>
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 transition-colors" />
                        </div>
                      </div>

                      {/* Asset Body */}
                      <div className="p-5 space-y-4">
                        {/* Price & Change */}
                        <div className="flex items-end justify-between">
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Token Price</div>
                            <div className="text-xl font-bold text-gray-900">
                              ${asset.financials?.tokenPriceUSD?.toFixed(2) || '0.00'}
                            </div>
                          </div>
                          <PriceChange value={asset.financials?.priceChange24h || 0} />
                        </div>

                        {/* Metrics Grid */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="text-xs text-gray-500 mb-1">Market Cap</div>
                            <div className="font-semibold text-gray-900">
                              {formatCurrency(asset.financials?.marketCapUSD || 0)}
                            </div>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="text-xs text-gray-500 mb-1">Dividend Yield</div>
                            <div className="font-semibold text-gray-900">
                              {asset.financials?.dividendYield?.toFixed(2) || '0.00'}%
                            </div>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="text-xs text-gray-500 mb-1">Holders</div>
                            <div className="font-semibold text-gray-900">
                              {formatNumber(asset.holders?.totalHolders || 0)}
                            </div>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <div className="text-xs text-gray-500 mb-1">24h Volume</div>
                            <div className="font-semibold text-gray-900">
                              {formatCurrency(asset.financials?.volume24hUSD || 0)}
                            </div>
                          </div>
                        </div>

                        {/* Status & Compliance */}
                        <div className="flex items-center gap-2 pt-2">
                          <StatusBadge status={asset.status} />
                          <StatusBadge status={asset.complianceStatus} />
                        </div>

                        {/* Jurisdictions */}
                        {asset.jurisdictions && asset.jurisdictions.length > 0 && (
                          <div className="flex items-center gap-1.5 pt-1">
                            <Globe className="w-4 h-4 text-gray-400" />
                            <span className="text-xs text-gray-500">
                              {asset.jurisdictions.slice(0, 4).join(', ')}
                              {asset.jurisdictions.length > 4 && ` +${asset.jurisdictions.length - 4}`}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Trading Status Footer */}
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
                          {asset.requiresKYC && (
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <Shield className="w-3.5 h-3.5" />
                              KYC Required
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* List View */
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Asset</th>
                      <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="text-right px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                      <th className="text-right px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">24h</th>
                      <th className="text-right px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Market Cap</th>
                      <th className="text-right px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Yield</th>
                      <th className="text-right px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Holders</th>
                      <th className="text-center px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredAssets.map(asset => {
                      const typeConfig = ASSET_TYPE_CONFIG[asset.assetType];
                      const TypeIcon = typeConfig?.icon || Coins;
                      
                      return (
                        <tr
                          key={asset.id}
                          onClick={() => setSelectedAsset(asset)}
                          className="hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg ${typeConfig?.bgColor || 'bg-gray-100'}`}>
                                <TypeIcon className={`w-5 h-5 ${typeConfig?.color || 'text-gray-600'}`} />
                              </div>
                              <div>
                                <div className="font-medium text-gray-900 flex items-center gap-1.5">
                                  {asset.name}
                                  {asset.isVerified && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                                </div>
                                <div className="text-sm text-gray-500 font-mono">{asset.symbol}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${typeConfig?.bgColor} ${typeConfig?.color}`}>
                              {typeConfig?.label || asset.assetType}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right font-medium text-gray-900">
                            ${asset.financials?.tokenPriceUSD?.toFixed(2) || '0.00'}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <PriceChange value={asset.financials?.priceChange24h || 0} />
                          </td>
                          <td className="px-6 py-4 text-right font-medium text-gray-900">
                            {formatCurrency(asset.financials?.marketCapUSD || 0)}
                          </td>
                          <td className="px-6 py-4 text-right font-medium text-gray-900">
                            {asset.financials?.dividendYield?.toFixed(2) || '0.00'}%
                          </td>
                          <td className="px-6 py-4 text-right text-gray-700">
                            {formatNumber(asset.holders?.totalHolders || 0)}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <StatusBadge status={asset.status} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Portfolio Tab */}
        {activeTab === 'portfolio' && (
          <div className="space-y-6">
            {/* Portfolio Summary Cards */}
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

            {/* Holdings List */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">My Holdings</h2>
              </div>
              <div className="divide-y divide-gray-200">
                {portfolio.map(holding => {
                  const asset = holding.asset;
                  const typeConfig = asset ? ASSET_TYPE_CONFIG[asset.assetType] : null;
                  const TypeIcon = typeConfig?.icon || Coins;
                  
                  return (
                    <div
                      key={holding.assetId}
                      className="p-6 hover:bg-gray-50 transition-colors cursor-pointer"
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
                              {Number(holding.lockedBalance) > 0 && (
                                <span className="flex items-center gap-1 text-sm text-amber-600">
                                  <Lock className="w-3.5 h-3.5" />
                                  {formatNumber(Number(holding.lockedBalance))} locked
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
                        </div>
                      </div>

                      {/* Additional Details */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Cost Basis</div>
                          <div className="font-medium text-gray-900">${holding.costBasis.toFixed(2)}/token</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Current Price</div>
                          <div className="font-medium text-gray-900">${asset?.financials?.tokenPriceUSD?.toFixed(2)}/token</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Dividends Received</div>
                          <div className="font-medium text-green-600">+{formatCurrency(holding.dividendsReceived)}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500 mb-1">Acquired</div>
                          <div className="font-medium text-gray-900">
                            {new Date(holding.acquisitionDate).toLocaleDateString()}
                          </div>
                        </div>
                      </div>

                      {/* Vesting Info */}
                      {holding.vestingInfo && (
                        <div className="mt-4 p-3 bg-indigo-50 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-indigo-600" />
                              <span className="text-sm font-medium text-indigo-900">Vesting Schedule</span>
                            </div>
                            <div className="text-sm text-indigo-700">
                              {formatNumber(Number(holding.vestingInfo.vestedAmount))} / {formatNumber(Number(holding.vestingInfo.totalVesting))} vested
                            </div>
                          </div>
                          <div className="mt-2">
                            <div className="w-full bg-indigo-200 rounded-full h-2">
                              <div
                                className="bg-indigo-600 h-2 rounded-full"
                                style={{ width: `${(Number(holding.vestingInfo.vestedAmount) / Number(holding.vestingInfo.totalVesting)) * 100}%` }}
                              />
                            </div>
                          </div>
                          <div className="mt-2 text-xs text-indigo-600">
                            Next vest: {formatNumber(Number(holding.vestingInfo.nextVestingAmount))} tokens on {new Date(holding.vestingInfo.nextVestingDate).toLocaleDateString()}
                          </div>
                        </div>
                      )}
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
            {/* Dividend Summary */}
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
                  {dividends.filter(d => d.status === 'SCHEDULED').length}
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

            {/* Dividend Schedule */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Dividend Schedule</h2>
                <span className="text-sm text-gray-500">All platforms dividends</span>
              </div>
              <div className="divide-y divide-gray-200">
                {dividends.map(dividend => {
                  const asset = assets.find(a => a.id === dividend.assetId);
                  
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
                            <span className="text-sm text-gray-500">
                              {dividend.dividendType} Dividend
                            </span>
                            <span className="text-sm text-gray-500">
                              {formatNumber(dividend.eligibleHolders)} eligible holders
                            </span>
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
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100">
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
                          <div className="text-xs text-gray-500 mb-1">Eligible Tokens</div>
                          <div className="font-medium text-gray-900">
                            {formatNumber(Number(dividend.totalEligibleTokens))}
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

        {/* Issue Asset Tab */}
        {activeTab === 'issuance' && (
          <div className="space-y-6">
            {/* Issuance Header */}
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-8 text-white">
              <h2 className="text-2xl font-bold mb-2">Tokenize Real-World Assets</h2>
              <p className="text-indigo-100 max-w-2xl">
                Launch your own tokenized asset on XRPL with built-in compliance, investor whitelisting, 
                and automated dividend distribution. Starting at just 0.25% tokenization fee.
              </p>
            </div>

            {/* Asset Type Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                {
                  type: AssetType.REAL_ESTATE,
                  title: 'Real Estate',
                  description: 'Tokenize properties, REITs, and real estate funds',
                  features: ['Fractional ownership', 'Rental income distribution', 'Property management'],
                  icon: Building2,
                  color: 'blue',
                },
                {
                  type: AssetType.PRIVATE_EQUITY,
                  title: 'Private Equity',
                  description: 'Tokenize company shares and investment funds',
                  features: ['Equity representation', 'Cap table management', 'Exit proceeds'],
                  icon: Briefcase,
                  color: 'purple',
                },
                {
                  type: AssetType.SECURITY,
                  title: 'Securities',
                  description: 'Bonds, notes, and regulated securities',
                  features: ['Coupon payments', 'Maturity tracking', 'Rating integration'],
                  icon: Landmark,
                  color: 'green',
                },
                {
                  type: AssetType.COMMUNITY,
                  title: 'Community Token',
                  description: 'Governance and utility tokens',
                  features: ['No KYC required', 'Governance voting', 'Utility features'],
                  icon: Users,
                  color: 'orange',
                },
              ].map(option => {
                const colorClasses = {
                  blue: { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-600', iconBg: 'bg-blue-100' },
                  purple: { bg: 'bg-purple-50', border: 'border-purple-200', icon: 'text-purple-600', iconBg: 'bg-purple-100' },
                  green: { bg: 'bg-green-50', border: 'border-green-200', icon: 'text-green-600', iconBg: 'bg-green-100' },
                  orange: { bg: 'bg-orange-50', border: 'border-orange-200', icon: 'text-orange-600', iconBg: 'bg-orange-100' },
                };
                const colors = colorClasses[option.color as keyof typeof colorClasses];
                
                return (
                  <div
                    key={option.type}
                    className={`${colors.bg} border-2 ${colors.border} rounded-xl p-6 cursor-pointer hover:shadow-lg transition-all`}
                  >
                    <div className={`inline-flex p-3 ${colors.iconBg} rounded-xl mb-4`}>
                      <option.icon className={`w-6 h-6 ${colors.icon}`} />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{option.title}</h3>
                    <p className="text-sm text-gray-600 mb-4">{option.description}</p>
                    <ul className="space-y-2">
                      {option.features.map((feature, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-sm text-gray-700">
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <button className={`mt-4 w-full py-2 rounded-lg font-medium ${colors.icon} ${colors.bg} border ${colors.border} hover:opacity-80`}>
                      Start Issuance
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Fee Structure */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-indigo-600" />
                Fee Structure
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="text-2xl font-bold text-indigo-600 mb-1">0.25%</div>
                  <div className="text-sm font-medium text-gray-900">Tokenization Fee</div>
                  <div className="text-xs text-gray-500 mt-1">Min $100 • Max $25,000</div>
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
              <div className="mt-4 p-4 bg-indigo-50 rounded-lg">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-indigo-600 mt-0.5" />
                  <div>
                    <div className="font-medium text-indigo-900">XLS-39D Compliance Included</div>
                    <div className="text-sm text-indigo-700 mt-1">
                      All tokenized assets include clawback capability for regulatory compliance, 
                      governance-approved recovery mechanisms, and full audit trail.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Compliance Requirements */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-indigo-600" />
                Compliance Requirements
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Required Documents</h4>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-sm text-gray-700">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      Legal opinion letter
                    </li>
                    <li className="flex items-center gap-2 text-sm text-gray-700">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      Asset ownership documentation
                    </li>
                    <li className="flex items-center gap-2 text-sm text-gray-700">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      Third-party valuation report
                    </li>
                    <li className="flex items-center gap-2 text-sm text-gray-700">
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      Insurance documentation (if applicable)
                    </li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-3">Supported Jurisdictions</h4>
                  <div className="flex flex-wrap gap-2">
                    {['US', 'EU', 'UK', 'SG', 'JP', 'AU', 'CA', 'CH'].map(code => (
                      <span key={code} className="px-3 py-1 bg-gray-100 rounded-full text-sm font-medium text-gray-700">
                        {code}
                      </span>
                    ))}
                    <span className="px-3 py-1 bg-indigo-100 rounded-full text-sm font-medium text-indigo-700">
                      +200 more
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Asset Detail Modal */}
      {selectedAsset && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl ${ASSET_TYPE_CONFIG[selectedAsset.assetType]?.bgColor}`}>
                  {(() => {
                    const Icon = ASSET_TYPE_CONFIG[selectedAsset.assetType]?.icon || Coins;
                    return <Icon className={`w-6 h-6 ${ASSET_TYPE_CONFIG[selectedAsset.assetType]?.color}`} />;
                  })()}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    {selectedAsset.name}
                    {selectedAsset.isVerified && <CheckCircle2 className="w-5 h-5 text-green-500" />}
                  </h2>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-sm font-mono text-gray-500">{selectedAsset.symbol}</span>
                    <StatusBadge status={selectedAsset.status} />
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedAsset(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <XCircle className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6">
              {/* Description */}
              {selectedAsset.metadata?.description && (
                <div>
                  <p className="text-gray-600">{selectedAsset.metadata.description}</p>
                </div>
              )}

              {/* Key Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-xs text-gray-500 mb-1">Token Price</div>
                  <div className="text-xl font-bold text-gray-900">
                    ${selectedAsset.financials?.tokenPriceUSD?.toFixed(2)}
                  </div>
                  <PriceChange value={selectedAsset.financials?.priceChange24h || 0} />
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-xs text-gray-500 mb-1">Market Cap</div>
                  <div className="text-xl font-bold text-gray-900">
                    {formatCurrency(selectedAsset.financials?.marketCapUSD || 0)}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-xs text-gray-500 mb-1">Dividend Yield</div>
                  <div className="text-xl font-bold text-green-600">
                    {selectedAsset.financials?.dividendYield?.toFixed(2)}%
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-xs text-gray-500 mb-1">Total Holders</div>
                  <div className="text-xl font-bold text-gray-900">
                    {formatNumber(selectedAsset.holders?.totalHolders || 0)}
                  </div>
                </div>
              </div>

              {/* Property Details (for Real Estate) */}
              {selectedAsset.propertyDetails && (
                <div className="bg-blue-50 rounded-xl p-6">
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-blue-600" />
                    Property Details
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Address</div>
                      <div className="font-medium text-gray-900 flex items-center gap-1">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        {selectedAsset.propertyDetails.address}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Property Type</div>
                      <div className="font-medium text-gray-900">{selectedAsset.propertyDetails.propertyType}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Square Footage</div>
                      <div className="font-medium text-gray-900">
                        {formatNumber(selectedAsset.propertyDetails.squareFootage || 0)} sq ft
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Year Built</div>
                      <div className="font-medium text-gray-900">{selectedAsset.propertyDetails.yearBuilt}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Occupancy Rate</div>
                      <div className="font-medium text-gray-900">{selectedAsset.propertyDetails.occupancyRate}%</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Annual Rent Income</div>
                      <div className="font-medium text-green-600">
                        {formatCurrency(selectedAsset.propertyDetails.annualRentIncome || 0)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Compliance Info */}
              <div className="bg-gray-50 rounded-xl p-6">
                <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-indigo-600" />
                  Compliance & Governance
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex items-center gap-2">
                    {selectedAsset.requiresKYC ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-gray-400" />
                    )}
                    <span className="text-sm text-gray-700">KYC Required</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedAsset.enableClawback ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-gray-400" />
                    )}
                    <span className="text-sm text-gray-700">XLS-39D Clawback</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedAsset.isVerified ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : (
                      <Clock className="w-5 h-5 text-yellow-500" />
                    )}
                    <span className="text-sm text-gray-700">Verified Asset</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={selectedAsset.complianceStatus} />
                  </div>
                </div>
                {selectedAsset.jurisdictions && selectedAsset.jurisdictions.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="text-xs text-gray-500 mb-2">Supported Jurisdictions</div>
                    <div className="flex flex-wrap gap-2">
                      {selectedAsset.jurisdictions.map(j => (
                        <span key={j} className="px-2 py-1 bg-white rounded text-sm font-medium text-gray-700 border border-gray-200">
                          {j}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Trading Info */}
              {selectedAsset.tradingInfo && (
                <div className={`rounded-xl p-6 ${selectedAsset.tradingInfo.tradingEnabled ? 'bg-green-50' : 'bg-gray-50'}`}>
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-green-600" />
                    Trading Information
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Trading Status</div>
                      <div className="flex items-center gap-2">
                        {selectedAsset.tradingInfo.tradingEnabled ? (
                          <>
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <span className="font-medium text-green-700">Active</span>
                          </>
                        ) : (
                          <>
                            <div className="w-2 h-2 rounded-full bg-gray-400" />
                            <span className="font-medium text-gray-500">Disabled</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Trading Pair</div>
                      <div className="font-medium text-gray-900">{selectedAsset.tradingInfo.tradingPair || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Min Order</div>
                      <div className="font-medium text-gray-900">{selectedAsset.tradingInfo.minOrderSize || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">24h Volume</div>
                      <div className="font-medium text-gray-900">
                        {formatCurrency(selectedAsset.financials?.volume24hUSD || 0)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-4 pt-4 border-t border-gray-200">
                {selectedAsset.tradingInfo?.tradingEnabled && (
                  <button className="flex-1 py-3 px-4 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Trade {selectedAsset.symbol}
                  </button>
                )}
                <button className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-2">
                  <ExternalLink className="w-5 h-5" />
                  View on Explorer
                </button>
                {selectedAsset.metadata?.website && (
                  <button className="py-3 px-4 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors">
                    <Globe className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
