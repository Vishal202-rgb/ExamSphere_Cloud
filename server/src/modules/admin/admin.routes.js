// ==============================================================================
// ExamSphere – Admin Controller & Routes
// ==============================================================================

import { Router } from 'express';
import { adminService } from './admin.service.js';
import {
  listSuperAdmins,
  promoteToSuperAdmin,
  demoteSuperAdmin,
  toggleSuperAdminStatus,
  verifyAction,
} from './superadmin.controller.js';
import {
  promoteSuperAdminSchema,
  demoteSuperAdminSchema,
  toggleSuperAdminStatusSchema,
  verifyActionSchema,
} from './superadmin.validation.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { authenticateUser } from '../../middlewares/auth.middleware.js';
import { authorizeRoles } from '../../middlewares/rbac.middleware.js';
import { validateRequest } from '../../middlewares/validate.middleware.js';

export const getDashboardStats = asyncHandler(async (req, res) => {
  const stats = await adminService.getDashboardStats();
  return res.status(200).json(ApiResponse.success(stats, 'Admin dashboard statistics retrieved'));
});

const router = Router();

// Strict Super Admin protection on all routes in this router
router.use(authenticateUser);
router.use(authorizeRoles('SUPER_ADMIN'));

router.get('/stats', getDashboardStats);

// Super Admin Governance Endpoints
router.get('/super-admins', listSuperAdmins);
router.post('/super-admins/promote', validateRequest(promoteSuperAdminSchema), promoteToSuperAdmin);
router.post('/super-admins/demote', validateRequest(demoteSuperAdminSchema), demoteSuperAdmin);
router.patch('/super-admins/:id/status', validateRequest(toggleSuperAdminStatusSchema), toggleSuperAdminStatus);
router.post('/super-admins/verify-action', validateRequest(verifyActionSchema), verifyAction);

export default router;
