/**
 * Verity Protocol - Cryptographic Utilities
 * Hashing, encoding, and verification functions
 */

import crypto from 'crypto';
import CryptoJS from 'crypto-js';

/**
 * Generate a SHA-256 hash of the input data
 */
export function sha256(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Generate a unique ID with optional prefix
 */
export function generateId(prefix = ''): string {
  const timestamp = Date.now().toString(36);
  const randomPart = crypto.randomBytes(8).toString('hex');
  return prefix ? `${prefix}_${timestamp}${randomPart}` : `${timestamp}${randomPart}`;
}

/**
 * Encode data to hex for XRPL memo fields
 */
export function encodeToHex(data: string): string {
  return Buffer.from(data, 'utf8').toString('hex').toUpperCase();
}

/**
 * Decode hex data from XRPL memo fields
 */
export function decodeFromHex(hex: string): string {
  return Buffer.from(hex, 'hex').toString('utf8');
}

/**
 * Encode JSON data for XRPL memo
 */
export function encodeMemoData(data: unknown): string {
  return encodeToHex(JSON.stringify(data));
}

/**
 * Decode JSON data from XRPL memo
 */
export function decodeMemoData<T>(hex: string): T {
  return JSON.parse(decodeFromHex(hex)) as T;
}

/**
 * Generate a verification hash for transaction data
 */
export function generateVerificationHash(data: unknown): string {
  const sortedKeys = Object.keys(data as object).sort();
  const sortedData: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    sortedData[key] = (data as Record<string, unknown>)[key];
  }
  return sha256(JSON.stringify(sortedData));
}

/**
 * Encrypt sensitive data using AES-256
 */
export function encrypt(data: string, key: string): string {
  return CryptoJS.AES.encrypt(data, key).toString();
}

/**
 * Decrypt AES-256 encrypted data
 */
export function decrypt(encryptedData: string, key: string): string {
  const bytes = CryptoJS.AES.decrypt(encryptedData, key);
  return bytes.toString(CryptoJS.enc.Utf8);
}

/**
 * Generate a secure random token
 */
export function generateSecureToken(length = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Create a deterministic hash for comparing data integrity
 */
export function createIntegrityHash(data: unknown): string {
  const normalized = JSON.stringify(data, Object.keys(data as object).sort());
  return sha256(normalized);
}

/**
 * Verify data integrity against a hash
 */
export function verifyIntegrity(data: unknown, expectedHash: string): boolean {
  const actualHash = createIntegrityHash(data);
  return actualHash === expectedHash;
}
