#!/usr/bin/env npx ts-node
/**
 * Quick script to check issuer account details on XRPL
 */

import { Client } from 'xrpl';

const ISSUER = 'rBeHfq9vRjZ8Cth1sMbp2nJvExmxSxAH8f';
const TREASURY = 'rLmLMErLKDzWXyYmcZGHqQ3SCgTVJCVjA3';

async function main() {
  const network = process.env['XRPL_NETWORK'] || 'mainnet';
  const endpoint = network === 'mainnet' 
    ? 'wss://xrplcluster.com' 
    : 'wss://s.altnet.rippletest.net:51233';
  
  console.log(`\n🔗 Connecting to XRPL ${network}...`);
  const client = new Client(endpoint);
  await client.connect();
  console.log('✅ Connected\n');

  try {
    // Check issuer account
    console.log('=== ISSUER ACCOUNT ===');
    console.log(`Address: ${ISSUER}`);
    
    const issuerInfo = await client.request({
      command: 'account_info',
      account: ISSUER,
    });
    console.log('Account exists: YES');
    console.log(`XRP Balance: ${Number(issuerInfo.result.account_data.Balance) / 1000000} XRP`);
    console.log(`Flags: ${issuerInfo.result.account_data.Flags}`);
    
    // Check gateway balances (tokens issued)
    console.log('\n=== TOKENS ISSUED ===');
    const gatewayBalances = await client.request({
      command: 'gateway_balances',
      account: ISSUER,
      hotwallet: [TREASURY],
    });
    
    console.log('Gateway balances response:');
    console.log(JSON.stringify(gatewayBalances.result, null, 2));

    // Check issuer's obligations
    console.log('\n=== ACCOUNT LINES (ISSUER) ===');
    const issuerLines = await client.request({
      command: 'account_lines',
      account: ISSUER,
    });
    console.log(`Trust lines count: ${issuerLines.result.lines.length}`);
    if (issuerLines.result.lines.length > 0) {
      console.log('Trust lines:');
      for (const line of issuerLines.result.lines.slice(0, 10)) {
        console.log(`  - ${line.currency}: ${line.balance} (to ${line.account})`);
      }
    }

    // Check treasury account
    console.log('\n=== TREASURY ACCOUNT ===');
    console.log(`Address: ${TREASURY}`);
    
    const treasuryInfo = await client.request({
      command: 'account_info',
      account: TREASURY,
    });
    console.log('Account exists: YES');
    console.log(`XRP Balance: ${Number(treasuryInfo.result.account_data.Balance) / 1000000} XRP`);

    console.log('\n=== ACCOUNT LINES (TREASURY) ===');
    const treasuryLines = await client.request({
      command: 'account_lines',
      account: TREASURY,
    });
    console.log(`Trust lines count: ${treasuryLines.result.lines.length}`);
    if (treasuryLines.result.lines.length > 0) {
      console.log('Trust lines:');
      for (const line of treasuryLines.result.lines) {
        console.log(`  - ${line.currency}: ${line.balance} (from ${line.account})`);
      }
    } else {
      console.log('  No trust lines established yet');
    }

  } catch (error: any) {
    console.error('Error:', error.message);
    if (error.data) {
      console.error('Details:', JSON.stringify(error.data, null, 2));
    }
  } finally {
    await client.disconnect();
    console.log('\n🔌 Disconnected');
  }
}

main();
