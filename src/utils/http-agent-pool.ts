/**
 * HTTP/HTTPS Agent Pool for connection reuse
 */

import https from 'https';
import http from 'http';
import { createLogger } from '../server/logger.js';

const logger = createLogger('http-agent-pool');

export interface AgentPoolOptions {
  // Connection pool settings
  maxSockets?: number;          // Max sockets per host (default: 50)
  maxFreeSockets?: number;      // Max free sockets to keep alive (default: 10)
  timeout?: number;             // Socket timeout in ms (default: 60000)
  keepAliveTimeout?: number;    // Keep alive timeout in ms (default: 30000)
  
  // TLS/SSL settings
  rejectUnauthorized?: boolean; // Certificate verification (default: true)
  
  // Monitoring
  enableMetrics?: boolean;      // Track connection metrics (default: false)
}

interface ConnectionMetrics {
  created: number;
  destroyed: number;
  active: number;
  queued: number;
}

/**
 * Singleton HTTP/HTTPS agent pool
 */
export class AgentPool {
  private static instance: AgentPool;
  private httpsAgent: https.Agent;
  private httpAgent: http.Agent;
  private metrics: ConnectionMetrics = {
    created: 0,
    destroyed: 0,
    active: 0,
    queued: 0
  };
  private metricsInterval?: NodeJS.Timeout;

  private constructor(options: AgentPoolOptions = {}) {
    const {
      maxSockets = 50,
      maxFreeSockets = 10,
      timeout = 60000,
      keepAliveTimeout = 30000,
      rejectUnauthorized = true,
      enableMetrics = false
    } = options;

    // Create HTTPS agent with connection pooling
    this.httpsAgent = new https.Agent({
      keepAlive: true,
      keepAliveMsecs: 1000,
      maxSockets,
      maxFreeSockets,
      timeout,
      rejectUnauthorized,
      scheduling: 'fifo' // First-in-first-out scheduling
    });

    // Create HTTP agent for non-SSL connections
    this.httpAgent = new http.Agent({
      keepAlive: true,
      keepAliveMsecs: 1000,
      maxSockets,
      maxFreeSockets,
      timeout,
      scheduling: 'fifo'
    });

    // Set keep-alive timeout
    this.setupKeepAliveTimeout(keepAliveTimeout);

    // Setup metrics collection if enabled
    if (enableMetrics) {
      this.setupMetrics();
    }

    // MCP servers must not output to stdout/stderr - commenting out logger
    // logger.info('HTTP agent pool initialized', {
    //   maxSockets,
    //   maxFreeSockets,
    //   timeout,
    //   keepAliveTimeout,
    //   rejectUnauthorized
    // });
  }

  /**
   * Get singleton instance
   */
  static getInstance(options?: AgentPoolOptions): AgentPool {
    if (!AgentPool.instance) {
      AgentPool.instance = new AgentPool(options);
    }
    return AgentPool.instance;
  }

  /**
   * Get HTTPS agent
   */
  getHttpsAgent(): https.Agent {
    return this.httpsAgent;
  }

  /**
   * Get HTTP agent
   */
  getHttpAgent(): http.Agent {
    return this.httpAgent;
  }

  /**
   * Get agent based on URL
   */
  getAgent(url: string): https.Agent | http.Agent {
    return url.startsWith('https:') ? this.httpsAgent : this.httpAgent;
  }

  /**
   * Setup keep-alive timeout handling
   */
  private setupKeepAliveTimeout(timeout: number): void {
    // Add timeout handling to both agents
    const httpsAgentAny = this.httpsAgent as any;
    const httpAgentAny = this.httpAgent as any;
    
    // Store timeout configuration
    httpsAgentAny.keepAliveTimeout = timeout;
    httpAgentAny.keepAliveTimeout = timeout;
    
    logger.debug('Keep-alive timeout configured', { timeout });
  }

  /**
   * Setup metrics collection
   */
  private setupMetrics(): void {
    // Collect metrics every 30 seconds
    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, 30000);
  }

  /**
   * Collect current metrics
   */
  private collectMetrics(): void {
    const httpsStatus = (this.httpsAgent as any).getCurrentStatus?.() || {};

    this.metrics = {
      created: httpsStatus.createSocketCount || 0,
      destroyed: httpsStatus.destroySocketCount || 0,
      active: Object.keys(this.httpsAgent.sockets).reduce((sum, key) => 
        sum + (this.httpsAgent.sockets[key]?.length || 0), 0),
      queued: Object.keys(this.httpsAgent.requests).reduce((sum, key) => 
        sum + (this.httpsAgent.requests[key]?.length || 0), 0)
    };

    logger.debug('Connection pool metrics', this.metrics);
  }

  /**
   * Get current metrics
   */
  getMetrics(): ConnectionMetrics {
    return { ...this.metrics };
  }

  /**
   * Destroy all sockets and cleanup
   */
  destroy(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    // Destroy all sockets
    this.httpsAgent.destroy();
    this.httpAgent.destroy();

    logger.info('HTTP agent pool destroyed');
  }

  /**
   * Update agent configuration
   */
  updateConfig(options: AgentPoolOptions): void {
    logger.info('Updating agent pool configuration', options);
    
    // Create new instance with updated options
    AgentPool.instance = new AgentPool(options);
  }
}

/**
 * Get default agent pool instance
 */
export function getDefaultAgentPool(): AgentPool {
  return AgentPool.getInstance({
    maxSockets: parseInt(process.env.HTTP_MAX_SOCKETS || '50'),
    maxFreeSockets: parseInt(process.env.HTTP_MAX_FREE_SOCKETS || '10'),
    timeout: parseInt(process.env.HTTP_TIMEOUT || '60000'),
    keepAliveTimeout: parseInt(process.env.HTTP_KEEPALIVE_TIMEOUT || '30000'),
    rejectUnauthorized: process.env.JAMF_ALLOW_INSECURE !== 'true',
    enableMetrics: process.env.HTTP_ENABLE_METRICS === 'true'
  });
}

/**
 * Cleanup function for graceful shutdown
 */
export function cleanupAgentPool(): void {
  const pool = AgentPool.getInstance();
  pool.destroy();
}