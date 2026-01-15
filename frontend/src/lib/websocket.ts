/**
 * Verity Protocol - WebSocket Service
 * 
 * @module lib/websocket
 * @description Real-time WebSocket client for live updates across all dashboards.
 * Provides a unified interface for subscribing to events like bridge status,
 * price updates, alerts, and more.
 * 
 * @version 1.0.0
 */

import { EventEmitter } from 'eventemitter3';

// ============================================================
// TYPES
// ============================================================

export type WebSocketEventType = 
  | 'bridge:status'
  | 'bridge:completed'
  | 'bridge:failed'
  | 'bridge:validators'
  | 'dex:price'
  | 'dex:trade'
  | 'dex:orderbook'
  | 'sentinel:alert'
  | 'sentinel:stats'
  | 'guild:transaction'
  | 'guild:member'
  | 'signals:new'
  | 'signals:reputation'
  | 'tax:calculation'
  | 'system:status'
  | 'error';

export interface WebSocketMessage<T = unknown> {
  type: WebSocketEventType;
  data: T;
  timestamp: string;
  subscriptionId?: string;
}

export interface SubscriptionOptions {
  filters?: Record<string, unknown>;
  throttleMs?: number;
}

export interface ConnectionState {
  connected: boolean;
  reconnecting: boolean;
  reconnectAttempt: number;
  lastConnected?: Date;
  latency?: number;
}

// ============================================================
// CONSTANTS
// ============================================================

const WS_BASE_URL = import.meta.env.VITE_WS_URL || 
  (window.location.protocol === 'https:' ? 'wss:' : 'ws:') + 
  '//' + window.location.host + '/ws';

const RECONNECT_DELAYS = [1000, 2000, 5000, 10000, 30000, 60000];
const HEARTBEAT_INTERVAL = 30000;
const HEARTBEAT_TIMEOUT = 10000;

// ============================================================
// WEBSOCKET SERVICE
// ============================================================

class VerityWebSocket extends EventEmitter {
  private ws: WebSocket | null = null;
  private subscriptions: Map<string, SubscriptionOptions> = new Map();
  private state: ConnectionState = {
    connected: false,
    reconnecting: false,
    reconnectAttempt: 0,
  };
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private messageQueue: WebSocketMessage[] = [];
  private connectionPromise: Promise<void> | null = null;

  constructor() {
    super();
  }

  // ============================================================
  // CONNECTION MANAGEMENT
  // ============================================================

  /**
   * Connect to WebSocket server
   */
  connect(): Promise<void> {
    // Return existing promise if connection in progress
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    // Return immediately if already connected
    if (this.ws?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      try {
        const token = localStorage.getItem('verity_token');
        const wsUrl = token ? `${WS_BASE_URL}?token=${token}` : WS_BASE_URL;
        
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          this.state = {
            connected: true,
            reconnecting: false,
            reconnectAttempt: 0,
            lastConnected: new Date(),
          };
          
          this.startHeartbeat();
          this.flushMessageQueue();
          this.resubscribeAll();
          
          this.emit('connected', this.state);
          this.connectionPromise = null;
          resolve();
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event);
        };

        this.ws.onclose = (event) => {
          this.handleDisconnect(event);
        };

        this.ws.onerror = (error) => {
          this.emit('error', { error, state: this.state });
          this.connectionPromise = null;
          reject(error);
        };
      } catch (error) {
        this.connectionPromise = null;
        reject(error);
      }
    });

    return this.connectionPromise;
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    this.stopHeartbeat();
    this.clearReconnectTimeout();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.state = {
      connected: false,
      reconnecting: false,
      reconnectAttempt: 0,
    };

    this.emit('disconnected', this.state);
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return { ...this.state };
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // ============================================================
  // MESSAGE HANDLING
  // ============================================================

  private handleMessage(event: MessageEvent): void {
    try {
      const message: WebSocketMessage = JSON.parse(event.data);

      // Handle heartbeat response
      if (message.type === 'system:status' && (message.data as any)?.type === 'pong') {
        this.handlePong(message);
        return;
      }

      // Emit specific event type
      this.emit(message.type, message.data);

      // Emit generic message event
      this.emit('message', message);

      // Handle subscription-specific messages
      if (message.subscriptionId && this.subscriptions.has(message.subscriptionId)) {
        this.emit(`subscription:${message.subscriptionId}`, message.data);
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
      this.emit('error', { error, raw: event.data });
    }
  }

  private handleDisconnect(event: CloseEvent): void {
    this.stopHeartbeat();
    
    this.state.connected = false;
    this.emit('disconnected', { code: event.code, reason: event.reason });

    // Attempt reconnection if not a clean close
    if (event.code !== 1000) {
      this.scheduleReconnect();
    }
  }

  // ============================================================
  // HEARTBEAT
  // ============================================================

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected()) {
        this.sendPing();
      }
    }, HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  private sendPing(): void {
    const pingTime = Date.now();
    this.send({
      type: 'system:status',
      data: { type: 'ping', timestamp: pingTime },
      timestamp: new Date().toISOString(),
    });

    this.heartbeatTimeout = setTimeout(() => {
      console.warn('WebSocket heartbeat timeout');
      this.ws?.close(4000, 'Heartbeat timeout');
    }, HEARTBEAT_TIMEOUT);
  }

  private handlePong(message: WebSocketMessage): void {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }

    // Calculate latency
    const pongData = message.data as any;
    if (pongData.pingTimestamp) {
      this.state.latency = Date.now() - pongData.pingTimestamp;
    }
  }

  // ============================================================
  // RECONNECTION
  // ============================================================

  private scheduleReconnect(): void {
    if (this.state.reconnecting) {
      return;
    }

    this.state.reconnecting = true;
    const delay = RECONNECT_DELAYS[
      Math.min(this.state.reconnectAttempt, RECONNECT_DELAYS.length - 1)
    ];

    console.log(`Scheduling reconnect in ${delay}ms (attempt ${this.state.reconnectAttempt + 1})`);
    
    this.reconnectTimeout = setTimeout(() => {
      this.state.reconnectAttempt++;
      this.emit('reconnecting', { attempt: this.state.reconnectAttempt, delay });
      
      this.connect().catch(() => {
        // Will trigger another reconnect via onclose
      });
    }, delay);
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.state.reconnecting = false;
  }

  // ============================================================
  // SUBSCRIPTIONS
  // ============================================================

  /**
   * Subscribe to a specific event type
   */
  subscribe(
    eventType: WebSocketEventType,
    callback: (data: unknown) => void,
    options: SubscriptionOptions = {}
  ): string {
    const subscriptionId = `${eventType}:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
    
    this.subscriptions.set(subscriptionId, { ...options, filters: { type: eventType, ...options.filters } });
    
    // Register local callback
    this.on(eventType, callback);

    // Send subscription message to server if connected
    if (this.isConnected()) {
      this.send({
        type: 'system:status',
        data: {
          action: 'subscribe',
          subscriptionId,
          eventType,
          ...options,
        },
        timestamp: new Date().toISOString(),
      });
    }

    return subscriptionId;
  }

  /**
   * Unsubscribe from an event
   */
  unsubscribe(subscriptionId: string): void {
    if (!this.subscriptions.has(subscriptionId)) {
      return;
    }

    this.subscriptions.delete(subscriptionId);

    // Send unsubscription message to server
    if (this.isConnected()) {
      this.send({
        type: 'system:status',
        data: {
          action: 'unsubscribe',
          subscriptionId,
        },
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Resubscribe all subscriptions after reconnect
   */
  private resubscribeAll(): void {
    for (const [subscriptionId, options] of this.subscriptions) {
      const eventType = (options.filters as any)?.type;
      if (eventType) {
        this.send({
          type: 'system:status',
          data: {
            action: 'subscribe',
            subscriptionId,
            eventType,
            ...options,
          },
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  // ============================================================
  // SENDING MESSAGES
  // ============================================================

  /**
   * Send a message to the server
   */
  send(message: WebSocketMessage): void {
    if (this.isConnected()) {
      this.ws?.send(JSON.stringify(message));
    } else {
      // Queue message for later
      this.messageQueue.push(message);
    }
  }

  /**
   * Flush queued messages after reconnect
   */
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.ws?.send(JSON.stringify(message));
      }
    }
  }

  // ============================================================
  // CONVENIENCE METHODS
  // ============================================================

  /**
   * Subscribe to bridge status updates
   */
  subscribeToBridge(bridgeId: string, callback: (data: unknown) => void): string {
    return this.subscribe('bridge:status', callback, {
      filters: { bridgeId },
    });
  }

  /**
   * Subscribe to DEX price updates
   */
  subscribeToPrices(pairs: string[], callback: (data: unknown) => void): string {
    return this.subscribe('dex:price', callback, {
      filters: { pairs },
      throttleMs: 1000, // Max 1 update per second
    });
  }

  /**
   * Subscribe to sentinel alerts
   */
  subscribeToAlerts(callback: (data: unknown) => void): string {
    return this.subscribe('sentinel:alert', callback);
  }

  /**
   * Subscribe to guild updates
   */
  subscribeToGuild(guildId: string, callback: (data: unknown) => void): string {
    return this.subscribe('guild:transaction', callback, {
      filters: { guildId },
    });
  }

  /**
   * Subscribe to signals updates
   */
  subscribeToSignals(callback: (data: unknown) => void): string {
    return this.subscribe('signals:new', callback);
  }
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

export const verityWebSocket = new VerityWebSocket();

// ============================================================
// REACT HOOK
// ============================================================

import { useEffect, useState, useCallback } from 'react';

export function useWebSocket() {
  const [state, setState] = useState<ConnectionState>(verityWebSocket.getState());

  useEffect(() => {
    const handleConnected = (newState: ConnectionState) => setState(newState);
    const handleDisconnected = () => setState(verityWebSocket.getState());
    const handleReconnecting = () => setState(verityWebSocket.getState());

    verityWebSocket.on('connected', handleConnected);
    verityWebSocket.on('disconnected', handleDisconnected);
    verityWebSocket.on('reconnecting', handleReconnecting);

    // Auto-connect
    verityWebSocket.connect().catch(console.error);

    return () => {
      verityWebSocket.off('connected', handleConnected);
      verityWebSocket.off('disconnected', handleDisconnected);
      verityWebSocket.off('reconnecting', handleReconnecting);
    };
  }, []);

  return {
    ...state,
    connect: useCallback(() => verityWebSocket.connect(), []),
    disconnect: useCallback(() => verityWebSocket.disconnect(), []),
    subscribe: useCallback(
      (eventType: WebSocketEventType, callback: (data: unknown) => void, options?: SubscriptionOptions) =>
        verityWebSocket.subscribe(eventType, callback, options),
      []
    ),
    unsubscribe: useCallback((id: string) => verityWebSocket.unsubscribe(id), []),
    send: useCallback((message: WebSocketMessage) => verityWebSocket.send(message), []),
  };
}

/**
 * Hook for subscribing to specific event type
 */
export function useWebSocketEvent<T = unknown>(
  eventType: WebSocketEventType,
  options?: SubscriptionOptions
): { data: T | null; error: Error | null } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const handleData = (newData: unknown) => {
      try {
        setData(newData as T);
        setError(null);
      } catch (e) {
        setError(e as Error);
      }
    };

    const handleError = (err: unknown) => {
      setError(err as Error);
    };

    const subId = verityWebSocket.subscribe(eventType, handleData, options);
    verityWebSocket.on('error', handleError);

    return () => {
      verityWebSocket.unsubscribe(subId);
      verityWebSocket.off('error', handleError);
    };
  }, [eventType, JSON.stringify(options)]);

  return { data, error };
}

/**
 * Hook for bridge transaction status
 */
export function useBridgeStatus(bridgeId: string | null) {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!bridgeId) return;

    setLoading(true);
    
    const subId = verityWebSocket.subscribeToBridge(bridgeId, (data) => {
      setStatus(data);
      setLoading(false);
    });

    return () => {
      verityWebSocket.unsubscribe(subId);
    };
  }, [bridgeId]);

  return { status, loading };
}

/**
 * Hook for real-time price updates
 */
export function usePriceUpdates(pairs: string[] = ['VRTY/XRP']) {
  const [prices, setPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    const subId = verityWebSocket.subscribeToPrices(pairs, (data: any) => {
      if (data.pair && data.price) {
        setPrices((prev) => ({
          ...prev,
          [data.pair]: data.price,
        }));
      }
    });

    return () => {
      verityWebSocket.unsubscribe(subId);
    };
  }, [pairs.join(',')]);

  return prices;
}

export default verityWebSocket;
