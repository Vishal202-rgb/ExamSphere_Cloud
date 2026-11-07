// ==============================================================================
// ExamSphere – Examination Routes
// ==============================================================================

import { Router } from 'express';
import {
  createExam,
  getExams,
  getExamById,
  updateExam,
  deleteExam,
  publishExam,
  cancelExam,
  addExamQuestions,
  removeExamQuestion,
  assignExam,
  getExamAssignments,
} from './exams.controller.js';
import {
  createExamSchema,
  updateExamSchema,
  addExamQuestionsSchema,
  assignExamSchema,
  queryExamsSchema,
} from './exams.validation.js';
import { startExam } from '../attempts/attempts.controller.js';
import { authenticateUser } from '../../middlewares/auth.middleware.js';
import { authorizeRoles } from '../../middlewares/rbac.middleware.js';
import { validateRequest } from '../../middlewares/validate.middleware.js';

const router = Router();

router.use(authenticateUser);

// List and Create exams (FACULTY & ADMIN)
router.get('/', authorizeRoles('FACULTY', 'ADMIN'), validateRequest(queryExamsSchema, 'query'), getExams);
router.post('/', authorizeRoles('FACULTY', 'ADMIN'), validateRequest(createExamSchema), createExam);

// Specific Exam Details (Students can view if published; Faculty/Admin can view anytime)
router.get('/:id', getExamById);

// Start / Initialize Examination Session (STUDENT & ADMIN)
router.post('/:id/start', authorizeRoles('STUDENT', 'ADMIN'), startExam);
router.post('/:examId/start', authorizeRoles('STUDENT', 'ADMIN'), startExam);

// Faculty & Admin examination management
router.put('/:id', authorizeRoles('FACULTY', 'ADMIN'), validateRequest(updateExamSchema), updateExam);
router.delete('/:id', authorizeRoles('FACULTY', 'ADMIN'), deleteExam);

// Status transitions
router.patch('/:id/publish', authorizeRoles('FACULTY', 'ADMIN'), publishExam);
router.patch('/:id/cancel', authorizeRoles('FACULTY', 'ADMIN'), cancelExam);

// Question association & removal
router.post('/:id/questions', authorizeRoles('FACULTY', 'ADMIN'), validateRequest(addExamQuestionsSchema), addExamQuestions);
router.delete('/:id/questions/:questionId', authorizeRoles('FACULTY', 'ADMIN'), removeExamQuestion);

import { getAnnouncements } from '../monitoring/monitoring.controller.js';

// Student Assignments
router.post('/:id/assign', authorizeRoles('FACULTY', 'ADMIN'), validateRequest(assignExamSchema), assignExam);
router.get('/:id/assignments', authorizeRoles('FACULTY', 'ADMIN'), getExamAssignments);

// Exam Announcements (All authenticated participants)
router.get('/:examId/announcements', getAnnouncements);

export default router;
