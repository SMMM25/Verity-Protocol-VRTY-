#!/bin/bash
# ============================================================
# Verity Protocol - Production Database Seeding Script
# ============================================================
#
# Seeds production database with required initial data:
# - Default staking tiers
# - Initial governance configuration
# - System accounts
# - Default rules for AI Sentinel
#
# Usage:
#   ./scripts/db/seed-production.sh [OPTIONS]
#
# Options:
#   --dry-run     Show what would be done without making changes
#   --force       Skip confirmation prompts
#
# ============================================================

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

DRY_RUN=false
FORCE=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run) DRY_RUN=true; shift ;;
        --force) FORCE=true; shift ;;
        *) echo -e "${RED}Unknown option: $1${NC}"; exit 1 ;;
    esac
done

echo -e "${GREEN}Verity Protocol - Production Database Seeding${NC}"
echo ""

# Check DATABASE_URL
if [[ -z "${DATABASE_URL:-}" ]]; then
    echo -e "${RED}ERROR: DATABASE_URL not set${NC}"
    exit 1
fi

# Confirmation
if [[ "$FORCE" != "true" && "$DRY_RUN" != "true" ]]; then
    echo -e "${YELLOW}WARNING: This will seed the production database.${NC}"
    read -p "Continue? (yes/no): " response
    if [[ "$response" != "yes" ]]; then
        echo "Cancelled."
        exit 0
    fi
fi

cd "$PROJECT_ROOT"

if [[ "$DRY_RUN" == "true" ]]; then
    echo "DRY RUN - Would execute seeding SQL..."
    echo ""
fi

# Create seed SQL
SEED_SQL=$(cat << 'EOF'
-- ============================================================
-- Verity Protocol - Production Seed Data
-- ============================================================

-- Note: This uses ON CONFLICT to be idempotent (safe to run multiple times)

-- ============================================================
-- Sentinel Detection Rules (Default Rules)
-- ============================================================

-- These rules define the AI Sentinel fraud detection thresholds
-- Stored in audit_log as system configuration

INSERT INTO "AuditLog" (id, action, actor, "entityType", "entityId", metadata, "createdAt")
VALUES 
    (
        'sentinel-rule-large-tx',
        'SENTINEL_RULE_CREATED',
        'SYSTEM',
        'SENTINEL_RULE',
        'large-transaction',
        '{"ruleId": "large-transaction", "name": "Large Transaction Detection", "description": "Flags transactions above threshold", "severity": "WARNING", "threshold": 100000, "enabled": true}'::jsonb,
        NOW()
    ),
    (
        'sentinel-rule-wash-trade',
        'SENTINEL_RULE_CREATED',
        'SYSTEM',
        'SENTINEL_RULE',
        'wash-trading',
        '{"ruleId": "wash-trading", "name": "Wash Trading Detection", "description": "Detects circular trading patterns", "severity": "CRITICAL", "threshold": 5, "timeWindowHours": 24, "enabled": true}'::jsonb,
        NOW()
    ),
    (
        'sentinel-rule-rapid-tx',
        'SENTINEL_RULE_CREATED',
        'SYSTEM',
        'SENTINEL_RULE',
        'rapid-transactions',
        '{"ruleId": "rapid-transactions", "name": "Rapid Transaction Detection", "description": "Flags high frequency trading", "severity": "WARNING", "threshold": 50, "timeWindowMinutes": 10, "enabled": true}'::jsonb,
        NOW()
    ),
    (
        'sentinel-rule-structuring',
        'SENTINEL_RULE_CREATED',
        'SYSTEM',
        'SENTINEL_RULE',
        'structuring',
        '{"ruleId": "structuring", "name": "Structuring Detection", "description": "Detects transaction splitting to avoid thresholds", "severity": "CRITICAL", "threshold": 9000, "tolerance": 500, "enabled": true}'::jsonb,
        NOW()
    ),
    (
        'sentinel-rule-new-wallet',
        'SENTINEL_RULE_CREATED',
        'SYSTEM',
        'SENTINEL_RULE',
        'new-wallet-large-tx',
        '{"ruleId": "new-wallet-large-tx", "name": "New Wallet Large Transaction", "description": "Flags large transactions from new wallets", "severity": "WARNING", "walletAgeDays": 7, "threshold": 10000, "enabled": true}'::jsonb,
        NOW()
    ),
    (
        'sentinel-rule-dormant',
        'SENTINEL_RULE_CREATED',
        'SYSTEM',
        'SENTINEL_RULE',
        'dormant-wallet-activation',
        '{"ruleId": "dormant-wallet-activation", "name": "Dormant Wallet Activation", "description": "Flags activity from long-dormant wallets", "severity": "INFO", "dormantDays": 180, "enabled": true}'::jsonb,
        NOW()
    ),
    (
        'sentinel-rule-layering',
        'SENTINEL_RULE_CREATED',
        'SYSTEM',
        'SENTINEL_RULE',
        'layering',
        '{"ruleId": "layering", "name": "Layering Detection", "description": "Detects multi-hop transfers to obscure origin", "severity": "CRITICAL", "maxHops": 5, "timeWindowHours": 48, "enabled": true}'::jsonb,
        NOW()
    )
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- System Configuration
-- ============================================================

INSERT INTO "AuditLog" (id, action, actor, "entityType", "entityId", metadata, "createdAt")
VALUES 
    (
        'system-config-staking',
        'SYSTEM_CONFIG_SET',
        'SYSTEM',
        'SYSTEM_CONFIG',
        'staking-tiers',
        '{"tiers": {"BASIC": 1000, "PROFESSIONAL": 10000, "INSTITUTIONAL": 50000, "DEVELOPER": 5000}, "rewardRates": {"BASIC": 5, "PROFESSIONAL": 8, "INSTITUTIONAL": 12, "DEVELOPER": 6}}'::jsonb,
        NOW()
    ),
    (
        'system-config-governance',
        'SYSTEM_CONFIG_SET',
        'SYSTEM',
        'SYSTEM_CONFIG',
        'governance',
        '{"proposalThreshold": 10000, "votingPeriodHours": 72, "quorumPercentage": 10, "executionDelayHours": 24}'::jsonb,
        NOW()
    ),
    (
        'system-config-bridge',
        'SYSTEM_CONFIG_SET',
        'SYSTEM',
        'SYSTEM_CONFIG',
        'bridge',
        '{"minBridgeAmount": 100, "maxBridgeAmount": 1000000, "requiredValidators": 3, "validatorThreshold": 5}'::jsonb,
        NOW()
    ),
    (
        'system-config-fees',
        'SYSTEM_CONFIG_SET',
        'SYSTEM',
        'SYSTEM_CONFIG',
        'fees',
        '{"tokenizationFeePercent": 0.25, "tradingFeePercent": 0.1, "dividendProcessingPercent": 0.05, "bridgeFeePercent": 0.1}'::jsonb,
        NOW()
    )
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- Verify Seeding
-- ============================================================

SELECT 
    COUNT(*) as total_seed_records,
    COUNT(CASE WHEN action = 'SENTINEL_RULE_CREATED' THEN 1 END) as sentinel_rules,
    COUNT(CASE WHEN action = 'SYSTEM_CONFIG_SET' THEN 1 END) as system_configs
FROM "AuditLog"
WHERE actor = 'SYSTEM';
EOF
)

if [[ "$DRY_RUN" == "true" ]]; then
    echo "SQL to be executed:"
    echo ""
    echo "$SEED_SQL"
else
    echo "Executing seed SQL..."
    echo "$SEED_SQL" | npx prisma db execute --stdin
    echo ""
    echo -e "${GREEN}Production seeding completed successfully!${NC}"
fi
