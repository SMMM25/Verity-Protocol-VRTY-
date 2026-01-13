# Verity Protocol - Bridge Deployment Summary

## Deployment Date
**2026-01-13** (Testnet/Devnet)

---

## XRPL Configuration

### Network: Testnet
- **Server**: `wss://s.altnet.rippletest.net:51233`
- **Status**: Active

### VRTY Token (Mainnet Reference)
| Property | Value |
|----------|-------|
| **Issuer** | `rBeHfq9vRjZ8Cth1sMbp2nJvExmxSxAH8f` |
| **Total Supply** | 1,000,000,000 VRTY |
| **Distribution Wallet** | `rLmLMErLKDzWXyYmcZGHqQ3SCgTVJCVjA3` |
| **Currency Code (Hex)** | `5652545900000000000000000000000000000000` |

### Bridge Escrow Account (Testnet)
| Property | Value |
|----------|-------|
| **Address** | `rMSx5CkHJqZA4QVwp9gbwNi2JqCqK4kMPQ` |
| **Public Key** | `ED04F5C724B9B59E8940A6B1473A0D2DB750B1814BEC70437B26EB292FF9E891B2` |
| **Status** | Active |
| **Trustline** | Pending (VRTY issuer not on testnet) |

---

## Solana Configuration

### Network: Devnet
- **RPC URL**: `https://api.devnet.solana.com`
- **Status**: Active

### wVRTY Token (Devnet Deployment)
| Property | Value |
|----------|-------|
| **Name** | Wrapped Verity Protocol Token |
| **Symbol** | wVRTY |
| **Decimals** | 6 |
| **Mint Address** | `7J2Mo8dqKpeSXRepNpnvDqPFMGngXioVya45AirwXGxQ` |
| **Current Supply** | 0 (mintable) |

### Authorities
| Role | Public Key |
|------|------------|
| **Mint Authority** | `7EKfEcvRQYge8fHTnr7YWA7Q5PUXrmYxmKViiX8jWZh5` |
| **Freeze Authority** | `4hxapL1YWfFwtdp8D14EGMBqfidL4phBdRSU8jm61Kiq` |
| **Treasury Authority** | `2zQiuzcVvMbU9GTfkp1Ffy9R63knvU5RTot53wdofqHV` |

### Bridge Treasury
| Property | Value |
|----------|-------|
| **Token Account** | `An3Xm7QbpbcfVoHziZpMqusNjpPK4mxL1xNaUUJJpMJb` |
| **Authority** | `2zQiuzcVvMbU9GTfkp1Ffy9R63knvU5RTot53wdofqHV` |

---

## Bridge Flow

### XRPL → Solana (Lock & Mint)
1. User sends VRTY to escrow address: `rMSx5CkHJqZA4QVwp9gbwNi2JqCqK4kMPQ`
2. Bridge detects deposit and verifies on XRPL
3. Validators sign the mint request (3 of 5 required)
4. wVRTY is minted to user's Solana wallet
5. Transaction recorded in database

### Solana → XRPL (Burn & Release)
1. User burns wVRTY from their Solana wallet
2. Bridge detects burn transaction
3. Validators sign the release request (3 of 5 required)
4. VRTY is released from escrow to user's XRPL wallet
5. Transaction recorded in database

---

## Fee Structure

| Fee Type | Amount |
|----------|--------|
| **Base Fee** | 10 VRTY |
| **Percentage Fee** | 0.25% (25 basis points) |
| **Minimum Bridge** | 100 VRTY |
| **Maximum Bridge** | 1,000,000 VRTY |

---

## Key Files

### Configuration Files
- `solana/config/wvrty-deployment.json` - Solana deployment details
- `xrpl/config/bridge-deployment.json` - XRPL deployment details
- `bridge.env.example` - Environment configuration template

### Scripts
- `solana/scripts/deploy-wvrty.ts` - wVRTY token deployment
- `solana/scripts/create-metadata.ts` - Token metadata setup
- `solana/scripts/validator-node.ts` - Bridge validator node
- `xrpl/scripts/bridge-escrow.ts` - XRPL escrow management
- `scripts/deploy-bridge.ts` - Full deployment orchestrator
- `scripts/test-bridge-e2e.ts` - End-to-end testing

### Keypairs (SECURE THESE!)
- `solana/keys/mint-authority.json` - wVRTY mint authority
- `solana/keys/freeze-authority.json` - wVRTY freeze authority
- `solana/keys/treasury-authority.json` - Treasury authority
- `xrpl/config/bridge-escrow-wallet.json` - XRPL escrow wallet

---

## Testing Commands

```bash
# Health Check
npx ts-node scripts/test-bridge-e2e.ts health

# XRPL Escrow Info
npx ts-node xrpl/scripts/bridge-escrow.ts info

# Solana wVRTY Info
npx ts-node solana/scripts/deploy-wvrty.ts info

# Run E2E Tests (requires funded wallets)
npx ts-node scripts/test-bridge-e2e.ts full
```

---

## Next Steps for Production

1. **Deploy to Mainnet**
   - Deploy wVRTY on Solana Mainnet
   - Create XRPL escrow on Mainnet
   - Set up trustline with real VRTY issuer

2. **Validator Setup**
   - Deploy 5+ validator nodes
   - Configure multi-sig (3 of 5)
   - Set up monitoring and alerts

3. **Security Audit**
   - Smart contract audit
   - Bridge logic audit
   - Key management review

4. **Production Configuration**
   - Transfer mint authority to multi-sig
   - Set up KMS for key management
   - Configure rate limiting

---

## Explorer Links

### Solana (Devnet)
- **wVRTY Token**: [View on Solscan](https://solscan.io/token/7J2Mo8dqKpeSXRepNpnvDqPFMGngXioVya45AirwXGxQ?cluster=devnet)
- **Mint Authority**: [View on Solscan](https://solscan.io/account/7EKfEcvRQYge8fHTnr7YWA7Q5PUXrmYxmKViiX8jWZh5?cluster=devnet)
- **Treasury Account**: [View on Solscan](https://solscan.io/account/An3Xm7QbpbcfVoHziZpMqusNjpPK4mxL1xNaUUJJpMJb?cluster=devnet)

### XRPL (Testnet)
- **Bridge Escrow**: [View on Testnet Explorer](https://testnet.xrpl.org/accounts/rMSx5CkHJqZA4QVwp9gbwNi2JqCqK4kMPQ)

---

## Contact

For questions about the bridge deployment, refer to the Verity Protocol documentation or contact the development team.
