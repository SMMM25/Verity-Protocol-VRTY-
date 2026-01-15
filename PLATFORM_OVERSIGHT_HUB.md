# PLATFORM OVERSIGHT HUB - MANDATORY READING

> **⚠️ CRITICAL: ALL DEVELOPERS AND AI DEVELOPMENT PLATFORMS MUST READ THIS ENTIRE DOCUMENT BEFORE ANY WORK**

**Last Updated**: 2026-01-15  
**Version**: 1.3.0  
**Status**: ACTIVE - ENFORCED  
**Repository**: https://github.com/SMMM25/Verity-Protocol-VRTY-

---

## 🚨 MANDATORY COMPLIANCE NOTICE

This document establishes **binding rules** for all human developers, AI development platforms (Claude, GPT, Copilot, Cursor, etc.), and automated systems working on the Verity Protocol codebase.

**Non-compliance will result in:**
- Immediate rejection of pull requests
- Rollback of unauthorized changes
- Removal of contributor access

---

## 📋 TABLE OF CONTENTS

1. [Pre-Work Requirements](#pre-work-requirements)
2. [Absolute Prohibitions](#absolute-prohibitions)
3. [Code Quality Standards](#code-quality-standards)
4. [Security Requirements](#security-requirements)
5. [Development Workflow](#development-workflow)
6. [Pull Request Review Rule](#pull-request-review-rule)
7. [Dashboard Status Tracker](#dashboard-status-tracker)
8. [Work Log Requirements](#work-log-requirements)
9. [AI Platform Specific Rules](#ai-platform-specific-rules)
10. [Deployment & Infrastructure Requirements](#deployment--infrastructure-requirements)
11. [Deployment Verification Rule](#deployment-verification-rule)
12. [Next Steps Rule](#next-steps-rule)

---

## 📖 PRE-WORK REQUIREMENTS

### Before Writing ANY Code:

1. **READ THIS ENTIRE DOCUMENT** - No exceptions
2. **READ `README.md`** - Understand project overview
3. **READ `DEVELOPMENT_ROADMAP.md`** - Know current sprint status
4. **READ `docs/FEATURE_ROADMAP.md`** - Understand feature completion status
5. **READ `docs/WHITEPAPER.md`** - Understand protocol design
6. **CHECK `WORK_LOG.md`** - See what others have done recently

### Acknowledgment Required

Before starting work, you must mentally (or explicitly) acknowledge:
- [ ] I have read the Platform Oversight Hub in its entirety
- [ ] I understand all prohibitions and requirements
- [ ] I will update the Work Log after completing my work
- [ ] I will NOT commit mock, simulation, or placeholder code

---

## 🚫 ABSOLUTE PROHIBITIONS

### 1. NO MOCK/SIMULATION CODE

**THIS IS NON-NEGOTIABLE.**

```
❌ FORBIDDEN:
- Mock API responses
- Simulated data generators
- Placeholder implementations
- "Demo mode" flags that bypass real logic
- Hardcoded test data in production code
- setTimeout() simulating API calls
- Math.random() for fake data
- "TODO: implement later" stubs
- isDemo, isMock, isSimulation flags
```

```
✅ REQUIRED:
- Real API integrations
- Actual XRPL transactions
- Production-ready implementations
- Proper error handling for real scenarios
- Live data connections
- Actual database queries
```

**Exceptions**:
1. **Unit tests** may use mocks for isolated testing only. These must be in `/tests/` directories and clearly marked.
2. **Frontend UI showcase** may use `isDemo` flags ONLY when:
   - The data structures are production-ready TypeScript types
   - The demo data matches exactly what the API will return
   - The API client endpoints are fully implemented
   - The flag is used only to toggle between demo data and live API calls
   - This is a TEMPORARY state - all demo flags must be removed before production launch

**Demo Mode Transition Plan**:
- Phase 1 (Current): UI complete with demo data, APIs ready for integration
- Phase 2: Connect real APIs, demo mode becomes fallback
- Phase 3: Remove all demo flags, production only

### 2. NO SENSITIVE DATA IN REPOSITORY

**NEVER commit:**
- Passwords
- API keys
- Private keys
- Seed phrases
- Secret tokens
- Personal information
- Internal URLs
- Database credentials
- JWT secrets
- Any `.env` file contents

**Use instead:**
- Environment variables
- `.env.example` with placeholder values
- Secrets management services
- GitHub Secrets for CI/CD

### 3. NO INCOMPLETE FEATURES IN MAIN

- All code in `main` branch must be functional
- No broken imports
- No TypeScript errors
- No console.log debugging statements
- No commented-out code blocks

---

## ✅ CODE QUALITY STANDARDS

### TypeScript Requirements

```typescript
// ✅ CORRECT: Explicit types, no any
interface UserProfile {
  id: string;
  wallet: string;
  kycLevel: number;
}

function getUser(id: string): Promise<UserProfile> {
  return api.get(`/users/${id}`);
}

// ❌ FORBIDDEN: any types, implicit any
function getUser(id): any {
  return api.get(`/users/${id}`);
}
```

### Error Handling

```typescript
// ✅ CORRECT: Proper error handling
try {
  const result = await xrplClient.submitTransaction(tx);
  if (result.result.meta.TransactionResult !== 'tesSUCCESS') {
    throw new TransactionError(result.result.meta.TransactionResult);
  }
  return result;
} catch (error) {
  logger.error('Transaction failed', { error, txHash: tx.hash });
  throw error;
}

// ❌ FORBIDDEN: Silent failures
try {
  const result = await xrplClient.submitTransaction(tx);
  return result;
} catch (error) {
  console.log(error); // Never do this
  return null; // Never return null on error
}
```

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files (components) | PascalCase | `TaxDashboard.tsx` |
| Files (utilities) | camelCase | `formatCurrency.ts` |
| Interfaces | PascalCase | `TokenizedAsset` |
| Types | PascalCase | `AssetStatus` |
| Functions | camelCase | `calculateTax()` |
| Constants | SCREAMING_SNAKE | `MAX_SUPPLY` |
| CSS classes | kebab-case | `asset-card` |

---

## 🔐 SECURITY REQUIREMENTS

### Pre-Commit Checklist

Before every commit, verify:

- [ ] No hardcoded credentials
- [ ] No private keys or seeds
- [ ] No internal API endpoints
- [ ] No personal data
- [ ] Environment variables used for all secrets
- [ ] `.gitignore` includes all sensitive files

### Required .gitignore Entries

```
# Secrets
.env
.env.local
.env.production
*.pem
*.key
secrets/
credentials/

# IDE
.idea/
.vscode/settings.json

# Build
dist/
node_modules/
```

### Environment Variable Pattern

```bash
# .env.example (commit this)
XRPL_NETWORK=mainnet
XRPL_ISSUER_ADDRESS=your_issuer_address_here
API_JWT_SECRET=your_jwt_secret_here
DATABASE_URL=your_database_url_here

# .env (NEVER commit this)
XRPL_NETWORK=mainnet
XRPL_ISSUER_ADDRESS=rBeHfq9vRjZ8Cth1sMbp2nJvExmxSxAH8f
API_JWT_SECRET=actual_secret_value
DATABASE_URL=postgresql://user:pass@host:5432/db
```

---

## 🔄 DEVELOPMENT WORKFLOW

### Branch Strategy

```
main (protected)
  └── genspark_ai_developer (AI development)
  └── feature/* (human features)
  └── fix/* (bug fixes)
  └── hotfix/* (emergency fixes)
```

### Commit Message Format

```
type(scope): description

Types:
- feat: New feature
- fix: Bug fix
- docs: Documentation
- refactor: Code refactoring
- test: Adding tests
- chore: Maintenance

Examples:
feat(assets): Add dividend distribution to tokenized assets
fix(tax): Correct FIFO calculation for multi-wallet users
docs(hub): Update Platform Oversight Hub with new rules
```

### Pull Request Requirements

1. **Title**: Clear description of changes
2. **Description**: 
   - What was changed
   - Why it was changed
   - How to test
3. **Checklist**:
   - [ ] No mock/simulation code
   - [ ] No sensitive data
   - [ ] All tests pass
   - [ ] TypeScript compiles without errors
   - [ ] Work Log updated

---

## 🔐 PULL REQUEST REVIEW RULE

> **⚠️ CRITICAL: ALL COMMITS MUST GO THROUGH PULL REQUEST REVIEW**

### Mandatory PR Workflow

**Effective Date**: 2026-01-14  
**Status**: MANDATORY - NO EXCEPTIONS

### Rule Statement

From this point forward, **ALL developers (human and AI) are PROHIBITED from pushing commits directly to the `main` branch**. Every code change MUST:

1. Be committed to a feature/development branch
2. Have a Pull Request created for review
3. Have the PR link provided to the repository owner for review
4. Wait for the owner to merge/push the changes to `main`

### Workflow Process

```
┌─────────────────────────────────────────────────────────────────┐
│                    MANDATORY PR WORKFLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Developer makes changes                                     │
│           ↓                                                     │
│  2. Commit to feature branch (genspark_ai_developer, etc.)     │
│           ↓                                                     │
│  3. Push branch to remote                                       │
│           ↓                                                     │
│  4. Create Pull Request (PR) → main                             │
│           ↓                                                     │
│  5. ⚠️ PROVIDE PR LINK TO OWNER ⚠️                              │
│           ↓                                                     │
│  6. Owner reviews and approves                                  │
│           ↓                                                     │
│  7. Owner merges/pushes to main                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### PR Link Delivery Requirements

When providing the PR link, you MUST include:

```markdown
## 🔗 PULL REQUEST FOR REVIEW

**PR Link**: [GitHub PR URL]
**Branch**: [source branch] → main
**Title**: [PR title]

### Changes Summary:
- [List of changes]

### Files Modified/Created:
- [List of files]

### Ready for Review:
- [ ] Code compiles without errors
- [ ] No mock/simulation code
- [ ] No sensitive data
- [ ] Work Log updated
- [ ] Next Steps provided

**Please review and merge when ready.**
```

### Prohibited Actions

```
❌ FORBIDDEN:
- git push origin main (direct push to main)
- git push -f origin main (force push to main)
- Merging PRs without owner approval
- Bypassing branch protection
- Auto-merging without review
```

```
✅ REQUIRED:
- git push origin genspark_ai_developer (push to dev branch)
- git push origin feature/your-feature (push to feature branch)
- Creating PR and providing link to owner
- Waiting for owner to merge
```

### Enforcement

| Offense | Consequence |
|---------|-------------|
| First | Commit reverted, warning issued |
| Second | Branch protection enabled, access restricted |
| Third | Contributor access revoked |

### Emergency Hotfix Exception

In case of critical security vulnerabilities:
1. Create hotfix branch
2. Make minimal required changes
3. Create PR with `[URGENT]` prefix
4. Contact owner immediately via all available channels
5. Document the urgency in PR description

**Note**: Even urgent fixes require PR review. The owner will prioritize urgent PRs.

---

## 📊 DASHBOARD STATUS TRACKER

### Platform Oversight Hub - Dashboard Completion

| Phase | Dashboard | Route | Status | Completion | Last Updated |
|-------|-----------|-------|--------|------------|--------------|
| 1 | Tax Dashboard | `/app/tax` | ✅ COMPLETE | 100% | 2026-01-13 |
| 2 | Trading Dashboard | `/app/trading` | ✅ COMPLETE | 100% | 2026-01-13 |
| 3 | Guild/DAO Dashboard | `/app/guilds` | ✅ COMPLETE | 100% | 2026-01-13 |
| 4 | Signals Dashboard | `/app/signals` | ✅ COMPLETE | 100% | 2026-01-14 |
| 5 | Tokenized Assets | `/app/assets` | ✅ COMPLETE | 100% | 2026-01-14 |
| 6 | AI Sentinel | `/app/sentinel` | ✅ COMPLETE | 100% | 2026-01-14 |
| 7 | Cross-Chain Bridge | `/app/bridge` | ✅ COMPLETE | 100% | 2026-01-14 |

### Feature Implementation Status

| Feature | Backend | Frontend | Integration | Status |
|---------|---------|----------|-------------|--------|
| Auto-Tax Engine | 95% | 100% | 100% | ✅ Complete |
| XRPL DEX Integration | 95% | 100% | 100% | ✅ Complete |
| Guild Treasury | 90% | 100% | 100% | ✅ Complete |
| Signals Protocol | 95% | 100% | 100% | ✅ Complete |
| Asset Tokenization | 85% | 100% | 100% | ✅ Complete |
| AI Sentinel | 90% | 100% | 100% | ✅ Complete |
| Cross-Chain Bridge | 100% | 100% | 100% | ✅ Complete |
| Production Deploy | 100% | 100% | 100% | ✅ Complete |
| API Integration Testing | 100% | 100% | 100% | ✅ Complete |

> **Note**: All frontend dashboards now have live API integration via `useApiWithFallback` hook with demo fallback.

---

## 📝 WORK LOG REQUIREMENTS

### After Completing ANY Work:

You **MUST** update `WORK_LOG.md` with:

```markdown
## [DATE] - [Your Name/AI Platform]

### Work Completed
- Brief description of changes

### Files Modified
- List of files changed

### Files Created
- List of new files

### Commit Hash
- The commit SHA

### Notes
- Any important context
```

### Example Entry

```markdown
## 2026-01-14 - Claude (Genspark AI)

### Work Completed
- Built Phase 5 Tokenized Assets Dashboard
- Added comprehensive asset types
- Created Asset Issuance Wizard with 6-step flow
- Integrated 30+ API endpoints for asset management

### Files Modified
- frontend/src/App.tsx
- frontend/src/api/client.ts
- frontend/src/components/Layout.tsx

### Files Created
- frontend/src/pages/AssetsDashboard.tsx
- frontend/src/components/AssetIssuanceWizard.tsx
- frontend/src/types/assets.ts
- PLATFORM_OVERSIGHT_HUB.md
- WORK_LOG.md

### Commit Hash
- d72b0b9

### Notes
- All dashboards now complete for Platform Oversight Hub
- Demo mode uses real data structures, ready for API integration
```

---

## 🤖 AI PLATFORM SPECIFIC RULES

### For Claude, GPT, Copilot, Cursor, and Other AI Systems:

1. **ALWAYS** read this document first when starting a session
2. **ALWAYS** check `WORK_LOG.md` to understand recent changes
3. **NEVER** generate mock data or simulation code
4. **ALWAYS** use proper TypeScript types (no `any`)
5. **ALWAYS** implement real functionality, not stubs
6. **ALWAYS** update `WORK_LOG.md` after completing work
7. **🔴 NEVER** push directly to `main` branch
8. **🔴 ALWAYS** create a Pull Request and provide the PR link to the owner
9. **🔴 ALWAYS** wait for owner to review and merge to `main`
10. **NEVER** commit sensitive data

### Session Start Checklist for AI:

```markdown
□ Read PLATFORM_OVERSIGHT_HUB.md
□ Check WORK_LOG.md for recent changes
□ Understand current project state
□ Confirm no mock/simulation code will be written
□ Prepare to update WORK_LOG.md after work
```

### Session End Checklist for AI:

```markdown
□ All code is production-ready (no mocks)
□ No sensitive data in commits
□ TypeScript compiles without errors
□ Work Log updated
□ Changes committed to development branch (NOT main)
□ Pull Request created
□ 🔴 PR LINK PROVIDED TO OWNER FOR REVIEW
□ Waiting for owner to merge to main
```

### PR Link Template for AI:

When completing work, AI platforms MUST provide the following:

```markdown
## 🔗 PULL REQUEST READY FOR REVIEW

**PR Link**: https://github.com/SMMM25/Verity-Protocol-VRTY-/pull/[NUMBER]
**Branch**: genspark_ai_developer → main
**Title**: [Descriptive title of changes]

### Summary of Changes:
1. [Change 1]
2. [Change 2]
3. [Change 3]

### Files Changed:
- [file1.tsx]
- [file2.ts]

### Build Status:
- ✅ TypeScript compiled successfully
- ✅ No errors or warnings
- ✅ Work Log updated

**👉 Please review and merge when ready.**
```

---

## 🚀 DEPLOYMENT & INFRASTRUCTURE REQUIREMENTS

> **CRITICAL: All deployment configurations must be production-ready**

### Docker & Container Requirements

When working with Docker containers (Railway, Render, Fly.io, etc.), you **MUST** ensure:

#### 1. Prisma Binary Targets (MANDATORY)

For any project using Prisma ORM, the schema.prisma file **MUST** include binary targets for the deployment environment:

```prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x", "linux-musl-arm64-openssl-3.0.x"]
}
```

**Why**: Most cloud platforms use Alpine Linux (musl libc). Without these binary targets, Prisma will fail to connect to the database at runtime with `PrismaClientInitializationError`.

| Platform | Required Binary Target |
|----------|----------------------|
| Railway | `linux-musl-openssl-3.0.x` |
| Render | `linux-musl-openssl-3.0.x` |
| Fly.io | `linux-musl-openssl-3.0.x` |
| Vercel | `rhel-openssl-1.0.x` |
| AWS Lambda | `rhel-openssl-1.0.x` |

#### 2. Database URL Configuration

When configuring PostgreSQL connections:

```
✅ CORRECT (Public URL with SSL):
DATABASE_URL=postgresql://user:pass@host.proxy.rlwy.net:5432/db?sslmode=require

❌ INCORRECT (Internal URL may not resolve):
DATABASE_URL=postgresql://user:pass@postgres.railway.internal:5432/db
```

**Best Practices**:
- Always use the **public proxy URL** for database connections
- Include `?sslmode=require` for secure connections
- Test database connectivity before deploying

#### 3. Docker Alpine Linux Considerations

When using Alpine-based images (`node:20-alpine`), ensure:

```dockerfile
# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

# Include Prisma CLI for migrations
RUN npx prisma generate
```

#### 4. Environment Variable Checklist

Before deployment, verify:

- [ ] `DATABASE_URL` uses public proxy URL (not internal)
- [ ] `DATABASE_URL` includes `?sslmode=require`
- [ ] Prisma schema has correct `binaryTargets`
- [ ] OpenSSL is installed in container
- [ ] Database migrations have been run

### Deployment Pre-Flight Checklist

```markdown
□ Prisma binaryTargets include "linux-musl-openssl-3.0.x"
□ DATABASE_URL uses public proxy URL
□ DATABASE_URL includes ?sslmode=require
□ Database schema has been pushed (npx prisma db push)
□ Docker image includes OpenSSL
□ Environment variables are set in deployment platform
□ Health check endpoint is configured
□ Build cache cleared if making infrastructure changes
```

### Common Deployment Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `PrismaClientInitializationError` | Missing binary target | Add `linux-musl-openssl-3.0.x` to binaryTargets |
| `Failed to connect to database` | Wrong URL or SSL | Use public proxy URL with `?sslmode=require` |
| `libssl not found` | Missing OpenSSL | Add `apk add --no-cache openssl` to Dockerfile |
| `Connection timeout` | Internal URL not resolving | Switch to public proxy URL |

---

## 🔄 DEPLOYMENT VERIFICATION RULE

> **CRITICAL: ALL infrastructure changes MUST be verified in production before marking complete**

### Purpose

This rule was established after encountering deployment issues where:
- Dockerfile changes were cached and not applied
- Database connections failed due to incorrect URL configurations
- Prisma binary targets were missing for Alpine Linux
- Entrypoint scripts weren't executing due to build cache

**Effective Date**: 2026-01-15  
**Status**: MANDATORY - NO EXCEPTIONS

### Rule Statement

When making ANY infrastructure or deployment-related changes, the developer MUST:

1. **Verify the deployment actually succeeded** in the target environment
2. **Check deploy logs** (not just build logs) for expected startup messages
3. **Test critical functionality** (database connection, API health, etc.)
4. **Document the verification** in the PR or work log

### Infrastructure Changes Requiring Verification

| Change Type | What to Verify |
|------------|---------------|
| Dockerfile changes | New CMD/ENTRYPOINT executes, build cache cleared |
| Prisma schema changes | Migrations run, database connected |
| DATABASE_URL changes | Connection established, latency reasonable |
| Environment variables | Values are set and accessible at runtime |
| Docker entrypoint scripts | Script executes (check for startup banner) |
| SSL/TLS configuration | Secure connection established |

### Verification Checklist

When making deployment changes, complete this checklist BEFORE marking the task done:

```markdown
## Deployment Verification Checklist

### Build Phase
- [ ] Build logs show changes were applied (NOT "cached")
- [ ] No build errors or warnings
- [ ] Docker layers rebuilt as expected

### Deploy Phase
- [ ] Deploy logs show expected startup messages
- [ ] No runtime errors in first 60 seconds
- [ ] Application health check passes

### Database (if applicable)
- [ ] "Database connected successfully" in logs
- [ ] Connection latency under 100ms
- [ ] Migrations completed (if any)

### API (if applicable)
- [ ] Health endpoint returns 200 OK
- [ ] API version is correct
- [ ] All expected services initialized

### Environment
- [ ] Environment variables are accessible
- [ ] No "undefined" or missing values in logs
```

### Required Log Messages to Verify

For Verity Protocol deployments, these log messages indicate success:

```
✅ Expected messages (must appear):
- "Verity Protocol Startup" (entrypoint running)
- "Database connected" or "Database is available"
- "Server running at http://0.0.0.0:XXXX"
- "Health check: OK"

❌ Problem indicators (investigate immediately):
- "Database connection failed"
- "running in memory-only mode"
- "PrismaClientInitializationError"
- "ECONNREFUSED"
- Old startup banner version
```

### Cache Invalidation

If changes aren't being applied:

1. **Railway**: Settings → Build → Clear Build Cache → Redeploy
2. **Docker**: Add `ARG CACHE_BUST=YYYYMMDDNN` to force rebuild
3. **Prisma**: Run `npx prisma generate` in Dockerfile
4. **General**: Make a meaningful change to force new layer

### Reporting Deployment Issues

When deployment verification fails:

1. **Document the failure** - What logs showed, what was expected
2. **Identify root cause** - Cache, config, binary, networking
3. **Create fix PR** - With specific solution
4. **Verify the fix** - Complete checklist again
5. **Update this document** - Add new errors/solutions if discovered

### Example Verification Report

```markdown
## Deployment Verification - PR #52

### Build Verification
- ✅ Build logs show Prisma binary targets updated
- ✅ "linux-musl-openssl-3.0.x" included
- ✅ No cached layers for production stage

### Deploy Verification  
- ✅ Startup banner shows "Verity Protocol Startup v1.1.0"
- ✅ "Database connected (latency: 48ms)"
- ✅ Server running on port 8080
- ✅ Health check: 200 OK

### API Test
- ✅ curl https://verityprotocol.io/api/v1/health → {"status":"healthy"}

**Result**: Deployment verified successfully
```

### Enforcement

| Offense | Consequence |
|---------|-------------|
| Marking infrastructure task complete without verification | PR rejected, must re-verify |
| Failing to document verification | Warning, must add documentation |
| Repeated verification failures | Root cause analysis required |

---

## 📚 REFERENCE DOCUMENTS

| Document | Purpose | Location |
|----------|---------|----------|
| README.md | Project overview | `/README.md` |
| DEVELOPMENT_ROADMAP.md | Sprint tracking | `/DEVELOPMENT_ROADMAP.md` |
| FEATURE_ROADMAP.md | Feature status | `/docs/FEATURE_ROADMAP.md` |
| WHITEPAPER.md | Protocol design | `/docs/WHITEPAPER.md` |
| WORK_LOG.md | Activity log | `/WORK_LOG.md` |
| This Document | Development rules | `/PLATFORM_OVERSIGHT_HUB.md` |

---

## ⚖️ ENFORCEMENT

This document is **binding** for all contributors. Violations will be:

1. **First offense**: PR rejected with explanation
2. **Second offense**: Changes reverted, warning issued
3. **Third offense**: Contributor access revoked

### Reporting Violations

If you notice violations of these rules:
1. Do not merge the PR
2. Comment on the PR with specific violations
3. Reference this document

---

## 📞 CONTACT

- **Repository**: https://github.com/SMMM25/Verity-Protocol-VRTY-
- **Issues**: Use GitHub Issues for bug reports
- **Discussions**: Use GitHub Discussions for questions

---

**BY WORKING ON THIS CODEBASE, YOU AGREE TO FOLLOW ALL RULES IN THIS DOCUMENT.**

*Last enforced review: 2026-01-15*

---

## 📌 NEXT STEPS RULE

> **MANDATORY: Upon completing any assignment, the developer or AI MUST provide a "Next Steps" recommendation.**

### Purpose
This rule ensures continuity and helps the team/developers know exactly where the last person left off, what remains to be done, and what the recommended priority is.

### When to Apply
This rule applies after completing:
- Any dashboard or feature implementation
- Bug fixes affecting multiple components
- Major refactoring work
- API integrations
- Any phase milestone

### Required Format

```markdown
## 📌 NEXT STEPS RECOMMENDATION

**Completed**: [Brief description of what was just completed]
**Date**: [Date]
**Contributor**: [Name or AI Platform]

### Recommended Next Actions (in priority order):

1. **[Priority 1 Task]**
   - Current status: [percentage complete or status]
   - Why: [Brief explanation]
   - Files/Components: [Relevant files]

2. **[Priority 2 Task]**
   - Current status: [percentage complete or status]
   - Why: [Brief explanation]
   - Files/Components: [Relevant files]

3. **[Priority 3 Task]**
   - Current status: [percentage complete or status]
   - Why: [Brief explanation]
   - Files/Components: [Relevant files]

### Blockers or Dependencies:
- [Any blockers that need resolution]
- [Dependencies that must be completed first]

### Notes for Next Developer:
- [Important context or warnings]
- [Technical debt to be aware of]
- [Recommendations for approach]
```

### Example

```markdown
## 📌 NEXT STEPS RECOMMENDATION

**Completed**: Phase 7 - Cross-Chain Bridge Dashboard
**Date**: 2026-01-14
**Contributor**: Claude (Genspark AI)

### Recommended Next Actions (in priority order):

1. **Backend API Integration for Bridge**
   - Current status: 60% backend complete
   - Why: Frontend is complete but needs real API connection
   - Files/Components: src/api/routes/bridge.ts, src/bridge/

2. **Mobile SDK / React Native App**
   - Current status: 0%
   - Why: Mobile access is key for user adoption
   - Files/Components: To be created in /mobile/

3. **Enterprise Compliance Dashboard**
   - Current status: 0%
   - Why: Required for institutional clients
   - Files/Components: To be created

### Blockers or Dependencies:
- Bridge backend needs Solana devnet validator signatures
- Mobile SDK depends on stable API contracts

### Notes for Next Developer:
- Bridge demo data matches backend response structure exactly
- All 7 dashboards are complete - focus on backend integration now
- Consider code-splitting for production bundle optimization
```

### Location
Next Steps recommendations should be added to:
1. `WORK_LOG.md` - At the end of your work log entry
2. Pull Request description - In a dedicated section
3. When closing an issue - As a final comment

### Enforcement
Pull requests that complete significant work WITHOUT a Next Steps recommendation will be:
1. **First offense**: Requested to add Next Steps before merge
2. **Second offense**: PR held until Next Steps provided
3. **Repeated offense**: Contributor reminded of mandatory compliance
