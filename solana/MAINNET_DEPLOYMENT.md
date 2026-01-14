# wVRTY Solana Mainnet Deployment Guide

## Overview

This guide covers deploying the Wrapped Verity Protocol Token (wVRTY) on Solana Mainnet. wVRTY is an SPL token that represents VRTY tokens locked on the XRP Ledger, enabling cross-chain functionality.

## Token Specifications

| Property | Value |
|----------|-------|
| **Name** | Wrapped Verity Protocol Token |
| **Symbol** | wVRTY |
| **Decimals** | 6 (matching XRPL VRTY) |
| **Total Supply** | Mintable (backed 1:1 by locked VRTY) |
| **Standard** | SPL Token |

## XRPL Reference (Production)

| Property | Value |
|----------|-------|
| **VRTY Issuer** | `rBeHfq9vRjZ8Cth1sMbp2nJvExmxSxAH8f` |
| **Total VRTY Supply** | 1,000,000,000 VRTY |
| **Distribution Wallet** | `rLmLMErLKDzWXyYmcZGHqQ3SCgTVJCVjA3` |

## Devnet Deployment (Current)

| Property | Value |
|----------|-------|
| **Network** | Devnet |
| **Mint Address** | `7J2Mo8dqKpeSXRepNpnvDqPFMGngXioVya45AirwXGxQ` |
| **Mint Authority** | `7EKfEcvRQYge8fHTnr7YWA7Q5PUXrmYxmKViiX8jWZh5` |
| **Freeze Authority** | `4hxapL1YWfFwtdp8D14EGMBqfidL4phBdRSU8jm61Kiq` |
| **Treasury Account** | `An3Xm7QbpbcfVoHziZpMqusNjpPK4mxL1xNaUUJJpMJb` |

---

## Pre-Deployment Checklist

### 1. Security Requirements

- [ ] **Hardware Wallet**: Use Ledger Nano S/X for key storage
- [ ] **Air-gapped Machine**: Generate keys on offline computer
- [ ] **Secure Backup**: Multiple encrypted backups in separate locations
- [ ] **Access Control**: Document who has access to keys
- [ ] **Audit Trail**: Enable logging for all operations

### 2. Technical Requirements

- [ ] **SOL Balance**: Minimum 0.05 SOL for deployment (recommended: 0.5 SOL)
- [ ] **RPC Endpoint**: Premium RPC for reliability (Helius, QuickNode, Alchemy)
- [ ] **Node.js**: v18+ installed
- [ ] **Solana CLI**: Latest version installed
- [ ] **TypeScript**: tsconfig properly configured

### 3. Environment Setup

```bash
# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Verify installation
solana --version

# Set mainnet config
solana config set --url https://api.mainnet-beta.solana.com
```

---

## Step 1: Generate Secure Keypairs

### Option A: Solana CLI (Recommended for Testing)

```bash
# Navigate to keys directory
mkdir -p solana/keys/mainnet
cd solana/keys/mainnet

# Generate Mint Authority (controls token minting)
solana-keygen new --outfile mint-authority.json

# Generate Freeze Authority (compliance freeze capability)
solana-keygen new --outfile freeze-authority.json

# Generate Treasury Authority (bridge treasury control)
solana-keygen new --outfile treasury-authority.json

# IMPORTANT: Back up the keypairs securely and NEVER commit to git!
```

### Option B: Hardware Wallet (Recommended for Production)

```bash
# Using Ledger with Solana
# 1. Install Solana app on Ledger
# 2. Connect Ledger to computer
# 3. Derive public keys

# Get Ledger address
solana-keygen pubkey usb://ledger

# Use --keypair option with usb://ledger for transactions
```

### Get Public Keys

```bash
# Display public keys for reference
solana-keygen pubkey mint-authority.json
solana-keygen pubkey freeze-authority.json
solana-keygen pubkey treasury-authority.json
```

---

## Step 2: Fund Mint Authority

The Mint Authority needs SOL to pay for deployment transaction fees.

### Fund from Exchange
1. Go to your Solana exchange account (Coinbase, Binance, etc.)
2. Withdraw to your Mint Authority address
3. Recommended: 0.5 SOL for deployment + buffer

### Verify Balance
```bash
solana balance <MINT_AUTHORITY_ADDRESS> --url https://api.mainnet-beta.solana.com
```

---

## Step 3: Deploy wVRTY Token

### Using the Deployment Script

```bash
# Set environment
export SOLANA_MAINNET_RPC=https://api.mainnet-beta.solana.com
# Or use premium RPC:
# export SOLANA_MAINNET_RPC=https://your-helius-rpc.com

# Navigate to project root
cd /path/to/verity-protocol

# Run mainnet deployment
npx ts-node solana/scripts/deploy-wvrty-mainnet.ts deploy
```

### Expected Output

```
========================================
    wVRTY TOKEN MAINNET DEPLOYMENT
    Verity Protocol - Production Deployment
========================================

Configuration:
   Network: MAINNET-BETA
   Token: Wrapped Verity Protocol Token (wVRTY)
   Decimals: 6
   Freeze Authority: Enabled

Validating keypairs...
   Keypairs validated

Deploy wVRTY token to Solana MAINNET? (yes/no): yes

Connecting to Solana Mainnet...
   Connected!
   Current Slot: XXXXXXX

Mint Authority Balance: 0.5000 SOL

Proceed with token creation? (yes/no): yes

Creating wVRTY token mint...

Mint Created Successfully!
   Mint Address: <NEW_MAINNET_MINT_ADDRESS>
   Explorer: https://solscan.io/token/<NEW_MAINNET_MINT_ADDRESS>
```

---

## Step 4: Setup Bridge Treasury

After deployment, create the bridge treasury account:

```bash
# Setup treasury (replace with actual mint address)
npx ts-node solana/scripts/deploy-wvrty-mainnet.ts setup-treasury <MINT_ADDRESS>
```

### Expected Output

```
========================================
    MAINNET BRIDGE TREASURY SETUP
========================================

Setup bridge treasury on Solana MAINNET? (yes/no): yes

   Treasury Authority: <TREASURY_AUTHORITY_ADDRESS>
   Mint: <MINT_ADDRESS>

Treasury Authority Balance: 0.1000 SOL

Creating treasury token account...

Treasury Account Created!
   Address: <TREASURY_TOKEN_ACCOUNT>
```

---

## Step 5: Verify Deployment

```bash
# Verify on-chain
npx ts-node solana/scripts/deploy-wvrty-mainnet.ts verify

# View deployment info
npx ts-node solana/scripts/deploy-wvrty-mainnet.ts info
```

### Manual Verification

1. **Solscan**: https://solscan.io/token/<MINT_ADDRESS>
2. **Solana FM**: https://solana.fm/address/<MINT_ADDRESS>
3. **Explorer**: https://explorer.solana.com/address/<MINT_ADDRESS>

---

## Step 6: Configure Bridge Service

Update the bridge configuration with mainnet addresses:

```typescript
// src/config/bridge.ts
export const SOLANA_MAINNET_CONFIG = {
  network: 'mainnet-beta',
  rpcUrl: process.env.SOLANA_MAINNET_RPC,
  wvrtyMint: '<NEW_MAINNET_MINT_ADDRESS>',
  treasuryAccount: '<TREASURY_TOKEN_ACCOUNT>',
  treasuryAuthority: '<TREASURY_AUTHORITY_ADDRESS>',
};
```

---

## Step 7: Transfer Mint Authority (Optional)

Once the bridge is fully tested and ready for production:

```bash
# Transfer mint authority to bridge service
# WARNING: This is IRREVERSIBLE!
npx ts-node solana/scripts/deploy-wvrty-mainnet.ts transfer-authority <MINT_ADDRESS> <BRIDGE_SERVICE_ADDRESS>
```

**Important**: Only transfer mint authority after:
- [ ] Bridge service is fully tested on devnet
- [ ] Security audit completed
- [ ] Multi-sig or timelock implemented
- [ ] Monitoring and alerting in place

---

## Security Best Practices

### 1. Key Management

| Key Type | Storage | Access |
|----------|---------|--------|
| Mint Authority | Hardware wallet / HSM | Founders only |
| Freeze Authority | Hardware wallet / HSM | Compliance team |
| Treasury Authority | Secure server | Bridge service |

### 2. Multi-Signature (Recommended)

Consider using Squads Protocol for multi-sig:
- https://squads.so/

```
Recommended Setup:
- Mint Authority: 3-of-5 multi-sig
- Freeze Authority: 2-of-3 multi-sig
- Treasury: Programmatic (bridge contract)
```

### 3. Monitoring

Set up alerts for:
- Large mint operations
- Freeze authority usage
- Unusual transfer patterns
- Bridge transaction failures

---

## Deployment Configuration Files

After deployment, these files will be created:

```
solana/
├── config/
│   ├── wvrty-deployment.json      # Devnet deployment info
│   └── mainnet/
│       └── wvrty-mainnet-deployment.json  # Mainnet deployment info
├── keys/
│   ├── mint-authority.json        # Devnet mint authority
│   ├── freeze-authority.json      # Devnet freeze authority
│   └── mainnet/
│       ├── .gitkeep              # Placeholder (no keys committed!)
│       ├── mint-authority.json   # Mainnet mint authority (local only)
│       ├── freeze-authority.json # Mainnet freeze authority (local only)
│       └── treasury-authority.json # Mainnet treasury (local only)
└── metadata/
    └── wvrty-metadata.json        # Token metadata (shared)
```

---

## Troubleshooting

### Common Issues

1. **Insufficient SOL Balance**
   ```
   Error: Insufficient SOL balance for deployment
   Solution: Fund the mint authority with at least 0.05 SOL
   ```

2. **RPC Rate Limits**
   ```
   Error: 429 Too Many Requests
   Solution: Use a premium RPC endpoint (Helius, QuickNode, Alchemy)
   ```

3. **Keypair Not Found**
   ```
   Error: Mint Authority keypair not found
   Solution: Generate keypairs as described in Step 1
   ```

4. **Transaction Failed**
   ```
   Error: Transaction simulation failed
   Solution: Increase SOL balance, check network status, retry
   ```

### Support

- **GitHub Issues**: https://github.com/SMMM25/Verity-Protocol-VRTY-/issues
- **API Health**: https://www.verityprotocol.io/api/v1/health

---

## Post-Deployment Checklist

- [ ] Token verified on Solscan
- [ ] Metadata displaying correctly
- [ ] Bridge treasury created
- [ ] Bridge service configured
- [ ] Test transaction completed (small amount)
- [ ] Monitoring dashboard set up
- [ ] Emergency procedures documented
- [ ] Team trained on operations

---

## Maintenance Mode Note

**To unlock the site later** (when ready for launch):

```typescript
// File: src/api/middleware/maintenance.ts
// Change:
return true;  // HARDCODED ON for pre-launch
// To:
return false; // Unlocked
```

Then commit and push to deploy.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-13 | Initial devnet deployment |
| 2.0.0 | 2026-01-14 | Mainnet deployment script |

---

*Verity Protocol - Where Truth Meets Technology*
