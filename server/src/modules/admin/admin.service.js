// ==============================================================================
// ExamSphere – Admin Dashboard Analytics & Reporting Service
// ==============================================================================

import { prisma } from '../../config/db.js';

export class AdminService {
  /**
   * Fetch aggregate KPI metrics and examination distribution
   */
  async getDashboardStats() {
    const [
      totalStudents,
      totalFaculty,
      totalCourses,
      totalExams,
      activeExams,
      completedExams,
      totalDepartments,
      recentActivities,
      departmentEnrollments,
      examStatusBreakdown,
      batches,
      sections,
    ] = await Promise.all([
      // Total active students
      prisma.user.count({ where: { role: 'STUDENT' } }),

      // Total active faculty
      prisma.user.count({ where: { role: 'FACULTY' } }),

      // Total courses
      prisma.course.count({ where: { isActive: true } }),

      // Total exams
      prisma.exam.count(),

      // Active / Live exams
      prisma.exam.count({ where: { status: 'LIVE' } }),

      // Completed exams
      prisma.exam.count({ where: { status: 'COMPLETED' } }),

      // Total departments
      prisma.department.count({ where: { isActive: true } }),

      // Recent 10 audit logs with user info
      prisma.auditLog.findMany({
        take: 10,
        orderBy: { timestamp: 'desc' },
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      }),

      // Students count by department
      prisma.department.findMany({
        select: {
          id: true,
          name: true,
          code: true,
          _count: {
            select: { users: true, courses: true },
          },
        },
      }),

      // Exam status breakdown
      prisma.exam.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),

      // Distinct batches
      prisma.user.findMany({
        where: { role: 'STUDENT', batch: { not: null } },
        distinct: ['batch'],
        select: { batch: true },
      }),

      // Distinct sections
      prisma.user.findMany({
        where: { role: 'STUDENT', section: { not: null } },
        distinct: ['section'],
        select: { section: true },
      }),
    ]);

    return {
      kpis: {
        totalStudents,
        totalFaculty,
        totalCourses,
        totalDepartments,
        totalExams,
        activeExams,
        completedExams,
      },
      departmentEnrollments: departmentEnrollments.map((d) => ({
        id: d.id,
        name: d.name,
        code: d.code,
        studentsCount: d._count.users,
        coursesCount: d._count.courses,
      })),
      examStatusBreakdown: examStatusBreakdown.map((s) => ({
        status: s.status,
        count: s._count._all,
      })),
      batches: batches.map((b) => b.batch).filter(Boolean),
      sections: sections.map((s) => s.section).filter(Boolean),
      recentActivities,
    };
  }
}

export const adminService = new AdminService();
