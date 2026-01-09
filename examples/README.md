# Verity Protocol - End-to-End Usage Examples

This directory contains comprehensive examples demonstrating how to use the Verity Protocol SDK and API.

## Quick Start

```bash
# Install dependencies
npm install verity-protocol

# Set environment variables
export XRPL_NETWORK=testnet
export VERITY_API_KEY=your_api_key
```

## Examples Overview

| Example | Description | File |
|---------|-------------|------|
| **XAO-DOW Compliance** | Clawback governance workflow | [xao-dow-compliance.ts](./xao-dow-compliance.ts) |
| **Asset Tokenization** | Real estate tokenization | [asset-tokenization.ts](./asset-tokenization.ts) |
| **Signals & Reputation** | Proof-of-engagement system | [signals-reputation.ts](./signals-reputation.ts) |
| **Guild Treasury** | Multi-sig DAO treasury | [guild-treasury.ts](./guild-treasury.ts) |
| **Auto-Tax Engine** | Tax calculation workflow | [auto-tax-engine.ts](./auto-tax-engine.ts) |
| **Full Integration** | Complete protocol workflow | [full-integration.ts](./full-integration.ts) |

## API Base URLs

- **Production**: `https://api.verity.finance/v1`
- **Testnet**: `https://testnet.api.verity.finance/v1`
- **Local Development**: `http://localhost:3000/api/v1`

## Authentication

All API requests require an API key in the header:

```bash
curl -X GET "https://api.verity.finance/v1/health" \
  -H "X-API-Key: your_api_key"
```

## Running Examples

```bash
# Run a specific example
npx ts-node examples/asset-tokenization.ts

# Run all examples
npm run examples
```
