/**
 * Verity Protocol - Guild Treasury Example
 * 
 * This example demonstrates multi-signature treasury
 * management for DAOs and collaborative groups.
 */

import { VeritySDK } from '@verity-protocol/sdk';
import type { GuildConfig } from '@verity-protocol/sdk';

async function demonstrateGuildTreasury() {
  const verity = new VeritySDK({
    network: 'testnet',
    enableVerification: true,
  });

  await verity.initialize();

  try {
    // Generate wallets for guild members
    const founderWallet = verity.generateWallet();
    const signer1Wallet = verity.generateWallet();
    const signer2Wallet = verity.generateWallet();
    const memberWallet = verity.generateWallet();

    // Fund wallets (testnet)
    await verity.fundWallet(founderWallet);
    await verity.fundWallet(signer1Wallet);
    await verity.fundWallet(signer2Wallet);

    console.log('✓ Guild member wallets funded');

    // Create guild configuration
    const guildConfig: GuildConfig = {
      name: 'DeFi Builders Guild',
      description: 'A collaborative treasury for DeFi developers',
      treasuryRules: {
        requiredSigners: 2, // 2-of-3 multisig
        totalSigners: 3,
        autoXRPConversion: true,
        recurringPayments: [
          {
            payee: memberWallet.address,
            amount: '100',
            currency: 'XRP',
            frequency: 'MONTHLY',
            description: 'Monthly contributor stipend',
            enabled: true,
          },
        ],
        revenueSharing: {
          enabled: true,
          distributionFrequency: 'MONTHLY',
          memberShares: [], // Will be set after guild creation
        },
        withdrawalLimits: [
          { currency: 'XRP', maxAmount: '1000', period: 'DAILY' },
        ],
      },
      membershipRules: {
        openMembership: false,
        requiredStake: '100',
        approvalRequired: true,
        maxMembers: 50,
      },
      governanceRules: {
        proposalThreshold: '1000',
        votingPeriod: 72, // 72 hours
        quorumPercentage: 3000, // 30%
        executionDelay: 24, // 24 hours
      },
    };

    // Create the guild
    const { guild } = await verity.guilds.create(
      founderWallet,
      guildConfig,
      [signer1Wallet.address, signer2Wallet.address]
    );

    console.log('✓ Guild created:', guild.id);
    console.log(`  Name: ${guild.name}`);
    console.log(`  Treasury: ${guild.treasuryWallet}`);

    // Add a regular member
    const newMember = verity.guilds.addMember(guild.id, {
      wallet: memberWallet.address,
      role: 'MEMBER',
      shares: 1000, // 10% share
      isSigner: false,
    });
    console.log('✓ Member added:', newMember.wallet);

    // Update member shares
    verity.guilds.updateShares(guild.id, [
      { member: founderWallet.address, sharePercentage: 5000 },  // 50%
      { member: signer1Wallet.address, sharePercentage: 2000 },  // 20%
      { member: signer2Wallet.address, sharePercentage: 2000 },  // 20%
      { member: memberWallet.address, sharePercentage: 1000 },   // 10%
    ]);
    console.log('✓ Member shares updated');

    // Create a payment request
    const paymentRequest = verity.guilds.createPaymentRequest(
      guild.id,
      founderWallet.address,
      'rVendor123...', // External vendor
      '500',
      'XRP',
      'Development services payment'
    );
    console.log('✓ Payment request created:', paymentRequest.id);

    // Sign the payment request (2 of 3 required)
    verity.guilds.signPayment(paymentRequest.id, founderWallet.address, true);
    console.log('✓ Payment signed by founder');

    verity.guilds.signPayment(paymentRequest.id, signer1Wallet.address, true);
    console.log('✓ Payment signed by signer1 - APPROVED');

    // Execute the approved payment
    const paymentResult = await verity.guilds.executePayment(
      paymentRequest.id,
      founderWallet
    );
    console.log('✓ Payment executed:', paymentResult.hash);

    // Execute automated payroll
    const payroll = await verity.guilds.executePayroll(guild.id, founderWallet);
    console.log('✓ Payroll executed:', payroll.id);
    console.log(`  Period: ${payroll.period}`);
    console.log(`  Total: ${payroll.totalAmount} XRP`);

    // Distribute revenue to members
    const distributions = await verity.guilds.distributeRevenue(
      guild.id,
      founderWallet,
      '1000', // 1000 XRP revenue
      'XRP'
    );
    console.log('✓ Revenue distributed to', distributions.length, 'members');

    // Get audit trail
    const auditTrail = verity.guilds.getAuditTrail(guild.id);
    console.log('✓ Audit Trail:', JSON.stringify(auditTrail, null, 2));

  } finally {
    await verity.disconnect();
  }
}

demonstrateGuildTreasury().catch(console.error);
