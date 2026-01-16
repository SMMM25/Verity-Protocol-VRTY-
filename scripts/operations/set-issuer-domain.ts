/**
 * VRTY Token Domain Verification Script
 * 
 * This script sets the Domain field on the VRTY issuer account to verify
 * ownership of verityprotocol.io domain as per XLS-26 standard.
 * 
 * IMPORTANT: This requires the issuer wallet secret/seed.
 * The issuer address: rBeHfq9vRjZ8Cth1sMbp2nJvExmxSxAH8f
 * 
 * Usage:
 *   ISSUER_WALLET_SECRET=sXXXXXX npx ts-node scripts/operations/set-issuer-domain.ts --dry-run
 *   ISSUER_WALLET_SECRET=sXXXXXX npx ts-node scripts/operations/set-issuer-domain.ts --execute
 * 
 * Prerequisites:
 * 1. The xrp-ledger.toml file must be hosted at:
 *    https://verityprotocol.io/.well-known/xrp-ledger.toml
 * 2. The logo must be hosted at:
 *    https://verityprotocol.io/assets/branding/vrty-logo.png
 */

import * as xrpl from 'xrpl';

// Configuration
const DOMAIN = 'verityprotocol.io';
const ISSUER_ADDRESS = 'rBeHfq9vRjZ8Cth1sMbp2nJvExmxSxAH8f';
const XRPL_MAINNET = 'wss://xrplcluster.com';

// Convert domain to hex for XRPL
function domainToHex(domain: string): string {
  return Buffer.from(domain, 'ascii').toString('hex').toUpperCase();
}

async function setIssuerDomain(dryRun: boolean = true): Promise<void> {
  console.log('='.repeat(60));
  console.log('VRTY Token Domain Verification');
  console.log('='.repeat(60));
  console.log(`Domain: ${DOMAIN}`);
  console.log(`Issuer: ${ISSUER_ADDRESS}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no transactions)' : 'EXECUTE (real transactions)'}`);
  console.log('='.repeat(60));

  // Check for wallet secret
  const walletSecret = process.env.ISSUER_WALLET_SECRET;
  if (!walletSecret && !dryRun) {
    console.error('\n❌ ERROR: ISSUER_WALLET_SECRET environment variable not set');
    console.error('Set it with: ISSUER_WALLET_SECRET=sXXXXXX npx ts-node ...');
    process.exit(1);
  }

  // Connect to XRPL
  console.log('\n📡 Connecting to XRPL Mainnet...');
  const client = new xrpl.Client(XRPL_MAINNET);
  await client.connect();
  console.log('✅ Connected to XRPL');

  try {
    // Check current account info
    console.log('\n🔍 Checking current issuer account...');
    const accountInfo = await client.request({
      command: 'account_info',
      account: ISSUER_ADDRESS,
      ledger_index: 'validated'
    });

    const currentDomain = accountInfo.result.account_data.Domain;
    if (currentDomain) {
      const decodedDomain = Buffer.from(currentDomain, 'hex').toString('ascii');
      console.log(`Current Domain: ${decodedDomain}`);
      
      if (decodedDomain === DOMAIN) {
        console.log('\n✅ Domain already set correctly! No action needed.');
        await client.disconnect();
        return;
      }
    } else {
      console.log('Current Domain: (not set)');
    }

    // Prepare the AccountSet transaction
    const domainHex = domainToHex(DOMAIN);
    console.log(`\n📝 Domain hex: ${domainHex}`);

    const txJson: xrpl.AccountSet = {
      TransactionType: 'AccountSet',
      Account: ISSUER_ADDRESS,
      Domain: domainHex,
    };

    console.log('\n📄 Transaction:');
    console.log(JSON.stringify(txJson, null, 2));

    if (dryRun) {
      console.log('\n🔶 DRY RUN - Transaction not submitted');
      console.log('To execute, run with --execute flag');
    } else {
      // Create wallet from secret
      const wallet = xrpl.Wallet.fromSeed(walletSecret!);
      
      if (wallet.address !== ISSUER_ADDRESS) {
        console.error('\n❌ ERROR: Wallet address does not match issuer address');
        console.error(`Expected: ${ISSUER_ADDRESS}`);
        console.error(`Got: ${wallet.address}`);
        process.exit(1);
      }

      console.log('\n🚀 Submitting transaction...');
      const prepared = await client.autofill(txJson);
      const signed = wallet.sign(prepared);
      const result = await client.submitAndWait(signed.tx_blob);

      if (typeof result.result.meta === 'object' && 
          result.result.meta !== null && 
          'TransactionResult' in result.result.meta) {
        const txResult = result.result.meta.TransactionResult;
        if (txResult === 'tesSUCCESS') {
          console.log('\n✅ SUCCESS! Domain set on issuer account');
          console.log(`Transaction hash: ${result.result.hash}`);
          console.log(`Explorer: https://livenet.xrpl.org/transactions/${result.result.hash}`);
        } else {
          console.error(`\n❌ Transaction failed: ${txResult}`);
        }
      }
    }

    // Verify the xrp-ledger.toml is accessible
    console.log('\n📋 Next Steps:');
    console.log('1. Deploy the updated code to verityprotocol.io');
    console.log('2. Verify xrp-ledger.toml is accessible at:');
    console.log(`   https://${DOMAIN}/.well-known/xrp-ledger.toml`);
    console.log('3. Verify logo is accessible at:');
    console.log(`   https://${DOMAIN}/assets/branding/vrty-logo.png`);
    console.log('4. The token metadata will be picked up by XRPL explorers and wallets');

  } finally {
    await client.disconnect();
    console.log('\n📡 Disconnected from XRPL');
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = !args.includes('--execute');

setIssuerDomain(dryRun).catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
