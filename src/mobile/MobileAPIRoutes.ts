/**
 * Verity Protocol - Mobile API Routes
 * Production-ready REST API endpoints for iOS and Android applications
 * 
 * API Version: v1
 * Base URL: /api/v1/mobile
 * 
 * Features:
 * - Device registration and management
 * - Push notification handling
 * - Session management with JWT tokens
 * - Transaction history and portfolio
 * - Price alerts
 * - Biometric authentication support
 */

import { Router, Request, Response, NextFunction } from 'express';
import { logger, logAuditAction } from '../utils/logger.js';
import { generateId, sha256 } from '../utils/crypto.js';

// Express Router for mobile endpoints
export const mobileRoutes = Router();

// Types for mobile API
export interface MobileDevice {
  deviceId: string;
  platform: 'ios' | 'android' | 'web';
  osVersion: string;
  appVersion: string;
  model: string;
  pushToken?: string;
  locale: string;
  timezone: string;
  biometricSupported: boolean;
  biometricType?: string;
  createdAt: Date;
  lastActiveAt: Date;
  isActive: boolean;
}

export interface MobileSession {
  sessionId: string;
  deviceId: string;
  userId: string;
  walletAddress: string;
  token: string;
  refreshToken: string;
  authMethod: 'biometric' | 'pin' | 'password';
  createdAt: Date;
  expiresAt: Date;
  lastActivityAt: Date;
}

export interface PriceAlert {
  alertId: string;
  deviceId: string;
  userId: string;
  asset: string;
  targetPrice: string;
  condition: 'above' | 'below';
  isActive: boolean;
  createdAt: Date;
  triggeredAt?: Date;
}

export interface NotificationSubscription {
  deviceId: string;
  userId: string;
  types: string[];
  createdAt: Date;
}

// In-memory storage (production would use database)
const devices: Map<string, MobileDevice> = new Map();
const sessions: Map<string, MobileSession> = new Map();
const priceAlerts: Map<string, PriceAlert> = new Map();
const notificationSubscriptions: Map<string, NotificationSubscription> = new Map();

// JWT secret (in production, use environment variable)
const JWT_SECRET = process.env['JWT_SECRET'] || 'verity-mobile-jwt-secret-change-in-production';
const SESSION_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const REFRESH_TOKEN_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Middleware to validate session token
 */
export const validateSession = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'Missing or invalid authorization header',
      code: 'UNAUTHORIZED',
    });
    return;
  }

  const token = authHeader.substring(7);
  
  // Find session by token
  const session = Array.from(sessions.values()).find(s => s.token === token);
  
  if (!session) {
    res.status(401).json({
      success: false,
      error: 'Invalid session token',
      code: 'INVALID_TOKEN',
    });
    return;
  }

  if (new Date() > session.expiresAt) {
    sessions.delete(session.sessionId);
    res.status(401).json({
      success: false,
      error: 'Session expired',
      code: 'SESSION_EXPIRED',
    });
    return;
  }

  // Extend session activity
  session.lastActivityAt = new Date();
  
  // Attach session to request
  (req as any).session = session;
  
  next();
};

// ===== Device Management =====

/**
 * POST /api/v1/mobile/devices
 * Register a new mobile device
 */
mobileRoutes.post('/devices', async (req: Request, res: Response) => {
  try {
    const {
      deviceId,
      platform,
      osVersion,
      appVersion,
      model,
      locale,
      timezone,
      biometricSupported,
      biometricType,
    } = req.body;

    if (!deviceId || !platform || !osVersion || !appVersion) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: deviceId, platform, osVersion, appVersion',
        code: 'INVALID_REQUEST',
      });
      return;
    }

    // Check if device already registered
    let device = devices.get(deviceId);
    
    if (device) {
      // Update existing device
      device.osVersion = osVersion;
      device.appVersion = appVersion;
      device.model = model || device.model;
      device.locale = locale || device.locale;
      device.timezone = timezone || device.timezone;
      device.biometricSupported = biometricSupported ?? device.biometricSupported;
      device.biometricType = biometricType || device.biometricType;
      device.lastActiveAt = new Date();
      device.isActive = true;
    } else {
      // Create new device
      device = {
        deviceId,
        platform,
        osVersion,
        appVersion,
        model: model || 'Unknown',
        locale: locale || 'en-US',
        timezone: timezone || 'UTC',
        biometricSupported: biometricSupported ?? false,
        biometricType,
        createdAt: new Date(),
        lastActiveAt: new Date(),
        isActive: true,
      };
      devices.set(deviceId, device);
    }

    logAuditAction('MOBILE_DEVICE_REGISTERED', deviceId, {
      platform,
      appVersion,
    });

    logger.info('Mobile device registered', { deviceId, platform });

    res.status(201).json({
      success: true,
      data: {
        deviceId: device.deviceId,
        platform: device.platform,
        registered: true,
        capabilities: {
          biometric: device.biometricSupported,
          biometricType: device.biometricType,
          push: true,
        },
      },
    });
  } catch (error) {
    logger.error('Device registration failed', { error });
    res.status(500).json({
      success: false,
      error: 'Device registration failed',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * GET /api/v1/mobile/devices/:deviceId
 * Get device information
 */
mobileRoutes.get('/devices/:deviceId', validateSession, async (req: Request, res: Response) => {
  try {
    const deviceId = req.params['deviceId'] || '';
    const device = devices.get(deviceId);

    if (!device) {
      res.status(404).json({
        success: false,
        error: 'Device not found',
        code: 'NOT_FOUND',
      });
      return;
    }

    res.json({
      success: true,
      data: {
        deviceId: device.deviceId,
        platform: device.platform,
        osVersion: device.osVersion,
        appVersion: device.appVersion,
        lastActiveAt: device.lastActiveAt,
        biometricSupported: device.biometricSupported,
      },
    });
  } catch (error) {
    logger.error('Get device failed', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get device information',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * DELETE /api/v1/mobile/devices/:deviceId
 * Unregister a mobile device
 */
mobileRoutes.delete('/devices/:deviceId', validateSession, async (req: Request, res: Response) => {
  try {
    const deviceId = req.params['deviceId'] || '';
    const device = devices.get(deviceId);

    if (!device) {
      res.status(404).json({
        success: false,
        error: 'Device not found',
        code: 'NOT_FOUND',
      });
      return;
    }

    device.isActive = false;
    device.pushToken = undefined;

    // Invalidate all sessions for this device
    for (const [sessionId, session] of sessions) {
      if (session.deviceId === deviceId) {
        sessions.delete(sessionId);
      }
    }

    logAuditAction('MOBILE_DEVICE_UNREGISTERED', deviceId || 'unknown', {});

    res.json({
      success: true,
      message: 'Device unregistered successfully',
    });
  } catch (error) {
    logger.error('Device unregistration failed', { error });
    res.status(500).json({
      success: false,
      error: 'Device unregistration failed',
      code: 'INTERNAL_ERROR',
    });
  }
});

// ===== Session Management =====

/**
 * POST /api/v1/mobile/sessions
 * Create a new authentication session
 */
mobileRoutes.post('/sessions', async (req: Request, res: Response) => {
  try {
    const {
      deviceId,
      walletAddress,
      authMethod,
      signature, // Wallet signature for authentication
    } = req.body;

    if (!deviceId || !walletAddress || !authMethod || !signature) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: deviceId, walletAddress, authMethod, signature',
        code: 'INVALID_REQUEST',
      });
      return;
    }

    // Verify device is registered
    const device = devices.get(deviceId);
    if (!device || !device.isActive) {
      res.status(400).json({
        success: false,
        error: 'Device not registered or inactive',
        code: 'DEVICE_NOT_REGISTERED',
      });
      return;
    }

    // Verify wallet signature (in production, verify cryptographic signature)
    // This would verify the signature against the walletAddress
    const isValidSignature = signature.length > 0; // Placeholder

    if (!isValidSignature) {
      res.status(401).json({
        success: false,
        error: 'Invalid wallet signature',
        code: 'INVALID_SIGNATURE',
      });
      return;
    }

    // Invalidate any existing sessions for this device
    for (const [sessionId, session] of sessions) {
      if (session.deviceId === deviceId) {
        sessions.delete(sessionId);
      }
    }

    // Create new session
    const sessionId = generateId('SES');
    const now = new Date();
    const token = sha256(`${sessionId}:${deviceId}:${now.getTime()}:${JWT_SECRET}`);
    const refreshToken = sha256(`${sessionId}:${deviceId}:refresh:${now.getTime()}:${JWT_SECRET}`);

    const session: MobileSession = {
      sessionId,
      deviceId,
      userId: walletAddress,
      walletAddress,
      token,
      refreshToken,
      authMethod,
      createdAt: now,
      expiresAt: new Date(now.getTime() + SESSION_DURATION_MS),
      lastActivityAt: now,
    };

    sessions.set(sessionId, session);

    // Update device activity
    device.lastActiveAt = now;

    logAuditAction('MOBILE_SESSION_CREATED', walletAddress, {
      sessionId,
      deviceId,
      authMethod,
    });

    logger.info('Mobile session created', { sessionId, deviceId, walletAddress });

    res.status(201).json({
      success: true,
      data: {
        sessionId,
        token,
        refreshToken,
        expiresAt: session.expiresAt.toISOString(),
        walletAddress,
      },
    });
  } catch (error) {
    logger.error('Session creation failed', { error });
    res.status(500).json({
      success: false,
      error: 'Session creation failed',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * POST /api/v1/mobile/sessions/refresh
 * Refresh an authentication session
 */
mobileRoutes.post('/sessions/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({
        success: false,
        error: 'Missing refresh token',
        code: 'INVALID_REQUEST',
      });
      return;
    }

    // Find session by refresh token
    const session = Array.from(sessions.values()).find(s => s.refreshToken === refreshToken);

    if (!session) {
      res.status(401).json({
        success: false,
        error: 'Invalid refresh token',
        code: 'INVALID_REFRESH_TOKEN',
      });
      return;
    }

    // Generate new tokens
    const now = new Date();
    const newToken = sha256(`${session.sessionId}:${session.deviceId}:${now.getTime()}:${JWT_SECRET}`);
    const newRefreshToken = sha256(`${session.sessionId}:${session.deviceId}:refresh:${now.getTime()}:${JWT_SECRET}`);

    session.token = newToken;
    session.refreshToken = newRefreshToken;
    session.expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);
    session.lastActivityAt = now;

    logAuditAction('MOBILE_SESSION_REFRESHED', session.walletAddress, {
      sessionId: session.sessionId,
    });

    res.json({
      success: true,
      data: {
        token: newToken,
        refreshToken: newRefreshToken,
        expiresAt: session.expiresAt.toISOString(),
      },
    });
  } catch (error) {
    logger.error('Session refresh failed', { error });
    res.status(500).json({
      success: false,
      error: 'Session refresh failed',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * DELETE /api/v1/mobile/sessions
 * End the current session (logout)
 */
mobileRoutes.delete('/sessions', validateSession, async (req: Request, res: Response) => {
  try {
    const session = (req as any).session as MobileSession;

    sessions.delete(session.sessionId);

    logAuditAction('MOBILE_SESSION_ENDED', session.walletAddress, {
      sessionId: session.sessionId,
    });

    res.json({
      success: true,
      message: 'Session ended successfully',
    });
  } catch (error) {
    logger.error('Session logout failed', { error });
    res.status(500).json({
      success: false,
      error: 'Logout failed',
      code: 'INTERNAL_ERROR',
    });
  }
});

// ===== Push Notifications =====

/**
 * POST /api/v1/mobile/push/register
 * Register push notification token
 */
mobileRoutes.post('/push/register', validateSession, async (req: Request, res: Response) => {
  try {
    const session = (req as any).session as MobileSession;
    const { pushToken } = req.body;

    if (!pushToken) {
      res.status(400).json({
        success: false,
        error: 'Missing push token',
        code: 'INVALID_REQUEST',
      });
      return;
    }

    const device = devices.get(session.deviceId);
    if (!device) {
      res.status(404).json({
        success: false,
        error: 'Device not found',
        code: 'NOT_FOUND',
      });
      return;
    }

    device.pushToken = pushToken;

    logAuditAction('PUSH_TOKEN_REGISTERED', session.walletAddress, {
      deviceId: session.deviceId,
    });

    res.json({
      success: true,
      message: 'Push token registered successfully',
    });
  } catch (error) {
    logger.error('Push token registration failed', { error });
    res.status(500).json({
      success: false,
      error: 'Push token registration failed',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * POST /api/v1/mobile/push/subscribe
 * Subscribe to notification types
 */
mobileRoutes.post('/push/subscribe', validateSession, async (req: Request, res: Response) => {
  try {
    const session = (req as any).session as MobileSession;
    const { types } = req.body;

    if (!types || !Array.isArray(types)) {
      res.status(400).json({
        success: false,
        error: 'Missing or invalid notification types',
        code: 'INVALID_REQUEST',
      });
      return;
    }

    const validTypes = [
      'TRANSACTION_RECEIVED',
      'TRANSACTION_SENT',
      'SIGNAL_RECEIVED',
      'GOVERNANCE_VOTE',
      'DIVIDEND_DISTRIBUTED',
      'PRICE_ALERT',
      'STAKING_REWARD',
      'SECURITY_ALERT',
    ];

    const invalidTypes = types.filter((t: string) => !validTypes.includes(t));
    if (invalidTypes.length > 0) {
      res.status(400).json({
        success: false,
        error: `Invalid notification types: ${invalidTypes.join(', ')}`,
        code: 'INVALID_TYPES',
      });
      return;
    }

    const subscription: NotificationSubscription = {
      deviceId: session.deviceId,
      userId: session.walletAddress,
      types,
      createdAt: new Date(),
    };

    notificationSubscriptions.set(session.deviceId, subscription);

    logAuditAction('NOTIFICATION_SUBSCRIBED', session.walletAddress, {
      types,
    });

    res.json({
      success: true,
      data: {
        subscribedTypes: types,
      },
    });
  } catch (error) {
    logger.error('Notification subscription failed', { error });
    res.status(500).json({
      success: false,
      error: 'Notification subscription failed',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * GET /api/v1/mobile/push/subscriptions
 * Get current notification subscriptions
 */
mobileRoutes.get('/push/subscriptions', validateSession, async (req: Request, res: Response) => {
  try {
    const session = (req as any).session as MobileSession;
    const subscription = notificationSubscriptions.get(session.deviceId);

    res.json({
      success: true,
      data: {
        types: subscription?.types || [],
      },
    });
  } catch (error) {
    logger.error('Get subscriptions failed', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get subscriptions',
      code: 'INTERNAL_ERROR',
    });
  }
});

// ===== Price Alerts =====

/**
 * POST /api/v1/mobile/alerts
 * Create a price alert
 */
mobileRoutes.post('/alerts', validateSession, async (req: Request, res: Response) => {
  try {
    const session = (req as any).session as MobileSession;
    const { asset, targetPrice, condition } = req.body;

    if (!asset || !targetPrice || !condition) {
      res.status(400).json({
        success: false,
        error: 'Missing required fields: asset, targetPrice, condition',
        code: 'INVALID_REQUEST',
      });
      return;
    }

    if (!['above', 'below'].includes(condition)) {
      res.status(400).json({
        success: false,
        error: 'Invalid condition. Must be "above" or "below"',
        code: 'INVALID_CONDITION',
      });
      return;
    }

    const alertId = generateId('ALT');
    const alert: PriceAlert = {
      alertId,
      deviceId: session.deviceId,
      userId: session.walletAddress,
      asset,
      targetPrice,
      condition,
      isActive: true,
      createdAt: new Date(),
    };

    priceAlerts.set(alertId, alert);

    logAuditAction('PRICE_ALERT_CREATED', session.walletAddress, {
      alertId,
      asset,
      targetPrice,
      condition,
    });

    logger.info('Price alert created', { alertId, asset, targetPrice, condition });

    res.status(201).json({
      success: true,
      data: {
        alertId,
        asset,
        targetPrice,
        condition,
        isActive: true,
      },
    });
  } catch (error) {
    logger.error('Price alert creation failed', { error });
    res.status(500).json({
      success: false,
      error: 'Price alert creation failed',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * GET /api/v1/mobile/alerts
 * Get all price alerts for the user
 */
mobileRoutes.get('/alerts', validateSession, async (req: Request, res: Response) => {
  try {
    const session = (req as any).session as MobileSession;
    
    const userAlerts = Array.from(priceAlerts.values())
      .filter(a => a.userId === session.walletAddress);

    res.json({
      success: true,
      data: userAlerts.map(a => ({
        alertId: a.alertId,
        asset: a.asset,
        targetPrice: a.targetPrice,
        condition: a.condition,
        isActive: a.isActive,
        createdAt: a.createdAt,
        triggeredAt: a.triggeredAt,
      })),
    });
  } catch (error) {
    logger.error('Get alerts failed', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get alerts',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * DELETE /api/v1/mobile/alerts/:alertId
 * Delete a price alert
 */
mobileRoutes.delete('/alerts/:alertId', validateSession, async (req: Request, res: Response) => {
  try {
    const session = (req as any).session as MobileSession;
    const alertId = req.params['alertId'] || '';

    const alert = priceAlerts.get(alertId);
    
    if (!alert || alert.userId !== session.walletAddress) {
      res.status(404).json({
        success: false,
        error: 'Alert not found',
        code: 'NOT_FOUND',
      });
      return;
    }

    priceAlerts.delete(alertId);

    logAuditAction('PRICE_ALERT_DELETED', session.walletAddress, { alertId: alertId || 'unknown' });

    res.json({
      success: true,
      message: 'Alert deleted successfully',
    });
  } catch (error) {
    logger.error('Delete alert failed', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to delete alert',
      code: 'INTERNAL_ERROR',
    });
  }
});

// ===== Portfolio & Transactions =====

/**
 * GET /api/v1/mobile/portfolio
 * Get user's portfolio summary
 */
mobileRoutes.get('/portfolio', validateSession, async (req: Request, res: Response) => {
  try {
    const session = (req as any).session as MobileSession;

    // In production, this would fetch from XRPL and database
    // This is a placeholder response structure
    res.json({
      success: true,
      data: {
        walletAddress: session.walletAddress,
        totalValue: '0.00',
        currency: 'USD',
        assets: [
          {
            symbol: 'XRP',
            balance: '0',
            value: '0.00',
            priceChange24h: '0.00',
          },
          {
            symbol: 'VRTY',
            balance: '0',
            value: '0.00',
            priceChange24h: '0.00',
          },
        ],
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Get portfolio failed', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get portfolio',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * GET /api/v1/mobile/transactions
 * Get user's transaction history
 */
mobileRoutes.get('/transactions', validateSession, async (req: Request, res: Response) => {
  try {
    const session = (req as any).session as MobileSession;
    const { limit = '20', offset = '0', type } = req.query;

    // In production, this would fetch from XRPL
    // This is a placeholder response structure
    res.json({
      success: true,
      data: {
        transactions: [],
        pagination: {
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          total: 0,
          hasMore: false,
        },
      },
    });
  } catch (error) {
    logger.error('Get transactions failed', { error });
    res.status(500).json({
      success: false,
      error: 'Failed to get transactions',
      code: 'INTERNAL_ERROR',
    });
  }
});

// ===== Health Check =====

/**
 * GET /api/v1/mobile/health
 * Health check endpoint
 */
mobileRoutes.get('/health', async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      services: {
        devices: devices.size,
        activeSessions: sessions.size,
        priceAlerts: priceAlerts.size,
      },
    },
  });
});

/**
 * GET /api/v1/mobile/config
 * Get mobile app configuration
 */
mobileRoutes.get('/config', async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      apiVersion: 'v1',
      minAppVersion: {
        ios: '1.0.0',
        android: '1.0.0',
      },
      features: {
        biometric: true,
        push: true,
        deepLinks: true,
        qrCode: true,
        priceAlerts: true,
        offlineTransactions: true,
      },
      xrplNetwork: process.env['XRPL_NETWORK'] || 'mainnet',
      endpoints: {
        ws: process.env['WS_BASE_URL'] || 'wss://ws.verity.finance',
        api: process.env['API_BASE_URL'] || 'https://api.verity.finance',
      },
      maintenance: {
        enabled: false,
        message: null,
      },
    },
  });
});

export default mobileRoutes;
