# CLAUDE.md - AI Assistant Context File

> **READ THIS FILE FIRST** at the start of every session.
> This file is the single source of truth for project context.

---

## 🚨 CRITICAL CONTEXT - READ IMMEDIATELY

### Project Identity
- **Name**: Verity Protocol (VRTY)
- **Repository**: https://github.com/SMMM25/Verity-Protocol-VRTY-
- **Token**: VRTY on XRPL Mainnet
- **Total Supply**: 1,000,000,000 VRTY (1 Billion)

### Wallet Addresses (MEMORIZE THESE)
| Wallet | Address | Purpose |
|--------|---------|---------|
| **Issuer** | `rBeHfq9vRjZ8Cth1sMbp2nJvExmxSxAH8f` | Token issuer (XUMM wallet) |
| **Treasury** | `rLmLMErLKDzWXyYmcZGHqQ3SCgTVJCVjA3` | Distribution wallet (has seed) |

### Current State (Updated: 2026-01-17)
- ✅ **VRTY Token**: Issued on XRPL Mainnet
- ✅ **Treasury Holdings**: 1,000,000,000 VRTY (100% of supply)
- ✅ **Trustline**: Established between issuer and treasury
- ⏸️ **DEX Status**: **NOT LISTED** (intentionally - build utility first)
- ✅ **Launch Scripts**: Ready in `scripts/operations/`
- ✅ **Frontend**: All 7 dashboards complete (Tax, Trading, Guild, Signals, Assets, Sentinel, Bridge)
- ✅ **Backend**: All services implemented (Escrow, Tax, Sentinel, Bridge)
- ✅ **Security Audit Fixes**: PRs #73-#81 merged (CORS, middleware order, logger, etc.)
- ✅ **UI Fixes**: PRs #62-#72 merged (Tailwind v4, logo, banner, whitepaper)
- ✅ **XRPL Meta**: TOML updated for XUMM logo display (PR #72)
- ✅ **Transparency Monitor**: Verifiable solvency proofs & embeddable badges (NEW)

---

## 📋 STRATEGIC DIRECTION

### Core Philosophy
> **"Build utility first, then distribute tokens"**

The owner explicitly stated this priority. DO NOT list on DEX until:
1. Utility/product is live and functional
2. Legal review is completed
3. Geo-blocking is in place (if needed)
4. Treasury is funded with 100+ XRP

### What Verity Protocol Does
Verity Protocol is a **hybrid XRPL-based platform** combining:
- Decentralized protocol layer (XRPL)
- Centralized compliance/services layer
- XAO-DOW integration for compliant asset tokenization
- Auto-Tax Engine (200+ jurisdictions)
- Global payroll (150+ countries)
- Cross-chain bridges (Ethereum, Solana)

---

## 💰 TOKEN ECONOMICS

### Distribution
| Allocation | Amount | Percentage | Vesting |
|------------|--------|------------|---------|
| Protocol Treasury | 650,000,000 | 65% | 50 months |
| Founder | 200,000,000 | 20% | 48 months (12-month cliff) |
| Ecosystem Fund | 150,000,000 | 15% | 36 months |

### 50-Month Escrow Release Schedule
| Phase | Months | Rate | Cumulative |
|-------|--------|------|------------|
| 1 | 1-12 | 1.5%/month | 15% |
| 2 | 13-24 | 2.0%/month | 39% |
| 3 | 25-36 | 2.0%/month | 63% |
| 4 | 37-48 | 2.5%/month | 93% |
| 5 | 49-50 | 3.5%/month | 100% |

### Planned DEX Listing Price
- **Initial Price**: 0.02 XRP/VRTY (~$0.01/VRTY at $0.50/XRP)
- **FDV (1B VRTY)**: ~$10,000,000

---

## 🗂️ KEY FILES & DIRECTORIES

### Documentation
| File | Purpose |
|------|---------|
| `CLAUDE.md` | **THIS FILE** - AI context (read first!) |
| `docs/WHITEPAPER.md` | Full whitepaper v1.0 |
| `docs/LAUNCH_GUIDE.md` | Launch procedures |
| `docs/BUG_BOUNTY_AUDIT.md` | Security audit findings |
| `docs/MASTER_TASK_LIST.md` | Project task tracking |
| `docs/FEATURE_ROADMAP.md` | Feature roadmap |

### Core Services
| Directory | Purpose |
|-----------|---------|
| `src/escrow/` | Token distribution & vesting |
| `src/dex/` | XRPL DEX integration |
| `src/compliance/` | Compliance Oracle |
| `src/tax/` | Auto-Tax Engine |
| `src/bridge/` | Cross-chain bridges |
| `src/signals/` | Signals Protocol |
| `src/guilds/` | Guild Treasury |
| `src/transparency/` | **Transparency & Solvency Monitor** (NEW) |

### Operations Scripts
| Script | Purpose | Status |
|--------|---------|--------|
| `scripts/operations/LAUNCH_READY.ts` | Full DEX listing | ⏸️ Ready, not executed |
| `scripts/operations/setup-complete.ts` | Verification script | ✅ All passing |
| `scripts/operations/cancel-offers.ts` | Cancel DEX orders | ✅ Used to delist |
| `scripts/operations/quick-list.ts` | Minimal listing test | ✅ Available |

---

## 🔧 XRPL TECHNICAL DETAILS

### VRTY Currency Code
- **Standard**: `VRTY`
- **Hex (40 char)**: `5652545900000000000000000000000000000000`

### XRPL Endpoints
| Network | URL |
|---------|-----|
| Mainnet | `wss://xrplcluster.com` |
| Testnet | `wss://s.altnet.rippletest.net:51233` |
| Devnet | `wss://s.devnet.rippletest.net:51233` |

### Explorer Links
- **Issuer**: https://livenet.xrpl.org/accounts/rBeHfq9vRjZ8Cth1sMbp2nJvExmxSxAH8f
- **Treasury**: https://livenet.xrpl.org/accounts/rLmLMErLKDzWXyYmcZGHqQ3SCgTVJCVjA3

---

## 📜 COMPLETED WORK LOG

### Sprint 3 (Completed 2026-01-14)
- ✅ Whitepaper v1.0 (`docs/WHITEPAPER.md`)
- ✅ VRTY Escrow System (`src/escrow/TokenDistributionService.ts`)
- ✅ XRPL DEX Integration (`src/dex/DexService.ts`, `MarketMaker.ts`)
- ✅ Security Audit (`docs/BUG_BOUNTY_AUDIT.md`)
- ✅ Centralized XRPL config (`src/config/xrpl.ts`)
- ✅ Launch scripts (`scripts/operations/`)

### Phase 5 (Completed 2026-01-14)
- ✅ Tokenized Assets Dashboard (`frontend/src/pages/AssetsDashboard.tsx`)
- ✅ Real Estate UI with property details
- ✅ Fractional ownership ($10 minimum)
- ✅ Investor Whitelist Management
- ✅ Dividend Distribution Tracker
- ✅ XAO-DOW Compliance Display with XLS-39D Clawback
- ✅ XRPL DEX Secondary Market Integration
- ✅ Demo Assets: MTWR, TVGF, GEB30, VCT, SBR

### PRs Merged
| PR | Title | Status |
|----|-------|--------|
| #30 | wVRTY Solana Mainnet | ✅ Merged |
| #31 | Sprint 3: Escrow, DEX, Whitepaper | ✅ Merged |
| #32 | Security Audit Fixes | ✅ Merged |
| #33 | VRTY Launch Script & DEX Listing | ✅ Merged |
| #35 | Phase 5: Tokenized Assets Dashboard | 🟡 Open |
| #62-#72 | UI Fixes (Tailwind, Logo, Banner, Whitepaper) | ✅ Merged |
| #73-#81 | Backend Audit Fixes (Security/Ops) | ✅ Merged |
| #82 | Transparency & Solvency Monitor | 🟡 Pending |

### DEX History
- **2026-01-14**: Listed 1M VRTY @ 0.02 XRP (TX: `4F1FC1B2...`)
- **2026-01-14**: **CANCELLED** - Owner requested "build utility first"
- **Current**: NOT LISTED (awaiting utility completion)

---

## 🎯 CURRENT PRIORITIES (In Order)

1. **BUILD UTILITY FIRST** - Core product functionality ✅ (Dashboards complete)
2. Complete legal review
3. Fund treasury with 100+ XRP
4. Set up geo-blocking if needed
5. Create fresh Issuer wallet with secure seed storage
6. Execute DEX listing via `LAUNCH_READY.ts`
7. Apply for XRPL Grants
8. Deploy wVRTY to Solana Mainnet (Bridge Phase 7)

---

## 🚫 DO NOT DO

- ❌ DO NOT list VRTY on DEX until utility is built
- ❌ DO NOT share wallet secrets in code or commits
- ❌ DO NOT make breaking changes without updating this file
- ❌ DO NOT forget to read this file at session start

---

## 📞 SESSION START CHECKLIST

When starting a new session, ALWAYS:

1. ✅ Read this `CLAUDE.md` file completely
2. ✅ Check `docs/MASTER_TASK_LIST.md` for current tasks
3. ✅ Run `npx ts-node scripts/operations/setup-complete.ts` to verify state
4. ✅ Check recent git commits: `git log --oneline -10`
5. ✅ Ask user for any updates since last session

---

## 🔄 HOW TO UPDATE THIS FILE

When completing significant work:

1. Update the "Current State" section
2. Add to "Completed Work Log"
3. Update "Current Priorities" if changed
4. Commit with message: `docs: Update CLAUDE.md context`

---

*Last Updated: 2026-01-17*
*Updated By: Claude (AI Assistant)*
