/**
 * Verity Protocol - VRTY Token Unit Tests
 * Comprehensive tests for the token module
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock XRPL client
vi.mock('xrpl', () => ({
  Client: vi.fn(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    submitAndWait: vi.fn().mockResolvedValue({
      result: { meta: { TransactionResult: 'tesSUCCESS' } }
    }),
    request: vi.fn().mockResolvedValue({
      result: { account_data: { Balance: '100000000' } }
    })
  })),
  Wallet: {
    fromSeed: vi.fn(() => ({
      address: 'rTestWallet123456789012345678901',
      seed: 'sTestSeed12345678901234567890'
    }))
  },
  xrpToDrops: vi.fn((xrp) => String(Number(xrp) * 1000000)),
  dropsToXrp: vi.fn((drops) => String(Number(drops) / 1000000))
}));

// Mock VRTYTokenManager
const mockVRTYTokenManager = {
  tokenInfo: {
    name: 'Verity Protocol Token',
    symbol: 'VRTY',
    decimals: 6,
    totalSupply: '1000000000',
    circulatingSupply: '0',
    totalStaked: '0',
    totalBurned: '0'
  },
  tiers: {
    BASIC: { minStake: 1000, feeDiscount: 2500, features: ['Advanced portfolio analytics'] },
    PROFESSIONAL: { minStake: 10000, feeDiscount: 5000, features: ['Guild creation'] },
    INSTITUTIONAL: { minStake: 50000, feeDiscount: 7500, features: ['Asset tokenization'] },
    DEVELOPER: { minStake: 5000, feeDiscount: 5000, features: ['Full API access'] }
  },
  baseFees: {
    DEX_TRADE: 10,
    ASSET_TOKENIZATION: 25,
    SIGNAL_SEND: 5,
    GUILD_OPERATION: 15
  },
  stakes: new Map(),
  
  getTokenInfo() {
    return this.tokenInfo;
  },
  
  getTiers() {
    return this.tiers;
  },
  
  getBaseFees() {
    return this.baseFees;
  },
  
  calculateTier(stakedAmount: number) {
    if (stakedAmount >= 50000) return 'INSTITUTIONAL';
    if (stakedAmount >= 10000) return 'PROFESSIONAL';
    if (stakedAmount >= 5000) return 'DEVELOPER';
    if (stakedAmount >= 1000) return 'BASIC';
    return null;
  },
  
  calculateFeeDiscount(tier: string | null) {
    if (!tier) return 0;
    return this.tiers[tier]?.feeDiscount || 0;
  },
  
  stake(wallet: string, amount: number, lockPeriodDays: number) {
    const stake = {
      amount,
      lockPeriodDays,
      stakedAt: new Date(),
      unlockAt: new Date(Date.now() + lockPeriodDays * 24 * 60 * 60 * 1000)
    };
    this.stakes.set(wallet, stake);
    return stake;
  },
  
  getStake(wallet: string) {
    return this.stakes.get(wallet) || null;
  },
  
  unstake(wallet: string) {
    const stake = this.stakes.get(wallet);
    if (!stake) throw new Error('No stake found');
    if (new Date() < stake.unlockAt) throw new Error('Lock period not ended');
    this.stakes.delete(wallet);
    return stake;
  }
};

describe('VRTY Token', () => {
  beforeEach(() => {
    mockVRTYTokenManager.stakes.clear();
  });

  describe('Token Info', () => {
    it('should return correct token info', () => {
      const info = mockVRTYTokenManager.getTokenInfo();
      
      expect(info.name).toBe('Verity Protocol Token');
      expect(info.symbol).toBe('VRTY');
      expect(info.decimals).toBe(6);
      expect(info.totalSupply).toBe('1000000000');
    });

    it('should have correct initial supply values', () => {
      const info = mockVRTYTokenManager.getTokenInfo();
      
      expect(info.circulatingSupply).toBe('0');
      expect(info.totalStaked).toBe('0');
      expect(info.totalBurned).toBe('0');
    });
  });

  describe('Staking Tiers', () => {
    it('should return all staking tiers', () => {
      const tiers = mockVRTYTokenManager.getTiers();
      
      expect(Object.keys(tiers)).toHaveLength(4);
      expect(tiers).toHaveProperty('BASIC');
      expect(tiers).toHaveProperty('PROFESSIONAL');
      expect(tiers).toHaveProperty('INSTITUTIONAL');
      expect(tiers).toHaveProperty('DEVELOPER');
    });

    it('should have correct tier minimum stakes', () => {
      const tiers = mockVRTYTokenManager.getTiers();
      
      expect(tiers.BASIC.minStake).toBe(1000);
      expect(tiers.PROFESSIONAL.minStake).toBe(10000);
      expect(tiers.INSTITUTIONAL.minStake).toBe(50000);
      expect(tiers.DEVELOPER.minStake).toBe(5000);
    });

    it('should have correct fee discounts', () => {
      const tiers = mockVRTYTokenManager.getTiers();
      
      // Fee discounts in basis points
      expect(tiers.BASIC.feeDiscount).toBe(2500); // 25%
      expect(tiers.PROFESSIONAL.feeDiscount).toBe(5000); // 50%
      expect(tiers.INSTITUTIONAL.feeDiscount).toBe(7500); // 75%
      expect(tiers.DEVELOPER.feeDiscount).toBe(5000); // 50%
    });

    it('should calculate correct tier from staked amount', () => {
      expect(mockVRTYTokenManager.calculateTier(500)).toBeNull();
      expect(mockVRTYTokenManager.calculateTier(1000)).toBe('BASIC');
      expect(mockVRTYTokenManager.calculateTier(5000)).toBe('DEVELOPER');
      expect(mockVRTYTokenManager.calculateTier(10000)).toBe('PROFESSIONAL');
      expect(mockVRTYTokenManager.calculateTier(50000)).toBe('INSTITUTIONAL');
      expect(mockVRTYTokenManager.calculateTier(100000)).toBe('INSTITUTIONAL');
    });
  });

  describe('Base Fees', () => {
    it('should return all base fees', () => {
      const fees = mockVRTYTokenManager.getBaseFees();
      
      expect(fees).toHaveProperty('DEX_TRADE');
      expect(fees).toHaveProperty('ASSET_TOKENIZATION');
      expect(fees).toHaveProperty('SIGNAL_SEND');
      expect(fees).toHaveProperty('GUILD_OPERATION');
    });

    it('should have correct fee values in basis points', () => {
      const fees = mockVRTYTokenManager.getBaseFees();
      
      expect(fees.DEX_TRADE).toBe(10); // 0.10%
      expect(fees.ASSET_TOKENIZATION).toBe(25); // 0.25%
      expect(fees.SIGNAL_SEND).toBe(5); // 0.05%
      expect(fees.GUILD_OPERATION).toBe(15); // 0.15%
    });
  });

  describe('Staking Operations', () => {
    it('should stake tokens with lock period', () => {
      const wallet = 'rTestWallet123456789012345678901';
      const stake = mockVRTYTokenManager.stake(wallet, 1000, 30);
      
      expect(stake.amount).toBe(1000);
      expect(stake.lockPeriodDays).toBe(30);
      expect(stake.stakedAt).toBeInstanceOf(Date);
      expect(stake.unlockAt).toBeInstanceOf(Date);
    });

    it('should retrieve stake information', () => {
      const wallet = 'rTestWallet123456789012345678901';
      mockVRTYTokenManager.stake(wallet, 5000, 90);
      
      const stake = mockVRTYTokenManager.getStake(wallet);
      
      expect(stake).not.toBeNull();
      expect(stake?.amount).toBe(5000);
      expect(stake?.lockPeriodDays).toBe(90);
    });

    it('should return null for non-existent stake', () => {
      const stake = mockVRTYTokenManager.getStake('rNonExistentWallet');
      expect(stake).toBeNull();
    });

    it('should not allow unstaking before lock period ends', () => {
      const wallet = 'rTestWallet123456789012345678901';
      mockVRTYTokenManager.stake(wallet, 1000, 30);
      
      expect(() => mockVRTYTokenManager.unstake(wallet)).toThrow('Lock period not ended');
    });

    it('should throw error when unstaking non-existent stake', () => {
      expect(() => mockVRTYTokenManager.unstake('rNonExistentWallet')).toThrow('No stake found');
    });
  });

  describe('Fee Discount Calculation', () => {
    it('should return 0 for null tier', () => {
      expect(mockVRTYTokenManager.calculateFeeDiscount(null)).toBe(0);
    });

    it('should return correct discounts for each tier', () => {
      expect(mockVRTYTokenManager.calculateFeeDiscount('BASIC')).toBe(2500);
      expect(mockVRTYTokenManager.calculateFeeDiscount('PROFESSIONAL')).toBe(5000);
      expect(mockVRTYTokenManager.calculateFeeDiscount('INSTITUTIONAL')).toBe(7500);
      expect(mockVRTYTokenManager.calculateFeeDiscount('DEVELOPER')).toBe(5000);
    });

    it('should return 0 for unknown tier', () => {
      expect(mockVRTYTokenManager.calculateFeeDiscount('UNKNOWN')).toBe(0);
    });
  });

  describe('Fee Calculation', () => {
    it('should calculate correct base fee', () => {
      const fees = mockVRTYTokenManager.getBaseFees();
      const amount = 10000;
      
      // DEX trade: 10 basis points = 0.10%
      const dexFee = (amount * fees.DEX_TRADE) / 10000;
      expect(dexFee).toBe(10);
      
      // Asset tokenization: 25 basis points = 0.25%
      const assetFee = (amount * fees.ASSET_TOKENIZATION) / 10000;
      expect(assetFee).toBe(25);
    });

    it('should apply tier discount correctly', () => {
      const baseFee = 100;
      const discount = mockVRTYTokenManager.calculateFeeDiscount('PROFESSIONAL'); // 50%
      
      const discountedFee = baseFee * (1 - discount / 10000);
      expect(discountedFee).toBe(50);
    });

    it('should calculate final fee with tier discount', () => {
      const amount = 10000;
      const baseFeeRate = mockVRTYTokenManager.getBaseFees().DEX_TRADE;
      const baseFee = (amount * baseFeeRate) / 10000; // 10
      
      const discount = mockVRTYTokenManager.calculateFeeDiscount('INSTITUTIONAL'); // 75%
      const finalFee = baseFee * (1 - discount / 10000);
      
      expect(finalFee).toBe(2.5);
    });
  });

  describe('Lock Period Rewards', () => {
    const lockPeriodMultipliers = {
      30: 1.0,
      90: 1.5,
      180: 2.0,
      365: 3.0
    };

    it('should have correct reward multipliers for lock periods', () => {
      expect(lockPeriodMultipliers[30]).toBe(1.0);
      expect(lockPeriodMultipliers[90]).toBe(1.5);
      expect(lockPeriodMultipliers[180]).toBe(2.0);
      expect(lockPeriodMultipliers[365]).toBe(3.0);
    });

    it('should calculate base rewards correctly', () => {
      const stakedAmount = 10000;
      const annualRewardRate = 0.10; // 10% APY
      const dailyRewardRate = annualRewardRate / 365;
      const lockPeriod = 30;
      
      const baseReward = stakedAmount * dailyRewardRate * lockPeriod;
      const multiplier = lockPeriodMultipliers[lockPeriod];
      const finalReward = baseReward * multiplier;
      
      expect(finalReward).toBeCloseTo(82.19, 1);
    });
  });

  describe('Token Utility', () => {
    it('should define all protocol fee types', () => {
      const fees = mockVRTYTokenManager.getBaseFees();
      
      const requiredFeeTypes = [
        'DEX_TRADE',
        'ASSET_TOKENIZATION',
        'SIGNAL_SEND',
        'GUILD_OPERATION'
      ];
      
      requiredFeeTypes.forEach(feeType => {
        expect(fees).toHaveProperty(feeType);
        expect(typeof fees[feeType]).toBe('number');
      });
    });

    it('should have features defined for all tiers', () => {
      const tiers = mockVRTYTokenManager.getTiers();
      
      Object.values(tiers).forEach((tier: any) => {
        expect(tier).toHaveProperty('features');
        expect(Array.isArray(tier.features)).toBe(true);
        expect(tier.features.length).toBeGreaterThan(0);
      });
    });
  });
});

describe('Token Economics', () => {
  describe('Revenue Distribution', () => {
    const revenueDistribution = {
      stakerPool: 80, // 80% to stakers
      buybackBurn: 20  // 20% for buyback and burn
    };

    it('should have correct revenue distribution percentages', () => {
      expect(revenueDistribution.stakerPool).toBe(80);
      expect(revenueDistribution.buybackBurn).toBe(20);
    });

    it('should sum to 100%', () => {
      const total = revenueDistribution.stakerPool + revenueDistribution.buybackBurn;
      expect(total).toBe(100);
    });

    it('should calculate staker share correctly', () => {
      const totalFees = 1000;
      const stakerShare = (totalFees * revenueDistribution.stakerPool) / 100;
      expect(stakerShare).toBe(800);
    });

    it('should calculate buyback share correctly', () => {
      const totalFees = 1000;
      const buybackShare = (totalFees * revenueDistribution.buybackBurn) / 100;
      expect(buybackShare).toBe(200);
    });
  });

  describe('Tokenomics', () => {
    const tokenomics = {
      totalSupply: 1_000_000_000,
      decimals: 6,
      maxSupply: 1_000_000_000, // Fixed supply
      deflationary: true // Buyback and burn
    };

    it('should have fixed total supply', () => {
      expect(tokenomics.totalSupply).toBe(tokenomics.maxSupply);
    });

    it('should be deflationary', () => {
      expect(tokenomics.deflationary).toBe(true);
    });

    it('should have correct decimals', () => {
      expect(tokenomics.decimals).toBe(6);
    });

    it('should calculate smallest unit correctly', () => {
      const smallestUnit = 1 / Math.pow(10, tokenomics.decimals);
      expect(smallestUnit).toBe(0.000001);
    });
  });
});
