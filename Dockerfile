# Verity Protocol - Production Docker Image
# Multi-stage build for optimized production deployment

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Copy source and build
COPY . .
RUN npm run build

# Prune dev dependencies
RUN npm prune --production

# Stage 2: Production
FROM node:20-alpine AS production

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

# Security: Run as non-root user
RUN addgroup -g 1001 -S verity && \
    adduser -S verity -u 1001

# Copy built artifacts
COPY --from=builder --chown=verity:verity /app/dist ./dist
COPY --from=builder --chown=verity:verity /app/node_modules ./node_modules
COPY --from=builder --chown=verity:verity /app/package.json ./package.json

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/v1/health || exit 1

# Switch to non-root user
USER verity

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "dist/server.js"]
