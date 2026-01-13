/**
 * Verity Protocol - wVRTY Token Metadata Creation Script
 * 
 * @description Creates and uploads token metadata for wVRTY using Metaplex.
 * This adds name, symbol, and image to the token on-chain.
 * 
 * @version 1.0.0
 */

import {
  Connection,
  Keypair,
  PublicKey,
  clusterApiUrl,
} from '@solana/web3.js';
import { createUmi } from '@metaplex-foundation/umi-bundle-defaults';
import {
  createMetadataAccountV3,
  findMetadataPda,
  mplTokenMetadata,
} from '@metaplex-foundation/mpl-token-metadata';
import { 
  createSignerFromKeypair, 
  signerIdentity,
  publicKey,
} from '@metaplex-foundation/umi';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// CONFIGURATION
// ============================================================

interface MetadataConfig {
  network: 'mainnet-beta' | 'devnet' | 'testnet';
  rpcUrl?: string;
  mintAddress: string;
  updateAuthorityKeypairPath: string;
  name: string;
  symbol: string;
  uri: string;
  sellerFeeBasisPoints: number;
  isMutable: boolean;
}

const DEFAULT_METADATA_CONFIG: Partial<MetadataConfig> = {
  network: 'devnet',
  name: 'Wrapped Verity Protocol Token',
  symbol: 'wVRTY',
  uri: 'https://raw.githubusercontent.com/SMMM25/Verity-Protocol-VRTY-/main/solana/metadata/wvrty-metadata.json',
  sellerFeeBasisPoints: 0, // No royalties for utility token
  isMutable: true, // Allow metadata updates
  updateAuthorityKeypairPath: './solana/keys/mint-authority.json',
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function loadKeypair(filepath: string): Keypair {
  const absolutePath = path.resolve(filepath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`Keypair file not found: ${absolutePath}`);
  }
  const secretKey = JSON.parse(fs.readFileSync(absolutePath, 'utf-8'));
  return Keypair.fromSecretKey(new Uint8Array(secretKey));
}

// ============================================================
// METADATA FUNCTIONS
// ============================================================

/**
 * Create token metadata using Metaplex
 */
async function createTokenMetadata(config: MetadataConfig): Promise<string> {
  console.log('\n========================================');
  console.log('  wVRTY Token Metadata Creation');
  console.log('========================================\n');
  
  console.log('Configuration:');
  console.log(`  Network: ${config.network}`);
  console.log(`  Mint: ${config.mintAddress}`);
  console.log(`  Name: ${config.name}`);
  console.log(`  Symbol: ${config.symbol}`);
  console.log(`  URI: ${config.uri}`);
  console.log('');
  
  // Setup Umi
  const rpcUrl = config.rpcUrl || clusterApiUrl(config.network);
  const umi = createUmi(rpcUrl).use(mplTokenMetadata());
  
  // Load update authority
  const updateAuthority = loadKeypair(config.updateAuthorityKeypairPath);
  console.log(`Update Authority: ${updateAuthority.publicKey.toString()}`);
  
  // Create signer
  const umiKeypair = umi.eddsa.createKeypairFromSecretKey(updateAuthority.secretKey);
  const signer = createSignerFromKeypair(umi, umiKeypair);
  umi.use(signerIdentity(signer));
  
  // Create metadata account
  const mint = publicKey(config.mintAddress);
  
  console.log('\nCreating metadata account...');
  
  const builder = createMetadataAccountV3(umi, {
    mint,
    mintAuthority: signer,
    payer: signer,
    updateAuthority: signer.publicKey,
    data: {
      name: config.name,
      symbol: config.symbol,
      uri: config.uri,
      sellerFeeBasisPoints: config.sellerFeeBasisPoints,
      creators: null,
      collection: null,
      uses: null,
    },
    isMutable: config.isMutable,
    collectionDetails: null,
  });
  
  const result = await builder.sendAndConfirm(umi);
  const signature = Buffer.from(result.signature).toString('base64');
  
  console.log(`✅ Metadata created!`);
  console.log(`Transaction: ${signature}`);
  
  // Find metadata PDA
  const metadataPda = findMetadataPda(umi, { mint });
  console.log(`Metadata Account: ${metadataPda[0]}`);
  
  return signature;
}

/**
 * Update token metadata
 */
async function updateTokenMetadata(
  config: MetadataConfig,
  newData: { name?: string; symbol?: string; uri?: string }
): Promise<string> {
  console.log('\n========================================');
  console.log('  wVRTY Token Metadata Update');
  console.log('========================================\n');
  
  // Setup Umi
  const rpcUrl = config.rpcUrl || clusterApiUrl(config.network);
  const umi = createUmi(rpcUrl).use(mplTokenMetadata());
  
  // Load update authority
  const updateAuthority = loadKeypair(config.updateAuthorityKeypairPath);
  const umiKeypair = umi.eddsa.createKeypairFromSecretKey(updateAuthority.secretKey);
  const signer = createSignerFromKeypair(umi, umiKeypair);
  umi.use(signerIdentity(signer));
  
  const mint = publicKey(config.mintAddress);
  
  console.log('Updating metadata...');
  console.log(`New data:`, newData);
  
  // Note: For updates, you'd use updateMetadataAccountV2
  // This is a simplified example
  
  console.log('✅ Update functionality would be implemented here');
  
  return '';
}

// ============================================================
// CLI INTERFACE
// ============================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'create';
  
  const mintAddress = args[1] || process.env.WVRTY_MINT;
  
  if (!mintAddress && command !== 'help') {
    console.error('❌ Mint address required.');
    console.error('Usage: create-metadata <command> <mint-address>');
    console.error('Or set WVRTY_MINT environment variable.');
    process.exit(1);
  }
  
  const config: MetadataConfig = {
    ...DEFAULT_METADATA_CONFIG as MetadataConfig,
    mintAddress: mintAddress || '',
    network: (process.env.SOLANA_NETWORK as any) || 'devnet',
    rpcUrl: process.env.SOLANA_RPC_URL,
  };
  
  try {
    switch (command) {
      case 'create':
        await createTokenMetadata(config);
        break;
        
      case 'update':
        const newUri = args[2];
        if (!newUri) {
          throw new Error('Usage: create-metadata update <mint-address> <new-uri>');
        }
        await updateTokenMetadata(config, { uri: newUri });
        break;
        
      case 'help':
      default:
        console.log(`
wVRTY Token Metadata Script

Commands:
  create <mint-address>              Create metadata for token
  update <mint-address> <new-uri>    Update metadata URI
  help                               Show this help

Environment Variables:
  SOLANA_NETWORK     Network (devnet, testnet, mainnet-beta)
  SOLANA_RPC_URL     Custom RPC URL (optional)
  WVRTY_MINT         wVRTY mint address

Examples:
  npx ts-node create-metadata.ts create <mint-address>
  WVRTY_MINT=xxx npx ts-node create-metadata.ts create
        `);
    }
  } catch (error) {
    console.error('\n❌ Error:', (error as Error).message);
    process.exit(1);
  }
}

export { createTokenMetadata, updateTokenMetadata, MetadataConfig };

main().catch(console.error);
