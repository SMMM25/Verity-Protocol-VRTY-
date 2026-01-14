import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '../App';
import { taxApi } from '../api/client';
import { 
  Plus, 
  Search, 
  Filter, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  X,
  Check,
  AlertCircle
} from 'lucide-react';

const transactionTypes = ['BUY', 'SELL', 'TRANSFER', 'DIVIDEND', 'STAKING_REWARD', 'AIRDROP'];

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(num);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

interface TransactionFormData {
  type: string;
  asset: string;
  amount: string;
  pricePerUnit: string;
  totalValue: string;
  fee: string;
  timestamp: string;
  transactionHash: string;
}

export default function TaxTransactions() {
  const { userId } = useUser();
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [formData, setFormData] = useState<TransactionFormData>({
    type: 'BUY',
    asset: 'VRTY',
    amount: '',
    pricePerUnit: '',
    totalValue: '',
    fee: '',
    timestamp: new Date().toISOString().slice(0, 16),
    transactionHash: '',
  });

  const { data: profileData } = useQuery({
    queryKey: ['taxProfile', userId],
    queryFn: () => taxApi.getProfile(userId),
    retry: false,
  });

  const { data: transactionsData, isLoading } = useQuery({
    queryKey: ['taxTransactions', userId],
    queryFn: () => taxApi.getTransactions(userId),
    enabled: !!profileData?.data?.profile,
  });

  const addTransactionMutation = useMutation({
    mutationFn: (data: TransactionFormData) => taxApi.recordTransaction(userId, {
      ...data,
      timestamp: new Date(data.timestamp).toISOString(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taxTransactions', userId] });
      queryClient.invalidateQueries({ queryKey: ['taxSummary', userId] });
      setShowAddModal(false);
      resetForm();
    },
  });

  const resetForm = () => {
    setFormData({
      type: 'BUY',
      asset: 'VRTY',
      amount: '',
      pricePerUnit: '',
      totalValue: '',
      fee: '',
      timestamp: new Date().toISOString().slice(0, 16),
      transactionHash: '',
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: value };
      
      // Auto-calculate total value
      if (name === 'amount' || name === 'pricePerUnit') {
        const amount = parseFloat(name === 'amount' ? value : prev.amount) || 0;
        const price = parseFloat(name === 'pricePerUnit' ? value : prev.pricePerUnit) || 0;
        updated.totalValue = (amount * price).toFixed(2);
      }
      
      return updated;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Generate a transaction hash if not provided
    const txHash = formData.transactionHash || `TX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    addTransactionMutation.mutate({
      ...formData,
      transactionHash: txHash,
    });
  };

  const transactions = transactionsData?.data?.transactions || [];
  const filteredTransactions = transactions.filter((tx: any) => {
    const matchesSearch = tx.asset.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          tx.transactionHash.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'ALL' || tx.type === filterType;
    return matchesSearch && matchesFilter;
  });

  const hasProfile = profileData?.data?.profile;

  if (!hasProfile) {
    return (
      <div className="p-8">
        <div className="max-w-2xl mx-auto text-center">
          <AlertCircle className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Profile Required</h2>
          <p className="text-slate-400">Please set up your tax profile first in Settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Transactions</h1>
          <p className="text-slate-400">Track all your crypto transactions</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 rounded-lg bg-verity-600 hover:bg-verity-500 text-white font-medium transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Transaction
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by asset or hash..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-verity-500"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="pl-10 pr-8 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:outline-none focus:border-verity-500 appearance-none cursor-pointer"
          >
            <option value="ALL">All Types</option>
            {transactionTypes.map(type => (
              <option key={type} value={type}>{type.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-400">Loading transactions...</div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-8 text-center">
            <DollarSign className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No transactions found</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="text-verity-400 hover:text-verity-300 mt-2"
            >
              Add your first transaction
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-700/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Asset</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Amount</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Price</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">Total Value</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filteredTransactions.map((tx: any) => (
                <tr key={tx.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        tx.type === 'SELL' ? 'bg-red-500/20 text-red-400' :
                        tx.type === 'BUY' ? 'bg-green-500/20 text-green-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {tx.type === 'SELL' ? <TrendingDown className="w-4 h-4" /> : 
                         tx.type === 'BUY' ? <TrendingUp className="w-4 h-4" /> :
                         <DollarSign className="w-4 h-4" />}
                      </div>
                      <span className="text-white font-medium">{tx.type.replace('_', ' ')}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-white">{tx.asset}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <span className="text-white">{parseFloat(tx.amount).toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <span className="text-slate-400">{formatCurrency(tx.pricePerUnit)}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <span className="text-white font-medium">{formatCurrency(tx.totalValue)}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-slate-400">{formatDate(tx.timestamp)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Transaction Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <h2 className="text-xl font-bold text-white">Add Transaction</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Type</label>
                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white focus:outline-none focus:border-verity-500"
                  >
                    {transactionTypes.map(type => (
                      <option key={type} value={type}>{type.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Asset</label>
                  <input
                    type="text"
                    name="asset"
                    value={formData.asset}
                    onChange={handleInputChange}
                    placeholder="e.g., VRTY, BTC, ETH"
                    className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-verity-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Amount</label>
                  <input
                    type="number"
                    name="amount"
                    value={formData.amount}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    step="any"
                    className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-verity-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Price per Unit ($)</label>
                  <input
                    type="number"
                    name="pricePerUnit"
                    value={formData.pricePerUnit}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    step="any"
                    className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-verity-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Total Value ($)</label>
                  <input
                    type="number"
                    name="totalValue"
                    value={formData.totalValue}
                    onChange={handleInputChange}
                    placeholder="Auto-calculated"
                    step="any"
                    className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-verity-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Fee ($)</label>
                  <input
                    type="number"
                    name="fee"
                    value={formData.fee}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    step="any"
                    className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-verity-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Date & Time</label>
                <input
                  type="datetime-local"
                  name="timestamp"
                  value={formData.timestamp}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white focus:outline-none focus:border-verity-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-1">Transaction Hash (optional)</label>
                <input
                  type="text"
                  name="transactionHash"
                  value={formData.transactionHash}
                  onChange={handleInputChange}
                  placeholder="Leave empty to auto-generate"
                  className="w-full px-3 py-2 rounded-lg bg-slate-700 border border-slate-600 text-white placeholder-slate-500 focus:outline-none focus:border-verity-500"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg bg-slate-700 text-white hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addTransactionMutation.isPending}
                  className="flex-1 px-4 py-2 rounded-lg bg-verity-600 text-white hover:bg-verity-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {addTransactionMutation.isPending ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Add Transaction
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
