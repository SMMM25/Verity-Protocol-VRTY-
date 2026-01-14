/**
 * Verity Protocol - XAO-DOW Compliance Display
 * Comprehensive compliance status, clawback governance, and audit trail
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Lock,
  Users,
  FileText,
  Globe,
  Scale,
  History,
  MessageSquare,
  Vote,
  ThumbsUp,
  ThumbsDown,
  ExternalLink,
  Copy,
  ChevronDown,
  Gavel,
  ShieldCheck,
  ShieldAlert,
  Activity,
} from 'lucide-react';
import { assetsApi } from '../../api/client';
import type { 
  TokenizedAsset, 
  ClawbackProposal, 
  ComplianceStatus,
  ClawbackReason,
} from '../../types/assets';

// ============================================================
// TYPE DEFINITIONS
// ============================================================

interface ComplianceDisplayProps {
  asset: TokenizedAsset;
  isDemo?: boolean;
}

interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  details: string;
  transactionHash?: string;
}

// ============================================================
// CONSTANTS
// ============================================================

const COMPLIANCE_STATUS_CONFIG: Record<ComplianceStatus, { 
  label: string; 
  color: string; 
  bgColor: string; 
  icon: typeof CheckCircle2;
  description: string;
}> = {
  COMPLIANT: { 
    label: 'Compliant', 
    color: 'text-green-700', 
    bgColor: 'bg-green-100', 
    icon: ShieldCheck,
    description: 'All compliance requirements met',
  },
  PENDING_REVIEW: { 
    label: 'Pending Review', 
    color: 'text-yellow-700', 
    bgColor: 'bg-yellow-100', 
    icon: Clock,
    description: 'Awaiting compliance review',
  },
  UNDER_REVIEW: { 
    label: 'Under Review', 
    color: 'text-blue-700', 
    bgColor: 'bg-blue-100', 
    icon: Eye,
    description: 'Currently being reviewed',
  },
  NON_COMPLIANT: { 
    label: 'Non-Compliant', 
    color: 'text-red-700', 
    bgColor: 'bg-red-100', 
    icon: ShieldAlert,
    description: 'Compliance issues detected',
  },
};

const CLAWBACK_STATUS_CONFIG: Record<string, {
  label: string;
  color: string;
  bgColor: string;
  icon: typeof Clock;
}> = {
  COMMENT_PERIOD: { label: 'Comment Period', color: 'text-blue-700', bgColor: 'bg-blue-100', icon: MessageSquare },
  VOTING: { label: 'Voting', color: 'text-purple-700', bgColor: 'bg-purple-100', icon: Vote },
  APPROVED: { label: 'Approved', color: 'text-green-700', bgColor: 'bg-green-100', icon: CheckCircle2 },
  EXECUTED: { label: 'Executed', color: 'text-gray-700', bgColor: 'bg-gray-100', icon: CheckCircle2 },
  CANCELLED: { label: 'Cancelled', color: 'text-red-700', bgColor: 'bg-red-100', icon: XCircle },
  DISPUTED: { label: 'Disputed', color: 'text-amber-700', bgColor: 'bg-amber-100', icon: Scale },
};

const CLAWBACK_REASONS: Record<ClawbackReason, { label: string; description: string; severity: 'high' | 'medium' | 'low' }> = {
  REGULATORY_REQUIREMENT: { 
    label: 'Regulatory Requirement', 
    description: 'Required by financial regulators',
    severity: 'high',
  },
  REGULATORY_COMPLIANCE: { 
    label: 'Regulatory Compliance', 
    description: 'To maintain regulatory compliance',
    severity: 'high',
  },
  COURT_ORDER: { 
    label: 'Court Order', 
    description: 'Mandated by legal court order',
    severity: 'high',
  },
  FRAUD_DETECTION: { 
    label: 'Fraud Detection', 
    description: 'Tokens involved in detected fraud',
    severity: 'high',
  },
  FRAUD_PREVENTION: { 
    label: 'Fraud Prevention', 
    description: 'Preventive measure against fraud',
    severity: 'medium',
  },
  SANCTIONS_COMPLIANCE: { 
    label: 'Sanctions Compliance', 
    description: 'Sanctioned entity or jurisdiction',
    severity: 'high',
  },
  INVESTOR_PROTECTION: { 
    label: 'Investor Protection', 
    description: 'To protect investor interests',
    severity: 'medium',
  },
  AML_VIOLATION: { 
    label: 'AML Violation', 
    description: 'Anti-money laundering violation',
    severity: 'high',
  },
  ERROR_CORRECTION: { 
    label: 'Error Correction', 
    description: 'Correcting distribution error',
    severity: 'low',
  },
};

// Demo data
const DEMO_PROPOSALS: ClawbackProposal[] = [
  {
    id: 'clawback_001',
    assetId: 'asset_001',
    targetWallet: 'rBTwLga3i2gz3doX6Gva3MgEV8ZCD8jjah',
    amount: '5000',
    reason: 'SANCTIONS_COMPLIANCE',
    legalJustification: 'Target wallet has been identified as belonging to a sanctioned entity per OFAC SDN list update dated 2026-01-10.',
    status: 'VOTING',
    commentPeriodEnds: '2026-01-12T00:00:00Z',
    votingEndsAt: '2026-01-17T00:00:00Z',
    approveVotes: 15,
    rejectVotes: 3,
    createdAt: '2026-01-10T00:00:00Z',
  },
  {
    id: 'clawback_002',
    assetId: 'asset_001',
    targetWallet: 'rMwjYedjc7qqtKYVLiAccJSmCwih4LnE2q',
    amount: '1000',
    reason: 'ERROR_CORRECTION',
    legalJustification: 'Tokens were erroneously distributed to wrong wallet address. Original recipient has provided signed declaration.',
    status: 'COMMENT_PERIOD',
    commentPeriodEnds: '2026-01-18T00:00:00Z',
    approveVotes: 0,
    rejectVotes: 0,
    createdAt: '2026-01-14T00:00:00Z',
  },
  {
    id: 'clawback_003',
    assetId: 'asset_001',
    targetWallet: 'rPCFVxAqP2XdaPmih1ZSjmCPNxoyMiy2ne',
    amount: '25000',
    reason: 'FRAUD_DETECTION',
    legalJustification: 'Wallet linked to confirmed fraud scheme. Evidence submitted includes forensic analysis and law enforcement report.',
    status: 'EXECUTED',
    commentPeriodEnds: '2025-12-20T00:00:00Z',
    votingEndsAt: '2025-12-25T00:00:00Z',
    approveVotes: 22,
    rejectVotes: 1,
    createdAt: '2025-12-15T00:00:00Z',
    executedAt: '2025-12-26T10:30:00Z',
    executionTxHash: '0x123abc456def789ghi012jkl345mno678pqr',
  },
];

const DEMO_AUDIT: AuditEntry[] = [
  {
    id: 'audit_001',
    timestamp: '2026-01-14T10:30:00Z',
    action: 'WHITELIST_UPDATE',
    actor: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
    details: 'Added 5 new investors to whitelist',
  },
  {
    id: 'audit_002',
    timestamp: '2026-01-13T15:45:00Z',
    action: 'COMPLIANCE_REVIEW',
    actor: 'Verity Compliance Team',
    details: 'Quarterly compliance review completed - PASSED',
  },
  {
    id: 'audit_003',
    timestamp: '2026-01-10T09:00:00Z',
    action: 'CLAWBACK_INITIATED',
    actor: 'Guardian Council',
    details: 'Clawback proposal created for sanctions compliance',
  },
  {
    id: 'audit_004',
    timestamp: '2026-01-05T14:20:00Z',
    action: 'KYC_VERIFICATION',
    actor: 'KYC Provider',
    details: '12 holders verified at Level 3',
  },
  {
    id: 'audit_005',
    timestamp: '2025-12-26T10:30:00Z',
    action: 'CLAWBACK_EXECUTED',
    actor: 'Guardian Council',
    details: 'Clawback executed: 25,000 tokens recovered from rPCFVxAqP2XdaPmih1ZSjmCPNxoyMiy2ne',
    transactionHash: '0x123abc456def789ghi012jkl345mno678pqr',
  },
];

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function formatAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-6)}`;
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

function getTimeRemaining(dateString: string): { days: number; hours: number; isExpired: boolean } {
  const now = new Date().getTime();
  const target = new Date(dateString).getTime();
  const diff = target - now;
  
  if (diff <= 0) return { days: 0, hours: 0, isExpired: true };
  
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  
  return { days, hours, isExpired: false };
}

function formatNumber(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return num.toLocaleString('en-US');
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function ComplianceStatusBadge({ status }: { status: ComplianceStatus }) {
  const config = COMPLIANCE_STATUS_CONFIG[status];
  const Icon = config.icon;
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${config.bgColor} ${config.color}`}>
      <Icon className="w-4 h-4" />
      {config.label}
    </span>
  );
}

function ClawbackStatusBadge({ status }: { status: ClawbackProposal['status'] }) {
  const config = CLAWBACK_STATUS_CONFIG[status] || CLAWBACK_STATUS_CONFIG.COMMENT_PERIOD;
  const Icon = config.icon;
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bgColor} ${config.color}`}>
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: 'high' | 'medium' | 'low' }) {
  const config = {
    high: { color: 'text-red-700', bgColor: 'bg-red-100' },
    medium: { color: 'text-amber-700', bgColor: 'bg-amber-100' },
    low: { color: 'text-gray-700', bgColor: 'bg-gray-100' },
  };
  
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${config[severity].bgColor} ${config[severity].color}`}>
      {severity.toUpperCase()}
    </span>
  );
}

function VoteProgress({ 
  approveVotes, 
  rejectVotes,
  quorum = 20,
}: { 
  approveVotes: number; 
  rejectVotes: number;
  quorum?: number;
}) {
  const total = approveVotes + rejectVotes;
  const approvePercent = total > 0 ? (approveVotes / total) * 100 : 0;
  const rejectPercent = total > 0 ? (rejectVotes / total) * 100 : 0;
  const quorumMet = total >= quorum;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1 text-green-600">
            <ThumbsUp className="w-4 h-4" />
            {approveVotes} ({approvePercent.toFixed(0)}%)
          </span>
          <span className="flex items-center gap-1 text-red-600">
            <ThumbsDown className="w-4 h-4" />
            {rejectVotes} ({rejectPercent.toFixed(0)}%)
          </span>
        </div>
        <span className={`text-xs ${quorumMet ? 'text-green-600' : 'text-amber-600'}`}>
          {total}/{quorum} quorum
        </span>
      </div>
      <div className="h-3 bg-gray-200 rounded-full overflow-hidden flex">
        <div 
          className="bg-green-500 h-full transition-all" 
          style={{ width: `${approvePercent}%` }}
        />
        <div 
          className="bg-red-500 h-full transition-all" 
          style={{ width: `${rejectPercent}%` }}
        />
      </div>
    </div>
  );
}

function CountdownTimer({ endDate }: { endDate: string }) {
  const { days, hours, isExpired } = getTimeRemaining(endDate);

  if (isExpired) {
    return <span className="text-gray-500 text-sm">Ended</span>;
  }

  return (
    <span className="text-sm font-medium text-indigo-600">
      {days > 0 && `${days}d `}{hours}h remaining
    </span>
  );
}

// Clawback Proposal Card
function ClawbackProposalCard({ 
  proposal, 
  asset,
  onVote,
  isVoting,
}: { 
  proposal: ClawbackProposal; 
  asset: TokenizedAsset;
  onVote: (proposalId: string, approve: boolean) => void;
  isVoting: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const reasonConfig = CLAWBACK_REASONS[proposal.reason];
  const isActive = proposal.status === 'VOTING' || proposal.status === 'COMMENT_PERIOD';

  return (
    <div className={`bg-white rounded-xl border ${
      isActive ? 'border-indigo-200 shadow-md' : 'border-gray-200'
    } overflow-hidden`}>
      {/* Header */}
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-xl ${
              proposal.status === 'EXECUTED' ? 'bg-gray-100' :
              proposal.status === 'VOTING' ? 'bg-purple-100' :
              'bg-blue-100'
            }`}>
              <Gavel className={`w-6 h-6 ${
                proposal.status === 'EXECUTED' ? 'text-gray-600' :
                proposal.status === 'VOTING' ? 'text-purple-600' :
                'text-blue-600'
              }`} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <ClawbackStatusBadge status={proposal.status} />
                <SeverityBadge severity={reasonConfig?.severity || 'medium'} />
              </div>
              <div className="text-sm text-gray-500">
                {reasonConfig?.label || proposal.reason}
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Target & Amount */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <div className="text-xs text-gray-500 mb-1">Target Wallet</div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm">{formatAddress(proposal.targetWallet)}</span>
              <button
                onClick={() => copyToClipboard(proposal.targetWallet)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <Copy className="w-3.5 h-3.5 text-gray-400" />
              </button>
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Amount</div>
            <div className="font-bold text-gray-900">
              {formatNumber(proposal.amount)} {asset.symbol}
            </div>
          </div>
        </div>

        {/* Voting Progress (for VOTING status) */}
        {proposal.status === 'VOTING' && (
          <div className="mb-4">
            <VoteProgress 
              approveVotes={proposal.approveVotes} 
              rejectVotes={proposal.rejectVotes} 
            />
          </div>
        )}

        {/* Timeline */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100">
          <div className="flex items-center gap-4 text-sm">
            {proposal.status === 'COMMENT_PERIOD' && (
              <div className="flex items-center gap-1.5 text-blue-600">
                <MessageSquare className="w-4 h-4" />
                <CountdownTimer endDate={proposal.commentPeriodEnds} />
              </div>
            )}
            {proposal.status === 'VOTING' && proposal.votingEndsAt && (
              <div className="flex items-center gap-1.5 text-purple-600">
                <Vote className="w-4 h-4" />
                <CountdownTimer endDate={proposal.votingEndsAt} />
              </div>
            )}
            {proposal.executedAt && (
              <div className="flex items-center gap-1.5 text-gray-500">
                <CheckCircle2 className="w-4 h-4" />
                Executed {formatDate(proposal.executedAt)}
              </div>
            )}
          </div>
          
          {/* Vote Buttons */}
          {proposal.status === 'VOTING' && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => onVote(proposal.id, false)}
                disabled={isVoting}
                className="px-3 py-1.5 border border-red-300 text-red-600 text-sm rounded-lg hover:bg-red-50 disabled:opacity-50 flex items-center gap-1"
              >
                <ThumbsDown className="w-4 h-4" />
                Reject
              </button>
              <button
                onClick={() => onVote(proposal.id, true)}
                disabled={isVoting}
                className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-1"
              >
                <ThumbsUp className="w-4 h-4" />
                Approve
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-6 pb-6 pt-2 border-t border-gray-100 bg-gray-50">
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-2">Legal Justification</h4>
              <p className="text-sm text-gray-600 bg-white p-3 rounded-lg border border-gray-200">
                {proposal.legalJustification}
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Proposal Details</h4>
                <div className="text-sm text-gray-600 space-y-1">
                  <div className="flex justify-between">
                    <span>Created:</span>
                    <span>{formatDate(proposal.createdAt, true)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Proposal ID:</span>
                    <span className="font-mono">{proposal.id}</span>
                  </div>
                </div>
              </div>
              
              {proposal.executionTxHash && (
                <div>
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Transaction</h4>
                  <a
                    href={`https://xrpscan.com/tx/${proposal.executionTxHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-700"
                  >
                    View on Explorer
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Audit Trail
function AuditTrail({ entries }: { entries: AuditEntry[] }) {
  const actionIcons: Record<string, typeof Shield> = {
    WHITELIST_UPDATE: Users,
    COMPLIANCE_REVIEW: Shield,
    CLAWBACK_INITIATED: Gavel,
    CLAWBACK_EXECUTED: CheckCircle2,
    KYC_VERIFICATION: ShieldCheck,
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <History className="w-5 h-5 text-indigo-600" />
          Compliance Audit Trail
        </h3>
      </div>
      
      <div className="divide-y divide-gray-100">
        {entries.map((entry) => {
          const Icon = actionIcons[entry.action] || Activity;
          
          return (
            <div key={entry.id} className="px-6 py-4 hover:bg-gray-50">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Icon className="w-5 h-5 text-gray-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-900">
                      {entry.action.replace(/_/g, ' ')}
                    </span>
                    <span className="text-sm text-gray-500">
                      {formatDate(entry.timestamp, true)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{entry.details}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span>By: {formatAddress(entry.actor)}</span>
                    {entry.transactionHash && (
                      <a
                        href={`https://xrpscan.com/tx/${entry.transactionHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                      >
                        View TX
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
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

export default function ComplianceDisplay({ asset, isDemo = true }: ComplianceDisplayProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'overview' | 'clawback' | 'audit'>('overview');

  // Queries
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { data: _complianceData } = useQuery({
    queryKey: ['compliance', asset.id],
    queryFn: () => assetsApi.getComplianceStatus(asset.id),
    enabled: !isDemo,
  });

  const { data: proposalsData } = useQuery({
    queryKey: ['clawbackProposals', asset.id],
    queryFn: () => assetsApi.getClawbackProposals(asset.id),
    enabled: !isDemo,
  });

  // Mutations
  const voteMutation = useMutation({
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    mutationFn: ({ proposalId, approve: _approve }: { proposalId: string; approve: boolean }) =>
      assetsApi.initiateClawback(asset.id, {
        targetAddress: '',
        amount: '',
        reason: '',
        governanceProposalId: proposalId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clawbackProposals', asset.id] });
    },
  });

  // Use demo or API data
  const proposals: ClawbackProposal[] = isDemo ? DEMO_PROPOSALS : (proposalsData?.data || []);
  const auditEntries: AuditEntry[] = isDemo ? DEMO_AUDIT : [];

  // Stats
  const activeProposals = proposals.filter(p => 
    p.status === 'VOTING' || p.status === 'COMMENT_PERIOD'
  ).length;
  const executedClawbacks = proposals.filter(p => p.status === 'EXECUTED').length;
  const totalRecovered = proposals
    .filter(p => p.status === 'EXECUTED')
    .reduce((sum, p) => sum + parseFloat(p.amount), 0);

  const handleVote = (proposalId: string, approve: boolean) => {
    if (isDemo) {
      console.log('Demo mode: Vote', { proposalId, approve });
    } else {
      voteMutation.mutate({ proposalId, approve });
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
            <Shield className="w-6 h-6 text-indigo-600" />
            Compliance & Governance
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            XAO-DOW compliance status and clawback governance for {asset.symbol}
          </p>
        </div>
        <ComplianceStatusBadge status={asset.complianceStatus} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <ShieldCheck className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-sm text-gray-500">Compliance Status</span>
          </div>
          <div className="text-lg font-bold text-gray-900">
            {COMPLIANCE_STATUS_CONFIG[asset.complianceStatus]?.label}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Gavel className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-sm text-gray-500">Active Proposals</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{activeProposals}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm text-gray-500">Executed Clawbacks</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{executedClawbacks}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Lock className="w-5 h-5 text-amber-600" />
            </div>
            <span className="text-sm text-gray-500">Total Recovered</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {formatNumber(totalRecovered)} {asset.symbol}
          </div>
        </div>
      </div>

      {/* XLS-39D Info Banner */}
      {asset.enableClawback && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-indigo-100 rounded-xl">
              <Lock className="w-6 h-6 text-indigo-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-indigo-900 mb-2">XLS-39D Clawback Enabled</h3>
              <p className="text-sm text-indigo-700 mb-4">
                This asset implements XRPL's XLS-39D clawback amendment for regulatory compliance. 
                Token recovery requires Guardian Council approval through governance.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-indigo-600" />
                  <span className="text-indigo-800">72h Comment Period</span>
                </div>
                <div className="flex items-center gap-2">
                  <Vote className="w-4 h-4 text-indigo-600" />
                  <span className="text-indigo-800">5-Day Voting</span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <span className="text-indigo-800">20 Vote Quorum</span>
                </div>
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-600" />
                  <span className="text-indigo-800">Full Audit Trail</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {[
          { id: 'overview', label: 'Overview', icon: Shield },
          { id: 'clawback', label: 'Clawback Proposals', icon: Gavel, count: activeProposals },
          { id: 'audit', label: 'Audit Trail', icon: History },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Compliance Requirements */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-600" />
              Compliance Requirements
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700">KYC Verification</span>
                <span className={`flex items-center gap-1.5 text-sm ${asset.requiresKYC ? 'text-green-600' : 'text-gray-400'}`}>
                  {asset.requiresKYC ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {asset.requiresKYC ? 'Required' : 'Not Required'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700">XLS-39D Clawback</span>
                <span className={`flex items-center gap-1.5 text-sm ${asset.enableClawback ? 'text-green-600' : 'text-gray-400'}`}>
                  {asset.enableClawback ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  {asset.enableClawback ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-700">Asset Verification</span>
                <span className={`flex items-center gap-1.5 text-sm ${asset.isVerified ? 'text-green-600' : 'text-amber-600'}`}>
                  {asset.isVerified ? <CheckCircle2 className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                  {asset.isVerified ? 'Verified' : 'Pending'}
                </span>
              </div>
            </div>
          </div>

          {/* Supported Jurisdictions */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-indigo-600" />
              Supported Jurisdictions
            </h3>
            {asset.jurisdictions && asset.jurisdictions.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {asset.jurisdictions.map((j) => (
                  <span 
                    key={j}
                    className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm font-medium text-gray-700"
                  >
                    {j}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No jurisdiction restrictions</p>
            )}
          </div>
        </div>
      )}

      {activeTab === 'clawback' && (
        <div className="space-y-4">
          {proposals.length === 0 ? (
            <div className="text-center py-12">
              <Gavel className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Clawback Proposals</h3>
              <p className="text-gray-500 max-w-sm mx-auto">
                There are no active or historical clawback proposals for this asset.
              </p>
            </div>
          ) : (
            proposals.map((proposal) => (
              <ClawbackProposalCard
                key={proposal.id}
                proposal={proposal}
                asset={asset}
                onVote={handleVote}
                isVoting={voteMutation.isPending}
              />
            ))
          )}
        </div>
      )}

      {activeTab === 'audit' && (
        <AuditTrail entries={auditEntries} />
      )}
    </div>
  );
}
