// ==============================================================================
// ExamSphere – Attempt Repository
// Prisma data access layer for examination attempts, answer upserts, and time tracking
// ==============================================================================

import { prisma } from '../../config/db.js';

class AttemptRepository {
  async findById(id) {
    return prisma.attempt.findUnique({
      where: { id },
      include: {
        exam: {
          include: {
            course: { select: { id: true, code: true, title: true } },
            createdBy: { select: { id: true, name: true, email: true } },
            examQuestions: {
              orderBy: { orderIndex: 'asc' },
              include: {
                question: {
                  include: {
                    options: { orderBy: { orderIndex: 'asc' } },
                  },
                },
              },
            },
          },
        },
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
        answers: true,
      },
    });
  }

  async findActiveAttempt(examId, studentId) {
    return prisma.attempt.findFirst({
      where: {
        examId,
        studentId,
        status: 'IN_PROGRESS',
        isDisqualified: false,
      },
      include: {
        answers: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async countStudentAttempts(examId, studentId) {
    return prisma.attempt.count({
      where: {
        examId,
        studentId,
        status: { in: ['IN_PROGRESS', 'SUBMITTED', 'AUTO_SUBMITTED', 'EVALUATED', 'DISQUALIFIED', 'CANCELLED'] },
      },
    });
  }

  async findExamForAttempt(examId, studentId) {
    return prisma.exam.findUnique({
      where: { id: examId },
      include: {
        course: { select: { id: true, code: true, title: true } },
        assignments: {
          where: { studentId },
        },
        examQuestions: {
          orderBy: { orderIndex: 'asc' },
          include: {
            question: {
              include: {
                options: { orderBy: { orderIndex: 'asc' } },
              },
            },
          },
        },
      },
    });
  }

  async createAttempt(data) {
    return prisma.attempt.create({
      data: {
        examId: data.examId,
        studentId: data.studentId,
        attemptNumber: data.attemptNumber,
        startedAt: data.startedAt,
        expiresAt: data.expiresAt,
        status: 'IN_PROGRESS',
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        questionOrder: data.questionOrder,
        optionOrder: data.optionOrder,
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
            negativeMarking: true,
            course: { select: { id: true, code: true, title: true } },
          },
        },
        answers: true,
      },
    });
  }

  async findAnswer(attemptId, questionId) {
    return prisma.answer.findUnique({
      where: {
        attemptId_questionId: {
          attemptId,
          questionId,
        },
      },
    });
  }

  async upsertAnswer(data) {
    return prisma.answer.upsert({
      where: {
        attemptId_questionId: {
          attemptId: data.attemptId,
          questionId: data.questionId,
        },
      },
      update: {
        selectedOptions: data.selectedOptions ?? [],
        descriptiveAnswer: data.descriptiveAnswer ?? null,
        markedForReview: data.markedForReview ?? false,
        version: data.version,
        savedTimestamp: data.savedTimestamp,
      },
      create: {
        attemptId: data.attemptId,
        questionId: data.questionId,
        selectedOptions: data.selectedOptions ?? [],
        descriptiveAnswer: data.descriptiveAnswer ?? null,
        markedForReview: data.markedForReview ?? false,
        version: data.version ?? 1,
        savedTimestamp: data.savedTimestamp ?? new Date(),
      },
    });
  }

  async updateAttempt(id, data) {
    return prisma.attempt.update({
      where: { id },
      data,
    });
  }

  async findExpiredAttempts() {
    return prisma.attempt.findMany({
      where: {
        status: 'IN_PROGRESS',
        expiresAt: { lt: new Date() },
      },
      select: {
        id: true,
        examId: true,
        studentId: true,
        expiresAt: true,
      },
      take: 50,
    });
  }
}

export const attemptRepository = new AttemptRepository();
