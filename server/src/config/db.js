// ==============================================================================
// ExamSphere – Database Client Configuration (Prisma ORM & PostgreSQL)
// ==============================================================================

import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

const prismaClientSingleton = () => {
  return new PrismaClient({
    datasources: {
      db: {
        url: env.DATABASE_URL,
      },
    },
    log:
      env.NODE_ENV === 'development'
        ? [
            { emit: 'event', level: 'query' },
            { emit: 'stdout', level: 'error' },
            { emit: 'stdout', level: 'warn' },
          ]
        : ['error'],
  });
};

const globalForPrisma = globalThis;

/** @type {PrismaClient} */
export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Log query in development
if (env.NODE_ENV === 'development') {
  prisma.$on?.('query', (e) => {
    // Only uncomment for verbose query inspection
    // console.log(`[Prisma Query] ${e.query} - Duration: ${e.duration}ms`);
  });
}

/**
 * Health check helper for PostgreSQL connection
 * @returns {Promise<{ status: string, latencyMs: number }>}
 */
export const checkDatabaseHealth = async () => {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latencyMs = Date.now() - start;
    return { status: 'healthy', latencyMs };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      latencyMs: Date.now() - start,
    };
  }
};
