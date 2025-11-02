/**
 * Comprehensive health check system
 */

import { Request, Response } from 'express';
import { JamfApiClientHybrid } from '../jamf-client-hybrid.js';
import { createLogger } from './logger.js';
import { getDefaultAgentPool } from '../utils/http-agent-pool.js';
import { ShutdownManager } from '../utils/shutdown-manager.js';

const logger = createLogger('health-check');

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: HealthChecks;
}

export interface HealthChecks {
  server: CheckResult;
  memory: CheckResult;
  jamfApi?: CheckResult;
  connectionPool?: CheckResult;
  shutdown?: CheckResult;
}

export interface CheckResult {
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  details?: Record<string, unknown>;
  duration?: number;
}

/**
 * Get application version
 */
function getVersion(): string {
  try {
    const packageJson = require('../../package.json');
    return packageJson.version || 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Check memory usage
 */
function checkMemory(): CheckResult {
  const usage = process.memoryUsage();
  const heapPercentage = (usage.heapUsed / usage.heapTotal) * 100;
  const totalMemoryMB = Math.round(usage.rss / 1024 / 1024);
  const heapUsedMB = Math.round(usage.heapUsed / 1024 / 1024);

  const details = {
    totalMemoryMB,
    heapUsedMB,
    heapPercentage: Math.round(heapPercentage),
    external: Math.round(usage.external / 1024 / 1024),
    arrayBuffers: Math.round(usage.arrayBuffers / 1024 / 1024)
  };

  if (heapPercentage > 90) {
    return {
      status: 'fail',
      message: 'Memory usage critical',
      details
    };
  } else if (heapPercentage > 75) {
    return {
      status: 'warn',
      message: 'Memory usage high',
      details
    };
  }

  return {
    status: 'pass',
    message: 'Memory usage normal',
    details
  };
}

/**
 * Check Jamf API connectivity
 */
async function checkJamfApi(client: JamfApiClientHybrid | null): Promise<CheckResult> {
  if (!client) {
    return {
      status: 'fail',
      message: 'Jamf client not initialized'
    };
  }

  const startTime = Date.now();
  
  try {
    // Try to test API access
    await client.testApiAccess();
    const duration = Date.now() - startTime;

    return {
      status: 'pass',
      message: 'Jamf API accessible',
      duration,
      details: {
        responseTime: duration,
        endpoint: process.env.JAMF_URL
      }
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    
    return {
      status: 'fail',
      message: 'Jamf API not accessible',
      duration,
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
        endpoint: process.env.JAMF_URL
      }
    };
  }
}

/**
 * Check connection pool health
 */
function checkConnectionPool(): CheckResult {
  try {
    const pool = getDefaultAgentPool();
    const metrics = pool.getMetrics();

    const details = {
      ...metrics,
      utilizationPercent: Math.round((metrics.active / 50) * 100) // Assuming max 50 sockets
    };

    if (metrics.queued > 10) {
      return {
        status: 'warn',
        message: 'High connection queue',
        details
      };
    }

    return {
      status: 'pass',
      message: 'Connection pool healthy',
      details
    };
  } catch (error) {
    return {
      status: 'fail',
      message: 'Unable to check connection pool',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

/**
 * Check shutdown manager status
 */
function checkShutdown(): CheckResult {
  const manager = ShutdownManager.getInstance();
  const status = manager.getStatus();

  if (status.isShuttingDown) {
    return {
      status: 'warn',
      message: 'Server is shutting down',
      details: status
    };
  }

  return {
    status: 'pass',
    message: 'Shutdown manager ready',
    details: status
  };
}

/**
 * Basic health check endpoint
 */
export async function basicHealthCheck(req: Request, res: Response): Promise<void> {
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: getVersion(),
    uptime: process.uptime(),
    checks: {
      server: { status: 'pass', message: 'Server is running' },
      memory: checkMemory()
    }
  };

  // Determine overall status
  const checks = Object.values(health.checks);
  if (checks.some(check => check.status === 'fail')) {
    health.status = 'unhealthy';
  } else if (checks.some(check => check.status === 'warn')) {
    health.status = 'degraded';
  }

  // Set appropriate status code
  const statusCode = health.status === 'healthy' ? 200 : 
                    health.status === 'degraded' ? 200 : 503;

  res.status(statusCode).json(health);
}

/**
 * Detailed health check endpoint
 */
export async function detailedHealthCheck(
  req: Request, 
  res: Response,
  jamfClient?: JamfApiClientHybrid
): Promise<void> {
  const startTime = Date.now();
  
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: getVersion(),
    uptime: process.uptime(),
    checks: {
      server: { status: 'pass', message: 'Server is running' },
      memory: checkMemory(),
      connectionPool: checkConnectionPool(),
      shutdown: checkShutdown()
    }
  };

  // Check Jamf API if client provided
  if (jamfClient) {
    health.checks.jamfApi = await checkJamfApi(jamfClient);
  }

  // Determine overall status
  const checks = Object.values(health.checks);
  if (checks.some(check => check.status === 'fail')) {
    health.status = 'unhealthy';
  } else if (checks.some(check => check.status === 'warn')) {
    health.status = 'degraded';
  }

  // Add timing
  const totalDuration = Date.now() - startTime;
  
  // Set appropriate status code
  const statusCode = health.status === 'healthy' ? 200 : 
                    health.status === 'degraded' ? 200 : 503;

  logger.info('Health check completed', {
    status: health.status,
    duration: totalDuration,
    checks: Object.entries(health.checks).map(([name, check]) => ({
      name,
      status: check.status
    }))
  });

  res.status(statusCode).json({
    ...health,
    duration: totalDuration
  });
}

/**
 * Liveness probe for Kubernetes
 */
export function livenessProbe(req: Request, res: Response): void {
  // Simple check - is the process alive?
  res.status(200).json({ status: 'alive' });
}

/**
 * Readiness probe for Kubernetes
 */
export async function readinessProbe(
  req: Request, 
  res: Response,
  jamfClient?: JamfApiClientHybrid
): Promise<void> {
  // Check if we're ready to handle requests
  const shutdownStatus = checkShutdown();
  
  if (shutdownStatus.status !== 'pass') {
    res.status(503).json({ 
      status: 'not ready', 
      reason: 'shutting down' 
    });
    return;
  }

  // Optional: Check Jamf connectivity
  if (jamfClient) {
    const jamfStatus = await checkJamfApi(jamfClient);
    if (jamfStatus.status === 'fail') {
      res.status(503).json({ 
        status: 'not ready', 
        reason: 'jamf api not accessible' 
      });
      return;
    }
  }

  res.status(200).json({ status: 'ready' });
}