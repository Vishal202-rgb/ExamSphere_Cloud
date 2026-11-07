// ==============================================================================
// ExamSphere – Examination Management Validation Schemas
// ==============================================================================

import { z } from 'zod';

export const createExamSchema = z
  .object({
    title: z.string({ required_error: 'Exam title is required' }).min(3, 'Title must be at least 3 characters').trim(),
    description: z.string().optional().nullable(),
    courseId: z.string().uuid('Invalid Course ID').optional(),
    courseIds: z.union([z.array(z.string().uuid()), z.string()]).optional(),
    durationMinutes: z.coerce.number().int().positive('Duration must be positive in minutes').default(60),
    totalMarks: z.coerce.number().positive('Total marks must be positive').default(100.0),
    passingMarks: z.coerce.number().positive('Passing marks must be positive').default(40.0),
    startTime: z.string({ required_error: 'Start time is required' }).datetime('Start time must be a valid ISO 8601 UTC timestamp'),
    endTime: z.string({ required_error: 'End time is required' }).datetime('End time must be a valid ISO 8601 UTC timestamp'),
    shuffleQuestions: z.boolean().default(false),
    shuffleOptions: z.boolean().default(false),
    negativeMarking: z.boolean().default(false),
    maxAttempts: z.coerce.number().int().min(1, 'Minimum attempts must be 1').default(1),
    maximumAttempts: z.coerce.number().int().min(1).optional(), // Alias support
    autoSubmit: z.boolean().default(true),
    allowLateEntry: z.boolean().default(false),
    status: z.enum(['DRAFT', 'SCHEDULED', 'LIVE', 'COMPLETED', 'CANCELLED']).default('DRAFT'),
  })
  .transform((data) => {
    let courseIds = [];
    if (data.courseIds) {
      courseIds = Array.isArray(data.courseIds)
        ? data.courseIds
        : data.courseIds.split(',').map((s) => s.trim()).filter(Boolean);
    } else if (data.courseId) {
      courseIds = [data.courseId];
    }
    const courseId = courseIds[0] || data.courseId;
    return {
      ...data,
      courseId,
      courseIds,
    };
  })
  .superRefine((data, ctx) => {
    if (!data.courseIds || data.courseIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one course must be selected',
        path: ['courseIds'],
      });
    }

    const start = new Date(data.startTime);
    const end = new Date(data.endTime);

    if (end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Exam end time must be after start time',
        path: ['endTime'],
      });
    }

    if (data.passingMarks > data.totalMarks) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Passing marks cannot exceed total marks',
        path: ['passingMarks'],
      });
    }
  });

export const updateExamSchema = z
  .object({
    title: z.string().min(3).trim().optional(),
    description: z.string().optional().nullable(),
    courseId: z.string().uuid().optional(),
    courseIds: z.union([z.array(z.string().uuid()), z.string()]).optional(),
    durationMinutes: z.coerce.number().int().positive().optional(),
    totalMarks: z.coerce.number().positive().optional(),
    passingMarks: z.coerce.number().positive().optional(),
    startTime: z.string().datetime().optional(),
    endTime: z.string().datetime().optional(),
    shuffleQuestions: z.boolean().optional(),
    shuffleOptions: z.boolean().optional(),
    negativeMarking: z.boolean().optional(),
    maxAttempts: z.coerce.number().int().min(1).optional(),
    maximumAttempts: z.coerce.number().int().min(1).optional(),
    autoSubmit: z.boolean().optional(),
    allowLateEntry: z.boolean().optional(),
    status: z.enum(['DRAFT', 'SCHEDULED', 'LIVE', 'COMPLETED', 'CANCELLED']).optional(),
  })
  .transform((data) => {
    let courseIds = data.courseIds;
    if (courseIds && !Array.isArray(courseIds)) {
      courseIds = courseIds.split(',').map((s) => s.trim()).filter(Boolean);
    } else if (!courseIds && data.courseId) {
      courseIds = [data.courseId];
    }
    return {
      ...data,
      ...(courseIds ? { courseIds, courseId: courseIds[0] } : {}),
    };
  })
  .superRefine((data, ctx) => {
    if (data.startTime && data.endTime) {
      const start = new Date(data.startTime);
      const end = new Date(data.endTime);
      if (end <= start) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Exam end time must be after start time',
          path: ['endTime'],
        });
      }
    }
  });

export const addExamQuestionsSchema = z
  .object({
    questions: z
      .array(
        z.object({
          questionId: z.string().uuid('Invalid question ID'),
          orderIndex: z.number().int().optional(),
          marks: z.number().positive().optional(),
          negativeMarks: z.number().min(0).optional(),
        })
      )
      .optional(),
    questionIds: z.array(z.string().uuid()).optional(),
  })
  .transform((data) => {
    let questions = data.questions || [];
    if (questions.length === 0 && data.questionIds) {
      questions = data.questionIds.map((qid, idx) => ({
        questionId: qid,
        orderIndex: idx,
      }));
    }
    return { questions };
  })
  .superRefine((data, ctx) => {
    if (!data.questions || data.questions.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one question must be selected',
        path: ['questions'],
      });
    }
  });

export const assignExamSchema = z.object({
  batch: z.string().trim().optional(),
  section: z.string().trim().optional(),
  studentIds: z.array(z.string().uuid()).optional(),
  extraTimeMinutes: z.coerce.number().int().min(0).default(0),
});

export const queryExamsSchema = z.object({
  search: z.string().optional(),
  courseId: z.string().optional(),
  courseIds: z.union([z.array(z.string().uuid()), z.string()]).optional(),
  status: z.enum(['DRAFT', 'SCHEDULED', 'LIVE', 'COMPLETED', 'CANCELLED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
