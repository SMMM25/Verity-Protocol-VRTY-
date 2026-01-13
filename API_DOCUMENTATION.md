# Verity Protocol API Documentation

## Overview
The Verity Protocol API provides a comprehensive suite of endpoints for interacting with the VRTY token ecosystem on XRPL and Solana.

**Base URL**: `/api/v1`

---

## Authentication
Most endpoints require wallet authentication via the `x-wallet-address` header.

```
x-wallet-address: rYourXRPLWalletAddress
```

For XUMM authentication, use the `/auth/xumm/*` endpoints.

---

## VRTY Token Endpoints

### GET /vrty/info
Get VRTY token information.

**Response:**
```json
{
  "success": true,
  "data": {
    "token": {
      "symbol": "VRTY",
      "name": "Verity Protocol Token",
      "decimals": 6,
      "currencyCode": "VRTY"
    },
    "supply": {
      "total": "1000000000"
    },
    "addresses": {
      "issuer": "rBeHfq9vRjZ8Cth1sMbp2nJvExmxSxAH8f",
      "distributionWallet": "rLmLMErLKDzWXyYmcZGHqQ3SCgTVJCVjA3"
    }
  }
}
```

### GET /vrty/balance/:address
Get VRTY and XRP balance for an address.

**Parameters:**
- `address` (path): XRPL wallet address
- `network` (query, optional): "mainnet" or "testnet"

**Response:**
```json
{
  "success": true,
  "data": {
    "address": "rYourAddress",
    "vrty": {
      "balance": "10000",
      "hasTrustline": true
    },
    "xrp": {
      "balance": "100"
    },
    "staking": {
      "tier": "CAPTAIN",
      "tierDetails": {...}
    }
  }
}
```

### POST /vrty/verify-stake
Verify if an address has sufficient VRTY stake.

**Body:**
```json
{
  "address": "rYourAddress",
  "requiredAmount": 10000
}
```

### GET /vrty/staking-tiers
Get staking tier information.

**Response:**
```json
{
  "success": true,
  "data": {
    "tiers": {
      "EXPLORER": { "minStake": 0, "rewardMultiplier": 1.0 },
      "NAVIGATOR": { "minStake": 1000, "rewardMultiplier": 1.1 },
      "CAPTAIN": { "minStake": 10000, "rewardMultiplier": 1.25 },
      "ADMIRAL": { "minStake": 50000, "rewardMultiplier": 1.5 },
      "COMMODORE": { "minStake": 200000, "rewardMultiplier": 2.0 }
    }
  }
}
```

---

## Bridge Endpoints

### GET /bridge/supported-chains
Get supported chains for bridging.

### GET /bridge/estimate-fee
Estimate bridge fee for a transaction.

**Parameters:**
- `destinationChain`: Target chain (SOLANA, ETHEREUM, etc.)
- `amount`: Amount to bridge in VRTY

### POST /bridge/initiate
Initiate a bridge transaction.

**Body:**
```json
{
  "destinationChain": "SOLANA",
  "destinationAddress": "SolanaWalletAddress",
  "amount": 1000,
  "sourceWallet": "rYourXRPLAddress"
}
```

### GET /bridge/transaction/:bridgeId
Get bridge transaction status.

### GET /bridge/wvrty-balance
Get wVRTY balance on Solana.

**Parameters:**
- `chain`: "SOLANA"
- `address`: Solana wallet address

---

## Token/Staking Endpoints

### POST /token/stake
Create a new stake.

**Body:**
```json
{
  "wallet": "rYourAddress",
  "amount": "10000",
  "lockPeriod": 90
}
```

### GET /token/stakes/:wallet
Get stakes for a wallet.

### POST /token/unstake
Unstake tokens.

### GET /token/rewards/:wallet
Get pending rewards.

### POST /token/claim-rewards
Claim staking rewards.

---

## Governance Endpoints

### GET /governance/proposals
Get all proposals with pagination.

**Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `status`: Filter by status

### POST /governance/proposals
Create a new proposal.

**Body:**
```json
{
  "title": "Proposal Title",
  "description": "Detailed description",
  "category": "TREASURY",
  "requesterWallet": "rYourAddress"
}
```

### POST /governance/proposals/:proposalId/vote
Vote on a proposal.

**Body:**
```json
{
  "vote": "FOR",
  "voterWallet": "rYourAddress"
}
```

---

## Guild Endpoints

### GET /guilds
List all guilds with pagination.

### POST /guilds/treasury
Create a new guild with treasury.

**Body:**
```json
{
  "name": "Guild Name",
  "description": "Guild description",
  "treasuryWallet": "rTreasuryAddress",
  "ownerWallet": "rOwnerAddress",
  "membershipFee": "100",
  "minStakeToJoin": "1000",
  "isPublic": true
}
```

**Requirements:** 10,000 VRTY stake to create a guild.

### GET /guilds/:guildId
Get guild details.

### POST /guilds/:guildId/members
Add a member to guild.

### POST /guilds/:guildId/revenue/distribute
Distribute revenue to members based on shares.

---

## Health & Status

### GET /health
API health check.

### GET /vrty/health
VRTY service health check.

### GET /bridge/health
Bridge service health check.

---

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": {}
  },
  "meta": {
    "requestId": "unique-request-id",
    "timestamp": "2026-01-13T00:00:00.000Z"
  }
}
```

### Common Error Codes
- `VALIDATION_ERROR`: Invalid request data
- `UNAUTHORIZED`: Authentication required
- `NOT_FOUND`: Resource not found
- `INSUFFICIENT_STAKE`: Not enough VRTY staked
- `INTERNAL_ERROR`: Server error

---

## Rate Limits
- Standard: 100 requests/minute
- Authenticated: 1000 requests/minute
- Premium (COMMODORE tier): 10000 requests/minute

---

## Deployed Addresses

### XRPL Mainnet
| Component | Address |
|-----------|---------|
| VRTY Issuer | `rBeHfq9vRjZ8Cth1sMbp2nJvExmxSxAH8f` |
| Distribution Wallet | `rLmLMErLKDzWXyYmcZGHqQ3SCgTVJCVjA3` |

### XRPL Testnet (Bridge)
| Component | Address |
|-----------|---------|
| Bridge Escrow | `rMSx5CkHJqZA4QVwp9gbwNi2JqCqK4kMPQ` |

### Solana Devnet (Bridge)
| Component | Address |
|-----------|---------|
| wVRTY Mint | `7J2Mo8dqKpeSXRepNpnvDqPFMGngXioVya45AirwXGxQ` |
| Treasury | `An3Xm7QbpbcfVoHziZpMqusNjpPK4mxL1xNaUUJJpMJb` |

---

## SDK Examples

### JavaScript/TypeScript
```typescript
const response = await fetch('/api/v1/vrty/balance/rYourAddress');
const data = await response.json();
console.log(data.data.vrty.balance);
```

### cURL
```bash
# Get VRTY balance
curl -X GET "https://api.verity.finance/api/v1/vrty/balance/rYourAddress"

# Create stake
curl -X POST "https://api.verity.finance/api/v1/token/stake" \
  -H "Content-Type: application/json" \
  -H "x-wallet-address: rYourAddress" \
  -d '{"wallet":"rYourAddress","amount":"10000","lockPeriod":90}'
```

---

## Changelog

### v1.0.0 (2026-01-13)
- Initial release
- VRTY token endpoints
- Bridge endpoints (XRPL ↔ Solana)
- Staking and governance
- Guild management
