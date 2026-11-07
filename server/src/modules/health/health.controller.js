// ==============================================================================
// ExamSphere – Health & Readiness Probes Controller
// Implements secure container liveness and readiness probes without leaking secrets
// ==============================================================================

import { checkDatabaseHealth } from '../../config/db.js';
import { checkRedisHealth } from '../../config/redis.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { env } from '../../config/env.js';

/**
 * Liveness Probe: Quick check that the HTTP process is alive and responsive
 * GET /health (or GET /api/v1/health/live)
 */
export const getLiveness = asyncHandler(async (req, res) => {
  return res.status(200).json({
    status: 'ok',
    service: 'ExamSphere API',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

/**
 * Readiness Probe: Checks whether required downstream dependencies (PostgreSQL, Redis) are ready
 * GET /health/ready (or GET /api/v1/health/ready)
 */
export const getReadiness = asyncHandler(async (req, res) => {
  const [dbHealth, redisHealth] = await Promise.all([
    checkDatabaseHealth().catch(() => ({ status: 'unreachable' })),
    checkRedisHealth().catch(() => ({ status: 'unreachable' })),
  ]);

  const isDbReady = dbHealth.status === 'healthy';
  const isRedisReady = redisHealth.status === 'healthy';
  const isReady = isDbReady; // PostgreSQL is required source of truth

  const statusResponse = {
    status: isReady ? 'ready' : 'degraded',
    service: 'ExamSphere API',
    timestamp: new Date().toISOString(),
    checks: {
      database: isDbReady ? 'connected' : 'unavailable',
      redis: isRedisReady ? 'connected' : 'offline_fallback',
    },
  };

  const statusCode = isReady ? 200 : 503;
  return res.status(statusCode).json(statusResponse);
});

/**
 * Diagnostic Health Status (for admin diagnostics or /api/v1/health)
 */
export const getHealthStatus = asyncHandler(async (req, res) => {
  const [dbHealth, redisHealth] = await Promise.all([
    checkDatabaseHealth().catch((err) => ({ status: 'unreachable', error: err.message })),
    checkRedisHealth().catch((err) => ({ status: 'unreachable', error: err.message })),
  ]);

  const isHealthy = dbHealth.status === 'healthy';

  const healthData = {
    service: 'ExamSphere API',
    status: isHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: env.NODE_ENV,
    checks: {
      database: dbHealth.status,
      redis: redisHealth.status,
    },
    version: '1.0.0',
  };

  const statusCode = isHealthy ? 200 : 503;
  return res.status(statusCode).json(
    new ApiResponse(
      statusCode,
      healthData,
      isHealthy ? 'All essential services operational' : 'Database or cache dependency degraded'
    )
  );
});

/**
 * API Root Endpoint
 */
export const getApiRoot = asyncHandler(async (req, res) => {
  return res.status(200).json(
    ApiResponse.success(
      {
        name: 'ExamSphere – Cloud-Based Online Examination & Assessment Platform',
        version: '1.0.0',
        architecture: 'Modular Monolith (Feature-based)',
        environment: env.NODE_ENV,
      },
      'Welcome to ExamSphere REST API'
    )
  );
});
