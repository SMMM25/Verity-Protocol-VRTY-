/**
 * Verity Protocol - VRTY Token (Database-backed)
 * 
 * Production-ready token manager using PostgreSQL instead of in-memory storage.
 * Replaces Map() storage with Prisma database queries.
 */

import { Wallet, Payment, TrustSet, OfferCreate } from 'xrpl';
import { EventEmitter } from 'eventemitter3';
import { XRPLClient, TransactionResult } from '../core/XRPLClient.js';
import { logger, logAuditAction } from '../utils/logger.js';
import { generateId, encodeMemoData } from '../utils/crypto.js';
import { stakeRepository, calculateTier } from '../db/repositories/stakeRepository.js';
import { proposalRepository } from '../db/repositories/proposalRepository.js';
import { prisma, checkDatabaseHealth } from '../db/client.js';
import type {
  VRTYStake,
  StakingTier,
  StakingTierConfig,
  FeeCalculation,
  GovernanceVote,
  GovernanceProposal,
  ProposalCategory,
} from '../types/index.js';
import type { 
  Stake, 
  Proposal, 
  StakingTier as PrismaStakingTier,
  ProposalCategory as PrismaProposalCategory,
  VoteType,
} from '@prisma/client';

// VRTY Token Configuration
const VRTY_CURRENCY_CODE = 'VRTY';
const VRTY_TOTAL_SUPPLY = '1000000000'; // 1 billion tokens
const VRTY_DECIMALS = 6;

// Staking Tier Configurations
const STAKING_TIERS: StakingTierConfig[] = [
  {
    tier: 'BASIC',
    minStake: '1000',
    feeDiscount: 2500, // 25%
    features: ['Advanced portfolio analytics', 'Tax optimization', 'Priority support'],
  },
  {
    tier: 'PROFESSIONAL',
    minStake: '10000',
    feeDiscount: 5000, // 50%
    features: ['Guild creation', 'Advanced API access', 'White-label options', 'All Basic features'],
  },
  {
    tier: 'INSTITUTIONAL',
    minStake: '50000',
    feeDiscount: 7500, // 75%
    features: ['Asset tokenization', 'Regulatory dashboard', 'Dedicated management', 'All Professional features'],
  },
  {
    tier: 'DEVELOPER',
    minStake: '5000',
    feeDiscount: 5000, // 50%
    features: ['Full API access', 'Webhooks', 'Beta features', 'Developer support'],
  },
];

// Fee Structure
const BASE_FEES = {
  DEX_TRADE: 10, // 0.10% = 10 basis points
  ASSET_TOKENIZATION: 25, // 0.25%
  SIGNAL_SEND: 5, // 0.05%
  GUILD_OPERATION: 15, // 0.15%
};

export interface StakeInfo {
  wallet: string;
  amount: string;
  tier: StakingTier;
  stakedAt: Date;
  lockEndDate?: Date;
  rewardsEarned: string;
  rewardsClaimed: string;
}

export interface RevenueDistribution {
  id: string;
  period: string;
  totalRevenue: string;
  stakerPool: string; // 80%
  buybackPool: string; // 20%
  rewardPerToken: string;
  distributedAt: Date;
  transactionHashes: string[];
}

export interface BuybackBurn {
  id: string;
  amount: string;
  averagePrice: string;
  burnTransactionHash: string;
  executedAt: Date;
}

/**
 * Convert Prisma Stake to VRTYStake type
 */
function stakeToVRTYStake(stake: Stake): VRTYStake {
  return {
    wallet: stake.wallet,
    stakedAmount: Number(stake.amount).toString(),
    stakingTier: stake.tier as StakingTier,
    rewardsEarned: Number(stake.rewardsEarned).toString(),
    rewardsClaimed: Number(stake.rewardsClaimed).toString(),
    stakedAt: stake.stakedAt,
    lockEndDate: stake.lockEndDate || undefined,
  };
}

/**
 * Convert Prisma Proposal to GovernanceProposal type
 */
function proposalToGovernanceProposal(proposal: Proposal): GovernanceProposal {
  return {
    id: proposal.id,
    proposer: proposal.proposerWallet,
    title: proposal.title,
    description: proposal.description,
    category: proposal.category as ProposalCategory,
    forVotes: Number(proposal.forVotes).toString(),
    againstVotes: Number(proposal.againstVotes).toString(),
    status: proposal.status as GovernanceProposal['status'],
    executionPayload: proposal.executionPayload || undefined,
    createdAt: proposal.createdAt,
    votingEndsAt: proposal.votingEndsAt,
    executedAt: proposal.executedAt || undefined,
  };
}

/**
 * VRTY Token Manager (Database-backed)
 * Handles all token operations, staking, and governance using PostgreSQL
 */
export class VRTYTokenManagerDB extends EventEmitter {
  private xrplClient: XRPLClient;
  private issuerWallet: Wallet;
  private dbAvailable: boolean = false;

  constructor(xrplClient: XRPLClient, issuerWallet: Wallet) {
    super();
    this.xrplClient = xrplClient;
    this.issuerWallet = issuerWallet;
    this.initializeDatabase();
    logger.info('VRTY Token Manager (DB) initialized');
  }

  /**
   * Initialize database connection check
   */
  private async initializeDatabase(): Promise<void> {
    try {
      const health = await checkDatabaseHealth();
      this.dbAvailable = health.connected;
      if (health.connected) {
        logger.info('VRTY Token Manager: Database connected', { latency: health.latency });
      } else {
        logger.warn('VRTY Token Manager: Database not available, some features disabled', { 
          error: health.error 
        });
      }
    } catch (error) {
      this.dbAvailable = false;
      logger.warn('VRTY Token Manager: Database connection failed', { error });
    }
  }

  /**
   * Check if database is available
   */
  isDatabaseAvailable(): boolean {
    return this.dbAvailable;
  }

  /**
   * Get VRTY token information
   */
  async getTokenInfo(): Promise<Record<string, unknown>> {
    let totalStaked = '0';
    let totalBurned = '0';
    
    if (this.dbAvailable) {
      try {
        totalStaked = (await stakeRepository.getTotalStaked()).toString();
        // Get burned from buyback burns table
        const burns = await prisma.buybackBurn.aggregate({
          _sum: { vrtyBurned: true },
        });
        totalBurned = Number(burns._sum?.vrtyBurned || 0).toString();
      } catch (error) {
        logger.error('Failed to fetch token metrics from DB', { error });
      }
    }

    const totalSupplyBigInt = BigInt(VRTY_TOTAL_SUPPLY) * BigInt(10 ** VRTY_DECIMALS);
    const burnedBigInt = BigInt(Math.floor(parseFloat(totalBurned) * 10 ** VRTY_DECIMALS));
    const circulatingSupply = ((totalSupplyBigInt - burnedBigInt) / BigInt(10 ** VRTY_DECIMALS)).toString();

    return {
      name: 'Verity Protocol Token',
      symbol: VRTY_CURRENCY_CODE,
      issuer: this.issuerWallet.address,
      totalSupply: VRTY_TOTAL_SUPPLY,
      circulatingSupply,
      totalStaked,
      totalBurned,
      decimals: VRTY_DECIMALS,
      databaseConnected: this.dbAvailable,
    };
  }

  /**
   * Create trust line for VRTY token
   */
  async createVRTYTrustLine(
    holderWallet: Wallet,
    limit: string = '1000000000'
  ): Promise<TransactionResult> {
    logger.info(`Creating VRTY trust line for ${holderWallet.address}`);

    const trustSetTx: TrustSet = {
      TransactionType: 'TrustSet',
      Account: holderWallet.address,
      LimitAmount: {
        currency: VRTY_CURRENCY_CODE,
        issuer: this.issuerWallet.address,
        value: limit,
      },
    };

    const result = await this.xrplClient.submitAndWait(trustSetTx, holderWallet);

    if (result.success) {
      logAuditAction('VRTY_TRUSTLINE_CREATED', holderWallet.address, {
        limit,
        transactionHash: result.hash,
      });
    }

    return result;
  }

  /**
   * Transfer VRTY tokens
   */
  async transferVRTY(
    toAddress: string,
    amount: string,
    memo?: string
  ): Promise<TransactionResult> {
    logger.info(`Transferring ${amount} VRTY to ${toAddress}`);

    const paymentTx: Payment = {
      TransactionType: 'Payment',
      Account: this.issuerWallet.address,
      Destination: toAddress,
      Amount: {
        currency: VRTY_CURRENCY_CODE,
        issuer: this.issuerWallet.address,
        value: amount,
      },
      Memos: memo
        ? [
            {
              Memo: {
                MemoType: Buffer.from('VRTY_TRANSFER').toString('hex').toUpperCase(),
                MemoData: Buffer.from(memo).toString('hex').toUpperCase(),
                MemoFormat: Buffer.from('text/plain').toString('hex').toUpperCase(),
              },
            },
          ]
        : undefined,
    };

    return this.xrplClient.submitAndWait(paymentTx, this.issuerWallet);
  }

  // ===========================================
  // Staking Functions (Database-backed)
  // ===========================================

  /**
   * Stake VRTY tokens (persisted to database)
   */
  async stakeVRTY(
    wallet: Wallet,
    amount: string,
    lockPeriodDays?: number,
    userId?: string
  ): Promise<{ stake: VRTYStake; result: TransactionResult }> {
    logger.info(`Staking ${amount} VRTY from ${wallet.address}`);

    // Transfer tokens to staking contract (issuer)
    const paymentTx: Payment = {
      TransactionType: 'Payment',
      Account: wallet.address,
      Destination: this.issuerWallet.address,
      Amount: {
        currency: VRTY_CURRENCY_CODE,
        issuer: this.issuerWallet.address,
        value: amount,
      },
      Memos: [
        {
          Memo: {
            MemoType: Buffer.from('VRTY_STAKE').toString('hex').toUpperCase(),
            MemoData: encodeMemoData({
              action: 'STAKE',
              lockPeriodDays,
            }),
            MemoFormat: Buffer.from('application/json').toString('hex').toUpperCase(),
          },
        },
      ],
    };

    const result = await this.xrplClient.submitAndWait(paymentTx, wallet);

    if (!result.success) {
      throw new Error(`Staking failed: ${result.error}`);
    }

    // Persist to database
    const effectiveUserId = userId || wallet.address;
    const dbStake = await stakeRepository.upsertStake({
      userId: effectiveUserId,
      wallet: wallet.address,
      amount: parseFloat(amount),
      lockPeriodDays,
      stakeTxHash: result.hash,
    });

    const stake = stakeToVRTYStake(dbStake);

    logAuditAction('VRTY_STAKED', wallet.address, {
      amount,
      newTotalStaked: stake.stakedAmount,
      tier: stake.stakingTier,
      transactionHash: result.hash,
      persistedToDb: true,
    });

    this.emit('staked', stake);

    return { stake, result };
  }

  /**
   * Unstake VRTY tokens (updates database)
   */
  async unstakeVRTY(
    wallet: Wallet,
    amount: string,
    userId?: string
  ): Promise<{ stake: VRTYStake | null; result: TransactionResult }> {
    const effectiveUserId = userId || wallet.address;
    
    // Get current stake from database
    const dbStake = await stakeRepository.getByWallet(wallet.address);
    if (!dbStake) {
      throw new Error('No stake found');
    }

    // Check lock period
    if (dbStake.lockEndDate && new Date() < dbStake.lockEndDate) {
      throw new Error(`Stake is locked until ${dbStake.lockEndDate.toISOString()}`);
    }

    // Check sufficient amount
    if (Number(dbStake.amount) < parseFloat(amount)) {
      throw new Error('Insufficient staked amount');
    }

    logger.info(`Unstaking ${amount} VRTY for ${wallet.address}`);

    // Transfer tokens back to user
    const paymentTx: Payment = {
      TransactionType: 'Payment',
      Account: this.issuerWallet.address,
      Destination: wallet.address,
      Amount: {
        currency: VRTY_CURRENCY_CODE,
        issuer: this.issuerWallet.address,
        value: amount,
      },
      Memos: [
        {
          Memo: {
            MemoType: Buffer.from('VRTY_UNSTAKE').toString('hex').toUpperCase(),
            MemoData: encodeMemoData({
              action: 'UNSTAKE',
              previousTier: dbStake.tier,
            }),
            MemoFormat: Buffer.from('application/json').toString('hex').toUpperCase(),
          },
        },
      ],
    };

    const result = await this.xrplClient.submitAndWait(paymentTx, this.issuerWallet);

    if (!result.success) {
      throw new Error(`Unstaking failed: ${result.error}`);
    }

    // Update database
    const updatedStake = await stakeRepository.reduceStake({
      userId: effectiveUserId,
      wallet: wallet.address,
      amount: parseFloat(amount),
    });

    if (!updatedStake || Number(updatedStake.amount) <= 0) {
      logAuditAction('VRTY_UNSTAKED_FULL', wallet.address, {
        amount,
        transactionHash: result.hash,
      });
      return { stake: null, result };
    }

    const stake = stakeToVRTYStake(updatedStake);

    logAuditAction('VRTY_UNSTAKED', wallet.address, {
      amount,
      remainingStake: stake.stakedAmount,
      newTier: stake.stakingTier,
      transactionHash: result.hash,
    });

    this.emit('unstaked', { wallet: wallet.address, amount });

    return { stake, result };
  }

  /**
   * Claim staking rewards
   */
  async claimRewards(wallet: Wallet, userId?: string): Promise<TransactionResult> {
    const effectiveUserId = userId || wallet.address;
    
    // Get unclaimed rewards from database
    const dbStake = await stakeRepository.getByWallet(wallet.address);
    if (!dbStake) {
      throw new Error('No stake found');
    }

    const unclaimedRewards = Number(dbStake.rewardsEarned) - Number(dbStake.rewardsClaimed);

    if (unclaimedRewards <= 0) {
      throw new Error('No rewards to claim');
    }

    logger.info(`Claiming ${unclaimedRewards} VRTY rewards for ${wallet.address}`);

    const paymentTx: Payment = {
      TransactionType: 'Payment',
      Account: this.issuerWallet.address,
      Destination: wallet.address,
      Amount: {
        currency: VRTY_CURRENCY_CODE,
        issuer: this.issuerWallet.address,
        value: unclaimedRewards.toString(),
      },
      Memos: [
        {
          Memo: {
            MemoType: Buffer.from('VRTY_REWARD_CLAIM').toString('hex').toUpperCase(),
            MemoData: encodeMemoData({ action: 'CLAIM_REWARDS' }),
            MemoFormat: Buffer.from('application/json').toString('hex').toUpperCase(),
          },
        },
      ],
    };

    const result = await this.xrplClient.submitAndWait(paymentTx, this.issuerWallet);

    if (result.success) {
      // Update database
      await stakeRepository.claimRewards(effectiveUserId, wallet.address);

      logAuditAction('VRTY_REWARDS_CLAIMED', wallet.address, {
        amount: unclaimedRewards,
        transactionHash: result.hash,
      });

      this.emit('rewardsClaimed', { wallet: wallet.address, amount: unclaimedRewards });
    }

    return result;
  }

  // ===========================================
  // Fee Calculation Functions
  // ===========================================

  /**
   * Calculate fees with VRTY discount (database lookup for tier)
   */
  async calculateFee(
    feeType: keyof typeof BASE_FEES,
    amount: string,
    payerWallet: string,
    payWithVRTY: boolean
  ): Promise<FeeCalculation> {
    const baseFeeRate = BASE_FEES[feeType];
    const baseFee = (parseFloat(amount) * baseFeeRate) / 10000;

    // Get staker discount from database
    let discountRate = 0;

    if (this.dbAvailable) {
      try {
        const tier = await stakeRepository.getUserTier(payerWallet);
        const tierConfig = STAKING_TIERS.find((t) => t.tier === tier);
        if (tierConfig) {
          discountRate = tierConfig.feeDiscount;
        }
      } catch (error) {
        logger.warn('Failed to get user tier from DB', { error, wallet: payerWallet });
      }
    }

    // Additional discount for paying in VRTY
    if (payWithVRTY) {
      discountRate = Math.min(discountRate + 2500, 7500); // Max 75% discount
    }

    const vrtyDiscount = (baseFee * discountRate) / 10000;
    const finalFee = baseFee - vrtyDiscount;

    return {
      baseFee: baseFee.toFixed(6),
      vrtyDiscount: vrtyDiscount.toFixed(6),
      finalFee: finalFee.toFixed(6),
      paidInVRTY: payWithVRTY,
    };
  }

  /**
   * Pay platform fee in VRTY
   */
  async payFeeInVRTY(
    payer: Wallet,
    feeType: keyof typeof BASE_FEES,
    amount: string
  ): Promise<TransactionResult> {
    const feeCalc = await this.calculateFee(feeType, amount, payer.address, true);

    logger.info(`Paying ${feeCalc.finalFee} VRTY fee for ${feeType}`);

    const paymentTx: Payment = {
      TransactionType: 'Payment',
      Account: payer.address,
      Destination: this.issuerWallet.address,
      Amount: {
        currency: VRTY_CURRENCY_CODE,
        issuer: this.issuerWallet.address,
        value: feeCalc.finalFee,
      },
      Memos: [
        {
          Memo: {
            MemoType: Buffer.from('VRTY_FEE_PAYMENT').toString('hex').toUpperCase(),
            MemoData: encodeMemoData({
              feeType,
              originalAmount: amount,
              baseFee: feeCalc.baseFee,
              discount: feeCalc.vrtyDiscount,
            }),
            MemoFormat: Buffer.from('application/json').toString('hex').toUpperCase(),
          },
        },
      ],
    };

    return this.xrplClient.submitAndWait(paymentTx, payer);
  }

  // ===========================================
  // Governance Functions (Database-backed)
  // ===========================================

  /**
   * Create a governance proposal (persisted to database)
   */
  async createProposal(
    proposer: string,
    title: string,
    description: string,
    category: ProposalCategory,
    executionPayload?: string,
    userId?: string
  ): Promise<GovernanceProposal> {
    const effectiveUserId = userId || proposer;
    
    // Check if proposer has enough stake
    const stake = await stakeRepository.getByWallet(proposer);
    if (!stake) {
      throw new Error('Must be a staker to create proposals');
    }

    const minStakeForProposal = 10000; // 10,000 VRTY
    if (Number(stake.amount) < minStakeForProposal) {
      throw new Error(`Minimum ${minStakeForProposal} VRTY staked required to create proposals`);
    }

    // Create proposal in database
    const dbProposal = await proposalRepository.create({
      proposerId: effectiveUserId,
      proposerWallet: proposer,
      title,
      description,
      category: category as PrismaProposalCategory,
      executionPayload,
    });

    const proposal = proposalToGovernanceProposal(dbProposal);

    logAuditAction('GOVERNANCE_PROPOSAL_CREATED', proposer, {
      proposalId: proposal.id,
      title,
      category,
      persistedToDb: true,
    });

    this.emit('proposalCreated', proposal);

    return proposal;
  }

  /**
   * Vote on a proposal (persisted to database)
   */
  async voteOnProposal(
    voter: Wallet,
    proposalId: string,
    support: boolean,
    userId?: string
  ): Promise<{ vote: GovernanceVote; result: TransactionResult }> {
    const effectiveUserId = userId || voter.address;

    // Check if voter has stake
    const stake = await stakeRepository.getByWallet(voter.address);
    if (!stake) {
      throw new Error('Must be a staker to vote');
    }

    // Check if already voted
    const hasVoted = await proposalRepository.hasVoted(proposalId, effectiveUserId);
    if (hasVoted) {
      throw new Error('Already voted on this proposal');
    }

    logger.info(`Voting on proposal ${proposalId}: ${support ? 'FOR' : 'AGAINST'}`);

    // Record vote on-chain
    const paymentTx: Payment = {
      TransactionType: 'Payment',
      Account: voter.address,
      Destination: this.issuerWallet.address,
      Amount: '1', // Dust payment to record vote
      Memos: [
        {
          Memo: {
            MemoType: Buffer.from('VRTY_GOVERNANCE_VOTE').toString('hex').toUpperCase(),
            MemoData: encodeMemoData({
              proposalId,
              support,
              voteWeight: Number(stake.amount).toString(),
            }),
            MemoFormat: Buffer.from('application/json').toString('hex').toUpperCase(),
          },
        },
      ],
    };

    const result = await this.xrplClient.submitAndWait(paymentTx, voter);

    if (!result.success) {
      throw new Error(`Vote transaction failed: ${result.error}`);
    }

    // Record vote in database
    const voteType: VoteType = support ? 'FOR' : 'AGAINST';
    const dbVote = await proposalRepository.vote({
      proposalId,
      voterId: effectiveUserId,
      voterWallet: voter.address,
      support: voteType,
      voteWeight: Number(stake.amount),
      txHash: result.hash,
    });

    const vote: GovernanceVote = {
      proposalId,
      voter: voter.address,
      voteWeight: Number(stake.amount).toString(),
      support,
      timestamp: dbVote.votedAt,
      transactionHash: result.hash,
    };

    // Update proposal status if needed
    const totalStaked = await stakeRepository.getTotalStaked();
    await proposalRepository.updateStatus(proposalId, totalStaked);

    logAuditAction('GOVERNANCE_VOTE', voter.address, {
      proposalId,
      support,
      voteWeight: Number(stake.amount).toString(),
      transactionHash: result.hash,
      persistedToDb: true,
    });

    this.emit('voted', vote);

    return { vote, result };
  }

  /**
   * Execute a passed proposal
   */
  async executeProposal(proposalId: string): Promise<GovernanceProposal> {
    const dbProposal = await proposalRepository.execute(proposalId);
    const proposal = proposalToGovernanceProposal(dbProposal);

    logAuditAction('GOVERNANCE_PROPOSAL_EXECUTED', 'SYSTEM', {
      proposalId,
      category: proposal.category,
    });

    this.emit('proposalExecuted', proposal);

    return proposal;
  }

  // ===========================================
  // Revenue Distribution Functions
  // ===========================================

  /**
   * Distribute protocol revenue to stakers
   */
  async distributeRevenue(totalRevenue: string): Promise<RevenueDistribution> {
    logger.info(`Distributing ${totalRevenue} XRP protocol revenue`);

    const stakerPool = (parseFloat(totalRevenue) * 0.8).toFixed(6); // 80%
    const buybackPool = (parseFloat(totalRevenue) * 0.2).toFixed(6); // 20%

    const totalStakedAmount = await stakeRepository.getTotalStaked();
    const rewardPerToken = totalStakedAmount > 0
      ? parseFloat(stakerPool) / totalStakedAmount
      : 0;

    const distributionId = generateId('REV');
    const period = new Date().toISOString().substring(0, 7);

    // Distribute rewards to all stakers in database
    let totalDistributed = 0;
    if (this.dbAvailable && rewardPerToken > 0) {
      totalDistributed = await stakeRepository.addRewards(rewardPerToken);
    }

    // Save distribution record
    const distribution: RevenueDistribution = {
      id: distributionId,
      period,
      totalRevenue,
      stakerPool,
      buybackPool,
      rewardPerToken: rewardPerToken.toFixed(12),
      distributedAt: new Date(),
      transactionHashes: [],
    };

    // Store in database
    if (this.dbAvailable) {
      const allStakes = await stakeRepository.getAllActiveStakes();
      await prisma.revenueDistribution.create({
        data: {
          period,
          totalRevenue: parseFloat(totalRevenue),
          stakerPool: parseFloat(stakerPool),
          buybackPool: parseFloat(buybackPool),
          rewardPerToken,
          totalStaked: totalStakedAmount,
          stakersCount: allStakes.length,
          distributedAt: new Date(),
        },
      });
    }

    logAuditAction('REVENUE_DISTRIBUTED', 'SYSTEM', {
      distributionId,
      totalRevenue,
      stakerPool,
      buybackPool,
      totalDistributed,
    });

    this.emit('revenueDistributed', distribution);

    return distribution;
  }

  /**
   * Execute buyback on XRPL DEX
   */
  async executeBuyback(
    buybackWallet: Wallet,
    xrpAmount: string,
    maxPrice?: string
  ): Promise<{ purchasedAmount: string; transactionHash: string }> {
    logger.info(`Executing buyback with ${xrpAmount} XRP`);

    const xrpDrops = XRPLClient.xrpToDrops(xrpAmount);
    const pricePerVRTY = maxPrice || '0.1';
    const vrtyAmount = (parseFloat(xrpAmount) / parseFloat(pricePerVRTY)).toFixed(VRTY_DECIMALS);

    const offerTx: OfferCreate = {
      TransactionType: 'OfferCreate',
      Account: buybackWallet.address,
      TakerGets: xrpDrops,
      TakerPays: {
        currency: VRTY_CURRENCY_CODE,
        issuer: this.issuerWallet.address,
        value: vrtyAmount,
      },
      Flags: 0x00080000, // tfImmediateOrCancel
      Memos: [
        {
          Memo: {
            MemoType: Buffer.from('VRTY_BUYBACK').toString('hex').toUpperCase(),
            MemoData: encodeMemoData({
              action: 'BUYBACK',
              xrpAmount,
              targetVRTY: vrtyAmount,
            }),
            MemoFormat: Buffer.from('application/json').toString('hex').toUpperCase(),
          },
        },
      ],
    };

    const result = await this.xrplClient.submitAndWait(offerTx, buybackWallet);

    if (!result.success) {
      throw new Error(`Buyback failed: ${result.error}`);
    }

    const purchasedAmount = vrtyAmount;

    logAuditAction('VRTY_BUYBACK', buybackWallet.address, {
      xrpSpent: xrpAmount,
      vrtyPurchased: purchasedAmount,
      transactionHash: result.hash,
    });

    this.emit('buybackExecuted', { xrpAmount, purchasedAmount, hash: result.hash });

    return {
      purchasedAmount,
      transactionHash: result.hash,
    };
  }

  /**
   * Execute token burn
   */
  async executeBurn(
    burnerWallet: Wallet,
    amount: string
  ): Promise<{ burnedAmount: string; transactionHash: string }> {
    logger.info(`Burning ${amount} VRTY tokens`);

    const paymentTx: Payment = {
      TransactionType: 'Payment',
      Account: burnerWallet.address,
      Destination: this.issuerWallet.address,
      Amount: {
        currency: VRTY_CURRENCY_CODE,
        issuer: this.issuerWallet.address,
        value: amount,
      },
      Memos: [
        {
          Memo: {
            MemoType: Buffer.from('VRTY_BURN').toString('hex').toUpperCase(),
            MemoData: encodeMemoData({
              action: 'BURN',
              amount,
              reason: 'Deflationary mechanism - 20% of platform fees',
              burnedAt: new Date().toISOString(),
            }),
            MemoFormat: Buffer.from('application/json').toString('hex').toUpperCase(),
          },
        },
      ],
    };

    const result = await this.xrplClient.submitAndWait(paymentTx, burnerWallet);

    if (!result.success) {
      throw new Error(`Burn failed: ${result.error}`);
    }

    // Record burn in database
    if (this.dbAvailable) {
      await prisma.buybackBurn.create({
        data: {
          xrpSpent: 0, // Will be updated in buybackBurn cycle
          vrtyBurned: parseFloat(amount),
          averagePrice: 0,
          burnTxHash: result.hash,
        },
      });
    }

    logAuditAction('VRTY_BURNED', burnerWallet.address, {
      amount,
      transactionHash: result.hash,
    });

    this.emit('tokensBurned', { amount, hash: result.hash });

    return {
      burnedAmount: amount,
      transactionHash: result.hash,
    };
  }

  /**
   * Execute complete buyback and burn cycle
   */
  async executeBuybackBurn(
    buybackWallet: Wallet,
    xrpAmount: string,
    maxPrice?: string
  ): Promise<BuybackBurn> {
    logger.info(`Executing buyback and burn with ${xrpAmount} XRP`);

    const burnId = generateId('BURN');

    const buyback = await this.executeBuyback(buybackWallet, xrpAmount, maxPrice);
    const burn = await this.executeBurn(buybackWallet, buyback.purchasedAmount);

    const averagePrice = (parseFloat(xrpAmount) / parseFloat(buyback.purchasedAmount)).toFixed(6);

    const buybackBurn: BuybackBurn = {
      id: burnId,
      amount: buyback.purchasedAmount,
      averagePrice,
      burnTransactionHash: burn.transactionHash,
      executedAt: new Date(),
    };

    // Update database record with average price
    if (this.dbAvailable) {
      await prisma.buybackBurn.updateMany({
        where: { burnTxHash: burn.transactionHash },
        data: { averagePrice: parseFloat(averagePrice) },
      });
    }

    logAuditAction('BUYBACK_BURN_COMPLETED', buybackWallet.address, {
      burnId,
      xrpSpent: xrpAmount,
      vrtyBurned: buyback.purchasedAmount,
      averagePrice,
      buybackTxHash: buyback.transactionHash,
      burnTxHash: burn.transactionHash,
    });

    this.emit('buybackBurned', buybackBurn);

    return buybackBurn;
  }

  // ===========================================
  // Query Functions (Database-backed)
  // ===========================================

  /**
   * Get stake info for a wallet
   */
  async getStake(wallet: string): Promise<VRTYStake | undefined> {
    const dbStake = await stakeRepository.getByWallet(wallet);
    return dbStake ? stakeToVRTYStake(dbStake) : undefined;
  }

  /**
   * Get staking tier configuration
   */
  getStakingTiers(): StakingTierConfig[] {
    return STAKING_TIERS;
  }

  /**
   * Get proposal by ID
   */
  async getProposal(proposalId: string): Promise<GovernanceProposal | undefined> {
    const dbProposal = await proposalRepository.getById(proposalId);
    return dbProposal ? proposalToGovernanceProposal(dbProposal) : undefined;
  }

  /**
   * Get all active proposals
   */
  async getActiveProposals(): Promise<GovernanceProposal[]> {
    const dbProposals = await proposalRepository.getActive();
    return dbProposals.map(proposalToGovernanceProposal);
  }

  /**
   * Get votes for a proposal
   */
  async getProposalVotes(proposalId: string): Promise<GovernanceVote[]> {
    const { votes } = await proposalRepository.getVotes(proposalId);
    return votes.map((v) => ({
      proposalId: v.proposalId,
      voter: v.voterWallet,
      voteWeight: Number(v.voteWeight).toString(),
      support: v.support === 'FOR',
      timestamp: v.votedAt,
      transactionHash: v.txHash || '',
    }));
  }

  /**
   * Get revenue distribution history
   */
  async getRevenueHistory(): Promise<RevenueDistribution[]> {
    if (!this.dbAvailable) return [];

    const distributions = await prisma.revenueDistribution.findMany({
      orderBy: { distributedAt: 'desc' },
      take: 100,
    });

    return distributions.map((d) => ({
      id: d.id,
      period: d.period,
      totalRevenue: Number(d.totalRevenue).toString(),
      stakerPool: Number(d.stakerPool).toString(),
      buybackPool: Number(d.buybackPool).toString(),
      rewardPerToken: Number(d.rewardPerToken).toString(),
      distributedAt: d.distributedAt,
      transactionHashes: [],
    }));
  }

  /**
   * Get buyback and burn history
   */
  async getBuybackHistory(): Promise<BuybackBurn[]> {
    if (!this.dbAvailable) return [];

    const burns = await prisma.buybackBurn.findMany({
      orderBy: { executedAt: 'desc' },
      take: 100,
    });

    return burns.map((b) => ({
      id: b.id,
      amount: Number(b.vrtyBurned).toString(),
      averagePrice: Number(b.averagePrice).toString(),
      burnTransactionHash: b.burnTxHash || '',
      executedAt: b.executedAt,
    }));
  }

  /**
   * Get all stakers
   */
  async getAllStakers(): Promise<VRTYStake[]> {
    const dbStakes = await stakeRepository.getAllActiveStakes();
    return dbStakes.map(stakeToVRTYStake);
  }

  /**
   * Get governance statistics
   */
  async getGovernanceStats(): Promise<Record<string, unknown>> {
    return proposalRepository.getStats();
  }

  /**
   * Get staking statistics
   */
  async getStakingStats(): Promise<Record<string, unknown>> {
    const [totalStaked, tierCounts, allStakes] = await Promise.all([
      stakeRepository.getTotalStaked(),
      stakeRepository.getStakerCountByTier(),
      stakeRepository.getAllActiveStakes(),
    ]);

    return {
      totalStaked,
      totalStakers: allStakes.length,
      stakersPerTier: tierCounts,
    };
  }
}

export default VRTYTokenManagerDB;
