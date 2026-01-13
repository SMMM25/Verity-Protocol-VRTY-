/**
 * Verity Protocol - Middleware Exports
 */

export { rateLimitMiddleware, strictRateLimitMiddleware, RATE_LIMITS } from './rateLimit.js';
export { 
  errorHandler, 
  notFoundHandler, 
  asyncHandler, 
  APIError, 
  Errors, 
  ErrorCodes 
} from './errorHandler.js';
export {
  XummAuthService,
  initializeXummAuth,
  getXummAuth,
  requireXummAuth,
  optionalXummAuth,
  type XummAuthConfig,
  type AuthenticatedUser,
  type XummPayloadResult,
} from './xummAuth.js';
