// ==============================================================================
// ExamSphere – Question Bank Validation Schemas
// ==============================================================================

import { z } from 'zod';

const optionSchema = z.object({
  id: z.string().uuid().optional(),
  optionText: z.string({ required_error: 'Option text is required' }).min(1, 'Option text cannot be empty').trim(),
  isCorrect: z.boolean().default(false),
  orderIndex: z.number().int().default(0),
});

export const createQuestionSchema = z
  .object({
    questionText: z.string().trim().optional(),
    title: z.string().trim().optional(),
    type: z.enum(['SINGLE_MCQ', 'MULTIPLE_MCQ', 'TRUE_FALSE', 'DESCRIPTIVE', 'CODING'], {
      required_error: 'Question type is required',
    }),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).default('MEDIUM'),
    marks: z.coerce.number().positive('Marks must be a positive number').default(1.0),
    negativeMarks: z.coerce.number().min(0, 'Negative marks cannot be negative').default(0.0),
    courseId: z.string({ required_error: 'Course ID is required' }).uuid('Invalid Course ID format'),
    topicTags: z
      .union([
        z.array(z.string().trim()),
        z.string().trim().transform((val) => (val ? val.split(',').map((t) => t.trim()).filter(Boolean) : [])),
      ])
      .default([]),
    topic: z.string().trim().optional(),
    description: z.string().trim().optional(),
    explanation: z.string().optional().nullable(),
    options: z.array(optionSchema).default([]),
  })
  .transform((data) => {
    // Resolve questionText from questionText or title
    const resolvedQuestionText = (data.questionText || data.title || '').trim();
    // Resolve topicTags from topicTags or topic
    let resolvedTopicTags = Array.isArray(data.topicTags) ? data.topicTags : [];
    if (resolvedTopicTags.length === 0 && data.topic) {
      resolvedTopicTags = data.topic.split(',').map((t) => t.trim()).filter(Boolean);
    }
    return {
      ...data,
      questionText: resolvedQuestionText,
      topicTags: resolvedTopicTags,
    };
  })
  .superRefine((data, ctx) => {
    const { type, options, questionText } = data;

    if (!questionText || questionText.length < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Question text must be at least 3 characters',
        path: ['questionText'],
      });
    }

    if (type === 'SINGLE_MCQ') {
      if (!options || options.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Single-choice MCQ must have at least 2 options',
          path: ['options'],
        });
      }
      const correctCount = options ? options.filter((o) => o.isCorrect).length : 0;
      if (correctCount !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Single-choice MCQ must have exactly one correct option',
          path: ['options'],
        });
      }
    } else if (type === 'MULTIPLE_MCQ') {
      if (!options || options.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Multiple-choice MCQ must have at least 2 options',
          path: ['options'],
        });
      }
      const correctCount = options ? options.filter((o) => o.isCorrect).length : 0;
      if (correctCount < 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Multiple-choice MCQ must have at least one correct option',
          path: ['options'],
        });
      }
    } else if (type === 'TRUE_FALSE') {
      if (!options || options.length !== 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'True/False question must contain exactly two options (True and False)',
          path: ['options'],
        });
      }
      const correctCount = options ? options.filter((o) => o.isCorrect).length : 0;
      if (correctCount !== 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'True/False question must have exactly one correct option designated',
          path: ['options'],
        });
      }
    }
    // DESCRIPTIVE & CODING questions do not require options
  });

export const updateQuestionSchema = z
  .object({
    questionText: z.string().min(3).trim().optional(),
    title: z.string().min(3).trim().optional(),
    type: z.enum(['SINGLE_MCQ', 'MULTIPLE_MCQ', 'TRUE_FALSE', 'DESCRIPTIVE', 'CODING']).optional(),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
    marks: z.coerce.number().positive().optional(),
    negativeMarks: z.coerce.number().min(0).optional(),
    courseId: z.string().uuid().optional(),
    topicTags: z
      .union([
        z.array(z.string().trim()),
        z.string().trim().transform((val) => (val ? val.split(',').map((t) => t.trim()).filter(Boolean) : [])),
      ])
      .optional(),
    topic: z.string().trim().optional(),
    description: z.string().trim().optional(),
    explanation: z.string().optional().nullable(),
    isActive: z.boolean().optional(),
    options: z.array(optionSchema).optional(),
  })
  .transform((data) => {
    const questionText = data.questionText || data.title;
    let topicTags = data.topicTags;
    if (!topicTags && data.topic) {
      topicTags = data.topic.split(',').map((t) => t.trim()).filter(Boolean);
    }
    return {
      ...data,
      ...(questionText ? { questionText } : {}),
      ...(topicTags ? { topicTags } : {}),
    };
  })
  .superRefine((data, ctx) => {
    if (data.type && data.options) {
      const { type, options } = data;
      if (type === 'SINGLE_MCQ') {
        if (options.length < 2) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Single-choice MCQ must have at least 2 options',
            path: ['options'],
          });
        }
        const correctCount = options.filter((o) => o.isCorrect).length;
        if (correctCount !== 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Single-choice MCQ must have exactly one correct option',
            path: ['options'],
          });
        }
      } else if (type === 'MULTIPLE_MCQ') {
        if (options.length < 2) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Multiple-choice MCQ must have at least 2 options',
            path: ['options'],
          });
        }
        const correctCount = options.filter((o) => o.isCorrect).length;
        if (correctCount < 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Multiple-choice MCQ must have at least one correct option',
            path: ['options'],
          });
        }
      } else if (type === 'TRUE_FALSE') {
        if (options.length !== 2) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'True/False question must contain exactly two options',
            path: ['options'],
          });
        }
        const correctCount = options.filter((o) => o.isCorrect).length;
        if (correctCount !== 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'True/False question must have exactly one correct option',
            path: ['options'],
          });
        }
      }
    }
  });

export const queryQuestionsSchema = z.object({
  search: z.string().optional(),
  courseId: z.string().optional(),
  courseIds: z
    .union([
      z.array(z.string()),
      z.string().transform((val) => (val ? val.split(',').map((t) => t.trim()).filter(Boolean) : [])),
    ])
    .optional(),
  type: z.enum(['SINGLE_MCQ', 'MULTIPLE_MCQ', 'TRUE_FALSE', 'DESCRIPTIVE', 'CODING']).optional(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(500).default(10),
});
