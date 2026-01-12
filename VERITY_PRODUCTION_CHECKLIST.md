# Verity Protocol - Production Deployment Checklist

**Version:** 1.0  
**Date:** 2026-01-12  
**Status:** PRE-PRODUCTION (Critical blockers exist)

---

## Quick Status

| Category | Ready? | Blockers |
|----------|--------|----------|
| Security | NO | Credentials leaked, no auth |
| Database | NO | Not provisioned |
| Authentication | NO | Mock implementation |
| API | NO | Stub endpoints |
| Build/Deploy | YES | Configuration ready |
| XRPL | YES | Integration working |

---

## Phase 1: CRITICAL SECURITY REMEDIATION

### 1.1 Credential Rotation (IMMEDIATE)

- [ ] **Rotate testnet issuer seed** - Current seed `sEdTxCuh1BiCbfJuuY1SLv9f8HBvymi` is compromised
- [ ] **Rotate testnet distribution seed** - Current seed `sEdSFpKqnyKSByxePuZ9bvhQYEpK9Tm` is compromised
- [ ] **Generate new mainnet wallets** - Do NOT reuse any seeds from the repository
- [ ] **Document new addresses** - Store securely (password manager, not Git)

### 1.2 Git History Cleanup (IMMEDIATE)

Run these commands to remove credentials from Git history:

```bash
# Clone fresh copy for cleanup
git clone https://github.com/SMMM25/Verity-Protocol-VRTY- verity-cleanup
cd verity-cleanup

# Remove sensitive files from ALL history
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .vrty-credentials.json .env.production" \
  --prune-empty --tag-name-filter cat -- --all

# Remove backup refs
rm -rf .git/refs/original/
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push to remote (DESTRUCTIVE - coordinate with team)
git push origin --force --all
git push origin --force --tags
```

- [ ] Command executed successfully
- [ ] All collaborators notified to re-clone
- [ ] Old forks identified and secured

### 1.3 Environment Variable Setup

Set these in Railway dashboard (NOT in code):

```env
# XRPL Configuration
XRPL_NETWORK=mainnet
VERITY_ISSUER_ADDRESS=<new-mainnet-issuer>
VERITY_ISSUER_SEED=<secret-never-commit>
VRTY_DISTRIBUTION_ADDRESS=<new-mainnet-distribution>
VRTY_DISTRIBUTION_SEED=<secret-never-commit>
VRTY_CURRENCY_HEX=5652545900000000000000000000000000000000

# Security
JWT_SECRET=<generate-256-bit-random>
API_KEY_SALT=<generate-256-bit-random>
ENCRYPTION_KEY=<generate-32-byte-key>

# Database
DATABASE_URL=postgresql://...

# API
NODE_ENV=production
PORT=3000
CORS_ORIGIN=https://verity.finance
```

- [ ] All variables set in Railway
- [ ] No secrets in any committed files
- [ ] `.gitignore` includes all sensitive patterns

---

## Phase 2: DATABASE SETUP

### 2.1 Provision PostgreSQL

Railway:
1. Go to project dashboard
2. Click "New" -> "Database" -> "PostgreSQL"
3. Copy connection string to `DATABASE_URL`

- [ ] PostgreSQL provisioned
- [ ] Connection string saved to env vars
- [ ] Connection tested locally

### 2.2 Create Schema

Install Prisma or TypeORM and create migrations:

```bash
# With Prisma
npm install prisma @prisma/client
npx prisma init
# Edit prisma/schema.prisma
npx prisma migrate dev --name init
npx prisma migrate deploy  # Production
```

Required tables:
- [ ] `users` - Wallet addresses, API keys, tiers
- [ ] `stakes` - VRTY staking records
- [ ] `proposals` - Governance proposals
- [ ] `votes` - Proposal votes
- [ ] `tax_profiles` - User tax settings
- [ ] `tax_transactions` - Transaction records
- [ ] `guilds` - Guild configurations
- [ ] `guild_members` - Membership records
- [ ] `content_nfts` - Signal content NFTs
- [ ] `signals` - Signal transactions

### 2.3 Database Configuration

- [ ] Connection pooling configured (max 10-20 connections)
- [ ] SSL mode enabled (`?sslmode=require`)
- [ ] Backup schedule configured
- [ ] Migration script in `package.json`

---

## Phase 3: AUTHENTICATION IMPLEMENTATION

### 3.1 XUMM Integration

Install XUMM SDK:
```bash
npm install xumm-sdk
```

- [ ] XUMM API credentials obtained
- [ ] Sign-in flow implemented
- [ ] Wallet signature verification working

### 3.2 JWT Implementation

- [ ] JWT token generation on login
- [ ] Token validation middleware
- [ ] Refresh token flow
- [ ] Token expiration (15min access, 7d refresh)

### 3.3 API Key Management

- [ ] API key generation endpoint
- [ ] Key storage (hashed in database)
- [ ] Key lookup on request
- [ ] Tier calculation from stake

### 3.4 Rate Limiting Updates

Update `src/api/middleware/rateLimit.ts`:

```typescript
// Replace mock with real implementation
async function getUserTier(apiKey: string | undefined): Promise<keyof typeof RATE_LIMITS> {
  if (!apiKey) return 'PUBLIC';
  
  // Lookup user from database
  const user = await db.users.findByApiKey(apiKey);
  if (!user) return 'PUBLIC';
  
  // Get stake from database or XRPL
  const stake = await db.stakes.findByUser(user.id);
  const stakedAmount = stake?.amount || 0;
  
  // Calculate tier
  if (stakedAmount >= 50000) return 'INSTITUTIONAL';
  if (stakedAmount >= 10000) return 'PROFESSIONAL';
  if (stakedAmount >= 5000) return 'DEVELOPER';
  if (stakedAmount >= 1000) return 'BASIC';
  return 'PUBLIC';
}
```

- [ ] Mock `getUserTier` replaced with database lookup
- [ ] Stake-based tier calculation working
- [ ] Rate limits enforced correctly

---

## Phase 4: API ROUTE COMPLETION

### 4.1 Token Routes (`src/api/routes/token.ts`)

Replace stubs with real implementations:

| Endpoint | Current | Target |
|----------|---------|--------|
| POST `/token/stake` | "requires wallet" | Call VRTYTokenManager.stakeVRTY() |
| POST `/token/unstake` | "requires wallet" | Call VRTYTokenManager.unstakeVRTY() |
| GET `/token/stake/:wallet` | "requires db" | Query stakes table |
| POST `/token/rewards/claim` | "requires wallet" | Call VRTYTokenManager.claimRewards() |
| GET `/token/revenue/history` | Empty array | Query revenue distributions |
| GET `/token/buyback/history` | Empty array | Query buyback history |

- [ ] All token routes connected to VRTYTokenManager
- [ ] Database persistence added
- [ ] Wallet authentication required

### 4.2 Governance Routes (`src/api/routes/governance.ts`)

| Endpoint | Current | Target |
|----------|---------|--------|
| GET `/governance/proposals` | Empty | Query proposals table |
| POST `/governance/proposals` | "requires stake" | Check stake, create proposal |
| POST `/governance/vote` | "requires wallet" | Record vote with stake weight |
| GET `/governance/stats` | Zeros | Calculate from proposals/votes |

- [ ] Proposal creation with stake check
- [ ] Vote recording with weight calculation
- [ ] Stats aggregation from database

### 4.3 Compliance Routes (`src/api/routes/compliance.ts`)

```typescript
// In server.ts or routes initialization
import { ComplianceOracle } from './compliance/ComplianceOracle.js';
import { complianceRoutes, setComplianceOracle } from './api/routes/compliance.js';

// Initialize oracle at startup
const complianceOracle = new ComplianceOracle(xrplClient, issuerWallet, config);
setComplianceOracle(complianceOracle);
```

- [ ] ComplianceOracle initialized at server startup
- [ ] XRPLClient instance passed to oracle
- [ ] Execute endpoint implemented (currently 501)

---

## Phase 5: TESTING

### 5.1 Fix Unit Tests

Update tests to import real modules:

```typescript
// Instead of:
const mockVRTYTokenManager = { ... };

// Use:
import { VRTYTokenManager } from '../../src/token/VRTYToken.js';

// Mock only external dependencies
vi.mock('xrpl', () => ({ ... }));

// Create instance with mocked XRPLClient
const tokenManager = new VRTYTokenManager(mockXrplClient, mockIssuerWallet);
```

- [ ] Tests import real modules
- [ ] Only XRPL client mocked
- [ ] Database mocked with test containers or SQLite

### 5.2 Integration Tests

```typescript
import { beforeAll, afterAll } from 'vitest';
import app from '../../src/server.js';

let server: any;

beforeAll(async () => {
  server = app.listen(3001);
});

afterAll(async () => {
  server.close();
});
```

- [ ] Server lifecycle managed in tests
- [ ] Test database configured
- [ ] CI/CD runs tests automatically

### 5.3 Coverage Requirements

- [ ] Minimum 70% line coverage
- [ ] All critical paths tested
- [ ] Error handling tested

---

## Phase 6: DEPLOYMENT

### 6.1 Railway Configuration

Verify `railway.json`:
```json
{
  "build": { "builder": "NIXPACKS" },
  "deploy": {
    "startCommand": "node dist/server.js",
    "healthcheckPath": "/api/v1/health",
    "healthcheckTimeout": 30
  }
}
```

- [ ] Configuration file correct
- [ ] Health check endpoint responding
- [ ] Environment variables set

### 6.2 Pre-Deploy Checks

```bash
# Build locally
npm run build

# Type check
npm run typecheck

# Lint
npm run lint

# Run tests
npm test

# Verify build output
ls -la dist/
# Should contain: index.js, sdk/index.js, server.js
```

- [ ] Build succeeds locally
- [ ] No TypeScript errors
- [ ] All tests passing
- [ ] Lint checks passing

### 6.3 Deploy

```bash
# Using Railway CLI
railway up

# Or via GitHub integration
git push origin main  # Triggers auto-deploy
```

- [ ] Deployment initiated
- [ ] Build logs show success
- [ ] Health check passes
- [ ] API endpoints responding

### 6.4 Post-Deploy Verification

```bash
# Check health
curl https://your-app.railway.app/api/v1/health

# Check docs
curl https://your-app.railway.app/api/v1/docs

# Check token info
curl -H "X-API-Key: your-key" https://your-app.railway.app/api/v1/token/info
```

- [ ] Health endpoint returns 200
- [ ] Docs endpoint returns API documentation
- [ ] All endpoints returning expected responses
- [ ] No errors in logs

---

## Phase 7: MONITORING

### 7.1 Logging

- [ ] JSON logging format enabled
- [ ] Log level set to `info` for production
- [ ] Error logs include stack traces
- [ ] Request IDs in all logs

### 7.2 Alerting

Set up alerts for:
- [ ] Server errors (5xx responses)
- [ ] Database connection failures
- [ ] XRPL connection failures
- [ ] High response times (>2s)
- [ ] Rate limit violations

### 7.3 Metrics

Track:
- [ ] Request count per endpoint
- [ ] Response time percentiles
- [ ] Error rates
- [ ] Active connections
- [ ] Database query times

---

## Final Checklist Before Go-Live

### Security
- [ ] All compromised credentials rotated
- [ ] Git history cleaned
- [ ] No secrets in code
- [ ] HTTPS enforced
- [ ] CORS configured correctly
- [ ] Rate limiting active
- [ ] Input validation working

### Database
- [ ] PostgreSQL provisioned
- [ ] Migrations applied
- [ ] Backups configured
- [ ] Connection pooling active

### Authentication
- [ ] XUMM integration working
- [ ] JWT tokens validating
- [ ] API keys working
- [ ] Tier-based access enforced

### API
- [ ] All endpoints functional
- [ ] No stub responses
- [ ] Error handling complete
- [ ] Documentation accurate

### XRPL
- [ ] Network set to mainnet
- [ ] Addresses verified
- [ ] Wallets funded
- [ ] Transactions tested

### Monitoring
- [ ] Logging configured
- [ ] Alerts set up
- [ ] Metrics collecting

---

## Emergency Contacts

| Role | Contact |
|------|---------|
| Lead Developer | TBD |
| DevOps | TBD |
| Security | TBD |

## Rollback Plan

If issues occur after deployment:

1. **Immediate**: Scale to 0 replicas in Railway
2. **Quick**: Redeploy previous working version
3. **Database**: Restore from backup if data corruption

```bash
# Railway rollback
railway rollback

# Or via dashboard: Deployments -> Previous -> Redeploy
```

---

*Checklist created: 2026-01-12*  
*Last updated: 2026-01-12*
