// ==============================================================================
// ExamSphere – Department Validation Schemas
// ==============================================================================

import { z } from 'zod';

export const createDepartmentSchema = z.object({
  name: z
    .string({ required_error: 'Department name is required' })
    .min(3, 'Department name must be at least 3 characters long')
    .trim(),
  code: z
    .string({ required_error: 'Department code is required' })
    .min(2, 'Code must be at least 2 characters')
    .max(10, 'Code cannot exceed 10 characters')
    .toUpperCase()
    .trim(),
  description: z.string().optional().nullable(),
});

export const updateDepartmentSchema = z.object({
  name: z.string().min(3).trim().optional(),
  code: z.string().min(2).max(10).toUpperCase().trim().optional(),
  description: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});
