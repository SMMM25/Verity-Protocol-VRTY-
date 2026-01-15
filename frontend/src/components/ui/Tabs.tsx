import { useState, useRef, useEffect } from 'react';

interface Tab {
  id: string;
  label: string;
  icon?: React.ElementType;
  badge?: string | number;
  disabled?: boolean;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: 'pills' | 'underline' | 'boxed';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  className?: string;
}

const sizeStyles = {
  sm: {
    tab: 'px-3 py-1.5 text-xs gap-1.5',
    icon: 'w-3.5 h-3.5',
    badge: 'px-1.5 py-0.5 text-xs',
  },
  md: {
    tab: 'px-4 py-2 text-sm gap-2',
    icon: 'w-4 h-4',
    badge: 'px-2 py-0.5 text-xs',
  },
  lg: {
    tab: 'px-5 py-2.5 text-base gap-2',
    icon: 'w-5 h-5',
    badge: 'px-2 py-1 text-xs',
  },
};

export function Tabs({ 
  tabs, 
  activeTab, 
  onChange, 
  variant = 'pills',
  size = 'md',
  fullWidth = false,
  className = '' 
}: TabsProps) {
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const tabsRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLButtonElement>(null);

  // Update underline indicator position
  useEffect(() => {
    if (variant === 'underline' && activeTabRef.current && tabsRef.current) {
      const tabRect = activeTabRef.current.getBoundingClientRect();
      const containerRect = tabsRef.current.getBoundingClientRect();
      
      setIndicatorStyle({
        left: tabRect.left - containerRect.left,
        width: tabRect.width,
      });
    }
  }, [activeTab, variant]);

  const styles = sizeStyles[size];

  if (variant === 'pills') {
    return (
      <div 
        className={`inline-flex bg-slate-800 rounded-xl p-1 gap-1 ${fullWidth ? 'w-full' : ''} ${className}`}
        role="tablist"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          const Icon = tab.icon;
          
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-disabled={tab.disabled}
              onClick={() => !tab.disabled && onChange(tab.id)}
              disabled={tab.disabled}
              className={`
                ${styles.tab}
                ${fullWidth ? 'flex-1' : ''}
                inline-flex items-center justify-center font-medium rounded-lg
                transition-all duration-200
                focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-inset
                ${isActive 
                  ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/25' 
                  : 'text-white/60 hover:text-white hover:bg-white/5'
                }
                ${tab.disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {Icon && <Icon className={styles.icon} />}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className={`
                  ${styles.badge} rounded-full ml-1
                  ${isActive ? 'bg-white/20 text-white' : 'bg-slate-700 text-white/60'}
                `}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  if (variant === 'underline') {
    return (
      <div className={`relative ${className}`}>
        <div 
          ref={tabsRef}
          className={`flex border-b border-slate-700 ${fullWidth ? '' : 'inline-flex'}`}
          role="tablist"
        >
          {tabs.map((tab) => {
            const isActive = tab.id === activeTab;
            const Icon = tab.icon;
            
            return (
              <button
                key={tab.id}
                ref={isActive ? activeTabRef : null}
                role="tab"
                aria-selected={isActive}
                aria-disabled={tab.disabled}
                onClick={() => !tab.disabled && onChange(tab.id)}
                disabled={tab.disabled}
                className={`
                  ${styles.tab}
                  ${fullWidth ? 'flex-1' : ''}
                  inline-flex items-center justify-center font-medium
                  transition-all duration-200 relative
                  focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-inset
                  ${isActive ? 'text-white' : 'text-white/60 hover:text-white'}
                  ${tab.disabled ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                {Icon && <Icon className={styles.icon} />}
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span className={`
                    ${styles.badge} rounded-full ml-1
                    ${isActive ? 'bg-violet-500/20 text-violet-400' : 'bg-slate-700 text-white/60'}
                  `}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        
        {/* Animated indicator */}
        <div 
          className="absolute bottom-0 h-0.5 bg-violet-500 transition-all duration-300 ease-out"
          style={{ left: indicatorStyle.left, width: indicatorStyle.width }}
        />
      </div>
    );
  }

  // Boxed variant
  return (
    <div 
      className={`inline-flex border border-slate-700 rounded-xl overflow-hidden ${fullWidth ? 'w-full' : ''} ${className}`}
      role="tablist"
    >
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeTab;
        const Icon = tab.icon;
        
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            aria-disabled={tab.disabled}
            onClick={() => !tab.disabled && onChange(tab.id)}
            disabled={tab.disabled}
            className={`
              ${styles.tab}
              ${fullWidth ? 'flex-1' : ''}
              inline-flex items-center justify-center font-medium
              transition-all duration-200
              focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-inset
              ${index > 0 ? 'border-l border-slate-700' : ''}
              ${isActive 
                ? 'bg-violet-600 text-white' 
                : 'bg-slate-800 text-white/60 hover:text-white hover:bg-slate-700'
              }
              ${tab.disabled ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            {Icon && <Icon className={styles.icon} />}
            <span>{tab.label}</span>
            {tab.badge !== undefined && (
              <span className={`
                ${styles.badge} rounded-full ml-1
                ${isActive ? 'bg-white/20 text-white' : 'bg-slate-600 text-white/60'}
              `}>
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
