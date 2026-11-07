// ==============================================================================
// ExamSphere – Student Features Controller & Routes
// ==============================================================================

import { Router } from 'express';
import { prisma } from '../../config/db.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { authenticateUser } from '../../middlewares/auth.middleware.js';
import { authorizeRoles } from '../../middlewares/rbac.middleware.js';

// Get student's enrolled courses with course faculty and syllabus info
export const getMyEnrolledCourses = asyncHandler(async (req, res) => {
  const studentId = req.user.id;

  const enrollments = await prisma.studentEnrollment.findMany({
    where: { studentId },
    include: {
      course: {
        include: {
          department: { select: { id: true, name: true, code: true } },
          facultyMembers: {
            include: {
              faculty: { select: { id: true, name: true, email: true } },
            },
          },
          _count: { select: { exams: true } },
        },
      },
    },
  });

  const courses = enrollments.map((e) => ({
    ...e.course,
    enrollmentStatus: e.status,
    enrolledAt: e.enrolledAt,
  }));

  return res.status(200).json(ApiResponse.success(courses, 'Enrolled courses retrieved'));
});

// Get student profile and academic standing
export const getStudentProfile = asyncHandler(async (req, res) => {
  const student = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      rollNumber: true,
      batch: true,
      section: true,
      avatarUrl: true,
      isActive: true,
      createdAt: true,
      department: true,
      _count: {
        select: {
          studentEnrollments: true,
          attempts: true,
          results: true,
        },
      },
    },
  });

  return res.status(200).json(ApiResponse.success(student, 'Student profile retrieved'));
});

// Get exams assigned to student that are published with complete attempt history
export const getMyStudentExams = asyncHandler(async (req, res) => {
  const studentId = req.user.id;
  const now = new Date();

  const [assignments, attempts] = await Promise.all([
    prisma.examAssignment.findMany({
      where: {
        studentId,
        isDisqualified: false,
        exam: {
          isPublished: true,
          status: { in: ['SCHEDULED', 'LIVE', 'COMPLETED'] },
        },
      },
      include: {
        exam: {
          select: {
            id: true,
            title: true,
            description: true,
            durationMinutes: true,
            totalMarks: true,
            passingMarks: true,
            startTime: true,
            endTime: true,
            status: true,
            allowLateEntry: true,
            shuffleQuestions: true,
            shuffleOptions: true,
            negativeMarking: true,
            maxAttempts: true,
            course: {
              select: { id: true, code: true, title: true },
            },
            courses: {
              include: {
                course: { select: { id: true, code: true, title: true } },
              },
            },
            _count: {
              select: { examQuestions: true },
            },
          },
        },
      },
      orderBy: { exam: { startTime: 'asc' } },
    }),
    prisma.attempt.findMany({
      where: { studentId },
      select: {
        id: true,
        examId: true,
        attemptNumber: true,
        startedAt: true,
        expiresAt: true,
        submittedAt: true,
        status: true,
        submissionReason: true,
        obtainedMarks: true,
      },
      orderBy: { attemptNumber: 'desc' },
    }),
  ]);

  const attemptsByExam = {};
  for (const att of attempts) {
    if (!attemptsByExam[att.examId]) {
      attemptsByExam[att.examId] = [];
    }
    attemptsByExam[att.examId].push(att);
  }

  const exams = assignments.map((a) => {
    const examAttempts = attemptsByExam[a.exam.id] || [];
    const activeAttempt = examAttempts.find(
      (att) => att.status === 'IN_PROGRESS' && new Date(att.expiresAt) > now
    );

    const nonCancelledAttempts = examAttempts.filter((att) => att.status !== 'CANCELLED');
    const attemptsCount = nonCancelledAttempts.length;
    const maxAttempts = a.exam.maxAttempts || 1;
    const attemptsRemaining = Math.max(0, maxAttempts - attemptsCount);

    const startTime = new Date(a.exam.startTime);
    const endTime = new Date(a.exam.endTime);
    const isLive = now >= startTime && now <= endTime;
    const isUpcoming = now < startTime;
    const isPastDeadline = now > endTime;

    const canResume = Boolean(activeAttempt);
    const canStart = !isPastDeadline && !isUpcoming && (attemptsRemaining > 0 || canResume);

    let displayStatus = a.exam.status;
    if (isLive) displayStatus = 'LIVE';
    else if (isUpcoming) displayStatus = 'SCHEDULED';
    else if (isPastDeadline) displayStatus = 'COMPLETED';

    const courseList = a.exam.courses?.map((c) => c.course) || [];
    if (courseList.length === 0 && a.exam.course) {
      courseList.push(a.exam.course);
    }

    return {
      ...a.exam,
      courses: courseList,
      courseCode: courseList.map((c) => c.code).join(', ') || a.exam.course?.code || '',
      status: displayStatus,
      extraTimeMinutes: a.extraTimeMinutes,
      assignedAt: a.assignedAt,
      totalQuestions: a.exam._count?.examQuestions || 0,
      attempts: examAttempts,
      activeAttempt: activeAttempt || null,
      attemptsCount,
      attemptsRemaining,
      canStart,
      canResume,
      isLive,
      isUpcoming,
      isPastDeadline,
    };
  });

  return res.status(200).json(ApiResponse.success(exams, 'Student assigned examinations retrieved'));
});

// Get instructions and details for an assigned exam
export const getStudentExamDetails = asyncHandler(async (req, res) => {
  const studentId = req.user.id;
  const examId = req.params.examId || req.params.id;

  const assignment = await prisma.examAssignment.findFirst({
    where: {
      studentId,
      examId,
      isDisqualified: false,
    },
    include: {
      exam: {
        include: {
          course: { select: { id: true, code: true, title: true } },
          courses: {
            include: {
              course: { select: { id: true, code: true, title: true } },
            },
          },
          _count: { select: { examQuestions: true } },
        },
      },
    },
  });

  if (!assignment || !assignment.exam.isPublished) {
    return res
      .status(404)
      .json(ApiResponse.error('Examination not found or not assigned to you', 404));
  }

  const attempts = await prisma.attempt.findMany({
    where: { examId, studentId },
    orderBy: { attemptNumber: 'desc' },
  });

  const now = new Date();
  const activeAttempt = attempts.find(
    (att) => att.status === 'IN_PROGRESS' && new Date(att.expiresAt) > now
  );

  return res.status(200).json(
    ApiResponse.success(
      {
        exam: assignment.exam,
        extraTimeMinutes: assignment.extraTimeMinutes,
        assignedAt: assignment.assignedAt,
        attempts,
        activeAttempt,
      },
      'Examination details and instructions retrieved'
    )
  );
});

import {
  getStudentResults,
  getStudentExamResult,
} from '../evaluation/evaluation.controller.js';
import { getAnnouncements } from '../monitoring/monitoring.controller.js';

const router = Router();

router.use(authenticateUser);
router.use(authorizeRoles('STUDENT', 'ADMIN'));

router.get('/profile', getStudentProfile);
router.get('/courses', getMyEnrolledCourses);
router.get('/exams', getMyStudentExams);
router.get('/exams/:examId', getStudentExamDetails);

// Phase 10: Student Result Dashboard & Details Endpoints
router.get('/results', getStudentResults);
router.get('/exams/:examId/result', getStudentExamResult);

// Phase 11: Real-Time Exam Announcements Endpoint
router.get('/exams/:examId/announcements', getAnnouncements);

export default router;

