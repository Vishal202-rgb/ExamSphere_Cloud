// ==============================================================================
// ExamSphere – Centralized Error Handling Middleware
// Formats all errors into a consistent JSON envelope
// ==============================================================================

import { ApiError } from '../utils/apiError.js';
import { env } from '../config/env.js';
import { ZodError } from 'zod';

export const errorHandler = (err, req, res, next) => {
  let error = err;

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const issues = err.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    error = new ApiError(422, 'Validation failed', issues);
  }

  // Handle Prisma Known Request Errors
  if (err.code && typeof err.code === 'string' && err.code.startsWith('P')) {
    if (err.code === 'P2002') {
      const target = err.meta?.target || 'field';
      error = new ApiError(409, `Unique constraint violation on ${target}`);
    } else if (err.code === 'P2025') {
      error = new ApiError(404, 'Record not found');
    } else {
      error = new ApiError(400, `Database error: [${err.code}]`);
    }
  }

  // Handle JWT verification errors
  if (err.name === 'JsonWebTokenError') {
    error = new ApiError(401, 'Invalid authentication token');
  } else if (err.name === 'TokenExpiredError') {
    error = new ApiError(401, 'Authentication token has expired');
  }

  // Fallback for non-operational / standard errors
  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal Server Error';
    error = new ApiError(statusCode, message, [], err.stack);
  }

  const response = {
    success: false,
    statusCode: error.statusCode,
    message: error.message,
    errors: error.errors || [],
    ...(env.NODE_ENV === 'development' && { stack: error.stack }),
    timestamp: new Date().toISOString(),
  };

  // Log error in development or 500 in production
  if (env.NODE_ENV === 'development' || error.statusCode >= 500) {
    console.error(`❌ [${req.method} ${req.originalUrl}] - Status: ${error.statusCode} - ${error.message}`);
  }

  res.status(error.statusCode).json(response);
};
