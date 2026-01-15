/**
 * Verity Protocol - WebSocket Service
 * 
 * @module services/WebSocketService
 * @description Real-time notification service using WebSocket connections.
 * Provides live updates for bridge transactions, alerts, and system status.
 * 
 * Features:
 * - Real-time bridge transaction status updates
 * - Live Sentinel alerts
 * - Price updates
 * - System health notifications
 * - User-specific subscriptions
 * 
 * @version 1.0.0
 * @since Phase 4 - User Experience
 */

import { EventEmitter } from 'eventemitter3';
import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { logger } from '../utils/logger.js';

// ============================================================
// TYPES
// ============================================================

export type NotificationType = 
  | 'BRIDGE_STATUS_UPDATE'
  | 'BRIDGE_COMPLETED'
  | 'BRIDGE_FAILED'
  | 'ALERT_NEW'
  | 'ALERT_RESOLVED'
  | 'PRICE_UPDATE'
  | 'SYSTEM_HEALTH'
  | 'WALLET_UPDATE'
  | 'GUILD_UPDATE'
  | 'GOVERNANCE_UPDATE';

export interface WebSocketMessage<T = unknown> {
  type: NotificationType;
  payload: T;
  timestamp: Date;
  correlationId?: string;
}

export interface ClientSubscription {
  id: string;
  clientId: string;
  channel: string;
  filters?: Record<string, string>;
  createdAt: Date;
}

export interface ConnectedClient {
  id: string;
  ws: WebSocket;
  wallet?: string;
  subscriptions: Set<string>;
  connectedAt: Date;
  lastPing: Date;
}

export interface BridgeStatusUpdate {
  bridgeId: string;
  status: string;
  direction: string;
  sourceChain: string;
  destinationChain: string;
  amount: string;
  progress: {
    initiated: boolean;
    locked: boolean;
    validated: boolean;
    minted: boolean;
    completed: boolean;
  };
  sourceTxHash?: string;
  destinationTxHash?: string;
  errorMessage?: string;
}

export interface PriceUpdate {
  pair: string;
  price: string;
  change24h: string;
  volume24h: string;
  timestamp: Date;
}

export interface SystemHealthUpdate {
  status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  services: {
    database: boolean;
    xrpl: boolean;
    solana: boolean;
    sentinel: boolean;
  };
  metrics: {
    activeBridges: number;
    pendingAlerts: number;
    uptime: number;
  };
}

// ============================================================
// CONSTANTS
// ============================================================

const PING_INTERVAL = 30000; // 30 seconds
const CLIENT_TIMEOUT = 60000; // 60 seconds
const MAX_CLIENTS_PER_WALLET = 5;
const MAX_MESSAGE_SIZE = 1024 * 1024; // 1MB

// Channel constants
const CHANNELS = {
  BRIDGE: 'bridge',
  ALERTS: 'alerts',
  PRICES: 'prices',
  SYSTEM: 'system',
  WALLET: 'wallet',
  GUILD: 'guild',
  GOVERNANCE: 'governance',
} as const;

// ============================================================
// WEBSOCKET SERVICE
// ============================================================

export class WebSocketService extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, ConnectedClient> = new Map();
  private walletClients: Map<string, Set<string>> = new Map(); // wallet -> clientIds
  private channelSubscribers: Map<string, Set<string>> = new Map(); // channel -> clientIds
  private pingInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  constructor() {
    super();
    logger.info('WebSocket service initialized');
  }

  // ============================================================
  // LIFECYCLE
  // ============================================================

  /**
   * Attach WebSocket server to HTTP server
   */
  attach(server: HttpServer): void {
    if (this.wss) {
      logger.warn('WebSocket server already attached');
      return;
    }

    this.wss = new WebSocketServer({
      server,
      maxPayload: MAX_MESSAGE_SIZE,
      path: '/ws',
    });

    this.setupEventHandlers();
    this.startPingInterval();
    this.isRunning = true;

    logger.info('WebSocket server attached');
  }

  /**
   * Stop the WebSocket server
   */
  stop(): void {
    if (!this.wss) return;

    this.isRunning = false;

    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    // Close all client connections
    for (const [clientId, client] of this.clients) {
      this.closeClient(clientId, 'Server shutdown');
    }

    this.wss.close();
    this.wss = null;

    logger.info('WebSocket server stopped');
  }

  /**
   * Get service stats
   */
  getStats(): {
    isRunning: boolean;
    totalClients: number;
    clientsByChannel: Record<string, number>;
    uniqueWallets: number;
  } {
    const clientsByChannel: Record<string, number> = {};
    for (const [channel, subscribers] of this.channelSubscribers) {
      clientsByChannel[channel] = subscribers.size;
    }

    return {
      isRunning: this.isRunning,
      totalClients: this.clients.size,
      clientsByChannel,
      uniqueWallets: this.walletClients.size,
    };
  }

  // ============================================================
  // EVENT HANDLERS
  // ============================================================

  private setupEventHandlers(): void {
    if (!this.wss) return;

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    this.wss.on('error', (error) => {
      logger.error('WebSocket server error', { error: error.message });
    });
  }

  private handleConnection(ws: WebSocket, req: any): void {
    const clientId = this.generateClientId();
    
    // Parse wallet from query string if provided
    const url = new URL(req.url, `http://${req.headers.host}`);
    const wallet = url.searchParams.get('wallet') || undefined;

    // Check max clients per wallet
    if (wallet) {
      const existingClients = this.walletClients.get(wallet);
      if (existingClients && existingClients.size >= MAX_CLIENTS_PER_WALLET) {
        ws.close(1008, 'Max connections per wallet exceeded');
        return;
      }
    }

    const client: ConnectedClient = {
      id: clientId,
      ws,
      wallet,
      subscriptions: new Set(),
      connectedAt: new Date(),
      lastPing: new Date(),
    };

    this.clients.set(clientId, client);

    if (wallet) {
      if (!this.walletClients.has(wallet)) {
        this.walletClients.set(wallet, new Set());
      }
      this.walletClients.get(wallet)!.add(clientId);
    }

    logger.info('Client connected', { clientId, wallet });

    // Setup message handler
    ws.on('message', (data) => {
      this.handleMessage(clientId, data);
    });

    ws.on('close', () => {
      this.handleDisconnect(clientId);
    });

    ws.on('error', (error) => {
      logger.error('Client error', { clientId, error: error.message });
    });

    ws.on('pong', () => {
      const client = this.clients.get(clientId);
      if (client) {
        client.lastPing = new Date();
      }
    });

    // Send welcome message
    this.sendToClient(clientId, {
      type: 'SYSTEM_HEALTH',
      payload: {
        message: 'Connected to Verity Protocol WebSocket',
        clientId,
        availableChannels: Object.values(CHANNELS),
      },
      timestamp: new Date(),
    });
  }

  private handleMessage(clientId: string, data: any): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      const message = JSON.parse(data.toString());

      switch (message.action) {
        case 'SUBSCRIBE':
          this.handleSubscribe(clientId, message.channel, message.filters);
          break;
        case 'UNSUBSCRIBE':
          this.handleUnsubscribe(clientId, message.channel);
          break;
        case 'PING':
          this.sendToClient(clientId, {
            type: 'SYSTEM_HEALTH',
            payload: { pong: true },
            timestamp: new Date(),
          });
          break;
        default:
          logger.warn('Unknown message action', { clientId, action: message.action });
      }
    } catch (error) {
      logger.error('Failed to parse message', { clientId, error: (error as Error).message });
    }
  }

  private handleSubscribe(clientId: string, channel: string, filters?: Record<string, string>): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Validate channel
    if (!Object.values(CHANNELS).includes(channel as any)) {
      this.sendToClient(clientId, {
        type: 'SYSTEM_HEALTH',
        payload: { error: `Invalid channel: ${channel}` },
        timestamp: new Date(),
      });
      return;
    }

    // Add to subscriptions
    client.subscriptions.add(channel);

    if (!this.channelSubscribers.has(channel)) {
      this.channelSubscribers.set(channel, new Set());
    }
    this.channelSubscribers.get(channel)!.add(clientId);

    logger.debug('Client subscribed', { clientId, channel, filters });

    this.sendToClient(clientId, {
      type: 'SYSTEM_HEALTH',
      payload: { 
        subscribed: channel,
        message: `Subscribed to ${channel} updates`,
      },
      timestamp: new Date(),
    });
  }

  private handleUnsubscribe(clientId: string, channel: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.subscriptions.delete(channel);

    const subscribers = this.channelSubscribers.get(channel);
    if (subscribers) {
      subscribers.delete(clientId);
    }

    logger.debug('Client unsubscribed', { clientId, channel });

    this.sendToClient(clientId, {
      type: 'SYSTEM_HEALTH',
      payload: { unsubscribed: channel },
      timestamp: new Date(),
    });
  }

  private handleDisconnect(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Remove from wallet clients
    if (client.wallet) {
      const walletClients = this.walletClients.get(client.wallet);
      if (walletClients) {
        walletClients.delete(clientId);
        if (walletClients.size === 0) {
          this.walletClients.delete(client.wallet);
        }
      }
    }

    // Remove from all subscriptions
    for (const channel of client.subscriptions) {
      const subscribers = this.channelSubscribers.get(channel);
      if (subscribers) {
        subscribers.delete(clientId);
      }
    }

    this.clients.delete(clientId);
    logger.info('Client disconnected', { clientId });
  }

  private closeClient(clientId: string, reason: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      client.ws.close(1000, reason);
    } catch {
      // Ignore close errors
    }

    this.handleDisconnect(clientId);
  }

  // ============================================================
  // PING/PONG
  // ============================================================

  private startPingInterval(): void {
    this.pingInterval = setInterval(() => {
      const now = Date.now();

      for (const [clientId, client] of this.clients) {
        // Check for timeout
        if (now - client.lastPing.getTime() > CLIENT_TIMEOUT) {
          this.closeClient(clientId, 'Ping timeout');
          continue;
        }

        // Send ping
        try {
          if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.ping();
          }
        } catch {
          // Ignore ping errors
        }
      }
    }, PING_INTERVAL);
  }

  // ============================================================
  // SENDING MESSAGES
  // ============================================================

  /**
   * Send message to specific client
   */
  sendToClient<T>(clientId: string, message: WebSocketMessage<T>): void {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) return;

    try {
      client.ws.send(JSON.stringify(message));
    } catch (error) {
      logger.error('Failed to send message', { clientId, error: (error as Error).message });
    }
  }

  /**
   * Send message to all subscribers of a channel
   */
  broadcast<T>(channel: string, message: WebSocketMessage<T>): void {
    const subscribers = this.channelSubscribers.get(channel);
    if (!subscribers) return;

    for (const clientId of subscribers) {
      this.sendToClient(clientId, message);
    }
  }

  /**
   * Send message to specific wallet
   */
  sendToWallet<T>(wallet: string, message: WebSocketMessage<T>): void {
    const clientIds = this.walletClients.get(wallet);
    if (!clientIds) return;

    for (const clientId of clientIds) {
      this.sendToClient(clientId, message);
    }
  }

  /**
   * Send to all connected clients
   */
  broadcastAll<T>(message: WebSocketMessage<T>): void {
    for (const clientId of this.clients.keys()) {
      this.sendToClient(clientId, message);
    }
  }

  // ============================================================
  // NOTIFICATION HELPERS
  // ============================================================

  /**
   * Notify bridge status update
   */
  notifyBridgeUpdate(update: BridgeStatusUpdate): void {
    this.broadcast(CHANNELS.BRIDGE, {
      type: 'BRIDGE_STATUS_UPDATE',
      payload: update,
      timestamp: new Date(),
    });

    // Also notify specific wallet if we know the source address
    // (Would need to map addresses to wallets)
  }

  /**
   * Notify bridge completion
   */
  notifyBridgeCompleted(bridgeId: string, destinationTxHash: string): void {
    this.broadcast(CHANNELS.BRIDGE, {
      type: 'BRIDGE_COMPLETED',
      payload: {
        bridgeId,
        destinationTxHash,
        message: 'Bridge transaction completed successfully',
      },
      timestamp: new Date(),
    });
  }

  /**
   * Notify bridge failure
   */
  notifyBridgeFailed(bridgeId: string, error: string): void {
    this.broadcast(CHANNELS.BRIDGE, {
      type: 'BRIDGE_FAILED',
      payload: {
        bridgeId,
        error,
        message: 'Bridge transaction failed',
      },
      timestamp: new Date(),
    });
  }

  /**
   * Notify new alert
   */
  notifyNewAlert(alertId: string, severity: string, title: string): void {
    this.broadcast(CHANNELS.ALERTS, {
      type: 'ALERT_NEW',
      payload: {
        alertId,
        severity,
        title,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Notify alert resolution
   */
  notifyAlertResolved(alertId: string, resolution: string): void {
    this.broadcast(CHANNELS.ALERTS, {
      type: 'ALERT_RESOLVED',
      payload: {
        alertId,
        resolution,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Notify price update
   */
  notifyPriceUpdate(update: PriceUpdate): void {
    this.broadcast(CHANNELS.PRICES, {
      type: 'PRICE_UPDATE',
      payload: update,
      timestamp: new Date(),
    });
  }

  /**
   * Notify system health update
   */
  notifySystemHealth(update: SystemHealthUpdate): void {
    this.broadcast(CHANNELS.SYSTEM, {
      type: 'SYSTEM_HEALTH',
      payload: update,
      timestamp: new Date(),
    });
  }

  // ============================================================
  // UTILITIES
  // ============================================================

  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================
// EXPORTS
// ============================================================

export const wsService = new WebSocketService();

export default WebSocketService;
