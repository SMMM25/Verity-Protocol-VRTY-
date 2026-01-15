import { useState } from 'react';
import {
  Zap,
  Star,
  TrendingUp,
  Award,
  Heart,
  MessageCircle,
  Rocket,
  Shield,
  ExternalLink,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Crown,
  User,
  Radio,
} from 'lucide-react';
import { signalsApi } from '../api/client';
import type { 
  ContentNFT, 
  ReputationScore, 
  LeaderboardEntry,
  SignalType,
  Creator,
} from '../types/signals';
import { useApiWithFallback, useApiContext, ModeToggle } from '../hooks/useApiWithFallback';

// ============================================================
// MOCK DATA (for demo)
// ============================================================

const MOCK_TRENDING_CONTENT: ContentNFT[] = [
  {
    tokenId: 'NFT_001',
    creator: 'rCreator1...',
    contentHash: 'abc123...',
    contentType: 'article',
    uri: 'https://example.com/article/1',
    title: 'Understanding XRPL DEX Trading',
    description: 'A comprehensive guide to trading on the XRPL native DEX',
    totalSignals: 127,
    totalValue: '15000000',
    createdAt: '2026-01-10T00:00:00Z',
  },
  {
    tokenId: 'NFT_002',
    creator: 'rCreator2...',
    contentHash: 'def456...',
    contentType: 'video',
    uri: 'https://example.com/video/1',
    title: 'VRTY Tokenomics Explained',
    description: 'Deep dive into Verity Protocol token economics',
    totalSignals: 89,
    totalValue: '12500000',
    createdAt: '2026-01-12T00:00:00Z',
  },
  {
    tokenId: 'NFT_003',
    creator: 'rCreator3...',
    contentHash: 'ghi789...',
    contentType: 'thread',
    uri: 'https://example.com/thread/1',
    title: 'Why Proof-of-Engagement Matters',
    description: 'Thread on sybil-resistant social metrics',
    totalSignals: 56,
    totalValue: '8000000',
    createdAt: '2026-01-13T00:00:00Z',
  },
];

const MOCK_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, wallet: 'rTopCreator1...', displayName: 'CryptoSage', reputationScore: 2450, totalSignalsReceived: 892, totalValueReceived: '150000000' },
  { rank: 2, wallet: 'rTopCreator2...', displayName: 'XRPLDev', reputationScore: 2180, totalSignalsReceived: 756, totalValueReceived: '120000000' },
  { rank: 3, wallet: 'rTopCreator3...', displayName: 'DeFiExplorer', reputationScore: 1920, totalSignalsReceived: 634, totalValueReceived: '95000000' },
  { rank: 4, wallet: 'rTopCreator4...', displayName: 'TokenTrader', reputationScore: 1780, totalSignalsReceived: 521, totalValueReceived: '82000000' },
  { rank: 5, wallet: 'rTopCreator5...', displayName: 'BlockchainBuilder', reputationScore: 1650, totalSignalsReceived: 478, totalValueReceived: '75000000' },
];

const MOCK_MY_REPUTATION: ReputationScore = {
  wallet: 'rMyWallet...',
  totalSignalsReceived: 45,
  totalSignalsSent: 23,
  totalXRPReceived: '5000000',
  totalXRPSent: '2500000',
  reputationScore: 320,
  rank: 1247,
  lastUpdated: new Date().toISOString(),
};

const MOCK_CREATORS: Creator[] = [
  {
    wallet: 'rCreator1...',
    displayName: 'CryptoSage',
    bio: 'XRPL educator and content creator',
    totalContent: 47,
    totalSignalsReceived: 892,
    totalValueReceived: '150000000',
    reputationScore: 2450,
    followers: 1234,
    following: 89,
    joinedAt: '2025-06-15T00:00:00Z',
    verified: true,
  },
  {
    wallet: 'rCreator2...',
    displayName: 'XRPLDev',
    bio: 'Building on XRPL | Open source advocate',
    totalContent: 32,
    totalSignalsReceived: 756,
    totalValueReceived: '120000000',
    reputationScore: 2180,
    followers: 987,
    following: 156,
    joinedAt: '2025-08-20T00:00:00Z',
    verified: true,
  },
];

const SIGNAL_TYPES: { type: SignalType; icon: typeof Zap; label: string; color: string }[] = [
  { type: 'ENDORSEMENT', icon: Star, label: 'Endorse', color: 'text-yellow-400 bg-yellow-400/20' },
  { type: 'BOOST', icon: Rocket, label: 'Boost', color: 'text-purple-400 bg-purple-400/20' },
  { type: 'SUPPORT', icon: Heart, label: 'Support', color: 'text-pink-400 bg-pink-400/20' },
  { type: 'CHALLENGE', icon: Shield, label: 'Challenge', color: 'text-orange-400 bg-orange-400/20' },
  { type: 'REPLY', icon: MessageCircle, label: 'Reply', color: 'text-blue-400 bg-blue-400/20' },
];

// ============================================================
// CONTENT CARD COMPONENT
// ============================================================

function ContentCard({ content }: { content: ContentNFT }) {
  const getContentTypeIcon = (type: string) => {
    switch (type) {
      case 'article': return '📄';
      case 'video': return '🎬';
      case 'podcast': return '🎙️';
      case 'thread': return '🧵';
      case 'image': return '🖼️';
      default: return '📝';
    }
  };

  return (
    <div className="bg-gray-800 rounded-xl p-4 hover:bg-gray-750 transition-colors border border-gray-700 hover:border-purple-500/50">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{getContentTypeIcon(content.contentType)}</span>
          <span className="text-xs text-gray-400 bg-gray-700 px-2 py-1 rounded">
            {content.contentType}
          </span>
        </div>
        <span className="text-xs text-gray-500">
          {new Date(content.createdAt).toLocaleDateString()}
        </span>
      </div>

      {/* Title & Description */}
      <h4 className="text-white font-medium mb-1">{content.title || 'Untitled Content'}</h4>
      <p className="text-sm text-gray-400 line-clamp-2 mb-3">
        {content.description || 'No description'}
      </p>

      {/* Creator */}
      <div className="flex items-center gap-2 mb-3 text-sm">
        <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center">
          <User className="w-3 h-3 text-gray-400" />
        </div>
        <span className="text-gray-400 font-mono text-xs">{content.creator}</span>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between pt-3 border-t border-gray-700">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 text-purple-400">
            <Zap className="w-4 h-4" />
            <span className="text-sm font-medium">{content.totalSignals}</span>
          </div>
          <div className="flex items-center gap-1 text-green-400">
            <TrendingUp className="w-4 h-4" />
            <span className="text-sm font-medium">
              {formatXRP(content.totalValue)} XRP
            </span>
          </div>
        </div>
        <button className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1">
          Signal
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ============================================================
// LEADERBOARD COMPONENT
// ============================================================

function LeaderboardSection({ entries }: { entries: LeaderboardEntry[] }) {
  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1: return <Crown className="w-5 h-5 text-yellow-400" />;
      case 2: return <Award className="w-5 h-5 text-gray-300" />;
      case 3: return <Award className="w-5 h-5 text-orange-400" />;
      default: return <span className="text-gray-400 font-mono">#{rank}</span>;
    }
  };

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Award className="w-5 h-5 text-purple-400" />
          Top Creators
        </h3>
        <button className="text-sm text-purple-400 hover:text-purple-300">
          View All
        </button>
      </div>

      <div className="space-y-3">
        {entries.map((entry) => (
          <div
            key={entry.wallet}
            className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-700/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 flex justify-center">
                {getRankBadge(entry.rank)}
              </div>
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">
                  {(entry.displayName || entry.wallet).slice(0, 2).toUpperCase()}
                </span>
              </div>
              <div>
                <p className="text-white font-medium">{entry.displayName || entry.wallet}</p>
                <p className="text-xs text-gray-400">{entry.totalSignalsReceived} signals</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-purple-400 font-medium">{entry.reputationScore}</p>
              <p className="text-xs text-gray-400">reputation</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// MY REPUTATION COMPONENT
// ============================================================

function MyReputationCard({ reputation }: { reputation: ReputationScore }) {
  return (
    <div className="bg-gradient-to-br from-purple-900/50 to-gray-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-400" />
          My Reputation
        </h3>
        {reputation.rank && (
          <span className="text-sm bg-purple-600/30 text-purple-400 px-2 py-1 rounded">
            Rank #{reputation.rank}
          </span>
        )}
      </div>

      <div className="text-center mb-6">
        <p className="text-5xl font-bold text-white mb-1">
          {reputation.reputationScore}
        </p>
        <p className="text-sm text-gray-400">Reputation Score</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-700/30 rounded-lg p-3 text-center">
          <p className="text-2xl font-semibold text-green-400">
            {reputation.totalSignalsReceived}
          </p>
          <p className="text-xs text-gray-400">Signals Received</p>
        </div>
        <div className="bg-gray-700/30 rounded-lg p-3 text-center">
          <p className="text-2xl font-semibold text-blue-400">
            {reputation.totalSignalsSent}
          </p>
          <p className="text-xs text-gray-400">Signals Sent</p>
        </div>
        <div className="bg-gray-700/30 rounded-lg p-3 text-center">
          <p className="text-2xl font-semibold text-purple-400">
            {formatXRP(reputation.totalXRPReceived)}
          </p>
          <p className="text-xs text-gray-400">XRP Received</p>
        </div>
        <div className="bg-gray-700/30 rounded-lg p-3 text-center">
          <p className="text-2xl font-semibold text-yellow-400">
            {formatXRP(reputation.totalXRPSent)}
          </p>
          <p className="text-xs text-gray-400">XRP Sent</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SIGNAL TYPES INFO
// ============================================================

function SignalTypesInfo() {
  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Zap className="w-5 h-5 text-purple-400" />
        Signal Types
      </h3>

      <div className="space-y-3">
        {SIGNAL_TYPES.map(({ type, icon: Icon, label, color }) => (
          <div key={type} className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-white font-medium">{label}</p>
              <p className="text-xs text-gray-400">
                {type === 'ENDORSEMENT' && 'Show approval for content'}
                {type === 'BOOST' && 'Amplify content visibility'}
                {type === 'SUPPORT' && 'Financial support for creator'}
                {type === 'CHALLENGE' && 'Express disagreement'}
                {type === 'REPLY' && 'Respond to the content'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// CREATOR CARD
// ============================================================

function CreatorCard({ creator }: { creator: Creator }) {
  return (
    <div className="bg-gray-800 rounded-xl p-4 hover:bg-gray-750 transition-colors border border-gray-700">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
          <span className="text-white font-bold">
            {(creator.displayName || creator.wallet).slice(0, 2).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-white font-medium truncate">{creator.displayName}</p>
            {creator.verified && (
              <CheckCircle className="w-4 h-4 text-blue-400" />
            )}
          </div>
          <p className="text-xs text-gray-400 font-mono truncate">{creator.wallet}</p>
        </div>
      </div>

      <p className="text-sm text-gray-400 mb-3 line-clamp-2">{creator.bio}</p>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center">
          <p className="text-white font-medium">{creator.totalContent}</p>
          <p className="text-xs text-gray-500">Posts</p>
        </div>
        <div className="text-center">
          <p className="text-white font-medium">{formatNumber(creator.followers)}</p>
          <p className="text-xs text-gray-500">Followers</p>
        </div>
        <div className="text-center">
          <p className="text-purple-400 font-medium">{creator.reputationScore}</p>
          <p className="text-xs text-gray-500">Rep</p>
        </div>
      </div>

      <button className="w-full py-2 bg-purple-600/20 text-purple-400 rounded-lg hover:bg-purple-600/30 transition-colors">
        View Profile
      </button>
    </div>
  );
}

// ============================================================
// HOW IT WORKS
// ============================================================

function HowItWorks() {
  const steps = [
    { icon: User, title: 'Create Content', desc: 'Mint content NFTs to receive signals' },
    { icon: Zap, title: 'Send Signals', desc: 'Micro-XRP payments as endorsements' },
    { icon: Star, title: 'Build Reputation', desc: 'Earn reputation from signal activity' },
    { icon: Award, title: 'Get Rewarded', desc: 'Top creators gain visibility & earnings' },
  ];

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <h3 className="text-lg font-semibold text-white mb-4">How Signals Work</h3>
      <div className="space-y-4">
        {steps.map((step, idx) => (
          <div key={idx} className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-purple-600/20 flex items-center justify-center flex-shrink-0">
              <step.icon className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <p className="text-white font-medium">{step.title}</p>
              <p className="text-sm text-gray-400">{step.desc}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-4 border-t border-gray-700">
        <p className="text-xs text-gray-400">
          Signals create sybil-resistant engagement. Each signal costs real XRP, 
          preventing spam and manipulation.
        </p>
      </div>
    </div>
  );
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function formatXRP(drops: string): string {
  const xrp = parseInt(drops) / 1000000;
  if (xrp >= 1000) {
    return (xrp / 1000).toFixed(1) + 'K';
  }
  return xrp.toFixed(2);
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function SignalsDashboard() {
  const { isLiveMode, apiStatus } = useApiContext();
  const [sortBy, setSortBy] = useState<'signals' | 'value' | 'recent'>('recent');

  // API integration with demo fallback
  const { 
    data: leaderboard,
    isDemo: leaderboardIsDemo,
    isLive: leaderboardIsLive,
  } = useApiWithFallback(
    ['signalsLeaderboard'],
    async () => {
      const response = await signalsApi.getLeaderboard({ limit: 10 });
      return response.data?.leaderboard || [];
    },
    MOCK_LEADERBOARD
  );

  const { 
    data: trendingContent,
    isDemo: contentIsDemo,
    isLive: contentIsLive,
  } = useApiWithFallback(
    ['signalsDiscover', sortBy],
    async () => {
      const response = await signalsApi.discover({ sortBy, limit: 20 });
      return response.data?.content || [];
    },
    MOCK_TRENDING_CONTENT
  );

  const isDemo = leaderboardIsDemo || contentIsDemo;
  const isLive = leaderboardIsLive && contentIsLive;
  const myReputation = MOCK_MY_REPUTATION;
  const creators = MOCK_CREATORS;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Signals Protocol</h1>
          <p className="text-gray-400">Proof-of-Engagement with Micro-XRP</p>
        </div>
        <div className="flex items-center gap-4">
          <ModeToggle showLatency />
          <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
            <Zap className="w-5 h-5" />
            Create Content
          </button>
        </div>
      </div>

      {/* Mode Banner */}
      {isDemo && (
        <div className="bg-purple-600/20 border border-purple-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-purple-400" />
          <div>
            <p className="text-purple-300 font-medium">
              {isLiveMode && !apiStatus.isOnline ? 'API Offline - Using Demo Data' : 'Demo Mode'}
            </p>
            <p className="text-sm text-purple-400/80">
              {isLiveMode && !apiStatus.isOnline 
                ? 'Unable to connect to live API. Showing simulated data until connection is restored.'
                : 'Connect wallet to send signals and build reputation. Minimum signal: 0.00001 XRP (10 drops).'}
            </p>
          </div>
        </div>
      )}

      {/* Live Data Indicator */}
      {isLive && (
        <div className="bg-emerald-600/20 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
          <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
          <div>
            <p className="text-emerald-300 font-medium">Live Data</p>
            <p className="text-sm text-emerald-400/80">
              Connected to Signals API. Showing real content and reputation data.
              {apiStatus.latency && ` Latency: ${apiStatus.latency}ms`}
            </p>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - My Reputation & Signal Types */}
        <div className="space-y-6">
          <MyReputationCard reputation={myReputation} />
          <SignalTypesInfo />
          <HowItWorks />
        </div>

        {/* Middle Column - Trending Content */}
        <div className="lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-400" />
              Trending Content
            </h2>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-1 text-sm text-white"
            >
              <option value="recent">Recent</option>
              <option value="signals">Most Signals</option>
              <option value="value">Most Value</option>
            </select>
          </div>

          <div className="space-y-4">
            {trendingContent.map((content: ContentNFT) => (
              <ContentCard key={content.tokenId} content={content} />
            ))}
          </div>
        </div>

        {/* Right Column - Leaderboard & Creators */}
        <div className="space-y-6">
          <LeaderboardSection entries={leaderboard} />
          
          <div>
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-purple-400" />
              Featured Creators
            </h3>
            <div className="space-y-4">
              {creators.map((creator) => (
                <CreatorCard key={creator.wallet} creator={creator} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Algorithm Transparency */}
      <div className="bg-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-green-600/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Transparent Algorithm</h3>
            <p className="text-sm text-gray-400">Our reputation algorithm is fully public</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div className="bg-gray-700/30 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">Received Score</p>
            <code className="text-green-400 text-sm">log10(XRP_received + 1) × 100</code>
          </div>
          <div className="bg-gray-700/30 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">Sent Score</p>
            <code className="text-blue-400 text-sm">log10(XRP_sent + 1) × 50</code>
          </div>
          <div className="bg-gray-700/30 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-1">Engagement Bonus</p>
            <code className="text-purple-400 text-sm">min(sent, received) × 0.5</code>
          </div>
        </div>

        <div className="flex items-start gap-2 text-sm text-gray-400">
          <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
          <span>
            Anti-manipulation: Logarithmic scaling prevents whale manipulation, 
            minimum signal amount prevents spam, all signals require real XRP payment.
          </span>
        </div>
      </div>

      {/* Features */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-purple-600/20 flex items-center justify-center">
              <Zap className="w-4 h-4 text-purple-400" />
            </div>
            <span className="text-white font-medium">Sybil Resistant</span>
          </div>
          <p className="text-sm text-gray-400">
            Real XRP payments make fake engagement costly and impractical.
          </p>
        </div>

        <div className="bg-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-green-600/20 flex items-center justify-center">
              <ExternalLink className="w-4 h-4 text-green-400" />
            </div>
            <span className="text-white font-medium">On-Chain Verified</span>
          </div>
          <p className="text-sm text-gray-400">
            Every signal is recorded on XRPL for permanent verification.
          </p>
        </div>

        <div className="bg-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-yellow-600/20 flex items-center justify-center">
              <Award className="w-4 h-4 text-yellow-400" />
            </div>
            <span className="text-white font-medium">Earn Reputation</span>
          </div>
          <p className="text-sm text-gray-400">
            Build verifiable reputation through genuine engagement.
          </p>
        </div>
      </div>
    </div>
  );
}
