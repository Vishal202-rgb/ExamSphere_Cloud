// ==============================================================================
// ExamSphere – Course Routes
// ==============================================================================

import { Router } from 'express';
import {
  getCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
  assignFaculty,
  removeFaculty,
} from './courses.controller.js';
import {
  createCourseSchema,
  updateCourseSchema,
  assignFacultySchema,
} from './courses.validation.js';
import { authenticateUser } from '../../middlewares/auth.middleware.js';
import { authorizeRoles } from '../../middlewares/rbac.middleware.js';
import { validateRequest } from '../../middlewares/validate.middleware.js';

const router = Router();

// Read courses
router.get('/', authenticateUser, getCourses);
router.get('/:id', authenticateUser, getCourseById);

// Admin-only management
router.post(
  '/',
  authenticateUser,
  authorizeRoles('ADMIN'),
  validateRequest(createCourseSchema),
  createCourse
);

router.put(
  '/:id',
  authenticateUser,
  authorizeRoles('ADMIN'),
  validateRequest(updateCourseSchema),
  updateCourse
);

router.delete('/:id', authenticateUser, authorizeRoles('ADMIN'), deleteCourse);

// Faculty assignment
router.post(
  '/:id/faculty',
  authenticateUser,
  authorizeRoles('ADMIN'),
  validateRequest(assignFacultySchema),
  assignFaculty
);

router.delete(
  '/:id/faculty/:facultyId',
  authenticateUser,
  authorizeRoles('ADMIN'),
  removeFaculty
);

export default router;
