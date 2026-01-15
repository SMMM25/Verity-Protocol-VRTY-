/**
 * Verity Protocol - Notification System
 * 
 * @module components/ui/notifications
 * @description Comprehensive notification and toast system for user feedback.
 * Supports different notification types, actions, and persistence.
 * 
 * @version 1.0.0
 */

import React, { createContext, useContext, useReducer, useCallback } from 'react';
import type { ReactNode } from 'react';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Info,
  X,
  Bell,
  ArrowRight,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { cn } from '../../lib/utils';

// ============================================================
// TYPES
// ============================================================

export type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'loading';

export interface NotificationAction {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  href?: string;
  external?: boolean;
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number; // ms, 0 for persistent
  dismissible?: boolean;
  actions?: NotificationAction[];
  progress?: number; // 0-100 for progress notifications
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

interface NotificationState {
  notifications: Notification[];
  history: Notification[];
}

type NotificationActionType =
  | { type: 'ADD'; payload: Notification }
  | { type: 'REMOVE'; payload: string }
  | { type: 'UPDATE'; payload: { id: string; updates: Partial<Notification> } }
  | { type: 'CLEAR_ALL' }
  | { type: 'CLEAR_HISTORY' };

// ============================================================
// CONTEXT
// ============================================================

interface NotificationContextType {
  notifications: Notification[];
  history: Notification[];
  notify: (notification: Omit<Notification, 'id' | 'createdAt'>) => string;
  success: (title: string, message?: string, options?: Partial<Notification>) => string;
  error: (title: string, message?: string, options?: Partial<Notification>) => string;
  warning: (title: string, message?: string, options?: Partial<Notification>) => string;
  info: (title: string, message?: string, options?: Partial<Notification>) => string;
  loading: (title: string, message?: string, options?: Partial<Notification>) => string;
  update: (id: string, updates: Partial<Notification>) => void;
  dismiss: (id: string) => void;
  dismissAll: () => void;
  clearHistory: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

// ============================================================
// REDUCER
// ============================================================

const MAX_NOTIFICATIONS = 5;
const MAX_HISTORY = 50;

function notificationReducer(
  state: NotificationState,
  action: NotificationActionType
): NotificationState {
  switch (action.type) {
    case 'ADD': {
      const notifications = [action.payload, ...state.notifications].slice(0, MAX_NOTIFICATIONS);
      return { ...state, notifications };
    }
    case 'REMOVE': {
      const notification = state.notifications.find((n) => n.id === action.payload);
      const notifications = state.notifications.filter((n) => n.id !== action.payload);
      const history = notification
        ? [notification, ...state.history].slice(0, MAX_HISTORY)
        : state.history;
      return { ...state, notifications, history };
    }
    case 'UPDATE': {
      const notifications = state.notifications.map((n) =>
        n.id === action.payload.id ? { ...n, ...action.payload.updates } : n
      );
      return { ...state, notifications };
    }
    case 'CLEAR_ALL':
      return {
        ...state,
        notifications: [],
        history: [...state.notifications, ...state.history].slice(0, MAX_HISTORY),
      };
    case 'CLEAR_HISTORY':
      return { ...state, history: [] };
    default:
      return state;
  }
}

// ============================================================
// PROVIDER
// ============================================================

interface NotificationProviderProps {
  children: ReactNode;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

export function NotificationProvider({
  children,
  position = 'top-right',
}: NotificationProviderProps) {
  const [state, dispatch] = useReducer(notificationReducer, {
    notifications: [],
    history: [],
  });

  const generateId = () => `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const notify = useCallback((notification: Omit<Notification, 'id' | 'createdAt'>): string => {
    const id = generateId();
    const newNotification: Notification = {
      id,
      dismissible: true,
      duration: notification.type === 'loading' ? 0 : 5000,
      ...notification,
      createdAt: new Date(),
    };

    dispatch({ type: 'ADD', payload: newNotification });

    // Auto-dismiss after duration
    if (newNotification.duration && newNotification.duration > 0) {
      setTimeout(() => {
        dispatch({ type: 'REMOVE', payload: id });
      }, newNotification.duration);
    }

    return id;
  }, []);

  const success = useCallback(
    (title: string, message?: string, options?: Partial<Notification>): string => {
      return notify({ type: 'success', title, message, ...options });
    },
    [notify]
  );

  const error = useCallback(
    (title: string, message?: string, options?: Partial<Notification>): string => {
      return notify({ type: 'error', title, message, duration: 8000, ...options });
    },
    [notify]
  );

  const warning = useCallback(
    (title: string, message?: string, options?: Partial<Notification>): string => {
      return notify({ type: 'warning', title, message, duration: 6000, ...options });
    },
    [notify]
  );

  const info = useCallback(
    (title: string, message?: string, options?: Partial<Notification>): string => {
      return notify({ type: 'info', title, message, ...options });
    },
    [notify]
  );

  const loading = useCallback(
    (title: string, message?: string, options?: Partial<Notification>): string => {
      return notify({ type: 'loading', title, message, duration: 0, dismissible: false, ...options });
    },
    [notify]
  );

  const update = useCallback((id: string, updates: Partial<Notification>) => {
    dispatch({ type: 'UPDATE', payload: { id, updates } });

    // If updating to a completed state, auto-dismiss
    if (updates.type && updates.type !== 'loading') {
      const duration = updates.duration ?? 5000;
      if (duration > 0) {
        setTimeout(() => {
          dispatch({ type: 'REMOVE', payload: id });
        }, duration);
      }
    }
  }, []);

  const dismiss = useCallback((id: string) => {
    dispatch({ type: 'REMOVE', payload: id });
  }, []);

  const dismissAll = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' });
  }, []);

  const clearHistory = useCallback(() => {
    dispatch({ type: 'CLEAR_HISTORY' });
  }, []);

  const value: NotificationContextType = {
    notifications: state.notifications,
    history: state.history,
    notify,
    success,
    error,
    warning,
    info,
    loading,
    update,
    dismiss,
    dismissAll,
    clearHistory,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationContainer notifications={state.notifications} position={position} onDismiss={dismiss} />
    </NotificationContext.Provider>
  );
}

// ============================================================
// HOOK
// ============================================================

export function useNotifications(): NotificationContextType {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

// ============================================================
// NOTIFICATION CONTAINER
// ============================================================

interface NotificationContainerProps {
  notifications: Notification[];
  position: NotificationProviderProps['position'];
  onDismiss: (id: string) => void;
}

function NotificationContainer({ notifications, position, onDismiss }: NotificationContainerProps) {
  const positionClasses: Record<string, string> = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  };

  return (
    <div
      className={cn(
        'fixed z-50 flex flex-col gap-2 w-full max-w-sm pointer-events-none',
        positionClasses[position || 'top-right']
      )}
      role="region"
      aria-label="Notifications"
    >
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onDismiss={() => onDismiss(notification.id)}
        />
      ))}
    </div>
  );
}

// ============================================================
// NOTIFICATION ITEM
// ============================================================

interface NotificationItemProps {
  notification: Notification;
  onDismiss: () => void;
}

function NotificationItem({ notification, onDismiss }: NotificationItemProps) {
  const icons: Record<NotificationType, React.ReactNode> = {
    success: <CheckCircle className="h-5 w-5 text-emerald-500" />,
    error: <XCircle className="h-5 w-5 text-red-500" />,
    warning: <AlertTriangle className="h-5 w-5 text-amber-500" />,
    info: <Info className="h-5 w-5 text-blue-500" />,
    loading: <Loader2 className="h-5 w-5 text-violet-500 animate-spin" />,
  };

  const bgColors: Record<NotificationType, string> = {
    success: 'bg-emerald-500/10 border-emerald-500/20',
    error: 'bg-red-500/10 border-red-500/20',
    warning: 'bg-amber-500/10 border-amber-500/20',
    info: 'bg-blue-500/10 border-blue-500/20',
    loading: 'bg-violet-500/10 border-violet-500/20',
  };

  return (
    <div
      className={cn(
        'pointer-events-auto animate-in slide-in-from-right-full fade-in duration-300',
        'rounded-lg border p-4 shadow-lg backdrop-blur-sm',
        'bg-slate-900/95',
        bgColors[notification.type]
      )}
      role="alert"
    >
      <div className="flex gap-3">
        <div className="flex-shrink-0">{icons[notification.type]}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">{notification.title}</p>
          {notification.message && (
            <p className="mt-1 text-sm text-slate-300">{notification.message}</p>
          )}

          {/* Progress bar */}
          {notification.progress !== undefined && (
            <div className="mt-2">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Progress</span>
                <span>{notification.progress}%</span>
              </div>
              <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-500 transition-all duration-300"
                  style={{ width: `${notification.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          {notification.actions && notification.actions.length > 0 && (
            <div className="mt-3 flex gap-2">
              {notification.actions.map((action, index) => (
                <button
                  key={index}
                  onClick={action.onClick}
                  className={cn(
                    'inline-flex items-center gap-1 text-sm font-medium rounded px-2 py-1 transition-colors',
                    action.variant === 'primary' && 'bg-violet-600 hover:bg-violet-700 text-white',
                    action.variant === 'secondary' && 'bg-slate-700 hover:bg-slate-600 text-white',
                    action.variant === 'danger' && 'bg-red-600 hover:bg-red-700 text-white',
                    !action.variant && 'text-violet-400 hover:text-violet-300'
                  )}
                >
                  {action.label}
                  {action.external && <ExternalLink className="h-3 w-3" />}
                  {action.href && !action.external && <ArrowRight className="h-3 w-3" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {notification.dismissible && (
          <button
            onClick={onDismiss}
            className="flex-shrink-0 text-slate-400 hover:text-white transition-colors"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// NOTIFICATION CENTER (Bell icon with dropdown)
// ============================================================

interface NotificationCenterProps {
  className?: string;
}

export function NotificationCenter({ className }: NotificationCenterProps) {
  const { notifications, history, dismissAll, clearHistory } = useNotifications();
  const [isOpen, setIsOpen] = React.useState(false);

  const allNotifications = [...notifications, ...history];
  const unreadCount = notifications.length;

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-slate-800 transition-colors"
        aria-label={`Notifications (${unreadCount} unread)`}
      >
        <Bell className="h-5 w-5 text-slate-400" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-red-500 text-xs text-white flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-auto rounded-lg border border-slate-700 bg-slate-900 shadow-xl z-50">
            <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-3 flex items-center justify-between">
              <h3 className="font-medium text-white">Notifications</h3>
              <div className="flex gap-2">
                {notifications.length > 0 && (
                  <button
                    onClick={dismissAll}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Clear all
                  </button>
                )}
                {history.length > 0 && (
                  <button
                    onClick={clearHistory}
                    className="text-xs text-slate-400 hover:text-white"
                  >
                    Clear history
                  </button>
                )}
              </div>
            </div>

            {allNotifications.length === 0 ? (
              <div className="p-6 text-center text-slate-400">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800">
                {allNotifications.map((notification) => (
                  <NotificationCenterItem key={notification.id} notification={notification} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function NotificationCenterItem({ notification }: { notification: Notification }) {
  const icons: Record<NotificationType, React.ReactNode> = {
    success: <CheckCircle className="h-4 w-4 text-emerald-500" />,
    error: <XCircle className="h-4 w-4 text-red-500" />,
    warning: <AlertTriangle className="h-4 w-4 text-amber-500" />,
    info: <Info className="h-4 w-4 text-blue-500" />,
    loading: <Loader2 className="h-4 w-4 text-violet-500 animate-spin" />,
  };

  const timeAgo = getTimeAgo(notification.createdAt);

  return (
    <div className="p-3 hover:bg-slate-800/50">
      <div className="flex gap-3">
        <div className="flex-shrink-0 mt-0.5">{icons[notification.type]}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{notification.title}</p>
          {notification.message && (
            <p className="text-xs text-slate-400 truncate">{notification.message}</p>
          )}
          <p className="text-xs text-slate-500 mt-1">{timeAgo}</p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// HELPERS
// ============================================================

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

// ============================================================
// PRE-BUILT NOTIFICATION TEMPLATES
// ============================================================

export const notificationTemplates = {
  bridgeInitiated: (bridgeId: string) => ({
    type: 'info' as const,
    title: 'Bridge Transaction Initiated',
    message: `Your cross-chain transfer has been initiated. ID: ${bridgeId.slice(0, 8)}...`,
    actions: [
      {
        label: 'View Status',
        onClick: () => window.location.href = `/bridge?id=${bridgeId}`,
      },
    ],
  }),

  bridgeCompleted: (amount: number, chain: string) => ({
    type: 'success' as const,
    title: 'Bridge Complete!',
    message: `Successfully bridged ${amount} VRTY to ${chain}`,
  }),

  bridgeFailed: (error: string) => ({
    type: 'error' as const,
    title: 'Bridge Failed',
    message: error || 'An error occurred during the bridge transaction',
    actions: [
      {
        label: 'Try Again',
        onClick: () => window.location.reload(),
        variant: 'primary' as const,
      },
    ],
  }),

  transactionSuccess: (txHash: string) => ({
    type: 'success' as const,
    title: 'Transaction Confirmed',
    message: `Transaction ${txHash.slice(0, 8)}... has been confirmed`,
    actions: [
      {
        label: 'View on Explorer',
        onClick: () => window.open(`https://testnet.xrpl.org/transactions/${txHash}`, '_blank'),
        external: true,
      },
    ],
  }),

  alertDetected: (severity: string, title: string) => ({
    type: severity === 'CRITICAL' ? 'error' as const : 'warning' as const,
    title: 'Security Alert',
    message: title,
    actions: [
      {
        label: 'Review',
        onClick: () => window.location.href = '/sentinel',
        variant: 'primary' as const,
      },
    ],
  }),

  walletConnected: (address: string) => ({
    type: 'success' as const,
    title: 'Wallet Connected',
    message: `Connected to ${address.slice(0, 6)}...${address.slice(-4)}`,
  }),

  walletDisconnected: () => ({
    type: 'info' as const,
    title: 'Wallet Disconnected',
    message: 'Your wallet has been disconnected',
  }),

  copySuccess: (item: string) => ({
    type: 'success' as const,
    title: 'Copied!',
    message: `${item} copied to clipboard`,
    duration: 2000,
  }),

  networkError: () => ({
    type: 'error' as const,
    title: 'Network Error',
    message: 'Unable to connect to the server. Please check your connection.',
    actions: [
      {
        label: 'Retry',
        onClick: () => window.location.reload(),
        variant: 'primary' as const,
      },
    ],
  }),
};

export default NotificationProvider;
