// ==============================================================================
// ExamSphere – Examination Repository
// Abstracts Prisma database operations for Exams, Question Links, and Assignments
// ==============================================================================

import { prisma } from '../../config/db.js';

class ExamRepository {
  async create(data) {
    const courseIds = (data.courseIds && data.courseIds.length > 0)
      ? data.courseIds
      : (data.courseId ? [data.courseId] : []);
    const primaryCourseId = data.courseId || courseIds[0];

    return prisma.exam.create({
      data: {
        title: data.title,
        description: data.description,
        courseId: primaryCourseId,
        createdById: data.createdById,
        durationMinutes: data.durationMinutes,
        totalMarks: data.totalMarks,
        passingMarks: data.passingMarks,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        status: data.status || 'DRAFT',
        isPublished: data.isPublished || false,
        shuffleQuestions: data.shuffleQuestions || false,
        shuffleOptions: data.shuffleOptions || false,
        negativeMarking: data.negativeMarking || false,
        maxAttempts: data.maxAttempts || 1,
        autoSubmit: data.autoSubmit ?? true,
        allowLateEntry: data.allowLateEntry || false,
        courses: courseIds.length > 0
          ? {
              create: courseIds.map((cid) => ({ courseId: cid })),
            }
          : undefined,
      },
      include: {
        course: { select: { id: true, code: true, title: true } },
        courses: {
          include: {
            course: { select: { id: true, code: true, title: true } },
          },
        },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async findById(id) {
    return prisma.exam.findUnique({
      where: { id },
      include: {
        course: {
          select: { id: true, code: true, title: true, departmentId: true },
        },
        courses: {
          include: {
            course: { select: { id: true, code: true, title: true, departmentId: true } },
          },
        },
        createdBy: {
          select: { id: true, name: true, email: true, role: true },
        },
        examQuestions: {
          orderBy: { orderIndex: 'asc' },
          include: {
            question: {
              include: {
                course: { select: { id: true, code: true, title: true } },
                options: { orderBy: { orderIndex: 'asc' } },
              },
            },
          },
        },
        _count: {
          select: { assignments: true, attempts: true, examQuestions: true },
        },
      },
    });
  }

  async findMany({ where = {}, skip = 0, take = 10, orderBy = { createdAt: 'desc' } }) {
    const [total, data] = await Promise.all([
      prisma.exam.count({ where }),
      prisma.exam.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          course: { select: { id: true, code: true, title: true } },
          courses: {
            include: {
              course: { select: { id: true, code: true, title: true } },
            },
          },
          createdBy: { select: { id: true, name: true, email: true } },
          _count: {
            select: { examQuestions: true, assignments: true, attempts: true },
          },
        },
      }),
    ]);
    return { data, total };
  }

  async update(id, data) {
    const updatePayload = { ...data };
    if (data.startTime) updatePayload.startTime = new Date(data.startTime);
    if (data.endTime) updatePayload.endTime = new Date(data.endTime);

    if (data.courseIds && data.courseIds.length > 0) {
      delete updatePayload.courseIds;
      updatePayload.courseId = data.courseIds[0];

      // Update exam_courses join table
      await prisma.examCourse.deleteMany({ where: { examId: id } });
      await prisma.examCourse.createMany({
        data: data.courseIds.map((cid) => ({ examId: id, courseId: cid })),
        skipDuplicates: true,
      });
    }

    return prisma.exam.update({
      where: { id },
      data: updatePayload,
      include: {
        course: { select: { id: true, code: true, title: true } },
        courses: {
          include: {
            course: { select: { id: true, code: true, title: true } },
          },
        },
        _count: { select: { examQuestions: true, assignments: true } },
      },
    });
  }

  async delete(id) {
    return prisma.exam.delete({
      where: { id },
    });
  }

  async addQuestions(examId, questions) {
    return prisma.$transaction(async (tx) => {
      // 1. Delete any existing associations for these questions to avoid duplicate conflicts
      await tx.examQuestion.deleteMany({
        where: {
          examId,
          questionId: { in: questions.map((q) => q.questionId) },
        },
      });

      // 2. Insert fresh associations in a single bulk operation
      await tx.examQuestion.createMany({
        data: questions.map((q) => ({
          examId,
          questionId: q.questionId,
          orderIndex: q.orderIndex ?? 0,
          marks: q.marks !== undefined && q.marks !== null ? q.marks : undefined,
          negativeMarks: q.negativeMarks !== undefined && q.negativeMarks !== null ? q.negativeMarks : undefined,
        })),
      });

      // 3. Recompute total marks for the exam
      const allLinked = await tx.examQuestion.findMany({
        where: { examId },
        include: { question: { select: { marks: true } } },
      });

      const calculatedTotal = allLinked.reduce((sum, item) => {
        return sum + (item.marks !== null && item.marks !== undefined ? item.marks : item.question.marks);
      }, 0);

      const updatedExam = await tx.exam.update({
        where: { id: examId },
        data: { totalMarks: calculatedTotal > 0 ? calculatedTotal : 100.0 },
        include: {
          examQuestions: {
            orderBy: { orderIndex: 'asc' },
            include: { question: { select: { id: true, questionText: true, marks: true, type: true } } },
          },
        },
      });

      return updatedExam;
    }, { timeout: 30000, maxWait: 10000 });
  }

  async removeQuestion(examId, questionId) {
    return prisma.$transaction(async (tx) => {
      await tx.examQuestion.deleteMany({
        where: { examId, questionId },
      });

      // Recalculate marks
      const allLinked = await tx.examQuestion.findMany({
        where: { examId },
        include: { question: { select: { marks: true } } },
      });

      const calculatedTotal = allLinked.reduce((sum, item) => {
        return sum + (item.marks !== null && item.marks !== undefined ? item.marks : item.question.marks);
      }, 0);

      return tx.exam.update({
        where: { id: examId },
        data: { totalMarks: calculatedTotal > 0 ? calculatedTotal : 0.0 },
      });
    }, { timeout: 30000, maxWait: 10000 });
  }

  async assignStudents(examId, studentIds, extraTimeMinutes = 0) {
    return prisma.$transaction(async (tx) => {
      const created = await tx.examAssignment.createMany({
        data: studentIds.map((studentId) => ({
          examId,
          studentId,
          extraTimeMinutes,
        })),
        skipDuplicates: true,
      });
      return { totalAssigned: studentIds.length, newlyAssigned: created.count };
    }, { timeout: 30000, maxWait: 10000 });
  }

  async findAssignments(examId) {
    return prisma.examAssignment.findMany({
      where: { examId },
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
  }
}

export const examRepository = new ExamRepository();
