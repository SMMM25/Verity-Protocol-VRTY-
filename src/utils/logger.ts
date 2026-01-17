/**
 * Verity Protocol - Logger Utility
 * Centralized logging with verification hash support
 */

import winston from 'winston';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
};

winston.addColors(colors);

const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info['timestamp']} ${info.level}: ${info.message}`
  )
);

const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json()
);

const isDevelopment = process.env['NODE_ENV'] !== 'production';
const isContainerEnv = process.env['RAILWAY_ENVIRONMENT'] || process.env['RENDER'] || process.env['HEROKU'];

// Create logs directory if not in container environment
const logsDir = path.join(process.cwd(), 'logs');
const canUseFileLogging = !isContainerEnv;

if (canUseFileLogging) {
  try {
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  } catch {
    // Silently fall back to console-only logging
  }
}

// Build transports array
const transports: winston.transport[] = [
  new winston.transports.Console(),
];

// Only add file transports if we can use them
if (canUseFileLogging && fs.existsSync(logsDir)) {
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
    })
  );
}

export const logger = winston.createLogger({
  level: process.env['LOG_LEVEL'] || 'info',
  levels: LOG_LEVELS,
  format: isDevelopment ? format : jsonFormat,
  transports,
});

/**
 * Generate a stable verification hash for audit logging
 * Handles null, non-objects, and nested structures safely
 */
function generateLogVerificationHash(data: unknown): string {
  try {
    // Handle null/undefined
    if (data === null || data === undefined) {
      return crypto.createHash('sha256').update('null').digest('hex');
    }
    
    // Handle non-objects (strings, numbers, etc.)
    if (typeof data !== 'object') {
      return crypto.createHash('sha256').update(String(data)).digest('hex');
    }
    
    // Deep stable stringify for objects
    const stringified = stableStringify(data);
    return crypto.createHash('sha256').update(stringified).digest('hex');
  } catch {
    // Fallback for circular references or BigInt
    return crypto.createHash('sha256').update(String(Date.now())).digest('hex');
  }
}

/**
 * Stable JSON stringify that handles nested objects deterministically
 */
function stableStringify(obj: unknown): string {
  if (obj === null || obj === undefined) return 'null';
  if (typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return '[' + obj.map(stableStringify).join(',') + ']';
  }
  const keys = Object.keys(obj as object).sort();
  const pairs = keys.map(k => `${JSON.stringify(k)}:${stableStringify((obj as Record<string, unknown>)[k])}`);
  return '{' + pairs.join(',') + '}';
}

/**
 * Log an auditable action with verification hash
 */
export function logAuditAction(
  action: string,
  actor: string,
  details: Record<string, unknown>
): string {
  const timestamp = new Date().toISOString();
  const auditEntry = {
    action,
    actor,
    details,
    timestamp,
  };

  const verificationHash = generateLogVerificationHash(auditEntry);

  logger.info(`AUDIT: ${action} by ${actor}`, {
    ...auditEntry,
    verificationHash,
  });

  return verificationHash;
}

export default logger;
