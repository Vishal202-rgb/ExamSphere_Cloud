// ==============================================================================
// ExamSphere – Verification Script for PostgreSQL & Redis Connections
// Run with: node src/scripts/testConnection.js
// ==============================================================================

import { checkDatabaseHealth } from '../config/db.js';
import { checkRedisHealth, redis } from '../config/redis.js';
import { prisma } from '../config/db.js';

async function runConnectionTests() {
  console.log('====================================================');
  console.log('🔍 ExamSphere Infrastructure Connectivity Test');
  console.log('====================================================');

  let allPassed = true;

  // 1. Test PostgreSQL via Prisma
  console.log('\n[1/2] Testing PostgreSQL connection via Prisma ORM...');
  try {
    const dbResult = await checkDatabaseHealth();
    if (dbResult.status === 'healthy') {
      console.log(`✅ PostgreSQL Connected! Response latency: ${dbResult.latencyMs}ms`);
    } else {
      console.error(`❌ PostgreSQL Connection Failed: ${dbResult.error}`);
      allPassed = false;
    }
  } catch (error) {
    console.error(`❌ PostgreSQL Exception: ${error.message}`);
    allPassed = false;
  }

  // 2. Test Redis
  console.log('\n[2/2] Testing Redis connection...');
  try {
    const redisResult = await checkRedisHealth();
    if (redisResult.status === 'healthy') {
      console.log(`✅ Redis Connected! Response latency: ${redisResult.latencyMs}ms`);
    } else {
      console.error(`❌ Redis Connection Failed: ${redisResult.error}`);
      allPassed = false;
    }
  } catch (error) {
    console.error(`❌ Redis Exception: ${error.message}`);
    allPassed = false;
  }

  console.log('\n====================================================');
  if (allPassed) {
    console.log('🎉 All infrastructure services are CONNECTED and HEALTHY!');
  } else {
    console.warn('⚠️ One or more connection tests failed. Ensure Docker services are running.');
  }
  console.log('====================================================\n');

  // Disconnect cleanly
  await prisma.$disconnect().catch(() => {});
  if (redis.status === 'ready' || redis.status === 'connect') {
    await redis.quit().catch(() => {});
  }

  process.exit(allPassed ? 0 : 1);
}

runConnectionTests();
