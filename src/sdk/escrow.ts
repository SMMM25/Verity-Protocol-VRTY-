/**
 * Verity Protocol - Escrow SDK
 * Sprint 2 - Client SDK for XRPL Escrow & Vesting
 * @module sdk/escrow
 * @version 1.0.0
 */

import {
  VestingType,
  VestingStatus,
  EscrowStatus,
  VestingSchedule,
  EscrowRecord,
  VestingSummary,
  formatVestingAmount,
  calculateVestingProgress,
} from '../escrow/types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * SDK configuration
 */
export interface EscrowSDKConfig {
  /** Base URL for the API */
  baseUrl: string;
  /** API version */
  apiVersion?: string;
  /** Request timeout in ms */
  timeout?: number;
  /** Creator address for signing requests */
  creatorAddress?: string;
  /** Optional API key for authentication */
  apiKey?: string;
}

/**
 * Create vesting request
 */
export interface CreateVestingRequest {
  /** Beneficiary XRPL address */
  beneficiary: string;
  /** Total amount to vest (in smallest units) */
  totalAmount: string;
  /** Currency (XRP or VRTY) */
  currency: 'XRP' | 'VRTY';
  /** VRTY issuer (required for VRTY) */
  issuer?: string;
  /** Vesting type */
  vestingType: VestingType;
  /** Start time (Unix timestamp) */
  startTime: number;
  /** End time (Unix timestamp) */
  endTime: number;
  /** Cliff duration in seconds (optional) */
  cliffDuration?: number;
  /** Number of release intervals (for LINEAR vesting) */
  releaseIntervals?: number;
  /** Cancel after timestamp (optional) */
  cancelAfter?: number;
  /** Description/memo */
  description?: string;
}

/**
 * Vesting creation response
 */
export interface CreateVestingResponse {
  success: boolean;
  scheduleId?: string;
  beneficiary?: string;
  totalAmount?: string;
  currency?: string;
  vestingType?: VestingType;
  escrowCount?: number;
  startTime?: number;
  endTime?: number;
  status?: VestingStatus;
  transactionHashes?: string[];
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Vesting schedule details response
 */
export interface VestingDetailsResponse {
  success: boolean;
  schedule?: VestingSchedule & {
    escrows: Array<{
      escrowId: string;
      amount: string;
      status: EscrowStatus;
      finishAfter?: number;
      releasedAt?: Date;
    }>;
    progress: {
      percentage: number;
      released: string;
      pending: string;
    };
    nextRelease?: {
      escrowId: string;
      amount: string;
      releaseTime: number;
      isReady: boolean;
    };
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Beneficiary vestings response
 */
export interface BeneficiaryVestingsResponse {
  success: boolean;
  summary?: VestingSummary;
  schedules?: Array<{
    scheduleId: string;
    totalAmount: string;
    currency: string;
    vestingType: VestingType;
    status: VestingStatus;
    progress: number;
    startTime: number;
    endTime: number;
  }>;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Release escrow response
 */
export interface ReleaseEscrowResponse {
  success: boolean;
  escrowId?: string;
  scheduleId?: string;
  amount?: string;
  currency?: string;
  destination?: string;
  transactionHash?: string;
  releasedAt?: Date;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Cancel escrow response
 */
export interface CancelEscrowResponse {
  success: boolean;
  escrowId?: string;
  scheduleId?: string;
  amount?: string;
  refundedTo?: string;
  transactionHash?: string;
  reason?: string;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Escrow details response
 */
export interface EscrowDetailsResponse {
  success: boolean;
  escrow?: EscrowRecord & {
    finishAfterUnix: number;
    cancelAfterUnix?: number;
    schedule?: {
      scheduleId: string;
      vestingType: VestingType;
      totalAmount: string;
      progress: number;
    };
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Escrow stats response
 */
export interface EscrowStatsResponse {
  success: boolean;
  stats?: {
    schedules: {
      total: number;
      active: number;
      completed: number;
      cancelled: number;
    };
    escrows: {
      total: number;
      created: number;
      mature: number;
      released: number;
      cancelled: number;
      failed: number;
    };
    amounts: {
      totalVested: string;
      totalReleased: string;
      totalPending: string;
    };
    byType: Record<VestingType, number>;
    uniqueBeneficiaries: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Bot status response
 */
export interface BotStatusResponse {
  success: boolean;
  botStatus?: {
    running: boolean;
    lastCheck: Date | null;
    lastRelease: Date | null;
    escrowsProcessed: number;
    escrowsReleased: number;
    escrowsFailed: number;
    pendingEscrows: number;
    nextScheduledCheck: Date | null;
    walletBalance: string;
    walletAddress: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

// ============================================================================
// SDK Class
// ============================================================================

/**
 * Verity Protocol Escrow SDK
 * 
 * @example
 * ```typescript
 * import { VerityEscrow } from '@verity/sdk';
 * 
 * const escrow = new VerityEscrow({
 *   baseUrl: 'https://api.verity.finance',
 *   creatorAddress: 'rYourAddress...',
 * });
 * 
 * // Create a linear vesting schedule
 * const result = await escrow.createVestingSchedule({
 *   beneficiary: 'rBeneficiaryAddress...',
 *   totalAmount: '1000000000000', // 1M VRTY
 *   currency: 'VRTY',
 *   issuer: 'rVRTYIssuer...',
 *   vestingType: VestingType.LINEAR,
 *   startTime: Math.floor(Date.now() / 1000),
 *   endTime: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60), // 1 year
 *   releaseIntervals: 12, // Monthly
 *   description: 'Team allocation vesting',
 * });
 * ```
 */
export class VerityEscrow {
  private config: Required<EscrowSDKConfig>;
  
  constructor(config: EscrowSDKConfig) {
    this.config = {
      baseUrl: config.baseUrl.replace(/\/$/, ''),
      apiVersion: config.apiVersion || 'v1',
      timeout: config.timeout || 30000,
      creatorAddress: config.creatorAddress || '',
      apiKey: config.apiKey || '',
    };
  }
  
  // ==========================================================================
  // Private Helpers
  // ==========================================================================
  
  /**
   * Build API URL
   */
  private buildUrl(path: string): string {
    return `${this.config.baseUrl}/api/${this.config.apiVersion}/escrow${path}`;
  }
  
  /**
   * Make API request
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = this.buildUrl(path);
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (this.config.creatorAddress) {
      headers['X-Creator-Address'] = this.config.creatorAddress;
    }
    
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);
    
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      
      const data = await response.json();
      return data as T;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  
  // ==========================================================================
  // Vesting Schedule Methods
  // ==========================================================================
  
  /**
   * Create a new vesting schedule
   * 
   * @param request - Vesting schedule configuration
   * @returns Creation result with schedule ID and transaction hashes
   * 
   * @example
   * ```typescript
   * const result = await escrow.createVestingSchedule({
   *   beneficiary: 'rBeneficiary...',
   *   totalAmount: '100000000000', // 100K VRTY
   *   currency: 'VRTY',
   *   issuer: 'rVRTYIssuer...',
   *   vestingType: VestingType.CLIFF_LINEAR,
   *   startTime: now,
   *   endTime: now + (2 * 365 * 24 * 60 * 60), // 2 years
   *   cliffDuration: 6 * 30 * 24 * 60 * 60, // 6 month cliff
   *   releaseIntervals: 18, // 18 monthly releases after cliff
   * });
   * ```
   */
  async createVestingSchedule(request: CreateVestingRequest): Promise<CreateVestingResponse> {
    return this.request<CreateVestingResponse>('POST', '/vesting/create', request);
  }
  
  /**
   * Get vesting schedule details
   * 
   * @param scheduleId - The schedule ID
   * @returns Detailed schedule information including all escrows
   */
  async getVestingSchedule(scheduleId: string): Promise<VestingDetailsResponse> {
    const response = await this.request<{ success: boolean; data?: unknown; error?: unknown }>(
      'GET',
      `/vesting/${scheduleId}`
    );
    
    return {
      success: response.success,
      schedule: response.data as VestingDetailsResponse['schedule'],
      error: response.error as VestingDetailsResponse['error'],
    };
  }
  
  /**
   * Get all vesting schedules for a beneficiary
   * 
   * @param address - Beneficiary XRPL address
   * @returns Summary and list of all vesting schedules
   */
  async getBeneficiaryVestings(address: string): Promise<BeneficiaryVestingsResponse> {
    const response = await this.request<{ success: boolean; data?: unknown; error?: unknown }>(
      'GET',
      `/vesting/beneficiary/${address}`
    );
    
    if (response.success && response.data) {
      const data = response.data as { summary: VestingSummary; schedules: unknown[] };
      return {
        success: true,
        summary: data.summary,
        schedules: data.schedules as BeneficiaryVestingsResponse['schedules'],
      };
    }
    
    return {
      success: false,
      error: response.error as BeneficiaryVestingsResponse['error'],
    };
  }
  
  /**
   * Get vesting status summary for a beneficiary
   * Alias for getBeneficiaryVestings
   */
  async getVestingStatus(address: string): Promise<BeneficiaryVestingsResponse> {
    return this.getBeneficiaryVestings(address);
  }
  
  /**
   * List all vestings for a beneficiary
   * Alias for getBeneficiaryVestings
   */
  async listVestings(address: string): Promise<BeneficiaryVestingsResponse> {
    return this.getBeneficiaryVestings(address);
  }
  
  // ==========================================================================
  // Escrow Release/Cancel Methods
  // ==========================================================================
  
  /**
   * Release a mature escrow
   * 
   * @param escrowId - The escrow ID to release
   * @param fulfillment - Optional fulfillment for conditional escrows
   * @returns Release result with transaction hash
   * 
   * @example
   * ```typescript
   * const result = await escrow.releaseEscrow('ESC-12345678');
   * if (result.success) {
   *   console.log(`Released ${result.amount} to ${result.destination}`);
   *   console.log(`Transaction: ${result.transactionHash}`);
   * }
   * ```
   */
  async releaseEscrow(escrowId: string, fulfillment?: string): Promise<ReleaseEscrowResponse> {
    return this.request<ReleaseEscrowResponse>(
      'POST',
      `/release/${escrowId}`,
      fulfillment ? { fulfillment } : undefined
    );
  }
  
  /**
   * Cancel an escrow (if CancelAfter has passed)
   * 
   * @param escrowId - The escrow ID to cancel
   * @param reason - Optional reason for cancellation
   * @returns Cancellation result with refund information
   */
  async cancelEscrow(escrowId: string, reason?: string): Promise<CancelEscrowResponse> {
    return this.request<CancelEscrowResponse>(
      'POST',
      `/cancel/${escrowId}`,
      reason ? { reason } : undefined
    );
  }
  
  /**
   * Cancel an entire vesting schedule
   * Cancels all remaining escrows in the schedule
   * 
   * @param scheduleId - The schedule ID to cancel
   * @param reason - Optional reason for cancellation
   * @returns Array of cancellation results
   */
  async cancelVesting(scheduleId: string, reason?: string): Promise<{
    success: boolean;
    scheduleId: string;
    results: CancelEscrowResponse[];
    totalCancelled: number;
    totalFailed: number;
  }> {
    // Get schedule details first
    const scheduleResponse = await this.getVestingSchedule(scheduleId);
    
    if (!scheduleResponse.success || !scheduleResponse.schedule) {
      return {
        success: false,
        scheduleId,
        results: [],
        totalCancelled: 0,
        totalFailed: 0,
      };
    }
    
    // Cancel each pending escrow
    const results: CancelEscrowResponse[] = [];
    let totalCancelled = 0;
    let totalFailed = 0;
    
    for (const escrow of scheduleResponse.schedule.escrows) {
      if (escrow.status === EscrowStatus.CREATED) {
        const result = await this.cancelEscrow(escrow.escrowId, reason);
        results.push(result);
        
        if (result.success) {
          totalCancelled++;
        } else {
          totalFailed++;
        }
      }
    }
    
    return {
      success: totalFailed === 0,
      scheduleId,
      results,
      totalCancelled,
      totalFailed,
    };
  }
  
  // ==========================================================================
  // Query Methods
  // ==========================================================================
  
  /**
   * Get escrow details
   * 
   * @param escrowId - The escrow ID
   * @returns Detailed escrow information
   */
  async getEscrow(escrowId: string): Promise<EscrowDetailsResponse> {
    const response = await this.request<{ success: boolean; data?: unknown; error?: unknown }>(
      'GET',
      `/${escrowId}`
    );
    
    return {
      success: response.success,
      escrow: response.data as EscrowDetailsResponse['escrow'],
      error: response.error as EscrowDetailsResponse['error'],
    };
  }
  
  /**
   * Get escrow system statistics
   * 
   * @returns System-wide statistics
   */
  async getStats(): Promise<EscrowStatsResponse> {
    const response = await this.request<{ success: boolean; data?: unknown; error?: unknown }>(
      'GET',
      '/stats'
    );
    
    return {
      success: response.success,
      stats: response.data as EscrowStatsResponse['stats'],
      error: response.error as EscrowStatsResponse['error'],
    };
  }
  
  /**
   * Get release bot status
   * 
   * @returns Bot status and health information
   */
  async getBotStatus(): Promise<BotStatusResponse> {
    const response = await this.request<{ success: boolean; data?: unknown; error?: unknown }>(
      'GET',
      '/bot/status'
    );
    
    return {
      success: response.success,
      botStatus: response.data as BotStatusResponse['botStatus'],
      error: response.error as BotStatusResponse['error'],
    };
  }
  
  // ==========================================================================
  // Utility Methods
  // ==========================================================================
  
  /**
   * Calculate vesting progress percentage
   * 
   * @param schedule - Vesting schedule
   * @returns Progress percentage (0-100)
   */
  calculateProgress(schedule: VestingSchedule): number {
    return calculateVestingProgress(schedule);
  }
  
  /**
   * Format amount for display
   * 
   * @param amount - Amount in smallest units
   * @param currency - Currency type
   * @returns Formatted string (e.g., "1,000.00 VRTY")
   */
  formatAmount(amount: string, currency: 'XRP' | 'VRTY'): string {
    return formatVestingAmount(amount, currency);
  }
  
  /**
   * Check if an escrow is ready to release
   * 
   * @param finishAfterUnix - Unix timestamp when escrow becomes releasable
   * @returns True if escrow can be released now
   */
  isReleasable(finishAfterUnix: number): boolean {
    return Math.floor(Date.now() / 1000) >= finishAfterUnix;
  }
  
  /**
   * Calculate time until escrow is releasable
   * 
   * @param finishAfterUnix - Unix timestamp when escrow becomes releasable
   * @returns Seconds until releasable (0 if already releasable)
   */
  timeUntilReleasable(finishAfterUnix: number): number {
    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, finishAfterUnix - now);
  }
  
  /**
   * Create a founder vesting schedule helper
   * Pre-configured for 24-month linear vesting
   * 
   * @param beneficiary - Founder XRPL address
   * @param totalAmount - Total VRTY amount (default: 200M)
   * @param issuer - VRTY issuer address
   * @returns CreateVestingRequest configured for founder vesting
   */
  createFounderVestingRequest(
    beneficiary: string,
    totalAmount: string = '200000000000000', // 200M VRTY
    issuer: string
  ): CreateVestingRequest {
    const now = Math.floor(Date.now() / 1000);
    const twoYears = 2 * 365 * 24 * 60 * 60;
    
    return {
      beneficiary,
      totalAmount,
      currency: 'VRTY',
      issuer,
      vestingType: VestingType.LINEAR,
      startTime: now,
      endTime: now + twoYears,
      releaseIntervals: 24, // Monthly releases
      cancelAfter: now + twoYears + (30 * 24 * 60 * 60), // 30 days after end
      description: 'Founder allocation - 24-month linear vesting',
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new Verity Escrow SDK instance
 * 
 * @param config - SDK configuration
 * @returns Configured VerityEscrow instance
 * 
 * @example
 * ```typescript
 * const escrow = createEscrowSDK({
 *   baseUrl: 'https://api.verity.finance',
 *   creatorAddress: 'rYourAddress...',
 * });
 * ```
 */
export function createEscrowSDK(config: EscrowSDKConfig): VerityEscrow {
  return new VerityEscrow(config);
}

// ============================================================================
// Export Types
// ============================================================================

export {
  VestingType,
  VestingStatus,
  EscrowStatus,
  VestingSchedule,
  EscrowRecord,
  VestingSummary,
};

export default VerityEscrow;
