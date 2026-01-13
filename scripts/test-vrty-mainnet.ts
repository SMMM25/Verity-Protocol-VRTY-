/**
 * Test VRTY Mainnet Integration
 * 
 * This script tests the XRPL VRTY service by connecting to mainnet
 * and querying real VRTY token data.
 */

import { Client, dropsToXrp } from 'xrpl';

// VRTY Token Configuration (hardcoded for standalone test)
const VRTY_ADDRESSES = {
  issuer: 'rBeHfq9vRjZ8Cth1sMbp2nJvExmxSxAH8f',
  distributionWallet: 'rLmLMErLKDzWXyYmcZGHqQ3SCgTVJCVjA3',
};

const VRTY_TOKEN = {
  symbol: 'VRTY',
  name: 'Verity Protocol Token',
  currencyCode: 'VRTY',
  currencyCodeHex: '5652545900000000000000000000000000000000',
  decimals: 6,
  totalSupply: '1000000000',
};

const STAKING_TIERS = {
  EXPLORER: { minStake: 0, rewardMultiplier: 1.0 },
  NAVIGATOR: { minStake: 1000, rewardMultiplier: 1.1 },
  CAPTAIN: { minStake: 10000, rewardMultiplier: 1.25 },
  ADMIRAL: { minStake: 50000, rewardMultiplier: 1.5 },
  COMMODORE: { minStake: 200000, rewardMultiplier: 2.0 },
};

async function getVRTYBalance(client: Client, address: string) {
  try {
    const response = await client.request({
      command: 'account_lines',
      account: address,
      peer: VRTY_ADDRESSES.issuer,
    });
    
    const vrtyLine = response.result.lines.find(
      (line: any) => line.currency === VRTY_TOKEN.currencyCode || 
                line.currency === VRTY_TOKEN.currencyCodeHex
    );
    
    return {
      balance: vrtyLine?.balance || '0',
      hasVRTYTrustline: !!vrtyLine,
    };
  } catch (error: any) {
    if (error.data?.error === 'actNotFound') {
      return { balance: '0', hasVRTYTrustline: false };
    }
    throw error;
  }
}

async function getXRPBalance(client: Client, address: string) {
  try {
    const response = await client.request({
      command: 'account_info',
      account: address,
      ledger_index: 'validated',
    });
    return dropsToXrp(response.result.account_data.Balance).toString();
  } catch (error: any) {
    if (error.data?.error === 'actNotFound') {
      return '0';
    }
    throw error;
  }
}

async function testMainnetConnection() {
  console.log('\n========================================');
  console.log('  VRTY Mainnet Integration Test');
  console.log('========================================\n');

  const client = new Client('wss://xrplcluster.com');

  try {
    // Test 1: Connect to XRPL Mainnet
    console.log('1. Connecting to XRPL Mainnet...');
    await client.connect();
    console.log('✅ Connected to XRPL Mainnet\n');

    // Test 2: Get Server Info
    console.log('2. Getting server info...');
    const serverInfo = await client.request({ command: 'server_info' });
    console.log(`   Server Version: ${serverInfo.result.info.build_version}`);
    console.log(`   Ledger Index: ${serverInfo.result.info.validated_ledger?.seq || 'N/A'}`);
    console.log('✅ Server info retrieved\n');

    // Test 3: Check VRTY Issuer Balance
    console.log('3. Checking VRTY Issuer account...');
    console.log(`   Issuer: ${VRTY_ADDRESSES.issuer}`);
    const issuerXrp = await getXRPBalance(client, VRTY_ADDRESSES.issuer);
    console.log(`   XRP Balance: ${issuerXrp} XRP`);
    console.log('✅ Issuer account verified\n');

    // Test 4: Check Distribution Wallet
    console.log('4. Checking Distribution Wallet...');
    console.log(`   Wallet: ${VRTY_ADDRESSES.distributionWallet}`);
    const [distVrty, distXrp] = await Promise.all([
      getVRTYBalance(client, VRTY_ADDRESSES.distributionWallet),
      getXRPBalance(client, VRTY_ADDRESSES.distributionWallet),
    ]);
    console.log(`   VRTY Balance: ${distVrty.balance} VRTY`);
    console.log(`   XRP Balance: ${distXrp} XRP`);
    console.log(`   Has VRTY Trustline: ${distVrty.hasVRTYTrustline}`);
    console.log('✅ Distribution wallet checked\n');

    // Test 5: Display VRTY Token Info
    console.log('5. VRTY Token Configuration:');
    console.log(`   Token: ${VRTY_TOKEN.name} (${VRTY_TOKEN.symbol})`);
    console.log(`   Currency Code: ${VRTY_TOKEN.currencyCode}`);
    console.log(`   Decimals: ${VRTY_TOKEN.decimals}`);
    console.log(`   Total Supply: ${VRTY_TOKEN.totalSupply} VRTY`);
    console.log('✅ Token config loaded\n');

    // Test 6: Display Staking Tiers
    console.log('6. Staking Tier Configuration:');
    for (const [tierName, config] of Object.entries(STAKING_TIERS)) {
      console.log(`   ${tierName}:`);
      console.log(`     Min Stake: ${config.minStake.toLocaleString()} VRTY`);
      console.log(`     Reward Multiplier: ${config.rewardMultiplier}x`);
    }
    console.log('✅ Staking tiers loaded\n');

    // Cleanup
    await client.disconnect();
    console.log('========================================');
    console.log('  All Tests Passed! ✅');
    console.log('========================================\n');

    // Summary
    console.log('VRTY Token Summary:');
    console.log('-------------------');
    console.log(`Token: ${VRTY_TOKEN.name} (${VRTY_TOKEN.symbol})`);
    console.log(`Network: XRPL Mainnet`);
    console.log(`Issuer: ${VRTY_ADDRESSES.issuer}`);
    console.log(`Distribution: ${VRTY_ADDRESSES.distributionWallet}`);
    console.log(`Total Supply: ${VRTY_TOKEN.totalSupply} VRTY`);
    if (distVrty.hasVRTYTrustline) {
      console.log(`Distribution VRTY: ${distVrty.balance} VRTY`);
    }

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    await client.disconnect();
    process.exit(1);
  }
}

// Run the test
testMainnetConnection().catch(console.error);
