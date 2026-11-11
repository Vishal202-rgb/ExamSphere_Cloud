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

// Super Admin-only department registration and deletion
router.post(
  '/',
  authenticateUser,
  authorizeRoles('SUPER_ADMIN'),
  validateRequest(createDepartmentSchema),
  createDepartment
);

router.delete('/:id', authenticateUser, authorizeRoles('SUPER_ADMIN'), deleteDepartment);

// Super Admin or Department Admin (scoped to assigned department)
router.put(
  '/:id',
  authenticateUser,
  authorizeRoles('SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'ADMIN'),
  validateRequest(updateDepartmentSchema),
  updateDepartment
);

export default router;
