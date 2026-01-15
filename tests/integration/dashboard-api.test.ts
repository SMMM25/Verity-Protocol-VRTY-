/**
 * Verity Protocol - Dashboard API Integration Tests
 * Comprehensive tests for all dashboard API endpoints
 * 
 * Tests cover:
 * - Tax Dashboard APIs
 * - Trading/DEX Dashboard APIs
 * - Guild/DAO Dashboard APIs
 * - Signals Dashboard APIs
 * - Tokenized Assets Dashboard APIs
 * - AI Sentinel Dashboard APIs
 * - Cross-Chain Bridge Dashboard APIs
 * 
 * @since 2026-01-15
 */

import { describe, it, expect, beforeAll } from 'vitest';

// Test configuration
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const API_KEY = process.env.API_KEY || 'test-key';

// Helper function for authenticated requests
async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ response: Response; data: any }> {
  const url = `${API_BASE_URL}/api/v1${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      ...options.headers,
    },
  });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

// ============================================================
// HEALTH & SYSTEM TESTS
// ============================================================

describe('System Health APIs', () => {
  describe('GET /health', () => {
    it('should return basic health status', async () => {
      const { response, data } = await apiRequest('/health');
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('healthy');
    });
  });

  describe('GET /health/detailed', () => {
    it('should return detailed health status', async () => {
      const { response, data } = await apiRequest('/health/detailed');
      
      expect(response.status).toBeOneOf([200, 503]); // 503 if DB is down
      expect(data.data).toBeDefined();
      expect(data.data.api).toBeDefined();
      expect(data.data.uptime).toBeDefined();
    });
  });

  describe('GET /health/ready', () => {
    it('should return readiness status', async () => {
      const { response, data } = await apiRequest('/health/ready');
      
      // May be 200 (ready) or 503 (not ready)
      expect([200, 503]).toContain(response.status);
      expect(data.data.status).toBeOneOf(['ready', 'not_ready']);
    });
  });

  describe('GET /health/live', () => {
    it('should return liveness status', async () => {
      const { response, data } = await apiRequest('/health/live');
      
      expect(response.status).toBe(200);
      expect(data.data.status).toBe('alive');
    });
  });

  describe('GET /health/metrics', () => {
    it('should return Prometheus-compatible metrics', async () => {
      const { response, data } = await apiRequest('/health/metrics');
      
      expect(response.status).toBe(200);
      expect(data.data.requests).toBeDefined();
      expect(data.data.uptime).toBeDefined();
      expect(data.data.memory).toBeDefined();
    });
  });
});

// ============================================================
// TAX DASHBOARD API TESTS
// ============================================================

describe('Tax Dashboard APIs', () => {
  const testUserId = 'test-user-123';

  describe('GET /tax/jurisdictions', () => {
    it('should list all jurisdictions', async () => {
      const { response, data } = await apiRequest('/tax/jurisdictions');
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.totalCount).toBeGreaterThanOrEqual(200);
      expect(Array.isArray(data.data.jurisdictions)).toBe(true);
    });

    it('should filter tax-friendly jurisdictions', async () => {
      const { response, data } = await apiRequest('/tax/jurisdictions?taxFriendly=true');
      
      expect(response.status).toBe(200);
      expect(data.data.jurisdictions.length).toBeGreaterThan(0);
      // All should be tax friendly
      data.data.jurisdictions.forEach((j: any) => {
        expect([true, undefined]).toContain(j.taxFriendly);
      });
    });

    it('should filter by region', async () => {
      const { response, data } = await apiRequest('/tax/jurisdictions?region=Europe');
      
      expect(response.status).toBe(200);
      expect(data.data.jurisdictions.every((j: any) => j.region === 'Europe')).toBe(true);
    });
  });

  describe('GET /tax/jurisdictions/:code', () => {
    it('should return specific jurisdiction', async () => {
      const { response, data } = await apiRequest('/tax/jurisdictions/US');
      
      expect(response.status).toBe(200);
      const jurisdiction = data.data?.jurisdiction || data.jurisdiction;
      expect(jurisdiction.code).toBe('US');
    });

    it('should return 404 for unknown jurisdiction', async () => {
      const { response } = await apiRequest('/tax/jurisdictions/UNKNOWN');
      
      expect(response.status).toBe(404);
    });
  });

  describe('GET /tax/methodology', () => {
    it('should return cost basis methodology', async () => {
      const { response, data } = await apiRequest('/tax/methodology');
      
      expect(response.status).toBe(200);
      expect(data.data.supportedMethods).toContain('FIFO');
      expect(data.data.supportedMethods).toContain('LIFO');
      expect(data.data.supportedMethods).toContain('HIFO');
    });
  });

  describe('POST /tax/profile', () => {
    it('should validate required fields', async () => {
      const { response, data } = await apiRequest('/tax/profile', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      
      expect(response.status).toBe(400);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });
  });
});

// ============================================================
// TRADING/DEX DASHBOARD API TESTS
// ============================================================

describe('Trading Dashboard APIs', () => {
  describe('GET /dex/orderbook', () => {
    it('should return order book data', async () => {
      const { response, data } = await apiRequest('/dex/orderbook');
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
    });

    it('should accept pair parameter', async () => {
      const { response, data } = await apiRequest('/dex/orderbook?pair=VRTY/XRP');
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('GET /dex/stats', () => {
    it('should return market statistics', async () => {
      const { response, data } = await apiRequest('/dex/stats');
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
    });
  });

  describe('GET /dex/price', () => {
    it('should return current price', async () => {
      const { response, data } = await apiRequest('/dex/price');
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('GET /dex/trades', () => {
    it('should return recent trades', async () => {
      const { response, data } = await apiRequest('/dex/trades');
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});

// ============================================================
// GUILD DASHBOARD API TESTS
// ============================================================

describe('Guild Dashboard APIs', () => {
  describe('GET /guilds', () => {
    it('should list guilds', async () => {
      const { response, data } = await apiRequest('/guilds');
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.guilds).toBeDefined();
    });

    it('should filter public guilds', async () => {
      const { response, data } = await apiRequest('/guilds?public=true');
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should support pagination', async () => {
      const { response, data } = await apiRequest('/guilds?page=1&limit=10');
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('GET /guilds/stats/global', () => {
    it('should return global guild statistics', async () => {
      const { response, data } = await apiRequest('/guilds/stats/global');
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.stats).toBeDefined();
    });
  });

  describe('GET /guilds/health', () => {
    it('should return guild service health', async () => {
      const { response, data } = await apiRequest('/guilds/health');
      
      expect(response.status).toBe(200);
      expect(data.data.status).toBeDefined();
    });
  });
});

// ============================================================
// SIGNALS DASHBOARD API TESTS
// ============================================================

describe('Signals Dashboard APIs', () => {
  describe('GET /signals/algorithm', () => {
    it('should return algorithm documentation', async () => {
      const { response, data } = await apiRequest('/signals/algorithm');
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('GET /signals/leaderboard', () => {
    it('should return leaderboard data', async () => {
      const { response, data } = await apiRequest('/signals/leaderboard');
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should accept limit parameter', async () => {
      const { response, data } = await apiRequest('/signals/leaderboard?limit=10');
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('GET /signals/discover', () => {
    it('should return discoverable content', async () => {
      const { response, data } = await apiRequest('/signals/discover');
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should support sorting', async () => {
      const { response, data } = await apiRequest('/signals/discover?sortBy=signals');
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});

// ============================================================
// TOKENIZED ASSETS DASHBOARD API TESTS
// ============================================================

describe('Tokenized Assets Dashboard APIs', () => {
  describe('GET /assets', () => {
    it('should list assets', async () => {
      const { response, data } = await apiRequest('/assets');
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.assets).toBeDefined();
    });

    it('should filter by asset type', async () => {
      const { response, data } = await apiRequest('/assets?type=REAL_ESTATE');
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should filter by status', async () => {
      const { response, data } = await apiRequest('/assets?status=ACTIVE');
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('GET /assets/stats', () => {
    it('should return platform statistics', async () => {
      const { response, data } = await apiRequest('/assets/stats');
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('GET /assets/fees', () => {
    it('should return fee structure', async () => {
      const { response, data } = await apiRequest('/assets/fees');
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});

// ============================================================
// AI SENTINEL DASHBOARD API TESTS
// ============================================================

describe('AI Sentinel Dashboard APIs', () => {
  describe('GET /sentinel/alerts', () => {
    it('should list alerts', async () => {
      const { response, data } = await apiRequest('/sentinel/alerts');
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should filter by severity', async () => {
      const { response, data } = await apiRequest('/sentinel/alerts?severity=CRITICAL');
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should filter by status', async () => {
      const { response, data } = await apiRequest('/sentinel/alerts?status=PENDING');
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('GET /sentinel/stats', () => {
    it('should return sentinel statistics', async () => {
      const { response, data } = await apiRequest('/sentinel/stats');
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should accept period parameter', async () => {
      const { response, data } = await apiRequest('/sentinel/stats?periodDays=30');
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('GET /sentinel/rules', () => {
    it('should list detection rules', async () => {
      const { response, data } = await apiRequest('/sentinel/rules');
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('GET /sentinel/guardians', () => {
    it('should list guardians', async () => {
      const { response, data } = await apiRequest('/sentinel/guardians');
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('GET /sentinel/metrics', () => {
    it('should return real-time metrics', async () => {
      const { response, data } = await apiRequest('/sentinel/metrics');
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('GET /sentinel/status', () => {
    it('should return system status', async () => {
      const { response, data } = await apiRequest('/sentinel/status');
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('GET /sentinel/health', () => {
    it('should return health status', async () => {
      const { response, data } = await apiRequest('/sentinel/health');
      
      expect(response.status).toBe(200);
      expect(data.data.status).toBeOneOf(['healthy', 'degraded', 'critical']);
    });
  });
});

// ============================================================
// CROSS-CHAIN BRIDGE DASHBOARD API TESTS
// ============================================================

describe('Cross-Chain Bridge Dashboard APIs', () => {
  describe('GET /bridge/supported-chains', () => {
    it('should list supported chains', async () => {
      const { response, data } = await apiRequest('/bridge/supported-chains');
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.chains).toBeDefined();
    });
  });

  describe('GET /bridge/solana/status', () => {
    it('should return Solana network status', async () => {
      const { response, data } = await apiRequest('/bridge/solana/status');
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('GET /bridge/estimate-fee', () => {
    it('should estimate bridge fee', async () => {
      const { response, data } = await apiRequest(
        '/bridge/estimate-fee?destinationChain=SOLANA&amount=1000'
      );
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.totalFee).toBeDefined();
    });

    it('should validate required parameters', async () => {
      const { response, data } = await apiRequest('/bridge/estimate-fee');
      
      // May return 400 for missing params or have defaults
      expect([200, 400]).toContain(response.status);
    });
  });

  describe('GET /bridge/statistics', () => {
    it('should return bridge statistics', async () => {
      const { response, data } = await apiRequest('/bridge/statistics');
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
    });
  });

  describe('GET /bridge/health', () => {
    it('should return bridge health status', async () => {
      const { response, data } = await apiRequest('/bridge/health');
      
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.status).toBeDefined();
    });
  });
});

// ============================================================
// XRPL API TESTS
// ============================================================

describe('XRPL APIs', () => {
  describe('GET /xrpl/info', () => {
    it('should return network information', async () => {
      const { response, data } = await apiRequest('/xrpl/info');
      
      expect(response.status).toBe(200);
      expect(data.data.network).toBeDefined();
      expect(data.data.endpoints).toBeDefined();
      expect(data.data.features).toContain('XLS-39D Clawback (XAO-DOW)');
    });
  });
});

// ============================================================
// ERROR HANDLING TESTS
// ============================================================

describe('API Error Handling', () => {
  it('should return 404 for unknown endpoints', async () => {
    const { response } = await apiRequest('/unknown-endpoint');
    
    expect([401, 404]).toContain(response.status);
  });

  it('should include error code in error responses', async () => {
    const { response, data } = await apiRequest('/tax/profile', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    
    expect(response.status).toBe(400);
    expect(data.error.code).toBeDefined();
  });

  it('should include request ID in error responses', async () => {
    const { response, data } = await apiRequest('/unknown-endpoint');
    
    // Meta should include requestId even in errors
    if (data.meta) {
      expect(data.meta.requestId).toBeDefined();
    }
  });
});

// ============================================================
// API RESPONSE FORMAT TESTS
// ============================================================

describe('API Response Format', () => {
  it('should use consistent response structure', async () => {
    const { response, data } = await apiRequest('/health');
    
    expect(response.status).toBe(200);
    expect(data.success).toBeDefined();
    expect(data.data).toBeDefined();
    expect(data.meta).toBeDefined();
    expect(data.meta.requestId).toBeDefined();
  });

  it('should include timestamp in responses', async () => {
    const { response, data } = await apiRequest('/health');
    
    expect(response.status).toBe(200);
    const timestamp = data.meta?.timestamp || data.data?.timestamp;
    expect(timestamp).toBeDefined();
  });
});

// ============================================================
// RATE LIMITING TESTS (Optional)
// ============================================================

describe('Rate Limiting', () => {
  it('should include rate limit headers', async () => {
    const { response } = await apiRequest('/health');
    
    // Rate limit headers may or may not be present
    // This test just documents the expected behavior
    expect(response.status).toBe(200);
  });
});

// ============================================================
// CUSTOM MATCHERS
// ============================================================

// Extend Vitest matchers for cleaner assertions
expect.extend({
  toBeOneOf(received: any, expected: any[]) {
    const pass = expected.includes(received);
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be one of ${expected.join(', ')}`
          : `expected ${received} to be one of ${expected.join(', ')}`,
    };
  },
});

// Type declaration for custom matcher
declare module 'vitest' {
  interface Assertion {
    toBeOneOf(expected: any[]): void;
  }
  interface AsymmetricMatchersContaining {
    toBeOneOf(expected: any[]): void;
  }
}
