// ==============================================================================
// ExamSphere – Attempts & Examination Engine Validation Schemas (Zod)
// ==============================================================================

import { z } from 'zod';

export const startExamParamsSchema = z.object({
  examId: z.string().uuid('Valid Examination UUID is required'),
});

export const attemptParamsSchema = z.object({
  attemptId: z.string().uuid('Valid Attempt UUID is required'),
});

export const autosaveAnswerParamsSchema = z.object({
  attemptId: z.string().uuid('Valid Attempt UUID is required'),
  questionId: z.string().uuid('Valid Question UUID is required'),
});

export const autosaveAnswerBodySchema = z.object({
  selectedOptions: z.array(z.string().uuid('Option must be a valid UUID')).optional().default([]),
  descriptiveAnswer: z.string().max(20000, 'Descriptive answer exceeds limit of 20,000 characters').optional().nullable(),
  markedForReview: z.boolean().optional().default(false),
  version: z.number().int().positive().optional(),
  clientTimestamp: z.string().optional(),
});

export const submitAttemptBodySchema = z.object({
  reason: z.enum(['MANUAL', 'AUTO_TIMEOUT', 'ADMIN_TERMINATED']).optional().default('MANUAL'),
});
