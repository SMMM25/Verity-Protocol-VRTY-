/**
 * Verity Protocol - Investor Whitelist Manager
 * Full CRUD management for asset whitelists with KYC verification
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  UserPlus,
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  Download,
  Upload,
  MoreVertical,
  Eye,
  Edit2,
  Trash2,
  ChevronDown,
  Award,
  Loader2,
} from 'lucide-react';
import { assetsApi } from '../../api/client';
import type { WhitelistEntry, TokenizedAsset } from '../../types/assets';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

interface WhitelistManagerProps {
  asset: TokenizedAsset;
  isDemo?: boolean;
}

interface AddWhitelistFormData {
  address: string;
  kycLevel: number;
  jurisdiction: string;
  accreditedInvestor: boolean;
  qualifiedPurchaser: boolean;
  investorType: string;
  maxAllocation: string;
  expiresAt: string;
  verificationDocumentHash: string;
}

interface FilterState {
  search: string;
  status: 'all' | 'ACTIVE' | 'PENDING' | 'EXPIRED' | 'REVOKED';
  kycLevel: 'all' | '0' | '1' | '2' | '3';
  jurisdiction: string;
  investorType: 'all' | 'INDIVIDUAL' | 'INSTITUTIONAL' | 'FUND' | 'TRUST';
}

// ============================================================
// CONSTANTS
// ============================================================

const KYC_LEVELS = [
  { level: 0, name: 'None', description: 'No KYC verification', color: 'gray' },
  { level: 1, name: 'Basic', description: 'Email and name verified', color: 'blue' },
  { level: 2, name: 'Standard', description: 'ID and address verified', color: 'green' },
  { level: 3, name: 'Enhanced', description: 'Full verification with AML check', color: 'purple' },
];

const INVESTOR_TYPES = [
  { id: 'INDIVIDUAL', label: 'Individual' },
  { id: 'INSTITUTIONAL', label: 'Institutional' },
  { id: 'FUND', label: 'Investment Fund' },
  { id: 'TRUST', label: 'Trust' },
];

const STATUS_CONFIG: Record<string, { color: string; bgColor: string; icon: typeof CheckCircle2 }> = {
  ACTIVE: { color: 'text-green-700', bgColor: 'bg-green-100', icon: CheckCircle2 },
  PENDING: { color: 'text-yellow-700', bgColor: 'bg-yellow-100', icon: Clock },
  EXPIRED: { color: 'text-gray-700', bgColor: 'bg-gray-100', icon: XCircle },
  REVOKED: { color: 'text-red-700', bgColor: 'bg-red-100', icon: XCircle },
};

const JURISDICTIONS = [
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'EU', name: 'European Union', flag: '🇪🇺' },
  { code: 'UK', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭' },
  { code: 'HK', name: 'Hong Kong', flag: '🇭🇰' },
  { code: 'AE', name: 'UAE', flag: '🇦🇪' },
];

// Demo data
const DEMO_WHITELIST: WhitelistEntry[] = [
  {
    address: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
    kycLevel: 3,
    jurisdiction: 'US',
    accreditedInvestor: true,
    qualifiedPurchaser: true,
    investorType: 'INSTITUTIONAL',
    maxAllocation: '500000',
    addedAt: '2025-08-15T00:00:00Z',
    status: 'ACTIVE',
    verificationDocumentHash: '0x123...abc',
  },
  {
    address: 'rLNaPoKeeBjZe2qs6x52yVPH5ZzDPnTkJF',
    kycLevel: 2,
    jurisdiction: 'EU',
    accreditedInvestor: true,
    qualifiedPurchaser: false,
    investorType: 'INDIVIDUAL',
    maxAllocation: '100000',
    addedAt: '2025-09-20T00:00:00Z',
    status: 'ACTIVE',
  },
  {
    address: 'rPCFVxAqP2XdaPmih1ZSjmCPNxoyMiy2ne',
    kycLevel: 3,
    jurisdiction: 'SG',
    accreditedInvestor: true,
    qualifiedPurchaser: true,
    investorType: 'FUND',
    maxAllocation: '1000000',
    addedAt: '2025-10-01T00:00:00Z',
    status: 'ACTIVE',
  },
  {
    address: 'rMwjYedjc7qqtKYVLiAccJSmCwih4LnE2q',
    kycLevel: 1,
    jurisdiction: 'UK',
    accreditedInvestor: false,
    qualifiedPurchaser: false,
    investorType: 'INDIVIDUAL',
    addedAt: '2025-11-15T00:00:00Z',
    expiresAt: '2026-02-15T00:00:00Z',
    status: 'PENDING',
  },
  {
    address: 'rBTwLga3i2gz3doX6Gva3MgEV8ZCD8jjah',
    kycLevel: 2,
    jurisdiction: 'JP',
    accreditedInvestor: true,
    qualifiedPurchaser: false,
    investorType: 'TRUST',
    maxAllocation: '250000',
    addedAt: '2025-07-01T00:00:00Z',
    expiresAt: '2026-01-01T00:00:00Z',
    status: 'EXPIRED',
  },
];

const DEFAULT_FORM_DATA: AddWhitelistFormData = {
  address: '',
  kycLevel: 1,
  jurisdiction: 'US',
  accreditedInvestor: false,
  qualifiedPurchaser: false,
  investorType: 'INDIVIDUAL',
  maxAllocation: '',
  expiresAt: '',
  verificationDocumentHash: '',
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function formatAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (num >= 1000000) return `$${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `$${(num / 1000).toFixed(0)}K`;
  return `$${num.toFixed(0)}`;
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function StatusBadge({ status }: { status: WhitelistEntry['status'] }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.PENDING;
  const Icon = config.icon;
  
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}>
      <Icon className="w-3.5 h-3.5" />
      {status}
    </span>
  );
}

function KYCBadge({ level }: { level: number }) {
  const kycConfig = KYC_LEVELS.find(k => k.level === level) || KYC_LEVELS[0];
  const colorClasses = {
    gray: 'bg-gray-100 text-gray-700',
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    purple: 'bg-purple-100 text-purple-700',
  };
  
  return (
    <span className={`px-2 py-1 rounded text-xs font-medium ${colorClasses[kycConfig.color as keyof typeof colorClasses]}`}>
      KYC {kycConfig.name}
    </span>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="text-center py-12">
      <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">No Whitelisted Investors</h3>
      <p className="text-gray-500 mb-6 max-w-sm mx-auto">
        Start by adding investors to your whitelist. They'll be able to purchase and hold tokens.
      </p>
      <button
        onClick={onAdd}
        className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
      >
        <UserPlus className="w-4 h-4" />
        Add First Investor
      </button>
    </div>
  );
}

// Add/Edit Modal
function WhitelistModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  mode,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: AddWhitelistFormData) => void;
  initialData?: AddWhitelistFormData;
  mode: 'add' | 'edit';
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState<AddWhitelistFormData>(initialData || DEFAULT_FORM_DATA);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.address) {
      newErrors.address = 'Wallet address is required';
    } else if (!formData.address.startsWith('r') || formData.address.length < 25) {
      newErrors.address = 'Invalid XRPL wallet address';
    }
    
    if (!formData.jurisdiction) {
      newErrors.jurisdiction = 'Jurisdiction is required';
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {mode === 'add' ? 'Add Investor to Whitelist' : 'Edit Whitelist Entry'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <XCircle className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Wallet Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Wallet Address <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
              disabled={mode === 'edit'}
              className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono ${
                errors.address ? 'border-red-300' : 'border-gray-300'
              } ${mode === 'edit' ? 'bg-gray-50' : ''}`}
            />
            {errors.address && (
              <p className="text-xs text-red-500 mt-1">{errors.address}</p>
            )}
          </div>

          {/* KYC Level & Jurisdiction */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                KYC Level
              </label>
              <select
                value={formData.kycLevel}
                onChange={(e) => setFormData({ ...formData, kycLevel: parseInt(e.target.value) })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                {KYC_LEVELS.map((kyc) => (
                  <option key={kyc.level} value={kyc.level}>
                    Level {kyc.level} - {kyc.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Jurisdiction <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.jurisdiction}
                onChange={(e) => setFormData({ ...formData, jurisdiction: e.target.value })}
                className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 ${
                  errors.jurisdiction ? 'border-red-300' : 'border-gray-300'
                }`}
              >
                {JURISDICTIONS.map((j) => (
                  <option key={j.code} value={j.code}>
                    {j.flag} {j.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Investor Type & Max Allocation */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Investor Type
              </label>
              <select
                value={formData.investorType}
                onChange={(e) => setFormData({ ...formData, investorType: e.target.value })}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                {INVESTOR_TYPES.map((type) => (
                  <option key={type.id} value={type.id}>{type.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Allocation (USD)
              </label>
              <input
                type="number"
                value={formData.maxAllocation}
                onChange={(e) => setFormData({ ...formData, maxAllocation: e.target.value })}
                placeholder="Leave empty for unlimited"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Accreditation Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <input
                type="checkbox"
                id="accredited"
                checked={formData.accreditedInvestor}
                onChange={(e) => setFormData({ ...formData, accreditedInvestor: e.target.checked })}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <label htmlFor="accredited" className="flex-1">
                <div className="font-medium text-gray-900">Accredited Investor</div>
                <div className="text-xs text-gray-500">Meets SEC accreditation requirements</div>
              </label>
            </div>

            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              <input
                type="checkbox"
                id="qualified"
                checked={formData.qualifiedPurchaser}
                onChange={(e) => setFormData({ ...formData, qualifiedPurchaser: e.target.checked })}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <label htmlFor="qualified" className="flex-1">
                <div className="font-medium text-gray-900">Qualified Purchaser</div>
                <div className="text-xs text-gray-500">$5M+ in investments</div>
              </label>
            </div>
          </div>

          {/* Expiration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Expiration Date (Optional)
            </label>
            <input
              type="date"
              value={formData.expiresAt}
              onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-gray-500 mt-1">Leave empty for permanent access</p>
          </div>

          {/* Verification Document */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Verification Document Hash
            </label>
            <input
              type="text"
              value={formData.verificationDocumentHash}
              onChange={(e) => setFormData({ ...formData, verificationDocumentHash: e.target.value })}
              placeholder="0x..."
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 font-mono"
            />
            <p className="text-xs text-gray-500 mt-1">IPFS or on-chain document hash for verification</p>
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
              {mode === 'add' ? 'Add to Whitelist' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Confirm Dialog
function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  isDestructive,
  isLoading,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel: string;
  isDestructive?: boolean;
  isLoading?: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 rounded-lg text-white flex items-center gap-2 ${
              isDestructive
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-indigo-600 hover:bg-indigo-700'
            } disabled:opacity-50`}
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function WhitelistManager({ asset, isDemo = true }: WhitelistManagerProps) {
  const queryClient = useQueryClient();
  
  // State
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    status: 'all',
    kycLevel: 'all',
    jurisdiction: '',
    investorType: 'all',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<WhitelistEntry | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<WhitelistEntry | null>(null);
  const [selectedEntries, setSelectedEntries] = useState<string[]>([]);
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null);

  // Queries
  const { data: whitelistData, isLoading } = useQuery({
    queryKey: ['whitelist', asset.id],
    queryFn: () => assetsApi.getWhitelist(asset.id),
    enabled: !isDemo,
  });

  // Mutations
  const addMutation = useMutation({
    mutationFn: (data: AddWhitelistFormData) => assetsApi.addToWhitelist(asset.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whitelist', asset.id] });
      setShowAddModal(false);
    },
  });

  const removeMutation = useMutation({
    mutationFn: (address: string) => assetsApi.removeFromWhitelist(asset.id, address, 'Manual removal'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whitelist', asset.id] });
      setDeletingEntry(null);
    },
  });

  // Use demo data or API data
  const whitelist: WhitelistEntry[] = isDemo ? DEMO_WHITELIST : (whitelistData?.data || []);

  // Filter whitelist
  const filteredWhitelist = useMemo(() => {
    let filtered = whitelist;

    if (filters.search) {
      const search = filters.search.toLowerCase();
      filtered = filtered.filter(entry =>
        entry.address.toLowerCase().includes(search)
      );
    }

    if (filters.status !== 'all') {
      filtered = filtered.filter(entry => entry.status === filters.status);
    }

    if (filters.kycLevel !== 'all') {
      filtered = filtered.filter(entry => entry.kycLevel === parseInt(filters.kycLevel));
    }

    if (filters.jurisdiction) {
      filtered = filtered.filter(entry => entry.jurisdiction === filters.jurisdiction);
    }

    if (filters.investorType !== 'all') {
      filtered = filtered.filter(entry => entry.investorType === filters.investorType);
    }

    return filtered;
  }, [whitelist, filters]);

  // Stats
  const stats = useMemo(() => {
    const active = whitelist.filter(e => e.status === 'ACTIVE').length;
    const pending = whitelist.filter(e => e.status === 'PENDING').length;
    const accredited = whitelist.filter(e => e.accreditedInvestor).length;
    const totalAllocation = whitelist.reduce((sum, e) => {
      return sum + (e.maxAllocation ? parseFloat(e.maxAllocation) : 0);
    }, 0);

    return { active, pending, accredited, totalAllocation };
  }, [whitelist]);

  // Handlers
  const handleAdd = (data: AddWhitelistFormData) => {
    if (isDemo) {
      console.log('Demo mode: Add whitelist entry', data);
      setShowAddModal(false);
    } else {
      addMutation.mutate(data);
    }
  };

  const handleRemove = () => {
    if (deletingEntry) {
      if (isDemo) {
        console.log('Demo mode: Remove whitelist entry', deletingEntry.address);
        setDeletingEntry(null);
      } else {
        removeMutation.mutate(deletingEntry.address);
      }
    }
  };

  const toggleSelectAll = () => {
    if (selectedEntries.length === filteredWhitelist.length) {
      setSelectedEntries([]);
    } else {
      setSelectedEntries(filteredWhitelist.map(e => e.address));
    }
  };

  const toggleSelect = (address: string) => {
    if (selectedEntries.includes(address)) {
      setSelectedEntries(selectedEntries.filter(a => a !== address));
    } else {
      setSelectedEntries([...selectedEntries, address]);
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
            <Users className="w-6 h-6 text-indigo-600" />
            Investor Whitelist
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Manage authorized investors for {asset.symbol}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </button>
          <button
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
          >
            <UserPlus className="w-4 h-4" />
            Add Investor
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-sm text-gray-500">Active</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.active}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
            <span className="text-sm text-gray-500">Pending</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.pending}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Award className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-sm text-gray-500">Accredited</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.accredited}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Shield className="w-5 h-5 text-indigo-600" />
            </div>
            <span className="text-sm text-gray-500">Total Allocation</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {formatCurrency(stats.totalAllocation)}
          </div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by wallet address..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2">
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value as FilterState['status'] })}
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="PENDING">Pending</option>
              <option value="EXPIRED">Expired</option>
              <option value="REVOKED">Revoked</option>
            </select>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`px-4 py-2.5 border rounded-lg flex items-center gap-2 transition-colors ${
                showFilters
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-600'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">KYC Level</label>
              <select
                value={filters.kycLevel}
                onChange={(e) => setFilters({ ...filters, kycLevel: e.target.value as FilterState['kycLevel'] })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Levels</option>
                {KYC_LEVELS.map((kyc) => (
                  <option key={kyc.level} value={kyc.level.toString()}>
                    Level {kyc.level} - {kyc.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Jurisdiction</label>
              <select
                value={filters.jurisdiction}
                onChange={(e) => setFilters({ ...filters, jurisdiction: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Jurisdictions</option>
                {JURISDICTIONS.map((j) => (
                  <option key={j.code} value={j.code}>
                    {j.flag} {j.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Investor Type</label>
              <select
                value={filters.investorType}
                onChange={(e) => setFilters({ ...filters, investorType: e.target.value as FilterState['investorType'] })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Types</option>
                {INVESTOR_TYPES.map((type) => (
                  <option key={type.id} value={type.id}>{type.label}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
        </div>
      ) : filteredWhitelist.length === 0 ? (
        <EmptyState onAdd={() => setShowAddModal(true)} />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Bulk Actions */}
          {selectedEntries.length > 0 && (
            <div className="bg-indigo-50 border-b border-indigo-200 px-6 py-3 flex items-center justify-between">
              <span className="text-sm font-medium text-indigo-700">
                {selectedEntries.length} investor{selectedEntries.length > 1 ? 's' : ''} selected
              </span>
              <div className="flex items-center gap-2">
                <button className="px-3 py-1.5 text-sm border border-indigo-300 text-indigo-700 rounded hover:bg-indigo-100">
                  Extend Expiry
                </button>
                <button className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700">
                  Remove Selected
                </button>
              </div>
            </div>
          )}

          {/* Table */}
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="w-12 px-6 py-4">
                  <input
                    type="checkbox"
                    checked={selectedEntries.length === filteredWhitelist.length && filteredWhitelist.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                </th>
                <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase">Investor</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase">KYC</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase">Jurisdiction</th>
                <th className="text-left px-6 py-4 text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="text-right px-6 py-4 text-xs font-medium text-gray-500 uppercase">Allocation</th>
                <th className="text-center px-6 py-4 text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="text-right px-6 py-4 text-xs font-medium text-gray-500 uppercase">Added</th>
                <th className="w-12 px-6 py-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredWhitelist.map((entry) => {
                const jurisdiction = JURISDICTIONS.find(j => j.code === entry.jurisdiction);
                
                return (
                  <tr key={entry.address} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedEntries.includes(entry.address)}
                        onChange={() => toggleSelect(entry.address)}
                        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-mono text-sm text-gray-900">
                        {formatAddress(entry.address)}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {entry.accreditedInvestor && (
                          <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                            Accredited
                          </span>
                        )}
                        {entry.qualifiedPurchaser && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">
                            QP
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <KYCBadge level={entry.kycLevel} />
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-2 text-sm">
                        <span>{jurisdiction?.flag}</span>
                        <span className="text-gray-700">{entry.jurisdiction}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700">
                      {entry.investorType || 'Individual'}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                      {entry.maxAllocation ? formatCurrency(entry.maxAllocation) : '∞'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <StatusBadge status={entry.status} />
                    </td>
                    <td className="px-6 py-4 text-right text-sm text-gray-500">
                      {formatDate(entry.addedAt)}
                    </td>
                    <td className="px-6 py-4 relative">
                      <button
                        onClick={() => setActionMenuOpen(actionMenuOpen === entry.address ? null : entry.address)}
                        className="p-2 hover:bg-gray-100 rounded-lg"
                      >
                        <MoreVertical className="w-4 h-4 text-gray-400" />
                      </button>
                      
                      {actionMenuOpen === entry.address && (
                        <div className="absolute right-6 top-12 z-10 bg-white rounded-lg shadow-lg border border-gray-200 py-1 w-40">
                          <button
                            onClick={() => {
                              setEditingEntry(entry);
                              setActionMenuOpen(null);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <Edit2 className="w-4 h-4" />
                            Edit
                          </button>
                          <button
                            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <Eye className="w-4 h-4" />
                            View Details
                          </button>
                          <button
                            onClick={() => {
                              setDeletingEntry(entry);
                              setActionMenuOpen(null);
                            }}
                            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                          >
                            <Trash2 className="w-4 h-4" />
                            Remove
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Pagination */}
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing {filteredWhitelist.length} of {whitelist.length} investors
            </p>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:opacity-50" disabled>
                Previous
              </button>
              <button className="px-3 py-1 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:opacity-50" disabled>
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Modal */}
      <WhitelistModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAdd}
        mode="add"
        isLoading={addMutation.isPending}
      />

      {/* Edit Modal */}
      {editingEntry && (
        <WhitelistModal
          isOpen={!!editingEntry}
          onClose={() => setEditingEntry(null)}
          onSubmit={(data) => {
            console.log('Update entry', data);
            setEditingEntry(null);
          }}
          initialData={{
            address: editingEntry.address,
            kycLevel: editingEntry.kycLevel,
            jurisdiction: editingEntry.jurisdiction,
            accreditedInvestor: editingEntry.accreditedInvestor,
            qualifiedPurchaser: editingEntry.qualifiedPurchaser,
            investorType: editingEntry.investorType || 'INDIVIDUAL',
            maxAllocation: editingEntry.maxAllocation || '',
            expiresAt: editingEntry.expiresAt || '',
            verificationDocumentHash: editingEntry.verificationDocumentHash || '',
          }}
          mode="edit"
          isLoading={false}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingEntry}
        onClose={() => setDeletingEntry(null)}
        onConfirm={handleRemove}
        title="Remove from Whitelist"
        message={`Are you sure you want to remove ${deletingEntry?.address ? formatAddress(deletingEntry.address) : ''} from the whitelist? They will no longer be able to hold or trade ${asset.symbol} tokens.`}
        confirmLabel="Remove"
        isDestructive
        isLoading={removeMutation.isPending}
      />
    </div>
  );
}
