import { Check, Clock, AlertCircle, X, Loader2 } from 'lucide-react';

export type StatusType = 
  | 'ACTIVE' | 'COMPLIANT' | 'COMPLETED' | 'VERIFIED' | 'SUCCESS'
  | 'PENDING' | 'PENDING_REVIEW' | 'PROCESSING' | 'SCHEDULED'
  | 'FAILED' | 'NON_COMPLIANT' | 'FROZEN' | 'SUSPENDED' | 'ERROR' | 'REJECTED'
  | 'UNDER_REVIEW' | 'IN_PROGRESS'
  | 'CANCELLED' | 'INACTIVE' | 'EXPIRED';

interface StatusBadgeProps {
  status: StatusType | string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  pulse?: boolean;
  className?: string;
}

const getVariant = (status: string): 'success' | 'warning' | 'error' | 'info' | 'neutral' => {
  const upperStatus = status.toUpperCase();
  
  if (['ACTIVE', 'COMPLIANT', 'COMPLETED', 'VERIFIED', 'SUCCESS'].includes(upperStatus)) {
    return 'success';
  }
  if (['PENDING', 'PENDING_REVIEW', 'PROCESSING', 'SCHEDULED'].includes(upperStatus)) {
    return 'warning';
  }
  if (['FAILED', 'NON_COMPLIANT', 'FROZEN', 'SUSPENDED', 'ERROR', 'REJECTED'].includes(upperStatus)) {
    return 'error';
  }
  if (['UNDER_REVIEW', 'IN_PROGRESS'].includes(upperStatus)) {
    return 'info';
  }
  return 'neutral';
};

const variantStyles = {
  success: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
    icon: Check,
  },
  warning: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
    icon: Clock,
  },
  error: {
    bg: 'bg-red-500/10',
    text: 'text-red-400',
    border: 'border-red-500/20',
    icon: X,
  },
  info: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/20',
    icon: AlertCircle,
  },
  neutral: {
    bg: 'bg-slate-500/10',
    text: 'text-slate-400',
    border: 'border-slate-500/20',
    icon: AlertCircle,
  },
};

const sizeStyles = {
  sm: 'px-2 py-0.5 text-xs gap-1',
  md: 'px-2.5 py-1 text-xs gap-1.5',
  lg: 'px-3 py-1.5 text-sm gap-2',
};

const iconSizes = {
  sm: 'w-3 h-3',
  md: 'w-3.5 h-3.5',
  lg: 'w-4 h-4',
};

export function StatusBadge({ 
  status, 
  size = 'md', 
  showIcon = true, 
  pulse = false,
  className = '' 
}: StatusBadgeProps) {
  const variant = getVariant(status);
  const styles = variantStyles[variant];
  const Icon = styles.icon;
  
  const isProcessing = ['PROCESSING', 'IN_PROGRESS', 'PENDING'].includes(status.toUpperCase());
  const shouldPulse = pulse || isProcessing;

  const formatStatus = (s: string) => {
    return s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <span 
      className={`
        inline-flex items-center font-medium rounded-full border
        ${styles.bg} ${styles.text} ${styles.border}
        ${sizeStyles[size]}
        ${shouldPulse ? 'animate-pulse' : ''}
        ${className}
      `}
    >
      {showIcon && (
        isProcessing ? (
          <Loader2 className={`${iconSizes[size]} animate-spin`} />
        ) : (
          <Icon className={iconSizes[size]} />
        )
      )}
      <span>{formatStatus(status)}</span>
    </span>
  );
}

export default StatusBadge;
