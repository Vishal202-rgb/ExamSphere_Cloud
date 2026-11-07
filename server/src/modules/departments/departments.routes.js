// ==============================================================================
// ExamSphere – Department Routes
// ==============================================================================

import { Router } from 'express';
import {
  getDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from './departments.controller.js';
import {
  createDepartmentSchema,
  updateDepartmentSchema,
} from './departments.validation.js';
import { authenticateUser } from '../../middlewares/auth.middleware.js';
import { authorizeRoles } from '../../middlewares/rbac.middleware.js';
import { validateRequest } from '../../middlewares/validate.middleware.js';

const router = Router();

// Public/Authenticated read access
router.get('/', authenticateUser, getDepartments);
router.get('/:id', authenticateUser, getDepartmentById);

// Admin-only write access
router.post(
  '/',
  authenticateUser,
  authorizeRoles('ADMIN'),
  validateRequest(createDepartmentSchema),
  createDepartment
);

router.put(
  '/:id',
  authenticateUser,
  authorizeRoles('ADMIN'),
  validateRequest(updateDepartmentSchema),
  updateDepartment
);

router.delete('/:id', authenticateUser, authorizeRoles('ADMIN'), deleteDepartment);

export default router;
