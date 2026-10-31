// ==============================================================================
// ExamSphere – Health & System Status Controller
// Tests database connectivity, redis connectivity, and runtime metrics
// ==============================================================================

import { checkDatabaseHealth } from '../../config/db.js';
import { checkRedisHealth } from '../../config/redis.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { env } from '../../config/env.js';

export const getHealthStatus = asyncHandler(async (req, res) => {
  const [dbHealth, redisHealth] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth(),
  ]);

  const isHealthy = dbHealth.status === 'healthy' && redisHealth.status === 'healthy';

  const healthData = {
    service: 'ExamSphere API',
    status: isHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: env.NODE_ENV,
    checks: {
      database: dbHealth,
      redis: redisHealth,
    },
    memoryUsage: process.memoryUsage(),
  };

  const statusCode = isHealthy ? 200 : 503;
  return res.status(statusCode).json(
    new ApiResponse(
      statusCode,
      healthData,
      isHealthy ? 'All services operational' : 'One or more downstream services degraded'
    )
  );
});

export const getApiRoot = asyncHandler(async (req, res) => {
  return res.status(200).json(
    ApiResponse.success(
      {
        name: 'ExamSphere – Cloud-Based Online Examination & Assessment Platform',
        version: '1.0.0',
        architecture: 'Modular Monolith (Feature-based)',
        docs: '/api/v1/docs',
      },
      'Welcome to ExamSphere REST API'
    )
  );
});
