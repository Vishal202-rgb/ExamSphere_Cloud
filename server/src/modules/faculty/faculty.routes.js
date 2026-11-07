// ==============================================================================
// ExamSphere – Faculty Features Controller & Routes
// ==============================================================================

import { Router } from 'express';
import { prisma } from '../../config/db.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { ApiError } from '../../utils/apiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { authenticateUser } from '../../middlewares/auth.middleware.js';
import { authorizeRoles } from '../../middlewares/rbac.middleware.js';

// Get courses assigned to current faculty
export const getMyCourses = asyncHandler(async (req, res) => {
  const facultyId = req.user.id;

  const assignments = await prisma.courseFaculty.findMany({
    where: { facultyId },
    include: {
      course: {
        include: {
          department: { select: { id: true, name: true, code: true } },
          _count: { select: { enrolledStudents: true, questions: true, exams: true } },
        },
      },
    },
  });

  const courses = assignments.map((a) => ({
    ...a.course,
    isCoordinator: a.isCoordinator,
    assignedAt: a.assignedAt,
  }));

  return res.status(200).json(ApiResponse.success(courses, 'Assigned courses retrieved'));
});

// Get students enrolled in a specific course
export const getCourseStudents = asyncHandler(async (req, res) => {
  const facultyId = req.user.id;
  const { courseId } = req.params;

  // Verify faculty teaches this course (or user is admin)
  if (req.user.role === 'FACULTY') {
    const teaches = await prisma.courseFaculty.findUnique({
      where: {
        courseId_facultyId: { courseId, facultyId },
      },
    });
    if (!teaches) {
      throw ApiError.forbidden('You are not assigned to instruct this course');
    }
  }

  const enrollments = await prisma.studentEnrollment.findMany({
    where: { courseId },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          rollNumber: true,
          batch: true,
          section: true,
          isActive: true,
        },
      },
    },
    orderBy: { student: { rollNumber: 'asc' } },
  });

  const students = enrollments.map((e) => ({
    ...e.student,
    enrollmentStatus: e.status,
    enrolledAt: e.enrolledAt,
  }));

  return res.status(200).json(ApiResponse.success(students, 'Enrolled students retrieved'));
});

// Get all students enrolled across faculty's assigned courses
export const getMyStudents = asyncHandler(async (req, res) => {
  const facultyId = req.user.id;

  const assignments = await prisma.courseFaculty.findMany({
    where: { facultyId },
    select: { courseId: true },
  });

  const authorizedCourseIds = assignments.map((a) => a.courseId);

  let targetCourseIds = authorizedCourseIds;
  const queryCourseIds = req.query.courseIds || req.query.courseId;
  if (queryCourseIds) {
    const requested = (Array.isArray(queryCourseIds) ? queryCourseIds : queryCourseIds.split(','))
      .map((id) => id.trim())
      .filter(Boolean);
    if (requested.length > 0) {
      targetCourseIds = requested.filter((id) => authorizedCourseIds.includes(id));
    }
  }

  const enrollments = await prisma.studentEnrollment.findMany({
    where: { courseId: { in: targetCourseIds } },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          rollNumber: true,
          batch: true,
          section: true,
          isActive: true,
          department: {
            select: { id: true, name: true, code: true },
          },
        },
      },
      course: {
        select: { id: true, code: true, title: true },
      },
    },
    orderBy: { student: { rollNumber: 'asc' } },
  });

  // Deduplicate students across multiple courses
  const studentMap = new Map();
  for (const e of enrollments) {
    if (!studentMap.has(e.student.id)) {
      studentMap.set(e.student.id, {
        ...e.student,
        fullName: e.student.name,
        department: e.student.department?.name || e.student.department?.code || null,
        courses: [e.course.code],
        courseIds: [e.course.id],
      });
    } else {
      const existing = studentMap.get(e.student.id);
      if (!existing.courses.includes(e.course.code)) {
        existing.courses.push(e.course.code);
      }
      if (!existing.courseIds.includes(e.course.id)) {
        existing.courseIds.push(e.course.id);
      }
    }
  }

  const students = Array.from(studentMap.values());
  return res.status(200).json(ApiResponse.success(students, 'Faculty students retrieved'));
});

// Get examinations authored or assigned to faculty
export const getMyExams = asyncHandler(async (req, res) => {
  const facultyId = req.user.id;

  // Faculty can view exams in their assigned courses or created by them
  const assignments = await prisma.courseFaculty.findMany({
    where: { facultyId },
    select: { courseId: true },
  });
  const courseIds = assignments.map((a) => a.courseId);

  const exams = await prisma.exam.findMany({
    where: {
      OR: [
        { createdById: facultyId },
        { courseId: { in: courseIds } },
        { courses: { some: { courseId: { in: courseIds } } } },
      ],
    },
    include: {
      course: { select: { id: true, code: true, title: true } },
      courses: {
        include: {
          course: { select: { id: true, code: true, title: true } },
        },
      },
      _count: { select: { examQuestions: true, assignments: true, attempts: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return res.status(200).json(ApiResponse.success(exams, 'Faculty exams retrieved'));
});

import {
  getExamSubmissions,
  getAttemptForFaculty,
  evaluateAttemptAnswers,
  finalizeAttempt,
  publishResults,
  exportResults,
} from '../evaluation/evaluation.controller.js';
import {
  getLiveMonitoring,
  broadcastAnnouncement,
} from '../monitoring/monitoring.controller.js';

const router = Router();

router.use(authenticateUser);
router.use(authorizeRoles('FACULTY', 'ADMIN'));

router.get('/courses', getMyCourses);
router.get('/courses/:courseId/students', getCourseStudents);
router.get('/students', getMyStudents);
router.get('/exams', getMyExams);

// Phase 10: Evaluation & Result Management Endpoints
router.get('/exams/:examId/submissions', getExamSubmissions);
router.get('/attempts/:attemptId', getAttemptForFaculty);
router.put('/attempts/:attemptId/evaluate', evaluateAttemptAnswers);
router.post('/attempts/:attemptId/finalize', finalizeAttempt);
router.post('/exams/:examId/publish-results', publishResults);
router.get('/exams/:examId/results/export', exportResults);

// Phase 11: Real-Time Monitoring & Announcements Endpoints
router.get('/exams/:examId/monitoring', getLiveMonitoring);
router.post('/exams/:examId/announcements', broadcastAnnouncement);

export default router;

