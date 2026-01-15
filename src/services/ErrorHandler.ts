/**
 * Verity Protocol - Centralized Error Handler
 * 
 * @module services/ErrorHandler
 * @description Production-grade error handling and user feedback system.
 * Provides consistent error responses, logging, and recovery suggestions.
 * 
 * Features:
 * - Standardized error codes and messages
 * - User-friendly error messages
 * - Recovery suggestions
 * - Error categorization
 * - Automatic retry logic
 * - Error tracking/reporting
 * 
 * @version 1.0.0
 * @since Phase 4 - User Experience
 */

import { Response } from 'express';
import { logger } from '../utils/logger.js';
import { ZodError } from 'zod';

// ============================================================
// ERROR CODES
// ============================================================

export const ErrorCodes = {
  // General errors (1xxx)
  INTERNAL_ERROR: 'ERR_1000',
  VALIDATION_ERROR: 'ERR_1001',
  NOT_FOUND: 'ERR_1002',
  UNAUTHORIZED: 'ERR_1003',
  FORBIDDEN: 'ERR_1004',
  RATE_LIMITED: 'ERR_1005',
  SERVICE_UNAVAILABLE: 'ERR_1006',
  TIMEOUT: 'ERR_1007',

  // Bridge errors (2xxx)
  BRIDGE_AMOUNT_TOO_LOW: 'ERR_2001',
  BRIDGE_AMOUNT_TOO_HIGH: 'ERR_2002',
  BRIDGE_INVALID_ADDRESS: 'ERR_2003',
  BRIDGE_CHAIN_UNAVAILABLE: 'ERR_2004',
  BRIDGE_INSUFFICIENT_BALANCE: 'ERR_2005',
  BRIDGE_TRANSACTION_FAILED: 'ERR_2006',
  BRIDGE_VALIDATION_FAILED: 'ERR_2007',
  BRIDGE_ALREADY_COMPLETED: 'ERR_2008',
  BRIDGE_EXPIRED: 'ERR_2009',

  // Wallet errors (3xxx)
  WALLET_NOT_CONNECTED: 'ERR_3001',
  WALLET_INVALID: 'ERR_3002',
  WALLET_INSUFFICIENT_FUNDS: 'ERR_3003',
  WALLET_TRANSACTION_REJECTED: 'ERR_3004',
  WALLET_TRUSTLINE_MISSING: 'ERR_3005',

  // DEX errors (4xxx)
  DEX_ORDER_FAILED: 'ERR_4001',
  DEX_INSUFFICIENT_LIQUIDITY: 'ERR_4002',
  DEX_PRICE_SLIPPAGE: 'ERR_4003',
  DEX_ORDER_NOT_FOUND: 'ERR_4004',
  DEX_MARKET_CLOSED: 'ERR_4005',

  // Guild errors (5xxx)
  GUILD_NOT_FOUND: 'ERR_5001',
  GUILD_NOT_MEMBER: 'ERR_5002',
  GUILD_INSUFFICIENT_STAKE: 'ERR_5003',
  GUILD_PERMISSION_DENIED: 'ERR_5004',

  // Tax errors (6xxx)
  TAX_PROFILE_NOT_FOUND: 'ERR_6001',
  TAX_CALCULATION_FAILED: 'ERR_6002',
  TAX_INVALID_JURISDICTION: 'ERR_6003',

  // Asset errors (7xxx)
  ASSET_NOT_FOUND: 'ERR_7001',
  ASSET_WHITELIST_REQUIRED: 'ERR_7002',
  ASSET_KYC_REQUIRED: 'ERR_7003',
  ASSET_COMPLIANCE_FAILED: 'ERR_7004',

  // Sentinel errors (8xxx)
  SENTINEL_ALERT_NOT_FOUND: 'ERR_8001',
  SENTINEL_PERMISSION_DENIED: 'ERR_8002',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

// ============================================================
// ERROR MESSAGES & SUGGESTIONS
// ============================================================

interface ErrorDefinition {
  message: string;
  userMessage: string;
  httpStatus: number;
  category: 'CLIENT' | 'SERVER' | 'EXTERNAL';
  recoverable: boolean;
  suggestions: string[];
}

const ERROR_DEFINITIONS: Record<ErrorCode, ErrorDefinition> = {
  // General errors
  [ErrorCodes.INTERNAL_ERROR]: {
    message: 'Internal server error',
    userMessage: 'Something went wrong. Our team has been notified.',
    httpStatus: 500,
    category: 'SERVER',
    recoverable: true,
    suggestions: ['Please try again in a few moments', 'If the issue persists, contact support'],
  },
  [ErrorCodes.VALIDATION_ERROR]: {
    message: 'Validation failed',
    userMessage: 'The data you provided is invalid.',
    httpStatus: 400,
    category: 'CLIENT',
    recoverable: true,
    suggestions: ['Check your input and try again', 'Ensure all required fields are filled'],
  },
  [ErrorCodes.NOT_FOUND]: {
    message: 'Resource not found',
    userMessage: 'The requested item could not be found.',
    httpStatus: 404,
    category: 'CLIENT',
    recoverable: false,
    suggestions: ['Check the ID or reference', 'The item may have been deleted'],
  },
  [ErrorCodes.UNAUTHORIZED]: {
    message: 'Unauthorized',
    userMessage: 'Please connect your wallet to continue.',
    httpStatus: 401,
    category: 'CLIENT',
    recoverable: true,
    suggestions: ['Connect your wallet', 'Sign in to your account'],
  },
  [ErrorCodes.FORBIDDEN]: {
    message: 'Forbidden',
    userMessage: 'You do not have permission to perform this action.',
    httpStatus: 403,
    category: 'CLIENT',
    recoverable: false,
    suggestions: ['Contact the resource owner', 'Check if you have the required role'],
  },
  [ErrorCodes.RATE_LIMITED]: {
    message: 'Rate limited',
    userMessage: 'Too many requests. Please slow down.',
    httpStatus: 429,
    category: 'CLIENT',
    recoverable: true,
    suggestions: ['Wait a moment before trying again', 'Reduce the frequency of your requests'],
  },
  [ErrorCodes.SERVICE_UNAVAILABLE]: {
    message: 'Service unavailable',
    userMessage: 'This service is temporarily unavailable.',
    httpStatus: 503,
    category: 'EXTERNAL',
    recoverable: true,
    suggestions: ['Try again in a few minutes', 'Check service status page'],
  },
  [ErrorCodes.TIMEOUT]: {
    message: 'Request timeout',
    userMessage: 'The request took too long to complete.',
    httpStatus: 504,
    category: 'SERVER',
    recoverable: true,
    suggestions: ['Try again', 'If bridging, check the transaction on the explorer'],
  },

  // Bridge errors
  [ErrorCodes.BRIDGE_AMOUNT_TOO_LOW]: {
    message: 'Bridge amount too low',
    userMessage: 'The amount is below the minimum bridge limit.',
    httpStatus: 400,
    category: 'CLIENT',
    recoverable: true,
    suggestions: ['Minimum bridge amount is 100 VRTY', 'Increase your bridge amount'],
  },
  [ErrorCodes.BRIDGE_AMOUNT_TOO_HIGH]: {
    message: 'Bridge amount too high',
    userMessage: 'The amount exceeds the maximum bridge limit.',
    httpStatus: 400,
    category: 'CLIENT',
    recoverable: true,
    suggestions: ['Maximum bridge amount is 1,000,000 VRTY', 'Split into multiple transactions'],
  },
  [ErrorCodes.BRIDGE_INVALID_ADDRESS]: {
    message: 'Invalid address',
    userMessage: 'The destination address is not valid for this chain.',
    httpStatus: 400,
    category: 'CLIENT',
    recoverable: true,
    suggestions: ['Check the address format', 'Ensure the address matches the destination chain'],
  },
  [ErrorCodes.BRIDGE_CHAIN_UNAVAILABLE]: {
    message: 'Chain unavailable',
    userMessage: 'The selected blockchain is currently unavailable.',
    httpStatus: 503,
    category: 'EXTERNAL',
    recoverable: true,
    suggestions: ['Try a different chain', 'Check the chain status page', 'Wait and try again'],
  },
  [ErrorCodes.BRIDGE_INSUFFICIENT_BALANCE]: {
    message: 'Insufficient balance',
    userMessage: 'You do not have enough tokens to complete this bridge.',
    httpStatus: 400,
    category: 'CLIENT',
    recoverable: false,
    suggestions: ['Add more tokens to your wallet', 'Reduce the bridge amount'],
  },
  [ErrorCodes.BRIDGE_TRANSACTION_FAILED]: {
    message: 'Bridge transaction failed',
    userMessage: 'The bridge transaction could not be completed.',
    httpStatus: 500,
    category: 'SERVER',
    recoverable: true,
    suggestions: ['Check the transaction status', 'If funds are locked, contact support for refund'],
  },
  [ErrorCodes.BRIDGE_VALIDATION_FAILED]: {
    message: 'Validation failed',
    userMessage: 'The transaction could not be validated by the bridge validators.',
    httpStatus: 400,
    category: 'SERVER',
    recoverable: true,
    suggestions: ['Ensure the source transaction is confirmed', 'Wait a few minutes and check again'],
  },
  [ErrorCodes.BRIDGE_ALREADY_COMPLETED]: {
    message: 'Already completed',
    userMessage: 'This bridge transaction has already been completed.',
    httpStatus: 400,
    category: 'CLIENT',
    recoverable: false,
    suggestions: ['Check your destination wallet for tokens', 'View the transaction on the explorer'],
  },
  [ErrorCodes.BRIDGE_EXPIRED]: {
    message: 'Bridge expired',
    userMessage: 'This bridge transaction has expired.',
    httpStatus: 400,
    category: 'CLIENT',
    recoverable: false,
    suggestions: ['Start a new bridge transaction', 'Funds may be eligible for refund'],
  },

  // Wallet errors
  [ErrorCodes.WALLET_NOT_CONNECTED]: {
    message: 'Wallet not connected',
    userMessage: 'Please connect your wallet to continue.',
    httpStatus: 401,
    category: 'CLIENT',
    recoverable: true,
    suggestions: ['Click "Connect Wallet"', 'Approve the connection in your wallet app'],
  },
  [ErrorCodes.WALLET_INVALID]: {
    message: 'Invalid wallet',
    userMessage: 'The wallet address is not valid.',
    httpStatus: 400,
    category: 'CLIENT',
    recoverable: true,
    suggestions: ['Check the wallet address format', 'Ensure you\'re on the correct network'],
  },
  [ErrorCodes.WALLET_INSUFFICIENT_FUNDS]: {
    message: 'Insufficient funds',
    userMessage: 'Your wallet does not have enough funds.',
    httpStatus: 400,
    category: 'CLIENT',
    recoverable: false,
    suggestions: ['Add funds to your wallet', 'Reduce the transaction amount'],
  },
  [ErrorCodes.WALLET_TRANSACTION_REJECTED]: {
    message: 'Transaction rejected',
    userMessage: 'The transaction was rejected in your wallet.',
    httpStatus: 400,
    category: 'CLIENT',
    recoverable: true,
    suggestions: ['Try again and approve the transaction', 'Check your wallet for pending requests'],
  },
  [ErrorCodes.WALLET_TRUSTLINE_MISSING]: {
    message: 'Trustline missing',
    userMessage: 'You need to set up a trustline for this token.',
    httpStatus: 400,
    category: 'CLIENT',
    recoverable: true,
    suggestions: ['Create a trustline to the token issuer', 'This requires a small XRP reserve'],
  },

  // DEX errors
  [ErrorCodes.DEX_ORDER_FAILED]: {
    message: 'Order failed',
    userMessage: 'Your order could not be placed.',
    httpStatus: 500,
    category: 'SERVER',
    recoverable: true,
    suggestions: ['Check your balance', 'Try a different price or amount'],
  },
  [ErrorCodes.DEX_INSUFFICIENT_LIQUIDITY]: {
    message: 'Insufficient liquidity',
    userMessage: 'There is not enough liquidity for this trade.',
    httpStatus: 400,
    category: 'EXTERNAL',
    recoverable: true,
    suggestions: ['Try a smaller amount', 'Use a limit order instead of market order'],
  },
  [ErrorCodes.DEX_PRICE_SLIPPAGE]: {
    message: 'Price slippage exceeded',
    userMessage: 'The price has moved beyond your slippage tolerance.',
    httpStatus: 400,
    category: 'EXTERNAL',
    recoverable: true,
    suggestions: ['Increase slippage tolerance', 'Try again at current market price'],
  },
  [ErrorCodes.DEX_ORDER_NOT_FOUND]: {
    message: 'Order not found',
    userMessage: 'The order could not be found.',
    httpStatus: 404,
    category: 'CLIENT',
    recoverable: false,
    suggestions: ['The order may have been filled or cancelled', 'Check your order history'],
  },
  [ErrorCodes.DEX_MARKET_CLOSED]: {
    message: 'Market closed',
    userMessage: 'Trading is currently not available.',
    httpStatus: 503,
    category: 'EXTERNAL',
    recoverable: true,
    suggestions: ['Check back later', 'Trading may be paused for maintenance'],
  },

  // Guild errors
  [ErrorCodes.GUILD_NOT_FOUND]: {
    message: 'Guild not found',
    userMessage: 'The guild could not be found.',
    httpStatus: 404,
    category: 'CLIENT',
    recoverable: false,
    suggestions: ['Check the guild ID', 'The guild may have been dissolved'],
  },
  [ErrorCodes.GUILD_NOT_MEMBER]: {
    message: 'Not a member',
    userMessage: 'You are not a member of this guild.',
    httpStatus: 403,
    category: 'CLIENT',
    recoverable: true,
    suggestions: ['Request to join the guild', 'Contact the guild owner'],
  },
  [ErrorCodes.GUILD_INSUFFICIENT_STAKE]: {
    message: 'Insufficient stake',
    userMessage: 'You do not have enough VRTY staked to perform this action.',
    httpStatus: 400,
    category: 'CLIENT',
    recoverable: true,
    suggestions: ['Stake more VRTY tokens', 'Check the minimum stake requirement'],
  },
  [ErrorCodes.GUILD_PERMISSION_DENIED]: {
    message: 'Permission denied',
    userMessage: 'You do not have permission for this guild action.',
    httpStatus: 403,
    category: 'CLIENT',
    recoverable: false,
    suggestions: ['Contact a guild admin', 'Check your role in the guild'],
  },

  // Tax errors
  [ErrorCodes.TAX_PROFILE_NOT_FOUND]: {
    message: 'Tax profile not found',
    userMessage: 'No tax profile found. Please create one first.',
    httpStatus: 404,
    category: 'CLIENT',
    recoverable: true,
    suggestions: ['Create a tax profile', 'Set your tax jurisdiction in settings'],
  },
  [ErrorCodes.TAX_CALCULATION_FAILED]: {
    message: 'Calculation failed',
    userMessage: 'Tax calculation could not be completed.',
    httpStatus: 500,
    category: 'SERVER',
    recoverable: true,
    suggestions: ['Try again', 'Ensure your transactions are complete'],
  },
  [ErrorCodes.TAX_INVALID_JURISDICTION]: {
    message: 'Invalid jurisdiction',
    userMessage: 'The selected tax jurisdiction is not supported.',
    httpStatus: 400,
    category: 'CLIENT',
    recoverable: true,
    suggestions: ['Select a supported jurisdiction', 'Contact support for your region'],
  },

  // Asset errors
  [ErrorCodes.ASSET_NOT_FOUND]: {
    message: 'Asset not found',
    userMessage: 'The tokenized asset could not be found.',
    httpStatus: 404,
    category: 'CLIENT',
    recoverable: false,
    suggestions: ['Check the asset ID', 'The asset may have been delisted'],
  },
  [ErrorCodes.ASSET_WHITELIST_REQUIRED]: {
    message: 'Whitelist required',
    userMessage: 'You must be whitelisted to invest in this asset.',
    httpStatus: 403,
    category: 'CLIENT',
    recoverable: true,
    suggestions: ['Complete KYC verification', 'Request whitelist access from the issuer'],
  },
  [ErrorCodes.ASSET_KYC_REQUIRED]: {
    message: 'KYC required',
    userMessage: 'KYC verification is required to invest.',
    httpStatus: 403,
    category: 'CLIENT',
    recoverable: true,
    suggestions: ['Complete KYC verification', 'Submit required documents'],
  },
  [ErrorCodes.ASSET_COMPLIANCE_FAILED]: {
    message: 'Compliance check failed',
    userMessage: 'You do not meet the compliance requirements for this asset.',
    httpStatus: 403,
    category: 'CLIENT',
    recoverable: false,
    suggestions: ['Check asset requirements', 'This may be restricted in your jurisdiction'],
  },

  // Sentinel errors
  [ErrorCodes.SENTINEL_ALERT_NOT_FOUND]: {
    message: 'Alert not found',
    userMessage: 'The alert could not be found.',
    httpStatus: 404,
    category: 'CLIENT',
    recoverable: false,
    suggestions: ['Check the alert ID', 'The alert may have been resolved'],
  },
  [ErrorCodes.SENTINEL_PERMISSION_DENIED]: {
    message: 'Permission denied',
    userMessage: 'You do not have permission to manage this alert.',
    httpStatus: 403,
    category: 'CLIENT',
    recoverable: false,
    suggestions: ['Contact a guardian admin', 'Check your guardian permissions'],
  },
};

// ============================================================
// ERROR CLASS
// ============================================================

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly httpStatus: number;
  public readonly userMessage: string;
  public readonly category: string;
  public readonly recoverable: boolean;
  public readonly suggestions: string[];
  public readonly details?: any;

  constructor(code: ErrorCode, details?: any) {
    const definition = ERROR_DEFINITIONS[code];
    super(definition.message);
    
    this.code = code;
    this.httpStatus = definition.httpStatus;
    this.userMessage = definition.userMessage;
    this.category = definition.category;
    this.recoverable = definition.recoverable;
    this.suggestions = definition.suggestions;
    this.details = details;

    // Maintain proper stack trace
    Error.captureStackTrace(this, AppError);
  }

  toJSON() {
    return {
      code: this.code,
      message: this.userMessage,
      recoverable: this.recoverable,
      suggestions: this.suggestions,
      details: this.details,
    };
  }
}

// ============================================================
// ERROR HANDLER
// ============================================================

export class ErrorHandler {
  /**
   * Convert any error to AppError
   */
  static normalize(error: unknown): AppError {
    if (error instanceof AppError) {
      return error;
    }

    if (error instanceof ZodError) {
      return new AppError(ErrorCodes.VALIDATION_ERROR, {
        validationErrors: error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      });
    }

    if (error instanceof Error) {
      // Check for common error patterns
      const message = error.message.toLowerCase();

      if (message.includes('not found')) {
        return new AppError(ErrorCodes.NOT_FOUND, { originalMessage: error.message });
      }
      if (message.includes('unauthorized') || message.includes('authentication')) {
        return new AppError(ErrorCodes.UNAUTHORIZED, { originalMessage: error.message });
      }
      if (message.includes('forbidden') || message.includes('permission')) {
        return new AppError(ErrorCodes.FORBIDDEN, { originalMessage: error.message });
      }
      if (message.includes('timeout')) {
        return new AppError(ErrorCodes.TIMEOUT, { originalMessage: error.message });
      }
      if (message.includes('rate limit')) {
        return new AppError(ErrorCodes.RATE_LIMITED, { originalMessage: error.message });
      }

      return new AppError(ErrorCodes.INTERNAL_ERROR, { originalMessage: error.message });
    }

    return new AppError(ErrorCodes.INTERNAL_ERROR);
  }

  /**
   * Send error response
   */
  static sendError(res: Response, error: unknown, requestId?: string): void {
    const appError = this.normalize(error);

    // Log error
    logger.error(appError.message, {
      code: appError.code,
      httpStatus: appError.httpStatus,
      category: appError.category,
      details: appError.details,
      requestId,
    });

    // Send response
    res.status(appError.httpStatus).json({
      success: false,
      error: appError.toJSON(),
      meta: {
        requestId,
        timestamp: new Date(),
      },
    });
  }

  /**
   * Express error middleware
   */
  static middleware() {
    return (err: unknown, req: any, res: Response, next: any) => {
      this.sendError(res, err, req.requestId);
    };
  }

  /**
   * Async handler wrapper
   */
  static asyncHandler(fn: Function) {
    return (req: any, res: Response, next: any) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  }
}

// ============================================================
// EXPORTS
// ============================================================

export default ErrorHandler;
