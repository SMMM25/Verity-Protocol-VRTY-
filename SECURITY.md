# Verity Protocol - Security Guidelines

## Credential Management

### Production Secrets

All production credentials **MUST** be stored as environment variables in your hosting provider (Railway, Vercel, etc.). Never commit secrets to Git.

#### Required Environment Variables

| Variable | Description | Where to Set |
|----------|-------------|--------------|
| `VERITY_ISSUER_SECRET` | XRPL issuer wallet seed | Railway env vars |
| `VRTY_DISTRIBUTION_SECRET` | Distribution wallet seed | Railway env vars |
| `VERITY_HOT_WALLET_SECRET` | Hot wallet seed | Railway env vars |
| `JWT_SECRET` | JWT signing secret | Railway env vars |
| `API_KEY_SALT` | API key hashing salt | Railway env vars |
| `ENCRYPTION_KEY` | 32-byte encryption key | Railway env vars |
| `XUMM_API_SECRET` | XUMM app secret | Railway env vars |
| `DATABASE_URL` | PostgreSQL connection string | Railway (auto-provisioned) |

### Testnet Credentials

For testnet/development:
1. Generate new testnet wallets using XRPL faucet
2. Store credentials in local `.env` file (gitignored)
3. Never reuse testnet credentials in production

### Rotating Compromised Credentials

If credentials are exposed:

1. **Immediately** rotate all affected secrets
2. For XRPL wallets:
   - Create new wallets
   - Transfer assets to new addresses
   - Update issuer address in token metadata if needed
3. For API keys:
   - Generate new secrets
   - Revoke old API keys
4. Check audit logs for unauthorized access

## Cleaning Git History

If sensitive files were committed to Git history, you must clean the entire history:

```bash
# Remove file from all history
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch <filename>" \
  --prune-empty --tag-name-filter cat -- --all

# Clean up refs
rm -rf .git/refs/original/
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push to remote (WARNING: requires all collaborators to re-clone)
git push origin --force --all
```

## Git Security

### Pre-commit Checks

Before committing:
```bash
# Check for secrets in staged files
git diff --cached --name-only | xargs grep -l "sEd\|secret\|password\|apikey" 2>/dev/null
```

### Files That Should NEVER Be Committed

- `.env` (local environment)
- `.env.production`
- `.env.staging`
- `*-credentials.json`
- `*.pem`, `*.key`
- `wallet*.json`

## Authentication

### XUMM Integration (Recommended)

For production, use XUMM for wallet authentication:
1. User signs payload with their wallet
2. Server verifies signature
3. No seed phrases stored server-side

### API Key Security

- Generate API keys with sufficient entropy (32+ bytes)
- Hash API keys before storage (bcrypt)
- Implement key rotation policies
- Rate limit by API key tier

## Reporting Security Issues

Please report security vulnerabilities privately to: security@verity.finance

Do NOT open public issues for security vulnerabilities.
