// ==============================================================================
// ExamSphere – Authentication Zod Validation Schemas
// ==============================================================================

import { z } from 'zod';

export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .email('Invalid email address format')
    .toLowerCase()
    .trim(),
  password: z
    .string({ required_error: 'Password is required' })
    .min(6, 'Password must be at least 6 characters long'),
});

export const forgotPasswordSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .email('Invalid email address format')
    .toLowerCase()
    .trim(),
});

export const resetPasswordSchema = z.object({
  token: z
    .string({ required_error: 'Reset token is required' })
    .min(1, 'Token cannot be empty'),
  newPassword: z
    .string({ required_error: 'New password is required' })
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1).optional().nullable(),
});
