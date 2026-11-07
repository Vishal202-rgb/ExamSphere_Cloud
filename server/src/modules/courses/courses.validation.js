// ==============================================================================
// ExamSphere – Course Validation Schemas
// ==============================================================================

import { z } from 'zod';

export const createCourseSchema = z.object({
  code: z
    .string({ required_error: 'Course code is required' })
    .min(2, 'Course code must be at least 2 characters')
    .max(12, 'Course code cannot exceed 12 characters')
    .toUpperCase()
    .trim(),
  title: z
    .string({ required_error: 'Course title is required' })
    .min(3, 'Course title must be at least 3 characters')
    .trim(),
  description: z.string().optional().nullable(),
  credits: z.coerce.number().int().min(1).max(10).default(3),
  departmentId: z.string({ required_error: 'Department ID is required' }).uuid('Invalid Department ID'),
});

export const updateCourseSchema = z.object({
  code: z.string().min(2).max(12).toUpperCase().trim().optional(),
  title: z.string().min(3).trim().optional(),
  description: z.string().optional().nullable(),
  credits: z.coerce.number().int().min(1).max(10).optional(),
  departmentId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
});

export const assignFacultySchema = z.object({
  facultyId: z.string({ required_error: 'Faculty ID is required' }).uuid('Invalid Faculty ID'),
  isCoordinator: z.boolean().default(false),
});
