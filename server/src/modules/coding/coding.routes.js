// ==============================================================================
// ExamSphere – Coding Assessment Express Route Pipeline
// ==============================================================================

import { Router } from 'express';
import {
  createCodingQuestion,
  updateCodingQuestion,
  getCodingQuestion,
  runSampleCode,
  submitSolution,
  getSubmissions,
} from './coding.controller.js';
import {
  createCodingQuestionSchema,
  updateCodingQuestionSchema,
  runSampleCodeSchema,
  submitSolutionSchema,
  questionIdParamSchema,
} from './coding.validation.js';
import { authenticateUser } from '../../middlewares/auth.middleware.js';
import { authorizeRoles } from '../../middlewares/rbac.middleware.js';
import { validateRequest } from '../../middlewares/validate.middleware.js';
import { codingExecutionLimiter } from '../../middlewares/rateLimiter.middleware.js';

const router = Router();

router.use(authenticateUser);

// ------------------------------------------------------------------------------
// Question Authoring & Inspection
// ------------------------------------------------------------------------------
router.post(
  '/questions',
  authorizeRoles('FACULTY', 'ADMIN'),
  validateRequest(createCodingQuestionSchema),
  createCodingQuestion
);

router.put(
  '/questions/:questionId',
  authorizeRoles('FACULTY', 'ADMIN'),
  validateRequest(updateCodingQuestionSchema),
  updateCodingQuestion
);

router.get(
  '/questions/:questionId',
  authorizeRoles('STUDENT', 'FACULTY', 'ADMIN'),
  validateRequest(questionIdParamSchema),
  getCodingQuestion
);

// ------------------------------------------------------------------------------
// Student Code Execution & Submission (Rate-Limited)
// ------------------------------------------------------------------------------
router.post(
  '/run',
  authorizeRoles('STUDENT', 'FACULTY', 'ADMIN'),
  codingExecutionLimiter,
  validateRequest(runSampleCodeSchema),
  runSampleCode
);

router.post(
  '/submissions',
  authorizeRoles('STUDENT'),
  codingExecutionLimiter,
  validateRequest(submitSolutionSchema),
  submitSolution
);

router.get(
  '/questions/:questionId/submissions',
  authorizeRoles('STUDENT', 'FACULTY', 'ADMIN'),
  validateRequest(questionIdParamSchema),
  getSubmissions
);

export default router;
