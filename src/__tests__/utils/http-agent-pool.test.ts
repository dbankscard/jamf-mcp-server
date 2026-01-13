import { describe, expect, test, jest, beforeEach, afterEach } from '@jest/globals';
import https from 'https';
import http from 'http';

// Note: AgentPool is a singleton, so we need to test carefully
// Each test suite cleans up after itself to avoid interference

describe('HTTP Agent Pool', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables to known state
    delete process.env.HTTP_MAX_SOCKETS;
    delete process.env.HTTP_MAX_FREE_SOCKETS;
    delete process.env.HTTP_TIMEOUT;
    delete process.env.HTTP_KEEPALIVE_TIMEOUT;
    delete process.env.JAMF_ALLOW_INSECURE;
    delete process.env.HTTP_ENABLE_METRICS;
  });

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
  });

  describe('AgentPool', () => {
    // Import fresh for each test to reset singleton
    const getAgentPool = async () => {
      // Clear module cache to reset singleton
      jest.resetModules();
      const module = await import('../../utils/http-agent-pool.js');
      return module;
    };

    describe('singleton pattern', () => {
      test('should return same instance on multiple getInstance calls', async () => {
        const { AgentPool } = await getAgentPool();

        const instance1 = AgentPool.getInstance();
        const instance2 = AgentPool.getInstance();

        expect(instance1).toBe(instance2);

        // Cleanup
        instance1.destroy();
      });

      test('should create instance with default options', async () => {
        const { AgentPool } = await getAgentPool();

        const pool = AgentPool.getInstance();

        const httpsAgent = pool.getHttpsAgent();
        const httpAgent = pool.getHttpAgent();

        expect(httpsAgent).toBeInstanceOf(https.Agent);
        expect(httpAgent).toBeInstanceOf(http.Agent);

        // Check default maxSockets (50)
        expect(httpsAgent.maxSockets).toBe(50);
        expect(httpAgent.maxSockets).toBe(50);

        // Check default maxFreeSockets (10)
        expect(httpsAgent.maxFreeSockets).toBe(10);
        expect(httpAgent.maxFreeSockets).toBe(10);

        // Cleanup
        pool.destroy();
      });

      test('should create instance with custom options', async () => {
        const { AgentPool } = await getAgentPool();

        const pool = AgentPool.getInstance({
          maxSockets: 100,
          maxFreeSockets: 25,
          timeout: 30000,
          keepAliveTimeout: 15000,
          rejectUnauthorized: false,
        });

        const httpsAgent = pool.getHttpsAgent();
        const httpAgent = pool.getHttpAgent();

        expect(httpsAgent.maxSockets).toBe(100);
        expect(httpAgent.maxSockets).toBe(100);
        expect(httpsAgent.maxFreeSockets).toBe(25);
        expect(httpAgent.maxFreeSockets).toBe(25);

        // Cleanup
        pool.destroy();
      });

      test('should ignore options on subsequent getInstance calls', async () => {
        const { AgentPool } = await getAgentPool();

        // First call sets options
        const instance1 = AgentPool.getInstance({ maxSockets: 100 });

        // Second call ignores options
        const instance2 = AgentPool.getInstance({ maxSockets: 200 });

        expect(instance1).toBe(instance2);
        expect(instance1.getHttpsAgent().maxSockets).toBe(100);

        // Cleanup
        instance1.destroy();
      });
    });

    describe('getAgent', () => {
      test('should return HTTPS agent for https:// URLs', async () => {
        const { AgentPool } = await getAgentPool();

        const pool = AgentPool.getInstance();
        const httpsAgent = pool.getHttpsAgent();

        expect(pool.getAgent('https://example.com')).toBe(httpsAgent);
        expect(pool.getAgent('https://api.jamf.com/v1/devices')).toBe(httpsAgent);

        // Cleanup
        pool.destroy();
      });

      test('should return HTTP agent for http:// URLs', async () => {
        const { AgentPool } = await getAgentPool();

        const pool = AgentPool.getInstance();
        const httpAgent = pool.getHttpAgent();

        expect(pool.getAgent('http://localhost:3000')).toBe(httpAgent);
        expect(pool.getAgent('http://internal.server/api')).toBe(httpAgent);

        // Cleanup
        pool.destroy();
      });
    });

    describe('metrics', () => {
      test('should return initial metrics with zero values', async () => {
        const { AgentPool } = await getAgentPool();

        const pool = AgentPool.getInstance();
        const metrics = pool.getMetrics();

        expect(metrics).toEqual({
          created: 0,
          destroyed: 0,
          active: 0,
          queued: 0,
        });

        // Cleanup
        pool.destroy();
      });

      test('should return copy of metrics, not reference', async () => {
        const { AgentPool } = await getAgentPool();

        const pool = AgentPool.getInstance();
        const metrics1 = pool.getMetrics();
        const metrics2 = pool.getMetrics();

        expect(metrics1).toEqual(metrics2);
        expect(metrics1).not.toBe(metrics2);

        // Modifying returned metrics should not affect internal state
        metrics1.created = 999;
        expect(pool.getMetrics().created).toBe(0);

        // Cleanup
        pool.destroy();
      });

      test('should setup metrics interval when enableMetrics is true', async () => {
        const { AgentPool } = await getAgentPool();

        // Create pool with metrics enabled
        const pool = AgentPool.getInstance({
          enableMetrics: true,
        });

        // Pool should have created interval
        // We can't directly test the interval, but destroy should clear it
        // This test mainly ensures no errors occur
        expect(pool.getMetrics()).toBeDefined();

        // Cleanup
        pool.destroy();
      });
    });

    describe('destroy', () => {
      test('should destroy both agents', async () => {
        const { AgentPool } = await getAgentPool();

        const pool = AgentPool.getInstance();
        const httpsAgent = pool.getHttpsAgent();
        const httpAgent = pool.getHttpAgent();

        // Spy on destroy methods
        const httpsSpy = jest.spyOn(httpsAgent, 'destroy');
        const httpSpy = jest.spyOn(httpAgent, 'destroy');

        pool.destroy();

        expect(httpsSpy).toHaveBeenCalled();
        expect(httpSpy).toHaveBeenCalled();
      });

      test('should clear metrics interval on destroy', async () => {
        const { AgentPool } = await getAgentPool();

        const pool = AgentPool.getInstance({
          enableMetrics: true,
        });

        // Should not throw
        pool.destroy();
      });
    });

    describe('updateConfig', () => {
      test('should create new instance with updated options', async () => {
        const { AgentPool } = await getAgentPool();

        const originalPool = AgentPool.getInstance({ maxSockets: 50 });
        const originalHttpsAgent = originalPool.getHttpsAgent();

        expect(originalHttpsAgent.maxSockets).toBe(50);

        // Update configuration
        originalPool.updateConfig({ maxSockets: 100 });

        // New instance should have updated config
        const updatedPool = AgentPool.getInstance();
        const newHttpsAgent = updatedPool.getHttpsAgent();

        expect(newHttpsAgent.maxSockets).toBe(100);
        expect(newHttpsAgent).not.toBe(originalHttpsAgent);

        // Cleanup
        updatedPool.destroy();
      });
    });

    describe('keep-alive timeout', () => {
      test('should configure keep-alive timeout on agents', async () => {
        const { AgentPool } = await getAgentPool();

        const pool = AgentPool.getInstance({
          keepAliveTimeout: 45000,
        });

        const httpsAgent = pool.getHttpsAgent() as unknown as { keepAliveTimeout?: number };
        const httpAgent = pool.getHttpAgent() as unknown as { keepAliveTimeout?: number };

        expect(httpsAgent.keepAliveTimeout).toBe(45000);
        expect(httpAgent.keepAliveTimeout).toBe(45000);

        // Cleanup
        pool.destroy();
      });
    });

    describe('TLS settings', () => {
      test('should enable certificate verification by default', async () => {
        const { AgentPool } = await getAgentPool();

        const pool = AgentPool.getInstance();
        const httpsAgent = pool.getHttpsAgent();

        // Access internal options
        const options = (httpsAgent as unknown as { options: { rejectUnauthorized: boolean } }).options;
        expect(options.rejectUnauthorized).toBe(true);

        // Cleanup
        pool.destroy();
      });

      test('should allow disabling certificate verification', async () => {
        const { AgentPool } = await getAgentPool();

        const pool = AgentPool.getInstance({
          rejectUnauthorized: false,
        });

        const httpsAgent = pool.getHttpsAgent();
        const options = (httpsAgent as unknown as { options: { rejectUnauthorized: boolean } }).options;
        expect(options.rejectUnauthorized).toBe(false);

        // Cleanup
        pool.destroy();
      });
    });
  });

  describe('getDefaultAgentPool', () => {
    test('should create pool with default environment values', async () => {
      jest.resetModules();
      const { getDefaultAgentPool } = await import('../../utils/http-agent-pool.js');

      const pool = getDefaultAgentPool();
      const httpsAgent = pool.getHttpsAgent();

      // Default values from code
      expect(httpsAgent.maxSockets).toBe(50);
      expect(httpsAgent.maxFreeSockets).toBe(10);

      // Cleanup
      pool.destroy();
    });

    test('should use environment variables when set', async () => {
      process.env.HTTP_MAX_SOCKETS = '200';
      process.env.HTTP_MAX_FREE_SOCKETS = '50';
      process.env.HTTP_TIMEOUT = '90000';
      process.env.HTTP_KEEPALIVE_TIMEOUT = '60000';

      jest.resetModules();
      const { getDefaultAgentPool } = await import('../../utils/http-agent-pool.js');

      const pool = getDefaultAgentPool();
      const httpsAgent = pool.getHttpsAgent();

      expect(httpsAgent.maxSockets).toBe(200);
      expect(httpsAgent.maxFreeSockets).toBe(50);

      // Cleanup
      pool.destroy();
    });

    test('should disable certificate verification when JAMF_ALLOW_INSECURE is true', async () => {
      process.env.JAMF_ALLOW_INSECURE = 'true';

      jest.resetModules();
      const { getDefaultAgentPool } = await import('../../utils/http-agent-pool.js');

      const pool = getDefaultAgentPool();
      const httpsAgent = pool.getHttpsAgent();
      const options = (httpsAgent as unknown as { options: { rejectUnauthorized: boolean } }).options;

      expect(options.rejectUnauthorized).toBe(false);

      // Cleanup
      pool.destroy();
    });

    test('should enable metrics when HTTP_ENABLE_METRICS is true', async () => {
      process.env.HTTP_ENABLE_METRICS = 'true';

      jest.resetModules();
      const { getDefaultAgentPool } = await import('../../utils/http-agent-pool.js');

      const pool = getDefaultAgentPool();

      // Pool should be created without errors
      expect(pool.getMetrics()).toBeDefined();

      // Cleanup
      pool.destroy();
    });
  });

  describe('cleanupAgentPool', () => {
    test('should destroy the agent pool', async () => {
      jest.resetModules();
      const { AgentPool, cleanupAgentPool } = await import('../../utils/http-agent-pool.js');

      // Create instance
      const pool = AgentPool.getInstance();
      const httpsAgent = pool.getHttpsAgent();
      const httpAgent = pool.getHttpAgent();

      // Spy on destroy methods
      const httpsSpy = jest.spyOn(httpsAgent, 'destroy');
      const httpSpy = jest.spyOn(httpAgent, 'destroy');

      // Call cleanup
      cleanupAgentPool();

      expect(httpsSpy).toHaveBeenCalled();
      expect(httpSpy).toHaveBeenCalled();
    });
  });

  describe('agent configuration', () => {
    test('should configure agents with keep-alive enabled', async () => {
      jest.resetModules();
      const { AgentPool } = await import('../../utils/http-agent-pool.js');

      const pool = AgentPool.getInstance();
      const httpsAgent = pool.getHttpsAgent();
      const httpAgent = pool.getHttpAgent();

      // Both agents should have keepAlive enabled
      expect(httpsAgent.keepAlive).toBe(true);
      expect(httpAgent.keepAlive).toBe(true);

      // Cleanup
      pool.destroy();
    });

    test('should configure agents with FIFO scheduling', async () => {
      jest.resetModules();
      const { AgentPool } = await import('../../utils/http-agent-pool.js');

      const pool = AgentPool.getInstance();
      const httpsAgent = pool.getHttpsAgent();
      const httpAgent = pool.getHttpAgent();

      // Access internal scheduling option
      const httpsOptions = (httpsAgent as unknown as { options: { scheduling?: string } }).options;
      const httpOptions = (httpAgent as unknown as { options: { scheduling?: string } }).options;

      expect(httpsOptions.scheduling).toBe('fifo');
      expect(httpOptions.scheduling).toBe('fifo');

      // Cleanup
      pool.destroy();
    });
  });
});
