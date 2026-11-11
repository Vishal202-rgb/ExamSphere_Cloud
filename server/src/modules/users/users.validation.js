// ==============================================================================
// ExamSphere – User Management Validation Schemas
// ==============================================================================

import { z } from 'zod';

export const createDepartmentAdminSchema = z.object({
  body: z.object({
    name: z.string({ required_error: 'Name is required' }).min(2).trim(),
    email: z.string({ required_error: 'Email is required' }).email().toLowerCase().trim(),
    departmentId: z.string({ required_error: 'Department ID is required' }).uuid(),
    employeeId: z.string().optional().nullable(),
    designation: z.string().optional().nullable(),
    password: z.string().min(8).optional(),
  }),
});

export const createFacultySchema = z.object({
  body: z.object({
    name: z.string({ required_error: 'Name is required' }).min(2).trim(),
    email: z.string({ required_error: 'Email is required' }).email().toLowerCase().trim(),
    departmentId: z.string().uuid().optional().nullable(),
    employeeId: z.string().optional().nullable(),
    designation: z.string().optional().nullable(),
    assignedCourses: z.array(z.string().uuid()).optional(),
    password: z.string().min(8).optional(),
  }),
});

export const createStudentSchema = z.object({
  body: z.object({
    name: z.string({ required_error: 'Name is required' }).min(2).trim(),
    email: z.string({ required_error: 'Email is required' }).email().toLowerCase().trim(),
    departmentId: z.string().uuid().optional().nullable(),
    rollNumber: z.string({ required_error: 'Roll number is required' }).trim(),
    batch: z.string({ required_error: 'Batch is required' }).trim(), // e.g. "2023-2027"
    section: z.string({ required_error: 'Section is required' }).trim(), // e.g. "A"
    enrolledCourses: z.array(z.string().uuid()).optional(),
    password: z.string().min(8).optional(),
  }),
});

export const updateUserSchema = z.object({
  body: z.object({
    name: z.string().min(2).trim().optional(),
    email: z.string().email().toLowerCase().trim().optional(),
    departmentId: z.string().uuid().optional().nullable(),
    employeeId: z.string().trim().optional().nullable(),
    designation: z.string().trim().optional().nullable(),
    rollNumber: z.string().trim().optional().nullable(),
    batch: z.string().trim().optional().nullable(),
    section: z.string().trim().optional().nullable(),
    isActive: z.boolean().optional(),
    role: z.enum(['SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'ADMIN', 'FACULTY', 'STUDENT']).optional(),
  }),
});

export const toggleStatusSchema = z.object({
  body: z.object({
    isActive: z.boolean({ required_error: 'isActive boolean flag is required' }),
  }),
});
