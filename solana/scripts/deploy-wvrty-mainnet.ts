/**
 * Verity Protocol - wVRTY Token Mainnet Deployment Script
 * 
 * @description Deploys the wrapped VRTY (wVRTY) SPL token on Solana MAINNET.
 * This is a production-ready script with enhanced security and verification.
 * 
 * Token Specifications:
 * - Symbol: wVRTY
 * - Name: Wrapped Verity Protocol Token
 * - Decimals: 6 (matching XRPL VRTY)
 * - Total Supply: Mintable (backed by locked VRTY on XRPL)
 * 
 * XRPL VRTY Reference (Production):
 * - Issuer: rBeHfq9vRjZ8Cth1sMbp2nJvExmxSxAH8f
 * - Total Supply: 1,000,000,000 VRTY
 * - Distribution Wallet: rLmLMErLKDzWXyYmcZGHqQ3SCgTVJCVjA3
 * 
 * SECURITY REQUIREMENTS:
 * - Use hardware wallet (Ledger) for mint authority in production
 * - Never commit private keys to version control
 * - Store keys in secure, encrypted storage (HSM recommended)
 * - Multi-sig for critical operations
 * 
 * @version 2.0.0 - Mainnet Ready
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
  Commitment,
} from '@solana/web3.js';
import {
  createMint,
  getMint,
  getOrCreateAssociatedTokenAccount,
  setAuthority,
  AuthorityType,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// ============================================================
// MAINNET CONFIGURATION
// ============================================================

interface MainnetDeploymentConfig {
  network: 'mainnet-beta';
  rpcUrl: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimals: number;
  tokenUri: string;
  mintAuthorityKeypairPath: string;
  freezeAuthorityKeypairPath: string;
  outputDir: string;
  commitment: Commitment;
  // Mainnet-specific
  requiredSOLBalance: number;
  enableFreezeAuthority: boolean;
  confirmationRetries: number;
}

// Premium RPC endpoints for mainnet reliability
const MAINNET_RPC_ENDPOINTS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-api.projectserum.com',
  'https://rpc.ankr.com/solana',
  // Add your premium RPC here (Helius, QuickNode, Alchemy, etc.)
];

const MAINNET_CONFIG: MainnetDeploymentConfig = {
  network: 'mainnet-beta',
  rpcUrl: process.env['SOLANA_MAINNET_RPC'] || MAINNET_RPC_ENDPOINTS[0],
  tokenName: 'Wrapped Verity Protocol Token',
  tokenSymbol: 'wVRTY',
  tokenDecimals: 6, // Match XRPL VRTY decimals
  tokenUri: 'https://raw.githubusercontent.com/SMMM25/Verity-Protocol-VRTY-/main/solana/metadata/wvrty-metadata.json',
  mintAuthorityKeypairPath: './solana/keys/mainnet/mint-authority.json',
  freezeAuthorityKeypairPath: './solana/keys/mainnet/freeze-authority.json',
  outputDir: './solana/config/mainnet',
  commitment: 'finalized', // Highest confirmation level for mainnet
  requiredSOLBalance: 0.05, // Minimum SOL required (mainnet has fees)
  enableFreezeAuthority: true, // Enable for compliance/security
  confirmationRetries: 3,
};

// ============================================================
// SECURITY UTILITIES
// ============================================================

/**
 * Prompt user for confirmation (critical operations)
 */
async function promptConfirmation(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`\n⚠️  ${message} (yes/no): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes');
    });
  });
}

/**
 * Validate keypair file exists and is readable
 */
function validateKeypairFile(filepath: string, name: string): void {
  const absolutePath = path.resolve(filepath);
  
  if (!fs.existsSync(absolutePath)) {
    console.error(`\n❌ ${name} keypair not found at: ${absolutePath}`);
    console.error(`\nFor mainnet deployment, you must:
1. Generate a secure keypair offline
2. Store it in a secure location
3. Copy to: ${absolutePath}
4. NEVER commit this file to version control

Generate keypair with: solana-keygen new --outfile ${filepath}
Or use a hardware wallet for maximum security.`);
    process.exit(1);
  }

  // Verify it's valid JSON
  try {
    const data = JSON.parse(fs.readFileSync(absolutePath, 'utf-8'));
    if (!Array.isArray(data) || data.length !== 64) {
      throw new Error('Invalid keypair format');
    }
  } catch (error) {
    console.error(`\n❌ Invalid keypair file: ${absolutePath}`);
    process.exit(1);
  }
}

/**
 * Load keypair from file with validation
 */
function loadKeypair(filepath: string): Keypair {
  const absolutePath = path.resolve(filepath);
  const secretKey = JSON.parse(fs.readFileSync(absolutePath, 'utf-8'));
  return Keypair.fromSecretKey(new Uint8Array(secretKey));
}

/**
 * Save deployment info securely
 */
function saveDeploymentInfo(outputDir: string, info: any): void {
  const filepath = path.join(outputDir, 'wvrty-mainnet-deployment.json');
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Ensure we don't accidentally include private keys
  const safeInfo = { ...info };
  delete safeInfo.privateKeys;
  delete safeInfo.secretKeys;
  
  fs.writeFileSync(filepath, JSON.stringify(safeInfo, null, 2));
  console.log(`\nDeployment info saved to: ${filepath}`);
}

// ============================================================
// CONNECTION & HEALTH CHECKS
// ============================================================

/**
 * Create mainnet connection with health check
 */
async function createMainnetConnection(config: MainnetDeploymentConfig): Promise<Connection> {
  console.log('\n🔗 Connecting to Solana Mainnet...');
  console.log(`   RPC: ${config.rpcUrl}`);
  
  const connection = new Connection(config.rpcUrl, config.commitment);
  
  // Health check
  try {
    const version = await connection.getVersion();
    const slot = await connection.getSlot();
    const blockTime = await connection.getBlockTime(slot);
    
    console.log(`   ✅ Connected!`);
    console.log(`   Solana Version: ${version['solana-core']}`);
    console.log(`   Current Slot: ${slot}`);
    console.log(`   Block Time: ${new Date((blockTime || 0) * 1000).toISOString()}`);
    
    return connection;
  } catch (error: any) {
    console.error(`   ❌ Connection failed: ${error.message}`);
    throw error;
  }
}

/**
 * Verify account balance
 */
async function verifyBalance(
  connection: Connection,
  publicKey: PublicKey,
  requiredSOL: number,
  accountName: string
): Promise<number> {
  const balance = await connection.getBalance(publicKey);
  const balanceSOL = balance / LAMPORTS_PER_SOL;
  
  console.log(`\n💰 ${accountName} Balance: ${balanceSOL.toFixed(4)} SOL`);
  
  if (balanceSOL < requiredSOL) {
    console.error(`\n❌ Insufficient balance!`);
    console.error(`   Required: ${requiredSOL} SOL`);
    console.error(`   Available: ${balanceSOL} SOL`);
    console.error(`\nPlease fund the wallet: ${publicKey.toString()}`);
    process.exit(1);
  }
  
  return balance;
}

// ============================================================
// MAINNET DEPLOYMENT
// ============================================================

/**
 * Deploy wVRTY token on Solana Mainnet
 */
async function deployWVRTYMainnet(config: MainnetDeploymentConfig = MAINNET_CONFIG): Promise<{
  mint: PublicKey;
  mintAuthority: PublicKey;
  freezeAuthority: PublicKey | null;
  deploymentInfo: any;
}> {
  console.log('\n' + '='.repeat(60));
  console.log('    wVRTY TOKEN MAINNET DEPLOYMENT');
  console.log('    Verity Protocol - Production Deployment');
  console.log('='.repeat(60));
  
  // Display configuration
  console.log('\n📋 Configuration:');
  console.log(`   Network: ${config.network.toUpperCase()}`);
  console.log(`   Token: ${config.tokenName} (${config.tokenSymbol})`);
  console.log(`   Decimals: ${config.tokenDecimals}`);
  console.log(`   Freeze Authority: ${config.enableFreezeAuthority ? 'Enabled' : 'Disabled'}`);
  console.log(`   Commitment: ${config.commitment}`);
  
  // Security warnings
  console.log('\n⚠️  MAINNET DEPLOYMENT - REAL FUNDS INVOLVED');
  console.log('   This will deploy to Solana Mainnet.');
  console.log('   Ensure all security measures are in place.');
  
  // Validate keypair files exist
  console.log('\n🔑 Validating keypairs...');
  validateKeypairFile(config.mintAuthorityKeypairPath, 'Mint Authority');
  if (config.enableFreezeAuthority) {
    validateKeypairFile(config.freezeAuthorityKeypairPath, 'Freeze Authority');
  }
  console.log('   ✅ Keypairs validated');
  
  // Get user confirmation
  const confirmed = await promptConfirmation(
    'Deploy wVRTY token to Solana MAINNET?'
  );
  if (!confirmed) {
    console.log('\n🚫 Deployment cancelled by user.');
    process.exit(0);
  }
  
  // Connect to mainnet
  const connection = await createMainnetConnection(config);
  
  // Load keypairs
  console.log('\n🔐 Loading keypairs...');
  const mintAuthority = loadKeypair(config.mintAuthorityKeypairPath);
  console.log(`   Mint Authority: ${mintAuthority.publicKey.toString()}`);
  
  let freezeAuthority: Keypair | null = null;
  if (config.enableFreezeAuthority) {
    freezeAuthority = loadKeypair(config.freezeAuthorityKeypairPath);
    console.log(`   Freeze Authority: ${freezeAuthority.publicKey.toString()}`);
  }
  
  // Verify balances
  await verifyBalance(
    connection,
    mintAuthority.publicKey,
    config.requiredSOLBalance,
    'Mint Authority'
  );
  
  // Final confirmation before deployment
  const finalConfirm = await promptConfirmation(
    'Proceed with token creation? This action cannot be undone.'
  );
  if (!finalConfirm) {
    console.log('\n🚫 Deployment cancelled by user.');
    process.exit(0);
  }
  
  // Create the mint
  console.log('\n🚀 Creating wVRTY token mint...');
  console.log('   This may take a moment on mainnet...');
  
  let mint: PublicKey;
  let retries = config.confirmationRetries;
  
  while (retries > 0) {
    try {
      mint = await createMint(
        connection,
        mintAuthority,
        mintAuthority.publicKey,
        freezeAuthority?.publicKey || null,
        config.tokenDecimals
      );
      
      console.log(`\n✅ wVRTY Mint Created Successfully!`);
      console.log(`   Mint Address: ${mint.toString()}`);
      break;
    } catch (error: any) {
      retries--;
      if (retries === 0) {
        console.error(`\n❌ Failed to create mint: ${error.message}`);
        throw error;
      }
      console.log(`   Retrying... (${retries} attempts remaining)`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Verify mint creation
  console.log('\n🔍 Verifying mint...');
  const mintInfo = await getMint(connection, mint!);
  
  console.log('\n📊 Mint Info:');
  console.log(`   Address: ${mint!.toString()}`);
  console.log(`   Decimals: ${mintInfo.decimals}`);
  console.log(`   Supply: ${mintInfo.supply.toString()}`);
  console.log(`   Mint Authority: ${mintInfo.mintAuthority?.toString()}`);
  console.log(`   Freeze Authority: ${mintInfo.freezeAuthority?.toString() || 'None'}`);
  console.log(`   Is Initialized: ${mintInfo.isInitialized}`);
  
  // Create deployment info
  const deploymentInfo = {
    environment: 'MAINNET',
    network: config.network,
    deployedAt: new Date().toISOString(),
    token: {
      name: config.tokenName,
      symbol: config.tokenSymbol,
      decimals: config.tokenDecimals,
      mint: mint!.toString(),
      metadataUri: config.tokenUri,
    },
    authorities: {
      mintAuthority: mintAuthority.publicKey.toString(),
      freezeAuthority: freezeAuthority?.publicKey.toString() || null,
    },
    xrplReference: {
      issuer: 'rBeHfq9vRjZ8Cth1sMbp2nJvExmxSxAH8f',
      totalSupply: '1,000,000,000 VRTY',
      distributionWallet: 'rLmLMErLKDzWXyYmcZGHqQ3SCgTVJCVjA3',
      network: 'mainnet',
    },
    explorer: {
      solscan: `https://solscan.io/token/${mint!.toString()}`,
      solanaFm: `https://solana.fm/address/${mint!.toString()}`,
      solanaExplorer: `https://explorer.solana.com/address/${mint!.toString()}`,
    },
    bridge: {
      status: 'pending_setup',
      note: 'Run setup-treasury command to create bridge treasury',
    },
    verification: {
      mintVerified: true,
      timestamp: new Date().toISOString(),
    },
    notes: [
      'MAINNET DEPLOYMENT - PRODUCTION',
      'wVRTY is minted when VRTY is locked on XRPL bridge escrow',
      'wVRTY is burned when bridging back to XRPL',
      'Total wVRTY supply should never exceed locked VRTY on XRPL',
      'Mint authority should be transferred to bridge service after setup',
    ],
  };
  
  // Save deployment info
  saveDeploymentInfo(config.outputDir, deploymentInfo);
  
  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('    DEPLOYMENT COMPLETE!');
  console.log('='.repeat(60));
  console.log('\n🎉 wVRTY Token Successfully Deployed to Solana Mainnet!\n');
  console.log(`   Mint Address: ${mint!.toString()}`);
  console.log(`   Explorer: https://solscan.io/token/${mint!.toString()}`);
  console.log('\n📝 Next Steps:');
  console.log('   1. Verify token on Solscan/Explorer');
  console.log('   2. Run: npx ts-node deploy-wvrty-mainnet.ts setup-treasury');
  console.log('   3. Configure bridge service with mint address');
  console.log('   4. Transfer mint authority to bridge service');
  console.log('   5. Test bridge with small amount first');
  
  return {
    mint: mint!,
    mintAuthority: mintAuthority.publicKey,
    freezeAuthority: freezeAuthority?.publicKey || null,
    deploymentInfo,
  };
}

/**
 * Setup mainnet bridge treasury
 */
async function setupMainnetTreasury(config: MainnetDeploymentConfig, mintAddress: string): Promise<{
  treasuryAccount: PublicKey;
  treasuryAuthority: PublicKey;
}> {
  console.log('\n' + '='.repeat(60));
  console.log('    MAINNET BRIDGE TREASURY SETUP');
  console.log('='.repeat(60));
  
  // Validate treasury authority keypair
  const treasuryAuthorityPath = './solana/keys/mainnet/treasury-authority.json';
  validateKeypairFile(treasuryAuthorityPath, 'Treasury Authority');
  
  const confirmed = await promptConfirmation(
    'Setup bridge treasury on Solana MAINNET?'
  );
  if (!confirmed) {
    console.log('\n🚫 Setup cancelled by user.');
    process.exit(0);
  }
  
  const connection = await createMainnetConnection(config);
  const treasuryAuthority = loadKeypair(treasuryAuthorityPath);
  const mint = new PublicKey(mintAddress);
  
  console.log(`\n   Treasury Authority: ${treasuryAuthority.publicKey.toString()}`);
  console.log(`   Mint: ${mint.toString()}`);
  
  // Verify treasury authority balance
  await verifyBalance(
    connection,
    treasuryAuthority.publicKey,
    0.01, // Need SOL for ATA creation
    'Treasury Authority'
  );
  
  // Create associated token account
  console.log('\n📦 Creating treasury token account...');
  
  const treasuryAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    treasuryAuthority,
    mint,
    treasuryAuthority.publicKey
  );
  
  console.log(`\n✅ Treasury Account Created!`);
  console.log(`   Address: ${treasuryAccount.address.toString()}`);
  
  // Update deployment info
  const deploymentInfoPath = path.join(config.outputDir, 'wvrty-mainnet-deployment.json');
  if (fs.existsSync(deploymentInfoPath)) {
    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentInfoPath, 'utf-8'));
    deploymentInfo.bridge = {
      status: 'active',
      treasuryAuthority: treasuryAuthority.publicKey.toString(),
      treasuryAccount: treasuryAccount.address.toString(),
      setupAt: new Date().toISOString(),
    };
    fs.writeFileSync(deploymentInfoPath, JSON.stringify(deploymentInfo, null, 2));
    console.log(`\n   Deployment info updated: ${deploymentInfoPath}`);
  }
  
  return {
    treasuryAccount: treasuryAccount.address,
    treasuryAuthority: treasuryAuthority.publicKey,
  };
}

/**
 * Transfer mint authority to bridge (production)
 */
async function transferMintAuthorityMainnet(
  config: MainnetDeploymentConfig,
  mintAddress: string,
  newAuthority: string
): Promise<string> {
  console.log('\n' + '='.repeat(60));
  console.log('    TRANSFER MINT AUTHORITY - MAINNET');
  console.log('='.repeat(60));
  
  console.log('\n⚠️  WARNING: THIS ACTION IS IRREVERSIBLE!');
  console.log('   Once transferred, you cannot get the mint authority back.');
  console.log(`   New Authority: ${newAuthority}`);
  
  const confirmed = await promptConfirmation(
    'Are you ABSOLUTELY SURE you want to transfer mint authority?'
  );
  if (!confirmed) {
    console.log('\n🚫 Transfer cancelled by user.');
    process.exit(0);
  }
  
  // Double confirmation for safety
  const doubleConfirm = await promptConfirmation(
    'This is your FINAL warning. Transfer mint authority?'
  );
  if (!doubleConfirm) {
    console.log('\n🚫 Transfer cancelled by user.');
    process.exit(0);
  }
  
  const connection = await createMainnetConnection(config);
  const currentAuthority = loadKeypair(config.mintAuthorityKeypairPath);
  const mint = new PublicKey(mintAddress);
  const newAuthorityPubkey = new PublicKey(newAuthority);
  
  console.log('\n🔄 Transferring mint authority...');
  
  const signature = await setAuthority(
    connection,
    currentAuthority,
    mint,
    currentAuthority.publicKey,
    AuthorityType.MintTokens,
    newAuthorityPubkey
  );
  
  console.log(`\n✅ Mint authority transferred!`);
  console.log(`   Transaction: ${signature}`);
  console.log(`   Explorer: https://solscan.io/tx/${signature}`);
  
  return signature;
}

/**
 * Verify mainnet deployment
 */
async function verifyMainnetDeployment(config: MainnetDeploymentConfig): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log('    VERIFY MAINNET DEPLOYMENT');
  console.log('='.repeat(60));
  
  const deploymentInfoPath = path.join(config.outputDir, 'wvrty-mainnet-deployment.json');
  
  if (!fs.existsSync(deploymentInfoPath)) {
    console.error('\n❌ No mainnet deployment found.');
    console.error(`   Expected file: ${deploymentInfoPath}`);
    process.exit(1);
  }
  
  const deploymentInfo = JSON.parse(fs.readFileSync(deploymentInfoPath, 'utf-8'));
  const connection = await createMainnetConnection(config);
  
  console.log('\n📋 Deployment Info:');
  console.log(`   Token: ${deploymentInfo.token.name}`);
  console.log(`   Symbol: ${deploymentInfo.token.symbol}`);
  console.log(`   Mint: ${deploymentInfo.token.mint}`);
  console.log(`   Deployed: ${deploymentInfo.deployedAt}`);
  
  // Verify on-chain
  console.log('\n🔍 Verifying on-chain...');
  const mint = new PublicKey(deploymentInfo.token.mint);
  const mintInfo = await getMint(connection, mint);
  
  console.log(`   ✅ Mint exists`);
  console.log(`   Decimals: ${mintInfo.decimals}`);
  console.log(`   Supply: ${mintInfo.supply.toString()}`);
  console.log(`   Mint Authority: ${mintInfo.mintAuthority?.toString() || 'None'}`);
  console.log(`   Freeze Authority: ${mintInfo.freezeAuthority?.toString() || 'None'}`);
  
  console.log('\n🔗 Explorer Links:');
  console.log(`   Solscan: ${deploymentInfo.explorer.solscan}`);
  console.log(`   Solana FM: ${deploymentInfo.explorer.solanaFm}`);
}

// ============================================================
// CLI INTERFACE
// ============================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  
  const config: MainnetDeploymentConfig = {
    ...MAINNET_CONFIG,
    rpcUrl: process.env['SOLANA_MAINNET_RPC'] || MAINNET_CONFIG.rpcUrl,
  };
  
  try {
    switch (command) {
      case 'deploy':
        await deployWVRTYMainnet(config);
        break;
        
      case 'setup-treasury':
        const mintAddress = args[1] || process.env['WVRTY_MAINNET_MINT'];
        if (!mintAddress) {
          console.error('\n❌ Mint address required.');
          console.error('Usage: deploy-wvrty-mainnet setup-treasury <mint-address>');
          process.exit(1);
        }
        await setupMainnetTreasury(config, mintAddress);
        break;
        
      case 'transfer-authority':
        const mint = args[1] || process.env['WVRTY_MAINNET_MINT'];
        const newAuth = args[2];
        if (!mint || !newAuth) {
          console.error('\n❌ Mint address and new authority required.');
          console.error('Usage: deploy-wvrty-mainnet transfer-authority <mint-address> <new-authority>');
          process.exit(1);
        }
        await transferMintAuthorityMainnet(config, mint, newAuth);
        break;
        
      case 'verify':
        await verifyMainnetDeployment(config);
        break;
        
      case 'info':
        const infoPath = path.join(config.outputDir, 'wvrty-mainnet-deployment.json');
        if (fs.existsSync(infoPath)) {
          const info = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));
          console.log(JSON.stringify(info, null, 2));
        } else {
          console.log('\n❌ No mainnet deployment info found.');
          console.log(`   Expected: ${infoPath}`);
          console.log('   Run "deploy" first.');
        }
        break;
        
      case 'help':
      default:
        console.log(`
╔══════════════════════════════════════════════════════════════╗
║     wVRTY Token Mainnet Deployment Script                   ║
║     Verity Protocol - Production Deployment                  ║
╚══════════════════════════════════════════════════════════════╝

Commands:
  deploy              Deploy wVRTY token to Solana MAINNET
  setup-treasury      Setup bridge treasury account
  transfer-authority  Transfer mint authority to bridge
  verify             Verify deployment on-chain
  info               Show deployment info

Environment Variables:
  SOLANA_MAINNET_RPC    Custom mainnet RPC URL (recommended for production)
  WVRTY_MAINNET_MINT    wVRTY mainnet mint address

Required Files (generate securely, never commit to git!):
  ./solana/keys/mainnet/mint-authority.json
  ./solana/keys/mainnet/freeze-authority.json
  ./solana/keys/mainnet/treasury-authority.json

Security Requirements:
  - Use hardware wallet (Ledger) for production
  - Store keys in encrypted, secure storage
  - Consider multi-sig for critical operations
  - Test on devnet first!

Examples:
  # Deploy to mainnet (requires keypair files)
  npx ts-node deploy-wvrty-mainnet.ts deploy

  # Setup bridge treasury
  npx ts-node deploy-wvrty-mainnet.ts setup-treasury <mint-address>

  # Verify deployment
  npx ts-node deploy-wvrty-mainnet.ts verify

  # With custom RPC
  SOLANA_MAINNET_RPC=https://your-rpc.com npx ts-node deploy-wvrty-mainnet.ts deploy
        `);
    }
  } catch (error) {
    console.error('\n❌ Error:', (error as Error).message);
    process.exit(1);
  }
}

// Export functions
export {
  deployWVRTYMainnet,
  setupMainnetTreasury,
  transferMintAuthorityMainnet,
  verifyMainnetDeployment,
  MainnetDeploymentConfig,
  MAINNET_CONFIG,
};

// Run if executed directly
main().catch(console.error);
