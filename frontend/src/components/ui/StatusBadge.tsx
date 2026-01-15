/**
 * StatusBadge Component
 * Polished with Lovable.dev patterns - clean, semantic status indicators
 */
import { cn } from '@/lib/utils';

export type StatusType = 
  | 'ACTIVE' | 'COMPLIANT' | 'COMPLETED' | 'VERIFIED' | 'SUCCESS'
  | 'PENDING' | 'PENDING_REVIEW' | 'PROCESSING' | 'SCHEDULED'
  | 'FAILED' | 'NON_COMPLIANT' | 'FROZEN' | 'SUSPENDED' | 'ERROR' | 'REJECTED'
  | 'UNDER_REVIEW' | 'IN_PROGRESS'
  | 'CANCELLED' | 'INACTIVE' | 'EXPIRED';

interface StatusBadgeProps {
  status: StatusType | string;
  size?: 'sm' | 'md';
  showIcon?: boolean;
  className?: string;
}

const statusConfig: Record<string, { bg: string; text: string; border: string; animate?: boolean }> = {
  // Success states (emerald)
  ACTIVE: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  COMPLIANT: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  COMPLETED: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  VERIFIED: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  SUCCESS: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  
  // Warning/Processing states (amber)
  PENDING: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
  PENDING_REVIEW: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
  PROCESSING: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', animate: true },
  SCHEDULED: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
  IN_PROGRESS: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', animate: true },
  
  // Error states (red)
  FAILED: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
  NON_COMPLIANT: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
  FROZEN: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
  SUSPENDED: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
  ERROR: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
  REJECTED: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
  
  // Info states (blue)
  UNDER_REVIEW: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  
  // Neutral states (slate)
  CANCELLED: { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/30' },
  INACTIVE: { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/30' },
  EXPIRED: { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/30' },
};

const defaultConfig = { bg: 'bg-slate-500/20', text: 'text-slate-400', border: 'border-slate-500/30' };

const sizeConfig = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-sm',
};

export function StatusBadge({ 
  status, 
  size = 'md', 
  showIcon = true,
  className 
}: StatusBadgeProps) {
  const upperStatus = status.toUpperCase();
  const config = statusConfig[upperStatus] || defaultConfig;
  const isProcessing = ['PROCESSING', 'IN_PROGRESS'].includes(upperStatus);

  const formatStatus = (s: string) => {
    return s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium',
        config.bg,
        config.text,
        config.border,
        sizeConfig[size],
        className
      )}
    >
      {showIcon && isProcessing && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
        </span>
      )}
      {formatStatus(status)}
    </span>
  );
}

export default StatusBadge;
