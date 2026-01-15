# Verity Protocol - Production Dockerfile
# Multi-stage build for optimized production image

# ============================================
# Stage 1: Dependencies Installation
# ============================================
FROM node:20-alpine AS dependencies

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++ libc6-compat

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including dev for build)
RUN npm ci --include=dev

# Generate Prisma client
RUN npx prisma generate

# ============================================
# Stage 2: Build Application
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependencies from previous stage
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/prisma ./prisma

# Copy source files
COPY . .

# Build the application
RUN npm run build

# Build frontend (if exists) and ensure dist directory exists
RUN if [ -d "frontend" ]; then \
      cd frontend && npm ci && npm run build; \
    fi && \
    # Create placeholder if frontend/dist doesn't exist (for COPY to work)
    mkdir -p /app/frontend/dist && \
    touch /app/frontend/dist/.gitkeep

# ============================================
# Stage 3: Production Image
# ============================================
FROM node:20-alpine AS production

LABEL maintainer="Verity Protocol Team"
LABEL version="1.0.0"
LABEL description="Verity Protocol - Production API Server"

WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 verity

# Install production dependencies only
RUN apk add --no-cache \
    curl \
    wget \
    dumb-init

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production --ignore-scripts && \
    npm cache clean --force

# Copy Prisma schema and generated client
COPY --from=dependencies /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=dependencies /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=dependencies /app/prisma ./prisma

# Copy built application
COPY --from=builder /app/dist ./dist

# Copy frontend build (directory is guaranteed to exist from builder stage)
COPY --from=builder /app/frontend/dist ./frontend/dist

# Copy necessary configuration files
COPY tsconfig.json ./

# Set proper ownership
RUN chown -R verity:nodejs /app

# Switch to non-root user
USER verity

# Environment variables with defaults
ENV NODE_ENV=production \
    PORT=3000 \
    LOG_LEVEL=info \
    TZ=UTC

# Expose the application port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/v1/health || exit 1

# Use dumb-init as PID 1 for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# Start the application
CMD ["node", "dist/server.js"]
