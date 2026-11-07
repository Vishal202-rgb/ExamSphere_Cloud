// ==============================================================================
// ExamSphere – Question Bank Repository
// Abstracts Prisma database operations for Questions and Options
// ==============================================================================

import { prisma } from '../../config/db.js';

class QuestionRepository {
  _formatQuestion(q) {
    if (!q) return null;
    return {
      ...q,
      title: q.questionText,
      topic: Array.isArray(q.topicTags) && q.topicTags.length > 0 ? q.topicTags[0] : null,
      courseCode: q.course?.code || null,
      courseTitle: q.course?.title || null,
    };
  }

  async create(data, optionsList = []) {
    const question = await prisma.question.create({
      data: {
        questionText: data.questionText,
        type: data.type,
        difficulty: data.difficulty,
        marks: data.marks,
        negativeMarks: data.negativeMarks,
        courseId: data.courseId,
        createdById: data.createdById,
        topicTags: data.topicTags || [],
        explanation: data.explanation || null,
        isActive: true,
        options: optionsList.length > 0
          ? {
              create: optionsList.map((opt, idx) => ({
                optionText: opt.optionText,
                isCorrect: Boolean(opt.isCorrect),
                orderIndex: opt.orderIndex ?? idx,
              })),
            }
          : undefined,
      },
      include: {
        options: {
          orderBy: { orderIndex: 'asc' },
        },
        course: {
          select: { id: true, code: true, title: true, departmentId: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true, role: true },
        },
      },
    });
    return this._formatQuestion(question);
  }

  async findById(id) {
    const question = await prisma.question.findUnique({
      where: { id },
      include: {
        options: {
          orderBy: { orderIndex: 'asc' },
        },
        course: {
          select: { id: true, code: true, title: true, departmentId: true },
        },
        createdBy: {
          select: { id: true, name: true, email: true, role: true },
        },
        _count: {
          select: { examQuestions: true },
        },
      },
    });
    return this._formatQuestion(question);
  }

  async findMany({ where = {}, skip = 0, take = 10, orderBy = { createdAt: 'desc' } }) {
    const [total, data] = await Promise.all([
      prisma.question.count({ where }),
      prisma.question.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          options: {
            orderBy: { orderIndex: 'asc' },
          },
          course: {
            select: { id: true, code: true, title: true },
          },
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: { examQuestions: true },
          },
        },
      }),
    ]);
    return { data: data.map((q) => this._formatQuestion(q)), total };
  }

  async update(id, data, optionsList = null) {
    // If options are provided, recreate them to preserve atomic order
    if (optionsList !== null && optionsList !== undefined) {
      await prisma.questionOption.deleteMany({
        where: { questionId: id },
      });
    }

    const updated = await prisma.question.update({
      where: { id },
      data: {
        questionText: data.questionText,
        type: data.type,
        difficulty: data.difficulty,
        marks: data.marks,
        negativeMarks: data.negativeMarks,
        courseId: data.courseId,
        topicTags: data.topicTags,
        explanation: data.explanation,
        isActive: data.isActive,
        options: optionsList && optionsList.length > 0
          ? {
              create: optionsList.map((opt, idx) => ({
                optionText: opt.optionText,
                isCorrect: Boolean(opt.isCorrect),
                orderIndex: opt.orderIndex ?? idx,
              })),
            }
          : undefined,
      },
      include: {
        options: {
          orderBy: { orderIndex: 'asc' },
        },
        course: {
          select: { id: true, code: true, title: true },
        },
      },
    });

    return this._formatQuestion(updated);
  }

  async delete(id) {
    // Check if question is referenced in examinations
    const linkedExams = await prisma.examQuestion.count({
      where: { questionId: id },
    });

    if (linkedExams > 0) {
      // Soft-delete/archive if linked to active or past exams
      return prisma.question.update({
        where: { id },
        data: { isActive: false },
      });
    }

    // Hard delete if not linked to any exam
    return prisma.question.delete({
      where: { id },
    });
  }

  async checkFacultyCourseAccess(facultyId, courseId) {
    const assignment = await prisma.courseFaculty.findUnique({
      where: {
        courseId_facultyId: { courseId, facultyId },
      },
    });
    return !!assignment;
  }
}

export const questionRepository = new QuestionRepository();
