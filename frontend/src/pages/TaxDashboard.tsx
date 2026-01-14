import { useQuery } from '@tanstack/react-query';
import { useUser } from '../App';
import { taxApi } from '../api/client';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Receipt,
  AlertCircle,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { Link } from 'react-router-dom';

const currentYear = new Date().getFullYear();

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  color = 'blue' 
}: { 
  title: string; 
  value: string; 
  icon: React.ElementType; 
  trend?: 'up' | 'down';
  color?: 'blue' | 'green' | 'red' | 'purple';
}) {
  const colorClasses = {
    blue: 'bg-blue-500/10 text-blue-400',
    green: 'bg-green-500/10 text-green-400',
    red: 'bg-red-500/10 text-red-400',
    purple: 'bg-purple-500/10 text-purple-400',
  };

  return (
    <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400 mb-1">{title}</p>
          <p className="text-2xl font-bold text-white">{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-lg ${colorClasses[color]} flex items-center justify-center`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {trend && (
        <div className={`mt-3 flex items-center gap-1 text-sm ${trend === 'up' ? 'text-green-400' : 'text-red-400'}`}>
          {trend === 'up' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          <span>{trend === 'up' ? 'Gain' : 'Loss'}</span>
        </div>
      )}
    </div>
  );
}

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(num);
}

export default function TaxDashboard() {
  const { userId } = useUser();

  const { data: profileData, isLoading: profileLoading, error: profileError } = useQuery({
    queryKey: ['taxProfile', userId],
    queryFn: () => taxApi.getProfile(userId),
    retry: false,
  });

  const { data: summaryData, refetch: refetchSummary } = useQuery({
    queryKey: ['taxSummary', userId, currentYear],
    queryFn: () => taxApi.getSummary(userId, currentYear),
    enabled: !!profileData?.data?.profile,
    retry: false,
  });

  const { data: transactionsData } = useQuery({
    queryKey: ['taxTransactions', userId],
    queryFn: () => taxApi.getTransactions(userId, { taxYear: currentYear }),
    enabled: !!profileData?.data?.profile,
  });

  const hasProfile = profileData?.data?.profile;
  const summary = summaryData?.data?.summary;
  const transactions = transactionsData?.data?.transactions || [];

  if (profileLoading) {
    return (
      <div className="p-8 flex items-center justify-center h-full">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-verity-400 animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading your tax dashboard...</p>
        </div>
      </div>
    );
  }

  // No profile - show setup prompt
  if (!hasProfile || profileError) {
    return (
      <div className="p-8">
        <div className="max-w-2xl mx-auto">
          <div className="bg-slate-800 rounded-xl p-8 border border-slate-700 text-center">
            <div className="w-16 h-16 rounded-full bg-verity-500/10 flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-verity-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Set Up Your Tax Profile</h2>
            <p className="text-slate-400 mb-6">
              Before you can calculate taxes, we need to know your tax jurisdiction and preferred cost basis method.
            </p>
            <Link
              to="/app/tax/settings"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-verity-600 hover:bg-verity-500 text-white font-medium transition-colors"
            >
              Get Started
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const netGainLoss = parseFloat(summary?.netGainLoss || '0');
  const isGain = netGainLoss >= 0;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Tax Dashboard</h1>
          <p className="text-slate-400">Tax Year {currentYear} · {profileData?.data?.profile?.taxResidence}</p>
        </div>
        <button
          onClick={() => refetchSummary()}
          className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 transition-colors flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Net Gain/Loss"
          value={formatCurrency(Math.abs(netGainLoss))}
          icon={isGain ? TrendingUp : TrendingDown}
          trend={isGain ? 'up' : 'down'}
          color={isGain ? 'green' : 'red'}
        />
        <StatCard
          title="Estimated Tax"
          value={formatCurrency(summary?.estimatedTax || '0')}
          icon={DollarSign}
          color="purple"
        />
        <StatCard
          title="Total Transactions"
          value={summary?.totalTransactions?.toString() || '0'}
          icon={Receipt}
          color="blue"
        />
        <StatCard
          title="Total Proceeds"
          value={formatCurrency(summary?.totalProceeds || '0')}
          icon={TrendingUp}
          color="green"
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Breakdown */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <h3 className="text-lg font-semibold text-white mb-4">Tax Breakdown</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-3 border-b border-slate-700">
              <span className="text-slate-400">Short-term Gains</span>
              <span className="text-green-400 font-medium">
                +{formatCurrency(summary?.shortTermGains || '0')}
              </span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-slate-700">
              <span className="text-slate-400">Short-term Losses</span>
              <span className="text-red-400 font-medium">
                -{formatCurrency(summary?.shortTermLosses || '0')}
              </span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-slate-700">
              <span className="text-slate-400">Long-term Gains</span>
              <span className="text-green-400 font-medium">
                +{formatCurrency(summary?.longTermGains || '0')}
              </span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-slate-700">
              <span className="text-slate-400">Long-term Losses</span>
              <span className="text-red-400 font-medium">
                -{formatCurrency(summary?.longTermLosses || '0')}
              </span>
            </div>
            <div className="flex justify-between items-center py-3 border-b border-slate-700">
              <span className="text-slate-400">Dividend Income</span>
              <span className="text-blue-400 font-medium">
                +{formatCurrency(summary?.dividendIncome || '0')}
              </span>
            </div>
            <div className="flex justify-between items-center py-3">
              <span className="text-slate-400">Staking Income</span>
              <span className="text-blue-400 font-medium">
                +{formatCurrency(summary?.stakingIncome || '0')}
              </span>
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Recent Transactions</h3>
            <Link to="/app/tax/transactions" className="text-verity-400 hover:text-verity-300 text-sm flex items-center gap-1">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          
          {transactions.length === 0 ? (
            <div className="text-center py-8">
              <Receipt className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No transactions yet</p>
              <Link 
                to="/app/tax/transactions" 
                className="text-verity-400 hover:text-verity-300 text-sm mt-2 inline-block"
              >
                Add your first transaction
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {transactions.slice(0, 5).map((tx: any) => (
                <div 
                  key={tx.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-700/50"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      tx.type === 'SELL' ? 'bg-red-500/20 text-red-400' :
                      tx.type === 'BUY' ? 'bg-green-500/20 text-green-400' :
                      'bg-blue-500/20 text-blue-400'
                    }`}>
                      {tx.type === 'SELL' ? <TrendingDown className="w-4 h-4" /> : 
                       tx.type === 'BUY' ? <TrendingUp className="w-4 h-4" /> :
                       <DollarSign className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{tx.type}</p>
                      <p className="text-slate-400 text-xs">{tx.asset}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white text-sm">{parseFloat(tx.amount).toLocaleString()}</p>
                    <p className="text-slate-400 text-xs">{formatCurrency(tx.totalValue)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-6 flex gap-4">
        <Link
          to="/app/tax/transactions"
          className="flex-1 p-4 rounded-xl bg-slate-800 border border-slate-700 hover:border-verity-500/50 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-verity-500/10 flex items-center justify-center group-hover:bg-verity-500/20 transition-colors">
              <Receipt className="w-5 h-5 text-verity-400" />
            </div>
            <div>
              <p className="text-white font-medium">Add Transaction</p>
              <p className="text-slate-400 text-sm">Record buys, sells, and more</p>
            </div>
          </div>
        </Link>
        <Link
          to="/app/tax/reports"
          className="flex-1 p-4 rounded-xl bg-slate-800 border border-slate-700 hover:border-verity-500/50 transition-colors group"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center group-hover:bg-green-500/20 transition-colors">
              <DollarSign className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-white font-medium">Generate Report</p>
              <p className="text-slate-400 text-sm">IRS 8949, HMRC, and more</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
