// ==============================================================================
// ExamSphere – Centralized Error Handling Middleware
// Formats all errors into a consistent, secure JSON envelope with request tracing
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
      const msg = env.NODE_ENV === 'production'
        ? 'A unique constraint was violated. A record with this information already exists.'
        : `Unique constraint violation on ${target}`;
      error = new ApiError(409, msg);
    } else if (err.code === 'P2025') {
      error = new ApiError(404, 'Requested record was not found');
    } else {
      const msg = env.NODE_ENV === 'production'
        ? 'A database error occurred while processing the request'
        : `Database error: [${err.code}]`;
      error = new ApiError(400, msg);
    }
  }

  // Handle JWT verification errors
  if (err.name === 'JsonWebTokenError') {
    error = new ApiError(401, 'Invalid authentication token');
  } else if (err.name === 'TokenExpiredError') {
    error = new ApiError(401, 'Authentication token has expired');
  }

  // Fallback for non-operational / standard unexpected errors
  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500;
    const message = env.NODE_ENV === 'production' && statusCode >= 500
      ? 'An unexpected internal error occurred'
      : (error.message || 'Internal Server Error');
    error = new ApiError(statusCode, message, [], err.stack);
  }

  const response = {
    success: false,
    statusCode: error.statusCode,
    message: error.message,
    errors: error.errors || [],
    requestId: req.id || req.headers?.['x-request-id'] || null,
    ...(env.NODE_ENV === 'development' && { stack: error.stack }),
    timestamp: new Date().toISOString(),
  };

  // Structured logging for errors
  if (env.NODE_ENV === 'development' || error.statusCode >= 500) {
    console.error(
      `❌ [${req.method} ${req.originalUrl}] [ReqID: ${response.requestId}] Status: ${error.statusCode} - ${error.message}`
    );
    if (error.statusCode >= 500 && err.stack) {
      console.error(err.stack);
    }
  }

  res.status(error.statusCode).json(response);
};
