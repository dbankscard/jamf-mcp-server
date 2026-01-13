/**
 * Comprehensive health check system
 */

import { Request, Response } from 'express';
import { JamfApiClientHybrid } from '../jamf-client-hybrid.js';
import { createLogger } from './logger.js';
import { getDefaultAgentPool } from '../utils/http-agent-pool.js';
import { ShutdownManager } from '../utils/shutdown-manager.js';
import { SkillsManager } from '../skills/manager.js';

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
  circuitBreaker?: CheckResult;
  authentication?: CheckResult;
  skills?: CheckResult;
}

/**
 * Component health status for granular breakdown
 */
export interface ComponentHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  components: {
    jamfApi: ComponentStatus;
    auth: ComponentStatus;
    skills: ComponentStatus;
    cache: ComponentStatus;
  };
  summary: {
    totalComponents: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
}

export interface ComponentStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  details?: Record<string, unknown>;
  lastChecked: string;
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
 * Check circuit breaker status
 */
function checkCircuitBreaker(client: JamfApiClientHybrid | null): CheckResult {
  if (!client) {
    return {
      status: 'pass',
      message: 'Circuit breaker not applicable (no client)',
      details: { enabled: false }
    };
  }

  const cbStatus = client.getCircuitBreakerStatus();

  if (!cbStatus.enabled) {
    return {
      status: 'pass',
      message: 'Circuit breaker disabled',
      details: { enabled: false }
    };
  }

  const details = {
    enabled: cbStatus.enabled,
    state: cbStatus.state,
    failureCount: cbStatus.failureCount,
    ...cbStatus.config
  };

  if (cbStatus.state === 'OPEN') {
    return {
      status: 'fail',
      message: 'Circuit breaker is OPEN - Jamf API calls are blocked',
      details
    };
  }

  if (cbStatus.state === 'HALF_OPEN') {
    return {
      status: 'warn',
      message: 'Circuit breaker is HALF_OPEN - testing recovery',
      details
    };
  }

  return {
    status: 'pass',
    message: 'Circuit breaker is CLOSED - operating normally',
    details
  };
}

/**
 * Check authentication status
 */
function checkAuthentication(client: JamfApiClientHybrid | null): CheckResult {
  if (!client) {
    return {
      status: 'fail',
      message: 'Jamf client not initialized',
      details: { reason: 'no_client' }
    };
  }

  const tokenStatus = client.getTokenStatus();

  // Check if we have any valid authentication method
  const hasBearerToken = tokenStatus.bearerToken?.available ?? false;
  const hasOAuth2Token = tokenStatus.oauth2Token?.available ?? false;
  const hasBasicAuth = tokenStatus.hasBasicAuth;
  const hasOAuth2Credentials = tokenStatus.hasOAuth2;

  const details: Record<string, unknown> = {
    bearerToken: hasBearerToken ? {
      available: true,
      expiresAt: tokenStatus.bearerToken?.expiresAt?.toISOString(),
      expiresIn: tokenStatus.bearerToken?.expiresIn
    } : { available: false },
    oauth2Token: hasOAuth2Token ? {
      available: true,
      expiresAt: tokenStatus.oauth2Token?.expiresAt?.toISOString(),
      expiresIn: tokenStatus.oauth2Token?.expiresIn
    } : { available: false },
    hasBasicAuth,
    hasOAuth2Credentials
  };

  // If we have active tokens, we're authenticated
  if (hasBearerToken || hasOAuth2Token) {
    // Check if token is about to expire (within 5 minutes)
    const now = Date.now();
    const bearerExpiresAt = tokenStatus.bearerToken?.expiresAt?.getTime();
    const oauth2ExpiresAt = tokenStatus.oauth2Token?.expiresAt?.getTime();

    const fiveMinutes = 5 * 60 * 1000;
    const bearerExpiringSoon = bearerExpiresAt && bearerExpiresAt - now < fiveMinutes;
    const oauth2ExpiringSoon = oauth2ExpiresAt && oauth2ExpiresAt - now < fiveMinutes;

    if ((hasBearerToken && bearerExpiringSoon) || (hasOAuth2Token && oauth2ExpiringSoon)) {
      return {
        status: 'warn',
        message: 'Authentication token expiring soon',
        details
      };
    }

    return {
      status: 'pass',
      message: 'Authenticated with valid token',
      details
    };
  }

  // We have credentials but no active token (may need to authenticate)
  if (hasBasicAuth || hasOAuth2Credentials) {
    return {
      status: 'warn',
      message: 'Credentials available but not yet authenticated',
      details
    };
  }

  return {
    status: 'fail',
    message: 'No authentication configured',
    details
  };
}

/**
 * Check skills manager status
 */
function checkSkillsManager(skillsManager: SkillsManager | null): CheckResult {
  if (!skillsManager) {
    return {
      status: 'warn',
      message: 'Skills manager not provided',
      details: { reason: 'not_configured' }
    };
  }

  const status = skillsManager.getStatus();

  const details = {
    initialized: status.initialized,
    skillCount: status.skillCount,
    registeredSkills: status.registeredSkills,
    contextAvailable: status.contextAvailable
  };

  if (!status.initialized) {
    return {
      status: 'warn',
      message: 'Skills manager not initialized',
      details
    };
  }

  if (status.skillCount === 0) {
    return {
      status: 'warn',
      message: 'No skills registered',
      details
    };
  }

  return {
    status: 'pass',
    message: `${status.skillCount} skills registered and ready`,
    details
  };
}

/**
 * Check cache status (connection pool serves as our cache/connection reuse)
 */
function checkCache(): CheckResult {
  try {
    const pool = getDefaultAgentPool();
    const metrics = pool.getMetrics();

    const details = {
      type: 'connection_pool',
      active: metrics.active,
      queued: metrics.queued,
      connectionReuse: true
    };

    // Connection pool acts as our HTTP connection cache
    return {
      status: 'pass',
      message: 'Connection pool cache operational',
      details
    };
  } catch (error) {
    return {
      status: 'warn',
      message: 'Cache status unavailable',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

/**
 * Convert CheckResult status to ComponentStatus status
 */
function convertStatus(status: 'pass' | 'fail' | 'warn'): 'healthy' | 'degraded' | 'unhealthy' {
  switch (status) {
    case 'pass':
      return 'healthy';
    case 'warn':
      return 'degraded';
    case 'fail':
      return 'unhealthy';
  }
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
    health.checks.circuitBreaker = checkCircuitBreaker(jamfClient);
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

    // Check circuit breaker - if OPEN, we're not ready
    const cbStatus = checkCircuitBreaker(jamfClient);
    if (cbStatus.status === 'fail') {
      res.status(503).json({
        status: 'not ready',
        reason: 'circuit breaker open'
      });
      return;
    }
  }

  res.status(200).json({ status: 'ready' });
}

/**
 * Component health check endpoint with granular breakdown
 * Returns detailed status for each component: jamfApi, auth, skills, cache
 */
export async function componentHealthCheck(
  req: Request,
  res: Response,
  jamfClient?: JamfApiClientHybrid,
  skillsManager?: SkillsManager
): Promise<void> {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();

  // Check each component
  const jamfApiCheck = await checkJamfApi(jamfClient ?? null);
  const authCheck = checkAuthentication(jamfClient ?? null);
  const skillsCheck = checkSkillsManager(skillsManager ?? null);
  const cacheCheck = checkCache();

  // Build component breakdown
  const components = {
    jamfApi: {
      name: 'Jamf Pro API',
      status: convertStatus(jamfApiCheck.status),
      message: jamfApiCheck.message ?? 'Unknown',
      details: jamfApiCheck.details,
      lastChecked: timestamp
    },
    auth: {
      name: 'Authentication',
      status: convertStatus(authCheck.status),
      message: authCheck.message ?? 'Unknown',
      details: authCheck.details,
      lastChecked: timestamp
    },
    skills: {
      name: 'Skills Manager',
      status: convertStatus(skillsCheck.status),
      message: skillsCheck.message ?? 'Unknown',
      details: skillsCheck.details,
      lastChecked: timestamp
    },
    cache: {
      name: 'Connection Pool Cache',
      status: convertStatus(cacheCheck.status),
      message: cacheCheck.message ?? 'Unknown',
      details: cacheCheck.details,
      lastChecked: timestamp
    }
  };

  // Calculate summary
  const componentStatuses = Object.values(components);
  const summary = {
    totalComponents: componentStatuses.length,
    healthy: componentStatuses.filter(c => c.status === 'healthy').length,
    degraded: componentStatuses.filter(c => c.status === 'degraded').length,
    unhealthy: componentStatuses.filter(c => c.status === 'unhealthy').length
  };

  // Determine overall status
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  if (summary.unhealthy > 0) {
    overallStatus = 'unhealthy';
  } else if (summary.degraded > 0) {
    overallStatus = 'degraded';
  }

  const duration = Date.now() - startTime;

  const health: ComponentHealthStatus = {
    status: overallStatus,
    timestamp,
    version: getVersion(),
    uptime: process.uptime(),
    components,
    summary
  };

  // Set appropriate status code
  const statusCode = overallStatus === 'healthy' ? 200 :
                    overallStatus === 'degraded' ? 200 : 503;

  logger.info('Component health check completed', {
    status: overallStatus,
    duration,
    summary
  });

  res.status(statusCode).json({
    ...health,
    duration
  });
}