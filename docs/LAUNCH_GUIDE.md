# VRTY Token Launch Guide

## Quick Start

### Step 1: Check Current State
```bash
# Run without any secrets to check prerequisites
npx ts-node scripts/operations/launch-vrty.ts check
```

This will show:
- Issuer account status
- Treasury balance (XRP + VRTY)
- Current DEX order book
- What's needed next

### Step 2: Test on Testnet First (Recommended)
```bash
# Set network to testnet
export XRPL_NETWORK=testnet

# Check testnet state
npx ts-node scripts/operations/launch-vrty.ts check

# If you have testnet wallet secret, list on testnet DEX
export TREASURY_WALLET_SECRET=sYourTestnetSecret
npx ts-node scripts/operations/launch-vrty.ts list-dex
```

### Step 3: Mainnet Launch
```bash
# Switch to mainnet
export XRPL_NETWORK=mainnet

# IMPORTANT: Use your REAL treasury wallet secret
export TREASURY_WALLET_SECRET=sYourRealSecret

# Optional: Customize launch parameters
export VRTY_INITIAL_PRICE=0.02           # 0.02 XRP per VRTY (~$0.01)
export VRTY_INITIAL_LIQUIDITY=10000000   # 10M VRTY initial

# Full launch
npx ts-node scripts/operations/launch-vrty.ts full-launch
```

---

## Prerequisites

### 1. VRTY Token Must Be Issued
The VRTY token must already exist on XRPL with:
- **Issuer Address**: `rBeHfq9vRjZ8Cth1sMbp2nJvExmxSxAH8f`
- **Currency Code**: `VRTY`
- **Total Supply**: 1,000,000,000

### 2. Treasury Wallet Must Have VRTY
Before listing on DEX, the treasury wallet needs:
- VRTY tokens (transferred from issuer)
- XRP for transaction fees (~100 XRP recommended)
- Trustline to VRTY issuer (created automatically if needed)

### 3. Environment Variables
| Variable | Description | Default |
|----------|-------------|---------|
| `XRPL_NETWORK` | Network to use | `testnet` |
| `VRTY_ISSUER_ADDRESS` | Token issuer | `rBeHfq9vRjZ8Cth1sMbp2nJvExmxSxAH8f` |
| `VRTY_TREASURY_WALLET` | Treasury address | `rLmLMErLKDzWXyYmcZGHqQ3SCgTVJCVjA3` |
| `TREASURY_WALLET_SECRET` | Wallet secret (REQUIRED for transactions) | - |
| `VRTY_INITIAL_PRICE` | Initial price in XRP | `0.02` |
| `VRTY_INITIAL_LIQUIDITY` | VRTY to list | `10000000` |

---

## DEX Listing Details

### Initial Parameters
| Parameter | Value | Notes |
|-----------|-------|-------|
| **Price** | 0.02 XRP/VRTY | ~$0.01 at $0.50 XRP |
| **Spread** | 2% | Distance between buy/sell |
| **Levels** | 5 | Order book depth |
| **Order Size** | 500,000 VRTY | Per level |

### What Gets Created
When you run `list-dex`, the script creates:
- **5 SELL orders** at increasing prices (0.0202, 0.0212, 0.0222, etc.)
- **5 BUY orders** at decreasing prices (0.0198, 0.0188, 0.0178, etc.)

This creates a market with $50,000+ worth of liquidity.

### Pricing Example
At 0.02 XRP/VRTY with XRP at $0.50:
| Amount | XRP Cost | USD Cost |
|--------|----------|----------|
| 1,000 VRTY | 20 XRP | $10 |
| 10,000 VRTY | 200 XRP | $100 |
| 100,000 VRTY | 2,000 XRP | $1,000 |
| 1,000,000 VRTY | 20,000 XRP | $10,000 |

---

## Token Distribution After Launch

### Planned Allocation
| Category | % | Amount | Status |
|----------|---|--------|--------|
| Protocol Treasury | 65% | 650,000,000 | Escrow (50-month release) |
| Founder | 20% | 200,000,000 | 12-month cliff, 48-month vest |
| Ecosystem Fund | 15% | 150,000,000 | 36-month vest |

### 50-Month Release Schedule
| Phase | Months | Rate | Total |
|-------|--------|------|-------|
| 1 | 1-12 | 1.5%/mo | 15% |
| 2 | 13-24 | 2.0%/mo | 24% |
| 3 | 25-36 | 2.0%/mo | 24% |
| 4 | 37-48 | 2.5%/mo | 30% |
| 5 | 49-50 | 3.5%/mo | 7% |

---

## After Launch

### Monitor Your Listing
```bash
# Check status anytime
npx ts-node scripts/operations/launch-vrty.ts status
```

### View on XRPL Explorer
- **Mainnet**: https://livenet.xrpl.org/accounts/YOUR_ADDRESS
- **Testnet**: https://testnet.xrpl.org/accounts/YOUR_ADDRESS

### Trading
Users can trade VRTY at:
- XRPL DEX directly (any XRPL wallet)
- https://sologenic.org (popular XRPL DEX UI)
- https://xrpl.services (another DEX interface)

---

## Security Checklist

### Before Launch
- [ ] Test on testnet first
- [ ] Verify issuer and treasury addresses
- [ ] Ensure sufficient XRP for fees
- [ ] Never share wallet secrets
- [ ] Use hardware wallet for large amounts

### After Launch
- [ ] Monitor order book for fills
- [ ] Set up alerts for large trades
- [ ] Consider starting market maker for ongoing liquidity
- [ ] Document all transaction hashes

---

## Troubleshooting

### "Account NOT FOUND"
The wallet doesn't exist on XRPL yet. You need to fund it with at least 10 XRP (reserve requirement).

### "Insufficient VRTY balance"
Treasury doesn't have enough VRTY. Transfer from issuer:
1. Use issuer wallet to send VRTY to treasury
2. Or check if VRTY was already distributed

### "tecUNFUNDED_OFFER"
Not enough XRP or VRTY to create the offer. Check balances.

### "tecNO_LINE"
Trustline not established. The script should handle this, but you can manually create:
```bash
# In xrpl.js or using XRPL wallet
TrustSet: VRTY from issuer with high limit
```

---

## Support

- **GitHub Issues**: https://github.com/SMMM25/Verity-Protocol-VRTY-/issues
- **Documentation**: https://docs.verity.finance
- **XRPL Docs**: https://xrpl.org/docs.html
