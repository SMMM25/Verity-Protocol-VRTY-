/**
 * Verity Protocol - Mobile SDK Module
 * Production-ready SDK and API for iOS and Android applications
 * 
 * Features:
 * - Mobile SDK for client-side integration
 * - REST API routes for backend services
 * - Push notification handling
 * - Biometric authentication
 * - Deep linking support
 * - QR code generation/scanning
 * - Offline transaction signing
 * - Price alerts
 */

// Mobile SDK (client-side)
export {
  VerityMobileSDK,
  type MobilePlatform,
  type AuthMethod,
  type NotificationType,
  type DeviceInfo,
  type MobileSession,
  type PushNotification,
  type OfflineTransaction,
  type QRCodeData,
  type MobileSDKConfig,
  type BiometricResult,
  type DeepLinkResult,
} from './MobileSDK.js';

// Mobile API Routes (server-side)
export {
  mobileRoutes,
  validateSession,
  type MobileDevice,
  type MobileSession as MobileAPISession,
  type PriceAlert,
  type NotificationSubscription,
} from './MobileAPIRoutes.js';

// Default exports
export { default as MobileSDK } from './MobileSDK.js';
export { default as MobileAPIRoutes } from './MobileAPIRoutes.js';
