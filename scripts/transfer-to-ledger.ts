/**
 * Transfer VRTY Tokens to Ledger Nano X
 * 
 * This script helps you:
 * 1. Add a VRTY trustline to your Ledger address
 * 2. Transfer VRTY tokens from distribution wallet to your Ledger
 * 
 * IMPORTANT: Keep your Ledger seed phrase OFFLINE and NEVER enter it digitally!
 * The trustline transaction must be signed on your Ledger device.
 */

import { Client, Wallet, TrustSet, Payment, xrpToDrops } from 'xrpl';
import * as fs from 'fs';
import * as readline from 'readline';

// VRTY Token Configuration
const VRTY_CONFIG = {
  issuer: 'rBU2SVSbw6f4GErNtCLs5tuHDZo5SrD55h',
  currency: 'VRTY',
  currencyHex: '5652545900000000000000000000000000000000',
  network: 'wss://s.altnet.rippletest.net:51233' // Testnet
  // For Mainnet: 'wss://xrplcluster.com' or 'wss://s1.ripple.com'
};

// Load distribution wallet credentials
function loadCredentials() {
  const credPath = '.vrty-credentials.json';
  if (!fs.existsSync(credPath)) {
    throw new Error('Credentials file not found. Run deploy-vrty-token.ts first.');
  }
  return JSON.parse(fs.readFileSync(credPath, 'utf-8'));
}

// Create readline interface for user input
function createReadline() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
}

async function question(rl: readline.Interface, prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function main() {
  const rl = createReadline();
  
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                                                                ║
║   VRTY Token Transfer to Ledger Nano X                        ║
║                                                                ║
║   This script will help you secure your VRTY tokens           ║
║   on your Ledger hardware wallet.                             ║
║                                                                ║
╚════════════════════════════════════════════════════════════════╝
`);

  console.log('⚠️  SECURITY REMINDERS:');
  console.log('   • NEVER enter your Ledger recovery phrase digitally');
  console.log('   • Only enter your Ledger\'s PUBLIC address (starts with r...)');
  console.log('   • Verify all transactions on your Ledger device screen');
  console.log('');

  // Get Ledger address
  const ledgerAddress = await question(rl, '📍 Enter your Ledger Nano X XRP address: ');
  
  if (!ledgerAddress.startsWith('r') || ledgerAddress.length < 25) {
    console.error('❌ Invalid XRP address. Must start with "r" and be ~25-35 characters.');
    rl.close();
    process.exit(1);
  }

  // Get amount to transfer
  const amountStr = await question(rl, '💰 Enter amount of VRTY to transfer (or "all" for full balance): ');
  
  console.log('\n🔗 Connecting to XRPL...');
  const client = new Client(VRTY_CONFIG.network);
  await client.connect();
  console.log('✅ Connected to XRPL Testnet\n');

  try {
    // Load distribution wallet
    const credentials = loadCredentials();
    const distributionWallet = Wallet.fromSeed(credentials.distribution.seed);
    
    console.log(`📦 Distribution Wallet: ${distributionWallet.address}`);
    
    // Check distribution wallet VRTY balance
    const balances = await client.request({
      command: 'account_lines',
      account: distributionWallet.address,
      peer: VRTY_CONFIG.issuer
    });
    
    const vrtyLine = balances.result.lines.find(
      (line: any) => line.currency === VRTY_CONFIG.currencyHex || line.currency === 'VRTY'
    );
    
    if (!vrtyLine) {
      console.error('❌ No VRTY balance found in distribution wallet');
      await client.disconnect();
      rl.close();
      process.exit(1);
    }
    
    const availableBalance = parseFloat(vrtyLine.balance);
    console.log(`💎 Available VRTY: ${availableBalance.toLocaleString()}\n`);
    
    const transferAmount = amountStr.toLowerCase() === 'all' 
      ? availableBalance 
      : parseFloat(amountStr);
    
    if (isNaN(transferAmount) || transferAmount <= 0) {
      console.error('❌ Invalid amount');
      await client.disconnect();
      rl.close();
      process.exit(1);
    }
    
    if (transferAmount > availableBalance) {
      console.error(`❌ Insufficient balance. Available: ${availableBalance}`);
      await client.disconnect();
      rl.close();
      process.exit(1);
    }

    // Check if Ledger address exists and has trustline
    console.log('🔍 Checking Ledger address...');
    
    let needsTrustline = true;
    try {
      const ledgerLines = await client.request({
        command: 'account_lines',
        account: ledgerAddress,
        peer: VRTY_CONFIG.issuer
      });
      
      const existingTrustline = ledgerLines.result.lines.find(
        (line: any) => line.currency === VRTY_CONFIG.currencyHex || line.currency === 'VRTY'
      );
      
      if (existingTrustline) {
        console.log('✅ VRTY trustline already exists on Ledger address');
        needsTrustline = false;
      }
    } catch (e: any) {
      if (e.data?.error === 'actNotFound') {
        console.log('⚠️  Ledger address not activated. Need to send XRP first.');
        
        // Ask to fund the account
        const fundAccount = await question(rl, '   Send 15 XRP to activate? (yes/no): ');
        
        if (fundAccount.toLowerCase() === 'yes') {
          console.log('   Sending 15 XRP to activate account...');
          
          const activateTx: Payment = {
            TransactionType: 'Payment',
            Account: distributionWallet.address,
            Destination: ledgerAddress,
            Amount: xrpToDrops('15')
          };
          
          const activateResult = await client.submitAndWait(activateTx, {
            wallet: distributionWallet
          });
          
          if (activateResult.result.meta && 
              typeof activateResult.result.meta === 'object' &&
              'TransactionResult' in activateResult.result.meta &&
              activateResult.result.meta.TransactionResult === 'tesSUCCESS') {
            console.log('   ✅ Account activated!');
          } else {
            console.error('   ❌ Failed to activate account');
            await client.disconnect();
            rl.close();
            process.exit(1);
          }
        } else {
          console.log('   Please activate your Ledger XRP address first.');
          await client.disconnect();
          rl.close();
          process.exit(1);
        }
      }
    }

    // Trustline instructions
    if (needsTrustline) {
      console.log(`
╔════════════════════════════════════════════════════════════════╗
║   TRUSTLINE REQUIRED                                           ║
╚════════════════════════════════════════════════════════════════╝

Your Ledger address needs a VRTY trustline before receiving tokens.

📱 To add trustline using XUMM:
   1. Open XUMM wallet
   2. Go to Settings → Add Token (or scan QR)
   3. Enter Issuer: ${VRTY_CONFIG.issuer}
   4. Enter Currency: VRTY
   5. Sign with your Ledger

🔗 Or use this trust line URL:
   https://xumm.app/detect/secret?issuer=${VRTY_CONFIG.issuer}&currency=VRTY

`);
      
      const trustlineAdded = await question(rl, 'Have you added the trustline? (yes/no): ');
      
      if (trustlineAdded.toLowerCase() !== 'yes') {
        console.log('Please add the trustline first, then run this script again.');
        await client.disconnect();
        rl.close();
        process.exit(0);
      }
      
      // Verify trustline
      const verifyLines = await client.request({
        command: 'account_lines',
        account: ledgerAddress,
        peer: VRTY_CONFIG.issuer
      });
      
      const verifiedTrustline = verifyLines.result.lines.find(
        (line: any) => line.currency === VRTY_CONFIG.currencyHex || line.currency === 'VRTY'
      );
      
      if (!verifiedTrustline) {
        console.error('❌ Trustline not detected. Please ensure it was added correctly.');
        await client.disconnect();
        rl.close();
        process.exit(1);
      }
      
      console.log('✅ Trustline verified!\n');
    }

    // Confirm transfer
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║   TRANSFER CONFIRMATION                                        ║
╚════════════════════════════════════════════════════════════════╝

   From: ${distributionWallet.address}
   To:   ${ledgerAddress}
   Amount: ${transferAmount.toLocaleString()} VRTY

`);
    
    const confirmTransfer = await question(rl, 'Proceed with transfer? (yes/no): ');
    
    if (confirmTransfer.toLowerCase() !== 'yes') {
      console.log('Transfer cancelled.');
      await client.disconnect();
      rl.close();
      process.exit(0);
    }

    // Execute transfer
    console.log('\n📤 Transferring VRTY tokens...');
    
    const transferTx: Payment = {
      TransactionType: 'Payment',
      Account: distributionWallet.address,
      Destination: ledgerAddress,
      Amount: {
        currency: VRTY_CONFIG.currencyHex,
        issuer: VRTY_CONFIG.issuer,
        value: transferAmount.toString()
      }
    };
    
    const transferResult = await client.submitAndWait(transferTx, {
      wallet: distributionWallet
    });
    
    if (transferResult.result.meta && 
        typeof transferResult.result.meta === 'object' &&
        'TransactionResult' in transferResult.result.meta &&
        transferResult.result.meta.TransactionResult === 'tesSUCCESS') {
      
      const txHash = transferResult.result.hash;
      
      console.log(`
╔════════════════════════════════════════════════════════════════╗
║   ✅ TRANSFER SUCCESSFUL!                                      ║
╚════════════════════════════════════════════════════════════════╝

   Amount: ${transferAmount.toLocaleString()} VRTY
   To: ${ledgerAddress}
   
   Transaction Hash: ${txHash}
   
   🔗 View on Explorer:
   https://testnet.xrpl.org/transactions/${txHash}
   
   🔒 Your tokens are now secured on your Ledger Nano X!

╔════════════════════════════════════════════════════════════════╗
║   IMPORTANT REMINDERS                                          ║
╚════════════════════════════════════════════════════════════════╝

   • Keep your Ledger recovery phrase in a SAFE location
   • NEVER share your recovery phrase with anyone
   • Consider using a metal backup for fire/water protection
   • Test recovery before storing large amounts

`);
    } else {
      console.error('❌ Transfer failed');
      console.error(transferResult.result);
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.disconnect();
    rl.close();
  }
}

main().catch(console.error);
