// ==============================================================================
// ExamSphere – Evaluation Queue (BullMQ)
// Manages asynchronous post-submission evaluation jobs with fallback resilience
// ==============================================================================

import { Queue, Worker } from 'bullmq';
import { env } from '../config/env.js';

let evaluationQueue = null;
let evaluationWorker = null;

const redisConnection = {
  host: env.REDIS_HOST || '127.0.0.1',
  port: Number(env.REDIS_PORT) || 6379,
  password: env.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  enableOfflineQueue: false,
  connectTimeout: 1000,
};

try {
  evaluationQueue = new Queue('exam-evaluations', {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: 100,
      removeOnFail: 200,
    },
  });

  evaluationWorker = new Worker(
    'exam-evaluations',
    async (job) => {
      console.log(`⚡ [Evaluation Queue] Processing evaluation job ${job.id} for attempt: ${job.data.attemptId}`);
      const { evaluationService } = await import('../modules/evaluation/evaluation.service.js');
      const evalResult = await evaluationService.evaluateAttempt(job.data.attemptId);
      return { success: true, attemptId: job.data.attemptId, resultId: evalResult?.result?.id };
    },
    { connection: redisConnection }
  );

  evaluationWorker.on('failed', (job, err) => {
    console.error(`❌ [Evaluation Queue] Job ${job?.id} failed:`, err.message);
  });

  evaluationQueue.on('error', (err) => {
    if (err.code !== 'ECONNREFUSED') {
      console.warn('⚠️ [BullMQ Evaluation Queue] Redis notice:', err.message);
    }
  });

  evaluationWorker.on('error', (err) => {
    if (err.code !== 'ECONNREFUSED') {
      console.warn('⚠️ [BullMQ Worker] Redis notice:', err.message);
    }
  });
} catch (err) {
  console.warn('⚠️ [Evaluation Queue] Redis unavailable, fallback mode active:', err.message);
}

/**
 * Enqueue evaluation job safely with fallback execution
 * @param {string} name 
 * @param {object} payload 
 */
export const dispatchEvaluationJob = async (name, payload) => {
  try {
    if (evaluationQueue) {
      await Promise.race([
        evaluationQueue.add(name, payload),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 1000)),
      ]);
      return true;
    }
  } catch (err) {
    console.warn(`ℹ️ [Evaluation Queue Fallback] Executing evaluation in-process for attempt ${payload.attemptId}`);
  }

  // Resilient in-process asynchronous evaluation fallback
  if (payload.attemptId) {
    setImmediate(async () => {
      try {
        const { evaluationService } = await import('../modules/evaluation/evaluation.service.js');
        await evaluationService.evaluateAttempt(payload.attemptId);
      } catch (e) {
        console.error('❌ [Evaluation Fallback Error]:', e.message);
      }
    });
  }
  return false;
};

/**
 * Gracefully close BullMQ worker and queue connections
 */
export const closeEvaluationQueue = async () => {
  try {
    if (evaluationWorker) {
      await evaluationWorker.close();
      console.log('🔒 BullMQ evaluation worker closed cleanly');
    }
    if (evaluationQueue) {
      await evaluationQueue.close();
      console.log('🔒 BullMQ evaluation queue closed cleanly');
    }
  } catch (err) {
    console.warn('⚠️ [BullMQ Shutdown Notice]:', err.message);
  }
};

export { evaluationQueue, evaluationWorker };

