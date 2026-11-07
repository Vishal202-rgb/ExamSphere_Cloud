// ==============================================================================
// ExamSphere – User Management Validation Schemas
// ==============================================================================

import { z } from 'zod';

export const createFacultySchema = z.object({
  name: z.string({ required_error: 'Name is required' }).min(2).trim(),
  email: z.string({ required_error: 'Email is required' }).email().toLowerCase().trim(),
  password: z.string().min(6).default('Faculty@12345'),
  departmentId: z.string().uuid().optional().nullable(),
});

export const createStudentSchema = z.object({
  name: z.string({ required_error: 'Name is required' }).min(2).trim(),
  email: z.string({ required_error: 'Email is required' }).email().toLowerCase().trim(),
  password: z.string().min(6).default('Student@12345'),
  departmentId: z.string().uuid().optional().nullable(),
  rollNumber: z.string({ required_error: 'Roll number is required' }).trim(),
  batch: z.string({ required_error: 'Batch is required' }).trim(), // e.g. "2023-2027"
  section: z.string({ required_error: 'Section is required' }).trim(), // e.g. "A"
});

export const updateUserSchema = z.object({
  name: z.string().min(2).trim().optional(),
  email: z.string().email().toLowerCase().trim().optional(),
  departmentId: z.string().uuid().optional().nullable(),
  rollNumber: z.string().trim().optional().nullable(),
  batch: z.string().trim().optional().nullable(),
  section: z.string().trim().optional().nullable(),
  isActive: z.boolean().optional(),
});

export const toggleStatusSchema = z.object({
  isActive: z.boolean({ required_error: 'isActive boolean flag is required' }),
});
