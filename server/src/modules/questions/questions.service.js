// ==============================================================================
// ExamSphere – Question Bank Service
// Business logic, authorization checks, CSV import/export, and audit logging
// ==============================================================================

import { questionRepository } from './questions.repository.js';
import { prisma } from '../../config/db.js';
import { ApiError } from '../../utils/apiError.js';
import { parse } from 'csv-parse/sync';

class QuestionService {
  async assertCourseAccess(user, courseId) {
    if (user.role === 'ADMIN') return true;
    if (user.role === 'FACULTY') {
      const hasAccess = await questionRepository.checkFacultyCourseAccess(user.id, courseId);
      if (!hasAccess) {
        throw ApiError.forbidden('You are not authorized to manage questions for this course');
      }
      return true;
    }
    throw ApiError.forbidden('Unauthorized role for question management');
  }

  async createQuestion(data, user) {
    await this.assertCourseAccess(user, data.courseId);

    const question = await questionRepository.create(
      {
        questionText: data.questionText,
        type: data.type,
        difficulty: data.difficulty,
        marks: data.marks,
        negativeMarks: data.negativeMarks,
        courseId: data.courseId,
        createdById: user.id,
        topicTags: data.topicTags,
        explanation: data.explanation,
      },
      data.options || []
    );

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'QUESTION_CREATED',
        resource: 'QUESTION',
        resourceId: question.id,
        metadata: {
          courseId: data.courseId,
          type: data.type,
          marks: data.marks,
        },
      },
    }).catch(() => {});

    return question;
  }

  async getQuestions(query, user) {
    const { search, courseId, courseIds, type, difficulty, page = 1, limit = 10 } = query;
    const skip = (page - 1) * limit;

    const where = {
      isActive: true,
    };

    let targetCourseIds = [];
    if (courseIds && courseIds.length > 0) {
      targetCourseIds = Array.isArray(courseIds) ? courseIds : courseIds.split(',').map((s) => s.trim()).filter(Boolean);
    } else if (courseId) {
      targetCourseIds = courseId.split(',').map((s) => s.trim()).filter(Boolean);
    }

    if (targetCourseIds.length > 0) {
      if (user.role === 'FACULTY') {
        for (const cid of targetCourseIds) {
          await this.assertCourseAccess(user, cid);
        }
      }
      where.courseId = targetCourseIds.length === 1 ? targetCourseIds[0] : { in: targetCourseIds };
    } else if (user.role === 'FACULTY') {
      // If no courseId specified, faculty sees questions for all their assigned courses
      const assignments = await prisma.courseFaculty.findMany({
        where: { facultyId: user.id },
        select: { courseId: true },
      });
      where.courseId = { in: assignments.map((a) => a.courseId) };
    }

    if (type) where.type = type;
    if (difficulty) where.difficulty = difficulty;

    if (search) {
      where.OR = [
        { questionText: { contains: search, mode: 'insensitive' } },
        { topicTags: { has: search } },
      ];
    }

    const { data, total } = await questionRepository.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getQuestionById(id, user) {
    const question = await questionRepository.findById(id);
    if (!question) {
      throw ApiError.notFound(`Question with ID ${id} not found`);
    }

    if (user.role === 'FACULTY') {
      await this.assertCourseAccess(user, question.courseId);
    }

    // Student security check: if role is STUDENT, NEVER return isCorrect or faculty explanations
    if (user.role === 'STUDENT') {
      return {
        ...question,
        explanation: null,
        options: question.options.map((opt) => ({
          id: opt.id,
          optionText: opt.optionText,
          orderIndex: opt.orderIndex,
        })),
      };
    }

    return question;
  }

  async updateQuestion(id, data, user) {
    const existing = await questionRepository.findById(id);
    if (!existing) {
      throw ApiError.notFound(`Question with ID ${id} not found`);
    }

    await this.assertCourseAccess(user, existing.courseId);
    if (data.courseId && data.courseId !== existing.courseId) {
      await this.assertCourseAccess(user, data.courseId);
    }

    const updated = await questionRepository.update(id, data, data.options);

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'QUESTION_UPDATED',
        resource: 'QUESTION',
        resourceId: id,
        metadata: { changes: Object.keys(data) },
      },
    }).catch(() => {});

    return updated;
  }

  async deleteQuestion(id, user) {
    const existing = await questionRepository.findById(id);
    if (!existing) {
      throw ApiError.notFound(`Question with ID ${id} not found`);
    }

    await this.assertCourseAccess(user, existing.courseId);

    const result = await questionRepository.delete(id);

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'QUESTION_DELETED',
        resource: 'QUESTION',
        resourceId: id,
        metadata: { courseId: existing.courseId },
      },
    }).catch(() => {});

    return result;
  }

  /**
   * Bulk import questions from CSV string or buffer
   * Expected CSV headers: questionText, type, difficulty, marks, negativeMarks, options, correctOptions, topicTags, explanation
   */
  async bulkImportQuestions(csvContent, courseId, user) {
    if (!courseId) {
      throw ApiError.badRequest('Target course ID is required for bulk question import');
    }
    await this.assertCourseAccess(user, courseId);

    if (!csvContent) {
      throw ApiError.badRequest('No CSV file content provided');
    }

    let records;
    try {
      records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch (err) {
      throw ApiError.badRequest(`Failed to parse CSV format: ${err.message}`);
    }

    if (!records || records.length === 0) {
      throw ApiError.badRequest('CSV file is empty or missing headers');
    }

    const errors = [];
    let importedCount = 0;

    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < records.length; i++) {
        const row = records[i];
        const rowNum = i + 2;

        const questionText = row.questionText || row.question || row.Question;
        const type = (row.type || row.Type || 'SINGLE_MCQ').toUpperCase();
        const difficulty = (row.difficulty || row.Difficulty || 'MEDIUM').toUpperCase();
        const marks = parseFloat(row.marks || row.Marks || '1.0');
        const negativeMarks = parseFloat(row.negativeMarks || row.negative_marks || '0.0');
        const explanation = row.explanation || row.Explanation || null;
        const rawTags = row.topicTags || row.tags || '';
        const topicTags = rawTags ? rawTags.split(';').map((t) => t.trim()).filter(Boolean) : [];

        if (!questionText) {
          errors.push(`Row ${rowNum}: questionText is required`);
          continue;
        }

        // Parse options (format: "Option A | Option B | Option C" or comma-separated)
        let options = [];
        if (type !== 'DESCRIPTIVE') {
          const rawOptions = row.options || row.Options || '';
          const rawCorrect = row.correctOptions || row.correct || row.Answer || '';

          if (type === 'TRUE_FALSE') {
            const isTrueCorrect = rawCorrect.toString().trim().toLowerCase() === 'true';
            options = [
              { optionText: 'True', isCorrect: isTrueCorrect, orderIndex: 0 },
              { optionText: 'False', isCorrect: !isTrueCorrect, orderIndex: 1 },
            ];
          } else {
            const splitOpts = rawOptions.split('|').map((o) => o.trim()).filter(Boolean);
            const correctSet = new Set(
              rawCorrect.split('|').map((c) => c.trim().toLowerCase()).filter(Boolean)
            );

            options = splitOpts.map((optText, idx) => ({
              optionText: optText,
              isCorrect: correctSet.has(optText.toLowerCase()) || correctSet.has((idx + 1).toString()),
              orderIndex: idx,
            }));

          }

          if (options.length < 2 && type !== 'TRUE_FALSE') {
            errors.push(`Row ${rowNum}: MCQ questions must contain at least 2 options (separated by |)`);
            continue;
          }
          if (!options.some((o) => o.isCorrect)) {
            errors.push(`Row ${rowNum}: At least one option must be marked as correct`);
            continue;
          }
        }

        await tx.question.create({
          data: {
            questionText,
            type,
            difficulty: ['EASY', 'MEDIUM', 'HARD'].includes(difficulty) ? difficulty : 'MEDIUM',
            marks: isNaN(marks) || marks <= 0 ? 1.0 : marks,
            negativeMarks: isNaN(negativeMarks) || negativeMarks < 0 ? 0.0 : negativeMarks,
            courseId,
            createdById: user.id,
            topicTags,
            explanation,
            isActive: true,
            options: options.length > 0 ? { create: options } : undefined,
          },
        });

        importedCount++;
      }
    });

    return { importedCount, errors };
  }

  /**
   * Export questions in CSV format
   */
  async exportQuestionsCSV(query, user) {
    const { data: questions } = await this.getQuestions({ ...query, limit: 1000 }, user);

    const headers = [
      'Question Text',
      'Type',
      'Difficulty',
      'Marks',
      'Negative Marks',
      'Options',
      'Correct Options',
      'Topic Tags',
      'Explanation',
    ];

    const rows = questions.map((q) => {
      const optionsStr = q.options?.map((o) => o.optionText).join(' | ') || '';
      const correctStr = q.options?.filter((o) => o.isCorrect).map((o) => o.optionText).join(' | ') || '';
      const tagsStr = q.topicTags?.join(';') || '';

      return [
        `"${(q.questionText || '').replace(/"/g, '""')}"`,
        q.type,
        q.difficulty,
        q.marks,
        q.negativeMarks,
        `"${optionsStr.replace(/"/g, '""')}"`,
        `"${correctStr.replace(/"/g, '""')}"`,
        `"${tagsStr.replace(/"/g, '""')}"`,
        `"${(q.explanation || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }
}

export const questionService = new QuestionService();
