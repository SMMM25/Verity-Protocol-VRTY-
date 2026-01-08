/**
 * Verity Protocol - VRTY Token
 * Core utility token for fee reduction, staking, governance, and access
 */

import { Wallet, Payment, TrustSet } from 'xrpl';
import { EventEmitter } from 'eventemitter3';
import { XRPLClient, TransactionResult } from '../core/XRPLClient.js';
import { VerityXAODOW } from '../core/XAO_DOW.js';
import { logger, logAuditAction } from '../utils/logger.js';
import { generateId, generateVerificationHash, encodeMemoData } from '../utils/crypto.js';
import type {
  VRTYStake,
  StakingTier,
  StakingTierConfig,
  FeeCalculation,
  GovernanceVote,
  GovernanceProposal,
  ProposalCategory,
  ProposalStatus,
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
 */
export class VRTYTokenManager extends EventEmitter {
  private xrplClient: XRPLClient;
  private issuerWallet: Wallet;
  
  // In-memory storage (would be database in production)
  private stakes: Map<string, VRTYStake> = new Map();
  private proposals: Map<string, GovernanceProposal> = new Map();
  private votes: Map<string, GovernanceVote[]> = new Map();
  private revenueHistory: RevenueDistribution[] = [];
  private buybackHistory: BuybackBurn[] = [];
  
  // Token metrics
  private totalStaked = BigInt(0);
  private totalBurned = BigInt(0);
  private circulatingSupply = BigInt(VRTY_TOTAL_SUPPLY) * BigInt(10 ** VRTY_DECIMALS);

  constructor(xrplClient: XRPLClient, issuerWallet: Wallet) {
    super();
    this.xrplClient = xrplClient;
    this.issuerWallet = issuerWallet;
    logger.info('VRTY Token Manager initialized');
  }

  /**
   * Get VRTY token information
   */
  getTokenInfo(): Record<string, unknown> {
    return {
      name: 'Verity Protocol Token',
      symbol: VRTY_CURRENCY_CODE,
      issuer: this.issuerWallet.address,
      totalSupply: VRTY_TOTAL_SUPPLY,
      circulatingSupply: (this.circulatingSupply / BigInt(10 ** VRTY_DECIMALS)).toString(),
      totalStaked: (this.totalStaked / BigInt(10 ** VRTY_DECIMALS)).toString(),
      totalBurned: (this.totalBurned / BigInt(10 ** VRTY_DECIMALS)).toString(),
      decimals: VRTY_DECIMALS,
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
  // Staking Functions
  // ===========================================

  /**
   * Stake VRTY tokens
   */
  async stakeVRTY(
    wallet: Wallet,
    amount: string,
    lockPeriodDays?: number
  ): Promise<{ stake: VRTYStake; result: TransactionResult }> {
    logger.info(`Staking ${amount} VRTY from ${wallet.address}`);

    // Calculate tier based on amount
    const tier = this.calculateTier(amount);

    // Transfer tokens to staking contract (issuer in this case)
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
              tier,
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

    // Calculate lock end date
    const lockEndDate = lockPeriodDays
      ? new Date(Date.now() + lockPeriodDays * 24 * 60 * 60 * 1000)
      : undefined;

    // Create or update stake record
    const existingStake = this.stakes.get(wallet.address);
    const newAmount = existingStake
      ? (parseFloat(existingStake.stakedAmount) + parseFloat(amount)).toString()
      : amount;

    const stake: VRTYStake = {
      wallet: wallet.address,
      stakedAmount: newAmount,
      stakingTier: this.calculateTier(newAmount),
      rewardsEarned: existingStake?.rewardsEarned || '0',
      rewardsClaimed: existingStake?.rewardsClaimed || '0',
      stakedAt: existingStake?.stakedAt || new Date(),
      lockEndDate,
    };

    this.stakes.set(wallet.address, stake);
    this.totalStaked += BigInt(parseFloat(amount) * 10 ** VRTY_DECIMALS);

    logAuditAction('VRTY_STAKED', wallet.address, {
      amount,
      newTotalStaked: newAmount,
      tier: stake.stakingTier,
      transactionHash: result.hash,
    });

    this.emit('staked', stake);

    return { stake, result };
  }

  /**
   * Unstake VRTY tokens
   */
  async unstakeVRTY(
    wallet: Wallet,
    amount: string
  ): Promise<{ stake: VRTYStake | null; result: TransactionResult }> {
    const stake = this.stakes.get(wallet.address);
    if (!stake) {
      throw new Error('No stake found');
    }

    // Check lock period
    if (stake.lockEndDate && new Date() < stake.lockEndDate) {
      throw new Error(`Stake is locked until ${stake.lockEndDate.toISOString()}`);
    }

    // Check sufficient staked amount
    if (parseFloat(stake.stakedAmount) < parseFloat(amount)) {
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
              previousTier: stake.stakingTier,
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

    // Update stake record
    const newAmount = parseFloat(stake.stakedAmount) - parseFloat(amount);
    this.totalStaked -= BigInt(parseFloat(amount) * 10 ** VRTY_DECIMALS);

    if (newAmount <= 0) {
      this.stakes.delete(wallet.address);
      
      logAuditAction('VRTY_UNSTAKED_FULL', wallet.address, {
        amount,
        transactionHash: result.hash,
      });

      return { stake: null, result };
    }

    stake.stakedAmount = newAmount.toString();
    stake.stakingTier = this.calculateTier(stake.stakedAmount);

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
  async claimRewards(wallet: Wallet): Promise<TransactionResult> {
    const stake = this.stakes.get(wallet.address);
    if (!stake) {
      throw new Error('No stake found');
    }

    const unclaimedRewards =
      parseFloat(stake.rewardsEarned) - parseFloat(stake.rewardsClaimed);

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
      stake.rewardsClaimed = stake.rewardsEarned;
      
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
   * Calculate fees with VRTY discount
   */
  calculateFee(
    feeType: keyof typeof BASE_FEES,
    amount: string,
    payerWallet: string,
    payWithVRTY: boolean
  ): FeeCalculation {
    const baseFeeRate = BASE_FEES[feeType];
    const baseFee = (parseFloat(amount) * baseFeeRate) / 10000;

    // Get staker discount
    const stake = this.stakes.get(payerWallet);
    let discountRate = 0;

    if (stake) {
      const tierConfig = STAKING_TIERS.find((t) => t.tier === stake.stakingTier);
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
    const feeCalc = this.calculateFee(feeType, amount, payer.address, true);

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
  // Governance Functions
  // ===========================================

  /**
   * Create a governance proposal
   */
  createProposal(
    proposer: string,
    title: string,
    description: string,
    category: ProposalCategory,
    executionPayload?: string
  ): GovernanceProposal {
    const stake = this.stakes.get(proposer);
    if (!stake) {
      throw new Error('Must be a staker to create proposals');
    }

    // Check minimum stake for proposal
    const minStakeForProposal = '10000'; // 10,000 VRTY
    if (parseFloat(stake.stakedAmount) < parseFloat(minStakeForProposal)) {
      throw new Error(`Minimum ${minStakeForProposal} VRTY staked required to create proposals`);
    }

    const proposalId = generateId('GOV');
    const votingPeriodMs = 7 * 24 * 60 * 60 * 1000; // 7 days

    const proposal: GovernanceProposal = {
      id: proposalId,
      proposer,
      title,
      description,
      category,
      forVotes: '0',
      againstVotes: '0',
      status: 'ACTIVE',
      executionPayload,
      createdAt: new Date(),
      votingEndsAt: new Date(Date.now() + votingPeriodMs),
    };

    this.proposals.set(proposalId, proposal);
    this.votes.set(proposalId, []);

    logAuditAction('GOVERNANCE_PROPOSAL_CREATED', proposer, {
      proposalId,
      title,
      category,
    });

    this.emit('proposalCreated', proposal);

    return proposal;
  }

  /**
   * Vote on a proposal
   */
  async voteOnProposal(
    voter: Wallet,
    proposalId: string,
    support: boolean
  ): Promise<{ vote: GovernanceVote; result: TransactionResult }> {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    if (proposal.status !== 'ACTIVE') {
      throw new Error('Proposal is not active');
    }

    if (new Date() > proposal.votingEndsAt) {
      throw new Error('Voting period has ended');
    }

    const stake = this.stakes.get(voter.address);
    if (!stake) {
      throw new Error('Must be a staker to vote');
    }

    // Check if already voted
    const existingVotes = this.votes.get(proposalId) || [];
    if (existingVotes.some((v) => v.voter === voter.address)) {
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
              voteWeight: stake.stakedAmount,
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

    // Record vote
    const vote: GovernanceVote = {
      proposalId,
      voter: voter.address,
      voteWeight: stake.stakedAmount,
      support,
      timestamp: new Date(),
      transactionHash: result.hash,
    };

    existingVotes.push(vote);
    this.votes.set(proposalId, existingVotes);

    // Update proposal vote counts
    if (support) {
      proposal.forVotes = (
        parseFloat(proposal.forVotes) + parseFloat(stake.stakedAmount)
      ).toString();
    } else {
      proposal.againstVotes = (
        parseFloat(proposal.againstVotes) + parseFloat(stake.stakedAmount)
      ).toString();
    }

    // Check if proposal passes (simple majority of voted tokens)
    const totalVoted = parseFloat(proposal.forVotes) + parseFloat(proposal.againstVotes);
    const totalStaked = Number(this.totalStaked) / 10 ** VRTY_DECIMALS;
    const quorum = totalStaked * 0.1; // 10% quorum

    if (totalVoted >= quorum && new Date() > proposal.votingEndsAt) {
      proposal.status = parseFloat(proposal.forVotes) > parseFloat(proposal.againstVotes)
        ? 'PASSED'
        : 'FAILED';
    }

    logAuditAction('GOVERNANCE_VOTE', voter.address, {
      proposalId,
      support,
      voteWeight: stake.stakedAmount,
      transactionHash: result.hash,
    });

    this.emit('voted', vote);

    return { vote, result };
  }

  /**
   * Execute a passed proposal
   */
  executeProposal(proposalId: string): GovernanceProposal {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    if (proposal.status !== 'PASSED') {
      throw new Error('Proposal has not passed');
    }

    // In production, this would execute the proposal payload
    proposal.status = 'EXECUTED';
    proposal.executedAt = new Date();

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

    const totalStakedAmount = Number(this.totalStaked) / 10 ** VRTY_DECIMALS;
    const rewardPerToken = totalStakedAmount > 0
      ? (parseFloat(stakerPool) / totalStakedAmount).toFixed(12)
      : '0';

    const distributionId = generateId('REV');
    const period = new Date().toISOString().substring(0, 7);
    const transactionHashes: string[] = [];

    // Distribute to each staker
    for (const [wallet, stake] of this.stakes) {
      const rewardAmount = (
        parseFloat(stake.stakedAmount) * parseFloat(rewardPerToken)
      ).toFixed(6);

      if (parseFloat(rewardAmount) > 0) {
        stake.rewardsEarned = (
          parseFloat(stake.rewardsEarned) + parseFloat(rewardAmount)
        ).toString();

        // In production, would batch these transactions
        logger.debug(`Allocated ${rewardAmount} XRP rewards to ${wallet}`);
      }
    }

    const distribution: RevenueDistribution = {
      id: distributionId,
      period,
      totalRevenue,
      stakerPool,
      buybackPool,
      rewardPerToken,
      distributedAt: new Date(),
      transactionHashes,
    };

    this.revenueHistory.push(distribution);

    logAuditAction('REVENUE_DISTRIBUTED', 'SYSTEM', {
      distributionId,
      totalRevenue,
      stakerPool,
      buybackPool,
      stakersCount: this.stakes.size,
    });

    this.emit('revenueDistributed', distribution);

    return distribution;
  }

  /**
   * Execute buyback and burn
   */
  async executeBuybackBurn(xrpAmount: string): Promise<BuybackBurn> {
    logger.info(`Executing buyback and burn with ${xrpAmount} XRP`);

    // In production, this would:
    // 1. Place market buy order on DEX
    // 2. Burn the purchased tokens

    const burnId = generateId('BURN');
    const mockPurchasedAmount = (parseFloat(xrpAmount) * 10).toString(); // Mock price
    const averagePrice = (parseFloat(xrpAmount) / parseFloat(mockPurchasedAmount)).toFixed(6);

    const burn: BuybackBurn = {
      id: burnId,
      amount: mockPurchasedAmount,
      averagePrice,
      burnTransactionHash: 'mock_burn_hash', // Would be real tx hash
      executedAt: new Date(),
    };

    this.buybackHistory.push(burn);
    this.totalBurned += BigInt(parseFloat(mockPurchasedAmount) * 10 ** VRTY_DECIMALS);
    this.circulatingSupply -= BigInt(parseFloat(mockPurchasedAmount) * 10 ** VRTY_DECIMALS);

    logAuditAction('BUYBACK_BURN_EXECUTED', 'SYSTEM', {
      burnId,
      xrpSpent: xrpAmount,
      vrtyBurned: mockPurchasedAmount,
    });

    this.emit('buybackBurned', burn);

    return burn;
  }

  // ===========================================
  // Utility Functions
  // ===========================================

  /**
   * Calculate staking tier from amount
   */
  private calculateTier(amount: string): StakingTier {
    const amountNum = parseFloat(amount);
    
    // Check tiers from highest to lowest
    for (let i = STAKING_TIERS.length - 1; i >= 0; i--) {
      const tier = STAKING_TIERS[i];
      if (tier && amountNum >= parseFloat(tier.minStake)) {
        return tier.tier;
      }
    }
    
    return 'BASIC';
  }

  /**
   * Get stake info for a wallet
   */
  getStake(wallet: string): VRTYStake | undefined {
    return this.stakes.get(wallet);
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
  getProposal(proposalId: string): GovernanceProposal | undefined {
    return this.proposals.get(proposalId);
  }

  /**
   * Get all active proposals
   */
  getActiveProposals(): GovernanceProposal[] {
    return Array.from(this.proposals.values()).filter(
      (p) => p.status === 'ACTIVE'
    );
  }

  /**
   * Get votes for a proposal
   */
  getProposalVotes(proposalId: string): GovernanceVote[] {
    return this.votes.get(proposalId) || [];
  }

  /**
   * Get revenue distribution history
   */
  getRevenueHistory(): RevenueDistribution[] {
    return this.revenueHistory;
  }

  /**
   * Get buyback and burn history
   */
  getBuybackHistory(): BuybackBurn[] {
    return this.buybackHistory;
  }

  /**
   * Get all stakers
   */
  getAllStakers(): VRTYStake[] {
    return Array.from(this.stakes.values());
  }
}

export default VRTYTokenManager;
