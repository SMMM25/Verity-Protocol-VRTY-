/**
 * Verity Protocol - Error Handling Middleware
 * Standardized error responses across the API
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../../utils/logger.js';

/**
 * Custom API Error class
 */
export class APIError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: Record<string, unknown>;
  public readonly isOperational: boolean;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: Record<string, unknown>,
    isOperational = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, APIError.prototype);
  }
}

/**
 * Standard error codes
 */
export const ErrorCodes = {
  // Client errors (4xx)
  VALIDATION_ERROR: { statusCode: 400, code: 'VALIDATION_ERROR' },
  UNAUTHORIZED: { statusCode: 401, code: 'UNAUTHORIZED' },
  FORBIDDEN: { statusCode: 403, code: 'FORBIDDEN' },
  NOT_FOUND: { statusCode: 404, code: 'NOT_FOUND' },
  METHOD_NOT_ALLOWED: { statusCode: 405, code: 'METHOD_NOT_ALLOWED' },
  CONFLICT: { statusCode: 409, code: 'CONFLICT' },
  RATE_LIMIT_EXCEEDED: { statusCode: 429, code: 'RATE_LIMIT_EXCEEDED' },
  
  // Server errors (5xx)
  INTERNAL_ERROR: { statusCode: 500, code: 'INTERNAL_ERROR' },
  SERVICE_UNAVAILABLE: { statusCode: 503, code: 'SERVICE_UNAVAILABLE' },
  
  // Business logic errors
  INSUFFICIENT_BALANCE: { statusCode: 400, code: 'INSUFFICIENT_BALANCE' },
  INVALID_WALLET: { statusCode: 400, code: 'INVALID_WALLET' },
  CLAWBACK_NOT_ENABLED: { statusCode: 400, code: 'CLAWBACK_NOT_ENABLED' },
  GOVERNANCE_QUORUM_NOT_MET: { statusCode: 400, code: 'GOVERNANCE_QUORUM_NOT_MET' },
  KYC_REQUIRED: { statusCode: 403, code: 'KYC_REQUIRED' },
  ACCREDITATION_REQUIRED: { statusCode: 403, code: 'ACCREDITATION_REQUIRED' },
  JURISDICTION_NOT_SUPPORTED: { statusCode: 400, code: 'JURISDICTION_NOT_SUPPORTED' },
  XRPL_TRANSACTION_FAILED: { statusCode: 500, code: 'XRPL_TRANSACTION_FAILED' },
} as const;

/**
 * Helper functions to create common errors
 */
export const Errors = {
  validationError: (message: string, details?: Record<string, unknown>) =>
    new APIError(400, 'VALIDATION_ERROR', message, details),
    
  unauthorized: (message = 'Authentication required') =>
    new APIError(401, 'UNAUTHORIZED', message),
    
  forbidden: (message = 'Access denied') =>
    new APIError(403, 'FORBIDDEN', message),
    
  notFound: (resource = 'Resource') =>
    new APIError(404, 'NOT_FOUND', `${resource} not found`),
    
  conflict: (message: string) =>
    new APIError(409, 'CONFLICT', message),
    
  internalError: (message = 'Internal server error') =>
    new APIError(500, 'INTERNAL_ERROR', message, undefined, false),
    
  serviceUnavailable: (message = 'Service temporarily unavailable') =>
    new APIError(503, 'SERVICE_UNAVAILABLE', message),
    
  xrplError: (message: string, details?: Record<string, unknown>) =>
    new APIError(500, 'XRPL_TRANSACTION_FAILED', message, details),
};

/**
 * Convert Zod validation errors to API format
 */
function formatZodError(error: ZodError): { field: string; message: string }[] {
  return error.errors.map((err) => ({
    field: err.path.join('.'),
    message: err.message,
  }));
}

/**
 * Error handling middleware
 */
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log the error
  const errorLog = {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  };

  if (err instanceof APIError && err.isOperational) {
    logger.warn('Operational error', errorLog);
  } else {
    logger.error('Unexpected error', errorLog);
  }

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: formatZodError(err),
      },
      meta: {
        requestId: req.requestId,
        timestamp: new Date(),
      },
    });
    return;
  }

  // Handle API errors
  if (err instanceof APIError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
      meta: {
        requestId: req.requestId,
        timestamp: new Date(),
      },
    });
    return;
  }

  // Handle unknown errors
  const statusCode = 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'An unexpected error occurred'
    : err.message;

  res.status(statusCode).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message,
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
    },
    meta: {
      requestId: req.requestId,
      timestamp: new Date(),
    },
  });
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Cannot ${req.method} ${req.path}`,
    },
    meta: {
      requestId: req.requestId,
      timestamp: new Date(),
    },
  });
}

/**
 * Async handler wrapper to catch errors in async route handlers
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
