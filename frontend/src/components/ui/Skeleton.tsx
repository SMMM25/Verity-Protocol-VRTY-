/**
 * Skeleton Component
 * Polished with Lovable.dev patterns - loading placeholders
 */
import { cn } from '@/lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse bg-slate-700 rounded', className)}
      {...props}
    />
  );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-4', i === lines - 1 ? 'w-3/4' : 'w-full')} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('p-6 bg-slate-800 border border-slate-700 rounded-xl', className)}>
      <Skeleton className="h-6 w-1/3 mb-4" />
      <SkeletonText lines={2} />
      <div className="flex gap-2 mt-4">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  );
}

export function SkeletonAvatar({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-12 w-12' };
  return <Skeleton className={cn('rounded-full', sizeClasses[size])} />;
}

export function SkeletonTable({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-3">
      <div className="flex gap-4 pb-3 border-b border-slate-700">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 py-2">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <Skeleton key={colIndex} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonStatCard({ className }: { className?: string }) {
  return (
    <div className={cn('bg-slate-800 rounded-xl p-6 border border-slate-700', className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-8 w-32" />
        </div>
        <Skeleton className="w-10 h-10 rounded-lg" />
      </div>
    </div>
  );
}

export function SkeletonOrderBook({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
      <Skeleton className="h-5 w-32 mb-4" />
      
      {/* Header */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-16 ml-auto" />
        <Skeleton className="h-3 w-16 ml-auto" />
      </div>
      
      {/* Asks */}
      <div className="space-y-1 mb-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={`ask-${i}`} className="grid grid-cols-3 gap-2">
            <Skeleton className="h-4" />
            <Skeleton className="h-4" />
            <Skeleton className="h-4" />
          </div>
        ))}
      </div>
      
      {/* Spread */}
      <div className="py-2 flex justify-center">
        <Skeleton className="h-6 w-24" />
      </div>
      
      {/* Bids */}
      <div className="space-y-1 mt-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={`bid-${i}`} className="grid grid-cols-3 gap-2">
            <Skeleton className="h-4" />
            <Skeleton className="h-4" />
            <Skeleton className="h-4" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonAssetCard({ className }: { className?: string }) {
  return (
    <div className={cn('bg-slate-800 rounded-xl border border-slate-700 overflow-hidden', className)}>
      {/* Image */}
      <Skeleton className="aspect-video w-full rounded-none" />
      
      {/* Content */}
      <div className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <SkeletonAvatar size="sm" />
          <div className="flex-1">
            <Skeleton className="h-5 w-3/4 mb-1" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <Skeleton className="h-3 w-16 mb-1" />
            <Skeleton className="h-5 w-24" />
          </div>
          <div>
            <Skeleton className="h-3 w-16 mb-1" />
            <Skeleton className="h-5 w-20" />
          </div>
        </div>
        
        <Skeleton className="h-10 w-full rounded-xl" />
      </div>
    </div>
  );
}

export default Skeleton;
