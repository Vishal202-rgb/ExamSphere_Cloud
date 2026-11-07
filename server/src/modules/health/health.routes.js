// ==============================================================================
// ExamSphere – Health Check & Probe Routes
// ==============================================================================

import { Router } from 'express';
import { getHealthStatus, getApiRoot, getLiveness, getReadiness } from './health.controller.js';

const router = Router();

router.get('/', getApiRoot);
router.get('/health', getHealthStatus);
router.get('/health/live', getLiveness);
router.get('/health/ready', getReadiness);

export default router;
