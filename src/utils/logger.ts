/**
 * Verity Protocol - Logger Utility
 * Centralized logging with verification hash support
 */

import winston from 'winston';
import crypto from 'crypto';

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

export const logger = winston.createLogger({
  level: process.env['LOG_LEVEL'] || 'info',
  levels: LOG_LEVELS,
  format: isDevelopment ? format : jsonFormat,
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
    }),
  ],
});

/**
 * Generate a verification hash for audit logging
 * Uses the implementation from crypto.ts
 */
function generateLogVerificationHash(data: unknown): string {
  const stringified = JSON.stringify(data, Object.keys(data as object).sort());
  return crypto.createHash('sha256').update(stringified).digest('hex');
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
