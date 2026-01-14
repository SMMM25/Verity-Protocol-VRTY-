#!/usr/bin/env npx ts-node
/**
 * Verity Protocol - VRTY Escrow Setup Script
 * 
 * @description Sets up the 50-month escrow release schedule for VRTY tokens.
 * 
 * IMPORTANT: This script requires access to the treasury wallet.
 * Only run this once to initialize the escrow system.
 * 
 * Usage:
 *   npx ts-node scripts/escrow/setup-escrow.ts [command]
 * 
 * Commands:
 *   generate   - Generate release schedule (no transactions)
 *   verify     - Verify current balances and setup
 *   status     - Show escrow status
 *   export     - Export schedule to JSON
 */

import { Wallet } from 'xrpl';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// Import from correct modules (Fixed BUG-001)
import { 
  TokenDistributionService, 
  getTokenDistributionService 
} from '../../src/escrow/TokenDistributionService.js';
import { 
  DistributionConfig, 
  ReleaseSchedule 
} from '../../src/escrow/distributionTypes.js';

// ============================================================
// CONFIGURATION
// ============================================================

const CONFIG: Partial<DistributionConfig> = {
  network: (process.env['XRPL_NETWORK'] as 'mainnet' | 'testnet' | 'devnet') || 'mainnet',
  issuerAddress: process.env['VRTY_ISSUER_ADDRESS'] || 'rBeHfq9vRjZ8Cth1sMbp2nJvExmxSxAH8f',
  currencyCode: 'VRTY',
  totalAmount: '1000000000', // 1 billion
  totalMonths: 50,
  releaseDestination: process.env['VRTY_DISTRIBUTION_WALLET'] || 'rLmLMErLKDzWXyYmcZGHqQ3SCgTVJCVjA3',
};

const OUTPUT_DIR = './escrow-data';

// ============================================================
// HELPERS
// ============================================================

function ensureOutputDir(): void {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
}

function formatNumber(num: string | number): string {
  return Number(num).toLocaleString();
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

async function promptConfirmation(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`\n${message} (yes/no): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes');
    });
  });
}

// ============================================================
// COMMANDS
// ============================================================

/**
 * Generate and display the release schedule
 */
async function generateSchedule(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('  VRTY ESCROW RELEASE SCHEDULE GENERATOR');
  console.log('='.repeat(60) + '\n');

  const service = getTokenDistributionService(CONFIG);
  const schedule = service.generateReleaseSchedule();

  console.log('📋 Configuration:');
  console.log(`   Network: ${CONFIG.network}`);
  console.log(`   Issuer: ${CONFIG.issuerAddress}`);
  console.log(`   Total Supply: ${formatNumber(CONFIG.totalAmount!)} VRTY`);
  console.log(`   Release Period: ${CONFIG.totalMonths} months`);
  console.log(`   Destination: ${CONFIG.releaseDestination}`);

  console.log('\n📅 Release Schedule:');
  console.log('-'.repeat(80));
  console.log('| Month | Date                | Amount          | %    | Cumulative      | Cum % |');
  console.log('-'.repeat(80));

  // Group by phase for display
  const phases = [
    { name: 'Phase 1 (1.5%/mo)', start: 1, end: 12 },
    { name: 'Phase 2 (2.0%/mo)', start: 13, end: 24 },
    { name: 'Phase 3 (2.0%/mo)', start: 25, end: 36 },
    { name: 'Phase 4 (2.5%/mo)', start: 37, end: 48 },
    { name: 'Phase 5 (3.5%/mo)', start: 49, end: 50 },
  ];

  for (const phase of phases) {
    console.log(`\n  ${phase.name}`);
    
    for (const entry of schedule.entries) {
      if (entry.month >= phase.start && entry.month <= phase.end) {
        const date = formatDate(entry.releaseDate).padEnd(18);
        const amount = formatNumber(entry.amount).padStart(15);
        const pct = entry.percentage.toFixed(1).padStart(4);
        const cumAmount = formatNumber(entry.cumulativeReleased).padStart(15);
        const cumPct = entry.cumulativePercentage.toFixed(1).padStart(5);
        
        console.log(`| ${String(entry.month).padStart(5)} | ${date} | ${amount} | ${pct} | ${cumAmount} | ${cumPct} |`);
      }
    }
  }

  console.log('-'.repeat(80));
  
  // Summary
  const totalReleased = schedule.entries.reduce(
    (sum, e) => sum + BigInt(e.amount),
    BigInt(0)
  );
  
  console.log('\n📊 Summary:');
  console.log(`   Total Scheduled: ${formatNumber(totalReleased.toString())} VRTY`);
  console.log(`   First Release: ${formatDate(schedule.entries[0].releaseDate)}`);
  console.log(`   Last Release: ${formatDate(schedule.entries[schedule.entries.length - 1].releaseDate)}`);

  // Save option
  const save = await promptConfirmation('Save schedule to file?');
  if (save) {
    ensureOutputDir();
    const filepath = path.join(OUTPUT_DIR, 'release-schedule.json');
    fs.writeFileSync(filepath, JSON.stringify(schedule, null, 2));
    console.log(`\n✅ Schedule saved to: ${filepath}`);
  }
}

/**
 * Verify current state
 */
async function verifySetup(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('  VRTY ESCROW VERIFICATION');
  console.log('='.repeat(60) + '\n');

  const service = getTokenDistributionService(CONFIG);

  console.log('🔗 Connecting to XRPL...');
  await service.connect();

  try {
    // Check issuer balance
    console.log('\n📊 Checking balances...\n');
    
    const issuerBalance = await service.getVRTYBalance(CONFIG.issuerAddress!);
    console.log(`   Issuer (${CONFIG.issuerAddress})`);
    console.log(`   VRTY Balance: ${formatNumber(issuerBalance)}`);

    const distributionBalance = await service.getVRTYBalance(CONFIG.releaseDestination!);
    console.log(`\n   Distribution (${CONFIG.releaseDestination})`);
    console.log(`   VRTY Balance: ${formatNumber(distributionBalance)}`);

    // Check distribution status
    const status = await service.getDistributionStatus();
    console.log('\n📋 Distribution Status:');
    console.log(`   Total Scheduled: ${status.totalScheduled}`);
    console.log(`   Pending: ${status.pendingReleases}`);
    console.log(`   Released: ${status.releasedCount}`);
    console.log(`   In Schedule: ${formatNumber(status.totalInSchedule)} VRTY`);
    console.log(`   Released: ${formatNumber(status.totalReleased)} VRTY`);

    if (status.nextRelease) {
      console.log(`\n   Next Release:`);
      console.log(`   Date: ${formatDate(status.nextRelease.date)}`);
      console.log(`   Amount: ${formatNumber(status.nextRelease.amount)} VRTY`);
    }

  } finally {
    await service.disconnect();
  }
}

/**
 * Show current status
 */
async function showStatus(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('  VRTY ESCROW STATUS');
  console.log('='.repeat(60) + '\n');

  const service = getTokenDistributionService(CONFIG);
  const data = service.getPublicEscrowData();

  console.log('📊 Token Distribution:');
  console.log(`   Total Supply: ${formatNumber(data.distribution.totalSupply)} VRTY`);
  console.log(`   Circulating: ${formatNumber(data.distribution.circulatingSupply)} VRTY`);
  console.log(`   In Escrow: ${formatNumber(data.distribution.inEscrow)} VRTY`);

  console.log('\n📋 Allocations:');
  for (const alloc of data.distribution.allocations) {
    console.log(`\n   ${alloc.category} (${alloc.percentage}%)`);
    console.log(`   Total: ${formatNumber(alloc.totalAllocated)} VRTY`);
    console.log(`   Released: ${formatNumber(alloc.released)} VRTY`);
    console.log(`   Remaining: ${formatNumber(alloc.remaining)} VRTY`);
    if (alloc.vestingMonths) {
      console.log(`   Vesting: ${alloc.vestingMonths} months`);
    }
    if (alloc.cliffMonths) {
      console.log(`   Cliff: ${alloc.cliffMonths} months`);
    }
  }

  console.log('\n📅 Release Schedule:');
  console.log(`   Total Months: ${data.config.totalMonths}`);
  console.log(`   Start: ${formatDate(data.schedule.createdAt)}`);
  
  if (data.schedule.nextReleaseDate) {
    console.log(`   Next Release: ${formatDate(data.schedule.nextReleaseDate)}`);
    console.log(`   Next Amount: ${formatNumber(data.schedule.nextReleaseAmount!)} VRTY`);
  }
}

/**
 * Export schedule to JSON
 */
async function exportSchedule(): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('  EXPORT ESCROW DATA');
  console.log('='.repeat(60) + '\n');

  ensureOutputDir();

  const service = getTokenDistributionService(CONFIG);
  const data = service.getPublicEscrowData();

  // Export release schedule
  const schedulePath = path.join(OUTPUT_DIR, 'release-schedule.json');
  fs.writeFileSync(schedulePath, JSON.stringify(data.schedule, null, 2));
  console.log(`✅ Release schedule: ${schedulePath}`);

  // Export distribution
  const distributionPath = path.join(OUTPUT_DIR, 'token-distribution.json');
  fs.writeFileSync(distributionPath, JSON.stringify(data.distribution, null, 2));
  console.log(`✅ Token distribution: ${distributionPath}`);

  // Export config (public parts only)
  const configPath = path.join(OUTPUT_DIR, 'escrow-config.json');
  fs.writeFileSync(configPath, JSON.stringify(data.config, null, 2));
  console.log(`✅ Escrow config: ${configPath}`);

  // Export summary for whitepaper
  const summary = {
    overview: {
      totalSupply: '1,000,000,000 VRTY',
      escrowPeriod: '50 months',
      issuer: CONFIG.issuerAddress,
      distribution: CONFIG.releaseDestination,
    },
    phases: [
      { months: '1-12', percentPerMonth: '1.5%', totalPercent: '15%' },
      { months: '13-24', percentPerMonth: '2.0%', totalPercent: '24%' },
      { months: '25-36', percentPerMonth: '2.0%', totalPercent: '24%' },
      { months: '37-48', percentPerMonth: '2.5%', totalPercent: '30%' },
      { months: '49-50', percentPerMonth: '3.5%', totalPercent: '7%' },
    ],
    allocations: [
      { category: 'Protocol Treasury', percent: '65%', amount: '650,000,000' },
      { category: 'Founder', percent: '20%', amount: '200,000,000' },
      { category: 'Ecosystem Fund', percent: '15%', amount: '150,000,000' },
    ],
    generatedAt: new Date().toISOString(),
  };

  const summaryPath = path.join(OUTPUT_DIR, 'escrow-summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`✅ Escrow summary: ${summaryPath}`);

  console.log(`\n📁 All files exported to: ${OUTPUT_DIR}/`);
}

// ============================================================
// CLI
// ============================================================

async function main(): Promise<void> {
  const command = process.argv[2] || 'help';

  try {
    switch (command) {
      case 'generate':
        await generateSchedule();
        break;

      case 'verify':
        await verifySetup();
        break;

      case 'status':
        await showStatus();
        break;

      case 'export':
        await exportSchedule();
        break;

      case 'help':
      default:
        console.log(`
╔══════════════════════════════════════════════════════════════╗
║     VRTY Escrow Setup Script                                 ║
║     Verity Protocol Token Distribution                       ║
╚══════════════════════════════════════════════════════════════╝

Commands:
  generate   Generate and display the 50-month release schedule
  verify     Verify balances and escrow setup on XRPL
  status     Show current escrow status and distribution
  export     Export all escrow data to JSON files

Environment Variables:
  XRPL_NETWORK              Network (mainnet, testnet, devnet)
  VRTY_ISSUER_ADDRESS       VRTY token issuer address
  VRTY_DISTRIBUTION_WALLET  Destination for released tokens

Examples:
  npx ts-node scripts/escrow/setup-escrow.ts generate
  npx ts-node scripts/escrow/setup-escrow.ts verify
  XRPL_NETWORK=testnet npx ts-node scripts/escrow/setup-escrow.ts status

Configuration:
  Total Supply: 1,000,000,000 VRTY
  Escrow Period: 50 months
  Issuer: ${CONFIG.issuerAddress}
  Distribution: ${CONFIG.releaseDestination}
        `);
    }
  } catch (error) {
    console.error('\n❌ Error:', (error as Error).message);
    process.exit(1);
  }
}

main();
