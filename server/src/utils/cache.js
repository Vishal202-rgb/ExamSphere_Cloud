// ==============================================================================
// ExamSphere – Resilient Redis Cache Helper
// Provides transparent caching with graceful fallback when Redis is offline
// ==============================================================================

import { redis } from '../config/redis.js';

class CacheService {
  constructor() {
    this.isOperational = false;
    this.init();
  }

  async init() {
    try {
      if (redis.status !== 'ready' && redis.status !== 'connecting') {
        await redis.connect();
      }
      this.isOperational = redis.status === 'ready';
    } catch {
      this.isOperational = false;
    }

    redis.on('ready', () => {
      this.isOperational = true;
    });

    redis.on('error', () => {
      this.isOperational = false;
    });

    redis.on('close', () => {
      this.isOperational = false;
    });
  }

  /**
   * Get cached JSON value or null
   */
  async get(key) {
    if (!this.isOperational) return null;
    try {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (err) {
      console.warn(`[Cache Warning] Failed to get key ${key}:`, err.message);
      return null;
    }
  }

  /**
   * Set cache with TTL in seconds
   */
  async set(key, value, ttlSeconds = 300) {
    if (!this.isOperational) return false;
    try {
      const str = JSON.stringify(value);
      await redis.set(key, str, 'EX', ttlSeconds);
      return true;
    } catch (err) {
      console.warn(`[Cache Warning] Failed to set key ${key}:`, err.message);
      return false;
    }
  }

  /**
   * Delete a specific key
   */
  async del(key) {
    if (!this.isOperational) return false;
    try {
      await redis.del(key);
      return true;
    } catch (err) {
      console.warn(`[Cache Warning] Failed to delete key ${key}:`, err.message);
      return false;
    }
  }

  /**
   * Invalidate all keys matching pattern (e.g. 'analytics:*')
   */
  async invalidatePattern(pattern) {
    if (!this.isOperational) return false;
    try {
      const keys = await redis.keys(pattern);
      if (keys && keys.length > 0) {
        await redis.del(...keys);
      }
      return true;
    } catch (err) {
      console.warn(`[Cache Warning] Failed to invalidate pattern ${pattern}:`, err.message);
      return false;
    }
  }

  /**
   * Fetch with cache or execute query callback
   */
  async remember(key, ttlSeconds, callback) {
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }
    const fresh = await callback();
    if (fresh !== undefined && fresh !== null) {
      await this.set(key, fresh, ttlSeconds);
    }
    return fresh;
  }
}

export const cacheService = new CacheService();
