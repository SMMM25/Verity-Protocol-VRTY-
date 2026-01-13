-- Verity Protocol - Initial Database Migration
-- Generated: 2026-01-13
-- This migration creates all tables for the Verity Protocol

-- ============================================================
-- ENUMS
-- ============================================================

-- User & Authentication
CREATE TYPE "KycStatus" AS ENUM ('NONE', 'PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED');

-- Staking
CREATE TYPE "StakingTier" AS ENUM ('NONE', 'BASIC', 'PROFESSIONAL', 'INSTITUTIONAL', 'DEVELOPER');

-- Governance
CREATE TYPE "ProposalCategory" AS ENUM ('FEE_CHANGE', 'CLAWBACK_POLICY', 'ASSET_VERIFICATION', 'TREASURY_ALLOCATION', 'PROTOCOL_UPGRADE', 'PARAMETER_CHANGE', 'EMERGENCY');
CREATE TYPE "ProposalStatus" AS ENUM ('PENDING', 'ACTIVE', 'PASSED', 'FAILED', 'EXECUTED', 'CANCELLED', 'EXPIRED');
CREATE TYPE "VoteType" AS ENUM ('FOR', 'AGAINST', 'ABSTAIN');

-- Guilds
CREATE TYPE "GuildRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');
CREATE TYPE "GuildTransactionType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'FEE_COLLECTION', 'REVENUE_DISTRIBUTION', 'MEMBERSHIP_FEE');

-- Compliance
CREATE TYPE "ClawbackReason" AS ENUM ('REGULATORY_REQUIREMENT', 'COURT_ORDER', 'FRAUD_DETECTION', 'SANCTIONS_COMPLIANCE', 'INVESTOR_PROTECTION', 'ERROR_CORRECTION');
CREATE TYPE "ClawbackStatus" AS ENUM ('COMMENT_PERIOD', 'VOTING', 'APPROVED', 'EXECUTED', 'REJECTED', 'CANCELLED', 'DISPUTED');
CREATE TYPE "DisputeStatus" AS ENUM ('ACTIVE', 'RESOLVED_CLAWBACK_CANCELLED', 'RESOLVED_CLAWBACK_PROCEEDS', 'RESOLVED_PARTIAL', 'STAKE_FORFEITED');

-- Bridge
CREATE TYPE "BridgeDirection" AS ENUM ('XRPL_TO_SOLANA', 'SOLANA_TO_XRPL', 'XRPL_TO_ETHEREUM', 'ETHEREUM_TO_XRPL');
CREATE TYPE "BridgeStatus" AS ENUM ('INITIATED', 'LOCKED', 'VALIDATING', 'MINTING', 'RELEASING', 'COMPLETED', 'FAILED', 'REFUNDED');

-- Signals
CREATE TYPE "SignalType" AS ENUM ('ENDORSEMENT', 'APPRECIATION', 'SUPPORT', 'BOOST', 'TIP');

-- Tax
CREATE TYPE "CostBasisMethod" AS ENUM ('FIFO', 'LIFO', 'HIFO', 'AVERAGE', 'SPECIFIC_ID');
CREATE TYPE "TaxTransactionType" AS ENUM ('BUY', 'SELL', 'TRANSFER', 'DIVIDEND', 'STAKING_REWARD', 'AIRDROP');
CREATE TYPE "TaxCalculationType" AS ENUM ('CAPITAL_GAIN', 'CAPITAL_LOSS', 'DIVIDEND_INCOME', 'INTEREST_INCOME', 'ORDINARY_INCOME', 'GIFT', 'NON_TAXABLE');

-- ============================================================
-- USER & AUTHENTICATION TABLES
-- ============================================================

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "displayName" TEXT,
    "email" TEXT,
    "avatarUrl" TEXT,
    "kycStatus" "KycStatus" NOT NULL DEFAULT 'NONE',
    "kycVerifiedAt" TIMESTAMP(3),
    "jurisdiction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastActiveAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_wallet_key" ON "User"("wallet");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_wallet_idx" ON "User"("wallet");
CREATE INDEX "User_kycStatus_idx" ON "User"("kycStatus");

CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "permissions" TEXT[],
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");
CREATE INDEX "ApiKey_userId_idx" ON "ApiKey"("userId");
CREATE INDEX "ApiKey_prefix_idx" ON "ApiKey"("prefix");

-- ============================================================
-- STAKING TABLES
-- ============================================================

CREATE TABLE "Stake" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "amount" DECIMAL(20,6) NOT NULL,
    "tier" "StakingTier" NOT NULL,
    "lockEndDate" TIMESTAMP(3),
    "lockPeriodDays" INTEGER,
    "rewardsEarned" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "rewardsClaimed" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "lastRewardAt" TIMESTAMP(3),
    "stakeTxHash" TEXT,
    "stakedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "unstakedAt" TIMESTAMP(3),

    CONSTRAINT "Stake_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Stake_userId_wallet_key" ON "Stake"("userId", "wallet");
CREATE INDEX "Stake_wallet_idx" ON "Stake"("wallet");
CREATE INDEX "Stake_tier_idx" ON "Stake"("tier");
CREATE INDEX "Stake_stakedAt_idx" ON "Stake"("stakedAt");

CREATE TABLE "RevenueDistribution" (
    "id" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "totalRevenue" DECIMAL(20,6) NOT NULL,
    "stakerPool" DECIMAL(20,6) NOT NULL,
    "buybackPool" DECIMAL(20,6) NOT NULL,
    "rewardPerToken" DECIMAL(30,12) NOT NULL,
    "totalStaked" DECIMAL(20,6) NOT NULL,
    "stakersCount" INTEGER NOT NULL,
    "transactionHashes" TEXT[],
    "distributedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevenueDistribution_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RevenueDistribution_period_idx" ON "RevenueDistribution"("period");
CREATE INDEX "RevenueDistribution_distributedAt_idx" ON "RevenueDistribution"("distributedAt");

CREATE TABLE "BuybackBurn" (
    "id" TEXT NOT NULL,
    "xrpSpent" DECIMAL(20,6) NOT NULL,
    "vrtyBurned" DECIMAL(20,6) NOT NULL,
    "averagePrice" DECIMAL(20,6) NOT NULL,
    "buybackTxHash" TEXT,
    "burnTxHash" TEXT,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BuybackBurn_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BuybackBurn_executedAt_idx" ON "BuybackBurn"("executedAt");

-- ============================================================
-- GOVERNANCE TABLES
-- ============================================================

CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL,
    "proposerId" TEXT NOT NULL,
    "proposerWallet" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "ProposalCategory" NOT NULL,
    "executionPayload" TEXT,
    "status" "ProposalStatus" NOT NULL DEFAULT 'PENDING',
    "forVotes" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "againstVotes" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "abstainVotes" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "quorumReached" BOOLEAN NOT NULL DEFAULT false,
    "votingStartsAt" TIMESTAMP(3) NOT NULL,
    "votingEndsAt" TIMESTAMP(3) NOT NULL,
    "executedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "executionTxHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Proposal_status_idx" ON "Proposal"("status");
CREATE INDEX "Proposal_category_idx" ON "Proposal"("category");
CREATE INDEX "Proposal_proposerId_idx" ON "Proposal"("proposerId");
CREATE INDEX "Proposal_votingEndsAt_idx" ON "Proposal"("votingEndsAt");

CREATE TABLE "Vote" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "voterId" TEXT NOT NULL,
    "voterWallet" TEXT NOT NULL,
    "support" "VoteType" NOT NULL,
    "voteWeight" DECIMAL(20,6) NOT NULL,
    "reason" TEXT,
    "txHash" TEXT,
    "votedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Vote_proposalId_voterId_key" ON "Vote"("proposalId", "voterId");
CREATE INDEX "Vote_proposalId_idx" ON "Vote"("proposalId");
CREATE INDEX "Vote_voterId_idx" ON "Vote"("voterId");

-- ============================================================
-- GUILD TABLES
-- ============================================================

CREATE TABLE "Guild" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "websiteUrl" TEXT,
    "treasuryWallet" TEXT NOT NULL,
    "treasuryBalance" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "membershipFee" DECIMAL(20,6),
    "minStakeToJoin" DECIMAL(20,6),
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "totalMembers" INTEGER NOT NULL DEFAULT 0,
    "totalRevenue" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "dissolvedAt" TIMESTAMP(3),

    CONSTRAINT "Guild_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Guild_name_key" ON "Guild"("name");
CREATE UNIQUE INDEX "Guild_treasuryWallet_key" ON "Guild"("treasuryWallet");
CREATE INDEX "Guild_ownerId_idx" ON "Guild"("ownerId");
CREATE INDEX "Guild_treasuryWallet_idx" ON "Guild"("treasuryWallet");

CREATE TABLE "GuildMember" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "role" "GuildRole" NOT NULL DEFAULT 'MEMBER',
    "sharePercentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "GuildMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GuildMember_guildId_userId_key" ON "GuildMember"("guildId", "userId");
CREATE INDEX "GuildMember_guildId_idx" ON "GuildMember"("guildId");
CREATE INDEX "GuildMember_userId_idx" ON "GuildMember"("userId");

CREATE TABLE "GuildTransaction" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "type" "GuildTransactionType" NOT NULL,
    "amount" DECIMAL(20,6) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'XRP',
    "fromWallet" TEXT,
    "toWallet" TEXT,
    "description" TEXT,
    "txHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuildTransaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GuildTransaction_guildId_idx" ON "GuildTransaction"("guildId");
CREATE INDEX "GuildTransaction_type_idx" ON "GuildTransaction"("type");
CREATE INDEX "GuildTransaction_createdAt_idx" ON "GuildTransaction"("createdAt");

-- ============================================================
-- COMPLIANCE TABLES
-- ============================================================

CREATE TABLE "ClawbackProposal" (
    "id" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "targetWallet" TEXT NOT NULL,
    "amount" DECIMAL(20,6) NOT NULL,
    "reason" "ClawbackReason" NOT NULL,
    "legalJustification" TEXT NOT NULL,
    "documentationUrls" TEXT[],
    "initiatorWallet" TEXT NOT NULL,
    "status" "ClawbackStatus" NOT NULL DEFAULT 'COMMENT_PERIOD',
    "approveVotes" INTEGER NOT NULL DEFAULT 0,
    "rejectVotes" INTEGER NOT NULL DEFAULT 0,
    "abstainVotes" INTEGER NOT NULL DEFAULT 0,
    "commentPeriodEnds" TIMESTAMP(3) NOT NULL,
    "votingEndsAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),
    "executionTxHash" TEXT,
    "verificationHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClawbackProposal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClawbackProposal_verificationHash_key" ON "ClawbackProposal"("verificationHash");
CREATE INDEX "ClawbackProposal_status_idx" ON "ClawbackProposal"("status");
CREATE INDEX "ClawbackProposal_targetWallet_idx" ON "ClawbackProposal"("targetWallet");
CREATE INDEX "ClawbackProposal_asset_idx" ON "ClawbackProposal"("asset");

CREATE TABLE "ClawbackComment" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "authorWallet" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "supportClawback" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClawbackComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClawbackComment_proposalId_idx" ON "ClawbackComment"("proposalId");

CREATE TABLE "ClawbackDispute" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "filerWallet" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence" TEXT[],
    "stakeAmount" DECIMAL(20,6) NOT NULL,
    "status" "DisputeStatus" NOT NULL DEFAULT 'ACTIVE',
    "resolution" TEXT,
    "resolvedBy" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ClawbackDispute_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClawbackDispute_proposalId_idx" ON "ClawbackDispute"("proposalId");
CREATE INDEX "ClawbackDispute_status_idx" ON "ClawbackDispute"("status");

-- ============================================================
-- BRIDGE TABLES
-- ============================================================

CREATE TABLE "BridgeTransaction" (
    "id" TEXT NOT NULL,
    "direction" "BridgeDirection" NOT NULL,
    "sourceChain" TEXT NOT NULL,
    "destinationChain" TEXT NOT NULL,
    "sourceAddress" TEXT NOT NULL,
    "destinationAddress" TEXT NOT NULL,
    "amount" DECIMAL(20,6) NOT NULL,
    "fee" DECIMAL(20,6) NOT NULL,
    "status" "BridgeStatus" NOT NULL DEFAULT 'INITIATED',
    "sourceTxHash" TEXT,
    "destinationTxHash" TEXT,
    "validatorSignatures" JSONB,
    "verificationHash" TEXT NOT NULL,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "BridgeTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BridgeTransaction_verificationHash_key" ON "BridgeTransaction"("verificationHash");
CREATE INDEX "BridgeTransaction_status_idx" ON "BridgeTransaction"("status");
CREATE INDEX "BridgeTransaction_sourceAddress_idx" ON "BridgeTransaction"("sourceAddress");
CREATE INDEX "BridgeTransaction_destinationAddress_idx" ON "BridgeTransaction"("destinationAddress");
CREATE INDEX "BridgeTransaction_sourceChain_destinationChain_idx" ON "BridgeTransaction"("sourceChain", "destinationChain");

-- ============================================================
-- SIGNALS TABLES
-- ============================================================

CREATE TABLE "ContentNFT" (
    "id" TEXT NOT NULL,
    "tokenId" TEXT NOT NULL,
    "creator" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "uri" TEXT NOT NULL,
    "totalSignals" INTEGER NOT NULL DEFAULT 0,
    "totalValue" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentNFT_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContentNFT_tokenId_key" ON "ContentNFT"("tokenId");
CREATE INDEX "ContentNFT_creator_idx" ON "ContentNFT"("creator");
CREATE INDEX "ContentNFT_contentHash_idx" ON "ContentNFT"("contentHash");
CREATE INDEX "ContentNFT_createdAt_idx" ON "ContentNFT"("createdAt");

CREATE TABLE "Signal" (
    "id" TEXT NOT NULL,
    "sender" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "contentNFTId" TEXT,
    "signalType" "SignalType" NOT NULL,
    "amount" DECIMAL(20,6) NOT NULL,
    "txHash" TEXT,
    "verificationHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Signal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Signal_sender_idx" ON "Signal"("sender");
CREATE INDEX "Signal_recipient_idx" ON "Signal"("recipient");
CREATE INDEX "Signal_contentNFTId_idx" ON "Signal"("contentNFTId");
CREATE INDEX "Signal_createdAt_idx" ON "Signal"("createdAt");

CREATE TABLE "ReputationScore" (
    "id" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "totalSignalsReceived" INTEGER NOT NULL DEFAULT 0,
    "totalSignalsSent" INTEGER NOT NULL DEFAULT 0,
    "totalXRPReceived" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "totalXRPSent" DECIMAL(20,6) NOT NULL DEFAULT 0,
    "reputationScore" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "rank" INTEGER,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReputationScore_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReputationScore_wallet_key" ON "ReputationScore"("wallet");
CREATE INDEX "ReputationScore_reputationScore_idx" ON "ReputationScore"("reputationScore" DESC);
CREATE INDEX "ReputationScore_wallet_idx" ON "ReputationScore"("wallet");

-- ============================================================
-- TAX TABLES
-- ============================================================

CREATE TABLE "TaxProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taxResidence" TEXT NOT NULL,
    "taxId" TEXT,
    "costBasisMethod" "CostBasisMethod" NOT NULL DEFAULT 'FIFO',
    "treatyBenefits" TEXT[],
    "filingStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaxProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TaxProfile_userId_key" ON "TaxProfile"("userId");
CREATE INDEX "TaxProfile_userId_idx" ON "TaxProfile"("userId");
CREATE INDEX "TaxProfile_taxResidence_idx" ON "TaxProfile"("taxResidence");

CREATE TABLE "CostBasisLot" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "amount" DECIMAL(20,6) NOT NULL,
    "costBasis" DECIMAL(20,6) NOT NULL,
    "remainingAmount" DECIMAL(20,6) NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL,
    "txHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CostBasisLot_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CostBasisLot_profileId_idx" ON "CostBasisLot"("profileId");
CREATE INDEX "CostBasisLot_profileId_asset_idx" ON "CostBasisLot"("profileId", "asset");
CREATE INDEX "CostBasisLot_acquiredAt_idx" ON "CostBasisLot"("acquiredAt");

CREATE TABLE "TaxTransaction" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "type" "TaxTransactionType" NOT NULL,
    "asset" TEXT NOT NULL,
    "amount" DECIMAL(20,6) NOT NULL,
    "pricePerUnit" DECIMAL(20,6) NOT NULL,
    "totalValue" DECIMAL(20,6) NOT NULL,
    "fee" DECIMAL(20,6),
    "txHash" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxTransaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TaxTransaction_profileId_idx" ON "TaxTransaction"("profileId");
CREATE INDEX "TaxTransaction_profileId_asset_idx" ON "TaxTransaction"("profileId", "asset");
CREATE INDEX "TaxTransaction_timestamp_idx" ON "TaxTransaction"("timestamp");
CREATE INDEX "TaxTransaction_type_idx" ON "TaxTransaction"("type");

CREATE TABLE "TaxCalculation" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "transactionType" "TaxCalculationType" NOT NULL,
    "proceeds" DECIMAL(20,6) NOT NULL,
    "costBasis" DECIMAL(20,6) NOT NULL,
    "gainLoss" DECIMAL(20,6) NOT NULL,
    "taxableAmount" DECIMAL(20,6) NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL,
    "taxOwed" DECIMAL(20,6) NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "methodology" TEXT NOT NULL,
    "isLongTerm" BOOLEAN NOT NULL DEFAULT false,
    "verificationHash" TEXT NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxCalculation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TaxCalculation_profileId_idx" ON "TaxCalculation"("profileId");
CREATE INDEX "TaxCalculation_jurisdiction_idx" ON "TaxCalculation"("jurisdiction");
CREATE INDEX "TaxCalculation_calculatedAt_idx" ON "TaxCalculation"("calculatedAt");
CREATE INDEX "TaxCalculation_transactionType_idx" ON "TaxCalculation"("transactionType");

CREATE TABLE "TaxReport" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "jurisdiction" TEXT NOT NULL,
    "reportFormat" TEXT NOT NULL,
    "totalGains" DECIMAL(20,6) NOT NULL,
    "totalLosses" DECIMAL(20,6) NOT NULL,
    "netGainLoss" DECIMAL(20,6) NOT NULL,
    "totalTaxOwed" DECIMAL(20,6) NOT NULL,
    "shortTermGains" DECIMAL(20,6) NOT NULL,
    "shortTermLosses" DECIMAL(20,6) NOT NULL,
    "longTermGains" DECIMAL(20,6) NOT NULL,
    "longTermLosses" DECIMAL(20,6) NOT NULL,
    "dividendIncome" DECIMAL(20,6) NOT NULL,
    "stakingIncome" DECIMAL(20,6) NOT NULL,
    "transactionCount" INTEGER NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxReport_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TaxReport_profileId_taxYear_key" ON "TaxReport"("profileId", "taxYear");
CREATE INDEX "TaxReport_profileId_idx" ON "TaxReport"("profileId");
CREATE INDEX "TaxReport_taxYear_idx" ON "TaxReport"("taxYear");

CREATE TABLE "TaxAuditEntry" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "entryType" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "verificationHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaxAuditEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TaxAuditEntry_profileId_idx" ON "TaxAuditEntry"("profileId");
CREATE INDEX "TaxAuditEntry_entryType_idx" ON "TaxAuditEntry"("entryType");
CREATE INDEX "TaxAuditEntry_createdAt_idx" ON "TaxAuditEntry"("createdAt");

-- ============================================================
-- AUDIT LOG TABLE
-- ============================================================

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX "AuditLog_actor_idx" ON "AuditLog"("actor");
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- ============================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================

-- ApiKey
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Stake
ALTER TABLE "Stake" ADD CONSTRAINT "Stake_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Proposal
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_proposerId_fkey" FOREIGN KEY ("proposerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Vote
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_voterId_fkey" FOREIGN KEY ("voterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Guild
ALTER TABLE "Guild" ADD CONSTRAINT "Guild_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- GuildMember
ALTER TABLE "GuildMember" ADD CONSTRAINT "GuildMember_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuildMember" ADD CONSTRAINT "GuildMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- GuildTransaction
ALTER TABLE "GuildTransaction" ADD CONSTRAINT "GuildTransaction_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ClawbackComment
ALTER TABLE "ClawbackComment" ADD CONSTRAINT "ClawbackComment_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "ClawbackProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ClawbackDispute
ALTER TABLE "ClawbackDispute" ADD CONSTRAINT "ClawbackDispute_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "ClawbackProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Signal
ALTER TABLE "Signal" ADD CONSTRAINT "Signal_contentNFTId_fkey" FOREIGN KEY ("contentNFTId") REFERENCES "ContentNFT"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- TaxProfile relations
ALTER TABLE "CostBasisLot" ADD CONSTRAINT "CostBasisLot_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TaxProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaxTransaction" ADD CONSTRAINT "TaxTransaction_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TaxProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaxCalculation" ADD CONSTRAINT "TaxCalculation_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TaxProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaxReport" ADD CONSTRAINT "TaxReport_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TaxProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaxAuditEntry" ADD CONSTRAINT "TaxAuditEntry_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "TaxProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
