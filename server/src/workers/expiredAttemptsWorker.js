// ==============================================================================
// ExamSphere – Background Worker for Expired Examination Attempts
// Server-authoritative timer enforcement: scans and auto-submits expired sessions
// ==============================================================================

import { prisma } from '../config/db.js';
import { dispatchEvaluationJob } from '../queues/evaluation.queue.js';

let intervalHandle = null;
let isRunning = false;

/**
 * Scan database for attempts that are IN_PROGRESS but have passed expiresAt
 */
export const checkAndAutoSubmitExpiredAttempts = async () => {
  if (isRunning) return;
  isRunning = true;

  try {
    const now = new Date();
    const expiredAttempts = await prisma.attempt.findMany({
      where: {
        status: 'IN_PROGRESS',
        expiresAt: { lt: now },
      },
      select: {
        id: true,
        examId: true,
        studentId: true,
        expiresAt: true,
      },
      take: 50,
    });

    if (expiredAttempts.length === 0) {
      isRunning = false;
      return;
    }

    console.log(`⏱️ [Expired Attempts Worker] Found ${expiredAttempts.length} expired in-progress attempt(s). Auto-submitting...`);

    for (const attempt of expiredAttempts) {
      try {
        await prisma.$transaction(async (tx) => {
          // Double check status inside transaction
          const current = await tx.attempt.findUnique({
            where: { id: attempt.id },
            select: { status: true },
          });

          if (current?.status === 'IN_PROGRESS') {
            await tx.attempt.update({
              where: { id: attempt.id },
              data: {
                status: 'AUTO_SUBMITTED',
                submissionReason: 'AUTO_TIMEOUT',
                submittedAt: attempt.expiresAt,
              },
            });

            await tx.auditLog.create({
              data: {
                userId: attempt.studentId,
                action: 'EXAM_ATTEMPT_AUTO_SUBMITTED',
                resource: 'ATTEMPT',
                resourceId: attempt.id,
                metadata: {
                  examId: attempt.examId,
                  reason: 'AUTO_TIMEOUT',
                  worker: 'expiredAttemptsWorker',
                },
              },
            }).catch(() => {});
          }
        });

        // Enqueue evaluation
        await dispatchEvaluationJob('evaluate-attempt', {
          attemptId: attempt.id,
          examId: attempt.examId,
          studentId: attempt.studentId,
          reason: 'AUTO_TIMEOUT',
        });
      } catch (err) {
        console.error(`❌ [Expired Attempts Worker] Failed to auto-submit attempt ${attempt.id}:`, err.message);
      }
    }
  } catch (error) {
    // Suppress connectivity errors during offline/test states
    if (!error.message?.includes("Can't reach database")) {
      console.error('❌ [Expired Attempts Worker] Error checking expired attempts:', error.message);
    }
  } finally {
    isRunning = false;
  }
};

/**
 * Start the recurring background interval
 * @param {number} intervalMs 
 */
export const startExpiredAttemptsWorker = (intervalMs = 15000) => {
  if (intervalHandle) return;
  intervalHandle = setInterval(checkAndAutoSubmitExpiredAttempts, intervalMs);
  console.log(`⏱️ [Expired Attempts Worker] Started background check interval (${intervalMs}ms)`);
};

/**
 * Stop the recurring background interval (for graceful shutdown or tests)
 */
export const stopExpiredAttemptsWorker = () => {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log('🛑 [Expired Attempts Worker] Background check interval stopped');
  }
};
