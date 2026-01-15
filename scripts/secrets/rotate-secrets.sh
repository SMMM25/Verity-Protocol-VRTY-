#!/bin/bash

# ============================================
# Verity Protocol - Secrets Rotation Script
# ============================================
# 
# This script helps rotate sensitive secrets
# in a secure and controlled manner.
#
# IMPORTANT: Review and test in staging before
# running in production!
#
# Usage:
#   ./rotate-secrets.sh [secret-type]
#
# Secret types:
#   jwt     - Rotate JWT signing secret
#   db      - Rotate database password
#   api     - Rotate API keys
#   all     - Rotate all secrets
#
# ============================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
LOG_FILE="${PROJECT_ROOT}/logs/secret-rotation-$(date +%Y%m%d-%H%M%S).log"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

# Logging function
log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$LOG_FILE"
}

log_info() { log "INFO" "${BLUE}$1${NC}"; }
log_success() { log "SUCCESS" "${GREEN}$1${NC}"; }
log_warn() { log "WARN" "${YELLOW}$1${NC}"; }
log_error() { log "ERROR" "${RED}$1${NC}"; }

# Generate secure random string
generate_secret() {
    local length="${1:-64}"
    openssl rand -base64 "$length" | tr -d '\n/+=' | head -c "$length"
}

# Generate secure password
generate_password() {
    local length="${1:-32}"
    openssl rand -base64 48 | tr -d '\n' | head -c "$length"
}

# Rotate JWT secret
rotate_jwt_secret() {
    log_info "Starting JWT secret rotation..."
    
    local new_secret=$(generate_secret 64)
    
    echo ""
    echo "============================================"
    echo "NEW JWT SECRET (store securely):"
    echo "============================================"
    echo "$new_secret"
    echo "============================================"
    echo ""
    
    log_warn "MANUAL STEPS REQUIRED:"
    echo "1. Update JWT_SECRET in your secrets manager"
    echo "2. Update Kubernetes secrets: kubectl create secret generic verity-secrets --from-literal=JWT_SECRET='$new_secret' --dry-run=client -o yaml | kubectl apply -f -"
    echo "3. Perform rolling restart: kubectl rollout restart deployment/verity-api"
    echo ""
    
    log_success "JWT secret generated. Follow manual steps above."
}

# Rotate database password
rotate_db_password() {
    log_info "Starting database password rotation..."
    
    local new_password=$(generate_password 32)
    
    echo ""
    echo "============================================"
    echo "NEW DATABASE PASSWORD (store securely):"
    echo "============================================"
    echo "$new_password"
    echo "============================================"
    echo ""
    
    log_warn "MANUAL STEPS REQUIRED:"
    echo "1. Update password in PostgreSQL:"
    echo "   ALTER USER verity WITH PASSWORD '${new_password}';"
    echo ""
    echo "2. Update DATABASE_URL in secrets manager"
    echo "3. Update Kubernetes secrets"
    echo "4. Perform rolling restart of API servers"
    echo ""
    
    log_success "Database password generated. Follow manual steps above."
}

# Rotate API keys
rotate_api_keys() {
    log_info "Starting API key rotation..."
    
    local new_api_key=$(generate_secret 32)
    local new_api_secret=$(generate_secret 64)
    
    echo ""
    echo "============================================"
    echo "NEW API CREDENTIALS (store securely):"
    echo "============================================"
    echo "API_KEY: ${new_api_key}"
    echo "API_SECRET: ${new_api_secret}"
    echo "============================================"
    echo ""
    
    log_warn "MANUAL STEPS REQUIRED:"
    echo "1. Update API credentials in secrets manager"
    echo "2. Update third-party integrations with new keys"
    echo "3. Invalidate old keys after grace period"
    echo ""
    
    log_success "API keys generated. Follow manual steps above."
}

# Rotate all secrets
rotate_all() {
    log_info "Starting rotation of ALL secrets..."
    echo ""
    
    rotate_jwt_secret
    echo ""
    echo "-------------------------------------------"
    echo ""
    rotate_db_password
    echo ""
    echo "-------------------------------------------"
    echo ""
    rotate_api_keys
    
    log_success "All secrets generated. Review and apply changes."
}

# Verify current secrets
verify_secrets() {
    log_info "Verifying current secret configuration..."
    
    local issues=0
    
    # Check if .env exists
    if [[ -f "${PROJECT_ROOT}/.env" ]]; then
        log_warn "Found .env file in project root - ensure no secrets are committed!"
        issues=$((issues + 1))
    fi
    
    # Check environment variables
    if [[ -n "${JWT_SECRET:-}" ]]; then
        local jwt_length=${#JWT_SECRET}
        if [[ $jwt_length -lt 32 ]]; then
            log_error "JWT_SECRET is too short ($jwt_length chars). Minimum 32 recommended."
            issues=$((issues + 1))
        else
            log_success "JWT_SECRET length: $jwt_length chars (OK)"
        fi
    else
        log_warn "JWT_SECRET not set in environment"
    fi
    
    if [[ $issues -eq 0 ]]; then
        log_success "No issues found in secret configuration"
    else
        log_warn "Found $issues issue(s). Review above messages."
    fi
}

# Show help
show_help() {
    cat << EOF
Verity Protocol - Secrets Rotation Script

Usage: $0 [command]

Commands:
    jwt         Rotate JWT signing secret
    db          Rotate database password  
    api         Rotate API keys
    all         Rotate all secrets
    verify      Verify current secret configuration
    help        Show this help message

Examples:
    $0 jwt      # Generate new JWT secret
    $0 all      # Rotate all secrets
    $0 verify   # Check current configuration

IMPORTANT:
    - Always test in staging environment first
    - Keep old secrets available for rollback
    - Document all rotation dates
    - Update all dependent services

EOF
}

# Main entry point
main() {
    local command="${1:-help}"
    
    echo ""
    echo "============================================"
    echo "  Verity Protocol - Secrets Rotation"
    echo "  $(date '+%Y-%m-%d %H:%M:%S')"
    echo "============================================"
    echo ""
    
    case "$command" in
        jwt)
            rotate_jwt_secret
            ;;
        db)
            rotate_db_password
            ;;
        api)
            rotate_api_keys
            ;;
        all)
            rotate_all
            ;;
        verify)
            verify_secrets
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            log_error "Unknown command: $command"
            show_help
            exit 1
            ;;
    esac
    
    echo ""
    log_info "Rotation log saved to: $LOG_FILE"
    echo ""
}

# Run main function
main "$@"
