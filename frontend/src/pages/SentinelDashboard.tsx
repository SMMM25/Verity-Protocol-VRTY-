/**
 * AI Sentinel Dashboard - Phase 6
 * Real-time fraud detection and compliance monitoring
 * 
 * Verity Protocol - Platform Oversight Hub
 * Human-in-the-loop Guardian governance system
 */

import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Shield,
  AlertTriangle,
  Eye,
  Activity,
  Users,
  Zap,
  DollarSign,
  RefreshCw,
  UserPlus,
  Layers,
  GitBranch,
  Code,
  Clock,
  CheckCircle2,
  XCircle,
  Lock,
  Search,
  ChevronRight,
  Settings,
  Bell,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Copy,
  ArrowUpRight,
  Target,
  Network,
  Radio,
  CircleDot,
  BarChart3,
  Sparkles,
  Brain,
  ShieldAlert,
  Flag,
  Gavel,
  Star,
  Crown
} from 'lucide-react';
import { useUser } from '../App';
import { sentinelApi } from '../api/client';
import {
  AlertSeverity,
  AlertStatus,
  AlertAction,
  RuleType,
  GuardianRole,
  ALERT_SEVERITY_LABELS,
  ALERT_STATUS_LABELS,
  ALERT_ACTION_LABELS,
  GUARDIAN_ROLE_LABELS,
  DEFAULT_ALERT_FILTER,
  DEFAULT_GUARDIAN_PERMISSIONS,
  type SentinelAlert,
  type SentinelStats,
  type RuleDefinition,
  type Guardian,
  type AlertFilter,
  type RealTimeMetrics,
  type ThreatCluster,
  type AlertActionRequest
} from '../types/sentinel';

// ============================================
// DEMO DATA FOR DEVELOPMENT
// ============================================

const DEMO_ALERTS: SentinelAlert[] = [
  {
    id: 'alert-001',
    ruleType: RuleType.WASH_TRADING,
    ruleName: 'Wash Trading Detection',
    severity: AlertSeverity.CRITICAL,
    status: AlertStatus.PENDING,
    primaryWallet: 'rN7n3J7Hn2AUMmWE8kWCU8wXKNi9qNQQJR',
    relatedWallets: ['rPT1Qj7C3tR8K3sKDp9qQgBpnQJk7mFHVE', 'rGzPm7FH2kNsX9B3vQpT4rKWmLjN5cEYUA'],
    triggerTransactions: [
      { hash: 'tx001', from: 'rN7n3J7Hn2AUMmWE8kWCU8wXKNi9qNQQJR', to: 'rPT1Qj7C3tR8K3sKDp9qQgBpnQJk7mFHVE', amount: 50000, asset: 'VRTY', timestamp: '2026-01-14T10:30:00Z', direction: 'OUT', network: 'XRPL' },
      { hash: 'tx002', from: 'rPT1Qj7C3tR8K3sKDp9qQgBpnQJk7mFHVE', to: 'rN7n3J7Hn2AUMmWE8kWCU8wXKNi9qNQQJR', amount: 49500, asset: 'VRTY', timestamp: '2026-01-14T10:35:00Z', direction: 'IN', network: 'XRPL' }
    ],
    title: 'Circular trading pattern detected',
    description: 'Wallet rN7n...QQJR engaged in suspected wash trading with 2 related wallets totaling 99,500 VRTY in circular transfers within 5 minutes.',
    evidence: {
      transactionCount: 4,
      transactionVolume: 199000,
      timeWindow: '5 minutes',
      patternDescription: 'A→B→A circular flow within 24h threshold',
      patternMatches: [
        { type: 'circular_flow', description: 'Complete round-trip detected', transactions: ['tx001', 'tx002'], timestamp: '2026-01-14T10:35:00Z' }
      ]
    },
    riskScore: 92,
    confidence: 87,
    detectedAt: '2026-01-14T10:36:00Z',
    auditLog: []
  },
  {
    id: 'alert-002',
    ruleType: RuleType.LARGE_TRANSFER,
    ruleName: 'Large Transfer Detection',
    severity: AlertSeverity.WARNING,
    status: AlertStatus.REVIEWING,
    primaryWallet: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',
    relatedWallets: [],
    triggerTransactions: [
      { hash: 'tx003', from: 'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh', to: 'rDsbeomae4FXwgQTJp9Rs64Qg9vDiTCdBv', amount: 250000, asset: 'VRTY', timestamp: '2026-01-14T09:15:00Z', direction: 'OUT', network: 'XRPL' }
    ],
    title: 'Large transfer exceeds threshold',
    description: 'Single transfer of 250,000 VRTY detected, exceeding the 100,000 VRTY monitoring threshold.',
    evidence: {
      transactionCount: 1,
      transactionVolume: 250000,
      timeWindow: 'single transaction',
      patternDescription: 'Transfer exceeds large_transfer_threshold',
      walletAge: 180
    },
    riskScore: 65,
    confidence: 95,
    detectedAt: '2026-01-14T09:15:30Z',
    reviewedAt: '2026-01-14T09:45:00Z',
    review: {
      reviewedBy: 'rGuardian123xyz',
      reviewedAt: '2026-01-14T09:45:00Z'
    },
    auditLog: [
      { action: 'review_started', actor: 'rGuardian123xyz', timestamp: '2026-01-14T09:45:00Z' }
    ]
  },
  {
    id: 'alert-003',
    ruleType: RuleType.HIGH_VELOCITY,
    ruleName: 'High Transaction Velocity',
    severity: AlertSeverity.WARNING,
    status: AlertStatus.PENDING,
    primaryWallet: 'rMwjYedjc7qqtKYVLiAccJSmCwih4LnE2q',
    relatedWallets: [],
    triggerTransactions: [],
    title: 'Unusually high transaction frequency',
    description: 'Wallet executed 78 transactions in the past hour, exceeding the 50 tx/hour threshold.',
    evidence: {
      transactionCount: 78,
      transactionVolume: 45000,
      timeWindow: '1 hour',
      patternDescription: 'Transaction velocity 56% above threshold'
    },
    riskScore: 58,
    confidence: 92,
    detectedAt: '2026-01-14T11:00:00Z',
    auditLog: []
  },
  {
    id: 'alert-004',
    ruleType: RuleType.NEW_WALLET_LARGE,
    ruleName: 'New Wallet Large Transfer',
    severity: AlertSeverity.CRITICAL,
    status: AlertStatus.PENDING,
    primaryWallet: 'rNewWallet9876abcdef123456',
    relatedWallets: [],
    triggerTransactions: [
      { hash: 'tx004', from: 'rExchange123', to: 'rNewWallet9876abcdef123456', amount: 75000, asset: 'VRTY', timestamp: '2026-01-14T08:00:00Z', direction: 'IN', network: 'XRPL' }
    ],
    title: 'New wallet received large deposit',
    description: 'Wallet created 2 hours ago received 75,000 VRTY, exceeding new wallet threshold of 10,000 VRTY.',
    evidence: {
      transactionCount: 1,
      transactionVolume: 75000,
      timeWindow: 'single transaction',
      walletAge: 2,
      patternDescription: 'New wallet (<24h) with transfer >10k threshold'
    },
    riskScore: 78,
    confidence: 88,
    detectedAt: '2026-01-14T08:01:00Z',
    auditLog: []
  },
  {
    id: 'alert-005',
    ruleType: RuleType.STRUCTURING,
    ruleName: 'Transaction Structuring',
    severity: AlertSeverity.CRITICAL,
    status: AlertStatus.ESCALATED,
    primaryWallet: 'rStructWallet456def',
    relatedWallets: ['rRecipient1', 'rRecipient2', 'rRecipient3'],
    triggerTransactions: [],
    title: 'Suspected transaction structuring',
    description: 'Detected 5 transactions of 9,450 VRTY each within 2 hours, potentially structuring to avoid 10,000 threshold.',
    evidence: {
      transactionCount: 5,
      transactionVolume: 47250,
      timeWindow: '2 hours',
      patternDescription: 'Multiple transactions just below reporting threshold'
    },
    riskScore: 88,
    confidence: 82,
    detectedAt: '2026-01-14T07:30:00Z',
    reviewedAt: '2026-01-14T08:00:00Z',
    review: {
      reviewedBy: 'rAdmin456',
      reviewedAt: '2026-01-14T08:00:00Z',
      actionTaken: AlertAction.ESCALATE,
      notes: 'Pattern consistent with structuring, escalating for review'
    },
    auditLog: [
      { action: 'review_started', actor: 'rAdmin456', timestamp: '2026-01-14T07:45:00Z' },
      { action: AlertAction.ESCALATE, actor: 'rAdmin456', timestamp: '2026-01-14T08:00:00Z', details: { reason: 'Structuring pattern confirmed' } }
    ]
  }
];

const DEMO_STATS: SentinelStats = {
  totalAlerts: 127,
  byStatus: {
    pending: 23,
    reviewing: 8,
    resolved: 78,
    dismissed: 15,
    escalated: 3
  },
  bySeverity: {
    info: 32,
    warning: 67,
    critical: 28
  },
  byRuleType: {
    highVelocity: 34,
    largeTransfer: 28,
    washTrading: 18,
    newWalletLarge: 15,
    structuring: 12,
    bridgeAbuse: 8,
    clusterActivity: 7,
    custom: 5
  },
  transactionsProcessed: 1284567,
  transactionsPerSecond: 42.5,
  averageResponseTime: 1.2,
  falsePositiveRate: 12.3,
  truePositiveRate: 87.7,
  actionsToday: 15,
  periodStart: '2026-01-01T00:00:00Z',
  periodEnd: '2026-01-14T23:59:59Z'
};

const DEMO_RULES: RuleDefinition[] = [
  {
    id: 'rule-high-velocity',
    type: RuleType.HIGH_VELOCITY,
    name: 'High Transaction Velocity',
    description: 'Detects wallets with unusually high transaction frequency (>50 tx/hour)',
    enabled: true,
    severity: AlertSeverity.WARNING,
    parameters: { maxTransactionsPerHour: 50 },
    thresholds: { warningThreshold: 50, criticalThreshold: 100, riskScoreWeight: 0.2 }
  },
  {
    id: 'rule-large-transfer',
    type: RuleType.LARGE_TRANSFER,
    name: 'Large Transfer Detection',
    description: 'Flags single transfers exceeding 100,000 VRTY',
    enabled: true,
    severity: AlertSeverity.WARNING,
    parameters: { largeTransferThreshold: 100000 },
    thresholds: { warningThreshold: 100000, criticalThreshold: 500000, riskScoreWeight: 0.25 }
  },
  {
    id: 'rule-wash-trading',
    type: RuleType.WASH_TRADING,
    name: 'Wash Trading Detection',
    description: 'Detects circular trading patterns (A→B→A within 24 hours)',
    enabled: true,
    severity: AlertSeverity.CRITICAL,
    parameters: { washTradingWindow: '24h', minWashAmount: 1000 },
    thresholds: { warningThreshold: 1, criticalThreshold: 3, riskScoreWeight: 0.35 }
  },
  {
    id: 'rule-new-wallet-large',
    type: RuleType.NEW_WALLET_LARGE,
    name: 'New Wallet Large Transfer',
    description: 'Flags new wallets (<24h old) receiving >10,000 VRTY',
    enabled: true,
    severity: AlertSeverity.CRITICAL,
    parameters: { newWalletAge: '24h', newWalletThreshold: 10000 },
    thresholds: { warningThreshold: 10000, criticalThreshold: 50000, riskScoreWeight: 0.2 }
  },
  {
    id: 'rule-structuring',
    type: RuleType.STRUCTURING,
    name: 'Transaction Structuring',
    description: 'Detects potential structuring (multiple transactions just below 10k)',
    enabled: true,
    severity: AlertSeverity.CRITICAL,
    parameters: { structuringThreshold: 9500, structuringWindow: '24h', structuringMinCount: 3 },
    thresholds: { warningThreshold: 3, criticalThreshold: 5, riskScoreWeight: 0.4 }
  },
  {
    id: 'rule-bridge-abuse',
    type: RuleType.BRIDGE_ABUSE,
    name: 'Cross-Chain Bridge Abuse',
    description: 'Monitors suspicious cross-chain bridge activity',
    enabled: true,
    severity: AlertSeverity.WARNING,
    parameters: { bridgeVelocityLimit: 10, bridgeAmountThreshold: 50000 },
    thresholds: { warningThreshold: 10, criticalThreshold: 20, riskScoreWeight: 0.25 }
  },
  {
    id: 'rule-cluster-activity',
    type: RuleType.CLUSTER_ACTIVITY,
    name: 'Coordinated Cluster Activity',
    description: 'Detects coordinated activity from linked wallet clusters',
    enabled: true,
    severity: AlertSeverity.WARNING,
    parameters: { clusterMinSize: 3, clusterTimeWindow: '1h' },
    thresholds: { warningThreshold: 3, criticalThreshold: 5, riskScoreWeight: 0.3 }
  }
];

const DEMO_GUARDIANS: Guardian[] = [
  {
    wallet: 'rGuardian1SuperAdmin',
    name: 'Chief Guardian',
    role: GuardianRole.SUPER_ADMIN,
    permissions: DEFAULT_GUARDIAN_PERMISSIONS[GuardianRole.SUPER_ADMIN],
    activity: {
      alertsReviewed: 245,
      alertsDismissed: 32,
      alertsEscalated: 18,
      alertsFlagged: 56,
      alertsFrozen: 12,
      clawbacksInitiated: 3,
      lastActive: '2026-01-14T11:30:00Z'
    },
    registeredAt: '2025-06-01T00:00:00Z',
    isActive: true
  },
  {
    wallet: 'rGuardian2Admin',
    name: 'Senior Guardian',
    role: GuardianRole.ADMIN,
    permissions: DEFAULT_GUARDIAN_PERMISSIONS[GuardianRole.ADMIN],
    activity: {
      alertsReviewed: 187,
      alertsDismissed: 28,
      alertsEscalated: 12,
      alertsFlagged: 43,
      alertsFrozen: 8,
      clawbacksInitiated: 0,
      lastActive: '2026-01-14T10:45:00Z'
    },
    registeredAt: '2025-07-15T00:00:00Z',
    isActive: true
  },
  {
    wallet: 'rGuardian3Member',
    name: 'Guardian Alpha',
    role: GuardianRole.GUARDIAN,
    permissions: DEFAULT_GUARDIAN_PERMISSIONS[GuardianRole.GUARDIAN],
    activity: {
      alertsReviewed: 98,
      alertsDismissed: 15,
      alertsEscalated: 8,
      alertsFlagged: 24,
      alertsFrozen: 0,
      clawbacksInitiated: 0,
      lastActive: '2026-01-14T09:30:00Z'
    },
    registeredAt: '2025-09-01T00:00:00Z',
    isActive: true
  }
];

const DEMO_METRICS: RealTimeMetrics = {
  activeAlerts: 31,
  criticalAlerts: 7,
  transactionsMonitored: 1284567,
  walletsTracked: 45678,
  guardianOnline: 3,
  systemHealth: 'healthy',
  lastUpdate: new Date().toISOString()
};

const DEMO_THREATS: ThreatCluster[] = [
  {
    id: 'cluster-001',
    wallets: ['rWallet1', 'rWallet2', 'rWallet3', 'rWallet4'],
    centerWallet: 'rWallet1',
    totalVolume: 2500000,
    transactionCount: 156,
    riskScore: 85,
    detectedAt: '2026-01-12T00:00:00Z',
    lastActivity: '2026-01-14T10:00:00Z',
    status: 'active',
    relatedAlerts: ['alert-001', 'alert-005']
  },
  {
    id: 'cluster-002',
    wallets: ['rWallet5', 'rWallet6', 'rWallet7'],
    centerWallet: 'rWallet5',
    totalVolume: 890000,
    transactionCount: 67,
    riskScore: 62,
    detectedAt: '2026-01-10T00:00:00Z',
    lastActivity: '2026-01-13T18:00:00Z',
    status: 'active',
    relatedAlerts: ['alert-003']
  }
];

// ============================================
// HELPER FUNCTIONS
// ============================================

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toFixed(0);
}

function formatPercentage(num: number): string {
  return `${num.toFixed(1)}%`;
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function truncateWallet(wallet: string): string {
  if (wallet.length <= 16) return wallet;
  return `${wallet.slice(0, 8)}...${wallet.slice(-6)}`;
}

function copyToClipboard(text: string): void {
  navigator.clipboard.writeText(text);
}

// ============================================
// UI COMPONENTS
// ============================================

// Severity badge component
function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  const colors: Record<AlertSeverity, string> = {
    [AlertSeverity.INFO]: 'bg-blue-100 text-blue-800',
    [AlertSeverity.WARNING]: 'bg-yellow-100 text-yellow-800',
    [AlertSeverity.CRITICAL]: 'bg-red-100 text-red-800'
  };
  
  const icons: Record<AlertSeverity, React.ReactNode> = {
    [AlertSeverity.INFO]: <AlertCircle className="w-3 h-3" />,
    [AlertSeverity.WARNING]: <AlertTriangle className="w-3 h-3" />,
    [AlertSeverity.CRITICAL]: <ShieldAlert className="w-3 h-3" />
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colors[severity]}`}>
      {icons[severity]}
      {ALERT_SEVERITY_LABELS[severity]}
    </span>
  );
}

// Status badge component
function StatusBadge({ status }: { status: AlertStatus }) {
  const colors: Record<AlertStatus, string> = {
    [AlertStatus.PENDING]: 'bg-yellow-100 text-yellow-800',
    [AlertStatus.REVIEWING]: 'bg-blue-100 text-blue-800',
    [AlertStatus.RESOLVED]: 'bg-green-100 text-green-800',
    [AlertStatus.DISMISSED]: 'bg-gray-100 text-gray-800',
    [AlertStatus.ESCALATED]: 'bg-red-100 text-red-800'
  };
  
  const icons: Record<AlertStatus, React.ReactNode> = {
    [AlertStatus.PENDING]: <Clock className="w-3 h-3" />,
    [AlertStatus.REVIEWING]: <Eye className="w-3 h-3" />,
    [AlertStatus.RESOLVED]: <CheckCircle2 className="w-3 h-3" />,
    [AlertStatus.DISMISSED]: <XCircle className="w-3 h-3" />,
    [AlertStatus.ESCALATED]: <ArrowUpRight className="w-3 h-3" />
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colors[status]}`}>
      {icons[status]}
      {ALERT_STATUS_LABELS[status]}
    </span>
  );
}

// Rule type icon component
function RuleTypeIcon({ type, className = "w-5 h-5" }: { type: RuleType; className?: string }) {
  const icons: Record<RuleType, React.ReactNode> = {
    [RuleType.HIGH_VELOCITY]: <Zap className={className} />,
    [RuleType.LARGE_TRANSFER]: <DollarSign className={className} />,
    [RuleType.WASH_TRADING]: <RefreshCw className={className} />,
    [RuleType.NEW_WALLET_LARGE]: <UserPlus className={className} />,
    [RuleType.STRUCTURING]: <Layers className={className} />,
    [RuleType.BRIDGE_ABUSE]: <GitBranch className={className} />,
    [RuleType.CLUSTER_ACTIVITY]: <Users className={className} />,
    [RuleType.CUSTOM]: <Code className={className} />
  };
  return <>{icons[type]}</>;
}

// Guardian role badge
function GuardianRoleBadge({ role }: { role: GuardianRole }) {
  const colors: Record<GuardianRole, string> = {
    [GuardianRole.GUARDIAN]: 'bg-blue-100 text-blue-800',
    [GuardianRole.ADMIN]: 'bg-purple-100 text-purple-800',
    [GuardianRole.SUPER_ADMIN]: 'bg-amber-100 text-amber-800'
  };
  
  const icons: Record<GuardianRole, React.ReactNode> = {
    [GuardianRole.GUARDIAN]: <Shield className="w-3 h-3" />,
    [GuardianRole.ADMIN]: <Star className="w-3 h-3" />,
    [GuardianRole.SUPER_ADMIN]: <Crown className="w-3 h-3" />
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colors[role]}`}>
      {icons[role]}
      {GUARDIAN_ROLE_LABELS[role]}
    </span>
  );
}

// Risk score indicator
function RiskScoreIndicator({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' | 'lg' }) {
  const getColor = () => {
    if (score >= 75) return 'text-red-600 bg-red-100';
    if (score >= 50) return 'text-yellow-600 bg-yellow-100';
    if (score >= 25) return 'text-blue-600 bg-blue-100';
    return 'text-green-600 bg-green-100';
  };
  
  const sizes = {
    sm: 'w-10 h-10 text-xs',
    md: 'w-14 h-14 text-sm',
    lg: 'w-20 h-20 text-lg'
  };

  return (
    <div className={`${sizes[size]} ${getColor()} rounded-full flex items-center justify-center font-bold`}>
      {score}
    </div>
  );
}

// Stat card component
function StatCard({ title, value, icon: Icon, change, changeType }: {
  title: string;
  value: string | number;
  icon: React.ElementType;
  change?: number;
  changeType?: 'increase' | 'decrease';
}) {
  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Icon className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        </div>
        {change !== undefined && (
          <div className={`flex items-center gap-1 text-sm ${
            changeType === 'increase' ? 'text-green-600' : 'text-red-600'
          }`}>
            {changeType === 'increase' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
            {formatPercentage(change)}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// MAIN DASHBOARD COMPONENT
// ============================================

type DashboardTab = 'overview' | 'alerts' | 'rules' | 'guardians' | 'threats';

export default function SentinelDashboard() {
  const { user } = useUser();
  const queryClient = useQueryClient();
  
  // State
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [isDemo, setIsDemo] = useState(true);
  const [selectedAlert, setSelectedAlert] = useState<SentinelAlert | null>(null);
  const [alertFilter, setAlertFilter] = useState<AlertFilter>(DEFAULT_ALERT_FILTER);
  const [searchQuery, setSearchQuery] = useState('');
  const [showActionModal, setShowActionModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ alert: SentinelAlert; action: AlertAction } | null>(null);

  // API Queries (disabled in demo mode)
  const { data: alertsData } = useQuery({
    queryKey: ['sentinel-alerts', alertFilter],
    queryFn: () => sentinelApi.getAlerts(alertFilter),
    enabled: !isDemo
  });

  const { data: statsData } = useQuery({
    queryKey: ['sentinel-stats'],
    queryFn: () => sentinelApi.getStats(30),
    enabled: !isDemo
  });

  const { data: rulesData } = useQuery({
    queryKey: ['sentinel-rules'],
    queryFn: () => sentinelApi.getRules(),
    enabled: !isDemo
  });

  const { data: guardiansData } = useQuery({
    queryKey: ['sentinel-guardians'],
    queryFn: () => sentinelApi.getGuardians(),
    enabled: !isDemo
  });

  const { data: metricsData } = useQuery({
    queryKey: ['sentinel-metrics'],
    queryFn: () => sentinelApi.getRealTimeMetrics(),
    enabled: !isDemo,
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  const { data: threatsData } = useQuery({
    queryKey: ['sentinel-threats'],
    queryFn: () => sentinelApi.getThreatClusters(),
    enabled: !isDemo
  });

  // Mutations
  const actionMutation = useMutation({
    mutationFn: (request: AlertActionRequest) => sentinelApi.processAction(request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sentinel-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['sentinel-stats'] });
      setShowActionModal(false);
      setPendingAction(null);
    }
  });

  const toggleRuleMutation = useMutation({
    mutationFn: ({ ruleId, enabled }: { ruleId: string; enabled: boolean }) => 
      sentinelApi.setRuleEnabled(ruleId, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sentinel-rules'] });
    }
  });

  // Use demo or live data
  const alerts = isDemo ? DEMO_ALERTS : (alertsData?.alerts || []);
  const stats = isDemo ? DEMO_STATS : (statsData || DEMO_STATS);
  const rules = isDemo ? DEMO_RULES : (rulesData || []);
  const guardians = isDemo ? DEMO_GUARDIANS : (guardiansData || []);
  const metrics = isDemo ? DEMO_METRICS : (metricsData || DEMO_METRICS);
  const threats = isDemo ? DEMO_THREATS : (threatsData || []);

  // Filtered alerts
  const filteredAlerts = useMemo(() => {
    let result = alerts;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((alert: SentinelAlert) =>
        alert.primaryWallet.toLowerCase().includes(query) ||
        alert.title.toLowerCase().includes(query) ||
        alert.ruleName.toLowerCase().includes(query)
      );
    }
    
    if (alertFilter.status) {
      const statuses = Array.isArray(alertFilter.status) ? alertFilter.status : [alertFilter.status];
      result = result.filter((alert: SentinelAlert) => statuses.includes(alert.status));
    }
    
    if (alertFilter.severity) {
      const severities = Array.isArray(alertFilter.severity) ? alertFilter.severity : [alertFilter.severity];
      result = result.filter((alert: SentinelAlert) => severities.includes(alert.severity));
    }
    
    return result;
  }, [alerts, searchQuery, alertFilter]);

  // Handle alert action
  const handleAlertAction = useCallback((alert: SentinelAlert, action: AlertAction) => {
    setPendingAction({ alert, action });
    setShowActionModal(true);
  }, []);

  const confirmAlertAction = useCallback(() => {
    if (!pendingAction || !user?.wallet) return;
    
    if (isDemo) {
      // Demo mode - just close modal
      setShowActionModal(false);
      setPendingAction(null);
      return;
    }
    
    actionMutation.mutate({
      alertId: pendingAction.alert.id,
      action: pendingAction.action,
      guardianWallet: user.wallet,
      reason: 'Action taken via Sentinel Dashboard'
    });
  }, [pendingAction, user, isDemo, actionMutation]);

  // Tab components
  const tabs: { id: DashboardTab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: BarChart3 },
    { id: 'alerts', label: 'Alerts', icon: Bell },
    { id: 'rules', label: 'Rules', icon: Settings },
    { id: 'guardians', label: 'Guardians', icon: Shield },
    { id: 'threats', label: 'Threats', icon: Target }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl">
                <Brain className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">AI Sentinel</h1>
                <p className="text-sm text-gray-500">Real-time fraud detection & compliance monitoring</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* System Health Indicator */}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
                metrics.systemHealth === 'healthy' ? 'bg-green-100 text-green-700' :
                metrics.systemHealth === 'degraded' ? 'bg-yellow-100 text-yellow-700' :
                'bg-red-100 text-red-700'
              }`}>
                <Radio className="w-4 h-4" />
                <span className="text-sm font-medium capitalize">{metrics.systemHealth}</span>
              </div>
              
              {/* Demo Mode Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Demo</span>
                <button
                  onClick={() => setIsDemo(!isDemo)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isDemo ? 'bg-purple-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isDemo ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
          
          {/* Tabs */}
          <div className="flex gap-1 mt-4">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Demo Notice */}
        {isDemo && (
          <div className="mb-6 bg-purple-50 border border-purple-200 rounded-lg p-4 flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <div>
              <p className="font-medium text-purple-900">Demo Mode Active</p>
              <p className="text-sm text-purple-700">
                Showing sample data. Connect to live Sentinel API for real-time monitoring.
              </p>
            </div>
          </div>
        )}

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Real-time Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Active Alerts"
                value={metrics.activeAlerts}
                icon={Bell}
                change={12.5}
                changeType="increase"
              />
              <StatCard
                title="Critical Alerts"
                value={metrics.criticalAlerts}
                icon={ShieldAlert}
              />
              <StatCard
                title="Transactions Monitored"
                value={formatNumber(metrics.transactionsMonitored)}
                icon={Activity}
              />
              <StatCard
                title="Guardians Online"
                value={metrics.guardianOnline}
                icon={Users}
              />
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Alerts by Status */}
              <div className="bg-white rounded-lg border p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Alerts by Status</h3>
                <div className="space-y-3">
                  {Object.entries(stats.byStatus).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={status.toUpperCase() as AlertStatus} />
                      </div>
                      <span className="font-medium">{count as number}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Alerts by Severity */}
              <div className="bg-white rounded-lg border p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Alerts by Severity</h3>
                <div className="space-y-3">
                  {Object.entries(stats.bySeverity).map(([severity, count]) => (
                    <div key={severity} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <SeverityBadge severity={severity.toUpperCase() as AlertSeverity} />
                      </div>
                      <span className="font-medium">{count as number}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="bg-white rounded-lg border p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Performance</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-500">True Positive Rate</span>
                      <span className="font-medium text-green-600">{formatPercentage(stats.truePositiveRate)}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full">
                      <div 
                        className="h-2 bg-green-500 rounded-full"
                        style={{ width: `${stats.truePositiveRate}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-500">False Positive Rate</span>
                      <span className="font-medium text-yellow-600">{formatPercentage(stats.falsePositiveRate)}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full">
                      <div 
                        className="h-2 bg-yellow-500 rounded-full"
                        style={{ width: `${stats.falsePositiveRate}%` }}
                      />
                    </div>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Avg Response Time</span>
                      <span className="font-medium">{stats.averageResponseTime}s</span>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Transactions/sec</span>
                      <span className="font-medium">{stats.transactionsPerSecond}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Alerts */}
            <div className="bg-white rounded-lg border">
              <div className="p-4 border-b flex items-center justify-between">
                <h3 className="font-semibold text-gray-900">Recent Alerts</h3>
                <button 
                  onClick={() => setActiveTab('alerts')}
                  className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1"
                >
                  View all <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="divide-y">
                {alerts.slice(0, 5).map((alert: SentinelAlert) => (
                  <div key={alert.id} className="p-4 hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedAlert(alert)}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${
                          alert.severity === AlertSeverity.CRITICAL ? 'bg-red-100' :
                          alert.severity === AlertSeverity.WARNING ? 'bg-yellow-100' :
                          'bg-blue-100'
                        }`}>
                          <RuleTypeIcon type={alert.ruleType} className={`w-5 h-5 ${
                            alert.severity === AlertSeverity.CRITICAL ? 'text-red-600' :
                            alert.severity === AlertSeverity.WARNING ? 'text-yellow-600' :
                            'text-blue-600'
                          }`} />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{alert.title}</p>
                          <p className="text-sm text-gray-500 mt-0.5">{alert.ruleName}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <SeverityBadge severity={alert.severity} />
                            <StatusBadge status={alert.status} />
                            <span className="text-xs text-gray-400">{formatTimeAgo(alert.detectedAt)}</span>
                          </div>
                        </div>
                      </div>
                      <RiskScoreIndicator score={alert.riskScore} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Alerts Tab */}
        {activeTab === 'alerts' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white rounded-lg border p-4">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search alerts..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>
                </div>
                
                <select
                  value={alertFilter.status as string || ''}
                  onChange={(e) => setAlertFilter({ ...alertFilter, status: e.target.value as AlertStatus || undefined })}
                  className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">All Statuses</option>
                  {Object.values(AlertStatus).map(status => (
                    <option key={status} value={status}>{ALERT_STATUS_LABELS[status]}</option>
                  ))}
                </select>
                
                <select
                  value={alertFilter.severity as string || ''}
                  onChange={(e) => setAlertFilter({ ...alertFilter, severity: e.target.value as AlertSeverity || undefined })}
                  className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">All Severities</option>
                  {Object.values(AlertSeverity).map(severity => (
                    <option key={severity} value={severity}>{ALERT_SEVERITY_LABELS[severity]}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Alerts List */}
            <div className="bg-white rounded-lg border divide-y">
              {filteredAlerts.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No alerts found</p>
                </div>
              ) : (
                filteredAlerts.map((alert: SentinelAlert) => (
                  <div key={alert.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-4 flex-1">
                        <div className={`p-3 rounded-lg ${
                          alert.severity === AlertSeverity.CRITICAL ? 'bg-red-100' :
                          alert.severity === AlertSeverity.WARNING ? 'bg-yellow-100' :
                          'bg-blue-100'
                        }`}>
                          <RuleTypeIcon type={alert.ruleType} className={`w-6 h-6 ${
                            alert.severity === AlertSeverity.CRITICAL ? 'text-red-600' :
                            alert.severity === AlertSeverity.WARNING ? 'text-yellow-600' :
                            'text-blue-600'
                          }`} />
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-gray-900">{alert.title}</h4>
                            <span className="text-xs text-gray-400">#{alert.id.slice(-6)}</span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{alert.description}</p>
                          
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            <SeverityBadge severity={alert.severity} />
                            <StatusBadge status={alert.status} />
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {formatTimeAgo(alert.detectedAt)}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-1 text-gray-500">
                              <span>Wallet:</span>
                              <code className="bg-gray-100 px-2 py-0.5 rounded text-xs">{truncateWallet(alert.primaryWallet)}</code>
                              <button onClick={() => copyToClipboard(alert.primaryWallet)} className="text-gray-400 hover:text-gray-600">
                                <Copy className="w-3 h-3" />
                              </button>
                            </div>
                            {alert.relatedWallets.length > 0 && (
                              <span className="text-gray-500">
                                +{alert.relatedWallets.length} related
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        <RiskScoreIndicator score={alert.riskScore} />
                        
                        {alert.status === AlertStatus.PENDING && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleAlertAction(alert, AlertAction.DISMISS)}
                              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                              title="Dismiss"
                            >
                              <XCircle className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleAlertAction(alert, AlertAction.FLAG)}
                              className="p-2 text-yellow-500 hover:text-yellow-700 hover:bg-yellow-50 rounded-lg"
                              title="Flag"
                            >
                              <Flag className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleAlertAction(alert, AlertAction.ESCALATE)}
                              className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                              title="Escalate"
                            >
                              <ArrowUpRight className="w-5 h-5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Rules Tab */}
        {activeTab === 'rules' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Detection Rules</h2>
              <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2">
                <Code className="w-4 h-4" />
                Create Custom Rule
              </button>
            </div>
            
            <div className="grid gap-4">
              {rules.map((rule: RuleDefinition) => (
                <div key={rule.id} className="bg-white rounded-lg border p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-lg ${
                        rule.severity === AlertSeverity.CRITICAL ? 'bg-red-100' :
                        rule.severity === AlertSeverity.WARNING ? 'bg-yellow-100' :
                        'bg-blue-100'
                      }`}>
                        <RuleTypeIcon type={rule.type} className={`w-6 h-6 ${
                          rule.severity === AlertSeverity.CRITICAL ? 'text-red-600' :
                          rule.severity === AlertSeverity.WARNING ? 'text-yellow-600' :
                          'text-blue-600'
                        }`} />
                      </div>
                      
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-gray-900">{rule.name}</h4>
                          <SeverityBadge severity={rule.severity} />
                        </div>
                        <p className="text-sm text-gray-600 mb-3">{rule.description}</p>
                        
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(rule.parameters).map(([key, value]) => (
                            <span key={key} className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600">
                              {key}: {String(value)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Risk Weight</p>
                        <p className="font-medium">{(rule.thresholds.riskScoreWeight * 100).toFixed(0)}%</p>
                      </div>
                      
                      <button
                        onClick={() => {
                          if (!isDemo) {
                            toggleRuleMutation.mutate({ ruleId: rule.id, enabled: !rule.enabled });
                          }
                        }}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          rule.enabled ? 'bg-green-500' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            rule.enabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Guardians Tab */}
        {activeTab === 'guardians' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Guardian Network</h2>
              <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                Register Guardian
              </button>
            </div>
            
            {/* Guardian Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <Crown className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Super Admins</p>
                    <p className="text-2xl font-bold">{guardians.filter((g: Guardian) => g.role === GuardianRole.SUPER_ADMIN).length}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Star className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Admins</p>
                    <p className="text-2xl font-bold">{guardians.filter((g: Guardian) => g.role === GuardianRole.ADMIN).length}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Shield className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Guardians</p>
                    <p className="text-2xl font-bold">{guardians.filter((g: Guardian) => g.role === GuardianRole.GUARDIAN).length}</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Guardian List */}
            <div className="bg-white rounded-lg border divide-y">
              {guardians.map((guardian: Guardian, index: number) => (
                <div key={guardian.wallet} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full text-white font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium text-gray-900">{guardian.name || truncateWallet(guardian.wallet)}</h4>
                          <GuardianRoleBadge role={guardian.role} />
                          {guardian.isActive && (
                            <span className="flex items-center gap-1 text-xs text-green-600">
                              <CircleDot className="w-3 h-3" />
                              Active
                            </span>
                          )}
                        </div>
                        <code className="text-xs text-gray-500">{truncateWallet(guardian.wallet)}</code>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <p className="text-lg font-bold">{guardian.activity.alertsReviewed}</p>
                        <p className="text-xs text-gray-500">Reviewed</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-green-600">{guardian.activity.alertsFlagged}</p>
                        <p className="text-xs text-gray-500">Flagged</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-red-600">{guardian.activity.alertsEscalated}</p>
                        <p className="text-xs text-gray-500">Escalated</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-gray-500">{formatTimeAgo(guardian.activity.lastActive)}</p>
                        <p className="text-xs text-gray-500">Last Active</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Threats Tab */}
        {activeTab === 'threats' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Threat Clusters</h2>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">{threats.length} active clusters</span>
              </div>
            </div>
            
            {/* Threat Clusters */}
            <div className="grid gap-4">
              {threats.map((cluster: ThreatCluster) => (
                <div key={cluster.id} className="bg-white rounded-lg border p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`p-3 rounded-lg ${
                        cluster.riskScore >= 75 ? 'bg-red-100' :
                        cluster.riskScore >= 50 ? 'bg-yellow-100' :
                        'bg-blue-100'
                      }`}>
                        <Network className={`w-6 h-6 ${
                          cluster.riskScore >= 75 ? 'text-red-600' :
                          cluster.riskScore >= 50 ? 'text-yellow-600' :
                          'text-blue-600'
                        }`} />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">Cluster #{cluster.id.slice(-6)}</h4>
                        <p className="text-sm text-gray-500">{cluster.wallets.length} wallets • {cluster.transactionCount} transactions</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      <RiskScoreIndicator score={cluster.riskScore} />
                      <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                        cluster.status === 'active' ? 'bg-red-100 text-red-800' :
                        cluster.status === 'inactive' ? 'bg-gray-100 text-gray-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {cluster.status}
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-500">Total Volume</p>
                      <p className="font-medium">{formatNumber(cluster.totalVolume)} VRTY</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Center Wallet</p>
                      <code className="text-sm">{truncateWallet(cluster.centerWallet)}</code>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Detected</p>
                      <p className="font-medium">{formatTimeAgo(cluster.detectedAt)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Last Activity</p>
                      <p className="font-medium">{formatTimeAgo(cluster.lastActivity)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 flex-wrap">
                    {cluster.wallets.slice(0, 4).map((wallet: string) => (
                      <code key={wallet} className="px-2 py-1 bg-gray-100 rounded text-xs">
                        {truncateWallet(wallet)}
                      </code>
                    ))}
                    {cluster.wallets.length > 4 && (
                      <span className="text-sm text-gray-500">+{cluster.wallets.length - 4} more</span>
                    )}
                  </div>
                  
                  {cluster.relatedAlerts.length > 0 && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-sm text-gray-500 mb-2">Related Alerts: {cluster.relatedAlerts.length}</p>
                      <div className="flex gap-2">
                        {cluster.relatedAlerts.map((alertId: string) => (
                          <button
                            key={alertId}
                            onClick={() => {
                              const alert = alerts.find((a: SentinelAlert) => a.id === alertId);
                              if (alert) setSelectedAlert(alert);
                            }}
                            className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs hover:bg-purple-200"
                          >
                            #{alertId.slice(-6)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Alert Detail Modal */}
      {selectedAlert && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-lg ${
                    selectedAlert.severity === AlertSeverity.CRITICAL ? 'bg-red-100' :
                    selectedAlert.severity === AlertSeverity.WARNING ? 'bg-yellow-100' :
                    'bg-blue-100'
                  }`}>
                    <RuleTypeIcon type={selectedAlert.ruleType} className={`w-6 h-6 ${
                      selectedAlert.severity === AlertSeverity.CRITICAL ? 'text-red-600' :
                      selectedAlert.severity === AlertSeverity.WARNING ? 'text-yellow-600' :
                      'text-blue-600'
                    }`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{selectedAlert.title}</h3>
                    <p className="text-sm text-gray-500">{selectedAlert.ruleName}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedAlert(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                <SeverityBadge severity={selectedAlert.severity} />
                <StatusBadge status={selectedAlert.status} />
                <span className="text-sm text-gray-500">{formatTimeAgo(selectedAlert.detectedAt)}</span>
              </div>
              
              {/* Risk Score */}
              <div className="flex items-center gap-6">
                <div>
                  <p className="text-sm text-gray-500 mb-2">Risk Score</p>
                  <RiskScoreIndicator score={selectedAlert.riskScore} size="lg" />
                </div>
                <div>
                  <p className="text-sm text-gray-500 mb-2">Confidence</p>
                  <div className="text-3xl font-bold text-gray-900">{selectedAlert.confidence}%</div>
                </div>
              </div>
              
              {/* Description */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Description</h4>
                <p className="text-gray-600">{selectedAlert.description}</p>
              </div>
              
              {/* Wallet Info */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Primary Wallet</h4>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-gray-100 px-3 py-2 rounded text-sm">{selectedAlert.primaryWallet}</code>
                  <button onClick={() => copyToClipboard(selectedAlert.primaryWallet)} className="p-2 hover:bg-gray-100 rounded-lg">
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                {selectedAlert.relatedWallets.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm text-gray-500 mb-1">Related Wallets ({selectedAlert.relatedWallets.length})</p>
                    <div className="flex flex-wrap gap-1">
                      {selectedAlert.relatedWallets.map((wallet: string) => (
                        <code key={wallet} className="px-2 py-1 bg-gray-100 rounded text-xs">{truncateWallet(wallet)}</code>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Evidence */}
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Evidence</h4>
                <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500">Transactions:</span>
                      <span className="ml-2 font-medium">{selectedAlert.evidence.transactionCount}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Volume:</span>
                      <span className="ml-2 font-medium">{formatNumber(selectedAlert.evidence.transactionVolume)} VRTY</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Time Window:</span>
                      <span className="ml-2 font-medium">{selectedAlert.evidence.timeWindow}</span>
                    </div>
                    {selectedAlert.evidence.walletAge !== undefined && (
                      <div>
                        <span className="text-gray-500">Wallet Age:</span>
                        <span className="ml-2 font-medium">{selectedAlert.evidence.walletAge}h</span>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-2">{selectedAlert.evidence.patternDescription}</p>
                </div>
              </div>
              
              {/* Actions */}
              {selectedAlert.status === AlertStatus.PENDING && (
                <div className="flex gap-3 pt-4 border-t">
                  <button
                    onClick={() => handleAlertAction(selectedAlert, AlertAction.DISMISS)}
                    className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    Dismiss
                  </button>
                  <button
                    onClick={() => handleAlertAction(selectedAlert, AlertAction.FLAG)}
                    className="flex-1 px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg hover:bg-yellow-200 flex items-center justify-center gap-2"
                  >
                    <Flag className="w-4 h-4" />
                    Flag
                  </button>
                  <button
                    onClick={() => handleAlertAction(selectedAlert, AlertAction.ESCALATE)}
                    className="flex-1 px-4 py-2 bg-red-100 text-red-800 rounded-lg hover:bg-red-200 flex items-center justify-center gap-2"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                    Escalate
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Action Confirmation Modal */}
      {showActionModal && pendingAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-3 rounded-lg ${
                pendingAction.action === AlertAction.ESCALATE ? 'bg-red-100' :
                pendingAction.action === AlertAction.FLAG ? 'bg-yellow-100' :
                pendingAction.action === AlertAction.FREEZE ? 'bg-blue-100' :
                'bg-gray-100'
              }`}>
                {pendingAction.action === AlertAction.DISMISS && <XCircle className="w-6 h-6 text-gray-600" />}
                {pendingAction.action === AlertAction.FLAG && <Flag className="w-6 h-6 text-yellow-600" />}
                {pendingAction.action === AlertAction.FREEZE && <Lock className="w-6 h-6 text-blue-600" />}
                {pendingAction.action === AlertAction.ESCALATE && <ArrowUpRight className="w-6 h-6 text-red-600" />}
                {pendingAction.action === AlertAction.CLAWBACK_PROPOSAL && <Gavel className="w-6 h-6 text-purple-600" />}
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Confirm Action</h3>
                <p className="text-sm text-gray-500">{ALERT_ACTION_LABELS[pendingAction.action]}</p>
              </div>
            </div>
            
            <p className="text-gray-600 mb-6">
              Are you sure you want to {pendingAction.action.toLowerCase().replace('_', ' ')} this alert?
              This action will be recorded in the audit log.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowActionModal(false);
                  setPendingAction(null);
                }}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmAlertAction}
                className={`flex-1 px-4 py-2 rounded-lg text-white ${
                  pendingAction.action === AlertAction.ESCALATE ? 'bg-red-600 hover:bg-red-700' :
                  pendingAction.action === AlertAction.FLAG ? 'bg-yellow-600 hover:bg-yellow-700' :
                  pendingAction.action === AlertAction.FREEZE ? 'bg-blue-600 hover:bg-blue-700' :
                  'bg-gray-600 hover:bg-gray-700'
                }`}
                disabled={actionMutation.isPending}
              >
                {actionMutation.isPending ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
