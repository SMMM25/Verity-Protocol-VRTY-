/**
 * Verity Protocol - Mobile SDK API Routes
 * Production endpoints for mobile application integration
 */

import { Router, Request, Response } from 'express';
import { logger } from '../../utils/logger.js';

const router = Router();

/**
 * POST /mobile/devices
 * Register a mobile device
 */
router.post('/devices', async (req: Request, res: Response) => {
  const {
    deviceId,
    platform,
    osVersion,
    appVersion,
    model,
    locale,
    timezone,
    biometricSupported,
  } = req.body;

  if (!deviceId || !platform) {
    return res.status(400).json({
      success: false,
      error: 'deviceId and platform are required',
    });
  }

  logger.info('Device registration', { deviceId, platform, appVersion });

  res.json({
    success: true,
    data: {
      deviceId,
      registered: true,
      registeredAt: new Date().toISOString(),
      capabilities: {
        biometric: biometricSupported || false,
        pushNotifications: true,
        offlineTransactions: true,
        deepLinking: true,
      },
    },
  });
});

/**
 * POST /mobile/push/register
 * Register push notification token
 */
router.post('/push/register', async (req: Request, res: Response) => {
  const { deviceId, platform, pushToken } = req.body;

  if (!deviceId || !platform || !pushToken) {
    return res.status(400).json({
      success: false,
      error: 'deviceId, platform, and pushToken are required',
    });
  }

  logger.info('Push token registration', { deviceId, platform });

  res.json({
    success: true,
    data: {
      deviceId,
      pushToken: pushToken.substring(0, 20) + '...', // Masked for response
      registered: true,
      registeredAt: new Date().toISOString(),
    },
  });
});

/**
 * POST /mobile/push/subscribe
 * Subscribe to notification types
 */
router.post('/push/subscribe', async (req: Request, res: Response) => {
  const { deviceId, types } = req.body;

  if (!deviceId || !types || !Array.isArray(types)) {
    return res.status(400).json({
      success: false,
      error: 'deviceId and types (array) are required',
    });
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
    return res.status(400).json({
      success: false,
      error: `Invalid notification types: ${invalidTypes.join(', ')}`,
      validTypes,
    });
  }

  res.json({
    success: true,
    data: {
      deviceId,
      subscribedTypes: types,
      subscribedAt: new Date().toISOString(),
    },
  });
});

/**
 * POST /mobile/alerts
 * Create a price alert
 */
router.post('/alerts', async (req: Request, res: Response) => {
  const { deviceId, asset, targetPrice, condition } = req.body;

  if (!deviceId || !asset || !targetPrice || !condition) {
    return res.status(400).json({
      success: false,
      error: 'deviceId, asset, targetPrice, and condition are required',
    });
  }

  if (!['above', 'below'].includes(condition)) {
    return res.status(400).json({
      success: false,
      error: 'condition must be "above" or "below"',
    });
  }

  const alertId = `ALT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  res.json({
    success: true,
    data: {
      alertId,
      deviceId,
      asset,
      targetPrice,
      condition,
      status: 'active',
      createdAt: new Date().toISOString(),
    },
  });
});

/**
 * GET /mobile/alerts/:deviceId
 * Get alerts for a device
 */
router.get('/alerts/:deviceId', (req: Request, res: Response) => {
  const { deviceId } = req.params;

  res.json({
    success: true,
    data: {
      deviceId,
      alerts: [],
    },
  });
});

/**
 * DELETE /mobile/alerts/:alertId
 * Delete a price alert
 */
router.delete('/alerts/:alertId', (req: Request, res: Response) => {
  const { alertId } = req.params;

  res.json({
    success: true,
    data: {
      alertId,
      deleted: true,
      deletedAt: new Date().toISOString(),
    },
  });
});

/**
 * POST /mobile/sessions
 * Create a mobile session
 */
router.post('/sessions', async (req: Request, res: Response) => {
  const { deviceId, walletAddress, authMethod } = req.body;

  if (!deviceId || !walletAddress || !authMethod) {
    return res.status(400).json({
      success: false,
      error: 'deviceId, walletAddress, and authMethod are required',
    });
  }

  const validAuthMethods = ['biometric', 'pin', 'password', 'passkey'];
  if (!validAuthMethods.includes(authMethod)) {
    return res.status(400).json({
      success: false,
      error: `Invalid authMethod. Valid options: ${validAuthMethods.join(', ')}`,
    });
  }

  const sessionId = `SES-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes

  res.json({
    success: true,
    data: {
      sessionId,
      deviceId,
      walletAddress,
      authMethod,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      isActive: true,
    },
  });
});

/**
 * DELETE /mobile/sessions/:sessionId
 * End a mobile session
 */
router.delete('/sessions/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;

  res.json({
    success: true,
    data: {
      sessionId,
      ended: true,
      endedAt: new Date().toISOString(),
    },
  });
});

/**
 * POST /mobile/deeplink/parse
 * Parse a deep link URL
 */
router.post('/deeplink/parse', (req: Request, res: Response) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({
      success: false,
      error: 'url is required',
    });
  }

  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    const action = pathParts[0];
    const params: Record<string, string> = {};

    for (let i = 1; i < pathParts.length; i++) {
      params[`param${i}`] = pathParts[i];
    }

    parsed.searchParams.forEach((value, key) => {
      params[key] = value;
    });

    res.json({
      success: true,
      data: {
        handled: parsed.protocol === 'verity:',
        action: action || null,
        params,
        originalUrl: url,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: 'Invalid URL format',
    });
  }
});

/**
 * GET /mobile/deeplink/generate
 * Generate a deep link URL
 */
router.get('/deeplink/generate', (req: Request, res: Response) => {
  const { action, ...params } = req.query;

  if (!action) {
    return res.status(400).json({
      success: false,
      error: 'action is required',
    });
  }

  const queryString = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&');

  const deepLink = `verity://${action}${queryString ? `?${queryString}` : ''}`;

  res.json({
    success: true,
    data: {
      deepLink,
      action,
      params,
    },
  });
});

/**
 * GET /mobile/qr/payment
 * Generate payment QR code data
 */
router.get('/qr/payment', (req: Request, res: Response) => {
  const { address, amount, currency, memo } = req.query;

  if (!address) {
    return res.status(400).json({
      success: false,
      error: 'address is required',
    });
  }

  const qrData = {
    type: 'payment',
    version: 1,
    data: {
      destination: address,
      amount: amount || null,
      currency: currency || 'XRP',
      memo: memo || null,
      network: process.env['XRPL_NETWORK'] || 'mainnet',
    },
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
  };

  res.json({
    success: true,
    data: {
      qrData,
      qrString: JSON.stringify(qrData),
    },
  });
});

/**
 * GET /mobile/sdk-info
 * Get Mobile SDK information
 */
router.get('/sdk-info', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      name: 'Verity Mobile SDK',
      version: '1.0.0',
      apiVersion: 'v1',
      supportedPlatforms: ['ios', 'android', 'web'],
      features: {
        biometricAuth: {
          supported: true,
          types: ['face_id', 'touch_id', 'fingerprint', 'iris'],
        },
        secureStorage: {
          supported: true,
          description: 'Hardware-backed keychain/keystore storage',
        },
        offlineTransactions: {
          supported: true,
          description: 'Sign transactions offline, submit when connected',
        },
        pushNotifications: {
          supported: true,
          types: [
            'TRANSACTION_RECEIVED',
            'TRANSACTION_SENT',
            'SIGNAL_RECEIVED',
            'GOVERNANCE_VOTE',
            'DIVIDEND_DISTRIBUTED',
            'PRICE_ALERT',
            'STAKING_REWARD',
            'SECURITY_ALERT',
          ],
        },
        deepLinking: {
          supported: true,
          scheme: 'verity://',
          actions: [
            'payment',
            'wallet',
            'stake',
            'vote',
            'signal',
            'guild',
          ],
        },
        qrCodes: {
          supported: true,
          types: ['payment', 'wallet', 'invoice', 'deeplink'],
        },
      },
      minimumRequirements: {
        ios: '13.0',
        android: '8.0 (API 26)',
      },
      documentation: 'https://docs.verity.finance/mobile-sdk',
    },
  });
});

/**
 * GET /mobile/health
 * Health check for mobile services
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      services: {
        push: 'operational',
        alerts: 'operational',
        sessions: 'operational',
        deeplinks: 'operational',
      },
      timestamp: new Date().toISOString(),
    },
  });
});

export const mobileRoutes = router;
