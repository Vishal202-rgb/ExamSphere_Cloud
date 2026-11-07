// ==============================================================================
// ExamSphere – Rate Limiting Middleware
// Brute-force protection, API flooding prevention, and execution throttling
// ==============================================================================

import rateLimit from 'express-rate-limit';
import { ApiError } from '../utils/apiError.js';

/**
 * General API Limiter: 600 requests per 15 minutes per IP
 */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(
      new ApiError(
        429,
        'Too many requests from this IP. Please slow down and try again later.'
      )
    );
  },
});

/**
 * Authentication Limiter: 20 login/refresh attempts per 15 minutes per IP
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(
      new ApiError(
        429,
        'Too many authentication attempts from this IP. Please try again after 15 minutes.'
      )
    );
  },
});

/**
 * Password Reset Limiter: 5 requests per hour per IP
 */
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(
      new ApiError(
        429,
        'Too many password reset requests. Please try again after an hour.'
      )
    );
  },
});

/**
 * Examination Submission & Autosave Limiter: 60 actions per minute per IP
 */
export const submissionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(
      new ApiError(
        429,
        'Too many examination submission or autosave requests. Please wait a moment.'
      )
    );
  },
});

/**
 * Code Execution Limiter: 20 runs per minute per IP
 * Protects remote execution containers from excessive workload
 */
export const codingExecutionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => {
    next(
      new ApiError(
        429,
        'Code execution rate limit exceeded. Please wait before running code again.'
      )
    );
  },
});
