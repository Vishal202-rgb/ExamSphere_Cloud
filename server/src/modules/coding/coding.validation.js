// ==============================================================================
// ExamSphere – Coding Assessment Validation Schemas (Zod)
// ==============================================================================

import { z } from 'zod';

export const createCodingQuestionSchema = z.object({
  body: z.object({
    questionText: z.string().trim().min(5, 'Question text must be at least 5 characters'),
    courseId: z.string().uuid('Invalid course ID format'),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).default('MEDIUM'),
    marks: z.number().positive('Marks must be positive').default(10.0),
    negativeMarks: z.number().min(0, 'Negative marks cannot be negative').default(0.0),
    topicTags: z.array(z.string().trim()).default([]),
    explanation: z.string().trim().optional(),
    inputFormat: z.string().trim().optional(),
    outputFormat: z.string().trim().optional(),
    constraints: z.string().trim().optional(),
    allowedLanguages: z.array(z.string().trim()).default(['javascript', 'python', 'cpp', 'java']),
    starterCode: z.record(z.string()).optional(),
    timeLimitSec: z.number().positive().max(10.0).default(2.0),
    memoryLimitMb: z.number().int().positive().max(512).default(256),
    evaluationPolicy: z.enum(['ALL_TEST_CASES', 'PERCENTAGE']).default('ALL_TEST_CASES'),
    testCases: z
      .array(
        z.object({
          input: z.string().default(''),
          expectedOutput: z.string().default(''),
          isSample: z.boolean().default(false),
          explanation: z.string().optional(),
          weight: z.number().positive().default(1.0),
          orderIndex: z.number().int().default(0),
        })
      )
      .min(1, 'At least one test case is required'),
  }),
});

export const updateCodingQuestionSchema = z.object({
  params: z.object({
    questionId: z.string().uuid('Invalid question ID format'),
  }),
  body: z.object({
    questionText: z.string().trim().min(5).optional(),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']).optional(),
    marks: z.number().positive().optional(),
    negativeMarks: z.number().min(0).optional(),
    topicTags: z.array(z.string().trim()).optional(),
    explanation: z.string().trim().optional(),
    inputFormat: z.string().trim().optional(),
    outputFormat: z.string().trim().optional(),
    constraints: z.string().trim().optional(),
    allowedLanguages: z.array(z.string().trim()).optional(),
    starterCode: z.record(z.string()).optional(),
    timeLimitSec: z.number().positive().max(10.0).optional(),
    memoryLimitMb: z.number().int().positive().max(512).optional(),
    evaluationPolicy: z.enum(['ALL_TEST_CASES', 'PERCENTAGE']).optional(),
    testCases: z
      .array(
        z.object({
          input: z.string().default(''),
          expectedOutput: z.string().default(''),
          isSample: z.boolean().default(false),
          explanation: z.string().optional(),
          weight: z.number().positive().default(1.0),
          orderIndex: z.number().int().default(0),
        })
      )
      .optional(),
  }),
});

export const runSampleCodeSchema = z.object({
  body: z.object({
    questionId: z.string().uuid('Invalid question ID format'),
    sourceCode: z.string().min(1, 'Source code cannot be empty').max(65536, 'Code exceeds 64KB limit'),
    language: z.string().trim().min(1, 'Language must be specified'),
    customInput: z.string().optional(),
    attemptId: z.string().uuid().optional(),
  }),
});

export const submitSolutionSchema = z.object({
  body: z.object({
    questionId: z.string().uuid('Invalid question ID format'),
    sourceCode: z.string().min(1, 'Source code cannot be empty').max(65536, 'Code exceeds 64KB limit'),
    language: z.string().trim().min(1, 'Language must be specified'),
    attemptId: z.string().uuid().optional(),
    examId: z.string().uuid().optional(),
  }),
});

export const questionIdParamSchema = z.object({
  params: z.object({
    questionId: z.string().uuid('Invalid question ID format'),
  }),
});
