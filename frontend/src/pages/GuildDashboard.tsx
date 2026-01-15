/**
 * Guild Dashboard - Multi-sig treasuries & DAO governance
 * Updated with shared UI components
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  Users,
  Shield,
  Wallet,
  PlusCircle,
  Search,
  Globe,
  Lock,
  TrendingUp,
  ArrowRight,
  Crown,
  AlertCircle,
  CheckCircle,
  ExternalLink,
} from 'lucide-react';
import { guildApi } from '../api/client';
import type { Guild, GuildStats } from '../types/guild';
import { Card, Button } from '@/components/ui';

// ============================================================
// MOCK DATA (for demo)
// ============================================================

const MOCK_GUILDS: Guild[] = [
  {
    id: '1',
    name: 'Verity Alpha Traders',
    description: 'Elite trading guild focused on XRPL markets',
    treasuryWallet: 'rAlphaTreasury...',
    treasuryBalance: '25000',
    isPublic: true,
    totalMembers: 47,
    totalRevenue: '150000',
    ownerId: 'owner1',
    createdAt: '2026-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'DeFi Builders DAO',
    description: 'Building the future of decentralized finance',
    treasuryWallet: 'rDefiBuild...',
    treasuryBalance: '75000',
    isPublic: true,
    totalMembers: 128,
    totalRevenue: '500000',
    ownerId: 'owner2',
    createdAt: '2025-12-15T00:00:00Z',
  },
  {
    id: '3',
    name: 'NFT Creators Collective',
    description: 'Artists and creators leveraging XRPL NFTs',
    treasuryWallet: 'rNFTCreat...',
    treasuryBalance: '12000',
    isPublic: false,
    totalMembers: 23,
    totalRevenue: '45000',
    ownerId: 'owner3',
    createdAt: '2026-01-10T00:00:00Z',
  },
];

const MOCK_STATS: GuildStats = {
  totalGuilds: 156,
  activeGuilds: 142,
  totalMembers: 4567,
  totalTreasuryValue: '2500000',
};

const MOCK_MY_GUILDS: Guild[] = [
  {
    id: '1',
    name: 'Verity Alpha Traders',
    description: 'Elite trading guild focused on XRPL markets',
    treasuryWallet: 'rAlphaTreasury...',
    treasuryBalance: '25000',
    isPublic: true,
    totalMembers: 47,
    totalRevenue: '150000',
    ownerId: 'owner1',
    createdAt: '2026-01-01T00:00:00Z',
  },
];

// ============================================================
// GUILD CARD COMPONENT
// ============================================================

function GuildCard({ guild }: { guild: Guild }) {
  return (
    <Link to={`/app/guilds/${guild.id}`} className="block">
      <Card hover className="h-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-lg">
              {guild.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div>
            <h3 className="text-white font-semibold">{guild.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              {guild.isPublic ? (
                <span className="flex items-center gap-1 text-xs text-green-400">
                  <Globe className="w-3 h-3" />
                  Public
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-yellow-400">
                  <Lock className="w-3 h-3" />
                  Private
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-400 mb-4 line-clamp-2">
        {guild.description || 'No description provided'}
      </p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <p className="text-lg font-semibold text-white">{guild.totalMembers}</p>
          <p className="text-xs text-gray-400">Members</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-white">
            {formatNumber(parseFloat(guild.treasuryBalance))}
          </p>
          <p className="text-xs text-gray-400">XRP Treasury</p>
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold text-white">
            {formatNumber(parseFloat(guild.totalRevenue))}
          </p>
          <p className="text-xs text-gray-400">Total Revenue</p>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-gray-700 flex items-center justify-between">
        <span className="text-xs text-gray-500">
          Created {new Date(guild.createdAt).toLocaleDateString()}
        </span>
        <span className="flex items-center gap-1 text-sm text-violet-400">
          View Guild
          <ArrowRight className="w-4 h-4" />
        </span>
      </div>
      </Card>
    </Link>
  );
}

// ============================================================
// STATS OVERVIEW COMPONENT
// ============================================================

function StatsOverview({ stats }: { stats: GuildStats }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard
        label="Total Guilds"
        value={stats.totalGuilds.toString()}
        icon={<Users className="w-5 h-5" />}
        color="purple"
      />
      <StatCard
        label="Active Guilds"
        value={stats.activeGuilds.toString()}
        icon={<CheckCircle className="w-5 h-5" />}
        color="green"
      />
      <StatCard
        label="Total Members"
        value={formatNumber(stats.totalMembers)}
        icon={<Shield className="w-5 h-5" />}
        color="blue"
      />
      <StatCard
        label="Total Treasury"
        value={`${formatNumber(parseFloat(stats.totalTreasuryValue))} XRP`}
        icon={<Wallet className="w-5 h-5" />}
        color="yellow"
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: 'purple' | 'green' | 'blue' | 'yellow';
}) {
  const colorClasses = {
    purple: 'bg-violet-500/20 text-violet-400',
    green: 'bg-emerald-500/20 text-emerald-400',
    blue: 'bg-blue-500/20 text-blue-400',
    yellow: 'bg-amber-500/20 text-amber-400',
  };

  return (
    <Card>
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-sm text-slate-400">{label}</p>
    </Card>
  );
}

// ============================================================
// CREATE GUILD MODAL
// ============================================================

function CreateGuildModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [minStake, setMinStake] = useState('0');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert('Connect wallet to create a guild. Requires 10,000+ VRTY stake.');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-gray-800 rounded-xl p-6 w-full max-w-md mx-4">
        <h2 className="text-xl font-bold text-white mb-4">Create New Guild</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Guild Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
              placeholder="My Awesome Guild"
              required
              minLength={3}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500 h-24"
              placeholder="What is your guild about?"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Min Stake to Join (VRTY)</label>
            <input
              type="number"
              value={minStake}
              onChange={(e) => setMinStake(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-purple-500"
              placeholder="0"
              min="0"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={isPublic}
                onChange={() => setIsPublic(true)}
                className="text-purple-600"
              />
              <span className="text-sm text-gray-300">Public</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={!isPublic}
                onChange={() => setIsPublic(false)}
                className="text-purple-600"
              />
              <span className="text-sm text-gray-300">Private</span>
            </label>
          </div>

          <div className="flex items-start gap-2 text-xs text-yellow-400/80 bg-yellow-400/10 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>
              Creating a guild requires 10,000+ VRTY stake. Connect your wallet to proceed.
            </span>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Create Guild
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================
// MY GUILDS SECTION
// ============================================================

function MyGuildsSection({ guilds }: { guilds: Guild[] }) {
  if (guilds.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 text-center">
        <Users className="w-12 h-12 mx-auto text-gray-600 mb-3" />
        <p className="text-gray-400 mb-2">You haven't joined any guilds yet</p>
        <p className="text-sm text-gray-500">
          Browse public guilds below or create your own
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {guilds.map((guild) => (
        <Link
          key={guild.id}
          to={`/app/guilds/${guild.id}`}
          className="flex items-center gap-4 bg-gray-800 rounded-xl p-4 hover:bg-gray-750 transition-colors"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
            <span className="text-white font-bold">
              {guild.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-white font-medium truncate">{guild.name}</h4>
              <Crown className="w-4 h-4 text-yellow-400" />
            </div>
            <p className="text-sm text-gray-400">{guild.totalMembers} members</p>
          </div>
          <div className="text-right">
            <p className="text-white font-medium">
              {formatNumber(parseFloat(guild.treasuryBalance))} XRP
            </p>
            <p className="text-xs text-gray-400">Treasury</p>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-500" />
        </Link>
      ))}
    </div>
  );
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toLocaleString();
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function GuildDashboard() {
  const [isDemo] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Fetch guilds (with demo fallback)
  const { data: guildsData } = useQuery({
    queryKey: ['guilds'],
    queryFn: () => guildApi.getGuilds(),
    retry: false,
    enabled: !isDemo,
  });

  const { data: statsData } = useQuery({
    queryKey: ['guildStats'],
    queryFn: () => guildApi.getStats(),
    retry: false,
    enabled: !isDemo,
  });

  const guilds = isDemo ? MOCK_GUILDS : (guildsData?.data?.guilds || MOCK_GUILDS);
  const stats = isDemo ? MOCK_STATS : (statsData?.data?.stats || MOCK_STATS);
  const myGuilds = isDemo ? MOCK_MY_GUILDS : [];

  // Filter guilds by search
  const filteredGuilds = guilds.filter(
    (guild: Guild) =>
      guild.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      guild.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Guilds & DAOs</h1>
          <p className="text-gray-400">Multi-signature treasuries & governance</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <PlusCircle className="w-5 h-5" />
          Create Guild
        </Button>
      </div>

      {/* Demo Mode Banner */}
      {isDemo && (
        <Card glass className="flex items-center gap-3 border-violet-500/30">
          <AlertCircle className="w-5 h-5 text-violet-400" />
          <div>
            <p className="text-violet-300 font-medium">Demo Mode</p>
            <p className="text-sm text-violet-400/80">
              Connect wallet to view your guilds and create new ones.
              Requires 10,000+ VRTY stake to create a guild.
            </p>
          </div>
        </Card>
      )}

      {/* Stats Overview */}
      <StatsOverview stats={stats} />

      {/* My Guilds */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Crown className="w-5 h-5 text-yellow-400" />
          My Guilds
        </h2>
        <MyGuildsSection guilds={myGuilds} />
      </div>

      {/* Search & Filter */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Globe className="w-5 h-5 text-purple-400" />
          Explore Public Guilds
        </h2>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-purple-500"
            placeholder="Search guilds..."
          />
        </div>
      </div>

      {/* Guild Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredGuilds.map((guild: Guild) => (
          <GuildCard key={guild.id} guild={guild} />
        ))}
      </div>

      {filteredGuilds.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-12 h-12 mx-auto text-gray-600 mb-3" />
          <p className="text-gray-400">No guilds found matching "{searchQuery}"</p>
        </div>
      )}

      {/* Features Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-purple-600/20 flex items-center justify-center">
              <Shield className="w-4 h-4 text-purple-400" />
            </div>
            <span className="text-white font-medium">Multi-Sig Treasury</span>
          </div>
          <p className="text-sm text-gray-400">
            Secure treasury management with XRPL native multi-signature support.
          </p>
        </div>

        <div className="bg-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-green-600/20 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-green-400" />
            </div>
            <span className="text-white font-medium">Revenue Sharing</span>
          </div>
          <p className="text-sm text-gray-400">
            Automatic revenue distribution based on member shares.
          </p>
        </div>

        <div className="bg-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center">
              <ExternalLink className="w-4 h-4 text-blue-400" />
            </div>
            <span className="text-white font-medium">On-Chain Audit</span>
          </div>
          <p className="text-sm text-gray-400">
            Full transparency with on-chain transaction history.
          </p>
        </div>
      </div>

      {/* Create Guild Modal */}
      <CreateGuildModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />
    </div>
  );
}
