/**
 * Verity Protocol - Authentication Routes
 * 
 * XUMM-based wallet authentication endpoints.
 * No seed phrases stored - users sign with their own wallets.
 * 
 * @flow
 * 1. Client calls POST /auth/xumm/signin
 * 2. Server returns QR code / deep link
 * 3. User signs in XUMM app
 * 4. Client polls GET /auth/xumm/verify/:uuid
 * 5. Server returns session on successful sign
 */

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { 
  getXummAuth, 
  requireXummAuth,
  type AuthenticatedUser 
} from '../middleware/xummAuth.js';
import { logger } from '../../utils/logger.js';

const router = Router();

// ============================================================
// VALIDATION SCHEMAS
// ============================================================

const signInRequestSchema = z.object({
  /** Optional return URL after signing */
  returnUrl: z.string().url().optional(),
  /** Optional identifier for tracking */
  identifier: z.string().max(100).optional(),
});

const verifyRequestSchema = z.object({
  /** Payload UUID from XUMM */
  uuid: z.string().uuid(),
});

// ============================================================
// AUTH ENDPOINTS
// ============================================================

/**
 * @route POST /auth/xumm/signin
 * @description Initiate XUMM sign-in flow
 * @returns QR code URL, deep link, and websocket for status updates
 */
router.post('/xumm/signin', async (req: Request, res: Response) => {
  try {
    const auth = getXummAuth();
    
    if (!auth) {
      res.status(503).json({
        success: false,
        error: {
          code: 'AUTH_NOT_CONFIGURED',
          message: 'XUMM authentication is not configured. Set XUMM_API_KEY and XUMM_API_SECRET environment variables.',
        },
      });
      return;
    }

    // Validate request body
    const validation = signInRequestSchema.safeParse(req.body || {});
    const { returnUrl, identifier } = validation.success 
      ? validation.data 
      : { returnUrl: undefined, identifier: undefined };

    const payload = await auth.createSignInPayload(returnUrl, identifier);

    res.status(201).json({
      success: true,
      data: {
        payloadUuid: payload.payloadUuid,
        qrCodeUrl: payload.qrCodeUrl,
        deepLink: payload.deepLink,
        websocketUrl: payload.websocketUrl,
        expiresAt: payload.expiresAt,
        instructions: {
          mobile: 'Open the deep link in XUMM app',
          desktop: 'Scan the QR code with XUMM app',
          polling: `Poll GET /auth/xumm/verify/${payload.payloadUuid} to check sign-in status`,
        },
      },
      meta: {
        requestId: req.requestId,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    logger.error('XUMM signin initiation failed', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'SIGNIN_FAILED',
        message: 'Failed to initiate sign-in',
      },
    });
  }
});

/**
 * @route GET /auth/xumm/verify/:uuid
 * @description Check if XUMM payload was signed (poll this endpoint)
 * @returns User session if signed, pending status otherwise
 */
router.get('/xumm/verify/:uuid', async (req: Request, res: Response) => {
  try {
    const auth = getXummAuth();
    
    if (!auth) {
      res.status(503).json({
        success: false,
        error: {
          code: 'AUTH_NOT_CONFIGURED',
          message: 'XUMM authentication is not configured',
        },
      });
      return;
    }

    const uuid = req.params['uuid'];

    if (!uuid) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_UUID',
          message: 'UUID parameter is required',
        },
      });
      return;
    }

    // Validate UUID format
    const validation = verifyRequestSchema.safeParse({ uuid });
    if (!validation.success) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_UUID',
          message: 'Invalid payload UUID format',
        },
      });
      return;
    }

    const user = await auth.verifySignInPayload(uuid);

    if (user) {
      res.json({
        success: true,
        data: {
          status: 'authenticated',
          user: {
            wallet: user.wallet,
            network: user.network,
            authenticatedAt: user.authenticatedAt,
            expiresAt: user.expiresAt,
          },
          instructions: {
            usage: `Include header "Authorization: Bearer ${user.wallet}" or "x-wallet-address: ${user.wallet}" in subsequent requests`,
          },
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date(),
        },
      });
    } else {
      res.json({
        success: true,
        data: {
          status: 'pending',
          message: 'Waiting for user to sign in XUMM app',
        },
        meta: {
          requestId: req.requestId,
          timestamp: new Date(),
        },
      });
    }
  } catch (error) {
    logger.error('XUMM verification failed', { error, uuid: req.params['uuid'] });
    res.status(500).json({
      success: false,
      error: {
        code: 'VERIFICATION_FAILED',
        message: 'Failed to verify sign-in',
      },
    });
  }
});

/**
 * @route POST /auth/xumm/logout
 * @description Invalidate current session
 * @security Requires authentication
 */
router.post('/xumm/logout', requireXummAuth, async (req: Request, res: Response) => {
  try {
    const auth = getXummAuth();
    
    if (auth && req.user) {
      auth.logout(req.user.wallet);
    }

    res.json({
      success: true,
      data: {
        message: 'Successfully logged out',
      },
      meta: {
        requestId: req.requestId,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    logger.error('Logout failed', { error });
    res.status(500).json({
      success: false,
      error: {
        code: 'LOGOUT_FAILED',
        message: 'Failed to logout',
      },
    });
  }
});

/**
 * @route GET /auth/session
 * @description Get current session information
 * @security Requires authentication
 */
router.get('/session', requireXummAuth, async (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      user: {
        wallet: req.user!.wallet,
        network: req.user!.network,
        authenticatedAt: req.user!.authenticatedAt,
        expiresAt: req.user!.expiresAt,
      },
    },
    meta: {
      requestId: req.requestId,
      timestamp: new Date(),
    },
  });
});

/**
 * @route GET /auth/status
 * @description Check authentication service status
 */
router.get('/status', async (req: Request, res: Response) => {
  const auth = getXummAuth();
  
  res.json({
    success: true,
    data: {
      xummConfigured: !!auth,
      developmentMode: process.env['NODE_ENV'] === 'development',
      message: auth 
        ? 'XUMM authentication is active' 
        : 'XUMM not configured - using development mode (x-wallet-address header)',
    },
    meta: {
      requestId: req.requestId,
      timestamp: new Date(),
    },
  });
});

export { router as authRoutes };
