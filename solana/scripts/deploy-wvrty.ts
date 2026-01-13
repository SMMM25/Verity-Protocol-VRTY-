/**
 * Verity Protocol - wVRTY Token Deployment Script
 * 
 * @description Deploys the wrapped VRTY (wVRTY) SPL token on Solana.
 * This token represents VRTY from XRPL on the Solana blockchain.
 * 
 * Token Specifications:
 * - Symbol: wVRTY
 * - Name: Wrapped Verity Protocol Token
 * - Decimals: 6 (matching XRPL VRTY)
 * - Total Supply: Mintable (backed by locked VRTY on XRPL)
 * 
 * XRPL VRTY Reference:
 * - Issuer: rBeHfq9vRjZ8Cth1sMbp2nJvExmxSxAH8f
 * - Total Supply: 1,000,000,000 VRTY
 * - Distribution Wallet: rLmLMErLKDzWXyYmcZGHqQ3SCgTVJCVjA3
 * 
 * @version 1.0.0
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
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
  createInitializeMintInstruction,
  getMinimumBalanceForRentExemptMint,
  createMint,
  getMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  setAuthority,
  AuthorityType,
} from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// CONFIGURATION
// ============================================================

interface DeploymentConfig {
  network: 'mainnet-beta' | 'devnet' | 'testnet';
  rpcUrl?: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimals: number;
  tokenUri: string;
  mintAuthorityKeypairPath: string;
  freezeAuthorityKeypairPath?: string;
  initialMintAmount?: number;
  outputDir: string;
}

const DEFAULT_CONFIG: DeploymentConfig = {
  network: 'devnet', // Start with devnet for testing
  tokenName: 'Wrapped Verity Protocol Token',
  tokenSymbol: 'wVRTY',
  tokenDecimals: 6, // Match XRPL VRTY decimals
  tokenUri: 'https://raw.githubusercontent.com/SMMM25/Verity-Protocol-VRTY-/main/solana/metadata/wvrty-metadata.json',
  mintAuthorityKeypairPath: './solana/keys/mint-authority.json',
  freezeAuthorityKeypairPath: './solana/keys/freeze-authority.json',
  initialMintAmount: 0, // No initial mint - minted on bridge
  outputDir: './solana/config',
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

/**
 * Load or generate a keypair
 */
function loadOrGenerateKeypair(filepath: string): Keypair {
  const absolutePath = path.resolve(filepath);
  
  if (fs.existsSync(absolutePath)) {
    console.log(`Loading existing keypair from: ${absolutePath}`);
    const secretKey = JSON.parse(fs.readFileSync(absolutePath, 'utf-8'));
    return Keypair.fromSecretKey(new Uint8Array(secretKey));
  }
  
  console.log(`Generating new keypair: ${absolutePath}`);
  const keypair = Keypair.generate();
  
  // Ensure directory exists
  const dir = path.dirname(absolutePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Save keypair (IMPORTANT: Secure this file!)
  fs.writeFileSync(absolutePath, JSON.stringify(Array.from(keypair.secretKey)));
  
  return keypair;
}

/**
 * Get connection to Solana network
 */
function getConnection(config: DeploymentConfig): Connection {
  const rpcUrl = config.rpcUrl || clusterApiUrl(config.network);
  return new Connection(rpcUrl, 'confirmed');
}

/**
 * Request airdrop for testing (devnet/testnet only)
 */
async function requestAirdropIfNeeded(
  connection: Connection,
  publicKey: PublicKey,
  minBalance: number = 2 * LAMPORTS_PER_SOL
): Promise<void> {
  const balance = await connection.getBalance(publicKey);
  
  if (balance < minBalance) {
    console.log(`Requesting airdrop for ${publicKey.toString()}...`);
    const signature = await connection.requestAirdrop(publicKey, 2 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(signature, 'confirmed');
    console.log(`Airdrop confirmed: ${signature}`);
  } else {
    console.log(`Balance sufficient: ${balance / LAMPORTS_PER_SOL} SOL`);
  }
}

/**
 * Save deployment info to file
 */
function saveDeploymentInfo(outputDir: string, info: any): void {
  const filepath = path.join(outputDir, 'wvrty-deployment.json');
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(filepath, JSON.stringify(info, null, 2));
  console.log(`\nDeployment info saved to: ${filepath}`);
}

// ============================================================
// DEPLOYMENT FUNCTIONS
// ============================================================

/**
 * Deploy wVRTY token
 */
async function deployWVRTY(config: DeploymentConfig = DEFAULT_CONFIG): Promise<{
  mint: PublicKey;
  mintAuthority: PublicKey;
  freezeAuthority: PublicKey | null;
  transactionSignature: string;
}> {
  console.log('\n========================================');
  console.log('  wVRTY Token Deployment');
  console.log('========================================\n');
  
  console.log('Configuration:');
  console.log(`  Network: ${config.network}`);
  console.log(`  Token Name: ${config.tokenName}`);
  console.log(`  Token Symbol: ${config.tokenSymbol}`);
  console.log(`  Decimals: ${config.tokenDecimals}`);
  console.log('');
  
  // Connect to Solana
  const connection = getConnection(config);
  console.log(`Connected to Solana ${config.network}`);
  
  // Load keypairs
  const mintAuthority = loadOrGenerateKeypair(config.mintAuthorityKeypairPath);
  console.log(`Mint Authority: ${mintAuthority.publicKey.toString()}`);
  
  let freezeAuthority: Keypair | null = null;
  if (config.freezeAuthorityKeypairPath) {
    freezeAuthority = loadOrGenerateKeypair(config.freezeAuthorityKeypairPath);
    console.log(`Freeze Authority: ${freezeAuthority.publicKey.toString()}`);
  }
  
  // Request airdrop if on devnet/testnet
  if (config.network !== 'mainnet-beta') {
    await requestAirdropIfNeeded(connection, mintAuthority.publicKey);
  }
  
  // Check balance
  const balance = await connection.getBalance(mintAuthority.publicKey);
  console.log(`\nMint Authority Balance: ${balance / LAMPORTS_PER_SOL} SOL`);
  
  if (balance < 0.01 * LAMPORTS_PER_SOL) {
    throw new Error('Insufficient SOL balance for deployment. Need at least 0.01 SOL.');
  }
  
  // Create the mint
  console.log('\nCreating wVRTY token mint...');
  
  const mint = await createMint(
    connection,
    mintAuthority,
    mintAuthority.publicKey,
    freezeAuthority?.publicKey || null,
    config.tokenDecimals
  );
  
  console.log(`✅ wVRTY Mint Created: ${mint.toString()}`);
  
  // Get mint info
  const mintInfo = await getMint(connection, mint);
  console.log(`\nMint Info:`);
  console.log(`  Address: ${mint.toString()}`);
  console.log(`  Decimals: ${mintInfo.decimals}`);
  console.log(`  Supply: ${mintInfo.supply.toString()}`);
  console.log(`  Mint Authority: ${mintInfo.mintAuthority?.toString()}`);
  console.log(`  Freeze Authority: ${mintInfo.freezeAuthority?.toString() || 'None'}`);
  
  // Create deployment info
  const deploymentInfo = {
    network: config.network,
    deployedAt: new Date().toISOString(),
    token: {
      name: config.tokenName,
      symbol: config.tokenSymbol,
      decimals: config.tokenDecimals,
      mint: mint.toString(),
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
    },
    notes: [
      'wVRTY is minted when VRTY is locked on XRPL bridge',
      'wVRTY is burned when bridging back to XRPL',
      'Total wVRTY supply should never exceed locked VRTY on XRPL',
    ],
  };
  
  // Save deployment info
  saveDeploymentInfo(config.outputDir, deploymentInfo);
  
  console.log('\n========================================');
  console.log('  Deployment Complete!');
  console.log('========================================\n');
  
  return {
    mint,
    mintAuthority: mintAuthority.publicKey,
    freezeAuthority: freezeAuthority?.publicKey || null,
    transactionSignature: '',
  };
}

/**
 * Setup bridge treasury account
 */
async function setupBridgeTreasury(
  config: DeploymentConfig,
  mintAddress: string
): Promise<{
  treasuryAccount: PublicKey;
  treasuryAuthority: PublicKey;
}> {
  console.log('\n========================================');
  console.log('  Bridge Treasury Setup');
  console.log('========================================\n');
  
  const connection = getConnection(config);
  const mintAuthority = loadOrGenerateKeypair(config.mintAuthorityKeypairPath);
  const mint = new PublicKey(mintAddress);
  
  // Load or generate treasury authority
  const treasuryAuthorityPath = './solana/keys/treasury-authority.json';
  const treasuryAuthority = loadOrGenerateKeypair(treasuryAuthorityPath);
  console.log(`Treasury Authority: ${treasuryAuthority.publicKey.toString()}`);
  
  // Request airdrop if needed
  if (config.network !== 'mainnet-beta') {
    await requestAirdropIfNeeded(connection, treasuryAuthority.publicKey);
  }
  
  // Create associated token account for treasury
  console.log('\nCreating treasury token account...');
  
  const treasuryAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    treasuryAuthority,
    mint,
    treasuryAuthority.publicKey
  );
  
  console.log(`✅ Treasury Account: ${treasuryAccount.address.toString()}`);
  
  // Update deployment info
  const deploymentInfoPath = path.join(config.outputDir, 'wvrty-deployment.json');
  if (fs.existsSync(deploymentInfoPath)) {
    const deploymentInfo = JSON.parse(fs.readFileSync(deploymentInfoPath, 'utf-8'));
    deploymentInfo.bridge = {
      treasuryAuthority: treasuryAuthority.publicKey.toString(),
      treasuryAccount: treasuryAccount.address.toString(),
    };
    fs.writeFileSync(deploymentInfoPath, JSON.stringify(deploymentInfo, null, 2));
    console.log(`\nDeployment info updated: ${deploymentInfoPath}`);
  }
  
  return {
    treasuryAccount: treasuryAccount.address,
    treasuryAuthority: treasuryAuthority.publicKey,
  };
}

/**
 * Transfer mint authority to bridge (for production)
 */
async function transferMintAuthorityToBridge(
  config: DeploymentConfig,
  mintAddress: string,
  newAuthority: string
): Promise<string> {
  console.log('\n========================================');
  console.log('  Transfer Mint Authority');
  console.log('========================================\n');
  
  const connection = getConnection(config);
  const currentAuthority = loadOrGenerateKeypair(config.mintAuthorityKeypairPath);
  const mint = new PublicKey(mintAddress);
  const newAuthorityPubkey = new PublicKey(newAuthority);
  
  console.log(`Current Authority: ${currentAuthority.publicKey.toString()}`);
  console.log(`New Authority: ${newAuthorityPubkey.toString()}`);
  console.log(`Mint: ${mint.toString()}`);
  
  console.log('\n⚠️  WARNING: This action is irreversible!');
  console.log('Make sure the new authority is correct.\n');
  
  const signature = await setAuthority(
    connection,
    currentAuthority,
    mint,
    currentAuthority.publicKey,
    AuthorityType.MintTokens,
    newAuthorityPubkey
  );
  
  console.log(`✅ Mint authority transferred!`);
  console.log(`Transaction: ${signature}`);
  
  return signature;
}

// ============================================================
// CLI INTERFACE
// ============================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'deploy';
  
  const config: DeploymentConfig = {
    ...DEFAULT_CONFIG,
    network: (process.env.SOLANA_NETWORK as any) || DEFAULT_CONFIG.network,
    rpcUrl: process.env.SOLANA_RPC_URL,
  };
  
  try {
    switch (command) {
      case 'deploy':
        await deployWVRTY(config);
        break;
        
      case 'setup-treasury':
        const mintAddress = args[1] || process.env.WVRTY_MINT;
        if (!mintAddress) {
          throw new Error('Mint address required. Usage: deploy-wvrty setup-treasury <mint-address>');
        }
        await setupBridgeTreasury(config, mintAddress);
        break;
        
      case 'transfer-authority':
        const mint = args[1] || process.env.WVRTY_MINT;
        const newAuth = args[2];
        if (!mint || !newAuth) {
          throw new Error('Usage: deploy-wvrty transfer-authority <mint-address> <new-authority>');
        }
        await transferMintAuthorityToBridge(config, mint, newAuth);
        break;
        
      case 'info':
        const infoPath = path.join(config.outputDir, 'wvrty-deployment.json');
        if (fs.existsSync(infoPath)) {
          const info = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));
          console.log(JSON.stringify(info, null, 2));
        } else {
          console.log('No deployment info found. Run "deploy" first.');
        }
        break;
        
      default:
        console.log(`
wVRTY Token Deployment Script

Commands:
  deploy              Deploy new wVRTY token
  setup-treasury      Setup bridge treasury account
  transfer-authority  Transfer mint authority to bridge
  info               Show deployment info

Environment Variables:
  SOLANA_NETWORK     Network to deploy to (devnet, testnet, mainnet-beta)
  SOLANA_RPC_URL     Custom RPC URL (optional)
  WVRTY_MINT         wVRTY mint address (for setup-treasury)

Examples:
  SOLANA_NETWORK=devnet npx ts-node deploy-wvrty.ts deploy
  npx ts-node deploy-wvrty.ts setup-treasury <mint-address>
  npx ts-node deploy-wvrty.ts info
        `);
    }
  } catch (error) {
    console.error('\n❌ Error:', (error as Error).message);
    process.exit(1);
  }
}

// Export functions for programmatic use
export {
  deployWVRTY,
  setupBridgeTreasury,
  transferMintAuthorityToBridge,
  DeploymentConfig,
  DEFAULT_CONFIG,
};

// Run if executed directly
main().catch(console.error);
