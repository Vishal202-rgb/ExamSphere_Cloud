// ==============================================================================
// ExamSphere – Super Admin Request Validation Schemas
// ==============================================================================

import { z } from 'zod';

export const promoteSuperAdminSchema = z.object({
  body: z.object({
    userId: z.string().uuid({ message: 'A valid user ID is required' }),
    verificationPassword: z
      .string()
      .min(1, { message: 'Current Super Admin password is required for verification' }),
  }),
});

export const demoteSuperAdminSchema = z.object({
  body: z.object({
    userId: z.string().uuid({ message: 'A valid user ID is required' }),
    targetRole: z.enum(['DEPARTMENT_ADMIN', 'FACULTY'], {
      message: 'Target role must be DEPARTMENT_ADMIN or FACULTY',
    }),
    departmentId: z.string().uuid().optional().nullable(),
    verificationPassword: z
      .string()
      .min(1, { message: 'Current Super Admin password is required for verification' }),
  }),
});

export const toggleSuperAdminStatusSchema = z.object({
  body: z.object({
    isActive: z.boolean({ message: 'Account status (true/false) is required' }),
    verificationPassword: z
      .string()
      .min(1, { message: 'Current Super Admin password is required for verification' }),
  }),
});

export const verifyActionSchema = z.object({
  body: z.object({
    verificationPassword: z
      .string()
      .min(1, { message: 'Super Admin password is required for sensitive operation verification' }),
  }),
});
