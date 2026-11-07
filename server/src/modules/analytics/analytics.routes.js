// ==============================================================================
// ExamSphere – Analytics & Reporting Express Route Pipeline
// ==============================================================================

import { Router } from 'express';
import {
  getAdminOverview,
  getFacultyOverview,
  getFacultyExamAnalytics,
  getStudentOverview,
  getStudentPerformanceTrend,
  exportDepartmentSummary,
  exportExamQuestionAnalysis,
  exportFacultyExamReport,
  exportStudentPerformance,
} from './analytics.controller.js';
import {
  adminOverviewQuerySchema,
  facultyOverviewQuerySchema,
  examIdParamSchema,
  studentExportParamSchema,
} from './analytics.validation.js';
import { authenticateUser } from '../../middlewares/auth.middleware.js';
import { authorizeRoles } from '../../middlewares/rbac.middleware.js';
import { validateRequest } from '../../middlewares/validate.middleware.js';

const router = Router();

// All analytics routes require authenticated session
router.use(authenticateUser);

// ------------------------------------------------------------------------------
// Admin Analytics Endpoints
// ------------------------------------------------------------------------------
router.get(
  '/admin/overview',
  authorizeRoles('ADMIN'),
  validateRequest(adminOverviewQuerySchema),
  getAdminOverview
);

// ------------------------------------------------------------------------------
// Faculty Analytics Endpoints
// ------------------------------------------------------------------------------
router.get(
  '/faculty/overview',
  authorizeRoles('FACULTY', 'ADMIN'),
  validateRequest(facultyOverviewQuerySchema),
  getFacultyOverview
);

router.get(
  '/faculty/exams/:examId',
  authorizeRoles('FACULTY', 'ADMIN'),
  validateRequest(examIdParamSchema),
  getFacultyExamAnalytics
);

// ------------------------------------------------------------------------------
// Student Analytics Endpoints (Strictly Current Logged-in Student)
// ------------------------------------------------------------------------------
router.get(
  '/student/overview',
  authorizeRoles('STUDENT'),
  getStudentOverview
);

router.get(
  '/student/performance-trend',
  authorizeRoles('STUDENT'),
  getStudentPerformanceTrend
);

// ------------------------------------------------------------------------------
// Report Generation & Export Endpoints (CSV)
// ------------------------------------------------------------------------------
router.get(
  '/reports/department-summary',
  authorizeRoles('ADMIN'),
  exportDepartmentSummary
);

router.get(
  '/reports/question-analysis/:examId',
  authorizeRoles('FACULTY', 'ADMIN'),
  validateRequest(examIdParamSchema),
  exportExamQuestionAnalysis
);

router.get(
  '/reports/faculty-exam-summary/:examId',
  authorizeRoles('FACULTY', 'ADMIN'),
  validateRequest(examIdParamSchema),
  exportFacultyExamReport
);

router.get(
  '/reports/student-performance/:studentId?',
  authorizeRoles('STUDENT', 'FACULTY', 'ADMIN'),
  validateRequest(studentExportParamSchema),
  exportStudentPerformance
);

export default router;
