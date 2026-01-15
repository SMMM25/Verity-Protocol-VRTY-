# Verity Protocol - Production Deployment Guide

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Configuration](#environment-configuration)
3. [Database Setup](#database-setup)
4. [Docker Deployment](#docker-deployment)
5. [Kubernetes Deployment](#kubernetes-deployment)
6. [SSL/TLS Configuration](#ssltls-configuration)
7. [Monitoring Setup](#monitoring-setup)
8. [Security Checklist](#security-checklist)
9. [Runbook: Common Operations](#runbook-common-operations)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4 cores |
| RAM | 4 GB | 8 GB |
| Storage | 50 GB SSD | 100 GB SSD |
| Network | 100 Mbps | 1 Gbps |

### Software Requirements

- Node.js 20.x LTS
- PostgreSQL 15.x
- Redis 7.x
- Docker 24.x (for containerized deployment)
- Kubernetes 1.28+ (for K8s deployment)

### External Services

- XRPL Node access (mainnet/testnet)
- Solana RPC endpoint (for bridge)
- Domain name with DNS access
- SSL certificate (Let's Encrypt recommended)

---

## Environment Configuration

### 1. Copy Environment Template

```bash
cp .env.production.example .env
```

### 2. Configure Required Variables

#### Core Settings
```bash
# Application
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Database (use managed PostgreSQL in production)
DATABASE_URL=postgresql://user:password@host:5432/verity_protocol?schema=public

# JWT Authentication
JWT_SECRET=<generate-256-bit-secret>
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d
```

#### Generate Secure JWT Secret
```bash
openssl rand -base64 64 | tr -d '\n'
```

#### XRPL Configuration
```bash
XRPL_NETWORK=mainnet
XRPL_MAINNET_URL=wss://xrplcluster.com/
VERITY_ISSUER_ADDRESS=<issuer-r-address>
# CRITICAL: Store VERITY_ISSUER_SEED in secure vault, NOT in .env
```

#### Bridge Configuration
```bash
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_BRIDGE_PROGRAM_ID=<deployed-program-id>
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/<project-id>
```

### 3. Secrets Management

**NEVER commit secrets to version control!**

Options for secret management:
- **AWS Secrets Manager** (recommended for AWS deployments)
- **HashiCorp Vault** (recommended for multi-cloud)
- **Google Secret Manager** (for GCP deployments)
- **Kubernetes Secrets** (for K8s deployments)

---

## Database Setup

### 1. Create Production Database

```bash
# PostgreSQL (create database)
psql -U postgres -c "CREATE DATABASE verity_protocol;"
psql -U postgres -c "CREATE USER verity WITH ENCRYPTED PASSWORD '<strong-password>';"
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE verity_protocol TO verity;"
```

### 2. Run Migrations

```bash
# From project root
chmod +x scripts/db/migrate-production.sh
./scripts/db/migrate-production.sh
```

### 3. Verify Migration

```bash
npx prisma migrate status
```

### 4. Seed Initial Data (Optional)

```bash
./scripts/db/seed-production.sh
```

---

## Docker Deployment

### Quick Start

```bash
# Build and start all services
docker-compose -f docker-compose.production.yml up -d

# Check status
docker-compose -f docker-compose.production.yml ps

# View logs
docker-compose -f docker-compose.production.yml logs -f verity-api
```

### Production Build

```bash
# Build production image
docker build -t verity-protocol:latest .

# Tag for registry
docker tag verity-protocol:latest your-registry/verity-protocol:v1.0.0

# Push to registry
docker push your-registry/verity-protocol:v1.0.0
```

### Health Check

```bash
# Check API health
curl http://localhost:3000/api/v1/health

# Detailed health
curl http://localhost:3000/api/v1/health/detailed

# Kubernetes probes
curl http://localhost:3000/api/v1/health/ready
curl http://localhost:3000/api/v1/health/live
```

### Enable Monitoring (Optional)

```bash
# Start with monitoring stack
docker-compose -f docker-compose.production.yml --profile with-monitoring up -d

# Access Grafana: http://localhost:3001
# Access Prometheus: http://localhost:9090
```

---

## Kubernetes Deployment

### 1. Create Namespace

```bash
kubectl create namespace verity-protocol
```

### 2. Create Secrets

```bash
kubectl create secret generic verity-secrets \
  --namespace verity-protocol \
  --from-literal=DATABASE_URL='postgresql://...' \
  --from-literal=JWT_SECRET='...' \
  --from-literal=ISSUER_SEED='...'
```

### 3. Apply Manifests

```bash
kubectl apply -f k8s/
```

### 4. Verify Deployment

```bash
kubectl get pods -n verity-protocol
kubectl logs -f deployment/verity-api -n verity-protocol
```

---

## SSL/TLS Configuration

### Option 1: Let's Encrypt with Certbot

```bash
# Install certbot
apt-get install certbot python3-certbot-nginx

# Obtain certificate
certbot certonly --webroot -w /var/www/certbot \
  -d verityprotocol.io \
  -d www.verityprotocol.io

# Copy to nginx/ssl/
cp /etc/letsencrypt/live/verityprotocol.io/fullchain.pem nginx/ssl/
cp /etc/letsencrypt/live/verityprotocol.io/privkey.pem nginx/ssl/
```

### Option 2: Cloudflare (Recommended)

1. Add domain to Cloudflare
2. Enable "Full (strict)" SSL mode
3. Create Origin Certificate in Cloudflare dashboard
4. Download and place in `nginx/ssl/`

### Certificate Renewal

```bash
# Add to crontab
0 0 1 * * certbot renew --quiet && docker-compose restart nginx
```

---

## Monitoring Setup

### Prometheus + Grafana

1. Start monitoring stack:
```bash
docker-compose -f docker-compose.production.yml --profile with-monitoring up -d
```

2. Access dashboards:
   - Prometheus: http://localhost:9090
   - Grafana: http://localhost:3001

3. Default Grafana credentials:
   - Username: `admin`
   - Password: `<GRAFANA_PASSWORD from .env>`

### Available Metrics

| Metric | Description |
|--------|-------------|
| `verity_uptime_seconds` | Service uptime |
| `verity_requests_total` | Total HTTP requests |
| `verity_request_duration_seconds` | Request latency percentiles |
| `verity_memory_bytes` | Memory usage by type |
| `verity_database_connected` | Database connection status |
| `verity_database_latency_ms` | Database query latency |

### Alerting (Optional)

Configure alertmanager for:
- Service downtime
- High error rate (>1%)
- High latency (p99 > 1s)
- Database connection failures
- Memory usage >80%

---

## Security Checklist

### Pre-Deployment

- [ ] All secrets stored in secure vault (not in .env files)
- [ ] Database uses strong password (32+ characters)
- [ ] JWT secret is randomly generated (256-bit minimum)
- [ ] CORS origins restricted to production domains
- [ ] Rate limiting configured appropriately
- [ ] TLS 1.2+ enforced

### Post-Deployment

- [ ] Health endpoints respond correctly
- [ ] Database migrations completed successfully
- [ ] SSL certificate valid and auto-renewing
- [ ] Monitoring and alerting configured
- [ ] Log aggregation in place
- [ ] Backup strategy implemented

### Ongoing

- [ ] Rotate secrets every 90 days
- [ ] Update dependencies monthly
- [ ] Review access logs weekly
- [ ] Test disaster recovery quarterly

---

## Runbook: Common Operations

### Restart API Server

```bash
# Docker
docker-compose -f docker-compose.production.yml restart verity-api

# Kubernetes
kubectl rollout restart deployment/verity-api -n verity-protocol
```

### Scale API Servers

```bash
# Kubernetes
kubectl scale deployment/verity-api --replicas=3 -n verity-protocol
```

### View Logs

```bash
# Docker
docker-compose -f docker-compose.production.yml logs -f --tail=100 verity-api

# Kubernetes
kubectl logs -f deployment/verity-api -n verity-protocol --tail=100
```

### Database Backup

```bash
# Manual backup
pg_dump -h localhost -U verity verity_protocol > backup_$(date +%Y%m%d).sql

# Restore
psql -h localhost -U verity verity_protocol < backup_20240115.sql
```

### Emergency Maintenance Mode

```bash
# Enable maintenance mode
curl -X POST http://localhost:3000/api/v1/admin/maintenance \
  -H "Authorization: Bearer <admin-token>" \
  -d '{"enabled": true, "message": "Scheduled maintenance"}'
```

### Secrets Rotation

```bash
# Generate new JWT secret
NEW_SECRET=$(openssl rand -base64 64 | tr -d '\n')

# Update in vault/secrets manager
# Then rolling restart:
kubectl rollout restart deployment/verity-api -n verity-protocol
```

---

## Troubleshooting

### API Not Starting

1. Check logs: `docker-compose logs verity-api`
2. Verify DATABASE_URL is correct
3. Ensure database is accessible
4. Check port conflicts

### Database Connection Issues

```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1;"

# Check Prisma client
npx prisma db pull
```

### High Memory Usage

1. Check for memory leaks in logs
2. Review request patterns
3. Consider increasing resources or scaling

### SSL Certificate Errors

1. Verify certificate files exist in nginx/ssl/
2. Check certificate expiry: `openssl x509 -enddate -noout -in nginx/ssl/fullchain.pem`
3. Ensure Nginx can read certificate files

### Bridge Transaction Stuck

1. Check bridge service health: `curl http://localhost:3000/api/v1/bridge/health`
2. Review bridge logs for errors
3. Check validator connectivity
4. Verify sufficient funds in treasury

---

## Support

- **Documentation**: https://docs.verityprotocol.io
- **GitHub Issues**: https://github.com/SMMM25/Verity-Protocol-VRTY-/issues
- **Discord**: https://discord.gg/verityprotocol

---

*Last Updated: 2026-01-15*
*Version: 1.0.0*
