#!/bin/sh
# Verity Protocol - Docker Entrypoint Script
# Handles database migrations and application startup
# Version: 1.1.0 - Added verbose logging

set -e

echo ""
echo "========================================"
echo "=== Verity Protocol Startup v1.1.0 ==="
echo "========================================"
echo "Environment: ${NODE_ENV:-development}"
echo "Time: $(date -u)"

# Function to check if database is available
wait_for_db() {
    echo "Checking database connection..."
    
    if [ -z "$DATABASE_URL" ]; then
        echo "⚠️  DATABASE_URL not set - running in memory-only mode"
        return 1
    fi
    
    # Extract host and port from DATABASE_URL
    # Format: postgresql://user:pass@host:port/db
    DB_HOST=$(echo $DATABASE_URL | sed -E 's|.*@([^:]+):([0-9]+)/.*|\1|')
    DB_PORT=$(echo $DATABASE_URL | sed -E 's|.*@([^:]+):([0-9]+)/.*|\2|')
    
    echo "Database host: $DB_HOST:$DB_PORT"
    
    # Wait for database to be ready (max 30 seconds)
    RETRIES=30
    until nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null || [ $RETRIES -eq 0 ]; do
        echo "Waiting for database... ($RETRIES retries left)"
        RETRIES=$((RETRIES-1))
        sleep 1
    done
    
    if [ $RETRIES -eq 0 ]; then
        echo "⚠️  Could not connect to database - running in memory-only mode"
        return 1
    fi
    
    echo "✅ Database is available"
    return 0
}

# Function to run database migrations
run_migrations() {
    echo "Running database migrations..."
    
    # Run Prisma migrations
    npx prisma migrate deploy --schema=./prisma/schema.prisma
    
    if [ $? -eq 0 ]; then
        echo "✅ Migrations completed successfully"
    else
        echo "⚠️  Migration failed - application may have limited functionality"
    fi
}

# Main startup sequence
main() {
    # Check and wait for database
    if wait_for_db; then
        # Run migrations if database is available
        run_migrations
    fi
    
    echo ""
    echo "=== Starting Verity Protocol Server ==="
    echo ""
    
    # Start the application
    exec node dist/server.js
}

# Run main function
main
