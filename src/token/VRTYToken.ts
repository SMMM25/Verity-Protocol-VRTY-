/**
 * Verity Protocol - VRTY Token
 * Core utility token for fee reduction, staking, governance, and access
 * 
 * MIGRATED TO PRISMA: All data now persisted to PostgreSQL
 */

import { Wallet, Payment, TrustSet, OfferCreate } from 'xrpl';
import { EventEmitter } from 'eventemitter3';
import { XRPLClient, TransactionResult } from '../core/XRPLClient.js';
import { logger, logAuditAction } from '../utils/logger.js';
import { generateId, encodeMemoData } from '../utils/crypto.js';
import { prisma } from '../db/client.js';
import { stakeRepository, calculateTier } from '../db/repositories/stakeRepository.js';
import type {
  StakingTier,
  StakingTierConfig,
  FeeCalculation,
  GovernanceVote,
  GovernanceProposal,
  ProposalCategory,
} from '../types/index.js';

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
 * VRTY Token Manager
 * Handles all token operations, staking, and governance
 * 
 * NOW USING PRISMA FOR ALL DATA PERSISTENCE
 */
export class VRTYTokenManager extends EventEmitter {
  private xrplClient: XRPLClient;
  private issuerWallet: Wallet;

  constructor(xrplClient: XRPLClient, issuerWallet: Wallet) {
    super();
    this.xrplClient = xrplClient;
    this.issuerWallet = issuerWallet;
    logger.info('VRTY Token Manager initialized (Prisma-backed)');
  }

  /**
   * Get VRTY token information
   */
  async getTokenInfo(): Promise<Record<string, unknown>> {
    const totalStaked = await stakeRepository.getTotalStaked();
    const totalBurned = await this.getTotalBurned();
    
    return {
      name: 'Verity Protocol Token',
      symbol: VRTY_CURRENCY_CODE,
      issuer: this.issuerWallet.address,
      totalSupply: VRTY_TOTAL_SUPPLY,
      circulatingSupply: (parseFloat(VRTY_TOTAL_SUPPLY) - totalBurned).toString(),
      totalStaked: totalStaked.toString(),
      totalBurned: totalBurned.toString(),
      decimals: VRTY_DECIMALS,
    };
  }

  /**
   * Get total burned amount from database
   */
  private async getTotalBurned(): Promise<number> {
    const result = await prisma.buybackBurn.aggregate({
      _sum: { vrtyBurned: true },
    });
    return Number(result._sum.vrtyBurned || 0);
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
  // Staking Functions (PRISMA-BACKED)
  // ===========================================

  /**
   * Stake VRTY tokens with transaction safety
   * Uses database transaction to ensure atomicity
   */
  async stakeVRTY(
    wallet: Wallet,
    amount: string,
    lockPeriodDays?: number,
    userId?: string
  ): Promise<{ stake: any; result: TransactionResult }> {
    logger.info(`Staking ${amount} VRTY from ${wallet.address}`);

    // Use transaction for atomicity
    return await prisma.$transaction(async (tx) => {
      // 1. First submit XRPL transaction
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

      // 2. Only update DB after XRPL success (transaction safety fix)
      const effectiveUserId = userId || wallet.address;
      
      // Ensure user exists
      await tx.user.upsert({
        where: { wallet: wallet.address },
        create: { wallet: wallet.address },
        update: {},
      });

      // Get existing stake
      const existingStake = await tx.stake.findFirst({
        where: { wallet: wallet.address, unstakedAt: null },
      });

      const amountNum = parseFloat(amount);
      const newAmount = existingStake 
        ? Number(existingStake.amount) + amountNum 
        : amountNum;

      const tier = calculateTier(newAmount);
      const lockEndDate = lockPeriodDays
        ? new Date(Date.now() + lockPeriodDays * 24 * 60 * 60 * 1000)
        : null;

      // Create or update stake
      const stake = existingStake
        ? await tx.stake.update({
            where: { id: existingStake.id },
            data: {
              amount: newAmount,
              tier,
              lockEndDate: lockEndDate || existingStake.lockEndDate,
              lockPeriodDays: lockPeriodDays || existingStake.lockPeriodDays,
              stakeTxHash: result.hash,
            },
          })
        : await tx.stake.create({
            data: {
              userId: effectiveUserId,
              wallet: wallet.address,
              amount: amountNum,
              tier,
              lockEndDate,
              lockPeriodDays,
              stakeTxHash: result.hash,
            },
          });

      logAuditAction('VRTY_STAKED', wallet.address, {
        amount,
        newTotalStaked: newAmount.toString(),
        tier,
        transactionHash: result.hash,
      });

      this.emit('staked', stake);

      return { stake, result };
    });
  }

  /**
   * Unstake VRTY tokens with transaction safety
   */
  async unstakeVRTY(
    wallet: Wallet,
    amount: string
  ): Promise<{ stake: any | null; result: TransactionResult }> {
    const existingStake = await prisma.stake.findFirst({
      where: { wallet: wallet.address, unstakedAt: null },
    });

    if (!existingStake) {
      throw new Error('No stake found');
    }

    // Check lock period
    if (existingStake.lockEndDate && new Date() < existingStake.lockEndDate) {
      throw new Error(`Stake is locked until ${existingStake.lockEndDate.toISOString()}`);
    }

    const currentAmount = Number(existingStake.amount);
    const unstakeAmount = parseFloat(amount);

    if (currentAmount < unstakeAmount) {
      throw new Error('Insufficient staked amount');
    }

    logger.info(`Unstaking ${amount} VRTY for ${wallet.address}`);

    // Use transaction for atomicity
    return await prisma.$transaction(async (tx) => {
      // 1. First submit XRPL transaction
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

      // 2. Only update DB after XRPL success
      const newAmount = currentAmount - unstakeAmount;

      if (newAmount <= 0) {
        // Full unstake
        const stake = await tx.stake.update({
          where: { id: existingStake.id },
          data: {
            amount: 0,
            tier: 'NONE',
            unstakedAt: new Date(),
          },
        });

        logAuditAction('VRTY_UNSTAKED_FULL', wallet.address, {
          amount,
          transactionHash: result.hash,
        });

        return { stake: null, result };
      }

      // Partial unstake
      const newTier = calculateTier(newAmount);
      const stake = await tx.stake.update({
        where: { id: existingStake.id },
        data: {
          amount: newAmount,
          tier: newTier,
        },
      });

      logAuditAction('VRTY_UNSTAKED', wallet.address, {
        amount,
        remainingStake: newAmount.toString(),
        newTier,
        transactionHash: result.hash,
      });

      this.emit('unstaked', { wallet: wallet.address, amount });

      return { stake, result };
    });
  }

  /**
   * Claim staking rewards
   */
  async claimRewards(wallet: Wallet): Promise<TransactionResult> {
    const stake = await prisma.stake.findFirst({
      where: { wallet: wallet.address, unstakedAt: null },
    });

    if (!stake) {
      throw new Error('No stake found');
    }

    const unclaimedRewards = Number(stake.rewardsEarned) - Number(stake.rewardsClaimed);

    if (unclaimedRewards <= 0) {
      throw new Error('No rewards to claim');
    }

    logger.info(`Claiming ${unclaimedRewards} VRTY rewards for ${wallet.address}`);

    // Use transaction for atomicity
    return await prisma.$transaction(async (tx) => {
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
        await tx.stake.update({
          where: { id: stake.id },
          data: { rewardsClaimed: stake.rewardsEarned },
        });

        logAuditAction('VRTY_REWARDS_CLAIMED', wallet.address, {
          amount: unclaimedRewards,
          transactionHash: result.hash,
        });

        this.emit('rewardsClaimed', { wallet: wallet.address, amount: unclaimedRewards });
      }

      return result;
    });
  }

  // ===========================================
  // Fee Calculation Functions
  // ===========================================

  /**
   * Calculate fees with VRTY discount
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
    const stake = await stakeRepository.getByWallet(payerWallet);
    let discountRate = 0;

    if (stake) {
      const tierConfig = STAKING_TIERS.find((t) => t.tier === stake.tier);
      if (tierConfig) {
        discountRate = tierConfig.feeDiscount;
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
  // Governance Functions (PRISMA-BACKED)
  // ===========================================

  /**
   * Create a governance proposal
   */
  async createProposal(
    proposer: string,
    title: string,
    description: string,
    category: ProposalCategory,
    executionPayload?: string
  ): Promise<GovernanceProposal> {
    const stake = await stakeRepository.getByWallet(proposer);
    if (!stake) {
      throw new Error('Must be a staker to create proposals');
    }

    // Check minimum stake for proposal
    const minStakeForProposal = 10000; // 10,000 VRTY
    if (Number(stake.amount) < minStakeForProposal) {
      throw new Error(`Minimum ${minStakeForProposal} VRTY staked required to create proposals`);
    }

    const votingPeriodMs = 7 * 24 * 60 * 60 * 1000; // 7 days
    const votingStartsAt = new Date();
    const votingEndsAt = new Date(Date.now() + votingPeriodMs);

    // Create in database
    const proposal = await prisma.proposal.create({
      data: {
        proposerId: stake.userId,
        proposerWallet: proposer,
        title,
        description,
        category: category as any,
        executionPayload,
        status: 'ACTIVE',
        votingStartsAt,
        votingEndsAt,
      },
    });

    logAuditAction('GOVERNANCE_PROPOSAL_CREATED', proposer, {
      proposalId: proposal.id,
      title,
      category,
    });

    this.emit('proposalCreated', proposal);

    // Return in expected format
    return {
      id: proposal.id,
      proposer,
      title,
      description,
      category,
      forVotes: '0',
      againstVotes: '0',
      status: 'ACTIVE',
      executionPayload: executionPayload || undefined,
      createdAt: proposal.createdAt,
      votingEndsAt,
    };
  }

  /**
   * Vote on a proposal with vote weight locking
   */
  async voteOnProposal(
    voter: Wallet,
    proposalId: string,
    support: boolean
  ): Promise<{ vote: GovernanceVote; result: TransactionResult }> {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
    });

    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    if (proposal.status !== 'ACTIVE') {
      throw new Error('Proposal is not active');
    }

    if (new Date() > proposal.votingEndsAt) {
      throw new Error('Voting period has ended');
    }

    const stake = await stakeRepository.getByWallet(voter.address);
    if (!stake) {
      throw new Error('Must be a staker to vote');
    }

    // Check if already voted (enforced by unique constraint)
    const existingVote = await prisma.vote.findFirst({
      where: {
        proposalId,
        voterWallet: voter.address,
      },
    });

    if (existingVote) {
      throw new Error('Already voted on this proposal');
    }

    logger.info(`Voting on proposal ${proposalId}: ${support ? 'FOR' : 'AGAINST'}`);

    // Use transaction for atomicity
    return await prisma.$transaction(async (tx) => {
      // 1. Record vote on-chain
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
                voteWeight: stake.amount.toString(),
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

      // 2. Get CURRENT stake amount at time of vote (vote weight locking)
      // This captures the stake at voting time, preventing manipulation
      const voteWeight = Number(stake.amount);

      // 3. Record vote in database
      const dbVote = await tx.vote.create({
        data: {
          proposalId,
          voterId: stake.userId,
          voterWallet: voter.address,
          support: support ? 'FOR' : 'AGAINST',
          voteWeight,
          txHash: result.hash,
        },
      });

      // 4. Update proposal vote counts
      if (support) {
        await tx.proposal.update({
          where: { id: proposalId },
          data: {
            forVotes: { increment: voteWeight },
          },
        });
      } else {
        await tx.proposal.update({
          where: { id: proposalId },
          data: {
            againstVotes: { increment: voteWeight },
          },
        });
      }

      // 5. Check if proposal passes (quorum check)
      const updatedProposal = await tx.proposal.findUnique({
        where: { id: proposalId },
      });

      if (updatedProposal) {
        const totalVoted = Number(updatedProposal.forVotes) + Number(updatedProposal.againstVotes);
        const totalStaked = await stakeRepository.getTotalStaked();
        const quorum = totalStaked * 0.1; // 10% quorum

        if (totalVoted >= quorum) {
          await tx.proposal.update({
            where: { id: proposalId },
            data: { quorumReached: true },
          });
        }
      }

      const vote: GovernanceVote = {
        proposalId,
        voter: voter.address,
        voteWeight: voteWeight.toString(),
        support,
        timestamp: new Date(),
        transactionHash: result.hash,
      };

      logAuditAction('GOVERNANCE_VOTE', voter.address, {
        proposalId,
        support,
        voteWeight: voteWeight.toString(),
        transactionHash: result.hash,
      });

      this.emit('voted', vote);

      return { vote, result };
    });
  }

  /**
   * Execute a passed proposal
   */
  async executeProposal(proposalId: string): Promise<GovernanceProposal> {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
    });

    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    // Check if voting ended and proposal passed
    if (new Date() < proposal.votingEndsAt) {
      throw new Error('Voting period has not ended');
    }

    const forVotes = Number(proposal.forVotes);
    const againstVotes = Number(proposal.againstVotes);

    if (!proposal.quorumReached) {
      throw new Error('Quorum not reached');
    }

    if (forVotes <= againstVotes) {
      // Update status to FAILED
      await prisma.proposal.update({
        where: { id: proposalId },
        data: { status: 'FAILED' },
      });
      throw new Error('Proposal did not pass (more against votes)');
    }

    // Execute the proposal
    const updatedProposal = await prisma.proposal.update({
      where: { id: proposalId },
      data: {
        status: 'EXECUTED',
        executedAt: new Date(),
      },
    });

    logAuditAction('GOVERNANCE_PROPOSAL_EXECUTED', 'SYSTEM', {
      proposalId,
      category: proposal.category,
    });

    this.emit('proposalExecuted', updatedProposal);

    return {
      id: updatedProposal.id,
      proposer: updatedProposal.proposerWallet,
      title: updatedProposal.title,
      description: updatedProposal.description,
      category: updatedProposal.category as ProposalCategory,
      forVotes: updatedProposal.forVotes.toString(),
      againstVotes: updatedProposal.againstVotes.toString(),
      status: 'EXECUTED',
      executionPayload: updatedProposal.executionPayload || undefined,
      createdAt: updatedProposal.createdAt,
      votingEndsAt: updatedProposal.votingEndsAt,
      executedAt: updatedProposal.executedAt || undefined,
    };
  }

  // ===========================================
  // Revenue Distribution Functions (PRISMA-BACKED)
  // ===========================================

  /**
   * Distribute protocol revenue to stakers
   */
  async distributeRevenue(totalRevenue: string): Promise<RevenueDistribution> {
    logger.info(`Distributing ${totalRevenue} XRP protocol revenue`);

    const stakerPool = (parseFloat(totalRevenue) * 0.8).toFixed(6); // 80%
    const buybackPool = (parseFloat(totalRevenue) * 0.2).toFixed(6); // 20%

    const totalStaked = await stakeRepository.getTotalStaked();
    const stakersCount = (await stakeRepository.getAllActiveStakes()).length;
    
    const rewardPerToken = totalStaked > 0
      ? (parseFloat(stakerPool) / totalStaked).toFixed(12)
      : '0';

    const period = new Date().toISOString().substring(0, 7);

    // Distribute rewards to all stakers
    await stakeRepository.addRewards(parseFloat(rewardPerToken));

    // Record distribution in database
    const distribution = await prisma.revenueDistribution.create({
      data: {
        period,
        totalRevenue: parseFloat(totalRevenue),
        stakerPool: parseFloat(stakerPool),
        buybackPool: parseFloat(buybackPool),
        rewardPerToken: parseFloat(rewardPerToken),
        totalStaked,
        stakersCount,
        transactionHashes: [],
      },
    });

    logAuditAction('REVENUE_DISTRIBUTED', 'SYSTEM', {
      distributionId: distribution.id,
      totalRevenue,
      stakerPool,
      buybackPool,
      stakersCount,
    });

    this.emit('revenueDistributed', distribution);

    return {
      id: distribution.id,
      period,
      totalRevenue,
      stakerPool,
      buybackPool,
      rewardPerToken,
      distributedAt: distribution.distributedAt,
      transactionHashes: [],
    };
  }

  /**
   * Execute real buyback on XRPL DEX
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

    return { purchasedAmount, transactionHash: result.hash };
  }

  /**
   * Execute real token burn
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

    logAuditAction('VRTY_BURNED', burnerWallet.address, {
      amount,
      transactionHash: result.hash,
    });

    this.emit('tokensBurned', { amount, hash: result.hash });

    return { burnedAmount: amount, transactionHash: result.hash };
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

    // Step 1: Buy VRTY from DEX
    const buyback = await this.executeBuyback(buybackWallet, xrpAmount, maxPrice);

    // Step 2: Burn the purchased tokens
    const burn = await this.executeBurn(buybackWallet, buyback.purchasedAmount);

    const averagePrice = (parseFloat(xrpAmount) / parseFloat(buyback.purchasedAmount)).toFixed(6);

    // Record in database
    const buybackBurn = await prisma.buybackBurn.create({
      data: {
        xrpSpent: parseFloat(xrpAmount),
        vrtyBurned: parseFloat(buyback.purchasedAmount),
        averagePrice: parseFloat(averagePrice),
        buybackTxHash: buyback.transactionHash,
        burnTxHash: burn.transactionHash,
      },
    });

    logAuditAction('BUYBACK_BURN_COMPLETED', buybackWallet.address, {
      burnId: buybackBurn.id,
      xrpSpent: xrpAmount,
      vrtyBurned: buyback.purchasedAmount,
      averagePrice,
      buybackTxHash: buyback.transactionHash,
      burnTxHash: burn.transactionHash,
    });

    this.emit('buybackBurned', buybackBurn);

    return {
      id: buybackBurn.id,
      amount: buyback.purchasedAmount,
      averagePrice,
      burnTransactionHash: burn.transactionHash,
      executedAt: buybackBurn.executedAt,
    };
  }

  // ===========================================
  // Utility Functions (PRISMA-BACKED)
  // ===========================================

  /**
   * Get stake info for a wallet
   */
  async getStake(wallet: string): Promise<StakeInfo | null> {
    const stake = await stakeRepository.getByWallet(wallet);
    if (!stake) return null;

    return {
      wallet: stake.wallet,
      amount: stake.amount.toString(),
      tier: stake.tier as StakingTier,
      stakedAt: stake.stakedAt,
      lockEndDate: stake.lockEndDate || undefined,
      rewardsEarned: stake.rewardsEarned.toString(),
      rewardsClaimed: stake.rewardsClaimed.toString(),
    };
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
  async getProposal(proposalId: string): Promise<GovernanceProposal | null> {
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
    });

    if (!proposal) return null;

    return {
      id: proposal.id,
      proposer: proposal.proposerWallet,
      title: proposal.title,
      description: proposal.description,
      category: proposal.category as ProposalCategory,
      forVotes: proposal.forVotes.toString(),
      againstVotes: proposal.againstVotes.toString(),
      status: proposal.status as any,
      executionPayload: proposal.executionPayload || undefined,
      createdAt: proposal.createdAt,
      votingEndsAt: proposal.votingEndsAt,
      executedAt: proposal.executedAt || undefined,
    };
  }

  /**
   * Get all active proposals
   */
  async getActiveProposals(): Promise<GovernanceProposal[]> {
    const proposals = await prisma.proposal.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    });

    return proposals.map((p) => ({
      id: p.id,
      proposer: p.proposerWallet,
      title: p.title,
      description: p.description,
      category: p.category as ProposalCategory,
      forVotes: p.forVotes.toString(),
      againstVotes: p.againstVotes.toString(),
      status: 'ACTIVE' as const,
      executionPayload: p.executionPayload || undefined,
      createdAt: p.createdAt,
      votingEndsAt: p.votingEndsAt,
    }));
  }

  /**
   * Get votes for a proposal
   */
  async getProposalVotes(proposalId: string): Promise<GovernanceVote[]> {
    const votes = await prisma.vote.findMany({
      where: { proposalId },
      orderBy: { votedAt: 'desc' },
    });

    return votes.map((v) => ({
      proposalId: v.proposalId,
      voter: v.voterWallet,
      voteWeight: v.voteWeight.toString(),
      support: v.support === 'FOR',
      timestamp: v.votedAt,
      transactionHash: v.txHash || '',
    }));
  }

  /**
   * Get revenue distribution history
   */
  async getRevenueHistory(): Promise<RevenueDistribution[]> {
    const distributions = await prisma.revenueDistribution.findMany({
      orderBy: { distributedAt: 'desc' },
    });

    return distributions.map((d) => ({
      id: d.id,
      period: d.period,
      totalRevenue: d.totalRevenue.toString(),
      stakerPool: d.stakerPool.toString(),
      buybackPool: d.buybackPool.toString(),
      rewardPerToken: d.rewardPerToken.toString(),
      distributedAt: d.distributedAt,
      transactionHashes: d.transactionHashes,
    }));
  }

  /**
   * Get buyback and burn history
   */
  async getBuybackHistory(): Promise<BuybackBurn[]> {
    const buybacks = await prisma.buybackBurn.findMany({
      orderBy: { executedAt: 'desc' },
    });

    return buybacks.map((b) => ({
      id: b.id,
      amount: b.vrtyBurned.toString(),
      averagePrice: b.averagePrice.toString(),
      burnTransactionHash: b.burnTxHash || '',
      executedAt: b.executedAt,
    }));
  }

  /**
   * Get all stakers
   */
  async getAllStakers(): Promise<StakeInfo[]> {
    const stakes = await stakeRepository.getAllActiveStakes();

    return stakes.map((s) => ({
      wallet: s.wallet,
      amount: s.amount.toString(),
      tier: s.tier as StakingTier,
      stakedAt: s.stakedAt,
      lockEndDate: s.lockEndDate || undefined,
      rewardsEarned: s.rewardsEarned.toString(),
      rewardsClaimed: s.rewardsClaimed.toString(),
    }));
  }
}

export default VRTYTokenManager;
