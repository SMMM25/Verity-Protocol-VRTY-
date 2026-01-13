# wVRTY Solana Deployment Guide

Complete guide for deploying the wrapped VRTY (wVRTY) token and bridge infrastructure on Solana.

## Overview

wVRTY is a wrapped version of VRTY (Verity Protocol Token) that exists on the Solana blockchain. It represents VRTY tokens locked on the XRP Ledger (XRPL) and can be bridged back at any time.

### Token Specifications

| Property | Value |
|----------|-------|
| **Name** | Wrapped Verity Protocol Token |
| **Symbol** | wVRTY |
| **Decimals** | 6 (matching XRPL VRTY) |
| **Type** | SPL Token |
| **Supply** | Mintable (backed by locked VRTY) |

### XRPL VRTY Reference

| Property | Value |
|----------|-------|
| **Issuer** | `rBeHfq9vRjZ8Cth1sMbp2nJvExmxSxAH8f` |
| **Total Supply** | 1,000,000,000 VRTY |
| **Distribution Wallet** | `rLmLMErLKDzWXyYmcZGHqQ3SCgTVJCVjA3` |

---

## Prerequisites

### 1. Install Solana CLI

```bash
# macOS/Linux
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Verify installation
solana --version
```

### 2. Install SPL Token CLI

```bash
cargo install spl-token-cli
```

### 3. Configure Solana CLI

```bash
# For devnet (testing)
solana config set --url https://api.devnet.solana.com

# For mainnet (production)
solana config set --url https://api.mainnet-beta.solana.com

# Verify configuration
solana config get
```

### 4. Create/Import Wallet

```bash
# Generate new keypair (for testing)
solana-keygen new --outfile ~/my-solana-wallet.json

# Or recover existing wallet
solana-keygen recover --outfile ~/my-solana-wallet.json

# Set as default
solana config set --keypair ~/my-solana-wallet.json
```

### 5. Get SOL for Deployment

```bash
# Devnet (free airdrop)
solana airdrop 2

# Mainnet - Purchase SOL from exchange and transfer to your wallet
solana address  # Get your address
```

---

## Deployment Steps

### Step 1: Deploy wVRTY Token

#### Option A: Using the Deployment Script (Recommended)

```bash
cd solana/scripts

# Install dependencies
npm install

# Deploy on devnet (for testing)
SOLANA_NETWORK=devnet npx ts-node deploy-wvrty.ts deploy

# Deploy on mainnet (production)
SOLANA_NETWORK=mainnet-beta npx ts-node deploy-wvrty.ts deploy
```

#### Option B: Using Solana CLI Directly

```bash
# Create the token mint
spl-token create-token --decimals 6

# Note the MINT ADDRESS from output (e.g., Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr)

# Create metadata (requires Metaplex)
# See Step 2 for metadata creation
```

### Step 2: Add Token Metadata

```bash
# Using Metaplex metadata script
WVRTY_MINT=<your-mint-address> npx ts-node create-metadata.ts create

# Or manually via Metaplex CLI
metaplex upload ./metadata/wvrty-metadata.json
```

### Step 3: Setup Bridge Treasury

```bash
# Create treasury account for the bridge
WVRTY_MINT=<your-mint-address> npx ts-node deploy-wvrty.ts setup-treasury

# This creates:
# - Treasury authority keypair
# - Associated token account for treasury
```

### Step 4: Configure Environment Variables

Create `.env.production` with your deployment info:

```env
# Solana Configuration
SOLANA_NETWORK=mainnet-beta
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# wVRTY Token
SOLANA_WVRTY_MINT=<your-wvrty-mint-address>

# Bridge Configuration
SOLANA_BRIDGE_PROGRAM=<bridge-program-address>
SOLANA_TREASURY_WALLET=<treasury-authority-address>
SOLANA_TREASURY_ACCOUNT=<treasury-token-account>

# Validator Keys (keep secret!)
VALIDATOR_1_PUBKEY=<validator-1-public-key>
VALIDATOR_2_PUBKEY=<validator-2-public-key>
VALIDATOR_3_PUBKEY=<validator-3-public-key>
```

---

## Validator Setup

The bridge requires a minimum of 3 validators for security. Each validator independently verifies bridge transactions and signs them.

### 1. Generate Validator Keypairs

```bash
# Generate keypairs for each validator
npx ts-node validator-node.ts generate-keypair ./solana/keys/validator-1.json
npx ts-node validator-node.ts generate-keypair ./solana/keys/validator-2.json
npx ts-node validator-node.ts generate-keypair ./solana/keys/validator-3.json
```

### 2. Start Validator Nodes

Each validator should run on a separate server:

**Validator 1:**
```bash
VALIDATOR_ID=v1 \
VALIDATOR_KEYPAIR=./solana/keys/validator-1.json \
WVRTY_MINT=<wvrty-mint> \
BRIDGE_TREASURY=<treasury-account> \
XRPL_BRIDGE_ADDRESS=<xrpl-escrow-address> \
npx ts-node validator-node.ts start
```

**Validator 2:**
```bash
VALIDATOR_ID=v2 \
VALIDATOR_KEYPAIR=./solana/keys/validator-2.json \
WVRTY_MINT=<wvrty-mint> \
BRIDGE_TREASURY=<treasury-account> \
XRPL_BRIDGE_ADDRESS=<xrpl-escrow-address> \
npx ts-node validator-node.ts start
```

**Validator 3:**
```bash
VALIDATOR_ID=v3 \
VALIDATOR_KEYPAIR=./solana/keys/validator-3.json \
WVRTY_MINT=<wvrty-mint> \
BRIDGE_TREASURY=<treasury-account> \
XRPL_BRIDGE_ADDRESS=<xrpl-escrow-address> \
npx ts-node validator-node.ts start
```

### 3. Validator Docker Deployment (Production)

Create `docker-compose.validator.yml`:

```yaml
version: '3.8'
services:
  validator:
    build: .
    environment:
      - VALIDATOR_ID=${VALIDATOR_ID}
      - VALIDATOR_KEYPAIR=/app/keys/validator.json
      - SOLANA_RPC_URL=${SOLANA_RPC_URL}
      - XRPL_RPC_URL=${XRPL_RPC_URL}
      - WVRTY_MINT=${WVRTY_MINT}
      - BRIDGE_TREASURY=${BRIDGE_TREASURY}
    volumes:
      - ./keys:/app/keys:ro
    restart: unless-stopped
    networks:
      - bridge-network
```

---

## Security Considerations

### Key Management

⚠️ **CRITICAL: Secure your keypairs!**

1. **Mint Authority Key**: Controls wVRTY minting
   - Store in hardware wallet or HSM
   - Consider multisig for production

2. **Validator Keys**: Sign bridge transactions
   - Each validator has unique keypair
   - Store securely, never share

3. **Treasury Authority**: Controls bridge treasury
   - Should be a multisig or program-controlled

### Best Practices

1. **Never commit keypairs to git**
2. **Use environment variables for secrets**
3. **Enable freeze authority** for emergency stops
4. **Monitor all bridge transactions**
5. **Regular security audits**

### Adding Keys to .gitignore

```bash
# Ensure keys are never committed
echo "solana/keys/*.json" >> .gitignore
echo "*.keypair" >> .gitignore
```

---

## Post-Deployment Verification

### 1. Verify Token Creation

```bash
# Check token info
spl-token display <WVRTY_MINT>

# Expected output:
# SPL Token Mint
#   Address: <WVRTY_MINT>
#   Decimals: 6
#   Mint Authority: <MINT_AUTHORITY>
#   Freeze Authority: <FREEZE_AUTHORITY>
```

### 2. Verify Metadata

```bash
# Using Metaplex CLI
metaplex token-metadata <WVRTY_MINT>

# Or check on Solana Explorer:
# https://explorer.solana.com/address/<WVRTY_MINT>?cluster=devnet
```

### 3. Test Bridge Flow

```bash
# 1. Initiate test bridge (devnet)
curl -X POST http://localhost:3000/api/v1/bridge/initiate \
  -H "Content-Type: application/json" \
  -d '{
    "sourceChain": "XRPL",
    "destinationChain": "SOLANA",
    "sourceAddress": "<xrpl-test-wallet>",
    "destinationAddress": "<solana-test-wallet>",
    "amount": "100"
  }'

# 2. Check bridge status
curl http://localhost:3000/api/v1/bridge/transaction/<bridge-id>

# 3. Check wVRTY balance
curl "http://localhost:3000/api/v1/bridge/wvrty-balance?address=<solana-wallet>"
```

---

## Troubleshooting

### Common Issues

**1. "Insufficient SOL balance"**
```bash
# Check balance
solana balance

# Airdrop (devnet only)
solana airdrop 2
```

**2. "Token account not found"**
```bash
# Create associated token account
spl-token create-account <WVRTY_MINT>
```

**3. "Authority mismatch"**
- Ensure you're using the correct keypair
- Check mint authority hasn't been transferred

**4. "RPC timeout"**
- Use a dedicated RPC endpoint
- Consider Helius, QuickNode, or Triton

---

## Quick Reference

### Deployment Checklist

- [ ] Solana CLI installed and configured
- [ ] Wallet created with sufficient SOL
- [ ] wVRTY token deployed
- [ ] Token metadata created
- [ ] Bridge treasury setup
- [ ] Validator keypairs generated
- [ ] Validator nodes running (3 minimum)
- [ ] Environment variables configured
- [ ] .gitignore updated for keys
- [ ] Test bridge flow verified

### Important Addresses (Update after deployment)

```
wVRTY Mint:           <TO BE DEPLOYED>
Mint Authority:       <TO BE DEPLOYED>
Freeze Authority:     <TO BE DEPLOYED>
Bridge Treasury:      <TO BE DEPLOYED>
Validator 1:          <TO BE DEPLOYED>
Validator 2:          <TO BE DEPLOYED>
Validator 3:          <TO BE DEPLOYED>
```

### Useful Commands

```bash
# Check token info
spl-token display <MINT>

# Check account balance
spl-token balance <MINT>

# Transfer tokens
spl-token transfer <MINT> <AMOUNT> <RECIPIENT>

# Mint tokens (requires authority)
spl-token mint <MINT> <AMOUNT>

# Burn tokens
spl-token burn <TOKEN_ACCOUNT> <AMOUNT>
```

---

## Support

- GitHub Issues: https://github.com/SMMM25/Verity-Protocol-VRTY-/issues
- Documentation: https://github.com/SMMM25/Verity-Protocol-VRTY-/wiki
