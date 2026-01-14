import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  Shield,
  Wallet,
  ArrowLeft,
  Crown,
  UserPlus,
  Settings,
  History,
  DollarSign,
  TrendingUp,
  Copy,
  CheckCircle,
  ExternalLink,
  AlertCircle,
  MoreVertical,
  PieChart,
} from 'lucide-react';
import { guildApi } from '../api/client';
import type { Guild, GuildMember, GuildTransaction, MemberSummary } from '../types/guild';

// ============================================================
// MOCK DATA (for demo)
// ============================================================

const MOCK_GUILD: Guild = {
  id: '1',
  name: 'Verity Alpha Traders',
  description: 'Elite trading guild focused on XRPL markets. We share alpha, strategies, and profits with our members.',
  treasuryWallet: 'rAlphaTreasuryWallet123456789',
  treasuryBalance: '25000',
  isPublic: true,
  totalMembers: 47,
  totalRevenue: '150000',
  ownerId: 'owner1',
  membershipFee: '100',
  minStakeToJoin: '1000',
  createdAt: '2026-01-01T00:00:00Z',
};

const MOCK_MEMBERS: GuildMember[] = [
  { id: '1', wallet: 'rOwnerWallet...', userId: 'u1', role: 'OWNER', sharePercentage: '40', joinedAt: '2026-01-01T00:00:00Z' },
  { id: '2', wallet: 'rAdmin1Wallet...', userId: 'u2', role: 'ADMIN', sharePercentage: '20', joinedAt: '2026-01-02T00:00:00Z' },
  { id: '3', wallet: 'rAdmin2Wallet...', userId: 'u3', role: 'ADMIN', sharePercentage: '15', joinedAt: '2026-01-03T00:00:00Z' },
  { id: '4', wallet: 'rMember1Wallet...', userId: 'u4', role: 'MEMBER', sharePercentage: '10', joinedAt: '2026-01-05T00:00:00Z' },
  { id: '5', wallet: 'rMember2Wallet...', userId: 'u5', role: 'MEMBER', sharePercentage: '10', joinedAt: '2026-01-07T00:00:00Z' },
  { id: '6', wallet: 'rMember3Wallet...', userId: 'u6', role: 'MEMBER', sharePercentage: '5', joinedAt: '2026-01-10T00:00:00Z' },
];

const MOCK_TRANSACTIONS: GuildTransaction[] = [
  { id: '1', type: 'DEPOSIT', amount: '5000', currency: 'XRP', fromWallet: 'rExternal...', description: 'Trading profits', createdAt: '2026-01-14T10:00:00Z', txHash: '4F1FC1B2...' },
  { id: '2', type: 'REVENUE_DISTRIBUTION', amount: '2500', currency: 'XRP', description: 'January distribution', createdAt: '2026-01-13T15:00:00Z', txHash: '7A2CD3E4...' },
  { id: '3', type: 'DEPOSIT', amount: '3000', currency: 'XRP', fromWallet: 'rExternal...', description: 'Staking rewards', createdAt: '2026-01-12T09:00:00Z', txHash: '9B3DE5F6...' },
  { id: '4', type: 'WITHDRAWAL', amount: '1000', currency: 'XRP', toWallet: 'rVendor...', description: 'Server costs', createdAt: '2026-01-11T14:00:00Z', txHash: 'C4D5E6F7...' },
  { id: '5', type: 'MEMBERSHIP_FEE', amount: '100', currency: 'XRP', fromWallet: 'rNewMember...', description: 'New member fee', createdAt: '2026-01-10T11:00:00Z', txHash: 'E6F7G8H9...' },
];

const MOCK_MEMBER_SUMMARY: MemberSummary = {
  total: 47,
  active: 47,
  totalShares: '100',
  byRole: { OWNER: 1, ADMIN: 2, MEMBER: 44 },
};

// ============================================================
// TREASURY CARD COMPONENT
// ============================================================

function TreasuryCard({ guild }: { guild: Guild }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(guild.treasuryWallet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-gradient-to-br from-purple-900/50 to-gray-800 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Wallet className="w-5 h-5 text-purple-400" />
          Treasury
        </h3>
        <a
          href={`https://livenet.xrpl.org/accounts/${guild.treasuryWallet}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
        >
          View on Explorer
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      <div className="mb-4">
        <p className="text-3xl font-bold text-white">
          {formatNumber(parseFloat(guild.treasuryBalance))} XRP
        </p>
        <p className="text-sm text-gray-400">
          ~${formatNumber(parseFloat(guild.treasuryBalance) * 0.5)} USD
        </p>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <code className="flex-1 bg-gray-700/50 px-3 py-2 rounded text-sm text-gray-300 truncate">
          {guild.treasuryWallet}
        </code>
        <button
          onClick={handleCopy}
          className="p-2 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
        >
          {copied ? (
            <CheckCircle className="w-4 h-4 text-green-400" />
          ) : (
            <Copy className="w-4 h-4 text-gray-400" />
          )}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-gray-700/30 rounded-lg p-3 text-center">
          <p className="text-lg font-semibold text-green-400">
            +{formatNumber(parseFloat(guild.totalRevenue))}
          </p>
          <p className="text-xs text-gray-400">Total Revenue</p>
        </div>
        <div className="bg-gray-700/30 rounded-lg p-3 text-center">
          <p className="text-lg font-semibold text-purple-400">
            {guild.totalMembers}
          </p>
          <p className="text-xs text-gray-400">Members</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MEMBERS LIST COMPONENT
// ============================================================

function MembersList({ members, summary }: { members: GuildMember[]; summary: MemberSummary }) {
  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'OWNER':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-500/20 text-yellow-400">Owner</span>;
      case 'ADMIN':
        return <span className="px-2 py-0.5 text-xs rounded-full bg-purple-500/20 text-purple-400">Admin</span>;
      default:
        return <span className="px-2 py-0.5 text-xs rounded-full bg-gray-500/20 text-gray-400">Member</span>;
    }
  };

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-purple-400" />
          Members ({summary.active})
        </h3>
        <button className="flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300">
          <UserPlus className="w-4 h-4" />
          Add Member
        </button>
      </div>

      {/* Role Summary */}
      <div className="flex gap-4 mb-4 pb-4 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-yellow-400" />
          <span className="text-sm text-gray-400">{summary.byRole.OWNER} Owner</span>
        </div>
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-purple-400" />
          <span className="text-sm text-gray-400">{summary.byRole.ADMIN} Admins</span>
        </div>
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-400">{summary.byRole.MEMBER} Members</span>
        </div>
      </div>

      {/* Members Table */}
      <div className="space-y-2">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-700/30"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                {member.role === 'OWNER' ? (
                  <Crown className="w-4 h-4 text-yellow-400" />
                ) : member.role === 'ADMIN' ? (
                  <Shield className="w-4 h-4 text-purple-400" />
                ) : (
                  <span className="text-xs text-gray-400">
                    {member.wallet.slice(1, 3).toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <p className="text-sm text-white font-mono">{member.wallet}</p>
                <p className="text-xs text-gray-500">
                  Joined {new Date(member.joinedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {getRoleBadge(member.role)}
              <div className="text-right">
                <p className="text-sm text-white">{member.sharePercentage}%</p>
                <p className="text-xs text-gray-500">Share</p>
              </div>
              <button className="p-1 hover:bg-gray-600 rounded">
                <MoreVertical className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// TRANSACTIONS LIST COMPONENT
// ============================================================

function TransactionsList({ transactions }: { transactions: GuildTransaction[] }) {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'DEPOSIT':
        return <TrendingUp className="w-4 h-4 text-green-400" />;
      case 'WITHDRAWAL':
        return <TrendingUp className="w-4 h-4 text-red-400 rotate-180" />;
      case 'REVENUE_DISTRIBUTION':
        return <DollarSign className="w-4 h-4 text-purple-400" />;
      case 'MEMBERSHIP_FEE':
        return <Users className="w-4 h-4 text-blue-400" />;
      default:
        return <History className="w-4 h-4 text-gray-400" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'DEPOSIT':
      case 'MEMBERSHIP_FEE':
        return 'text-green-400';
      case 'WITHDRAWAL':
      case 'REVENUE_DISTRIBUTION':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <History className="w-5 h-5 text-purple-400" />
          Recent Transactions
        </h3>
        <button className="text-sm text-purple-400 hover:text-purple-300">
          View All
        </button>
      </div>

      <div className="space-y-3">
        {transactions.map((tx) => (
          <div key={tx.id} className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                {getTypeIcon(tx.type)}
              </div>
              <div>
                <p className="text-sm text-white">{tx.description || tx.type}</p>
                <p className="text-xs text-gray-500">
                  {new Date(tx.createdAt).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className={`font-medium ${getTypeColor(tx.type)}`}>
                {tx.type.includes('DEPOSIT') || tx.type === 'MEMBERSHIP_FEE' ? '+' : '-'}
                {formatNumber(parseFloat(tx.amount))} {tx.currency}
              </p>
              {tx.txHash && (
                <a
                  href={`https://livenet.xrpl.org/transactions/${tx.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-purple-400 hover:text-purple-300"
                >
                  {tx.txHash}
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// SHARE DISTRIBUTION COMPONENT
// ============================================================

function ShareDistribution({ members }: { members: GuildMember[] }) {
  const colors = ['bg-yellow-500', 'bg-purple-500', 'bg-blue-500', 'bg-green-500', 'bg-pink-500', 'bg-orange-500'];

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <PieChart className="w-5 h-5 text-purple-400" />
        Share Distribution
      </h3>

      {/* Visual Bar */}
      <div className="w-full h-4 rounded-full overflow-hidden flex mb-4">
        {members.filter(m => parseFloat(m.sharePercentage) > 0).map((member, idx) => (
          <div
            key={member.id}
            className={`${colors[idx % colors.length]} transition-all`}
            style={{ width: `${member.sharePercentage}%` }}
            title={`${member.wallet}: ${member.sharePercentage}%`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="space-y-2">
        {members.filter(m => parseFloat(m.sharePercentage) > 0).map((member, idx) => (
          <div key={member.id} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded ${colors[idx % colors.length]}`} />
              <span className="text-gray-300 font-mono text-xs">{member.wallet}</span>
            </div>
            <span className="text-white font-medium">{member.sharePercentage}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================
// QUICK ACTIONS COMPONENT
// ============================================================

function QuickActions() {
  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Settings className="w-5 h-5 text-purple-400" />
        Quick Actions
      </h3>

      <div className="space-y-2">
        <button className="w-full py-2 px-4 bg-green-600/20 text-green-400 rounded-lg hover:bg-green-600/30 transition-colors flex items-center gap-2 justify-center">
          <TrendingUp className="w-4 h-4" />
          Record Deposit
        </button>
        <button className="w-full py-2 px-4 bg-purple-600/20 text-purple-400 rounded-lg hover:bg-purple-600/30 transition-colors flex items-center gap-2 justify-center">
          <DollarSign className="w-4 h-4" />
          Distribute Revenue
        </button>
        <button className="w-full py-2 px-4 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-colors flex items-center gap-2 justify-center">
          <UserPlus className="w-4 h-4" />
          Invite Member
        </button>
        <button className="w-full py-2 px-4 bg-gray-600/20 text-gray-400 rounded-lg hover:bg-gray-600/30 transition-colors flex items-center gap-2 justify-center">
          <Settings className="w-4 h-4" />
          Guild Settings
        </button>
      </div>
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

export default function GuildDetail() {
  const { guildId } = useParams<{ guildId: string }>();
  const [isDemo] = useState(true);

  // Fetch guild data (with demo fallback)
  const { data: guildData } = useQuery({
    queryKey: ['guild', guildId],
    queryFn: () => guildApi.getGuild(guildId!),
    retry: false,
    enabled: !isDemo && !!guildId,
  });

  const { data: membersData } = useQuery({
    queryKey: ['guildMembers', guildId],
    queryFn: () => guildApi.getMembers(guildId!),
    retry: false,
    enabled: !isDemo && !!guildId,
  });

  const { data: transactionsData } = useQuery({
    queryKey: ['guildTransactions', guildId],
    queryFn: () => guildApi.getTransactions(guildId!),
    retry: false,
    enabled: !isDemo && !!guildId,
  });

  const guild = isDemo ? MOCK_GUILD : (guildData?.data?.guild || MOCK_GUILD);
  const members = isDemo ? MOCK_MEMBERS : (membersData?.data?.members || MOCK_MEMBERS);
  const memberSummary = isDemo ? MOCK_MEMBER_SUMMARY : (membersData?.data?.summary || MOCK_MEMBER_SUMMARY);
  const transactions = isDemo ? MOCK_TRANSACTIONS : (transactionsData?.data?.transactions || MOCK_TRANSACTIONS);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/app/guilds"
          className="p-2 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </Link>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
            <span className="text-white font-bold text-xl">
              {guild.name.slice(0, 2).toUpperCase()}
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">{guild.name}</h1>
            <p className="text-gray-400">{guild.description}</p>
          </div>
        </div>
      </div>

      {/* Demo Mode Banner */}
      {isDemo && (
        <div className="bg-purple-600/20 border border-purple-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-purple-400" />
          <div>
            <p className="text-purple-300 font-medium">Demo Mode</p>
            <p className="text-sm text-purple-400/80">
              Connect wallet to interact with this guild. Admin actions require OWNER or ADMIN role.
            </p>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Treasury & Actions */}
        <div className="space-y-6">
          <TreasuryCard guild={guild} />
          <QuickActions />
          <ShareDistribution members={members} />
        </div>

        {/* Middle Column - Members */}
        <div className="lg:col-span-1">
          <MembersList members={members} summary={memberSummary} />
        </div>

        {/* Right Column - Transactions */}
        <div className="lg:col-span-1">
          <TransactionsList transactions={transactions} />
        </div>
      </div>

      {/* Guild Info */}
      <div className="bg-gray-800 rounded-xl p-4">
        <h3 className="text-lg font-semibold text-white mb-4">Guild Information</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-400">Created</p>
            <p className="text-white">{new Date(guild.createdAt).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">Membership Fee</p>
            <p className="text-white">{guild.membershipFee ? `${guild.membershipFee} XRP` : 'Free'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">Min Stake to Join</p>
            <p className="text-white">{guild.minStakeToJoin ? `${formatNumber(parseFloat(guild.minStakeToJoin))} VRTY` : 'None'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">Visibility</p>
            <p className="text-white">{guild.isPublic ? 'Public' : 'Private'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
