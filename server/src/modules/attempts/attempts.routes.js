// ==============================================================================
// ExamSphere – Examination Attempt & Execution Routes
// Endpoints for timer polling, answer autosaves, session recovery, and submissions
// ==============================================================================

import { Router } from 'express';
import {
  getAttemptTime,
  autosaveAnswer,
  getAttempt,
  submitAttempt,
} from './attempts.controller.js';
import {
  autosaveAnswerBodySchema,
  submitAttemptBodySchema,
} from './attempts.validation.js';
import { authenticateUser } from '../../middlewares/auth.middleware.js';
import { authorizeRoles } from '../../middlewares/rbac.middleware.js';
import { validateRequest } from '../../middlewares/validate.middleware.js';
import { submissionLimiter } from '../../middlewares/rateLimiter.middleware.js';

const router = Router();

router.use(authenticateUser);

// 1. Authoritative Timer Synchronization
// GET /api/v1/attempts/:attemptId/time
router.get(
  '/:attemptId/time',
  authorizeRoles('STUDENT', 'FACULTY', 'ADMIN'),
  getAttemptTime
);

// 2. Answer Autosave Engine (Debounced and Optimistically Versioned)
// PUT /api/v1/attempts/:attemptId/answers/:questionId
router.put(
  '/:attemptId/answers/:questionId',
  authorizeRoles('STUDENT', 'ADMIN'),
  submissionLimiter,
  validateRequest(autosaveAnswerBodySchema),
  autosaveAnswer
);

// 3. Exam Resumption & Session Recovery
// GET /api/v1/attempts/:attemptId
router.get(
  '/:attemptId',
  authorizeRoles('STUDENT', 'FACULTY', 'ADMIN'),
  getAttempt
);

// 4. Examination Submission Engine (Manual & Auto-Timeout)
// POST /api/v1/attempts/:attemptId/submit
router.post(
  '/:attemptId/submit',
  authorizeRoles('STUDENT', 'ADMIN'),
  submissionLimiter,
  validateRequest(submitAttemptBodySchema),
  submitAttempt
);

export default router;
