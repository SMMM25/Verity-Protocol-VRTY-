# Verity Protocol

> **The Platform Oversight Hub for XRP Ledger**
> *Verified Financial Operating System*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)
[![XRPL](https://img.shields.io/badge/XRPL-Native-brightgreen.svg)](https://xrpl.org/)

Verity Protocol (VRTY) is a hybrid financial platform built natively on the XRP Ledger (XRPL) that serves as the trusted infrastructure layer for compliant asset tokenization, social coordination, and automated treasury management.

## 🌟 Core Innovation

We've created the first system that provides:
- **Verifiable Compliance** via XAO-DOW (XLS-39D Clawback)
- **Flexible Accessibility** via optional interfaces
- **Comprehensive Developer Infrastructure** on a single, low-cost ledger

*"Verity" - Latin for Truth: Our name reflects our mission—to provide verifiable truth in every transaction.*

## 🏗️ Architecture

```
Layer 1: Protocol Layer (100% Decentralized on XRPL)
├── XLS-39D (XAO-DOW): Verifiable Clawback for Compliance
├── Native DEX: Transparent Order Books and Pathfinding
├── Issued Currencies: Verified Asset and VRTY Token
├── NFTokens: Verified Content and Asset Representation
├── Payment Channels: Verifiable Streaming Payments
└── Multi-signing: Transparent Guild Treasury Management

Layer 2: Service Layer (Centralized Where Legally Required)
├── Auto-Tax™ Engine (200+ jurisdictions)
├── KYC/AML Gateway
├── Compliance Oracle
└── Fiat On/Off Ramps

Layer 3: Application Layer (Multiple Access Modes)
├── Verity Simple (Beginner)
├── Verity Pro (Expert)
└── Verity Developer (Institution)
```

## 🚀 Quick Start

### Installation

```bash
npm install @verity-protocol/core
```

### Basic Usage

```typescript
import { VeritySDK } from '@verity-protocol/sdk';

const verity = new VeritySDK({
  network: 'testnet',
  enableVerification: true,
});

// Initialize and connect to XRPL
await verity.initialize();

// Generate a new wallet
const wallet = verity.generateWallet();

// Fund wallet (testnet only)
await verity.fundWallet(wallet);

// Check balance
const balance = await verity.getBalance(wallet.address);
console.log(`Balance: ${balance} XRP`);

// Disconnect when done
await verity.disconnect();
```

## 📦 Core Modules

### 🏠 Verity Assets - RWA Tokenization Engine

Tokenize real-world assets with institutional-grade compliance.

```typescript
// Tokenize real estate
const asset = await verity.assets.tokenizeRealEstate(
  {
    address: '123 Main Street, New York, NY 10001',
    type: 'Commercial Office Building',
    appraisedValue: '10000000',
    appraisalDate: new Date(),
  },
  {
    name: 'NYC Office Tower Token',
    symbol: 'NYCT',
    totalTokens: '10000000',
    jurisdiction: 'US',
  }
);

// Add investor to whitelist
verity.assets.addToWhitelist(asset.id, investorWallet, true, true);

// Distribute tokens
await verity.assets.distribute(asset.id, investorWallet, '10000');

// Distribute dividends
await verity.assets.distributeDividends(asset.id, '50000', 'XRP');
```

### 📡 Verity Signals - Proof-of-Engagement

Sybil-resistant engagement metrics through micro-XRP payments.

```typescript
// Mint content NFT
const { nft } = await verity.signals.mintContentNFT(
  creatorWallet,
  'QmContentHash...',
  'https://content.example.com/article',
  'article'
);

// Send a signal (endorsement)
await verity.signals.send(
  endorserWallet,
  nft.tokenId,
  '100000', // 0.1 XRP in drops
  'ENDORSEMENT',
  'Great content!'
);

// Get reputation score
const reputation = verity.signals.getReputation(creatorWallet.address);

// View transparent algorithm
const algorithm = verity.signals.getAlgorithm();
```

### 🏛️ Verity Guilds - Treasury Management

Multi-signature treasury management for DAOs and groups.

```typescript
// Create a guild with 2-of-3 multisig
const { guild } = await verity.guilds.create(
  founderWallet,
  {
    name: 'DeFi Builders Guild',
    treasuryRules: {
      requiredSigners: 2,
      totalSigners: 3,
      autoXRPConversion: true,
    },
    // ... more config
  },
  [signer1Address, signer2Address]
);

// Create payment request
const request = verity.guilds.createPaymentRequest(
  guild.id,
  founderAddress,
  vendorAddress,
  '500',
  'XRP',
  'Development payment'
);

// Sign and execute
verity.guilds.signPayment(request.id, signer1Address, true);
verity.guilds.signPayment(request.id, signer2Address, true);
await verity.guilds.executePayment(request.id, treasuryWallet);
```

### 💰 VRTY Token - Utility & Governance

Fee reduction, staking, and protocol governance.

```typescript
// Stake VRTY for tier benefits
await verity.token.stake(wallet, '10000', 90); // 90-day lock

// Calculate fee with discount
const fee = verity.token.calculateFee(
  'DEX_TRADE',
  '1000',
  wallet.address,
  true // Pay with VRTY
);
// 50% discount applied!

// Get staking info
const stake = verity.token.getStake(wallet.address);
console.log(`Tier: ${stake.stakingTier}`);
```

### 📊 Auto-Tax™ - Compliance Engine

Real-time tax calculations across 200+ jurisdictions.

```typescript
// Set tax profile
verity.tax.setProfile(userId, {
  taxResidence: 'US',
  costBasisMethod: 'FIFO',
});

// Record transaction
verity.tax.recordTransaction(userId, {
  type: 'SELL',
  asset: 'XRP',
  amount: '1000',
  pricePerUnit: '0.50',
  totalValue: '500',
  timestamp: new Date().toISOString(),
  transactionHash: 'ABC123...',
});

// Calculate tax
const taxCalc = verity.tax.calculate(userId, transaction);

// Generate report
const report = verity.tax.generateReport(userId, 2024, 'IRS_8949');
```

## 🔐 XAO-DOW Compliance (XLS-39D)

Verity implements XLS-39D Clawback for regulatory compliance with full transparency.

```typescript
// Initialize with compliance configuration
const verity = new VeritySDK({
  // ...
  governanceSigners: [signer1, signer2, signer3],
  clawbackConfig: {
    governanceQuorum: 2,
    allowedReasons: [
      'REGULATORY_REQUIREMENT',
      'COURT_ORDER',
      'FRAUD_DETECTION',
    ],
  },
});

// Initiate clawback (requires governance approval)
const clawback = await verity.compliance.initiateClawback(
  'ASSET_SYMBOL',
  targetWallet,
  '1000',
  'COURT_ORDER',
  'Court Order #12345 - Asset freeze'
);

// Add governance approvals
verity.compliance.addApproval(clawback.id, signer1, sig1, true);
verity.compliance.addApproval(clawback.id, signer2, sig2, true);

// Execute approved clawback
await verity.compliance.executeClawback(clawback.id);
```

## 🌐 REST API

Start the API server:

```bash
npm run dev
```

### Endpoints

| Module | Endpoint | Description |
|--------|----------|-------------|
| Health | `GET /api/v1/health` | Service health check |
| XRPL | `GET /api/v1/xrpl/info` | Network information |
| Assets | `POST /api/v1/assets/issue` | Issue verified asset |
| Signals | `POST /api/v1/signals/send` | Send engagement signal |
| Guilds | `POST /api/v1/guilds/treasury` | Create guild treasury |
| Token | `POST /api/v1/token/stake` | Stake VRTY tokens |
| Tax | `POST /api/v1/tax/calculate` | Calculate transaction tax |
| Governance | `POST /api/v1/governance/vote` | Vote on proposal |

## 📁 Project Structure

```
verity-protocol/
├── src/
│   ├── core/           # XRPL client & XAO-DOW
│   ├── assets/         # Asset tokenization
│   ├── signals/        # Proof-of-engagement
│   ├── guilds/         # Treasury management
│   ├── token/          # VRTY token utilities
│   ├── tax/            # Auto-Tax™ engine
│   ├── api/            # REST API routes
│   ├── sdk/            # Developer SDK
│   ├── types/          # TypeScript definitions
│   └── utils/          # Utilities & helpers
├── examples/           # Usage examples
├── tests/              # Test suites
└── docs/               # Documentation
```

## 🔧 Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Type checking
npm run typecheck

# Linting
npm run lint
```

## 🚀 Production Deployment

### Live URLs
- **Website**: https://www.verityprotocol.io
- **API**: https://www.verityprotocol.io/api/v1
- **Health**: https://www.verityprotocol.io/api/v1/health

### Maintenance Mode
The site can be locked with an "Under Construction" page.

**To UNLOCK the site (go live):**
```bash
# In src/api/middleware/maintenance.ts, change:
return true;   # Site locked
# To:
return false;  # Site unlocked

# Then commit and push:
git add -A && git commit -m "feat: Unlock site for launch" && git push origin main
```

**To LOCK the site (maintenance):**
```bash
# In src/api/middleware/maintenance.ts, change:
return false;  # Site unlocked
# To:
return true;   # Site locked

# Then commit and push:
git add -A && git commit -m "feat: Lock site for maintenance" && git push origin main
```

Railway auto-deploys from GitHub - no manual action needed.

### Railway Dashboard
- Project: https://railway.com/project/76f5a333-58a6-4825-9153-02306bcdc59c

## 📜 Configuration

Copy `.env.example` to `.env` and configure:

```env
# XRPL Network
XRPL_NETWORK=testnet

# Issuer Configuration
VERITY_ISSUER_ADDRESS=rYourIssuerAddress
VERITY_ISSUER_SECRET=sYourIssuerSecret

# API Configuration
API_PORT=3000
API_HOST=0.0.0.0

# Security
JWT_SECRET=your-jwt-secret
```

## 🗺️ Development Roadmap

See **[DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md)** for the complete development plan.

### Current Status
| Phase | Status | Description |
|-------|--------|-------------|
| Infrastructure | ✅ Complete | Database, Auth, Bridge, VRTY Integration |
| Fee Relayer | ✅ Complete | Gasless transactions for users |
| Escrow & Vesting | ✅ Complete | Native XRPL vesting schedules |
| AI Sentinel | ✅ Complete | Rules-based fraud detection |
| Cross-Chain Bridge | ✅ Complete | XRPL ↔ Solana bridging with multisig validators |
| Production Deploy | ✅ Complete | Docker, K8s, CI/CD, monitoring |

### Platform Oversight Hub - Frontend Dashboards
| Dashboard | Status | Features |
|-----------|--------|----------|
| 🧾 Tax Dashboard | ✅ Complete | IRS 8949 reports, cost basis tracking, 200+ jurisdictions |
| 📈 Trading Dashboard | ✅ Complete | VRTY/XRP DEX, order book, portfolio view |
| 🏛️ Guild/DAO Dashboard | ✅ Complete | Multi-sig treasury, member management, revenue sharing |
| ⚡ Signals Dashboard | ✅ Complete | Proof-of-engagement, reputation system, content NFTs |
| 🏠 Tokenized Assets | ✅ Complete | RWA tokenization, fractional ownership, compliance |
| 🛡️ AI Sentinel | ✅ Complete | Fraud detection, guardian system, threat monitoring |
| 🌉 Cross-Chain Bridge | ✅ Complete | VRTY ↔ wVRTY bridging, validator signatures |

### Token Distribution
| Allocation | Percentage |
|------------|------------|
| Founder | 20% |
| Treasury | 30% |
| Ecosystem | 25% |
| Community | 15% |
| Liquidity | 10% |

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

**Important**: Update [DEVELOPMENT_ROADMAP.md](DEVELOPMENT_ROADMAP.md) on every commit affecting sprint tasks.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/sprint-X-description`)
3. Commit your changes (`git commit -m 'feat(sprint-X): description'`)
4. **Update DEVELOPMENT_ROADMAP.md** with your progress
5. Push to the branch (`git push origin feature/sprint-X-description`)
6. Open a Pull Request

## 📚 Resources

- **Documentation**: [docs.verity.finance](https://docs.verity.finance)
- **API Reference**: [api.verity.finance](https://api.verity.finance)
- **Discord**: [discord.gg/verity](https://discord.gg/verity)
- **Twitter**: [@VerityProtocol](https://twitter.com/VerityProtocol)

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

**Verity Protocol** - *Where Truth Meets Technology*

Building the verified financial operating system that makes blockchain trustworthy and accessible to everyone.
