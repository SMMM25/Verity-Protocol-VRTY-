/**
 * Verity Protocol - Guild Treasury Unit Tests
 * Tests for multi-sig treasury management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { VerityGuildTreasury } from '../../src/guilds/GuildTreasury.js';

// Mock XRPLClient
const mockXRPLClient = {
  submitAndWait: vi.fn().mockResolvedValue({
    success: true,
    hash: 'MOCK_TX_HASH_123',
    result: { meta: { TransactionResult: 'tesSUCCESS' } },
  }),
  xrpToDrops: vi.fn((xrp: string) => (parseFloat(xrp) * 1000000).toString()),
  connected: vi.fn().mockReturnValue(true),
};

// Mock Wallet
const mockFounderWallet = {
  address: 'rFounder1234567890ABCDEF',
  seed: 'test_seed',
  publicKey: 'test_public_key',
  privateKey: 'test_private_key',
};

describe('VerityGuildTreasury', () => {
  let guildTreasury: VerityGuildTreasury;

  beforeEach(() => {
    vi.clearAllMocks();
    guildTreasury = new VerityGuildTreasury(mockXRPLClient as any);
  });

  describe('Guild Creation', () => {
    const defaultConfig = {
      name: 'Test Guild',
      description: 'A test guild for development',
      treasuryRules: {
        requiredSigners: 2,
        totalSigners: 3,
        autoXRPConversion: false,
        recurringPayments: [],
        revenueSharing: {
          enabled: true,
          distributionFrequency: 'MONTHLY' as const,
          memberShares: [],
        },
        withdrawalLimits: [],
      },
      membershipRules: {
        openMembership: false,
        approvalRequired: true,
        maxMembers: 100,
      },
      governanceRules: {
        proposalThreshold: '1000',
        votingPeriod: 168, // 7 days in hours
        quorumPercentage: 5000, // 50%
        executionDelay: 24,
      },
    };

    it('should create a guild with valid configuration', async () => {
      const initialSigners = ['rSigner1_Address', 'rSigner2_Address'];
      
      const result = await guildTreasury.createGuild(
        mockFounderWallet as any,
        defaultConfig,
        initialSigners
      );

      expect(result.guild).toBeDefined();
      expect(result.guild.name).toBe('Test Guild');
      expect(result.guild.id).toMatch(/^GLD_/);
      expect(result.guild.members.length).toBe(3); // Founder + 2 signers
      expect(result.result.success).toBe(true);
    });

    it('should set up multi-sig with correct quorum', async () => {
      const initialSigners = ['rSigner1_Address', 'rSigner2_Address'];
      
      await guildTreasury.createGuild(
        mockFounderWallet as any,
        defaultConfig,
        initialSigners
      );

      expect(mockXRPLClient.submitAndWait).toHaveBeenCalledWith(
        expect.objectContaining({
          TransactionType: 'SignerListSet',
          SignerQuorum: 2,
        }),
        expect.any(Object)
      );
    });

    it('should reject invalid guild configuration', async () => {
      const invalidConfig = {
        ...defaultConfig,
        name: '', // Empty name should fail
      };

      await expect(
        guildTreasury.createGuild(mockFounderWallet as any, invalidConfig, [])
      ).rejects.toThrow('Guild name is required');
    });

    it('should reject when required signers exceed total', async () => {
      const invalidConfig = {
        ...defaultConfig,
        treasuryRules: {
          ...defaultConfig.treasuryRules,
          requiredSigners: 5,
          totalSigners: 3,
        },
      };

      await expect(
        guildTreasury.createGuild(mockFounderWallet as any, invalidConfig, [])
      ).rejects.toThrow('Required signers cannot exceed total signers');
    });
  });

  describe('Member Management', () => {
    let guildId: string;

    beforeEach(async () => {
      const result = await guildTreasury.createGuild(
        mockFounderWallet as any,
        {
          name: 'Test Guild',
          description: 'Test',
          treasuryRules: {
            requiredSigners: 2,
            totalSigners: 3,
            autoXRPConversion: false,
            recurringPayments: [],
            revenueSharing: { enabled: true, distributionFrequency: 'MONTHLY', memberShares: [] },
            withdrawalLimits: [],
          },
          membershipRules: { openMembership: false, approvalRequired: true },
          governanceRules: {
            proposalThreshold: '1000',
            votingPeriod: 168,
            quorumPercentage: 5000,
            executionDelay: 24,
          },
        },
        ['rSigner1']
      );
      guildId = result.guild.id;
    });

    it('should add members to a guild', () => {
      const newMember = guildTreasury.addMember(guildId, {
        wallet: 'rNewMember_Address',
        role: 'MEMBER',
        shares: 1000,
        isSigner: false,
      });

      expect(newMember.wallet).toBe('rNewMember_Address');
      expect(newMember.role).toBe('MEMBER');
      expect(newMember.shares).toBe(1000);
    });

    it('should prevent duplicate members', () => {
      guildTreasury.addMember(guildId, {
        wallet: 'rNewMember_Address',
        role: 'MEMBER',
        shares: 1000,
        isSigner: false,
      });

      expect(() =>
        guildTreasury.addMember(guildId, {
          wallet: 'rNewMember_Address',
          role: 'MEMBER',
          shares: 1000,
          isSigner: false,
        })
      ).toThrow('Wallet is already a member');
    });

    it('should update member shares', () => {
      guildTreasury.addMember(guildId, {
        wallet: 'rMember1',
        role: 'MEMBER',
        shares: 0,
        isSigner: false,
      });

      const guild = guildTreasury.getGuild(guildId);
      
      // Get all members and their wallets
      const shares = guild!.members.map(m => ({
        member: m.wallet,
        sharePercentage: 0,
      }));

      // Distribute 10000 (100%) among members
      shares[0].sharePercentage = 5000; // Founder 50%
      shares[1].sharePercentage = 3000; // Signer1 30%
      shares[2].sharePercentage = 2000; // New member 20%

      guildTreasury.updateMemberShares(guildId, shares);

      const updatedGuild = guildTreasury.getGuild(guildId);
      const totalShares = updatedGuild!.members.reduce((sum, m) => sum + m.shares, 0);
      expect(totalShares).toBe(10000);
    });

    it('should require shares to total 100%', () => {
      expect(() =>
        guildTreasury.updateMemberShares(guildId, [
          { member: mockFounderWallet.address, sharePercentage: 5000 },
          // Missing members to total 10000
        ])
      ).toThrow('Total shares must equal 10000');
    });
  });

  describe('Payment Requests', () => {
    let guildId: string;

    beforeEach(async () => {
      const result = await guildTreasury.createGuild(
        mockFounderWallet as any,
        {
          name: 'Test Guild',
          description: 'Test',
          treasuryRules: {
            requiredSigners: 2,
            totalSigners: 3,
            autoXRPConversion: false,
            recurringPayments: [],
            revenueSharing: { enabled: true, distributionFrequency: 'MONTHLY', memberShares: [] },
            withdrawalLimits: [],
          },
          membershipRules: { openMembership: false, approvalRequired: true },
          governanceRules: {
            proposalThreshold: '1000',
            votingPeriod: 168,
            quorumPercentage: 5000,
            executionDelay: 24,
          },
        },
        ['rSigner1', 'rSigner2']
      );
      guildId = result.guild.id;
    });

    it('should create payment requests', () => {
      const request = guildTreasury.createPaymentRequest(
        guildId,
        mockFounderWallet.address,
        'rPayee_Address',
        '100',
        'XRP',
        'Test payment'
      );

      expect(request.id).toMatch(/^PAY_/);
      expect(request.status).toBe('pending');
      expect(request.requiredSignatures).toBe(2);
    });

    it('should only allow owners/admins to create requests', () => {
      expect(() =>
        guildTreasury.createPaymentRequest(
          guildId,
          'rUnknown_Address',
          'rPayee_Address',
          '100',
          'XRP',
          'Test payment'
        )
      ).toThrow('Only owners and admins can create payment requests');
    });

    it('should track signatures on payment requests', () => {
      const request = guildTreasury.createPaymentRequest(
        guildId,
        mockFounderWallet.address,
        'rPayee_Address',
        '100',
        'XRP',
        'Test payment'
      );

      // First signature
      let updated = guildTreasury.signPaymentRequest(request.id, mockFounderWallet.address, true);
      expect(updated.signatures.length).toBe(1);
      expect(updated.status).toBe('pending');

      // Second signature should approve
      updated = guildTreasury.signPaymentRequest(request.id, 'rSigner1', true);
      expect(updated.signatures.length).toBe(2);
      expect(updated.status).toBe('approved');
    });

    it('should reject payment requests with enough rejections', () => {
      const request = guildTreasury.createPaymentRequest(
        guildId,
        mockFounderWallet.address,
        'rPayee_Address',
        '100',
        'XRP',
        'Test payment'
      );

      // Two rejections (with 3 total signers, 2 required)
      guildTreasury.signPaymentRequest(request.id, mockFounderWallet.address, false);
      const updated = guildTreasury.signPaymentRequest(request.id, 'rSigner1', false);
      
      expect(updated.status).toBe('rejected');
    });

    it('should execute approved payments', async () => {
      const request = guildTreasury.createPaymentRequest(
        guildId,
        mockFounderWallet.address,
        'rPayee_Address',
        '100',
        'XRP',
        'Test payment'
      );

      guildTreasury.signPaymentRequest(request.id, mockFounderWallet.address, true);
      guildTreasury.signPaymentRequest(request.id, 'rSigner1', true);

      const result = await guildTreasury.executePayment(request.id, mockFounderWallet as any);

      expect(result.success).toBe(true);
      
      const updatedRequest = guildTreasury.getPaymentRequests(guildId).find(r => r.id === request.id);
      expect(updatedRequest?.status).toBe('executed');
      expect(updatedRequest?.transactionHash).toBe('MOCK_TX_HASH_123');
    });

    it('should prevent executing non-approved payments', async () => {
      const request = guildTreasury.createPaymentRequest(
        guildId,
        mockFounderWallet.address,
        'rPayee_Address',
        '100',
        'XRP',
        'Test payment'
      );

      await expect(
        guildTreasury.executePayment(request.id, mockFounderWallet as any)
      ).rejects.toThrow('Payment request is not approved');
    });
  });

  describe('Governance Proposals', () => {
    let guildId: string;

    beforeEach(async () => {
      const result = await guildTreasury.createGuild(
        mockFounderWallet as any,
        {
          name: 'Test Guild',
          description: 'Test',
          treasuryRules: {
            requiredSigners: 2,
            totalSigners: 3,
            autoXRPConversion: false,
            recurringPayments: [],
            revenueSharing: { enabled: true, distributionFrequency: 'MONTHLY', memberShares: [] },
            withdrawalLimits: [],
          },
          membershipRules: { openMembership: false, approvalRequired: true },
          governanceRules: {
            proposalThreshold: '1000',
            votingPeriod: 168,
            quorumPercentage: 5000,
            executionDelay: 24,
          },
        },
        ['rSigner1', 'rSigner2']
      );
      guildId = result.guild.id;
    });

    it('should create governance proposals', () => {
      const proposal = guildTreasury.createProposal(guildId, mockFounderWallet.address, {
        title: 'Test Proposal',
        description: 'A test proposal',
        type: 'RULE_CHANGE',
        payload: { newRule: 'value' },
      });

      expect(proposal.id).toMatch(/^PRP_/);
      expect(proposal.status).toBe('active');
      expect(proposal.votes.length).toBe(0);
    });

    it('should allow voting on proposals', () => {
      const proposal = guildTreasury.createProposal(guildId, mockFounderWallet.address, {
        title: 'Test Proposal',
        description: 'A test proposal',
        type: 'RULE_CHANGE',
        payload: {},
      });

      const updatedProposal = guildTreasury.voteOnProposal(
        proposal.id,
        mockFounderWallet.address,
        true
      );

      expect(updatedProposal.votes.length).toBe(1);
      expect(updatedProposal.votes[0].support).toBe(true);
    });

    it('should prevent double voting', () => {
      const proposal = guildTreasury.createProposal(guildId, mockFounderWallet.address, {
        title: 'Test Proposal',
        description: 'A test proposal',
        type: 'RULE_CHANGE',
        payload: {},
      });

      guildTreasury.voteOnProposal(proposal.id, mockFounderWallet.address, true);

      // Second vote should throw - either "Already voted" or "Proposal is not active" (if quorum was reached)
      expect(() =>
        guildTreasury.voteOnProposal(proposal.id, mockFounderWallet.address, false)
      ).toThrow();
    });
  });

  describe('Audit Trail', () => {
    let guildId: string;

    beforeEach(async () => {
      const result = await guildTreasury.createGuild(
        mockFounderWallet as any,
        {
          name: 'Test Guild',
          description: 'Test',
          treasuryRules: {
            requiredSigners: 2,
            totalSigners: 3,
            autoXRPConversion: false,
            recurringPayments: [],
            revenueSharing: { enabled: true, distributionFrequency: 'MONTHLY', memberShares: [] },
            withdrawalLimits: [],
          },
          membershipRules: { openMembership: false, approvalRequired: true },
          governanceRules: {
            proposalThreshold: '1000',
            votingPeriod: 168,
            quorumPercentage: 5000,
            executionDelay: 24,
          },
        },
        ['rSigner1']
      );
      guildId = result.guild.id;
    });

    it('should provide comprehensive audit trail', () => {
      const auditTrail = guildTreasury.getGuildAuditTrail(guildId);

      expect(auditTrail.guild).toBeDefined();
      expect(auditTrail.treasury).toBeDefined();
      expect(auditTrail.members).toBeDefined();
      expect(auditTrail.activity).toBeDefined();
      
      expect(auditTrail.guild).toHaveProperty('verificationHash');
      expect(auditTrail.treasury).toHaveProperty('requiredSigners');
    });
  });
});
