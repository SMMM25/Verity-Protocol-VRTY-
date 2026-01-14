/**
 * Verity Protocol - VRTY Escrow Service
 * 
 * @description Service for managing VRTY token escrow on XRPL.
 * Implements the 50-month release schedule for protocol treasury.
 * 
 * Release Schedule:
 * - Month 1-12:  1.5% per month (15% total)
 * - Month 13-24: 2.0% per month (24% total)
 * - Month 25-36: 2.0% per month (24% total)
 * - Month 37-48: 2.5% per month (30% total)
 * - Month 49-50: 3.5% per month (7% total)
 */

import { Client, Wallet, xrpToDrops, dropsToXrp } from 'xrpl';
import {
  DistributionConfig,
  DEFAULT_DISTRIBUTION_CONFIG,
  ReleaseSchedule,
  ReleaseScheduleEntry,
  DistributionStatus,
  TokenDistribution,
  AllocationEntry,
} from './distributionTypes.js';
import { logger } from '../utils/logger.js';

// Using shared logger

// ============================================================
// CONSTANTS
// ============================================================

const XRPL_ENDPOINTS = {
  mainnet: 'wss://xrplcluster.com',
  testnet: 'wss://s.altnet.rippletest.net:51233',
  devnet: 'wss://s.devnet.rippletest.net:51233',
};

// Release percentages by phase
const RELEASE_PHASES = [
  { startMonth: 1, endMonth: 12, percentPerMonth: 1.5 },   // 15% total
  { startMonth: 13, endMonth: 24, percentPerMonth: 2.0 },  // 24% total
  { startMonth: 25, endMonth: 36, percentPerMonth: 2.0 },  // 24% total
  { startMonth: 37, endMonth: 48, percentPerMonth: 2.5 },  // 30% total
  { startMonth: 49, endMonth: 50, percentPerMonth: 3.5 },  // 7% total
];

// Token allocations
const TOKEN_ALLOCATIONS: Omit<AllocationEntry, 'released' | 'remaining'>[] = [
  {
    category: 'TREASURY',
    totalAllocated: '650000000',
    percentage: 65,
    vestingMonths: 50,
    cliffMonths: 0,
    startDate: new Date().toISOString(),
    walletAddress: 'rLmLMErLKDzWXyYmcZGHqQ3SCgTVJCVjA3',
  },
  {
    category: 'FOUNDER',
    totalAllocated: '200000000',
    percentage: 20,
    vestingMonths: 48,
    cliffMonths: 12,
    startDate: new Date().toISOString(),
    walletAddress: 'rLmLMErLKDzWXyYmcZGHqQ3SCgTVJCVjA3',
  },
  {
    category: 'ECOSYSTEM',
    totalAllocated: '150000000',
    percentage: 15,
    vestingMonths: 36,
    cliffMonths: 0,
    startDate: new Date().toISOString(),
    walletAddress: 'rLmLMErLKDzWXyYmcZGHqQ3SCgTVJCVjA3',
  },
];

// ============================================================
// ESCROW SERVICE CLASS
// ============================================================

export class TokenDistributionService {
  private config: DistributionConfig;
  private client: Client | null = null;
  private releaseSchedule: ReleaseSchedule | null = null;

  constructor(config: Partial<DistributionConfig> = {}) {
    this.config = { ...DEFAULT_DISTRIBUTION_CONFIG, ...config };
  }

  // ============================================================
  // CONNECTION MANAGEMENT
  // ============================================================

  /**
   * Connect to XRPL
   */
  async connect(): Promise<void> {
    if (this.client?.isConnected()) {
      return;
    }

    const endpoint = XRPL_ENDPOINTS[this.config.network];
    this.client = new Client(endpoint);
    
    await this.client.connect();
    logger.info(`Connected to XRPL ${this.config.network}`);
  }

  /**
   * Disconnect from XRPL
   */
  async disconnect(): Promise<void> {
    if (this.client?.isConnected()) {
      await this.client.disconnect();
      logger.info('Disconnected from XRPL');
    }
  }

  /**
   * Ensure connected
   */
  private async ensureConnected(): Promise<Client> {
    if (!this.client?.isConnected()) {
      await this.connect();
    }
    return this.client!;
  }

  // ============================================================
  // RELEASE SCHEDULE GENERATION
  // ============================================================

  /**
   * Generate the 50-month release schedule
   */
  generateReleaseSchedule(startDate: Date = new Date()): ReleaseSchedule {
    const entries: ReleaseScheduleEntry[] = [];
    const totalAmount = BigInt(this.config.totalAmount);
    let cumulativeReleased = BigInt(0);

    for (let month = 1; month <= this.config.totalMonths; month++) {
      // Find the phase for this month
      const phase = RELEASE_PHASES.find(
        p => month >= p.startMonth && month <= p.endMonth
      );
      
      if (!phase) {
        throw new Error(`No release phase defined for month ${month}`);
      }

      // Calculate release amount
      const percentageDecimal = phase.percentPerMonth / 100;
      const releaseAmount = BigInt(
        Math.floor(Number(totalAmount) * percentageDecimal)
      );
      
      cumulativeReleased += releaseAmount;

      // Calculate release date (1st of each month)
      const releaseDate = new Date(startDate);
      releaseDate.setMonth(releaseDate.getMonth() + month - 1);
      releaseDate.setDate(1);
      releaseDate.setHours(0, 0, 0, 0);

      entries.push({
        month,
        releaseDate: releaseDate.toISOString(),
        amount: releaseAmount.toString(),
        percentage: phase.percentPerMonth,
        cumulativeReleased: cumulativeReleased.toString(),
        cumulativePercentage: Number(
          ((cumulativeReleased * BigInt(10000)) / totalAmount) / BigInt(100)
        ),
        status: 'pending',
      });
    }

    this.releaseSchedule = {
      config: this.config,
      entries,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      totalEscrowed: this.config.totalAmount,
      totalReleased: '0',
      nextReleaseDate: entries[0]?.releaseDate,
      nextReleaseAmount: entries[0]?.amount,
    };

    return this.releaseSchedule;
  }

  /**
   * Get release schedule (generate if not exists)
   */
  getReleaseSchedule(): ReleaseSchedule {
    if (!this.releaseSchedule) {
      this.generateReleaseSchedule();
    }
    return this.releaseSchedule!;
  }

  // ============================================================
  // ESCROW CREATION (XRPL NATIVE)
  // ============================================================

  /**
   * Create escrow for XRP (XRPL native escrow)
   * Note: XRPL native escrow only supports XRP, not issued currencies.
   * For VRTY (issued currency), we use time-locked trustline + scheduled releases.
   */
  async createXRPEscrow(
    sourceWallet: Wallet,
    destination: string,
    amountXRP: string,
    finishAfterSeconds: number
  ): Promise<{ success: boolean; sequence?: number; txHash?: string; error?: string }> {
    try {
      const client = await this.ensureConnected();

      const finishAfter = Math.floor(Date.now() / 1000) + finishAfterSeconds;

      const escrowCreate = {
        TransactionType: 'EscrowCreate' as const,
        Account: sourceWallet.address,
        Destination: destination,
        Amount: xrpToDrops(amountXRP),
        FinishAfter: finishAfter,
      };

      const prepared = await client.autofill(escrowCreate);
      const signed = sourceWallet.sign(prepared);
      const result = await client.submitAndWait(signed.tx_blob);

      if (result.result.meta && typeof result.result.meta === 'object' && 'TransactionResult' in result.result.meta) {
        const txResult = result.result.meta.TransactionResult;
        if (txResult === 'tesSUCCESS') {
          logger.info(`XRP Escrow created: ${signed.hash}`);
          return {
            success: true,
            sequence: (prepared as any).Sequence,
            txHash: signed.hash,
          };
        }
      }

      return {
        success: false,
        error: 'Transaction failed',
      };
    } catch (error: any) {
      logger.error('Failed to create XRP escrow:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Finish (release) an XRP escrow
   */
  async finishXRPEscrow(
    executorWallet: Wallet,
    owner: string,
    escrowSequence: number
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const client = await this.ensureConnected();

      const escrowFinish = {
        TransactionType: 'EscrowFinish' as const,
        Account: executorWallet.address,
        Owner: owner,
        OfferSequence: escrowSequence,
      };

      const prepared = await client.autofill(escrowFinish);
      const signed = executorWallet.sign(prepared);
      const result = await client.submitAndWait(signed.tx_blob);

      if (result.result.meta && typeof result.result.meta === 'object' && 'TransactionResult' in result.result.meta) {
        const txResult = result.result.meta.TransactionResult;
        if (txResult === 'tesSUCCESS') {
          logger.info(`XRP Escrow finished: ${signed.hash}`);
          return {
            success: true,
            txHash: signed.hash,
          };
        }
      }

      return {
        success: false,
        error: 'Transaction failed',
      };
    } catch (error: any) {
      logger.error('Failed to finish XRP escrow:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ============================================================
  // VRTY TOKEN DISTRIBUTION (ISSUED CURRENCY)
  // ============================================================

  /**
   * Transfer VRTY tokens (issued currency)
   * Used for scheduled releases from treasury
   */
  async transferVRTY(
    sourceWallet: Wallet,
    destination: string,
    amount: string,
    memo?: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
      const client = await this.ensureConnected();

      const payment: any = {
        TransactionType: 'Payment',
        Account: sourceWallet.address,
        Destination: destination,
        Amount: {
          currency: this.config.currencyCode,
          issuer: this.config.issuerAddress,
          value: amount,
        },
      };

      // Add memo if provided
      if (memo) {
        payment.Memos = [{
          Memo: {
            MemoType: Buffer.from('escrow-release', 'utf8').toString('hex').toUpperCase(),
            MemoData: Buffer.from(memo, 'utf8').toString('hex').toUpperCase(),
          },
        }];
      }

      const prepared = await client.autofill(payment);
      const signed = sourceWallet.sign(prepared);
      const result = await client.submitAndWait(signed.tx_blob);

      if (result.result.meta && typeof result.result.meta === 'object' && 'TransactionResult' in result.result.meta) {
        const txResult = result.result.meta.TransactionResult;
        if (txResult === 'tesSUCCESS') {
          logger.info(`VRTY transferred: ${amount} to ${destination}`);
          return {
            success: true,
            txHash: signed.hash,
          };
        }
      }

      return {
        success: false,
        error: 'Transaction failed',
      };
    } catch (error: any) {
      logger.error('Failed to transfer VRTY:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get VRTY balance for an account
   */
  async getVRTYBalance(account: string): Promise<string> {
    try {
      const client = await this.ensureConnected();

      const response = await client.request({
        command: 'account_lines',
        account,
        peer: this.config.issuerAddress,
      });

      const vrtyLine = response.result.lines.find(
        (line: any) => line.currency === this.config.currencyCode
      );

      return vrtyLine?.balance || '0';
    } catch (error: any) {
      logger.error('Failed to get VRTY balance:', error);
      return '0';
    }
  }

  // ============================================================
  // ESCROW STATUS & TRACKING
  // ============================================================

  /**
   * Get escrow status and statistics
   */
  async getDistributionStatus(): Promise<DistributionStatus> {
    const schedule = this.getReleaseSchedule();
    
    const now = new Date();
    const pending = schedule.entries.filter(e => e.status === 'pending');
    const released = schedule.entries.filter(e => e.status === 'released');
    const cancelled = schedule.entries.filter(e => e.status === 'cancelled');

    // Find next release
    const nextRelease = pending
      .filter(e => new Date(e.releaseDate) > now)
      .sort((a, b) => new Date(a.releaseDate).getTime() - new Date(b.releaseDate).getTime())[0];

    return {
      totalScheduled: schedule.entries.length,
      pendingReleases: pending.length,
      releasedCount: released.length,
      cancelledCount: cancelled.length,
      totalInSchedule: schedule.totalEscrowed,
      totalReleased: schedule.totalReleased,
      nextRelease: nextRelease ? {
        date: nextRelease.releaseDate,
        amount: nextRelease.amount,
      } : undefined,
    };
  }

  /**
   * Get token distribution summary
   */
  getTokenDistribution(): TokenDistribution {
    const allocations: AllocationEntry[] = TOKEN_ALLOCATIONS.map(alloc => ({
      ...alloc,
      released: '0', // TODO: Track actual releases
      remaining: alloc.totalAllocated,
    }));

    return {
      totalSupply: this.config.totalAmount,
      circulatingSupply: '0', // TODO: Calculate from actual data
      inEscrow: this.config.totalAmount,
      allocations,
      updatedAt: new Date().toISOString(),
    };
  }

  // ============================================================
  // RELEASE AUTOMATION
  // ============================================================

  /**
   * Check and execute due releases
   */
  async processScheduledReleases(
    treasuryWallet: Wallet
  ): Promise<{ processed: number; errors: string[] }> {
    const schedule = this.getReleaseSchedule();
    const now = new Date();
    const errors: string[] = [];
    let processed = 0;

    for (const entry of schedule.entries) {
      if (entry.status !== 'pending') continue;
      
      const releaseDate = new Date(entry.releaseDate);
      if (releaseDate > now) continue;

      // Execute release
      const result = await this.transferVRTY(
        treasuryWallet,
        this.config.releaseDestination,
        entry.amount,
        `Scheduled release: Month ${entry.month}`
      );

      if (result.success) {
        entry.status = 'released';
        entry.releaseTxHash = result.txHash;
        processed++;
        
        // Update schedule totals
        const currentReleased = BigInt(schedule.totalReleased);
        const newReleased = currentReleased + BigInt(entry.amount);
        schedule.totalReleased = newReleased.toString();
        
        logger.info(`Released month ${entry.month}: ${entry.amount} VRTY`);
      } else {
        errors.push(`Month ${entry.month}: ${result.error}`);
      }
    }

    // Update next release info
    const nextPending = schedule.entries.find(e => e.status === 'pending');
    if (nextPending) {
      schedule.nextReleaseDate = nextPending.releaseDate;
      schedule.nextReleaseAmount = nextPending.amount;
    }

    schedule.updatedAt = new Date().toISOString();

    return { processed, errors };
  }

  // ============================================================
  // PUBLIC TRANSPARENCY API
  // ============================================================

  /**
   * Get public escrow data (for transparency dashboard)
   */
  getPublicEscrowData(): {
    schedule: ReleaseSchedule;
    distribution: TokenDistribution;
    config: Omit<DistributionConfig, 'escrowAccount'>;
  } {
    return {
      schedule: this.getReleaseSchedule(),
      distribution: this.getTokenDistribution(),
      config: {
        network: this.config.network,
        issuerAddress: this.config.issuerAddress,
        currencyCode: this.config.currencyCode,
        totalAmount: this.config.totalAmount,
        totalMonths: this.config.totalMonths,
        releaseDestination: this.config.releaseDestination,
      },
    };
  }
}

// ============================================================
// SINGLETON INSTANCE
// ============================================================

let tokenDistributionService: TokenDistributionService | null = null;

export function getTokenDistributionService(config?: Partial<DistributionConfig>): TokenDistributionService {
  if (!tokenDistributionService) {
    tokenDistributionService = new TokenDistributionService(config);
  }
  return tokenDistributionService;
}

export default TokenDistributionService;
