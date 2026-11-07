// ==============================================================================
// ExamSphere – Evaluation Validation Schemas
// ==============================================================================

import { z } from 'zod';

export const examSubmissionsQuerySchema = z.object({
  status: z.enum(['IN_PROGRESS', 'SUBMITTED', 'AUTO_SUBMITTED', 'EVALUATED', 'CANCELLED']).optional(),
  evaluationStatus: z.enum(['PENDING', 'AUTO_EVALUATED', 'MANUAL_EVALUATION_PENDING', 'EVALUATED', 'FAILED']).optional(),
  batch: z.string().optional(),
  section: z.string().optional(),
  search: z.string().optional(),
  page: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 25)),
});

export const manualEvaluationBodySchema = z.object({
  evaluations: z
    .array(
      z.object({
        questionId: z.string().uuid({ message: 'Valid questionId is required' }),
        marksAwarded: z.number().min(0, { message: 'Marks awarded cannot be negative' }),
        facultyFeedback: z.string().max(2000).optional().nullable(),
      })
    )
    .min(1, { message: 'At least one evaluation entry must be provided' }),
});

export const examIdParamSchema = z.object({
  examId: z.string().uuid({ message: 'Valid exam UUID is required' }),
});

export const attemptIdParamSchema = z.object({
  attemptId: z.string().uuid({ message: 'Valid attempt UUID is required' }),
});
