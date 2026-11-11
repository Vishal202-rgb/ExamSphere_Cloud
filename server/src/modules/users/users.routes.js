// ==============================================================================
// ExamSphere – User Management Routes
// ==============================================================================

import { Router } from 'express';
import multer from 'multer';
import {
  getUsers,
  getUserById,
  createDepartmentAdmin,
  createFaculty,
  createStudent,
  updateUser,
  toggleAccountStatus,
  bulkImportStudents,
  exportStudents,
} from './users.controller.js';
import {
  createDepartmentAdminSchema,
  createFacultySchema,
  createStudentSchema,
  updateUserSchema,
  toggleStatusSchema,
} from './users.validation.js';
import { authenticateUser } from '../../middlewares/auth.middleware.js';
import { authorizeRoles } from '../../middlewares/rbac.middleware.js';
import { validateRequest } from '../../middlewares/validate.middleware.js';

// Multer memory storage configuration for CSV file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
});

const router = Router();

// Base protection: Super Admins and Department Admins
router.use(authenticateUser);
router.use(authorizeRoles('SUPER_ADMIN', 'DEPARTMENT_ADMIN', 'ADMIN'));

router.get('/', getUsers);
router.get('/students/export', exportStudents);
router.get('/faculty', (req, res, next) => {
  req.query.role = 'FACULTY';
  return getUsers(req, res, next);
});
router.get('/students', (req, res, next) => {
  req.query.role = 'STUDENT';
  return getUsers(req, res, next);
});
router.get('/:id', getUserById);

// Super Admin Only: Provision Department Administrators
router.post(
  '/department-admins',
  authorizeRoles('SUPER_ADMIN'),
  validateRequest(createDepartmentAdminSchema),
  createDepartmentAdmin
);

// Department Admins and Super Admins: Provision Faculty & Students
router.post('/faculty', validateRequest(createFacultySchema), createFaculty);
router.post('/students', validateRequest(createStudentSchema), createStudent);
router.post('/students/bulk-import', upload.single('file'), bulkImportStudents);

router.put('/:id', validateRequest(updateUserSchema), updateUser);
router.patch('/:id/status', validateRequest(toggleStatusSchema), toggleAccountStatus);

export default router;
