/**
 * Verity Protocol - XRPL Bridge Escrow Setup
 * 
 * @description Sets up the XRPL side of the bridge infrastructure.
 * Creates an escrow account to hold locked VRTY tokens during bridging.
 * 
 * Bridge Flow (XRPL → Solana):
 * 1. User sends VRTY to bridge escrow account
 * 2. Validators verify the transaction
 * 3. wVRTY is minted on Solana
 * 
 * Bridge Flow (Solana → XRPL):
 * 1. User burns wVRTY on Solana
 * 2. Validators verify the burn
 * 3. VRTY is released from escrow to user
 * 
 * VRTY Token Details:
 * - Issuer: rBeHfq9vRjZ8Cth1sMbp2nJvExmxSxAH8f
 * - Total Supply: 1,000,000,000 VRTY
 * - Distribution: rLmLMErLKDzWXyYmcZGHqQ3SCgTVJCVjA3
 * 
 * @version 1.0.0
 */

import {
  Client,
  Wallet,
  xrpToDrops,
  dropsToXrp,
  Payment,
  AccountSet,
  TrustSet,
  AccountSetAsfFlags,
} from 'xrpl';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// CONFIGURATION
// ============================================================

interface BridgeConfig {
  network: 'mainnet' | 'testnet' | 'devnet';
  xrplServer: string;
  vrtyIssuer: string;
  vrtyCurrencyCode: string;
  escrowWalletPath: string;
  outputDir: string;
}

const NETWORKS = {
  mainnet: 'wss://xrplcluster.com',
  testnet: 'wss://s.altnet.rippletest.net:51233',
  devnet: 'wss://s.devnet.rippletest.net:51233',
};

const DEFAULT_CONFIG: BridgeConfig = {
  network: 'testnet', // Start with testnet
  xrplServer: NETWORKS.testnet,
  vrtyIssuer: 'rBeHfq9vRjZ8Cth1sMbp2nJvExmxSxAH8f',
  vrtyCurrencyCode: 'VRTY',
  escrowWalletPath: './xrpl/config/bridge-escrow-wallet.json',
  outputDir: './xrpl/config',
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Load or create wallet
 */
function loadOrCreateWallet(filepath: string): { wallet: Wallet; isNew: boolean } {
  const absolutePath = path.resolve(filepath);
  
  if (fs.existsSync(absolutePath)) {
    console.log(`Loading existing wallet from: ${absolutePath}`);
    const data = JSON.parse(fs.readFileSync(absolutePath, 'utf-8'));
    return {
      wallet: Wallet.fromSeed(data.seed),
      isNew: false,
    };
  }
  
  console.log(`Generating new wallet: ${absolutePath}`);
  const wallet = Wallet.generate();
  
  // Ensure directory exists
  const dir = path.dirname(absolutePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Save wallet (IMPORTANT: Secure this file!)
  const walletData = {
    address: wallet.address,
    seed: wallet.seed,
    publicKey: wallet.publicKey,
    privateKey: wallet.privateKey,
    createdAt: new Date().toISOString(),
    network: DEFAULT_CONFIG.network,
    purpose: 'Bridge Escrow Account',
    WARNING: 'NEVER share this file or commit to version control!',
  };
  
  fs.writeFileSync(absolutePath, JSON.stringify(walletData, null, 2));
  
  return {
    wallet,
    isNew: true,
  };
}

/**
 * Connect to XRPL
 */
async function connectToXRPL(server: string): Promise<Client> {
  const client = new Client(server);
  await client.connect();
  console.log(`Connected to XRPL: ${server}`);
  return client;
}

/**
 * Fund wallet on testnet
 */
async function fundWallet(client: Client, wallet: Wallet): Promise<void> {
  console.log(`Funding wallet ${wallet.address} on testnet...`);
  
  try {
    const result = await client.fundWallet(wallet);
    console.log(`Funded! Balance: ${dropsToXrp(result.balance)} XRP`);
  } catch (error) {
    console.error('Failed to fund wallet:', (error as Error).message);
    throw error;
  }
}

/**
 * Get account info
 */
async function getAccountInfo(client: Client, address: string): Promise<any> {
  try {
    const response = await client.request({
      command: 'account_info',
      account: address,
      ledger_index: 'validated',
    });
    return response.result.account_data;
  } catch (error: any) {
    if (error.data?.error === 'actNotFound') {
      return null;
    }
    throw error;
  }
}

/**
 * Get trustline info
 */
async function getTrustlines(client: Client, address: string): Promise<any[]> {
  try {
    const response = await client.request({
      command: 'account_lines',
      account: address,
      ledger_index: 'validated',
    });
    return response.result.lines;
  } catch {
    return [];
  }
}

// ============================================================
// BRIDGE SETUP FUNCTIONS
// ============================================================

/**
 * Create and configure bridge escrow account
 */
async function setupBridgeEscrow(config: BridgeConfig = DEFAULT_CONFIG): Promise<{
  escrowAddress: string;
  vrtyTrustline: boolean;
  xrpBalance: string;
}> {
  console.log('\n========================================');
  console.log('  XRPL Bridge Escrow Setup');
  console.log('========================================\n');
  
  console.log('Configuration:');
  console.log(`  Network: ${config.network}`);
  console.log(`  VRTY Issuer: ${config.vrtyIssuer}`);
  console.log('');
  
  // Connect to XRPL
  const client = await connectToXRPL(config.xrplServer);
  
  try {
    // Load or create escrow wallet
    const { wallet, isNew } = loadOrCreateWallet(config.escrowWalletPath);
    console.log(`\nEscrow Address: ${wallet.address}`);
    
    // Check if account exists
    let accountInfo = await getAccountInfo(client, wallet.address);
    
    if (!accountInfo) {
      if (config.network === 'mainnet') {
        console.log('\n⚠️  Account not activated on mainnet.');
        console.log('Please send at least 10 XRP to this address to activate it.');
        console.log(`Address: ${wallet.address}`);
        
        await client.disconnect();
        return {
          escrowAddress: wallet.address,
          vrtyTrustline: false,
          xrpBalance: '0',
        };
      }
      
      // Fund on testnet/devnet
      await fundWallet(client, wallet);
      accountInfo = await getAccountInfo(client, wallet.address);
    }
    
    console.log(`\nAccount Balance: ${dropsToXrp(accountInfo.Balance)} XRP`);
    
    // Check for VRTY trustline
    const trustlines = await getTrustlines(client, wallet.address);
    const vrtyTrustline = trustlines.find(
      (line: any) => 
        line.currency === config.vrtyCurrencyCode && 
        line.account === config.vrtyIssuer
    );
    
    if (!vrtyTrustline) {
      console.log('\nCreating VRTY trustline...');
      
      // Create trustline to VRTY issuer
      const trustSetTx: TrustSet = {
        TransactionType: 'TrustSet',
        Account: wallet.address,
        LimitAmount: {
          currency: config.vrtyCurrencyCode,
          issuer: config.vrtyIssuer,
          value: '1000000000', // 1 billion VRTY max
        },
      };
      
      const prepared = await client.autofill(trustSetTx);
      const signed = wallet.sign(prepared);
      const result = await client.submitAndWait(signed.tx_blob);
      
      if (result.result.meta && typeof result.result.meta === 'object' && 'TransactionResult' in result.result.meta) {
        const txResult = result.result.meta.TransactionResult;
        if (txResult === 'tesSUCCESS') {
          console.log('✅ VRTY trustline created!');
        } else {
          console.log(`⚠️  Trustline result: ${txResult}`);
        }
      }
    } else {
      console.log(`\n✅ VRTY trustline exists. Balance: ${vrtyTrustline.balance} VRTY`);
    }
    
    // Configure account settings for bridge
    console.log('\nConfiguring account settings...');
    
    // Disable master key for production (use multisig instead)
    // For now, we'll just set deposit authorization
    const accountSetTx: AccountSet = {
      TransactionType: 'AccountSet',
      Account: wallet.address,
      // SetFlag: AccountSetAsfFlags.asfDepositAuth, // Optional: require deposit auth
    };
    
    const preparedSet = await client.autofill(accountSetTx);
    const signedSet = wallet.sign(preparedSet);
    await client.submitAndWait(signedSet.tx_blob);
    
    console.log('✅ Account configured');
    
    // Save deployment info
    const deploymentInfo = {
      network: config.network,
      deployedAt: new Date().toISOString(),
      escrow: {
        address: wallet.address,
        publicKey: wallet.publicKey,
      },
      vrty: {
        issuer: config.vrtyIssuer,
        currencyCode: config.vrtyCurrencyCode,
        trustlineLimit: '1000000000',
      },
      status: 'active',
      notes: [
        'This is the bridge escrow account',
        'VRTY sent here will be locked for bridging to Solana',
        'VRTY released from here comes from Solana → XRPL bridge',
      ],
    };
    
    const infoPath = path.join(config.outputDir, 'bridge-deployment.json');
    fs.writeFileSync(infoPath, JSON.stringify(deploymentInfo, null, 2));
    console.log(`\nDeployment info saved to: ${infoPath}`);
    
    // Get final trustline status
    const finalTrustlines = await getTrustlines(client, wallet.address);
    const finalVrtyTrustline = finalTrustlines.find(
      (line: any) => 
        line.currency === config.vrtyCurrencyCode && 
        line.account === config.vrtyIssuer
    );
    
    await client.disconnect();
    
    console.log('\n========================================');
    console.log('  Setup Complete!');
    console.log('========================================\n');
    
    return {
      escrowAddress: wallet.address,
      vrtyTrustline: !!finalVrtyTrustline,
      xrpBalance: dropsToXrp(accountInfo.Balance),
    };
    
  } finally {
    if (client.isConnected()) {
      await client.disconnect();
    }
  }
}

/**
 * Check bridge escrow status
 */
async function checkEscrowStatus(config: BridgeConfig = DEFAULT_CONFIG): Promise<void> {
  console.log('\n========================================');
  console.log('  Bridge Escrow Status');
  console.log('========================================\n');
  
  const client = await connectToXRPL(config.xrplServer);
  
  try {
    // Load wallet
    const { wallet } = loadOrCreateWallet(config.escrowWalletPath);
    console.log(`Escrow Address: ${wallet.address}`);
    
    // Get account info
    const accountInfo = await getAccountInfo(client, wallet.address);
    
    if (!accountInfo) {
      console.log('\n⚠️  Account not activated');
      return;
    }
    
    console.log(`\nXRP Balance: ${dropsToXrp(accountInfo.Balance)} XRP`);
    console.log(`Sequence: ${accountInfo.Sequence}`);
    console.log(`Owner Count: ${accountInfo.OwnerCount}`);
    
    // Get trustlines
    const trustlines = await getTrustlines(client, wallet.address);
    
    console.log('\nTrustlines:');
    if (trustlines.length === 0) {
      console.log('  None');
    } else {
      for (const line of trustlines) {
        console.log(`  ${line.currency}: ${line.balance} (issuer: ${line.account})`);
      }
    }
    
    // Get recent transactions
    const txResponse = await client.request({
      command: 'account_tx',
      account: wallet.address,
      limit: 10,
    });
    
    console.log('\nRecent Transactions:');
    if (txResponse.result.transactions.length === 0) {
      console.log('  None');
    } else {
      for (const tx of txResponse.result.transactions.slice(0, 5)) {
        const txData = tx.tx;
        if (txData && typeof txData === 'object' && 'TransactionType' in txData) {
          console.log(`  ${txData.TransactionType} - ${tx.validated ? '✅' : '⏳'}`);
        }
      }
    }
    
  } finally {
    await client.disconnect();
  }
}

/**
 * Lock VRTY for bridging (test function)
 */
async function lockVRTYForBridge(
  config: BridgeConfig,
  fromWallet: Wallet,
  amount: string,
  destinationSolanaAddress: string
): Promise<string> {
  console.log('\n========================================');
  console.log('  Lock VRTY for Bridge');
  console.log('========================================\n');
  
  const client = await connectToXRPL(config.xrplServer);
  
  try {
    // Load escrow wallet
    const { wallet: escrowWallet } = loadOrCreateWallet(config.escrowWalletPath);
    
    console.log(`From: ${fromWallet.address}`);
    console.log(`To (Escrow): ${escrowWallet.address}`);
    console.log(`Amount: ${amount} VRTY`);
    console.log(`Solana Destination: ${destinationSolanaAddress}`);
    
    // Create payment with memo containing Solana destination
    const payment: Payment = {
      TransactionType: 'Payment',
      Account: fromWallet.address,
      Destination: escrowWallet.address,
      Amount: {
        currency: config.vrtyCurrencyCode,
        issuer: config.vrtyIssuer,
        value: amount,
      },
      Memos: [
        {
          Memo: {
            MemoType: Buffer.from('bridge/solana/destination', 'utf-8').toString('hex').toUpperCase(),
            MemoData: Buffer.from(destinationSolanaAddress, 'utf-8').toString('hex').toUpperCase(),
          },
        },
        {
          Memo: {
            MemoType: Buffer.from('bridge/action', 'utf-8').toString('hex').toUpperCase(),
            MemoData: Buffer.from('LOCK_FOR_MINT', 'utf-8').toString('hex').toUpperCase(),
          },
        },
      ],
    };
    
    const prepared = await client.autofill(payment);
    const signed = fromWallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);
    
    const txHash = result.result.hash;
    console.log(`\n✅ VRTY locked!`);
    console.log(`Transaction Hash: ${txHash}`);
    
    return txHash;
    
  } finally {
    await client.disconnect();
  }
}

/**
 * Release VRTY from escrow (for Solana → XRPL bridge)
 */
async function releaseVRTYFromEscrow(
  config: BridgeConfig,
  destinationAddress: string,
  amount: string,
  solanaBurnTxHash: string
): Promise<string> {
  console.log('\n========================================');
  console.log('  Release VRTY from Escrow');
  console.log('========================================\n');
  
  const client = await connectToXRPL(config.xrplServer);
  
  try {
    // Load escrow wallet
    const { wallet: escrowWallet } = loadOrCreateWallet(config.escrowWalletPath);
    
    console.log(`From (Escrow): ${escrowWallet.address}`);
    console.log(`To: ${destinationAddress}`);
    console.log(`Amount: ${amount} VRTY`);
    console.log(`Solana Burn TX: ${solanaBurnTxHash}`);
    
    // Check escrow balance
    const trustlines = await getTrustlines(client, escrowWallet.address);
    const vrtyLine = trustlines.find(
      (line: any) => 
        line.currency === config.vrtyCurrencyCode && 
        line.account === config.vrtyIssuer
    );
    
    if (!vrtyLine || parseFloat(vrtyLine.balance) < parseFloat(amount)) {
      throw new Error(`Insufficient VRTY in escrow. Have: ${vrtyLine?.balance || 0}, Need: ${amount}`);
    }
    
    // Create release payment
    const payment: Payment = {
      TransactionType: 'Payment',
      Account: escrowWallet.address,
      Destination: destinationAddress,
      Amount: {
        currency: config.vrtyCurrencyCode,
        issuer: config.vrtyIssuer,
        value: amount,
      },
      Memos: [
        {
          Memo: {
            MemoType: Buffer.from('bridge/solana/burn_tx', 'utf-8').toString('hex').toUpperCase(),
            MemoData: Buffer.from(solanaBurnTxHash, 'utf-8').toString('hex').toUpperCase(),
          },
        },
        {
          Memo: {
            MemoType: Buffer.from('bridge/action', 'utf-8').toString('hex').toUpperCase(),
            MemoData: Buffer.from('RELEASE_FROM_BURN', 'utf-8').toString('hex').toUpperCase(),
          },
        },
      ],
    };
    
    const prepared = await client.autofill(payment);
    const signed = escrowWallet.sign(prepared);
    const result = await client.submitAndWait(signed.tx_blob);
    
    const txHash = result.result.hash;
    console.log(`\n✅ VRTY released!`);
    console.log(`Transaction Hash: ${txHash}`);
    
    return txHash;
    
  } finally {
    await client.disconnect();
  }
}

// ============================================================
// CLI INTERFACE
// ============================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'setup';
  
  const config: BridgeConfig = {
    ...DEFAULT_CONFIG,
    network: (process.env.XRPL_NETWORK as any) || DEFAULT_CONFIG.network,
    xrplServer: process.env.XRPL_SERVER || NETWORKS[DEFAULT_CONFIG.network],
  };
  
  // Use environment variable for server if network specified
  if (process.env.XRPL_NETWORK && !process.env.XRPL_SERVER) {
    config.xrplServer = NETWORKS[config.network];
  }
  
  try {
    switch (command) {
      case 'setup':
        await setupBridgeEscrow(config);
        break;
        
      case 'status':
        await checkEscrowStatus(config);
        break;
        
      case 'test-lock':
        // For testing on testnet with a funded wallet
        const testWallet = Wallet.generate();
        console.log(`Test wallet generated: ${testWallet.address}`);
        console.log('This is a demo - in real usage, use an actual funded wallet');
        break;
        
      case 'help':
      default:
        console.log(`
XRPL Bridge Escrow Setup

Commands:
  setup      Create and configure bridge escrow account
  status     Check escrow account status
  test-lock  Demo lock operation (testnet only)
  help       Show this help

Environment Variables:
  XRPL_NETWORK   Network (mainnet, testnet, devnet)
  XRPL_SERVER    Custom XRPL WebSocket URL

Examples:
  XRPL_NETWORK=testnet npx ts-node bridge-escrow.ts setup
  npx ts-node bridge-escrow.ts status

VRTY Token Reference:
  Issuer: rBeHfq9vRjZ8Cth1sMbp2nJvExmxSxAH8f
  Total Supply: 1,000,000,000 VRTY
  Distribution: rLmLMErLKDzWXyYmcZGHqQ3SCgTVJCVjA3
        `);
    }
  } catch (error) {
    console.error('\n❌ Error:', (error as Error).message);
    process.exit(1);
  }
}

export {
  setupBridgeEscrow,
  checkEscrowStatus,
  lockVRTYForBridge,
  releaseVRTYFromEscrow,
  BridgeConfig,
  DEFAULT_CONFIG,
};

main().catch(console.error);
