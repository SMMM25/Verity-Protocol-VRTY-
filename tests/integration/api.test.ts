/**
 * Verity Protocol - API Integration Tests
 * Tests for REST API endpoints
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

// Test against the running server
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const API_KEY = 'test-key';

describe('Verity Protocol API Integration Tests', () => {
  describe('Health Endpoint', () => {
    it('should return healthy status', async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/health`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('healthy');
    });

    it('should include version information', async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/health`);
      const data = await response.json();

      expect(data.data.version).toBeDefined();
    });
  });

  describe('Documentation Endpoint', () => {
    it('should return API documentation', async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/docs`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.name).toBe('Verity Protocol API');
      expect(data.endpoints).toBeDefined();
    });

    it('should list all available endpoints', async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/docs`);
      const data = await response.json();

      const expectedEndpoints = ['health', 'xrpl', 'assets', 'signals', 'guilds', 'token', 'tax', 'governance'];
      for (const endpoint of expectedEndpoints) {
        expect(data.endpoints).toHaveProperty(endpoint);
      }
    });
  });

  describe('Tax Endpoints', () => {
    it('should return all jurisdictions', async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/tax/jurisdictions`, {
        headers: { 'X-API-Key': API_KEY },
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.totalCount).toBeGreaterThanOrEqual(200);
      expect(data.data.jurisdictions.length).toBeGreaterThan(0);
    });

    it('should filter tax-friendly jurisdictions', async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/tax/jurisdictions?taxFriendly=true`, {
        headers: { 'X-API-Key': API_KEY },
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.jurisdictions.length).toBeGreaterThan(20);
    });

    it('should filter by region', async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/tax/jurisdictions?region=Europe`, {
        headers: { 'X-API-Key': API_KEY },
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.jurisdictions.every((j: any) => j.region === 'Europe')).toBe(true);
    });

    it('should return specific jurisdiction details', async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/tax/jurisdictions/US`, {
        headers: { 'X-API-Key': API_KEY },
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.jurisdiction.code).toBe('US');
      expect(data.data.jurisdiction.name).toBe('United States');
      expect(data.data.jurisdiction.shortTermRate).toBe(37);
    });

    it('should return 404 for unknown jurisdiction', async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/tax/jurisdictions/UNKNOWN`, {
        headers: { 'X-API-Key': API_KEY },
      });

      expect(response.status).toBe(404);
    });

    it('should return methodology documentation', async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/tax/methodology`, {
        headers: { 'X-API-Key': API_KEY },
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.supportedMethods).toContain('FIFO');
      expect(data.data.supportedMethods).toContain('LIFO');
      expect(data.data.supportedMethods).toContain('HIFO');
    });
  });

  describe('Token Endpoints', () => {
    it('should return token tiers', async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/token/tiers`, {
        headers: { 'X-API-Key': API_KEY },
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.tiers).toBeDefined();
      
      const tierNames = Object.keys(data.data.tiers);
      expect(tierNames).toContain('BASIC');
      expect(tierNames).toContain('PROFESSIONAL');
      expect(tierNames).toContain('INSTITUTIONAL');
      expect(tierNames).toContain('DEVELOPER');
    });

    it('should have correct tier requirements', async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/token/tiers`, {
        headers: { 'X-API-Key': API_KEY },
      });
      const data = await response.json();

      expect(data.data.tiers.BASIC.minStake).toBe(1000);
      expect(data.data.tiers.PROFESSIONAL.minStake).toBe(10000);
      expect(data.data.tiers.INSTITUTIONAL.minStake).toBe(50000);
      expect(data.data.tiers.DEVELOPER.minStake).toBe(5000);
    });
  });

  describe('Signals Endpoints', () => {
    it('should return signals algorithm', async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/signals/algorithm`, {
        headers: { 'X-API-Key': API_KEY },
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.version).toBeDefined();
      expect(data.data.components).toBeDefined();
      expect(data.data.antiManipulation).toBeDefined();
    });
  });

  describe('XRPL Endpoints', () => {
    it('should return XRPL network info', async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/xrpl/info`, {
        headers: { 'X-API-Key': API_KEY },
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.network).toBeDefined();
      expect(data.data.endpoints).toBeDefined();
      expect(data.data.features).toBeDefined();
      expect(data.data.features).toContain('XLS-39D Clawback (XAO-DOW)');
    });
  });

  describe('Assets Endpoints', () => {
    it('should list assets', async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/assets`, {
        headers: { 'X-API-Key': API_KEY },
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.assets).toBeDefined();
    });

    it('should filter by classification', async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/assets?classification=VERIFIED`, {
        headers: { 'X-API-Key': API_KEY },
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.filters.classification).toBe('VERIFIED');
    });
  });

  describe('Guilds Endpoints', () => {
    it('should list guilds', async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/guilds`, {
        headers: { 'X-API-Key': API_KEY },
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.guilds).toBeDefined();
    });
  });

  describe('Governance Endpoints', () => {
    it('should list proposals', async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/governance/proposals`, {
        headers: { 'X-API-Key': API_KEY },
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/unknown`);
      expect(response.status).toBe(404);
    });

    it('should handle validation errors', async () => {
      const response = await fetch(`${API_BASE_URL}/api/v1/tax/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': API_KEY,
        },
        body: JSON.stringify({
          // Missing required fields
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('VALIDATION_ERROR');
    });
  });
});

describe('API Response Format', () => {
  it('should include request ID in all responses', async () => {
    const response = await fetch(`${API_BASE_URL}/api/v1/health`);
    const data = await response.json();

    expect(data.meta).toBeDefined();
    expect(data.meta.requestId).toBeDefined();
    expect(typeof data.meta.requestId).toBe('string');
  });

  it('should include timestamp in all responses', async () => {
    const response = await fetch(`${API_BASE_URL}/api/v1/health`);
    const data = await response.json();

    expect(data.meta.timestamp).toBeDefined();
  });
});
