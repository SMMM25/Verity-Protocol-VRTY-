/**
 * Verity Protocol - Circuit Breaker
 * 
 * @module relayer/guards/CircuitBreaker
 * @description Treasury protection mechanism to prevent drain attacks.
 * Implements automatic shutdown when anomalies are detected.
 */

import { EventEmitter } from 'events';
import { logger } from '../../utils/logger.js';
import { RELAYER_CONFIG, TreasuryHealth } from '../types.js';

/**
 * Circuit breaker states
 */
export enum CircuitState {
  /** Normal operation */
  CLOSED = 'CLOSED',
  /** Monitoring for recovery */
  HALF_OPEN = 'HALF_OPEN',
  /** Service blocked */
  OPEN = 'OPEN'
}

/**
 * Trip reason categories
 */
export enum TripReason {
  /** Too many transactions in short period */
  HIGH_VELOCITY = 'HIGH_VELOCITY',
  /** Treasury balance critically low */
  LOW_BALANCE = 'LOW_BALANCE',
  /** Error rate too high */
  HIGH_ERROR_RATE = 'HIGH_ERROR_RATE',
  /** Suspicious activity detected */
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  /** Manual trip by admin */
  MANUAL = 'MANUAL'
}

/**
 * Circuit breaker configuration
 */
interface CircuitBreakerConfig {
  /** Threshold for velocity (tx per minute) */
  velocityThreshold: number;
  /** Error rate threshold (percentage) */
  errorRateThreshold: number;
  /** Time window for error rate calculation (ms) */
  errorWindowMs: number;
  /** Time to wait before attempting recovery (ms) */
  recoveryTimeMs: number;
  /** Minimum balance before trip (XRP) */
  minBalanceXRP: number;
  /** Number of test requests in half-open state */
  halfOpenTestRequests: number;
}

/**
 * Transaction record for velocity tracking
 */
interface TransactionRecord {
  timestamp: Date;
  success: boolean;
  walletAddress: string;
  feeDrops: string;
}

/**
 * Circuit Breaker
 * 
 * Protects the relayer treasury from drain attacks and anomalies.
 * Features:
 * - Velocity monitoring (tx/minute)
 * - Error rate tracking
 * - Balance threshold monitoring
 * - Automatic trip and recovery
 * - Admin manual controls
 */
export class CircuitBreaker extends EventEmitter {
  private state: CircuitState = CircuitState.CLOSED;
  private tripReason: TripReason | null = null;
  private tripTimestamp: Date | null = null;
  private lastRecoveryAttempt: Date | null = null;
  
  private transactions: TransactionRecord[] = [];
  private halfOpenSuccessCount: number = 0;
  
  private config: CircuitBreakerConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    super();
    
    this.config = {
      velocityThreshold: RELAYER_CONFIG.antiAbuse.maxTransactionsPerMinute,
      errorRateThreshold: 30, // 30% error rate
      errorWindowMs: 60000,   // 1 minute window
      recoveryTimeMs: 300000, // 5 minutes before recovery attempt
      minBalanceXRP: 100,     // Critical balance threshold
      halfOpenTestRequests: 5,
      ...config
    };

    // Start cleanup interval
    this.startCleanup();
  }

  /**
   * Check if a request is allowed
   */
  canProceed(): { allowed: boolean; state: CircuitState; reason?: string } {
    switch (this.state) {
      case CircuitState.CLOSED:
        return { allowed: true, state: this.state };

      case CircuitState.OPEN:
        // Check if recovery time has passed
        if (this.tripTimestamp && 
            Date.now() - this.tripTimestamp.getTime() >= this.config.recoveryTimeMs) {
          this.transitionToHalfOpen();
          return { 
            allowed: true, 
            state: CircuitState.HALF_OPEN,
            reason: 'Testing recovery'
          };
        }
        return { 
          allowed: false, 
          state: this.state,
          reason: `Circuit open: ${this.tripReason}`
        };

      case CircuitState.HALF_OPEN:
        // Allow limited requests for testing
        if (this.halfOpenSuccessCount < this.config.halfOpenTestRequests) {
          return { 
            allowed: true, 
            state: this.state,
            reason: 'Testing recovery'
          };
        }
        // If we've had enough successes, close the circuit
        this.close();
        return { allowed: true, state: CircuitState.CLOSED };

      default:
        return { allowed: false, state: this.state, reason: 'Unknown state' };
    }
  }

  /**
   * Record a transaction (success or failure)
   */
  recordTransaction(
    success: boolean,
    walletAddress: string,
    feeDrops: string
  ): void {
    const record: TransactionRecord = {
      timestamp: new Date(),
      success,
      walletAddress,
      feeDrops
    };

    this.transactions.push(record);

    // Update half-open counter
    if (this.state === CircuitState.HALF_OPEN && success) {
      this.halfOpenSuccessCount++;
      
      if (this.halfOpenSuccessCount >= this.config.halfOpenTestRequests) {
        logger.info('Circuit breaker: Recovery successful');
        this.close();
      }
    }

    // Check for trip conditions
    this.checkTripConditions();
  }

  /**
   * Check if circuit should trip
   */
  private checkTripConditions(): void {
    if (this.state !== CircuitState.CLOSED) {
      return;
    }

    // Check velocity
    const recentTx = this.getRecentTransactions(60000);
    if (recentTx.length > this.config.velocityThreshold) {
      this.trip(TripReason.HIGH_VELOCITY);
      return;
    }

    // Check error rate
    const errorRate = this.calculateErrorRate();
    if (errorRate > this.config.errorRateThreshold) {
      this.trip(TripReason.HIGH_ERROR_RATE);
      return;
    }

    // Check for suspicious patterns
    if (this.detectSuspiciousActivity()) {
      this.trip(TripReason.SUSPICIOUS_ACTIVITY);
      return;
    }
  }

  /**
   * Check treasury health and trip if critical
   */
  checkTreasuryHealth(health: TreasuryHealth, balanceXRP: number): void {
    if (health === TreasuryHealth.CRITICAL || balanceXRP < this.config.minBalanceXRP) {
      this.trip(TripReason.LOW_BALANCE);
    }
  }

  /**
   * Trip the circuit breaker
   */
  trip(reason: TripReason): void {
    if (this.state === CircuitState.OPEN) {
      return; // Already tripped
    }

    this.state = CircuitState.OPEN;
    this.tripReason = reason;
    this.tripTimestamp = new Date();

    logger.error('Circuit breaker TRIPPED', {
      reason,
      timestamp: this.tripTimestamp,
      recentTxCount: this.transactions.length,
      errorRate: this.calculateErrorRate()
    });

    this.emit('trip', {
      reason,
      timestamp: this.tripTimestamp,
      state: this.state
    });
  }

  /**
   * Manually trip the circuit (admin action)
   */
  manualTrip(adminId: string, reason?: string): void {
    logger.warn('Circuit breaker manually tripped', { adminId, reason });
    this.trip(TripReason.MANUAL);
    
    this.emit('manualTrip', {
      adminId,
      reason: reason || 'Manual admin action',
      timestamp: new Date()
    });
  }

  /**
   * Transition to half-open state
   */
  private transitionToHalfOpen(): void {
    this.state = CircuitState.HALF_OPEN;
    this.halfOpenSuccessCount = 0;
    this.lastRecoveryAttempt = new Date();

    logger.info('Circuit breaker: Attempting recovery (half-open)');

    this.emit('halfOpen', {
      tripReason: this.tripReason,
      tripDuration: Date.now() - (this.tripTimestamp?.getTime() || 0)
    });
  }

  /**
   * Close the circuit (resume normal operation)
   */
  close(): void {
    const previousState = this.state;
    const previousReason = this.tripReason;

    this.state = CircuitState.CLOSED;
    this.tripReason = null;
    this.tripTimestamp = null;
    this.halfOpenSuccessCount = 0;

    logger.info('Circuit breaker: CLOSED (normal operation)', {
      previousState,
      previousReason
    });

    this.emit('close', {
      previousState,
      previousReason,
      timestamp: new Date()
    });
  }

  /**
   * Manually reset the circuit (admin action)
   */
  manualReset(adminId: string): void {
    logger.warn('Circuit breaker manually reset', { adminId });
    this.close();
    this.transactions = []; // Clear history
    
    this.emit('manualReset', {
      adminId,
      timestamp: new Date()
    });
  }

  /**
   * Get recent transactions within time window
   */
  private getRecentTransactions(windowMs: number): TransactionRecord[] {
    const cutoff = Date.now() - windowMs;
    return this.transactions.filter(tx => tx.timestamp.getTime() >= cutoff);
  }

  /**
   * Calculate error rate in the current window
   */
  private calculateErrorRate(): number {
    const recent = this.getRecentTransactions(this.config.errorWindowMs);
    if (recent.length === 0) return 0;
    
    const failures = recent.filter(tx => !tx.success).length;
    return (failures / recent.length) * 100;
  }

  /**
   * Detect suspicious activity patterns
   */
  private detectSuspiciousActivity(): boolean {
    const recent = this.getRecentTransactions(60000);
    if (recent.length < 10) return false;

    // Pattern 1: Single wallet flooding
    const walletCounts = new Map<string, number>();
    for (const tx of recent) {
      walletCounts.set(tx.walletAddress, (walletCounts.get(tx.walletAddress) || 0) + 1);
    }

    for (const [wallet, count] of walletCounts) {
      // More than 50% of traffic from single wallet
      if (count > recent.length * 0.5) {
        logger.warn('Suspicious activity: Single wallet flooding', {
          wallet,
          count,
          total: recent.length
        });
        return true;
      }
    }

    // Pattern 2: Rapid sequential failures
    let consecutiveFailures = 0;
    for (let i = recent.length - 1; i >= 0; i--) {
      const tx = recent[i];
      if (tx && !tx.success) {
        consecutiveFailures++;
        if (consecutiveFailures >= 10) {
          logger.warn('Suspicious activity: Consecutive failures', {
            count: consecutiveFailures
          });
          return true;
        }
      } else {
        break;
      }
    }

    return false;
  }

  /**
   * Get current circuit state
   */
  getState(): {
    state: CircuitState;
    tripReason: TripReason | null;
    tripTimestamp: Date | null;
    errorRate: number;
    velocity: number;
    metrics: {
      totalTransactions: number;
      recentTransactions: number;
      recentFailures: number;
    };
  } {
    const recent = this.getRecentTransactions(60000);
    const failures = recent.filter(tx => !tx.success);

    return {
      state: this.state,
      tripReason: this.tripReason,
      tripTimestamp: this.tripTimestamp,
      errorRate: this.calculateErrorRate(),
      velocity: recent.length,
      metrics: {
        totalTransactions: this.transactions.length,
        recentTransactions: recent.length,
        recentFailures: failures.length
      }
    };
  }

  /**
   * Start cleanup interval to remove old records
   */
  private startCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const cutoff = Date.now() - (this.config.errorWindowMs * 2);
      this.transactions = this.transactions.filter(
        tx => tx.timestamp.getTime() >= cutoff
      );
    }, 60000); // Clean up every minute
  }

  /**
   * Shutdown and cleanup
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.transactions = [];
    logger.info('Circuit breaker shut down');
  }
}

// Export singleton instance
export const circuitBreaker = new CircuitBreaker();
