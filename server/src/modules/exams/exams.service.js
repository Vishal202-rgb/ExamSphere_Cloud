// ==============================================================================
// ExamSphere – Examination Service
// Business logic, schedule validations, publishing transitions, and student assignments
// ==============================================================================

import { examRepository } from './exams.repository.js';
import { questionRepository } from '../questions/questions.repository.js';
import { prisma } from '../../config/db.js';
import { ApiError } from '../../utils/apiError.js';

class ExamService {
  async assertCourseAccess(user, courseId) {
    if (user.role === 'ADMIN') return true;
    if (user.role === 'FACULTY') {
      const hasAccess = await questionRepository.checkFacultyCourseAccess(user.id, courseId);
      if (!hasAccess) {
        throw ApiError.forbidden('You are not authorized to manage examinations for this course');
      }
      return true;
    }
    throw ApiError.forbidden('Unauthorized role for examination management');
  }

  async assertExamAccess(user, exam) {
    if (user.role === 'ADMIN') return true;
    if (user.role === 'FACULTY') {
      if (exam.createdById === user.id) return true;
      const courseIds = [
        exam.courseId,
        ...(exam.courses?.map((c) => c.courseId) || []),
      ].filter(Boolean);
      for (const cid of courseIds) {
        if (await questionRepository.checkFacultyCourseAccess(user.id, cid)) {
          return true;
        }
      }
      throw ApiError.forbidden('You are not authorized to manage this examination');
    }
    throw ApiError.forbidden('Unauthorized role for examination management');
  }

  async createExam(data, user) {
    const courseIds = (data.courseIds && data.courseIds.length > 0)
      ? data.courseIds
      : (data.courseId ? [data.courseId] : []);

    if (courseIds.length === 0) {
      throw ApiError.badRequest('At least one course is required to create an examination');
    }

    for (const cid of courseIds) {
      await this.assertCourseAccess(user, cid);
    }

    const exam = await examRepository.create({
      ...data,
      courseIds,
      courseId: courseIds[0],
      createdById: user.id,
      maxAttempts: data.maxAttempts || data.maximumAttempts || 1,
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'EXAM_CREATED',
        resource: 'EXAM',
        resourceId: exam.id,
        metadata: { courseIds, primaryCourseId: courseIds[0], title: data.title },
      },
    }).catch(() => {});

    return exam;
  }

  async getExams(query, user) {
    const { search, courseId, courseIds, status, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where = {};

    let targetCourseIds = [];
    if (courseIds && courseIds.length > 0) {
      targetCourseIds = Array.isArray(courseIds)
        ? courseIds
        : courseIds.split(',').map((s) => s.trim()).filter(Boolean);
    } else if (courseId) {
      targetCourseIds = courseId.split(',').map((s) => s.trim()).filter(Boolean);
    }

    if (targetCourseIds.length > 0) {
      if (user.role === 'FACULTY') {
        for (const cid of targetCourseIds) {
          await this.assertCourseAccess(user, cid);
        }
      }
      where.OR = [
        { courseId: { in: targetCourseIds } },
        { courses: { some: { courseId: { in: targetCourseIds } } } },
      ];
    } else if (user.role === 'FACULTY') {
      const assignments = await prisma.courseFaculty.findMany({
        where: { facultyId: user.id },
        select: { courseId: true },
      });
      const facultyCourseIds = assignments.map((a) => a.courseId);
      where.OR = [
        { createdById: user.id },
        { courseId: { in: facultyCourseIds } },
        { courses: { some: { courseId: { in: facultyCourseIds } } } },
      ];
    }

    if (status) where.status = status;

    if (search) {
      where.title = { contains: search, mode: 'insensitive' };
    }

    const metricWhere = { ...where };
    delete metricWhere.status;

    const [statusCounts, { data, total }] = await Promise.all([
      prisma.exam.groupBy({
        by: ['status'],
        where: metricWhere,
        _count: { _all: true },
      }),
      examRepository.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const metrics = {
      total: 0,
      DRAFT: 0,
      SCHEDULED: 0,
      LIVE: 0,
      COMPLETED: 0,
      CANCELLED: 0,
    };
    for (const sc of statusCounts) {
      if (sc.status && sc._count?._all) {
        metrics[sc.status] = sc._count._all;
        metrics.total += sc._count._all;
      }
    }

    return {
      data,
      metrics,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getExamById(id, user) {
    const exam = await examRepository.findById(id);
    if (!exam) {
      throw ApiError.notFound(`Exam with ID ${id} not found`);
    }

    if (user.role === 'FACULTY') {
      await this.assertExamAccess(user, exam);
    }

    // Student security rule: students cannot access unpublished or draft exams, or exams not assigned to them
    if (user.role === 'STUDENT') {
      if (!exam.isPublished || exam.status === 'DRAFT' || exam.status === 'CANCELLED') {
        throw ApiError.forbidden('This examination is currently not available or unpublished');
      }

      const assignment = await prisma.examAssignment.findUnique({
        where: {
          examId_studentId: {
            examId: id,
            studentId: user.id,
          },
        },
      });

      if (!assignment || assignment.isDisqualified) {
        throw ApiError.forbidden('You are not assigned to this examination');
      }

      // Never return answer keys to students
      return {
        ...exam,
        examQuestions: exam.examQuestions.map((eq) => ({
          id: eq.id,
          orderIndex: eq.orderIndex,
          marks: eq.marks || eq.question.marks,
          question: {
            id: eq.question.id,
            questionText: eq.question.questionText,
            type: eq.question.type,
            options: eq.question.options.map((opt) => ({
              id: opt.id,
              optionText: opt.optionText,
              orderIndex: opt.orderIndex,
            })),
          },
        })),
      };
    }

    return exam;
  }

  async updateExam(id, data, user) {
    const existing = await examRepository.findById(id);
    if (!existing) {
      throw ApiError.notFound(`Exam with ID ${id} not found`);
    }

    await this.assertExamAccess(user, existing);

    const newCourseIds = (data.courseIds && data.courseIds.length > 0)
      ? data.courseIds
      : (data.courseId ? [data.courseId] : []);

    for (const cid of newCourseIds) {
      await this.assertCourseAccess(user, cid);
    }

    // Invalidation check: if exam is LIVE and students have already started attempts
    if (existing.status === 'LIVE' && existing._count?.attempts > 0) {
      const restrictedKeys = ['durationMinutes', 'totalMarks', 'passingMarks'];
      const violates = restrictedKeys.some((k) => data[k] !== undefined && data[k] !== existing[k]);
      if (violates) {
        throw ApiError.badRequest('Cannot alter duration or scoring of an ongoing exam with active attempts');
      }
    }

    const updated = await examRepository.update(id, {
      ...data,
      courseIds: newCourseIds.length > 0 ? newCourseIds : undefined,
      maxAttempts: data.maxAttempts || data.maximumAttempts,
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'EXAM_UPDATED',
        resource: 'EXAM',
        resourceId: id,
        metadata: { changes: Object.keys(data) },
      },
    }).catch(() => {});

    return updated;
  }

  async deleteExam(id, user) {
    const existing = await examRepository.findById(id);
    if (!existing) {
      throw ApiError.notFound(`Exam with ID ${id} not found`);
    }

    await this.assertExamAccess(user, existing);

    if (existing._count?.attempts > 0) {
      throw ApiError.badRequest('Cannot delete an examination with recorded student attempts. You can cancel it instead.');
    }

    const result = await examRepository.delete(id);

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'EXAM_DELETED',
        resource: 'EXAM',
        resourceId: id,
      },
    }).catch(() => {});

    return result;
  }

  async publishExam(id, user) {
    const exam = await examRepository.findById(id);
    if (!exam) {
      throw ApiError.notFound(`Exam with ID ${id} not found`);
    }

    await this.assertExamAccess(user, exam);

    // Business validation: exam must have at least one question
    if (!exam.examQuestions || exam.examQuestions.length === 0) {
      throw ApiError.badRequest('Examination must contain at least one question before publishing');
    }

    const now = new Date();
    let nextStatus = 'SCHEDULED';
    if (exam.startTime <= now && exam.endTime >= now) {
      nextStatus = 'LIVE';
    } else if (exam.endTime < now) {
      nextStatus = 'COMPLETED';
    }

    const updated = await examRepository.update(id, {
      isPublished: true,
      status: nextStatus,
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'EXAM_PUBLISHED',
        resource: 'EXAM',
        resourceId: id,
        metadata: { status: nextStatus },
      },
    }).catch(() => {});

    return updated;
  }

  async cancelExam(id, user) {
    const exam = await examRepository.findById(id);
    if (!exam) {
      throw ApiError.notFound(`Exam with ID ${id} not found`);
    }

    await this.assertExamAccess(user, exam);

    const updated = await examRepository.update(id, {
      status: 'CANCELLED',
      isPublished: false,
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'EXAM_CANCELLED',
        resource: 'EXAM',
        resourceId: id,
      },
    }).catch(() => {});

    return updated;
  }

  async addQuestionsToExam(examId, questions, user) {
    const exam = await examRepository.findById(examId);
    if (!exam) {
      throw ApiError.notFound(`Exam with ID ${examId} not found`);
    }

    await this.assertExamAccess(user, exam);

    const examCourseIds = [
      exam.courseId,
      ...(exam.courses?.map((c) => c.courseId) || []),
    ].filter(Boolean);

    // Verify all questions belong to one of exam's courses
    const qIds = questions.map((q) => q.questionId);
    const dbQuestions = await prisma.question.findMany({
      where: { id: { in: qIds } },
      select: { id: true, courseId: true },
    });

    for (const dbq of dbQuestions) {
      if (!examCourseIds.includes(dbq.courseId)) {
        throw ApiError.badRequest(
          `Question ${dbq.id} does not belong to any authorized course of this examination`
        );
      }
    }

    const updated = await examRepository.addQuestions(examId, questions);
    return updated;
  }

  async removeQuestionFromExam(examId, questionId, user) {
    const exam = await examRepository.findById(examId);
    if (!exam) {
      throw ApiError.notFound(`Exam with ID ${examId} not found`);
    }

    await this.assertExamAccess(user, exam);

    return examRepository.removeQuestion(examId, questionId);
  }

  async assignExam(examId, assignData, user) {
    const exam = await examRepository.findById(examId);
    if (!exam) {
      throw ApiError.notFound(`Exam with ID ${examId} not found`);
    }

    await this.assertExamAccess(user, exam);

    const examCourseIds = [
      exam.courseId,
      ...(exam.courses?.map((c) => c.courseId) || []),
    ].filter(Boolean);

    const { batch, section, studentIds, extraTimeMinutes = 0 } = assignData;
    let targetStudentIds = [];

    if (studentIds && studentIds.length > 0) {
      targetStudentIds = studentIds;
    } else {
      // Find eligible students enrolled in any of the exam's courses
      const whereClause = {
        role: 'STUDENT',
        isActive: true,
      };

      if (batch) whereClause.batch = batch;
      if (section) whereClause.section = section;

      const students = await prisma.user.findMany({
        where: {
          ...whereClause,
          studentEnrollments: { some: { courseId: { in: examCourseIds } } },
        },
        select: { id: true },
      });

      targetStudentIds = students.map((s) => s.id);
    }

    if (targetStudentIds.length === 0) {
      throw ApiError.badRequest('No eligible students found matching the batch/section criteria');
    }

    const result = await examRepository.assignStudents(examId, targetStudentIds, extraTimeMinutes);

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'EXAM_ASSIGNED',
        resource: 'EXAM',
        resourceId: examId,
        metadata: {
          totalAssigned: result.totalAssigned,
          batch,
          section,
        },
      },
    }).catch(() => {});

    return result;
  }

  async getExamAssignments(examId, user) {
    const exam = await examRepository.findById(examId);
    if (!exam) {
      throw ApiError.notFound(`Exam with ID ${examId} not found`);
    }

    await this.assertExamAccess(user, exam);

    const assignments = await examRepository.findAssignments(examId);
    return assignments;
  }
}

export const examService = new ExamService();
