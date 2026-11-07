// ==============================================================================
// ExamSphere – Proctoring Telemetry Express Route Pipeline
// ==============================================================================

import { Router } from 'express';
import { recordEvent, getAttemptTimeline } from './proctoring.controller.js';
import { recordEventSchema, attemptIdParamSchema } from './proctoring.validation.js';
import { authenticateUser } from '../../middlewares/auth.middleware.js';
import { authorizeRoles } from '../../middlewares/rbac.middleware.js';
import { validateRequest } from '../../middlewares/validate.middleware.js';

const router = Router();

router.use(authenticateUser);

// Candidate activity telemetry recording
router.post(
  '/events',
  authorizeRoles('STUDENT'),
  validateRequest(recordEventSchema),
  recordEvent
);

// Faculty timeline inspection
router.get(
  '/attempts/:attemptId',
  authorizeRoles('FACULTY', 'ADMIN'),
  validateRequest(attemptIdParamSchema),
  getAttemptTimeline
);

export default router;
