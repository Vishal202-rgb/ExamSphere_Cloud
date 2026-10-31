// ==============================================================================
// ExamSphere – Health Check Routes
// ==============================================================================

import { Router } from 'express';
import { getHealthStatus, getApiRoot } from './health.controller.js';

const router = Router();

router.get('/', getApiRoot);
router.get('/health', getHealthStatus);

export default router;
