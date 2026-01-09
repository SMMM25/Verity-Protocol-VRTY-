/**
 * Verity Protocol - OpenAPI/Swagger Documentation
 * Comprehensive API specification for the Verity Protocol
 */

import { Router, Request, Response } from 'express';

const router = Router();

/**
 * OpenAPI 3.0 Specification for Verity Protocol
 */
const openAPISpec = {
  openapi: '3.0.3',
  info: {
    title: 'Verity Protocol API',
    description: `
# Verity Protocol - The Verified Financial Operating System for XRP Ledger

Verity Protocol provides institutional-grade compliance, verification, and transparency 
for tokenized assets on the XRP Ledger (XRPL). 

## Key Features

- **XAO-DOW Compliance**: XLS-39D clawback with governance-controlled execution
- **Verified Asset Tokenization**: Real-world asset tokenization with KYC/AML
- **Multi-Signature Treasuries**: DAO-style guild management with XRPL multi-signing
- **Proof-of-Engagement Signals**: On-chain reputation via micro-XRP payments
- **Auto-Tax Engine**: Real-time tax calculations for 200+ jurisdictions
- **VRTY Token**: Protocol governance and fee discounts

## Authentication

Most endpoints require an API key passed in the \`X-API-Key\` header.

## Rate Limiting

- Basic tier: 100 requests/minute
- Professional tier: 1000 requests/minute
- Institutional tier: 10000 requests/minute

## Response Format

All responses follow this structure:
\`\`\`json
{
  "success": true,
  "data": { ... },
  "meta": {
    "requestId": "uuid",
    "timestamp": "ISO8601"
  }
}
\`\`\`
    `,
    version: '1.0.0',
    contact: {
      name: 'Verity Protocol Support',
      email: 'support@verity.finance',
      url: 'https://verity.finance',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
    termsOfService: 'https://verity.finance/terms',
  },
  servers: [
    {
      url: '/api/v1',
      description: 'Production API',
    },
    {
      url: 'https://testnet.verity.finance/api/v1',
      description: 'Testnet API',
    },
  ],
  tags: [
    { name: 'Health', description: 'System health and status endpoints' },
    { name: 'XRPL', description: 'XRP Ledger network operations' },
    { name: 'Assets', description: 'Verified asset tokenization and management' },
    { name: 'Signals', description: 'Proof-of-engagement signal protocol' },
    { name: 'Guilds', description: 'Multi-signature treasury management' },
    { name: 'Token', description: 'VRTY token operations and staking' },
    { name: 'Tax', description: 'Auto-tax calculation engine' },
    { name: 'Governance', description: 'Protocol governance and proposals' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Check system health',
        description: 'Returns the current health status of the Verity Protocol API',
        operationId: 'getHealth',
        responses: {
          '200': {
            description: 'System is healthy',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
              },
            },
          },
        },
      },
    },
    '/xrpl/info': {
      get: {
        tags: ['XRPL'],
        summary: 'Get XRPL network information',
        description: 'Returns XRPL network configuration and available features',
        operationId: 'getXRPLInfo',
        security: [{ ApiKeyAuth: [] }],
        responses: {
          '200': {
            description: 'XRPL network information',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/XRPLInfoResponse' },
              },
            },
          },
        },
      },
    },
    '/assets': {
      get: {
        tags: ['Assets'],
        summary: 'List assets',
        description: 'Returns a paginated list of all verified assets',
        operationId: 'listAssets',
        security: [{ ApiKeyAuth: [] }],
        parameters: [
          { $ref: '#/components/parameters/Classification' },
          { $ref: '#/components/parameters/Category' },
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/Limit' },
        ],
        responses: {
          '200': {
            description: 'List of assets',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AssetsListResponse' },
              },
            },
          },
        },
      },
    },
    '/assets/issue': {
      post: {
        tags: ['Assets'],
        summary: 'Issue a new verified asset',
        description: 'Create and issue a new verified asset on XRPL with optional clawback capability',
        operationId: 'issueAsset',
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/IssueAssetRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Asset issued successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AssetIssuedResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
        },
      },
    },
    '/tax/jurisdictions': {
      get: {
        tags: ['Tax'],
        summary: 'List supported jurisdictions',
        description: 'Returns all 200+ supported tax jurisdictions with their rules',
        operationId: 'listJurisdictions',
        security: [{ ApiKeyAuth: [] }],
        parameters: [
          {
            name: 'region',
            in: 'query',
            description: 'Filter by region',
            schema: { type: 'string' },
          },
          {
            name: 'taxFriendly',
            in: 'query',
            description: 'Filter to show only 0% capital gains jurisdictions',
            schema: { type: 'boolean' },
          },
          {
            name: 'holdingExemption',
            in: 'query',
            description: 'Filter to show jurisdictions with holding period exemptions',
            schema: { type: 'boolean' },
          },
        ],
        responses: {
          '200': {
            description: 'List of jurisdictions',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/JurisdictionsResponse' },
              },
            },
          },
        },
      },
    },
    '/tax/jurisdictions/{code}': {
      get: {
        tags: ['Tax'],
        summary: 'Get jurisdiction details',
        description: 'Returns detailed tax rules for a specific jurisdiction',
        operationId: 'getJurisdiction',
        security: [{ ApiKeyAuth: [] }],
        parameters: [
          {
            name: 'code',
            in: 'path',
            required: true,
            description: 'ISO 3166-1 alpha-2 country code',
            schema: { type: 'string', example: 'US' },
          },
        ],
        responses: {
          '200': {
            description: 'Jurisdiction details',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/JurisdictionResponse' },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/tax/calculate': {
      post: {
        tags: ['Tax'],
        summary: 'Calculate transaction tax',
        description: 'Calculate tax implications for a cryptocurrency transaction',
        operationId: 'calculateTax',
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/TaxCalculationRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Tax calculation result',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/TaxCalculationResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
        },
      },
    },
    '/tax/methodology': {
      get: {
        tags: ['Tax'],
        summary: 'Get calculation methodology',
        description: 'Returns documentation of the tax calculation methodology',
        operationId: 'getMethodology',
        security: [{ ApiKeyAuth: [] }],
        responses: {
          '200': {
            description: 'Methodology documentation',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/MethodologyResponse' },
              },
            },
          },
        },
      },
    },
    '/token/tiers': {
      get: {
        tags: ['Token'],
        summary: 'Get staking tiers',
        description: 'Returns VRTY token staking tier requirements and benefits',
        operationId: 'getTokenTiers',
        security: [{ ApiKeyAuth: [] }],
        responses: {
          '200': {
            description: 'Staking tier information',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/TokenTiersResponse' },
              },
            },
          },
        },
      },
    },
    '/signals/algorithm': {
      get: {
        tags: ['Signals'],
        summary: 'Get reputation algorithm',
        description: 'Returns the public reputation scoring algorithm details',
        operationId: 'getSignalsAlgorithm',
        security: [{ ApiKeyAuth: [] }],
        responses: {
          '200': {
            description: 'Algorithm documentation',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AlgorithmResponse' },
              },
            },
          },
        },
      },
    },
    '/guilds': {
      get: {
        tags: ['Guilds'],
        summary: 'List guilds',
        description: 'Returns a list of all guilds/DAOs',
        operationId: 'listGuilds',
        security: [{ ApiKeyAuth: [] }],
        parameters: [
          {
            name: 'member',
            in: 'query',
            description: 'Filter by member wallet address',
            schema: { type: 'string' },
          },
          { $ref: '#/components/parameters/Page' },
          { $ref: '#/components/parameters/Limit' },
        ],
        responses: {
          '200': {
            description: 'List of guilds',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GuildsListResponse' },
              },
            },
          },
        },
      },
    },
    '/guilds/treasury': {
      post: {
        tags: ['Guilds'],
        summary: 'Create a new guild with treasury',
        description: 'Create a new guild with multi-sig treasury on XRPL',
        operationId: 'createGuild',
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateGuildRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Guild created successfully',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GuildCreatedResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/ValidationError' },
        },
      },
    },
    '/governance/proposals': {
      get: {
        tags: ['Governance'],
        summary: 'List governance proposals',
        description: 'Returns all protocol governance proposals',
        operationId: 'listProposals',
        security: [{ ApiKeyAuth: [] }],
        parameters: [
          {
            name: 'status',
            in: 'query',
            description: 'Filter by proposal status',
            schema: {
              type: 'string',
              enum: ['PENDING', 'ACTIVE', 'PASSED', 'FAILED', 'EXECUTED'],
            },
          },
        ],
        responses: {
          '200': {
            description: 'List of proposals',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ProposalsListResponse' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description: 'API key for authentication',
      },
    },
    parameters: {
      Classification: {
        name: 'classification',
        in: 'query',
        description: 'Asset classification filter',
        schema: { type: 'string', enum: ['VERIFIED', 'COMMUNITY'] },
      },
      Category: {
        name: 'category',
        in: 'query',
        description: 'Asset category filter',
        schema: {
          type: 'string',
          enum: ['REAL_ESTATE', 'PRIVATE_EQUITY', 'SECURITIES', 'COMMODITIES', 'CREATOR_TOKEN', 'DAO_GOVERNANCE', 'UTILITY'],
        },
      },
      Page: {
        name: 'page',
        in: 'query',
        description: 'Page number for pagination',
        schema: { type: 'integer', default: 1, minimum: 1 },
      },
      Limit: {
        name: 'limit',
        in: 'query',
        description: 'Items per page',
        schema: { type: 'integer', default: 20, minimum: 1, maximum: 100 },
      },
    },
    schemas: {
      HealthResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          data: {
            type: 'object',
            properties: {
              status: { type: 'string', example: 'healthy' },
              version: { type: 'string', example: '0.1.0' },
              uptime: { type: 'number', example: 12345.67 },
            },
          },
          meta: { $ref: '#/components/schemas/ResponseMeta' },
        },
      },
      ResponseMeta: {
        type: 'object',
        properties: {
          requestId: { type: 'string', format: 'uuid' },
          timestamp: { type: 'string', format: 'date-time' },
        },
      },
      JurisdictionRules: {
        type: 'object',
        properties: {
          code: { type: 'string', example: 'US' },
          name: { type: 'string', example: 'United States' },
          region: { type: 'string', example: 'North America' },
          shortTermRate: { type: 'number', example: 37 },
          longTermRate: { type: 'number', example: 20 },
          longTermThresholdDays: { type: 'integer', example: 365 },
          dividendRate: { type: 'number', example: 20 },
          cryptoSpecificRules: {
            type: 'object',
            properties: {
              holdingPeriodExemption: { type: 'boolean' },
              exemptionDays: { type: 'integer' },
              miningTaxed: { type: 'boolean' },
              stakingTaxed: { type: 'boolean' },
            },
          },
          treatyPartners: {
            type: 'array',
            items: { type: 'string' },
          },
          currency: { type: 'string', example: 'USD' },
          notes: { type: 'string' },
        },
      },
      JurisdictionsResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              jurisdictions: {
                type: 'array',
                items: { $ref: '#/components/schemas/JurisdictionRules' },
              },
              totalCount: { type: 'integer', example: 216 },
            },
          },
          meta: { $ref: '#/components/schemas/ResponseMeta' },
        },
      },
      JurisdictionResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              jurisdiction: { $ref: '#/components/schemas/JurisdictionRules' },
            },
          },
          meta: { $ref: '#/components/schemas/ResponseMeta' },
        },
      },
      TokenTiersResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              tiers: {
                type: 'object',
                properties: {
                  BASIC: { $ref: '#/components/schemas/StakingTier' },
                  PROFESSIONAL: { $ref: '#/components/schemas/StakingTier' },
                  INSTITUTIONAL: { $ref: '#/components/schemas/StakingTier' },
                  DEVELOPER: { $ref: '#/components/schemas/StakingTier' },
                },
              },
            },
          },
          meta: { $ref: '#/components/schemas/ResponseMeta' },
        },
      },
      StakingTier: {
        type: 'object',
        properties: {
          minStake: { type: 'integer', example: 1000 },
          feeDiscount: { type: 'integer', description: 'Basis points', example: 2500 },
          features: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
      XRPLInfoResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              network: { type: 'string', example: 'testnet' },
              endpoints: {
                type: 'object',
                properties: {
                  mainnet: { type: 'string' },
                  testnet: { type: 'string' },
                  devnet: { type: 'string' },
                },
              },
              features: {
                type: 'array',
                items: { type: 'string' },
              },
            },
          },
          meta: { $ref: '#/components/schemas/ResponseMeta' },
        },
      },
      AssetsListResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              assets: {
                type: 'array',
                items: { $ref: '#/components/schemas/VerifiedAsset' },
              },
            },
          },
          meta: { $ref: '#/components/schemas/ResponseMetaWithPagination' },
        },
      },
      VerifiedAsset: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'AST_abc123' },
          issuer: { type: 'string', example: 'rIssuer...' },
          currencyCode: { type: 'string', example: 'PROP1' },
          name: { type: 'string', example: 'Property Token 1' },
          classification: { type: 'string', enum: ['VERIFIED', 'COMMUNITY'] },
          category: { type: 'string' },
          status: { type: 'string', enum: ['PENDING', 'ACTIVE', 'SUSPENDED', 'RETIRED'] },
          clawbackEnabled: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      IssueAssetRequest: {
        type: 'object',
        required: ['name', 'symbol', 'totalSupply', 'classification', 'category'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          symbol: { type: 'string', minLength: 1, maxLength: 20 },
          totalSupply: { type: 'string' },
          classification: { type: 'string', enum: ['VERIFIED', 'COMMUNITY'] },
          category: { type: 'string' },
          clawbackEnabled: { type: 'boolean', default: true },
          jurisdiction: { type: 'string' },
          requiresKYC: { type: 'boolean' },
          description: { type: 'string' },
        },
      },
      AssetIssuedResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              asset: { $ref: '#/components/schemas/VerifiedAsset' },
              transactionHash: { type: 'string' },
            },
          },
          meta: { $ref: '#/components/schemas/ResponseMeta' },
        },
      },
      TaxCalculationRequest: {
        type: 'object',
        required: ['transaction', 'profile'],
        properties: {
          transaction: {
            type: 'object',
            required: ['type', 'asset', 'amount', 'pricePerUnit', 'totalValue', 'timestamp'],
            properties: {
              type: { type: 'string', enum: ['BUY', 'SELL', 'TRANSFER', 'DIVIDEND', 'STAKING_REWARD', 'AIRDROP'] },
              asset: { type: 'string' },
              amount: { type: 'string' },
              pricePerUnit: { type: 'string' },
              totalValue: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' },
              transactionHash: { type: 'string' },
            },
          },
          profile: {
            type: 'object',
            required: ['taxResidence', 'costBasisMethod'],
            properties: {
              taxResidence: { type: 'string' },
              costBasisMethod: { type: 'string', enum: ['FIFO', 'LIFO', 'HIFO', 'AVERAGE', 'SPECIFIC_ID'] },
              treatyBenefits: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
      TaxCalculationResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              transactionId: { type: 'string' },
              transactionType: { type: 'string' },
              proceeds: { type: 'string' },
              costBasis: { type: 'string' },
              gainLoss: { type: 'string' },
              taxableAmount: { type: 'string' },
              taxRate: { type: 'number' },
              taxOwed: { type: 'string' },
              methodology: { type: 'string' },
            },
          },
          meta: { $ref: '#/components/schemas/ResponseMeta' },
        },
      },
      MethodologyResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              version: { type: 'string' },
              supportedMethods: { type: 'array', items: { type: 'string' } },
              transactionTypes: { type: 'array', items: { type: 'string' } },
              supportedJurisdictions: { type: 'integer' },
              disclaimer: { type: 'string' },
            },
          },
          meta: { $ref: '#/components/schemas/ResponseMeta' },
        },
      },
      AlgorithmResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              version: { type: 'string' },
              components: {
                type: 'object',
                properties: {
                  receivedScore: { type: 'string' },
                  sentScore: { type: 'string' },
                  engagementBonus: { type: 'string' },
                  finalScore: { type: 'string' },
                },
              },
              antiManipulation: { type: 'array', items: { type: 'string' } },
            },
          },
          meta: { $ref: '#/components/schemas/ResponseMeta' },
        },
      },
      GuildsListResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              guilds: {
                type: 'array',
                items: { $ref: '#/components/schemas/Guild' },
              },
            },
          },
          meta: { $ref: '#/components/schemas/ResponseMetaWithPagination' },
        },
      },
      Guild: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'GLD_abc123' },
          name: { type: 'string' },
          treasuryWallet: { type: 'string' },
          memberCount: { type: 'integer' },
          status: { type: 'string', enum: ['ACTIVE', 'SUSPENDED', 'DISSOLVED'] },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      CreateGuildRequest: {
        type: 'object',
        required: ['name', 'requiredSigners', 'totalSigners', 'initialSigners'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          description: { type: 'string' },
          requiredSigners: { type: 'integer', minimum: 1 },
          totalSigners: { type: 'integer', minimum: 1 },
          initialSigners: { type: 'array', items: { type: 'string' } },
        },
      },
      GuildCreatedResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              guild: { $ref: '#/components/schemas/Guild' },
              transactionHash: { type: 'string' },
            },
          },
          meta: { $ref: '#/components/schemas/ResponseMeta' },
        },
      },
      ProposalsListResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: {
            type: 'object',
            properties: {
              proposals: {
                type: 'array',
                items: { $ref: '#/components/schemas/Proposal' },
              },
            },
          },
          meta: { $ref: '#/components/schemas/ResponseMeta' },
        },
      },
      Proposal: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          title: { type: 'string' },
          description: { type: 'string' },
          category: { type: 'string' },
          status: { type: 'string', enum: ['PENDING', 'ACTIVE', 'PASSED', 'FAILED', 'EXECUTED'] },
          forVotes: { type: 'string' },
          againstVotes: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          votingEndsAt: { type: 'string', format: 'date-time' },
        },
      },
      ResponseMetaWithPagination: {
        type: 'object',
        properties: {
          requestId: { type: 'string', format: 'uuid' },
          timestamp: { type: 'string', format: 'date-time' },
          pagination: {
            type: 'object',
            properties: {
              page: { type: 'integer' },
              pageSize: { type: 'integer' },
              totalItems: { type: 'integer' },
              totalPages: { type: 'integer' },
              hasNext: { type: 'boolean' },
              hasPrevious: { type: 'boolean' },
            },
          },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: { type: 'object' },
            },
          },
          meta: { $ref: '#/components/schemas/ResponseMeta' },
        },
      },
    },
    responses: {
      ValidationError: {
        description: 'Validation error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Invalid request data',
                details: [{ field: 'name', message: 'Required' }],
              },
              meta: { requestId: 'uuid', timestamp: '2024-01-01T00:00:00Z' },
            },
          },
        },
      },
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
            example: {
              success: false,
              error: { code: 'NOT_FOUND', message: 'Resource not found' },
              meta: { requestId: 'uuid', timestamp: '2024-01-01T00:00:00Z' },
            },
          },
        },
      },
    },
  },
};

/**
 * GET /openapi.json
 * OpenAPI specification
 */
router.get('/openapi.json', (req: Request, res: Response) => {
  res.json(openAPISpec);
});

/**
 * GET /swagger
 * Swagger UI HTML
 */
router.get('/swagger', (req: Request, res: Response) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verity Protocol API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body { margin: 0; padding: 0; }
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info .title { color: #4F46E5; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      window.ui = SwaggerUIBundle({
        url: "/api/v1/openapi.json",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        plugins: [SwaggerUIBundle.plugins.DownloadUrl],
        layout: "StandaloneLayout",
        defaultModelsExpandDepth: 2,
        defaultModelExpandDepth: 2,
        displayRequestDuration: true,
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
      });
    };
  </script>
</body>
</html>
  `;
  res.type('html').send(html);
});

export { router as openAPIRoutes, openAPISpec };
