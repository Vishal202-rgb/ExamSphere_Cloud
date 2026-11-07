// ==============================================================================
// ExamSphere – Report Generation & CSV Export Service
// Generates authorized CSV reports for department, faculty exams, question analysis, and students
// ==============================================================================

import { prisma } from '../../config/db.js';
import { ApiError } from '../../utils/apiError.js';
import { analyticsService } from './analytics.service.js';

class ReportsService {
  /**
   * Helper: format CSV value safely
   */
  escapeCSV(val) {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  /**
   * ADMIN: Department Summary Report CSV
   */
  async exportDepartmentSummary(departmentId, user) {
    if (user.role !== 'ADMIN') {
      throw ApiError.forbidden('Only administrators can export department summary reports');
    }

    const dept = departmentId
      ? await prisma.department.findUnique({
          where: { id: departmentId },
          include: {
            courses: {
              include: {
                _count: { select: { exams: true, studentEnrollments: true } },
              },
            },
          },
        })
      : null;

    const departments = dept ? [dept] : await prisma.department.findMany({
      include: {
        courses: {
          include: {
            _count: { select: { exams: true, studentEnrollments: true } },
          },
        },
      },
    });

    const headers = [
      'Department Code',
      'Department Name',
      'Total Courses',
      'Course Code',
      'Course Title',
      'Enrolled Students',
      'Exams Created',
      'Status',
    ];

    const rows = [];
    departments.forEach((d) => {
      if (d.courses.length === 0) {
        rows.push([
          this.escapeCSV(d.code),
          this.escapeCSV(d.name),
          0,
          'N/A',
          'No courses configured',
          0,
          0,
          d.isActive ? 'Active' : 'Inactive',
        ]);
      } else {
        d.courses.forEach((c) => {
          rows.push([
            this.escapeCSV(d.code),
            this.escapeCSV(d.name),
            d.courses.length,
            this.escapeCSV(c.code),
            this.escapeCSV(c.title),
            c._count?.studentEnrollments || 0,
            c._count?.exams || 0,
            c.isActive ? 'Active' : 'Inactive',
          ]);
        });
      }
    });

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  /**
   * FACULTY / ADMIN: Exam Question Analysis Report CSV
   */
  async exportExamQuestionAnalysis(examId, facultyUser) {
    await analyticsService.verifyFacultyExamAccess(examId, facultyUser);

    const examAnalytics = await analyticsService.getFacultyExamAnalytics(examId, facultyUser);

    const headers = [
      'Question Order',
      'Question Text',
      'Question Type',
      'Difficulty',
      'Configured Marks',
      'Total Attempts',
      'Answered Count',
      'Skipped Count',
      'Correct Count',
      'Accuracy Rate (%)',
      'Avg Marks Awarded',
    ];

    const rows = examAnalytics.questionAccuracy.map((q) => [
      q.orderIndex + 1,
      this.escapeCSV(q.questionText),
      q.type,
      q.difficulty,
      q.configuredMarks,
      q.totalAttempts,
      q.answeredCount,
      q.skippedCount,
      q.correctCount,
      q.accuracyRate,
      q.avgMarksAwarded,
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  /**
   * FACULTY / ADMIN: Faculty Exam Summary Report CSV
   */
  async exportFacultyExamReport(examId, facultyUser) {
    await analyticsService.verifyFacultyExamAccess(examId, facultyUser);

    const results = await prisma.result.findMany({
      where: { examId, publicationStatus: 'PUBLISHED' },
      include: {
        student: { select: { name: true, rollNumber: true, email: true, batch: true, section: true } },
        attempt: { select: { startedAt: true, submittedAt: true, tabSwitchCount: true } },
      },
      orderBy: [{ rank: 'asc' }, { obtainedMarks: 'desc' }],
    });

    const headers = [
      'Rank',
      'Roll Number',
      'Student Name',
      'Email',
      'Batch',
      'Section',
      'Marks Obtained',
      'Total Marks',
      'Percentage',
      'Result',
      'Correct Answers',
      'Incorrect Answers',
      'Unanswered',
      'Tab Switches',
      'Submitted At',
    ];

    const rows = results.map((r) => [
      r.rank ?? 'N/A',
      this.escapeCSV(r.student.rollNumber || 'N/A'),
      this.escapeCSV(r.student.name),
      this.escapeCSV(r.student.email),
      this.escapeCSV(r.student.batch || 'N/A'),
      this.escapeCSV(r.student.section || 'N/A'),
      r.obtainedMarks,
      r.totalMarks,
      r.percentage,
      r.isPassed ? 'PASS' : 'FAIL',
      r.correctAnswersCount,
      r.incorrectAnswersCount,
      r.unansweredCount,
      r.attempt?.tabSwitchCount || 0,
      r.attempt?.submittedAt ? r.attempt.submittedAt.toISOString() : 'N/A',
    ]);

    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  }

  /**
   * STUDENT / FACULTY: Student Performance Transcript Report CSV
   */
  async exportStudentPerformance(targetStudentId, requestingUser) {
    // If student, can only export their own
    if (requestingUser.role === 'STUDENT' && requestingUser.id !== targetStudentId) {
      throw ApiError.forbidden('You are not authorized to export another student\'s transcript');
    }

    const student = await prisma.user.findUnique({
      where: { id: targetStudentId },
      select: { id: true, name: true, rollNumber: true, email: true, batch: true, section: true },
    });

    if (!student) {
      throw ApiError.notFound('Student record not found');
    }

    // Only published results
    const results = await prisma.result.findMany({
      where: { studentId: targetStudentId, publicationStatus: 'PUBLISHED' },
      include: {
        exam: {
          select: {
            title: true,
            course: { select: { code: true, title: true } },
          },
        },
      },
      orderBy: { publishedAt: 'desc' },
    });

    const headers = [
      'Course Code',
      'Course Title',
      'Examination Title',
      'Marks Obtained',
      'Total Marks',
      'Percentage',
      'Result Status',
      'Rank in Exam',
      'Published Date',
    ];

    const rows = results.map((r) => [
      this.escapeCSV(r.exam.course.code),
      this.escapeCSV(r.exam.course.title),
      this.escapeCSV(r.exam.title),
      r.obtainedMarks,
      r.totalMarks,
      r.percentage,
      r.isPassed ? 'PASSED' : 'FAILED',
      r.rank ?? 'N/A',
      r.publishedAt ? r.publishedAt.toISOString().slice(0, 10) : 'N/A',
    ]);

    return [
      `# Student Name: ${student.name}`,
      `# Roll Number: ${student.rollNumber || 'N/A'}`,
      `# Email: ${student.email}`,
      `# Batch: ${student.batch || 'N/A'} | Section: ${student.section || 'N/A'}`,
      headers.join(','),
      ...rows.map((r) => r.join(',')),
    ].join('\n');
  }
}

export const reportsService = new ReportsService();
