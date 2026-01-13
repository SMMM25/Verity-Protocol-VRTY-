/**
 * Verity Protocol - Compliance Module
 * 
 * Exports:
 * - ComplianceOracle: Multi-sig governance for XAO-DOW clawback operations
 */

export {
  ComplianceOracle,
  getComplianceOracle,
  type PublicComment,
  type Dispute,
  type DisputeResolution,
  type ClawbackVote,
  type TransparencyEntry,
  type ComplianceOracleConfig,
} from './ComplianceOracle.js';

// Re-export ClawbackProposal from Prisma types
export type { ClawbackProposal } from '@prisma/client';
