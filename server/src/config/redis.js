// ==============================================================================
// ExamSphere – Redis Client Configuration (ioredis)
// Used for caching, sessions, rate limiting, and BullMQ background queues
// ==============================================================================

import Redis from 'ioredis';
import { env } from './env.js';

const redisConfig = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
  lazyConnect: true,
  retryStrategy(times) {
    if (times > 3) {
      // Stop reconnection attempts after 3 tries if server is down
      return null;
    }
    return Math.min(times * 300, 1000);
  },
};

export const redis = env.REDIS_URL
  ? new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 300, 1000);
      },
    })
  : new Redis(redisConfig);

redis.on('connect', () => {
  console.log('✅ [Redis] Connection established successfully');
});

redis.on('ready', () => {
  console.log('⚡ [Redis] Client ready to receive commands');
});

redis.on('error', (err) => {
  // Only log if operational
  if (err.code !== 'ECONNREFUSED') {
    console.error('❌ [Redis] Connection error:', err.message);
  }
});

redis.on('close', () => {
  // Connection closed
});

/**
 * Health check helper for Redis connection
 * @returns {Promise<{ status: string, latencyMs: number, error?: string }>}
 */
export const checkRedisHealth = async () => {
  const start = Date.now();
  try {
    if (redis.status !== 'ready' && redis.status !== 'connecting') {
      await redis.connect();
    }
    const pong = await redis.ping();
    const latencyMs = Date.now() - start;
    return {
      status: pong === 'PONG' ? 'healthy' : 'unhealthy',
      latencyMs,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      latencyMs: Date.now() - start,
    };
  }
};
