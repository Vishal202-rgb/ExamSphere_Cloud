// ==============================================================================
// ExamSphere – Evaluation and Result Management Service
// Handles auto-evaluation of MCQs/TrueFalse, negative marking, manual grading workflow,
// competition ranking (1, 1, 3), result publication, and secure result distribution
// ==============================================================================

import { prisma } from '../../config/db.js';
import { ApiError } from '../../utils/apiError.js';
import { notificationService } from '../notifications/notifications.service.js';
import { emitToExam, emitToExamFaculty, emitToUser } from '../../socket/socket.service.js';
import { cacheService } from '../../utils/cache.js';

class EvaluationService {
  /**
   * Automatically evaluate a submitted attempt (MCQs, True/False, Negative Marking)
   * Idempotent & safe for worker retries
   */
  async evaluateAttempt(attemptId) {
    const attempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        student: { select: { id: true, name: true, email: true, rollNumber: true } },
        exam: {
          include: {
            course: true,
            examQuestions: {
              include: {
                question: {
                  include: {
                    options: true,
                  },
                },
              },
              orderBy: { orderIndex: 'asc' },
            },
          },
        },
        answers: {
          include: {
            question: {
              include: {
                options: true,
              },
            },
          },
        },
      },
    });

    if (!attempt) {
      throw ApiError.notFound(`Attempt ${attemptId} not found for evaluation`);
    }

    const exam = attempt.exam;
    const examQuestions = exam.examQuestions || [];
    const answersMap = new Map((attempt.answers || []).map((a) => [a.questionId, a]));

    let correctAnswersCount = 0;
    let incorrectAnswersCount = 0;
    let unansweredCount = 0;
    let totalObtainedMarks = 0;
    let hasPendingDescriptive = false;

    const answerUpdates = [];

    for (const eq of examQuestions) {
      const q = eq.question;
      if (!q) continue;

      const maxMarks = eq.marks ?? q.marks ?? 1.0;
      const negativeMarks = exam.negativeMarking ? (eq.negativeMarks ?? q.negativeMarks ?? 0.0) : 0.0;
      const studentAnswer = answersMap.get(q.id);

      let marksAwarded = 0;
      let isCorrect = null;

      if (!studentAnswer) {
        // Unanswered
        unansweredCount++;
        isCorrect = null;
        marksAwarded = 0;
      } else if (q.type === 'SINGLE_MCQ' || q.type === 'TRUE_FALSE') {
        const selected = Array.isArray(studentAnswer.selectedOptions)
          ? studentAnswer.selectedOptions
          : [];

        if (selected.length === 0) {
          unansweredCount++;
          isCorrect = null;
          marksAwarded = 0;
        } else {
          const correctOption = q.options.find((opt) => opt.isCorrect);
          if (correctOption && selected.length === 1 && selected[0] === correctOption.id) {
            isCorrect = true;
            marksAwarded = maxMarks;
            correctAnswersCount++;
          } else {
            isCorrect = false;
            marksAwarded = negativeMarks > 0 ? -negativeMarks : 0;
            incorrectAnswersCount++;
          }
        }
      } else if (q.type === 'MULTIPLE_MCQ') {
        const selected = Array.isArray(studentAnswer.selectedOptions)
          ? studentAnswer.selectedOptions
          : [];

        if (selected.length === 0) {
          unansweredCount++;
          isCorrect = null;
          marksAwarded = 0;
        } else {
          // Exact match scoring: selected options must match correct options exactly
          const correctOptionIds = q.options.filter((opt) => opt.isCorrect).map((opt) => opt.id);
          const isExactMatch =
            selected.length === correctOptionIds.length &&
            selected.every((id) => correctOptionIds.includes(id));

          if (isExactMatch) {
            isCorrect = true;
            marksAwarded = maxMarks;
            correctAnswersCount++;
          } else {
            isCorrect = false;
            marksAwarded = negativeMarks > 0 ? -negativeMarks : 0;
            incorrectAnswersCount++;
          }
        }
      } else if (q.type === 'DESCRIPTIVE') {
        const text = studentAnswer.descriptiveAnswer?.trim();
        if (!text) {
          unansweredCount++;
          isCorrect = false;
          marksAwarded = 0;
        } else {
          // If already manually graded by faculty, preserve marks
          if (studentAnswer.evaluatedAt || studentAnswer.facultyFeedback) {
            marksAwarded = studentAnswer.marksAwarded || 0;
            isCorrect = marksAwarded > 0;
            if (isCorrect) correctAnswersCount++;
            else incorrectAnswersCount++;
          } else {
            hasPendingDescriptive = true;
            marksAwarded = 0;
            isCorrect = null;
          }
        }
      }

      totalObtainedMarks += marksAwarded;

      if (studentAnswer) {
        answerUpdates.push({
          id: studentAnswer.id,
          marksAwarded,
          isCorrect,
        });
      }
    }

    // Never let total obtained marks drop below 0 if negative marking is severe
    totalObtainedMarks = Math.max(0, Math.round(totalObtainedMarks * 100) / 100);
    const totalMarks = exam.totalMarks || 100;
    const percentage = totalMarks > 0 ? Math.round((totalObtainedMarks / totalMarks) * 10000) / 100 : 0;
    const isPassed = exam.passingMarks ? totalObtainedMarks >= exam.passingMarks : null;

    const evaluationStatus = hasPendingDescriptive ? 'MANUAL_EVALUATION_PENDING' : 'EVALUATED';
    const now = new Date();

    // Persist evaluation atomically in PostgreSQL transaction
    const { savedResult, updatedAttempt } = await prisma.$transaction(async (tx) => {
      // 1. Update answer grades
      for (const update of answerUpdates) {
        await tx.answer.update({
          where: { id: update.id },
          data: {
            marksAwarded: update.marksAwarded,
            isCorrect: update.isCorrect,
          },
        });
      }

      // 2. Upsert Result record
      const result = await tx.result.upsert({
        where: { attemptId },
        create: {
          studentId: attempt.studentId,
          examId: attempt.examId,
          attemptId,
          obtainedMarks: totalObtainedMarks,
          totalMarks,
          percentage,
          correctAnswersCount,
          incorrectAnswersCount,
          unansweredCount,
          isPassed,
          evaluationStatus,
          evaluatedAt: now,
        },
        update: {
          obtainedMarks: totalObtainedMarks,
          totalMarks,
          percentage,
          correctAnswersCount,
          incorrectAnswersCount,
          unansweredCount,
          isPassed,
          evaluationStatus,
          evaluatedAt: now,
        },
      });

      // 3. Update Attempt status and marks
      const updated = await tx.attempt.update({
        where: { id: attemptId },
        data: {
          obtainedMarks: totalObtainedMarks,
          evaluationStatus,
          evaluatedAt: now,
          status: evaluationStatus === 'EVALUATED' ? 'EVALUATED' : attempt.status,
        },
      });

      return { savedResult: result, updatedAttempt: updated };
    }, { timeout: 30000, maxWait: 10000 });

    // Notify Faculty if manual grading is required
    if (hasPendingDescriptive) {
      await notificationService.createNotification({
        userId: exam.createdById,
        title: 'Manual Evaluation Required',
        message: `Student ${attempt.student.name} (${attempt.student.rollNumber || 'No Roll'}) has submitted an attempt with descriptive questions for "${exam.title}".`,
        type: 'EVALUATION_REQUIRED',
        metadata: { examId: exam.id, attemptId: attempt.id },
      });
    } else {
      // Emit evaluation:completed event to faculty monitoring dashboard
      emitToExamFaculty(exam.id, 'evaluation:completed', {
        attemptId: attempt.id,
        studentId: attempt.studentId,
        obtainedMarks: totalObtainedMarks,
        totalMarks,
        percentage,
        isPassed,
        evaluationStatus: 'EVALUATED',
        timestamp: now.toISOString(),
      });
    }

    return {
      attempt: updatedAttempt,
      result: savedResult,
    };
  }

  /**
   * Verify faculty is authorized to manage/grade this examination
   */
  async verifyFacultyExamAccess(examId, user) {
    if (user.role === 'ADMIN') return true;

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        course: {
          include: {
            facultyMembers: true,
          },
        },
        courses: {
          include: {
            course: {
              include: {
                facultyMembers: true,
              },
            },
          },
        },
      },
    });

    if (!exam) {
      throw ApiError.notFound('Examination not found');
    }

    const isCreator = exam.createdById === user.id;
    const isPrimaryInstructor = exam.course?.facultyMembers?.some((f) => f.facultyId === user.id);
    const isLinkedInstructor = exam.courses?.some((ec) =>
      ec.course?.facultyMembers?.some((f) => f.facultyId === user.id)
    );

    if (!isCreator && !isPrimaryInstructor && !isLinkedInstructor) {
      throw ApiError.forbidden('You are not authorized to access results for this examination');
    }

    return exam;
  }

  /**
   * List all student submissions for an exam with filtering and pagination
   */
  async getExamSubmissions(examId, facultyUser, query = {}) {
    await this.verifyFacultyExamAccess(examId, facultyUser);

    const {
      status,
      evaluationStatus,
      batch,
      section,
      search,
      page = 1,
      limit = 25,
    } = query;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));
    const skip = (pageNum - 1) * take;

    const where = { examId };

    if (status) {
      where.status = status;
    }
    if (evaluationStatus) {
      where.evaluationStatus = evaluationStatus;
    }

    const studentWhere = {};
    if (batch) studentWhere.batch = batch;
    if (section) studentWhere.section = section;
    if (search) {
      studentWhere.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { rollNumber: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (Object.keys(studentWhere).length > 0) {
      where.student = studentWhere;
    }

    const [attempts, total, exam] = await Promise.all([
      prisma.attempt.findMany({
        where,
        include: {
          student: {
            select: {
              id: true,
              name: true,
              email: true,
              rollNumber: true,
              batch: true,
              section: true,
            },
          },
          result: true,
        },
        orderBy: [{ submittedAt: 'desc' }, { startedAt: 'desc' }],
        skip,
        take,
      }),
      prisma.attempt.count({ where }),
      prisma.exam.findUnique({
        where: { id: examId },
        select: {
          id: true,
          title: true,
          totalMarks: true,
          passingMarks: true,
          status: true,
          course: { select: { code: true, title: true } },
        },
      }),
    ]);

    const submissions = attempts.map((att) => ({
      attemptId: att.id,
      attemptNumber: att.attemptNumber,
      student: att.student,
      startedAt: att.startedAt,
      submittedAt: att.submittedAt,
      expiresAt: att.expiresAt,
      status: att.status,
      submissionReason: att.submissionReason,
      evaluationStatus: att.evaluationStatus,
      obtainedMarks: att.result?.obtainedMarks ?? att.obtainedMarks,
      totalMarks: att.result?.totalMarks ?? exam?.totalMarks ?? 100,
      percentage: att.result?.percentage ?? null,
      isPassed: att.result?.isPassed ?? null,
      rank: att.result?.rank ?? null,
      publicationStatus: att.result?.publicationStatus ?? 'DRAFT',
    }));

    // Aggregated stats
    const stats = {
      totalSubmissions: total,
      evaluated: attempts.filter((a) => a.evaluationStatus === 'EVALUATED').length,
      pendingManual: attempts.filter((a) => a.evaluationStatus === 'MANUAL_EVALUATION_PENDING').length,
      inProgress: attempts.filter((a) => a.status === 'IN_PROGRESS').length,
    };

    return {
      exam,
      stats,
      submissions,
      pagination: {
        page: pageNum,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  /**
   * Get complete attempt details for faculty evaluation (including answer keys and rubric)
   */
  async getAttemptForFaculty(attemptId, facultyUser) {
    const attempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            rollNumber: true,
            batch: true,
            section: true,
          },
        },
        exam: {
          include: {
            course: true,
            examQuestions: {
              include: {
                question: {
                  include: {
                    options: {
                      orderBy: { orderIndex: 'asc' },
                    },
                  },
                },
              },
              orderBy: { orderIndex: 'asc' },
            },
          },
        },
        answers: {
          include: {
            evaluatedBy: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        result: true,
      },
    });

    if (!attempt) {
      throw ApiError.notFound('Attempt not found');
    }

    await this.verifyFacultyExamAccess(attempt.examId, facultyUser);

    const answersMap = new Map((attempt.answers || []).map((a) => [a.questionId, a]));

    const questions = (attempt.exam?.examQuestions || []).map((eq, idx) => {
      const q = eq.question;
      const ans = answersMap.get(q.id);

      return {
        id: q.id,
        questionNumber: idx + 1,
        questionText: q.questionText,
        type: q.type,
        difficulty: q.difficulty,
        marks: eq.marks ?? q.marks,
        negativeMarks: eq.negativeMarks ?? q.negativeMarks,
        explanation: q.explanation,
        options: q.options.map((opt) => ({
          id: opt.id,
          optionText: opt.optionText,
          isCorrect: opt.isCorrect,
          orderIndex: opt.orderIndex,
        })),
        studentAnswer: ans
          ? {
              id: ans.id,
              selectedOptions: ans.selectedOptions || [],
              descriptiveAnswer: ans.descriptiveAnswer || '',
              marksAwarded: ans.marksAwarded,
              isCorrect: ans.isCorrect,
              facultyFeedback: ans.facultyFeedback,
              evaluatedAt: ans.evaluatedAt,
              evaluatedBy: ans.evaluatedBy,
            }
          : null,
      };
    });

    return {
      attempt: {
        id: attempt.id,
        attemptNumber: attempt.attemptNumber,
        status: attempt.status,
        submissionReason: attempt.submissionReason,
        evaluationStatus: attempt.evaluationStatus,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        student: attempt.student,
        result: attempt.result,
      },
      exam: {
        id: attempt.exam.id,
        title: attempt.exam.title,
        course: attempt.exam.course,
        totalMarks: attempt.exam.totalMarks,
        passingMarks: attempt.exam.passingMarks,
        negativeMarking: attempt.exam.negativeMarking,
      },
      questions,
    };
  }

  /**
   * Manual grading of descriptive answers with mark validation & score recalculation
   */
  async evaluateDescriptiveAnswers(attemptId, evaluations, facultyUser) {
    const attempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: {
          include: {
            examQuestions: {
              include: { question: true },
            },
          },
        },
        answers: true,
      },
    });

    if (!attempt) {
      throw ApiError.notFound('Attempt not found');
    }

    await this.verifyFacultyExamAccess(attempt.examId, facultyUser);

    const examQuestionsMap = new Map(
      (attempt.exam?.examQuestions || []).map((eq) => [eq.questionId, eq])
    );
    const answersMap = new Map((attempt.answers || []).map((a) => [a.questionId, a]));

    const now = new Date();

    // 1. Validate each evaluation entry
    for (const item of evaluations) {
      const eq = examQuestionsMap.get(item.questionId);
      if (!eq) {
        throw ApiError.badRequest(`Question ${item.questionId} does not belong to this exam`);
      }

      const maxMarks = eq.marks ?? eq.question?.marks ?? 1.0;
      if (item.marksAwarded < 0 || item.marksAwarded > maxMarks) {
        throw ApiError.badRequest(
          `Awarded marks (${item.marksAwarded}) for question ${item.questionId} must be between 0 and maximum marks (${maxMarks})`
        );
      }
    }

    // 2. Persist evaluations in a transaction
    await prisma.$transaction(async (tx) => {
      for (const item of evaluations) {
        const existingAns = answersMap.get(item.questionId);
        if (existingAns) {
          await tx.answer.update({
            where: { id: existingAns.id },
            data: {
              marksAwarded: item.marksAwarded,
              isCorrect: item.marksAwarded > 0,
              facultyFeedback: item.facultyFeedback || null,
              evaluatedAt: now,
              evaluatedById: facultyUser.id,
            },
          });
        } else {
          await tx.answer.create({
            data: {
              attemptId,
              questionId: item.questionId,
              marksAwarded: item.marksAwarded,
              isCorrect: item.marksAwarded > 0,
              facultyFeedback: item.facultyFeedback || null,
              evaluatedAt: now,
              evaluatedById: facultyUser.id,
            },
          });
        }
      }
    }, { timeout: 30000, maxWait: 10000 });

    // 3. Recalculate full evaluation results
    return this.evaluateAttempt(attemptId);
  }

  /**
   * Finalize evaluation for an attempt
   */
  async finalizeAttemptEvaluation(attemptId, facultyUser) {
    const attempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: {
          include: {
            examQuestions: { include: { question: true } },
          },
        },
        answers: true,
      },
    });

    if (!attempt) {
      throw ApiError.notFound('Attempt not found');
    }

    await this.verifyFacultyExamAccess(attempt.examId, facultyUser);

    // Re-evaluate to compute final scores
    const { attempt: updatedAttempt, result: updatedResult } = await this.evaluateAttempt(attemptId);

    // Mark as EVALUATED
    const finalAttempt = await prisma.attempt.update({
      where: { id: attemptId },
      data: {
        evaluationStatus: 'EVALUATED',
        status: 'EVALUATED',
      },
    });

    const finalResult = await prisma.result.update({
      where: { attemptId },
      data: {
        evaluationStatus: 'EVALUATED',
      },
    });

    emitToExamFaculty(attempt.examId, 'evaluation:completed', {
      attemptId,
      studentId: attempt.studentId,
      evaluationStatus: 'EVALUATED',
      timestamp: new Date().toISOString(),
    });

    return {
      attempt: finalAttempt,
      result: finalResult,
    };
  }

  /**
   * Publish results with Competition Ranking (1, 1, 3 tie handling)
   */
  async publishResults(examId, facultyUser) {
    const exam = await this.verifyFacultyExamAccess(examId, facultyUser);

    // Fetch all evaluated results for this exam
    const results = await prisma.result.findMany({
      where: {
        examId,
        evaluationStatus: 'EVALUATED',
      },
      include: {
        attempt: { select: { id: true, studentId: true, status: true } },
        student: { select: { id: true, name: true, email: true } },
      },
      orderBy: { obtainedMarks: 'desc' },
    });

    if (results.length === 0) {
      throw ApiError.badRequest('No evaluated attempts found to publish for this examination');
    }

    // 1. Calculate Standard Competition Ranking (1, 1, 3)
    let currentRank = 1;
    const rankedResults = [];

    for (let i = 0; i < results.length; i++) {
      if (i > 0 && results[i].obtainedMarks < results[i - 1].obtainedMarks) {
        currentRank = i + 1; // Competition rank jump
      }
      rankedResults.push({
        id: results[i].id,
        studentId: results[i].studentId,
        rank: currentRank,
      });
    }

    const now = new Date();

    // 2. Persist rankings and publication status in database transaction
    await prisma.$transaction(async (tx) => {
      for (const item of rankedResults) {
        await tx.result.update({
          where: { id: item.id },
          data: {
            rank: item.rank,
            publicationStatus: 'PUBLISHED',
            publishedAt: now,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: facultyUser.id,
          action: 'EXAM_RESULTS_PUBLISHED',
          resource: 'EXAM',
          resourceId: examId,
          metadata: {
            publishedCount: rankedResults.length,
            timestamp: now.toISOString(),
          },
        },
      }).catch(() => {});
    }, { timeout: 30000, maxWait: 10000 });

    // 3. Emit real-time Socket.IO event to all clients in exam room
    emitToExam(examId, 'results:published', {
      examId,
      examTitle: exam.title,
      publishedAt: now.toISOString(),
      totalResults: rankedResults.length,
    });

    // 4. Send persistent notifications to all assigned students
    const assignments = await prisma.examAssignment.findMany({
      where: { examId },
      select: { studentId: true },
    });

    const studentIds = assignments.map((a) => a.studentId);
    await notificationService.notifyMany(studentIds, {
      title: 'Examination Results Published',
      message: `Results for examination "${exam.title}" are now available for viewing.`,
      type: 'RESULT_PUBLISHED',
      metadata: { examId },
    });

    // Invalidate cached analytics across admin and faculty dashboards
    await cacheService.invalidatePattern('analytics:*').catch(() => {});

    return {
      examId,
      publishedCount: rankedResults.length,
      publishedAt: now,
      message: 'Examination results successfully ranked and published',
    };
  }

  /**
   * Export published exam results as CSV
   */
  async exportExamResults(examId, facultyUser) {
    await this.verifyFacultyExamAccess(examId, facultyUser);

    const results = await prisma.result.findMany({
      where: { examId },
      include: {
        student: {
          select: {
            name: true,
            email: true,
            rollNumber: true,
            batch: true,
            section: true,
          },
        },
        attempt: { select: { attemptNumber: true, submittedAt: true, status: true } },
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
      'Pass/Fail',
      'Evaluation Status',
      'Publication Status',
      'Submitted At',
    ];

    const rows = results.map((r) => [
      r.rank ?? 'N/A',
      r.student.rollNumber || 'N/A',
      `"${(r.student.name || '').replace(/"/g, '""')}"`,
      r.student.email,
      r.student.batch || 'N/A',
      r.student.section || 'N/A',
      r.obtainedMarks,
      r.totalMarks,
      `${r.percentage}%`,
      r.isPassed === true ? 'PASS' : r.isPassed === false ? 'FAIL' : 'N/A',
      r.evaluationStatus,
      r.publicationStatus,
      r.attempt?.submittedAt ? new Date(r.attempt.submittedAt).toISOString() : 'N/A',
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
    return csvContent;
  }

  /**
   * Student: Get all published results for current logged-in student
   */
  async getStudentPublishedResults(studentId) {
    const results = await prisma.result.findMany({
      where: {
        studentId,
        publicationStatus: 'PUBLISHED',
      },
      include: {
        exam: {
          select: {
            id: true,
            title: true,
            course: { select: { code: true, title: true } },
            passingMarks: true,
          },
        },
        attempt: {
          select: {
            attemptNumber: true,
            submittedAt: true,
          },
        },
      },
      orderBy: { publishedAt: 'desc' },
    });

    return results.map((r) => ({
      resultId: r.id,
      examId: r.exam.id,
      examTitle: r.exam.title,
      courseCode: r.exam.course.code,
      courseTitle: r.exam.course.title,
      attemptNumber: r.attempt.attemptNumber,
      submittedAt: r.attempt.submittedAt,
      obtainedMarks: r.obtainedMarks,
      totalMarks: r.totalMarks,
      percentage: r.percentage,
      isPassed: r.isPassed,
      rank: r.rank,
      publishedAt: r.publishedAt,
    }));
  }

  /**
   * Student: Get detailed published result for a specific examination
   */
  async getStudentExamResultDetails(examId, studentId) {
    const result = await prisma.result.findFirst({
      where: {
        examId,
        studentId,
        publicationStatus: 'PUBLISHED',
      },
      include: {
        exam: {
          include: {
            course: { select: { code: true, title: true } },
            examQuestions: {
              include: {
                question: {
                  select: {
                    id: true,
                    questionText: true,
                    type: true,
                    marks: true,
                  },
                },
              },
              orderBy: { orderIndex: 'asc' },
            },
          },
        },
        attempt: {
          include: {
            answers: {
              select: {
                questionId: true,
                marksAwarded: true,
                isCorrect: true,
                facultyFeedback: true,
                descriptiveAnswer: true,
                selectedOptions: true,
              },
            },
          },
        },
      },
    });

    if (!result) {
      throw ApiError.notFound('Results for this examination have not been published or found');
    }

    const answersMap = new Map((result.attempt?.answers || []).map((a) => [a.questionId, a]));

    const questions = (result.exam.examQuestions || []).map((eq, idx) => {
      const q = eq.question;
      const ans = answersMap.get(q.id);

      return {
        questionNumber: idx + 1,
        questionText: q.questionText,
        type: q.type,
        marks: eq.marks ?? q.marks,
        studentMarksAwarded: ans?.marksAwarded ?? 0,
        isCorrect: ans?.isCorrect ?? false,
        facultyFeedback: ans?.facultyFeedback ?? null,
      };
    });

    return {
      result: {
        id: result.id,
        examTitle: result.exam.title,
        courseCode: result.exam.course.code,
        courseTitle: result.exam.course.title,
        obtainedMarks: result.obtainedMarks,
        totalMarks: result.totalMarks,
        percentage: result.percentage,
        isPassed: result.isPassed,
        rank: result.rank,
        correctAnswersCount: result.correctAnswersCount,
        incorrectAnswersCount: result.incorrectAnswersCount,
        unansweredCount: result.unansweredCount,
        publishedAt: result.publishedAt,
      },
      questions,
    };
  }
}

export const evaluationService = new EvaluationService();
