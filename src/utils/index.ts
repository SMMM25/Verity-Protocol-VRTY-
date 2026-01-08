/**
 * Verity Protocol - Utility Exports
 */

export * from './logger.js';
export * from './crypto.js';

/**
 * Convert XRP to drops (1 XRP = 1,000,000 drops)
 */
export function xrpToDrops(xrp: number | string): string {
  const xrpNum = typeof xrp === 'string' ? parseFloat(xrp) : xrp;
  return Math.floor(xrpNum * 1_000_000).toString();
}

/**
 * Convert drops to XRP
 */
export function dropsToXrp(drops: number | string): string {
  const dropsNum = typeof drops === 'string' ? parseInt(drops, 10) : drops;
  return (dropsNum / 1_000_000).toFixed(6);
}

/**
 * Format currency code for XRPL (max 3 chars or 40 hex chars)
 */
export function formatCurrencyCode(code: string): string {
  if (code.length <= 3) {
    return code.toUpperCase();
  }
  // For longer codes, convert to hex and pad to 40 characters
  const hex = Buffer.from(code, 'utf8').toString('hex').toUpperCase();
  return hex.padEnd(40, '0');
}

/**
 * Validate XRPL address format
 */
export function isValidXRPLAddress(address: string): boolean {
  return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(address);
}

/**
 * Sleep utility for async operations
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry an async operation with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt);
        await sleep(delay);
      }
    }
  }
  
  throw lastError;
}

/**
 * Format a timestamp for display
 */
export function formatTimestamp(date: Date): string {
  return date.toISOString();
}

/**
 * Calculate basis points (1 bp = 0.01%)
 */
export function basisPointsToPercentage(bps: number): number {
  return bps / 100;
}

/**
 * Calculate percentage to basis points
 */
export function percentageToBasisPoints(percentage: number): number {
  return Math.round(percentage * 100);
}

/**
 * Safely parse JSON with error handling
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * Deep clone an object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

/**
 * Chunk an array into smaller arrays
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}
