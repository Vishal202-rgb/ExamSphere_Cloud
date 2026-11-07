// ==============================================================================
// ExamSphere – Admin Controller & Routes
// ==============================================================================

import { Router } from 'express';
import { adminService } from './admin.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { authenticateUser } from '../../middlewares/auth.middleware.js';
import { authorizeRoles } from '../../middlewares/rbac.middleware.js';

export const getDashboardStats = asyncHandler(async (req, res) => {
  const stats = await adminService.getDashboardStats();
  return res.status(200).json(ApiResponse.success(stats, 'Admin dashboard statistics retrieved'));
});

const router = Router();

router.use(authenticateUser);
router.use(authorizeRoles('SUPER_ADMIN'));

router.get('/stats', getDashboardStats);

export default router;
