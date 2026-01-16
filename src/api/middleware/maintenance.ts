/**
 * Maintenance Mode Middleware
 * Blocks all API requests and shows "Under Construction" page
 */

import { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';

// Check if maintenance mode is enabled
// Set MAINTENANCE_MODE=true in environment to enable full maintenance mode
// Otherwise, the Construction Banner in the frontend will inform users
export const isMaintenanceMode = (): boolean => {
  // Maintenance mode is now controlled by environment variable
  // The frontend shows a dismissible "Under Construction" banner instead
  return process.env['MAINTENANCE_MODE'] === 'true';
};

// Paths that should always be accessible (even in maintenance mode)
const ALLOWED_PATHS = [
  '/api/v1/health',           // Health checks for monitoring
  '/api/v1/health/detailed',  // Detailed health for Railway
  '/coming-soon',             // The coming soon page itself
  '/favicon.ico',             // Favicon
];

// Static file extensions that should be served
const STATIC_EXTENSIONS = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2'];

/**
 * Maintenance mode middleware
 * When MAINTENANCE_MODE=true:
 * - Serves coming-soon.html for all UI routes
 * - Returns 503 Service Unavailable for API routes
 * - Allows health checks to pass through
 */
export const maintenanceModeMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Skip if maintenance mode is not enabled
  if (!isMaintenanceMode()) {
    next();
    return;
  }

  const requestPath = req.path.toLowerCase();

  // Allow health check endpoints (for Railway monitoring)
  if (ALLOWED_PATHS.some(allowed => requestPath.startsWith(allowed))) {
    next();
    return;
  }

  // Allow static file extensions
  const ext = path.extname(requestPath).toLowerCase();
  if (STATIC_EXTENSIONS.includes(ext)) {
    next();
    return;
  }

  // For API routes, return 503 with maintenance message
  if (requestPath.startsWith('/api/')) {
    res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Verity Protocol is currently under maintenance. Please check back soon.',
        status: 'maintenance',
        estimatedLaunch: 'Q2 2026',
      },
      meta: {
        timestamp: new Date().toISOString(),
        maintenance: true,
      },
    });
    return;
  }

  // For all other routes (UI), serve the coming-soon page
  const comingSoonPath = path.join(process.cwd(), 'ui', 'coming-soon.html');
  
  if (fs.existsSync(comingSoonPath)) {
    res.sendFile(comingSoonPath);
  } else {
    // Fallback HTML if file doesn't exist
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Verity Protocol - Coming Soon</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
            background: #0f0d24;
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            text-align: center;
          }
          h1 { color: #6366f1; }
        </style>
      </head>
      <body>
        <div>
          <h1>Verity Protocol</h1>
          <p>Under Construction - Launching Q1 2026</p>
        </div>
      </body>
      </html>
    `);
  }
};

export default maintenanceModeMiddleware;
