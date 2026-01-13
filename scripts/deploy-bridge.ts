/**
 * Verity Protocol - Complete Bridge Deployment Script
 * 
 * @description Orchestrates the full deployment of the XRPL ↔ Solana bridge.
 * This script deploys all components in the correct order.
 * 
 * Deployment Order:
 * 1. XRPL Bridge Escrow Account
 * 2. Solana wVRTY Token
 * 3. Solana Bridge Treasury
 * 4. Token Metadata
 * 5. Configuration Files
 * 
 * @version 1.0.0
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync, spawn } from 'child_process';

// ============================================================
// CONFIGURATION
// ============================================================

interface DeploymentState {
  startedAt: string;
  completedAt?: string;
  network: {
    xrpl: string;
    solana: string;
  };
  xrpl: {
    deployed: boolean;
    escrowAddress?: string;
    escrowPublicKey?: string;
  };
  solana: {
    deployed: boolean;
    wvrtyMint?: string;
    mintAuthority?: string;
    freezeAuthority?: string;
    treasuryAccount?: string;
    treasuryAuthority?: string;
  };
  metadata: {
    created: boolean;
    uri?: string;
  };
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  error?: string;
}

const STATE_FILE = './bridge-deployment-state.json';

// ============================================================
// STATE MANAGEMENT
// ============================================================

function loadState(): DeploymentState {
  if (fs.existsSync(STATE_FILE)) {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
  }
  
  return {
    startedAt: new Date().toISOString(),
    network: {
      xrpl: process.env['XRPL_NETWORK'] || 'testnet',
      solana: process.env['SOLANA_NETWORK'] || 'devnet',
    },
    xrpl: { deployed: false },
    solana: { deployed: false },
    metadata: { created: false },
    status: 'pending',
  };
}

function saveState(state: DeploymentState): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ============================================================
// LOGGING
// ============================================================

function logSection(title: string): void {
  console.log('\n' + '═'.repeat(60));
  console.log(`  ${title}`);
  console.log('═'.repeat(60) + '\n');
}

function logStep(step: string): void {
  console.log(`\n▶ ${step}`);
  console.log('─'.repeat(50));
}

function logSuccess(message: string): void {
  console.log(`✅ ${message}`);
}

function logError(message: string): void {
  console.log(`❌ ${message}`);
}

function logInfo(message: string): void {
  console.log(`ℹ️  ${message}`);
}

// ============================================================
// DEPLOYMENT FUNCTIONS
// ============================================================

async function runScript(
  scriptPath: string,
  args: string[] = [],
  env: Record<string, string> = {}
): Promise<string> {
  return new Promise((resolve, reject) => {
    const fullEnv = { ...process.env, ...env };
    
    const child = spawn('npx', ['ts-node', scriptPath, ...args], {
      env: fullEnv,
      stdio: ['inherit', 'pipe', 'pipe'],
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout?.on('data', (data) => {
      stdout += data.toString();
      process.stdout.write(data);
    });
    
    child.stderr?.on('data', (data) => {
      stderr += data.toString();
      process.stderr.write(data);
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Script failed with code ${code}: ${stderr}`));
      }
    });
  });
}

async function deployXRPLEscrow(state: DeploymentState): Promise<void> {
  logStep('Deploying XRPL Bridge Escrow');
  
  if (state.xrpl.deployed && state.xrpl.escrowAddress) {
    logInfo(`Already deployed: ${state.xrpl.escrowAddress}`);
    return;
  }
  
  try {
    await runScript('./xrpl/scripts/bridge-escrow.ts', ['setup'], {
      XRPL_NETWORK: state.network.xrpl,
    });
    
    // Load deployment info
    const deploymentPath = './xrpl/config/bridge-deployment.json';
    if (fs.existsSync(deploymentPath)) {
      const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf-8'));
      state.xrpl.deployed = true;
      state.xrpl.escrowAddress = deployment.escrow.address;
      state.xrpl.escrowPublicKey = deployment.escrow.publicKey;
      saveState(state);
      logSuccess(`XRPL Escrow deployed: ${state.xrpl.escrowAddress}`);
    }
  } catch (error) {
    logError(`XRPL deployment failed: ${(error as Error).message}`);
    throw error;
  }
}

async function deploySolanaToken(state: DeploymentState): Promise<void> {
  logStep('Deploying Solana wVRTY Token');
  
  if (state.solana.deployed && state.solana.wvrtyMint) {
    logInfo(`Already deployed: ${state.solana.wvrtyMint}`);
    return;
  }
  
  try {
    await runScript('./solana/scripts/deploy-wvrty.ts', ['deploy'], {
      SOLANA_NETWORK: state.network.solana,
    });
    
    // Load deployment info
    const deploymentPath = './solana/config/wvrty-deployment.json';
    if (fs.existsSync(deploymentPath)) {
      const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf-8'));
      state.solana.deployed = true;
      state.solana.wvrtyMint = deployment.token.mint;
      state.solana.mintAuthority = deployment.authorities.mintAuthority;
      state.solana.freezeAuthority = deployment.authorities.freezeAuthority;
      saveState(state);
      logSuccess(`wVRTY Token deployed: ${state.solana.wvrtyMint}`);
    }
  } catch (error) {
    logError(`Solana token deployment failed: ${(error as Error).message}`);
    throw error;
  }
}

async function setupBridgeTreasury(state: DeploymentState): Promise<void> {
  logStep('Setting up Solana Bridge Treasury');
  
  if (state.solana.treasuryAccount) {
    logInfo(`Already configured: ${state.solana.treasuryAccount}`);
    return;
  }
  
  if (!state.solana.wvrtyMint) {
    throw new Error('wVRTY token must be deployed first');
  }
  
  try {
    await runScript('./solana/scripts/deploy-wvrty.ts', ['setup-treasury', state.solana.wvrtyMint], {
      SOLANA_NETWORK: state.network.solana,
    });
    
    // Load updated deployment info
    const deploymentPath = './solana/config/wvrty-deployment.json';
    if (fs.existsSync(deploymentPath)) {
      const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf-8'));
      if (deployment.bridge) {
        state.solana.treasuryAccount = deployment.bridge.treasuryAccount;
        state.solana.treasuryAuthority = deployment.bridge.treasuryAuthority;
        saveState(state);
        logSuccess(`Treasury configured: ${state.solana.treasuryAccount}`);
      }
    }
  } catch (error) {
    logError(`Treasury setup failed: ${(error as Error).message}`);
    throw error;
  }
}

async function createTokenMetadata(state: DeploymentState): Promise<void> {
  logStep('Creating Token Metadata');
  
  if (state.metadata.created) {
    logInfo('Metadata already created');
    return;
  }
  
  if (!state.solana.wvrtyMint) {
    throw new Error('wVRTY token must be deployed first');
  }
  
  try {
    await runScript('./solana/scripts/create-metadata.ts', ['create', state.solana.wvrtyMint], {
      SOLANA_NETWORK: state.network.solana,
    });
    
    state.metadata.created = true;
    state.metadata.uri = 'https://raw.githubusercontent.com/SMMM25/Verity-Protocol-VRTY-/main/solana/metadata/wvrty-metadata.json';
    saveState(state);
    logSuccess('Token metadata created');
  } catch (error) {
    // Metadata creation might fail if already exists, which is OK
    logInfo(`Metadata note: ${(error as Error).message}`);
    state.metadata.created = true;
    saveState(state);
  }
}

function generateEnvFile(state: DeploymentState): void {
  logStep('Generating Environment Configuration');
  
  const envContent = `# Verity Protocol Bridge Configuration
# Generated: ${new Date().toISOString()}
# Network: ${state.network.xrpl} / ${state.network.solana}

# ============================================================
# XRPL Configuration
# ============================================================
XRPL_NETWORK=${state.network.xrpl}
XRPL_SERVER=${state.network.xrpl === 'mainnet' ? 'wss://xrplcluster.com' : 'wss://s.altnet.rippletest.net:51233'}

# VRTY Token
VRTY_ISSUER=rBeHfq9vRjZ8Cth1sMbp2nJvExmxSxAH8f
VRTY_CURRENCY_CODE=VRTY
VRTY_DISTRIBUTION_WALLET=rLmLMErLKDzWXyYmcZGHqQ3SCgTVJCVjA3

# Bridge Escrow
BRIDGE_ESCROW_ADDRESS=${state.xrpl.escrowAddress || ''}

# ============================================================
# Solana Configuration
# ============================================================
SOLANA_NETWORK=${state.network.solana}
SOLANA_RPC_URL=${state.network.solana === 'mainnet-beta' ? 'https://api.mainnet-beta.solana.com' : 'https://api.devnet.solana.com'}

# wVRTY Token
SOLANA_WVRTY_MINT=${state.solana.wvrtyMint || ''}
SOLANA_MINT_AUTHORITY=${state.solana.mintAuthority || ''}
SOLANA_FREEZE_AUTHORITY=${state.solana.freezeAuthority || ''}

# Bridge Treasury
SOLANA_TREASURY_ACCOUNT=${state.solana.treasuryAccount || ''}
SOLANA_TREASURY_AUTHORITY=${state.solana.treasuryAuthority || ''}

# ============================================================
# Bridge Settings
# ============================================================
BRIDGE_MIN_AMOUNT=100
BRIDGE_MAX_AMOUNT=1000000
BRIDGE_FEE_BPS=10
VALIDATOR_THRESHOLD=3
`;

  const envPath = './bridge.env';
  fs.writeFileSync(envPath, envContent);
  logSuccess(`Environment file generated: ${envPath}`);
  
  // Also update the main .env if it exists
  const mainEnvPath = './.env';
  if (fs.existsSync(mainEnvPath)) {
    const existingEnv = fs.readFileSync(mainEnvPath, 'utf-8');
    if (!existingEnv.includes('SOLANA_WVRTY_MINT')) {
      fs.appendFileSync(mainEnvPath, '\n# Bridge Configuration (auto-generated)\n' + envContent);
      logInfo('Updated main .env file');
    }
  }
}

function printSummary(state: DeploymentState): void {
  logSection('Deployment Summary');
  
  console.log('Networks:');
  console.log(`  XRPL: ${state.network.xrpl}`);
  console.log(`  Solana: ${state.network.solana}`);
  
  console.log('\nXRPL Bridge:');
  console.log(`  Status: ${state.xrpl.deployed ? '✅ Deployed' : '❌ Not deployed'}`);
  if (state.xrpl.escrowAddress) {
    console.log(`  Escrow Address: ${state.xrpl.escrowAddress}`);
  }
  
  console.log('\nSolana wVRTY:');
  console.log(`  Status: ${state.solana.deployed ? '✅ Deployed' : '❌ Not deployed'}`);
  if (state.solana.wvrtyMint) {
    console.log(`  Mint Address: ${state.solana.wvrtyMint}`);
    console.log(`  Mint Authority: ${state.solana.mintAuthority}`);
  }
  if (state.solana.treasuryAccount) {
    console.log(`  Treasury Account: ${state.solana.treasuryAccount}`);
  }
  
  console.log('\nMetadata:');
  console.log(`  Status: ${state.metadata.created ? '✅ Created' : '❌ Not created'}`);
  
  console.log('\nNext Steps:');
  if (!state.xrpl.deployed) {
    console.log('  1. Run: npx ts-node scripts/deploy-bridge.ts');
  } else if (!state.solana.deployed) {
    console.log('  1. Deploy wVRTY token');
  } else if (!state.solana.treasuryAccount) {
    console.log('  1. Setup bridge treasury');
  } else {
    console.log('  1. Start validator nodes');
    console.log('  2. Test bridge with: npx ts-node scripts/test-bridge-e2e.ts full');
    console.log('  3. Monitor bridge health');
  }
}

// ============================================================
// MAIN DEPLOYMENT FLOW
// ============================================================

async function deployAll(): Promise<void> {
  logSection('Verity Protocol Bridge Deployment');
  
  const state = loadState();
  state.status = 'in_progress';
  saveState(state);
  
  console.log('Starting deployment...');
  console.log(`  XRPL Network: ${state.network.xrpl}`);
  console.log(`  Solana Network: ${state.network.solana}`);
  
  try {
    // Step 1: Deploy XRPL Escrow
    await deployXRPLEscrow(state);
    
    // Step 2: Deploy Solana Token
    await deploySolanaToken(state);
    
    // Step 3: Setup Treasury
    await setupBridgeTreasury(state);
    
    // Step 4: Create Metadata
    await createTokenMetadata(state);
    
    // Step 5: Generate Config
    generateEnvFile(state);
    
    // Complete
    state.status = 'completed';
    state.completedAt = new Date().toISOString();
    saveState(state);
    
    printSummary(state);
    
    logSection('Deployment Complete! 🎉');
    
  } catch (error) {
    state.status = 'failed';
    state.error = (error as Error).message;
    saveState(state);
    
    logError(`Deployment failed: ${(error as Error).message}`);
    logInfo('Fix the error and run the deployment again. Progress has been saved.');
    process.exit(1);
  }
}

async function showStatus(): Promise<void> {
  const state = loadState();
  printSummary(state);
}

async function resetDeployment(): Promise<void> {
  if (fs.existsSync(STATE_FILE)) {
    fs.unlinkSync(STATE_FILE);
    logSuccess('Deployment state reset');
  }
  
  // Don't delete actual deployment files, just the state
  logInfo('Note: Actual deployed tokens/accounts are not affected');
}

// ============================================================
// CLI
// ============================================================

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'deploy';
  
  switch (command) {
    case 'deploy':
      await deployAll();
      break;
      
    case 'status':
      await showStatus();
      break;
      
    case 'reset':
      await resetDeployment();
      break;
      
    case 'xrpl':
      const xrplState = loadState();
      await deployXRPLEscrow(xrplState);
      saveState(xrplState);
      break;
      
    case 'solana':
      const solanaState = loadState();
      await deploySolanaToken(solanaState);
      await setupBridgeTreasury(solanaState);
      saveState(solanaState);
      break;
      
    default:
      console.log(`
Verity Protocol Bridge Deployment

Commands:
  deploy     Deploy complete bridge infrastructure
  status     Show deployment status
  reset      Reset deployment state (doesn't affect deployed contracts)
  xrpl       Deploy only XRPL components
  solana     Deploy only Solana components

Environment Variables:
  XRPL_NETWORK     XRPL network (mainnet, testnet, devnet)
  SOLANA_NETWORK   Solana network (mainnet-beta, devnet, testnet)

Examples:
  # Deploy to testnet/devnet (recommended for first deployment)
  XRPL_NETWORK=testnet SOLANA_NETWORK=devnet npx ts-node scripts/deploy-bridge.ts

  # Check deployment status
  npx ts-node scripts/deploy-bridge.ts status

  # Deploy only XRPL escrow
  npx ts-node scripts/deploy-bridge.ts xrpl
      `);
  }
}

main().catch(console.error);
