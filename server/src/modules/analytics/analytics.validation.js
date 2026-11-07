// ==============================================================================
// ExamSphere – Analytics & Reporting Request Validation Schemas (Zod)
// ==============================================================================

import { z } from 'zod';

export const adminOverviewQuerySchema = z.object({
  query: z.object({
    startDate: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
    endDate: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
    courseId: z.string().uuid().optional(),
    batch: z.string().trim().max(50).optional(),
    section: z.string().trim().max(10).optional(),
    examId: z.string().uuid().optional(),
    departmentId: z.string().uuid().optional(),
  }),
});

export const facultyOverviewQuerySchema = z.object({
  query: z.object({
    startDate: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
    endDate: z.string().datetime().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()),
    courseId: z.string().uuid().optional(),
    batch: z.string().trim().max(50).optional(),
    examId: z.string().uuid().optional(),
  }),
});

export const examIdParamSchema = z.object({
  params: z.object({
    examId: z.string().uuid('Invalid examination ID format'),
  }),
});

export const studentExportParamSchema = z.object({
  params: z.object({
    studentId: z.string().uuid('Invalid student ID format').optional(),
  }),
});
