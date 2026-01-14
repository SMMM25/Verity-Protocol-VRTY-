/**
 * Verity Protocol - Dividend Distribution Tracker
 * Comprehensive dividend management, scheduling, and tracking
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DollarSign,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Download,
  RefreshCw,
  ChevronRight,
  BarChart3,
  Activity,
  Loader2,
  Eye,
  History,
} from 'lucide-react';
import { assetsApi } from '../../api/client';
import type { TokenizedAsset, DividendDistribution } from '../../types/assets';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

interface DividendTrackerProps {
  asset: TokenizedAsset;
  isDemo?: boolean;
}

interface DividendScheduleFormData {
  totalAmount: string;
  currency: 'XRP' | 'VRTY' | 'USD';
  recordDate: string;
  paymentDate: string;
  dividendType: DividendDistribution['dividendType'];
  taxWithholdingRate: string;
  memo: string;
}

interface DividendStats {
  totalPaid: number;
  totalDistributions: number;
  averageAmount: number;
  averageYield: number;
  upcomingPayments: number;
  nextPaymentDate: string | null;
  nextPaymentAmount: number | null;
}

// ============================================================
// CONSTANTS
// ============================================================

const DIVIDEND_TYPES = [
  { id: 'REGULAR', label: 'Regular', description: 'Standard periodic dividend' },
  { id: 'SPECIAL', label: 'Special', description: 'One-time extra dividend' },
  { id: 'INTERIM', label: 'Interim', description: 'Mid-period dividend' },
  { id: 'FINAL', label: 'Final', description: 'Year-end dividend' },
];

const STATUS_CONFIG: Record<string, { color: string; bgColor: string; icon: typeof CheckCircle2; label: string }> = {
  SCHEDULED: { color: 'text-blue-700', bgColor: 'bg-blue-100', icon: Calendar, label: 'Scheduled' },
  PENDING: { color: 'text-yellow-700', bgColor: 'bg-yellow-100', icon: Clock, label: 'Pending' },
  PROCESSING: { color: 'text-indigo-700', bgColor: 'bg-indigo-100', icon: Activity, label: 'Processing' },
  COMPLETED: { color: 'text-green-700', bgColor: 'bg-green-100', icon: CheckCircle2, label: 'Completed' },
  FAILED: { color: 'text-red-700', bgColor: 'bg-red-100', icon: XCircle, label: 'Failed' },
};

const CURRENCIES = [
  { id: 'XRP', label: 'XRP', symbol: 'XRP' },
  { id: 'VRTY', label: 'VRTY', symbol: 'VRTY' },
  { id: 'USD', label: 'USD Stablecoin', symbol: 'USD' },
];

// Demo data
const DEMO_DISTRIBUTIONS: DividendDistribution[] = [
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
    assetId: 'asset_001',
    totalAmount: '2100000',
    currency: 'XRP',
    amountPerToken: '0.28',
    recordDate: '2025-09-30T00:00:00Z',
    paymentDate: '2025-10-15T00:00:00Z',
    status: 'COMPLETED',
    dividendType: 'REGULAR',
    eligibleHolders: 1189,
    totalEligibleTokens: '7500000',
    taxWithholdingRate: 0.15,
    paidAt: '2025-10-15T10:30:00Z',
    transactionHash: '0xabc123...def456',
  },
  {
    id: 'div_003',
    assetId: 'asset_001',
    totalAmount: '2050000',
    currency: 'XRP',
    amountPerToken: '0.273',
    recordDate: '2025-06-30T00:00:00Z',
    paymentDate: '2025-07-15T00:00:00Z',
    status: 'COMPLETED',
    dividendType: 'REGULAR',
    eligibleHolders: 1102,
    totalEligibleTokens: '7500000',
    taxWithholdingRate: 0.15,
    paidAt: '2025-07-15T09:45:00Z',
    transactionHash: '0x789ghi...jkl012',
  },
  {
    id: 'div_004',
    assetId: 'asset_001',
    totalAmount: '500000',
    currency: 'XRP',
    amountPerToken: '0.067',
    recordDate: '2025-12-15T00:00:00Z',
    paymentDate: '2025-12-20T00:00:00Z',
    status: 'COMPLETED',
    dividendType: 'SPECIAL',
    eligibleHolders: 1230,
    totalEligibleTokens: '7500000',
    taxWithholdingRate: 0.15,
    paidAt: '2025-12-20T11:00:00Z',
    transactionHash: '0xmno345...pqr678',
  },
  {
    id: 'div_005',
    assetId: 'asset_001',
    totalAmount: '1900000',
    currency: 'XRP',
    amountPerToken: '0.253',
    recordDate: '2025-03-31T00:00:00Z',
    paymentDate: '2025-04-15T00:00:00Z',
    status: 'COMPLETED',
    dividendType: 'REGULAR',
    eligibleHolders: 987,
    totalEligibleTokens: '7500000',
    taxWithholdingRate: 0.15,
    paidAt: '2025-04-15T08:30:00Z',
    transactionHash: '0xstu901...vwx234',
  },
];

const DEFAULT_FORM_DATA: DividendScheduleFormData = {
  totalAmount: '',
  currency: 'XRP',
  recordDate: '',
  paymentDate: '',
  dividendType: 'REGULAR',
  taxWithholdingRate: '15',
  memo: '',
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function formatCurrency(value: string | number, symbol?: string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  const formatted = num >= 1000000 
    ? `${(num / 1000000).toFixed(2)}M` 
    : num >= 1000 
      ? `${(num / 1000).toFixed(1)}K` 
      : num.toFixed(2);
  return symbol ? `${formatted} ${symbol}` : formatted;
}

function formatDate(dateString: string, includeTime = false): string {
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(includeTime && { hour: '2-digit', minute: '2-digit' }),
  };
  return new Date(dateString).toLocaleDateString('en-US', options);
}

function getDaysUntil(dateString: string): number {
  const now = new Date();
  const target = new Date(dateString);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatNumber(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return num.toLocaleString('en-US');
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function StatusBadge({ status }: { status: DividendDistribution['status'] }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
  const Icon = config.icon;
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}>
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  );
}

function DividendTypeBadge({ type }: { type: DividendDistribution['dividendType'] }) {
  const typeConfig = DIVIDEND_TYPES.find(t => t.id === type);
  const colorMap = {
    REGULAR: 'bg-gray-100 text-gray-700',
    SPECIAL: 'bg-purple-100 text-purple-700',
    INTERIM: 'bg-blue-100 text-blue-700',
    FINAL: 'bg-green-100 text-green-700',
  };
  
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${colorMap[type]}`}>
      {typeConfig?.label || type}
    </span>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  subValue,
  trend,
  color = 'indigo',
}: {
  icon: typeof DollarSign;
  label: string;
  value: string;
  subValue?: string;
  trend?: { value: number; label: string };
  color?: 'green' | 'blue' | 'indigo' | 'purple' | 'amber';
}) {
  const colorClasses = {
    green: 'bg-green-100 text-green-600',
    blue: 'bg-blue-100 text-blue-600',
    indigo: 'bg-indigo-100 text-indigo-600',
    purple: 'bg-purple-100 text-purple-600',
    amber: 'bg-amber-100 text-amber-600',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      {subValue && (
        <div className="text-sm text-gray-500 mt-1">{subValue}</div>
      )}
      {trend && (
        <div className={`flex items-center gap-1 mt-2 text-sm ${trend.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {trend.value >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
          {Math.abs(trend.value).toFixed(1)}% {trend.label}
        </div>
      )}
    </div>
  );
}

function ScheduleModal({
  isOpen,
  onClose,
  onSubmit,
  asset,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: DividendScheduleFormData) => void;
  asset: TokenizedAsset;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState<DividendScheduleFormData>(DEFAULT_FORM_DATA);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.totalAmount || parseFloat(formData.totalAmount) <= 0) {
      newErrors.totalAmount = 'Amount must be greater than 0';
    }
    
    if (!formData.recordDate) {
      newErrors.recordDate = 'Record date is required';
    }
    
    if (!formData.paymentDate) {
      newErrors.paymentDate = 'Payment date is required';
    } else if (new Date(formData.paymentDate) <= new Date(formData.recordDate)) {
      newErrors.paymentDate = 'Payment date must be after record date';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit(formData);
    }
  };

  // Calculate per-token amount
  const perTokenAmount = useMemo(() => {
    if (!formData.totalAmount || !asset.circulatingSupply) return null;
    return parseFloat(formData.totalAmount) / parseFloat(asset.circulatingSupply);
  }, [formData.totalAmount, asset.circulatingSupply]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Schedule Dividend Distribution</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <XCircle className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Amount & Currency */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total Amount <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.totalAmount}
                onChange={(e) => setFormData({ ...formData, totalAmount: e.target.value })}
                placeholder="e.g., 1000000"
                className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 ${
                  errors.totalAmount ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {errors.totalAmount && (
                <p className="text-xs text-red-500 mt-1">{errors.totalAmount}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value as DividendScheduleFormData['currency'] })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Per-Token Calculation */}
          {perTokenAmount && (
            <div className="p-4 bg-indigo-50 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-sm text-indigo-700">Per Token Amount</span>
                <span className="font-bold text-indigo-900">
                  {perTokenAmount.toFixed(6)} {formData.currency}
                </span>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-sm text-indigo-700">Eligible Tokens</span>
                <span className="font-medium text-indigo-900">
                  {formatNumber(asset.circulatingSupply || '0')} {asset.symbol}
                </span>
              </div>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Record Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.recordDate}
                onChange={(e) => setFormData({ ...formData, recordDate: e.target.value })}
                className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 ${
                  errors.recordDate ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {errors.recordDate && (
                <p className="text-xs text-red-500 mt-1">{errors.recordDate}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">Snapshot date for eligible holders</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Payment Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.paymentDate}
                onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
                className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 ${
                  errors.paymentDate ? 'border-red-300' : 'border-gray-300'
                }`}
              />
              {errors.paymentDate && (
                <p className="text-xs text-red-500 mt-1">{errors.paymentDate}</p>
              )}
              <p className="text-xs text-gray-500 mt-1">Distribution execution date</p>
            </div>
          </div>

          {/* Type & Tax */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Dividend Type</label>
              <select
                value={formData.dividendType}
                onChange={(e) => setFormData({ ...formData, dividendType: e.target.value as DividendDistribution['dividendType'] })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                {DIVIDEND_TYPES.map((type) => (
                  <option key={type.id} value={type.id}>{type.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tax Withholding (%)
              </label>
              <input
                type="number"
                value={formData.taxWithholdingRate}
                onChange={(e) => setFormData({ ...formData, taxWithholdingRate: e.target.value })}
                placeholder="e.g., 15"
                min="0"
                max="100"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Memo */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Memo (Optional)</label>
            <textarea
              value={formData.memo}
              onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
              placeholder="Add a note for this distribution..."
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              Schedule Distribution
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function DistributionCard({ distribution, asset: _asset }: { distribution: DividendDistribution; asset: TokenizedAsset }) {
  const daysUntil = distribution.status === 'SCHEDULED' ? getDaysUntil(distribution.paymentDate) : null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-xl ${
            distribution.status === 'COMPLETED' ? 'bg-green-100' : 
            distribution.status === 'SCHEDULED' ? 'bg-blue-100' : 'bg-yellow-100'
          }`}>
            {distribution.status === 'COMPLETED' ? (
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            ) : distribution.status === 'SCHEDULED' ? (
              <Calendar className="w-6 h-6 text-blue-600" />
            ) : (
              <Clock className="w-6 h-6 text-yellow-600" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <StatusBadge status={distribution.status} />
              <DividendTypeBadge type={distribution.dividendType} />
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {distribution.status === 'SCHEDULED' 
                ? `Payment in ${daysUntil} days`
                : distribution.paidAt 
                  ? `Paid on ${formatDate(distribution.paidAt)}`
                  : formatDate(distribution.paymentDate)
              }
            </div>
          </div>
        </div>
        <button className="p-2 hover:bg-gray-100 rounded-lg">
          <Eye className="w-4 h-4 text-gray-400" />
        </button>
      </div>

      <div className="text-2xl font-bold text-gray-900 mb-4">
        {formatCurrency(distribution.totalAmount, distribution.currency)}
      </div>

      <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100">
        <div>
          <div className="text-xs text-gray-500 mb-1">Per Token</div>
          <div className="font-medium text-gray-900">
            {distribution.amountPerToken} {distribution.currency}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">Eligible Holders</div>
          <div className="font-medium text-gray-900">
            {formatNumber(distribution.eligibleHolders)}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">Record Date</div>
          <div className="font-medium text-gray-900">
            {formatDate(distribution.recordDate)}
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">Tax Withholding</div>
          <div className="font-medium text-gray-900">
            {((distribution.taxWithholdingRate || 0) * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      {distribution.transactionHash && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <a 
            href={`https://xrpscan.com/tx/${distribution.transactionHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
          >
            View Transaction
            <ChevronRight className="w-4 h-4" />
          </a>
        </div>
      )}
    </div>
  );
}

// Timeline Component
function DividendTimeline({ distributions }: { distributions: DividendDistribution[] }) {
  const sortedDistributions = [...distributions].sort(
    (a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="font-semibold text-gray-900 mb-6 flex items-center gap-2">
        <History className="w-5 h-5 text-indigo-600" />
        Distribution History
      </h3>
      
      <div className="space-y-4">
        {sortedDistributions.map((dist, index) => {
          const config = STATUS_CONFIG[dist.status];
          const Icon = config.icon;
          
          return (
            <div key={dist.id} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${config.bgColor}`}>
                  <Icon className={`w-5 h-5 ${config.color}`} />
                </div>
                {index < sortedDistributions.length - 1 && (
                  <div className="w-0.5 h-full bg-gray-200 my-2" />
                )}
              </div>
              
              <div className="flex-1 pb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900">
                      {formatCurrency(dist.totalAmount, dist.currency)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {dist.amountPerToken} per token • {formatNumber(dist.eligibleHolders)} holders
                    </div>
                  </div>
                  <div className="text-right">
                    <DividendTypeBadge type={dist.dividendType} />
                    <div className="text-sm text-gray-500 mt-1">
                      {formatDate(dist.paymentDate)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function DividendTracker({ asset, isDemo = true }: DividendTrackerProps) {
  const queryClient = useQueryClient();
  
  // State
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | DividendDistribution['status']>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'timeline'>('cards');

  // Queries
  const { data: dividendsData, isLoading } = useQuery({
    queryKey: ['dividends', asset.id],
    queryFn: () => assetsApi.getDividendHistory(asset.id),
    enabled: !isDemo,
  });

  // Mutations
  const scheduleMutation = useMutation({
    mutationFn: (data: DividendScheduleFormData) => assetsApi.distributeDividends(asset.id, {
      totalAmount: data.totalAmount,
      currency: data.currency,
      recordDate: data.recordDate,
      paymentDate: data.paymentDate,
      dividendType: data.dividendType,
      taxWithholdingRate: parseFloat(data.taxWithholdingRate) / 100,
      memo: data.memo,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dividends', asset.id] });
      setShowScheduleModal(false);
    },
  });

  // Use demo or API data
  const distributions: DividendDistribution[] = isDemo ? DEMO_DISTRIBUTIONS : (dividendsData?.data || []);

  // Filter distributions
  const filteredDistributions = useMemo(() => {
    if (filterStatus === 'all') return distributions;
    return distributions.filter(d => d.status === filterStatus);
  }, [distributions, filterStatus]);

  // Calculate stats
  const stats = useMemo((): DividendStats => {
    const completed = distributions.filter(d => d.status === 'COMPLETED');
    const upcoming = distributions.filter(d => d.status === 'SCHEDULED' || d.status === 'PENDING');
    const nextPayment = upcoming.sort(
      (a, b) => new Date(a.paymentDate).getTime() - new Date(b.paymentDate).getTime()
    )[0];

    const totalPaid = completed.reduce((sum, d) => sum + parseFloat(d.totalAmount), 0);
    const averageAmount = completed.length > 0 ? totalPaid / completed.length : 0;
    
    // Calculate yield based on asset value
    const assetValue = asset.financials?.totalValueUSD || 1;
    const averageYield = (totalPaid / assetValue) * 100;

    return {
      totalPaid,
      totalDistributions: completed.length,
      averageAmount,
      averageYield,
      upcomingPayments: upcoming.length,
      nextPaymentDate: nextPayment?.paymentDate || null,
      nextPaymentAmount: nextPayment ? parseFloat(nextPayment.totalAmount) : null,
    };
  }, [distributions, asset]);

  // Handler
  const handleSchedule = (data: DividendScheduleFormData) => {
    if (isDemo) {
      console.log('Demo mode: Schedule dividend', data);
      setShowScheduleModal(false);
    } else {
      scheduleMutation.mutate(data);
    }
  };

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-green-600" />
            Dividend Distribution
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage and track dividend payments for {asset.symbol}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2">
            <Download className="w-4 h-4" />
            Export History
          </button>
          <button
            onClick={() => setShowScheduleModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Schedule Dividend
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={DollarSign}
          label="Total Paid"
          value={formatCurrency(stats.totalPaid)}
          subValue={`${stats.totalDistributions} distributions`}
          color="green"
        />
        <StatCard
          icon={Percent}
          label="Average Yield"
          value={`${stats.averageYield.toFixed(2)}%`}
          subValue="Annual rate"
          color="blue"
        />
        <StatCard
          icon={Calendar}
          label="Upcoming"
          value={stats.upcomingPayments.toString()}
          subValue={stats.nextPaymentDate ? `Next: ${formatDate(stats.nextPaymentDate)}` : 'No scheduled'}
          color="indigo"
        />
        <StatCard
          icon={TrendingUp}
          label="Next Payment"
          value={stats.nextPaymentAmount ? formatCurrency(stats.nextPaymentAmount) : 'N/A'}
          subValue={stats.nextPaymentDate ? `in ${getDaysUntil(stats.nextPaymentDate)} days` : 'Not scheduled'}
          color="purple"
        />
      </div>

      {/* Expected Yield Banner */}
      {asset.financials?.dividendYield && (
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold mb-1">Expected Annual Yield</h3>
              <p className="text-green-100 text-sm">Based on current asset value and distribution history</p>
            </div>
            <div className="text-4xl font-bold">
              {asset.financials.dividendYield.toFixed(2)}%
            </div>
          </div>
        </div>
      )}

      {/* Filter & View Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Distributions</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="COMPLETED">Completed</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
          </select>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['dividends', asset.id] })}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        
        <div className="flex items-center gap-2 border border-gray-300 rounded-lg p-1">
          <button
            onClick={() => setViewMode('cards')}
            className={`p-2 rounded ${viewMode === 'cards' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            <BarChart3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('timeline')}
            className={`p-2 rounded ${viewMode === 'timeline' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            <History className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
      ) : filteredDistributions.length === 0 ? (
        <div className="text-center py-12">
          <DollarSign className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Dividend History</h3>
          <p className="text-gray-500 mb-6 max-w-sm mx-auto">
            Schedule your first dividend distribution to start paying out returns to token holders.
          </p>
          <button
            onClick={() => setShowScheduleModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Plus className="w-4 h-4" />
            Schedule First Dividend
          </button>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDistributions.map((dist) => (
            <DistributionCard key={dist.id} distribution={dist} asset={asset} />
          ))}
        </div>
      ) : (
        <DividendTimeline distributions={filteredDistributions} />
      )}

      {/* Schedule Modal */}
      <ScheduleModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        onSubmit={handleSchedule}
        asset={asset}
        isLoading={scheduleMutation.isPending}
      />
    </div>
  );
}
