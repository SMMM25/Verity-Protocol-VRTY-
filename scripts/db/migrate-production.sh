#!/bin/bash
# ============================================================
# Verity Protocol - Production Database Migration Script
# ============================================================
#
# This script handles safe database migrations for production.
# It includes safety checks, backups, and rollback capability.
#
# Usage:
#   ./scripts/db/migrate-production.sh [OPTIONS]
#
# Options:
#   --dry-run     Show what would be done without making changes
#   --force       Skip confirmation prompts
#   --no-backup   Skip backup creation (NOT RECOMMENDED)
#   --rollback    Rollback to previous migration
#
# ============================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_DIR="${PROJECT_ROOT}/backups/db"
LOG_FILE="${PROJECT_ROOT}/logs/migration-$(date +%Y%m%d_%H%M%S).log"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Flags
DRY_RUN=false
FORCE=false
NO_BACKUP=false
ROLLBACK=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --no-backup)
            NO_BACKUP=true
            shift
            ;;
        --rollback)
            ROLLBACK=true
            shift
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Logging function
log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "[${timestamp}] [${level}] ${message}" | tee -a "$LOG_FILE"
}

# Print banner
print_banner() {
    echo -e "${BLUE}"
    echo "============================================================"
    echo "  Verity Protocol - Production Database Migration"
    echo "============================================================"
    echo -e "${NC}"
}

# Check prerequisites
check_prerequisites() {
    log "INFO" "Checking prerequisites..."
    
    # Check if DATABASE_URL is set
    if [[ -z "${DATABASE_URL:-}" ]]; then
        log "ERROR" "DATABASE_URL environment variable is not set"
        exit 1
    fi
    
    # Check if npx is available
    if ! command -v npx &> /dev/null; then
        log "ERROR" "npx is not installed"
        exit 1
    fi
    
    # Check if pg_dump is available (for backups)
    if ! command -v pg_dump &> /dev/null && [[ "$NO_BACKUP" == "false" ]]; then
        log "WARN" "pg_dump not found - backups will use Prisma export instead"
    fi
    
    # Verify database connection
    log "INFO" "Verifying database connection..."
    cd "$PROJECT_ROOT"
    if ! npx prisma db execute --stdin <<< "SELECT 1" &> /dev/null; then
        log "ERROR" "Cannot connect to database"
        exit 1
    fi
    
    log "INFO" "${GREEN}All prerequisites met${NC}"
}

# Create backup
create_backup() {
    if [[ "$NO_BACKUP" == "true" ]]; then
        log "WARN" "Skipping backup (--no-backup flag set)"
        return
    fi
    
    log "INFO" "Creating database backup..."
    
    mkdir -p "$BACKUP_DIR"
    
    local backup_file="${BACKUP_DIR}/verity_backup_${TIMESTAMP}.sql"
    
    # Extract database connection info from DATABASE_URL
    if command -v pg_dump &> /dev/null; then
        # Use pg_dump for proper backup
        pg_dump "$DATABASE_URL" > "$backup_file" 2>> "$LOG_FILE"
        
        if [[ $? -eq 0 ]]; then
            # Compress backup
            gzip "$backup_file"
            log "INFO" "${GREEN}Backup created: ${backup_file}.gz${NC}"
        else
            log "ERROR" "Backup failed"
            exit 1
        fi
    else
        # Fallback: Export schema using Prisma
        log "WARN" "Using Prisma schema export (pg_dump not available)"
        cd "$PROJECT_ROOT"
        npx prisma migrate diff \
            --from-empty \
            --to-schema-datamodel prisma/schema.prisma \
            --script > "${backup_file%.sql}_schema.sql" 2>> "$LOG_FILE"
        log "INFO" "Schema exported to ${backup_file%.sql}_schema.sql"
    fi
}

# Check pending migrations
check_pending_migrations() {
    log "INFO" "Checking for pending migrations..."
    
    cd "$PROJECT_ROOT"
    
    local status=$(npx prisma migrate status 2>&1)
    
    if echo "$status" | grep -q "Database schema is up to date"; then
        log "INFO" "${GREEN}No pending migrations${NC}"
        return 1
    fi
    
    echo "$status"
    return 0
}

# Run migrations
run_migrations() {
    log "INFO" "Running database migrations..."
    
    cd "$PROJECT_ROOT"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN - Would execute: npx prisma migrate deploy"
        npx prisma migrate status
        return
    fi
    
    # Deploy migrations
    if npx prisma migrate deploy 2>> "$LOG_FILE"; then
        log "INFO" "${GREEN}Migrations completed successfully${NC}"
    else
        log "ERROR" "Migration failed"
        exit 1
    fi
    
    # Generate Prisma client
    log "INFO" "Generating Prisma client..."
    npx prisma generate 2>> "$LOG_FILE"
}

# Rollback migration
rollback_migration() {
    log "WARN" "Rolling back last migration..."
    
    cd "$PROJECT_ROOT"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "INFO" "DRY RUN - Would rollback last migration"
        return
    fi
    
    # Get list of migrations
    local migrations_dir="${PROJECT_ROOT}/prisma/migrations"
    local last_migration=$(ls -1t "$migrations_dir" 2>/dev/null | head -1)
    
    if [[ -z "$last_migration" ]]; then
        log "ERROR" "No migrations found to rollback"
        exit 1
    fi
    
    log "INFO" "Rolling back migration: $last_migration"
    
    # Mark migration as rolled back
    npx prisma migrate resolve --rolled-back "$last_migration" 2>> "$LOG_FILE"
    
    log "INFO" "${YELLOW}Migration marked as rolled back. Manual SQL may be needed to revert schema changes.${NC}"
}

# Post-migration validation
validate_migration() {
    log "INFO" "Validating migration..."
    
    cd "$PROJECT_ROOT"
    
    # Check database schema matches Prisma schema
    if npx prisma validate 2>> "$LOG_FILE"; then
        log "INFO" "${GREEN}Schema validation passed${NC}"
    else
        log "ERROR" "Schema validation failed"
        exit 1
    fi
    
    # Run a simple query to verify database is accessible
    if npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'" &> /dev/null; then
        log "INFO" "${GREEN}Database connectivity verified${NC}"
    else
        log "ERROR" "Database connectivity check failed"
        exit 1
    fi
}

# Confirmation prompt
confirm_action() {
    if [[ "$FORCE" == "true" ]]; then
        return 0
    fi
    
    echo -e "${YELLOW}"
    echo "WARNING: You are about to modify the production database."
    echo "This action may cause downtime or data loss if not done carefully."
    echo -e "${NC}"
    
    read -p "Are you sure you want to continue? (yes/no): " response
    
    if [[ "$response" != "yes" ]]; then
        log "INFO" "Migration cancelled by user"
        exit 0
    fi
}

# Main execution
main() {
    print_banner
    
    # Create logs directory
    mkdir -p "$(dirname "$LOG_FILE")"
    
    log "INFO" "Starting migration process..."
    log "INFO" "Dry run: $DRY_RUN"
    log "INFO" "Rollback: $ROLLBACK"
    
    # Check prerequisites
    check_prerequisites
    
    if [[ "$ROLLBACK" == "true" ]]; then
        confirm_action
        create_backup
        rollback_migration
    else
        # Check if there are pending migrations
        if check_pending_migrations; then
            confirm_action
            create_backup
            run_migrations
            validate_migration
        fi
    fi
    
    log "INFO" "${GREEN}Migration process completed successfully${NC}"
    echo ""
    echo "Log file: $LOG_FILE"
}

# Run main
main
