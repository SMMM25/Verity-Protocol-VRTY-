/**
 * Verity Protocol
 * The Verified Financial Operating System for XRP Ledger
 * 
 * @packageDocumentation
 */

// Core modules
export * from './core/index.js';

// Feature modules
export * from './assets/index.js';
export * from './signals/index.js';
export * from './guilds/index.js';
export * from './token/index.js';
export * from './tax/index.js';
export * from './compliance/index.js';

// Types
export * from './types/index.js';

// Utilities
export * from './utils/index.js';

// SDK
export { VeritySDK, default } from './sdk/index.js';

// Version
export const VERSION = '0.1.0';
