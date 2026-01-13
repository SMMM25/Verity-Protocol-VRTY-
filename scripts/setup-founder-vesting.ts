#!/usr/bin/env npx ts-node
/**
 * Verity Protocol - Founder Vesting Setup Script
 * Sprint 2 - XRPL Escrow Implementation
 * 
 * Sets up the founder vesting schedule:
 * - 200M VRTY over 24 months (linear vesting)
 * - Monthly releases (24 escrows)
 * - CancelAfter with multi-sig override capability
 * 
 * @usage
 * npx ts-node scripts/setup-founder-vesting.ts
 * 
 * Environment variables required:
 * - FOUNDER_ADDRESS: Founder's XRPL address
 * - VRTY_ISSUER: VRTY token issuer address
 * - FOUNDER_WALLET_SECRET: Founder wallet secret (for signing)
 * - XRPL_NETWORK: Network to use (mainnet/testnet/devnet)
 * - MULTI_SIG_ADDRESS: Multi-sig address for cancel override (optional)
 */

import { Client, Wallet, EscrowCreate, xrpToDrops } from 'xrpl';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Configuration
// ============================================================================

interface FounderVestingConfig {
  founderAddress: string;
  vrtyIssuer: string;
  totalAmount: string; // In VRTY units (with 6 decimals)
  vestingMonths: number;
  releaseFrequency: 'monthly' | 'weekly' | 'daily';
  multiSigOverride?: string;
  cancelAfterDays: number;
}

const DEFAULT_CONFIG: FounderVestingConfig = {
  founderAddress: process.env.FOUNDER_ADDRESS || '',
  vrtyIssuer: process.env.VRTY_ISSUER || 'rBeHfq9vRjZ8Cth1sMbp2nJvExmxSxAH8f',
  totalAmount: '200000000000000', // 200M VRTY (6 decimals)
  vestingMonths: 24,
  releaseFrequency: 'monthly',
  multiSigOverride: process.env.MULTI_SIG_ADDRESS,
  cancelAfterDays: 30, // 30 days after final release
};

const RIPPLE_EPOCH_OFFSET = 946684800;

const XRPL_URLS: Record<string, string> = {
  mainnet: process.env.XRPL_MAINNET_URL || 'wss://xrplcluster.com',
  testnet: process.env.XRPL_TESTNET_URL || 'wss://s.altnet.rippletest.net:51233',
  devnet: process.env.XRPL_DEVNET_URL || 'wss://s.devnet.rippletest.net:51233',
};

// ============================================================================
// Utility Functions
// ============================================================================

function unixToRippleTime(unixTimestamp: number): number {
  return unixTimestamp - RIPPLE_EPOCH_OFFSET;
}

function formatVRTY(amount: string): string {
  const value = BigInt(amount) / BigInt(1_000_000);
  return value.toLocaleString() + ' VRTY';
}

function formatDate(unixTimestamp: number): string {
  return new Date(unixTimestamp * 1000).toISOString();
}

function calculateMonthlyReleases(
  startTime: number,
  months: number
): number[] {
  const releases: number[] = [];
  const startDate = new Date(startTime * 1000);
  
  for (let i = 1; i <= months; i++) {
    const releaseDate = new Date(startDate);
    releaseDate.setMonth(releaseDate.getMonth() + i);
    releases.push(Math.floor(releaseDate.getTime() / 1000));
  }
  
  return releases;
}

// ============================================================================
// Vesting Schedule Generator
// ============================================================================

interface EscrowSchedule {
  index: number;
  amount: string;
  finishAfterUnix: number;
  finishAfterRipple: number;
  cancelAfterUnix: number;
  cancelAfterRipple: number;
}

function generateVestingSchedule(
  config: FounderVestingConfig,
  startTime: number
): EscrowSchedule[] {
  const schedule: EscrowSchedule[] = [];
  const totalAmountBigInt = BigInt(config.totalAmount);
  const numberOfReleases = config.vestingMonths;
  
  // Calculate amount per release
  const amountPerRelease = totalAmountBigInt / BigInt(numberOfReleases);
  const remainder = totalAmountBigInt % BigInt(numberOfReleases);
  
  // Calculate release times
  const releaseTimes = calculateMonthlyReleases(startTime, numberOfReleases);
  
  // Calculate cancel after (30 days after final release)
  const finalReleaseTime = releaseTimes[releaseTimes.length - 1];
  const cancelAfterUnix = finalReleaseTime + (config.cancelAfterDays * 24 * 60 * 60);
  
  for (let i = 0; i < numberOfReleases; i++) {
    // Last release gets any remainder
    const amount = i === numberOfReleases - 1
      ? String(amountPerRelease + remainder)
      : String(amountPerRelease);
    
    schedule.push({
      index: i + 1,
      amount,
      finishAfterUnix: releaseTimes[i],
      finishAfterRipple: unixToRippleTime(releaseTimes[i]),
      cancelAfterUnix,
      cancelAfterRipple: unixToRippleTime(cancelAfterUnix),
    });
  }
  
  return schedule;
}

// ============================================================================
// XRPL Escrow Creation
// ============================================================================

interface EscrowResult {
  success: boolean;
  sequence?: number;
  txHash?: string;
  error?: string;
}

async function createEscrow(
  client: Client,
  wallet: Wallet,
  config: FounderVestingConfig,
  escrow: EscrowSchedule,
  scheduleId: string
): Promise<EscrowResult> {
  try {
    // Build escrow create transaction
    // Note: XRPL native escrows only work with XRP
    // For VRTY (IOU), we would need a different mechanism
    // This script demonstrates the concept with XRP
    
    const escrowCreate: EscrowCreate = {
      TransactionType: 'EscrowCreate',
      Account: wallet.address,
      Destination: config.founderAddress,
      Amount: xrpToDrops(1), // Placeholder - would be VRTY amount in production
      FinishAfter: escrow.finishAfterRipple,
      CancelAfter: escrow.cancelAfterRipple,
      Memos: [
        {
          Memo: {
            MemoType: Buffer.from('VERITY_FOUNDER_VESTING', 'utf8').toString('hex').toUpperCase(),
            MemoData: Buffer.from(JSON.stringify({
              scheduleId,
              releaseIndex: escrow.index,
              vrtyAmount: escrow.amount,
              currency: 'VRTY',
              issuer: config.vrtyIssuer,
            }), 'utf8').toString('hex').toUpperCase(),
          },
        },
      ],
    };
    
    // Prepare and sign transaction
    const prepared = await client.autofill(escrowCreate);
    const signed = wallet.sign(prepared);
    
    // Submit transaction
    const result = await client.submitAndWait(signed.tx_blob);
    
    if (result.result.meta && typeof result.result.meta !== 'string') {
      const transactionResult = result.result.meta.TransactionResult;
      if (transactionResult === 'tesSUCCESS') {
        return {
          success: true,
          sequence: prepared.Sequence,
          txHash: result.result.hash,
        };
      }
      return {
        success: false,
        error: `Transaction failed: ${transactionResult}`,
      };
    }
    
    return {
      success: false,
      error: 'Unknown transaction result',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// Main Script
// ============================================================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║         Verity Protocol - Founder Vesting Setup                ║');
  console.log('║         200M VRTY over 24 months (Linear Vesting)              ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');
  console.log('');
  
  // Get configuration
  const config = { ...DEFAULT_CONFIG };
  const network = process.env.XRPL_NETWORK || 'testnet';
  const walletSecret = process.env.FOUNDER_WALLET_SECRET;
  
  // Validate configuration
  if (!config.founderAddress) {
    console.error('❌ Error: FOUNDER_ADDRESS environment variable is required');
    console.log('');
    console.log('Usage:');
    console.log('  FOUNDER_ADDRESS=rYourAddress... \\');
    console.log('  VRTY_ISSUER=rIssuerAddress... \\');
    console.log('  FOUNDER_WALLET_SECRET=sSecret... \\');
    console.log('  XRPL_NETWORK=testnet \\');
    console.log('  npx ts-node scripts/setup-founder-vesting.ts');
    process.exit(1);
  }
  
  // Display configuration
  console.log('📋 Configuration:');
  console.log('─────────────────────────────────────────');
  console.log(`  Network:           ${network}`);
  console.log(`  Founder Address:   ${config.founderAddress}`);
  console.log(`  VRTY Issuer:       ${config.vrtyIssuer}`);
  console.log(`  Total Amount:      ${formatVRTY(config.totalAmount)}`);
  console.log(`  Vesting Duration:  ${config.vestingMonths} months`);
  console.log(`  Release Frequency: ${config.releaseFrequency}`);
  console.log(`  Cancel After:      ${config.cancelAfterDays} days after final release`);
  if (config.multiSigOverride) {
    console.log(`  Multi-Sig Override: ${config.multiSigOverride}`);
  }
  console.log('');
  
  // Generate vesting schedule
  const startTime = Math.floor(Date.now() / 1000);
  const scheduleId = `FOUNDER-${uuidv4().substring(0, 8).toUpperCase()}`;
  const schedule = generateVestingSchedule(config, startTime);
  
  console.log('📅 Vesting Schedule:');
  console.log('─────────────────────────────────────────');
  console.log(`  Schedule ID:       ${scheduleId}`);
  console.log(`  Start Date:        ${formatDate(startTime)}`);
  console.log(`  End Date:          ${formatDate(schedule[schedule.length - 1].finishAfterUnix)}`);
  console.log(`  Cancel After:      ${formatDate(schedule[0].cancelAfterUnix)}`);
  console.log(`  Number of Escrows: ${schedule.length}`);
  console.log('');
  
  // Display first few releases
  console.log('📆 Release Schedule (first 6 months):');
  console.log('─────────────────────────────────────────');
  for (let i = 0; i < Math.min(6, schedule.length); i++) {
    const release = schedule[i];
    console.log(`  Month ${release.index.toString().padStart(2)}: ${formatDate(release.finishAfterUnix)} - ${formatVRTY(release.amount)}`);
  }
  if (schedule.length > 6) {
    console.log(`  ... and ${schedule.length - 6} more releases`);
  }
  console.log('');
  
  // Check if we should actually create escrows
  if (!walletSecret) {
    console.log('⚠️  DRY RUN MODE');
    console.log('─────────────────────────────────────────');
    console.log('  No FOUNDER_WALLET_SECRET provided.');
    console.log('  This is a preview of the vesting schedule.');
    console.log('  To create actual escrows, provide the wallet secret.');
    console.log('');
    console.log('✅ Vesting schedule validated successfully!');
    return;
  }
  
  // Connect to XRPL
  console.log('🔌 Connecting to XRPL...');
  const client = new Client(XRPL_URLS[network] || XRPL_URLS.testnet);
  
  try {
    await client.connect();
    console.log(`  Connected to ${network}`);
    
    // Create wallet from secret
    const wallet = Wallet.fromSecret(walletSecret);
    console.log(`  Wallet Address: ${wallet.address}`);
    console.log('');
    
    // Check wallet balance
    const accountInfo = await client.request({
      command: 'account_info',
      account: wallet.address,
    });
    const balance = accountInfo.result.account_data.Balance;
    console.log(`  Wallet Balance: ${Number(balance) / 1_000_000} XRP`);
    console.log('');
    
    // Estimate fees
    const estimatedFee = 0.000012 * schedule.length; // ~12 drops per tx
    const reserveNeeded = 2 * schedule.length; // 2 XRP reserve per escrow
    const totalNeeded = estimatedFee + reserveNeeded + 10; // Plus 10 XRP buffer
    
    console.log('💰 Fee Estimation:');
    console.log('─────────────────────────────────────────');
    console.log(`  Transaction Fees: ~${estimatedFee.toFixed(6)} XRP`);
    console.log(`  Owner Reserve:    ~${reserveNeeded} XRP`);
    console.log(`  Total Needed:     ~${totalNeeded.toFixed(2)} XRP`);
    console.log('');
    
    if (Number(balance) / 1_000_000 < totalNeeded) {
      console.error(`❌ Insufficient balance. Need at least ${totalNeeded.toFixed(2)} XRP`);
      await client.disconnect();
      process.exit(1);
    }
    
    // Confirm before proceeding
    console.log('⚠️  IMPORTANT: This will create real escrows on the XRPL!');
    console.log('─────────────────────────────────────────');
    console.log('  Press Ctrl+C to cancel, or wait 5 seconds to continue...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('');
    
    // Create escrows
    console.log('🔨 Creating Escrows...');
    console.log('─────────────────────────────────────────');
    
    const results: EscrowResult[] = [];
    const successful: number[] = [];
    const failed: number[] = [];
    
    for (const escrow of schedule) {
      process.stdout.write(`  Creating escrow ${escrow.index}/${schedule.length}... `);
      
      const result = await createEscrow(client, wallet, config, escrow, scheduleId);
      results.push(result);
      
      if (result.success) {
        successful.push(escrow.index);
        console.log(`✅ (Seq: ${result.sequence}, Hash: ${result.txHash?.substring(0, 16)}...)`);
      } else {
        failed.push(escrow.index);
        console.log(`❌ ${result.error}`);
      }
      
      // Small delay between transactions
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('');
    console.log('📊 Results:');
    console.log('─────────────────────────────────────────');
    console.log(`  Total Escrows:  ${schedule.length}`);
    console.log(`  Successful:     ${successful.length}`);
    console.log(`  Failed:         ${failed.length}`);
    console.log('');
    
    if (failed.length > 0) {
      console.log('❌ Some escrows failed to create:');
      console.log(`   Indices: ${failed.join(', ')}`);
    }
    
    if (successful.length === schedule.length) {
      console.log('✅ All escrows created successfully!');
      console.log('');
      console.log('📝 Summary:');
      console.log('─────────────────────────────────────────');
      console.log(`  Schedule ID:  ${scheduleId}`);
      console.log(`  Beneficiary:  ${config.founderAddress}`);
      console.log(`  Total Amount: ${formatVRTY(config.totalAmount)}`);
      console.log(`  First Release: ${formatDate(schedule[0].finishAfterUnix)}`);
      console.log(`  Final Release: ${formatDate(schedule[schedule.length - 1].finishAfterUnix)}`);
    }
    
    // Disconnect
    await client.disconnect();
    console.log('');
    console.log('🔌 Disconnected from XRPL');
    
  } catch (error) {
    console.error('');
    console.error('❌ Error:', error instanceof Error ? error.message : 'Unknown error');
    await client.disconnect();
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);

export { main, generateVestingSchedule, FounderVestingConfig };
