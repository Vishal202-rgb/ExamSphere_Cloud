// ==============================================================================
// ExamSphere – Invitation Zod Validation Schemas
// ==============================================================================

import { z } from 'zod';

export const createInvitationSchema = z.object({
  body: z.object({
    email: z
      .string({ required_error: 'Email is required' })
      .email('Invalid email address format')
      .toLowerCase()
      .trim(),
    name: z.string().min(2, 'Name must be at least 2 characters long').trim(),
    role: z.enum(['SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'FACULTY', 'STUDENT'], {
      required_error: 'Role is required',
    }),
    departmentId: z.string().uuid().optional().nullable(),
    employeeId: z.string().optional().nullable(),
    designation: z.string().optional().nullable(),
    rollNumber: z.string().optional().nullable(),
    batch: z.string().optional().nullable(),
    section: z.string().optional().nullable(),
    assignedCourses: z.array(z.string().uuid()).optional(),
    enrolledCourses: z.array(z.string().uuid()).optional(),
  }),
});

export const acceptInvitationSchema = z.object({
  body: z.object({
    token: z.string().min(10, 'Invitation token is required'),
    password: z
      .string({ required_error: 'Password is required' })
      .min(8, 'Password must be at least 8 characters long')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  }),
});

export const verifyInvitationTokenSchema = z.object({
  query: z.object({
    token: z.string().min(10, 'Invitation token is required'),
  }),
});
