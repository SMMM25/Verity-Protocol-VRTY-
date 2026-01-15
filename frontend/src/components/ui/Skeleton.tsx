interface SkeletonProps {
  className?: string;
  variant?: 'default' | 'circular' | 'text';
  animate?: boolean;
}

export function Skeleton({ 
  className = '', 
  variant = 'default',
  animate = true 
}: SkeletonProps) {
  const baseStyles = 'bg-slate-700';
  const animationStyles = animate ? 'animate-pulse' : '';
  
  const variantStyles = {
    default: 'rounded-lg',
    circular: 'rounded-full',
    text: 'rounded h-4',
  };

  return (
    <div 
      className={`${baseStyles} ${animationStyles} ${variantStyles[variant]} ${className}`}
      aria-hidden="true"
    />
  );
}

// Pre-built skeleton components
export function SkeletonText({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i} 
          variant="text" 
          className={i === lines - 1 ? 'w-2/3' : 'w-full'} 
        />
      ))}
    </div>
  );
}

export function SkeletonAvatar({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
  };

  return <Skeleton variant="circular" className={sizes[size]} />;
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-slate-800 rounded-xl p-6 border border-slate-700 ${className}`}>
      <div className="flex items-start gap-4 mb-4">
        <SkeletonAvatar />
        <div className="flex-1">
          <Skeleton className="h-5 w-1/3 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
      <SkeletonText lines={3} />
    </div>
  );
}

export function SkeletonStatCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-slate-800 rounded-xl p-6 border border-slate-700 ${className}`}>
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

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="flex gap-4 p-4 border-b border-slate-700 bg-slate-800/50">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div 
          key={rowIndex} 
          className="flex gap-4 p-4 border-b border-slate-700 last:border-b-0"
        >
          {Array.from({ length: cols }).map((_, colIndex) => (
            <Skeleton key={colIndex} className="h-4 flex-1" />
          ))}
        </div>
      ))}
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

export function SkeletonAssetCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-slate-800 rounded-xl border border-slate-700 overflow-hidden ${className}`}>
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
