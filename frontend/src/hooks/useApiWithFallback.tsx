/**
 * Custom hook for API integration with demo fallback
 * Verity Protocol - API Integration System
 * 
 * Features:
 * - Automatic fallback to demo data when API is unavailable
 * - Smart caching with configurable stale times
 * - Error boundary integration
 * - Live/Demo mode toggle
 * - Real-time API status tracking
 */

import { useQuery, useMutation } from '@tanstack/react-query';
import { useState, useEffect, useCallback, createContext, useContext } from 'react';

// ============================================================
// TYPES
// ============================================================

export interface ApiStatus {
  isOnline: boolean;
  lastChecked: Date | null;
  latency: number | null;
  errorCount: number;
}

export interface ApiConfig {
  /** If true, always use demo data regardless of API availability */
  forceDemoMode?: boolean;
  /** Time in ms before considering cached data stale */
  staleTime?: number;
  /** Number of retry attempts */
  retryCount?: number;
  /** Callback when API fails */
  onError?: (error: Error) => void;
}

interface ApiContextType {
  apiStatus: ApiStatus;
  isLiveMode: boolean;
  setLiveMode: (enabled: boolean) => void;
  checkApiHealth: () => Promise<boolean>;
}

// ============================================================
// CONTEXT
// ============================================================

const ApiContext = createContext<ApiContextType | null>(null);

export const useApiContext = () => {
  const context = useContext(ApiContext);
  if (!context) {
    // Return default context if not in provider
    return {
      apiStatus: { isOnline: false, lastChecked: null, latency: null, errorCount: 0 },
      isLiveMode: false,
      setLiveMode: () => {},
      checkApiHealth: async () => false,
    };
  }
  return context;
};

// ============================================================
// HOOK: useApiWithFallback
// ============================================================

export function useApiWithFallback<TData, TDemo = TData>(
  queryKey: string[],
  apiFn: () => Promise<TData>,
  demoData: TDemo,
  config?: ApiConfig
) {
  const { isLiveMode } = useApiContext();
  const [usedFallback, setUsedFallback] = useState(false);
  
  const effectiveConfig: ApiConfig = {
    forceDemoMode: false,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retryCount: 2,
    ...config,
  };

  const shouldFetchFromApi = isLiveMode && !effectiveConfig.forceDemoMode;

  const query = useQuery({
    queryKey: [...queryKey, 'api'],
    queryFn: async () => {
      try {
        const result = await apiFn();
        setUsedFallback(false);
        return result;
      } catch (error) {
        setUsedFallback(true);
        if (effectiveConfig.onError && error instanceof Error) {
          effectiveConfig.onError(error);
        }
        throw error;
      }
    },
    enabled: shouldFetchFromApi,
    staleTime: effectiveConfig.staleTime,
    retry: effectiveConfig.retryCount,
  });

  // Return combined result
  return {
    data: shouldFetchFromApi && query.data ? query.data : demoData,
    isLoading: shouldFetchFromApi && query.isLoading,
    isError: shouldFetchFromApi && query.isError,
    error: query.error,
    refetch: query.refetch,
    isLive: shouldFetchFromApi && !query.isError && !query.isLoading,
    isDemo: !shouldFetchFromApi || query.isError || usedFallback,
    usedFallback,
  };
}

// ============================================================
// HOOK: useApiMutation
// ============================================================

export function useApiMutation<TData, TVariables, TError = Error>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: {
    onSuccess?: (data: TData, variables: TVariables) => void;
    onError?: (error: TError, variables: TVariables) => void;
  }
) {
  const { isLiveMode } = useApiContext();

  const mutation = useMutation({
    mutationFn: async (variables: TVariables) => {
      if (!isLiveMode) {
        // In demo mode, simulate success after a brief delay
        await new Promise(resolve => setTimeout(resolve, 500));
        return { success: true, demo: true } as unknown as TData;
      }
      return mutationFn(variables);
    },
    onSuccess: options?.onSuccess,
    onError: options?.onError as (error: Error, variables: TVariables) => void,
  });

  return {
    ...mutation,
    isLive: isLiveMode,
    isDemo: !isLiveMode,
  };
}

// ============================================================
// PROVIDER COMPONENT
// ============================================================

interface ApiProviderProps {
  children: React.ReactNode;
  healthCheckUrl?: string;
}

export function ApiProvider({ children, healthCheckUrl = '/api/v1/health' }: ApiProviderProps) {
  const [apiStatus, setApiStatus] = useState<ApiStatus>({
    isOnline: false,
    lastChecked: null,
    latency: null,
    errorCount: 0,
  });
  
  const [isLiveMode, setIsLiveModeState] = useState(() => {
    const stored = localStorage.getItem('verity_live_mode');
    return stored === 'true';
  });

  const setLiveMode = useCallback((enabled: boolean) => {
    setIsLiveModeState(enabled);
    localStorage.setItem('verity_live_mode', String(enabled));
  }, []);

  const checkApiHealth = useCallback(async (): Promise<boolean> => {
    const start = Date.now();
    try {
      const response = await fetch(healthCheckUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      
      const latency = Date.now() - start;
      const isOnline = response.ok;
      
      setApiStatus({
        isOnline,
        lastChecked: new Date(),
        latency,
        errorCount: isOnline ? 0 : apiStatus.errorCount + 1,
      });
      
      return isOnline;
    } catch (error) {
      setApiStatus(prev => ({
        isOnline: false,
        lastChecked: new Date(),
        latency: null,
        errorCount: prev.errorCount + 1,
      }));
      return false;
    }
  }, [healthCheckUrl, apiStatus.errorCount]);

  // Check API health periodically when in live mode
  useEffect(() => {
    if (!isLiveMode) return;
    
    // Initial check
    checkApiHealth();
    
    // Periodic check every 30 seconds
    const interval = setInterval(checkApiHealth, 30000);
    return () => clearInterval(interval);
  }, [isLiveMode, checkApiHealth]);

  return (
    <ApiContext.Provider value={{ apiStatus, isLiveMode, setLiveMode, checkApiHealth }}>
      {children}
    </ApiContext.Provider>
  );
}

// ============================================================
// API STATUS INDICATOR COMPONENT
// ============================================================

export function ApiStatusIndicator() {
  const { apiStatus, isLiveMode } = useApiContext();
  
  if (!isLiveMode) {
    return (
      <div className="flex items-center gap-2 text-sm text-yellow-400">
        <div className="w-2 h-2 rounded-full bg-yellow-400" />
        <span>Demo Mode</span>
      </div>
    );
  }
  
  return (
    <div className={`flex items-center gap-2 text-sm ${
      apiStatus.isOnline ? 'text-emerald-400' : 'text-red-400'
    }`}>
      <div className={`w-2 h-2 rounded-full ${
        apiStatus.isOnline ? 'bg-emerald-400' : 'bg-red-400'
      }`} />
      <span>{apiStatus.isOnline ? 'Live' : 'Offline'}</span>
      {apiStatus.latency && (
        <span className="text-slate-500">({apiStatus.latency}ms)</span>
      )}
    </div>
  );
}

// ============================================================
// MODE TOGGLE COMPONENT
// ============================================================

interface ModeToggleProps {
  className?: string;
  showLatency?: boolean;
}

export function ModeToggle({ className = '', showLatency = false }: ModeToggleProps) {
  const { isLiveMode, setLiveMode, apiStatus, checkApiHealth } = useApiContext();
  
  const handleToggle = async () => {
    const newMode = !isLiveMode;
    if (newMode) {
      // Switching to live mode - check API first
      const isHealthy = await checkApiHealth();
      if (!isHealthy) {
        // Optionally show a warning
        console.warn('API is not available, but switching to live mode anyway');
      }
    }
    setLiveMode(newMode);
  };
  
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className={`text-sm ${isLiveMode ? 'text-slate-400' : 'text-white font-medium'}`}>
        Demo
      </span>
      <button
        onClick={handleToggle}
        className={`relative w-12 h-6 rounded-full transition-colors ${
          isLiveMode ? 'bg-emerald-600' : 'bg-slate-600'
        }`}
        title={isLiveMode ? 'Switch to demo mode' : 'Switch to live mode'}
      >
        <div
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
            isLiveMode ? 'translate-x-6' : 'translate-x-0.5'
          }`}
        />
      </button>
      <span className={`text-sm ${isLiveMode ? 'text-white font-medium' : 'text-slate-400'}`}>
        Live
      </span>
      {showLatency && isLiveMode && apiStatus.latency && (
        <span className="text-xs text-slate-500">({apiStatus.latency}ms)</span>
      )}
    </div>
  );
}

export default {
  useApiWithFallback,
  useApiMutation,
  useApiContext,
  ApiProvider,
  ApiStatusIndicator,
  ModeToggle,
};
