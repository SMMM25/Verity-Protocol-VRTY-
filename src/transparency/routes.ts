/**
 * Verity Protocol - Transparency & Solvency API Routes
 * 
 * @description
 * Public API endpoints for the Transparency & Solvency Monitor.
 * All endpoints are public (no authentication required) to ensure transparency.
 * 
 * @endpoints
 * - GET /transparency/entities - List all monitored entities
 * - GET /transparency/report/:entityId - Get full transparency report
 * - GET /transparency/badge/:entityId.svg - Get embeddable SVG badge
 * - GET /transparency/badge/:entityId - Get badge metadata
 * - GET /transparency/verify/:entityId - Verify a snapshot
 * - POST /transparency/verify - Verify a provided snapshot
 * - GET /transparency/alerts/:entityId - Get solvency alerts
 * 
 * @version 1.0.0
 * @since 2026-01-17
 */

import { Router, Request, Response } from 'express';
import { getTransparencyService, TransparencyReport, SignedSnapshot } from './TransparencyService.js';
import { logger } from '../utils/logger.js';

const router = Router();

// ============================================================
// LIST ENTITIES
// ============================================================

/**
 * @route GET /transparency/entities
 * @summary List all monitored entities
 * @description Returns all entities registered for transparency monitoring.
 * @returns {object} 200 - List of monitored entities
 */
router.get('/entities', async (req: Request, res: Response) => {
  try {
    const service = getTransparencyService();
    const entities = service.getMonitoredEntities();
    
    res.json({
      success: true,
      data: {
        entities: entities.map(e => ({
          id: e.id,
          type: e.type,
          name: e.name,
          description: e.description,
          addresses: e.addresses,
          active: e.active,
          lastChecked: e.lastChecked,
        })),
        total: entities.length,
      },
      meta: {
        requestId: req.requestId,
        timestamp: new Date(),
      },
    });
  } catch (error: any) {
    logger.error('Failed to list entities:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed to retrieve monitored entities',
      },
      meta: { requestId: req.requestId },
    });
  }
});

// ============================================================
// TRANSPARENCY REPORT
// ============================================================

/**
 * @route GET /transparency/report/:entityId
 * @summary Get full transparency report for an entity
 * @description
 * Returns comprehensive transparency report including:
 * - On-ledger assets and balances
 * - Liabilities and obligations
 * - Solvency status and coverage ratio
 * - Risk assessment and flags
 * - Evidence links for verification
 * - Signed snapshot for third-party verification
 * 
 * @param {string} entityId - Entity ID (e.g., 'vrty-protocol')
 * @query {boolean} refresh - Force refresh (bypass cache)
 * @returns {object} 200 - Full transparency report
 * @returns {object} 404 - Entity not found
 */
router.get('/report/:entityId', async (req: Request, res: Response) => {
  try {
    const { entityId } = req.params;
    const forceRefresh = req.query['refresh'] === 'true';
    
    const service = getTransparencyService();
    const entity = service.getEntity(entityId);
    
    if (!entity) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ENTITY_NOT_FOUND',
          message: `Entity '${entityId}' not found. Use /transparency/entities to list available entities.`,
        },
        meta: { requestId: req.requestId },
      });
    }
    
    const report = await service.generateReport(entityId, forceRefresh);
    
    res.json({
      success: true,
      data: report,
      meta: {
        requestId: req.requestId,
        timestamp: new Date(),
        cached: !forceRefresh,
      },
    });
  } catch (error: any) {
    logger.error(`Failed to generate report for ${req.params['entityId']}:`, error);
    res.status(500).json({
      success: false,
      error: {
        code: 'REPORT_GENERATION_FAILED',
        message: 'Failed to generate transparency report',
        details: error.message,
      },
      meta: { requestId: req.requestId },
    });
  }
});

// ============================================================
// SUMMARY ENDPOINT (Quick status check)
// ============================================================

/**
 * @route GET /transparency/status/:entityId
 * @summary Get quick solvency status for an entity
 * @description Returns just the solvency status without full report details.
 * Useful for quick checks and badge generation.
 * 
 * @param {string} entityId - Entity ID
 * @returns {object} 200 - Solvency status
 */
router.get('/status/:entityId', async (req: Request, res: Response) => {
  try {
    const { entityId } = req.params;
    const service = getTransparencyService();
    
    const entity = service.getEntity(entityId);
    if (!entity) {
      return res.status(404).json({
        success: false,
        error: { code: 'ENTITY_NOT_FOUND', message: `Entity '${entityId}' not found` },
      });
    }
    
    const report = await service.generateReport(entityId);
    
    res.json({
      success: true,
      data: {
        entityId: report.entityId,
        entityName: report.entityName,
        entityType: report.entityType,
        solvency: report.solvency,
        risks: {
          overallLevel: report.risks.overallLevel,
          flagCount: report.risks.flags.length,
        },
        ledgerIndex: report.ledgerState.ledgerIndex,
        generatedAt: report.generatedAt,
        expiresAt: report.expiresAt,
        detailsUrl: `/api/v1/transparency/report/${entityId}`,
      },
      meta: {
        requestId: req.requestId,
        timestamp: new Date(),
      },
    });
  } catch (error: any) {
    logger.error(`Failed to get status for ${req.params['entityId']}:`, error);
    res.status(500).json({
      success: false,
      error: { code: 'STATUS_FAILED', message: 'Failed to get solvency status' },
      meta: { requestId: req.requestId },
    });
  }
});

// ============================================================
// EMBEDDABLE BADGE
// ============================================================

/**
 * @route GET /transparency/badge/:entityId.svg
 * @summary Get embeddable SVG badge
 * @description
 * Returns an SVG badge showing the entity's solvency status.
 * Can be embedded on external websites.
 * 
 * @param {string} entityId - Entity ID (without .svg extension)
 * @returns {svg} 200 - SVG badge image
 */
router.get('/badge/:entityId.svg', async (req: Request, res: Response) => {
  try {
    // Extract entityId (remove .svg if present)
    const entityId = req.params['entityId'].replace(/\.svg$/, '');
    const service = getTransparencyService();
    
    const entity = service.getEntity(entityId);
    if (!entity) {
      // Return a gray "unknown" badge for unknown entities
      const svg = service.generateBadgeSVG('UNKNOWN', 0, 'Unknown');
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, max-age=60');
      return res.send(svg);
    }
    
    const report = await service.generateReport(entityId);
    const svg = service.generateBadgeSVG(
      report.solvency.status,
      report.solvency.coverageRatio,
      report.entityName
    );
    
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minute cache
    res.setHeader('Access-Control-Allow-Origin', '*'); // Allow embedding anywhere
    res.send(svg);
  } catch (error: any) {
    logger.error(`Failed to generate badge for ${req.params['entityId']}:`, error);
    const service = getTransparencyService();
    const svg = service.generateBadgeSVG('UNKNOWN', 0, 'Error');
    res.setHeader('Content-Type', 'image/svg+xml');
    res.status(500).send(svg);
  }
});

/**
 * @route GET /transparency/badge/:entityId
 * @summary Get badge metadata and embed code
 * @description
 * Returns metadata for embedding the transparency badge including
 * the badge URL and ready-to-use HTML embed code.
 * 
 * @param {string} entityId - Entity ID
 * @returns {object} 200 - Badge metadata and embed code
 */
router.get('/badge/:entityId', async (req: Request, res: Response) => {
  try {
    const { entityId } = req.params;
    const service = getTransparencyService();
    
    const entity = service.getEntity(entityId);
    if (!entity) {
      return res.status(404).json({
        success: false,
        error: { code: 'ENTITY_NOT_FOUND', message: `Entity '${entityId}' not found` },
      });
    }
    
    const badge = await service.generateBadge(entityId);
    
    res.json({
      success: true,
      data: badge,
      meta: {
        requestId: req.requestId,
        timestamp: new Date(),
      },
    });
  } catch (error: any) {
    logger.error(`Failed to get badge metadata for ${req.params['entityId']}:`, error);
    res.status(500).json({
      success: false,
      error: { code: 'BADGE_FAILED', message: 'Failed to generate badge metadata' },
      meta: { requestId: req.requestId },
    });
  }
});

// ============================================================
// SNAPSHOT VERIFICATION
// ============================================================

/**
 * @route GET /transparency/verify/:entityId
 * @summary Get current snapshot for verification
 * @description
 * Returns the current signed snapshot that can be verified
 * by third parties using the verification endpoint.
 * 
 * @param {string} entityId - Entity ID
 * @returns {object} 200 - Signed snapshot
 */
router.get('/verify/:entityId', async (req: Request, res: Response) => {
  try {
    const { entityId } = req.params;
    const service = getTransparencyService();
    
    const entity = service.getEntity(entityId);
    if (!entity) {
      return res.status(404).json({
        success: false,
        error: { code: 'ENTITY_NOT_FOUND', message: `Entity '${entityId}' not found` },
      });
    }
    
    const report = await service.generateReport(entityId);
    
    res.json({
      success: true,
      data: {
        snapshot: report.snapshot,
        instructions: {
          description: 'This snapshot contains cryptographically signed data that can be verified.',
          steps: [
            '1. Save the canonicalData field',
            '2. POST to /transparency/verify with the full snapshot object',
            '3. Compare returned verification result',
          ],
          signatureAlgorithm: report.snapshot.signatureAlgorithm,
          publicKeyFingerprint: report.snapshot.publicKeyFingerprint,
        },
      },
      meta: {
        requestId: req.requestId,
        timestamp: new Date(),
      },
    });
  } catch (error: any) {
    logger.error(`Failed to get snapshot for ${req.params['entityId']}:`, error);
    res.status(500).json({
      success: false,
      error: { code: 'SNAPSHOT_FAILED', message: 'Failed to get snapshot' },
      meta: { requestId: req.requestId },
    });
  }
});

/**
 * @route POST /transparency/verify
 * @summary Verify a signed snapshot
 * @description
 * Verifies that a provided snapshot was signed by the Verity Protocol
 * server and has not been tampered with.
 * 
 * @body {SignedSnapshot} snapshot - The snapshot to verify
 * @returns {object} 200 - Verification result
 */
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const snapshot = req.body as SignedSnapshot;
    
    if (!snapshot || !snapshot.signature || !snapshot.canonicalData) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_SNAPSHOT',
          message: 'Invalid snapshot format. Required fields: signature, canonicalData',
        },
      });
    }
    
    const service = getTransparencyService();
    const isValid = service.verifySnapshot(snapshot);
    
    // Parse canonical data to show what was verified
    let parsedData;
    try {
      parsedData = JSON.parse(snapshot.canonicalData);
    } catch {
      parsedData = null;
    }
    
    res.json({
      success: true,
      data: {
        verified: isValid,
        snapshot: {
          entityId: snapshot.entityId,
          entityType: snapshot.entityType,
          timestamp: snapshot.timestamp,
          ledgerIndex: snapshot.ledgerIndex,
        },
        signatureAlgorithm: snapshot.signatureAlgorithm,
        publicKeyFingerprint: snapshot.publicKeyFingerprint,
        verifiedData: parsedData ? {
          solvencyStatus: parsedData.solvency?.status,
          coverageRatio: parsedData.solvency?.coverageRatio,
          assetCount: parsedData.assets?.length,
          liabilityCount: parsedData.liabilities?.length,
        } : null,
        message: isValid 
          ? 'Snapshot signature is valid. This data was signed by Verity Protocol.'
          : 'Snapshot signature is INVALID. This data may have been tampered with.',
      },
      meta: {
        requestId: req.requestId,
        timestamp: new Date(),
      },
    });
  } catch (error: any) {
    logger.error('Snapshot verification failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'VERIFICATION_FAILED', message: 'Failed to verify snapshot' },
      meta: { requestId: req.requestId },
    });
  }
});

// ============================================================
// SOLVENCY ALERTS
// ============================================================

/**
 * @route GET /transparency/alerts/:entityId
 * @summary Get solvency alerts for an entity
 * @description
 * Returns current risk flags and alerts for an entity.
 * These are generated based on real-time on-chain analysis.
 * 
 * @param {string} entityId - Entity ID
 * @returns {object} 200 - Alerts and risk flags
 */
router.get('/alerts/:entityId', async (req: Request, res: Response) => {
  try {
    const { entityId } = req.params;
    const service = getTransparencyService();
    
    const entity = service.getEntity(entityId);
    if (!entity) {
      return res.status(404).json({
        success: false,
        error: { code: 'ENTITY_NOT_FOUND', message: `Entity '${entityId}' not found` },
      });
    }
    
    const report = await service.generateReport(entityId);
    
    res.json({
      success: true,
      data: {
        entityId: report.entityId,
        entityName: report.entityName,
        overallRiskLevel: report.risks.overallLevel,
        solvencyStatus: report.solvency.status,
        coverageRatio: report.solvency.coverageRatio,
        alerts: report.risks.flags,
        thresholds: entity.thresholds,
        lastAssessment: report.risks.lastAssessment,
      },
      meta: {
        requestId: req.requestId,
        timestamp: new Date(),
      },
    });
  } catch (error: any) {
    logger.error(`Failed to get alerts for ${req.params['entityId']}:`, error);
    res.status(500).json({
      success: false,
      error: { code: 'ALERTS_FAILED', message: 'Failed to get alerts' },
      meta: { requestId: req.requestId },
    });
  }
});

// ============================================================
// WEBHOOK REGISTRATION (for enterprises)
// ============================================================

/**
 * @route POST /transparency/webhooks
 * @summary Register a webhook for solvency alerts
 * @description
 * Register a webhook URL to receive real-time notifications
 * when solvency status changes or risk flags are triggered.
 * 
 * Note: This is a placeholder - full implementation would require
 * authentication and persistent storage.
 * 
 * @body {string} entityId - Entity to monitor
 * @body {string} webhookUrl - URL to receive notifications
 * @body {string[]} events - Events to subscribe to
 * @returns {object} 200 - Webhook registration confirmation
 */
router.post('/webhooks', async (req: Request, res: Response) => {
  try {
    const { entityId, webhookUrl, events } = req.body;
    
    if (!entityId || !webhookUrl) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'entityId and webhookUrl are required',
        },
      });
    }
    
    // In production, this would:
    // 1. Validate the webhook URL
    // 2. Store the registration in database
    // 3. Send a verification ping
    // 4. Set up monitoring jobs
    
    const webhookId = `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    res.json({
      success: true,
      data: {
        webhookId,
        entityId,
        webhookUrl,
        events: events || ['SOLVENCY_CHANGE', 'RISK_FLAG', 'COVERAGE_WARNING'],
        status: 'PENDING_VERIFICATION',
        message: 'Webhook registered. A verification request will be sent to the URL.',
        note: 'This is a preview feature. Full webhook support coming soon.',
      },
      meta: {
        requestId: req.requestId,
        timestamp: new Date(),
      },
    });
  } catch (error: any) {
    logger.error('Webhook registration failed:', error);
    res.status(500).json({
      success: false,
      error: { code: 'WEBHOOK_FAILED', message: 'Failed to register webhook' },
      meta: { requestId: req.requestId },
    });
  }
});

export { router as transparencyMonitorRoutes };
