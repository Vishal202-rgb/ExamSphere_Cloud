// ==============================================================================
// ExamSphere – Examination Attempt Service
// Core business engine for session starts, authoritative timer, answer autosaves,
// question/option shuffle preservation, exam resumption, and idempotent submissions
// ==============================================================================

import { attemptRepository } from './attempts.repository.js';
import { prisma } from '../../config/db.js';
import { ApiError } from '../../utils/apiError.js';
import { dispatchEvaluationJob } from '../../queues/evaluation.queue.js';
import { emitToExamFaculty } from '../../socket/socket.service.js';

class AttemptService {
  /**
   * Start or resume an examination session for a student
   */
  async startExam(examId, studentUser, reqMeta = {}) {
    const studentId = studentUser.id;

    // 1. Verify student account is active
    if (!studentUser.isActive) {
      throw ApiError.forbidden('Your student account is deactivated. Please contact administration.');
    }

    // 2. Fetch exam with course, assignments, and questions
    const exam = await attemptRepository.findExamForAttempt(examId, studentId);
    if (!exam) {
      throw ApiError.notFound(`Examination with ID ${examId} not found`);
    }

    // 3. Verify exam is published and not draft/cancelled
    if (!exam.isPublished || exam.status === 'DRAFT' || exam.status === 'CANCELLED') {
      throw ApiError.forbidden('This examination is currently unpublished or unavailable');
    }

    // 4. Verify student is assigned to this exam
    const assignment = exam.assignments?.[0];
    if (!assignment && studentUser.role !== 'ADMIN') {
      throw ApiError.forbidden('You are not assigned to take this examination');
    }

    if (assignment?.isDisqualified) {
      throw ApiError.forbidden(
        `You have been disqualified from this examination: ${assignment.disqualifyReason || 'Academic integrity violation'}`
      );
    }

    const now = new Date();
    const startTime = new Date(exam.startTime);
    const endTime = new Date(exam.endTime);

    // 5. Verify current server time is within exam window
    if (now < startTime) {
      throw ApiError.badRequest(
        `Examination window has not opened yet. Starts at: ${startTime.toISOString()}`
      );
    }

    if (now > endTime) {
      throw ApiError.badRequest('Examination window has closed. No new attempts are permitted.');
    }

    // Check late entry policy (grace period 15 mins if allowLateEntry is false)
    if (!exam.allowLateEntry) {
      const gracePeriodMs = 15 * 60 * 1000;
      if (now.getTime() > startTime.getTime() + gracePeriodMs) {
        throw ApiError.badRequest('Late entry is not permitted for this examination window.');
      }
    }

    // 6. Check for an existing active attempt (Concurrency & Idempotency)
    const existingActive = await attemptRepository.findActiveAttempt(examId, studentId);
    if (existingActive) {
      // Check if the active attempt has expired on server
      if (now.getTime() >= new Date(existingActive.expiresAt).getTime()) {
        await prisma.attempt.update({
          where: { id: existingActive.id },
          data: {
            status: 'AUTO_SUBMITTED',
            submissionReason: 'AUTO_TIMEOUT',
            submittedAt: existingActive.expiresAt,
          },
        });
        await dispatchEvaluationJob('evaluate-attempt', {
          attemptId: existingActive.id,
          examId,
          studentId,
          reason: 'AUTO_TIMEOUT',
        });
      } else {
        // Idempotency: Return existing active attempt seamlessly
        return this.formatSafeAttemptResponse(existingActive, exam);
      }
    }

    // 7. Check total attempt limit
    const totalAttempts = await attemptRepository.countStudentAttempts(examId, studentId);
    if (totalAttempts >= exam.maxAttempts) {
      throw ApiError.badRequest(
        `Maximum attempt limit reached. You have completed ${totalAttempts} of ${exam.maxAttempts} allowed attempt(s).`
      );
    }

    // 8. Calculate startedAt & expiresAt
    const startedAt = now;
    const durationMinutes = exam.durationMinutes + (assignment?.extraTimeMinutes || 0);
    const calculatedExpiry = new Date(startedAt.getTime() + durationMinutes * 60 * 1000);
    // Expiration can never exceed the exam's overall endTime window
    const expiresAt = new Date(Math.min(calculatedExpiry.getTime(), endTime.getTime()));

    // 9. Generate randomized question order if enabled
    let examQuestions = [...(exam.examQuestions || [])];
    if (exam.shuffleQuestions) {
      for (let i = examQuestions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [examQuestions[i], examQuestions[j]] = [examQuestions[j], examQuestions[i]];
      }
    } else {
      examQuestions.sort((a, b) => a.orderIndex - b.orderIndex);
    }
    const questionOrder = examQuestions.map((eq) => eq.questionId);

    // 10. Generate randomized option order if enabled
    const optionOrder = {};
    for (const eq of examQuestions) {
      const qOptions = [...(eq.question?.options || [])];
      if (exam.shuffleOptions) {
        for (let i = qOptions.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [qOptions[i], qOptions[j]] = [qOptions[j], qOptions[i]];
        }
      } else {
        qOptions.sort((a, b) => a.orderIndex - b.orderIndex);
      }
      optionOrder[eq.questionId] = qOptions.map((opt) => opt.id);
    }

    // 11. Create Attempt record in PostgreSQL
    const newAttempt = await attemptRepository.createAttempt({
      examId,
      studentId,
      attemptNumber: totalAttempts + 1,
      startedAt,
      expiresAt,
      ipAddress: reqMeta.ipAddress || null,
      userAgent: reqMeta.userAgent || null,
      questionOrder,
      optionOrder,
    });

    // 12. Security Audit Log
    await prisma.auditLog.create({
      data: {
        userId: studentId,
        action: 'EXAM_ATTEMPT_STARTED',
        resource: 'ATTEMPT',
        resourceId: newAttempt.id,
        metadata: {
          examId,
          attemptNumber: newAttempt.attemptNumber,
          expiresAt: expiresAt.toISOString(),
        },
      },
    }).catch(() => {});

    // 13. Emit real-time telemetry to faculty monitoring dashboard
    emitToExamFaculty(examId, 'exam:started', {
      examId,
      studentId,
      studentName: studentUser.name,
      attemptId: newAttempt.id,
      startedAt: startedAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    });

    return this.formatSafeAttemptResponse(newAttempt, exam);
  }

  /**
   * Authoritative server time calculation for countdown synchronization
   */
  async getAttemptTime(attemptId, user) {
    const attempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
      select: {
        id: true,
        examId: true,
        studentId: true,
        status: true,
        startedAt: true,
        expiresAt: true,
        submittedAt: true,
        submissionReason: true,
      },
    });

    if (!attempt) {
      throw ApiError.notFound(`Attempt ${attemptId} not found`);
    }

    if (user.role === 'STUDENT' && attempt.studentId !== user.id) {
      throw ApiError.forbidden('You are not authorized to access this examination session');
    }

    const now = new Date();
    const expiryTime = new Date(attempt.expiresAt);
    let remainingSeconds = Math.max(0, Math.floor((expiryTime.getTime() - now.getTime()) / 1000));

    // Server-authoritative auto-submission if expired while in progress
    if (attempt.status === 'IN_PROGRESS' && remainingSeconds <= 0) {
      await prisma.attempt.update({
        where: { id: attemptId },
        data: {
          status: 'AUTO_SUBMITTED',
          submissionReason: 'AUTO_TIMEOUT',
          submittedAt: attempt.expiresAt,
        },
      });

      await dispatchEvaluationJob('evaluate-attempt', {
        attemptId,
        examId: attempt.examId,
        studentId: attempt.studentId,
        reason: 'AUTO_TIMEOUT',
      });

      emitToExamFaculty(attempt.examId, 'attempt:expired', {
        attemptId,
        examId: attempt.examId,
        studentId: attempt.studentId,
        timestamp: now.toISOString(),
      });

      return {
        attemptId: attempt.id,
        serverTime: now.toISOString(),
        startedAt: attempt.startedAt,
        expiresAt: attempt.expiresAt,
        remainingSeconds: 0,
        isExpired: true,
        status: 'AUTO_SUBMITTED',
      };
    }

    return {
      attemptId: attempt.id,
      serverTime: now.toISOString(),
      startedAt: attempt.startedAt,
      expiresAt: attempt.expiresAt,
      remainingSeconds,
      isExpired: remainingSeconds <= 0,
      status: attempt.status,
    };
  }

  /**
   * Autosave individual question response with optimistic locking
   */
  async autosaveAnswer(attemptId, questionId, body, user) {
    const attempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: {
          include: {
            examQuestions: { select: { questionId: true } },
          },
        },
      },
    });

    if (!attempt) {
      throw ApiError.notFound(`Attempt with ID ${attemptId} not found`);
    }

    if (attempt.studentId !== user.id && user.role !== 'ADMIN') {
      throw ApiError.forbidden('You are not authorized to update answers for this attempt');
    }

    if (attempt.status !== 'IN_PROGRESS' || attempt.isDisqualified) {
      throw ApiError.forbidden(`Cannot save response. Attempt status is ${attempt.status}${attempt.isDisqualified ? ' (Disqualified)' : ''}`);
    }

    const now = new Date();
    if (now.getTime() >= new Date(attempt.expiresAt).getTime()) {
      // Auto-submit expired attempt immediately
      await prisma.attempt.update({
        where: { id: attemptId },
        data: {
          status: 'AUTO_SUBMITTED',
          submissionReason: 'AUTO_TIMEOUT',
          submittedAt: attempt.expiresAt,
        },
      });
      await dispatchEvaluationJob('evaluate-attempt', {
        attemptId: attempt.id,
        examId: attempt.examId,
        studentId: attempt.studentId,
        reason: 'AUTO_TIMEOUT',
      });
      throw ApiError.badRequest('Examination attempt has expired. Answers can no longer be updated.');
    }

    // Verify question belongs to the examination
    const isQuestionInExam = attempt.exam?.examQuestions?.some(
      (eq) => eq.questionId === questionId
    );
    if (!isQuestionInExam) {
      throw ApiError.badRequest('Specified question does not belong to this examination');
    }

    // Check existing answer for optimistic concurrency versioning
    const existing = await attemptRepository.findAnswer(attemptId, questionId);

    if (existing) {
      if (body.version !== undefined && body.version < existing.version) {
        return {
          attemptId,
          questionId,
          version: existing.version,
          savedTimestamp: existing.savedTimestamp,
          markedForReview: existing.markedForReview,
          status: 'STALE_IGNORED',
          message: 'Ignored stale autosave request',
        };
      }
    }

    const newVersion =
      body.version !== undefined
        ? Math.max(body.version, (existing?.version || 0) + 1)
        : existing
        ? (existing.version || 1) + 1
        : 1;
    const savedTimestamp = new Date();

    const savedAnswer = await attemptRepository.upsertAnswer({
      attemptId,
      questionId,
      selectedOptions: body.selectedOptions ?? (body.clearResponse ? [] : existing?.selectedOptions ?? []),
      descriptiveAnswer: body.descriptiveAnswer !== undefined ? body.descriptiveAnswer : existing?.descriptiveAnswer ?? null,
      markedForReview: body.markedForReview !== undefined ? body.markedForReview : existing?.markedForReview ?? false,
      version: newVersion,
      savedTimestamp,
    });

    return {
      attemptId,
      questionId,
      version: savedAnswer.version,
      savedTimestamp: savedAnswer.savedTimestamp,
      markedForReview: savedAnswer.markedForReview,
      status: 'SAVED',
    };
  }

  /**
   * Resume existing attempt: recovers questions, answers, and time
   */
  async getAttempt(attemptId, user) {
    const attempt = await attemptRepository.findById(attemptId);
    if (!attempt) {
      throw ApiError.notFound(`Attempt ${attemptId} not found`);
    }

    if (user.role === 'STUDENT') {
      if (attempt.studentId !== user.id) {
        throw ApiError.forbidden('You are not authorized to view this attempt');
      }

      // One-time submission security: prevent reopening or resuming submitted attempts
      if (['SUBMITTED', 'AUTO_SUBMITTED', 'EVALUATED'].includes(attempt.status)) {
        throw ApiError.forbidden('This examination attempt has already been submitted and cannot be resumed');
      }

      // Anti-cheating security: prevent resuming disqualified attempts
      if (attempt.status === 'DISQUALIFIED' || attempt.status === 'CANCELLED' || attempt.isDisqualified) {
        throw ApiError.forbidden(
          `This examination attempt has been disqualified: ${attempt.disqualifyReason || 'Academic integrity policy violation'}`
        );
      }
    }

    const now = new Date();
    // Expiration check
    if (attempt.status === 'IN_PROGRESS' && now.getTime() >= new Date(attempt.expiresAt).getTime()) {
      await prisma.attempt.update({
        where: { id: attemptId },
        data: {
          status: 'AUTO_SUBMITTED',
          submissionReason: 'AUTO_TIMEOUT',
          submittedAt: attempt.expiresAt,
        },
      });
      await dispatchEvaluationJob('evaluate-attempt', {
        attemptId,
        examId: attempt.examId,
        studentId: attempt.studentId,
        reason: 'AUTO_TIMEOUT',
      });
      attempt.status = 'AUTO_SUBMITTED';
      attempt.submissionReason = 'AUTO_TIMEOUT';
      attempt.submittedAt = attempt.expiresAt;
    }

    return this.formatSafeAttemptResponse(attempt, attempt.exam);
  }

  /**
   * Idempotent submission engine with transaction and evaluation queueing
   */
  async submitAttempt(attemptId, body, user) {
    const attempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        exam: {
          include: {
            examQuestions: true,
          },
        },
        answers: true,
      },
    });

    if (!attempt) {
      throw ApiError.notFound(`Attempt ${attemptId} not found`);
    }

    if (attempt.studentId !== user.id && user.role !== 'ADMIN') {
      throw ApiError.forbidden('You are not authorized to submit this attempt');
    }

    // Reject duplicate submissions and API replay
    if (['SUBMITTED', 'AUTO_SUBMITTED', 'EVALUATED'].includes(attempt.status)) {
      throw ApiError.badRequest('Examination attempt has already been submitted and cannot be resubmitted');
    }

    if (attempt.status === 'DISQUALIFIED' || attempt.status === 'CANCELLED' || attempt.isDisqualified) {
      throw ApiError.forbidden('Examination attempt was disqualified and cannot be submitted');
    }

    if (attempt.status !== 'IN_PROGRESS') {
      throw ApiError.badRequest(`Cannot submit attempt with status: ${attempt.status}`);
    }

    const now = new Date();
    const isTimeout =
      body.reason === 'AUTO_TIMEOUT' || now.getTime() >= new Date(attempt.expiresAt).getTime();
    const finalStatus = isTimeout ? 'AUTO_SUBMITTED' : 'SUBMITTED';
    const validReasons = ['MANUAL', 'AUTO_TIMEOUT', 'ADMIN_TERMINATED', 'DISQUALIFIED'];
    let finalReason = isTimeout ? 'AUTO_TIMEOUT' : body.reason || 'MANUAL';
    if (!validReasons.includes(finalReason)) {
      finalReason = 'MANUAL';
    }
    const submittedAt = isTimeout && now > attempt.expiresAt ? attempt.expiresAt : now;

    const updatedAttempt = await prisma.$transaction(async (tx) => {
      const updated = await tx.attempt.update({
        where: { id: attemptId },
        data: {
          status: finalStatus,
          submissionReason: finalReason,
          submittedAt,
        },
        include: {
          answers: true,
          exam: {
            include: { examQuestions: true },
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: user.id,
          action: 'EXAM_ATTEMPT_SUBMITTED',
          resource: 'ATTEMPT',
          resourceId: attemptId,
          metadata: {
            reason: finalReason,
            status: finalStatus,
            submittedAt: submittedAt.toISOString(),
          },
        },
      }).catch(() => {});

      return updated;
    });

    // Enqueue BullMQ evaluation job
    await dispatchEvaluationJob('evaluate-attempt', {
      attemptId: updatedAttempt.id,
      examId: updatedAttempt.examId,
      studentId: updatedAttempt.studentId,
      submissionReason: finalReason,
    });

    // Emit real-time submission telemetry to faculty
    emitToExamFaculty(updatedAttempt.examId, 'attempt:submission_received', {
      attemptId: updatedAttempt.id,
      examId: updatedAttempt.examId,
      studentId: updatedAttempt.studentId,
      submissionReason: finalReason,
      submittedAt: submittedAt.toISOString(),
    });

    return this.formatSubmissionConfirmation(updatedAttempt);
  }

  /**
   * Format safe examination payload without leaking answer keys or faculty explanations
   */
  formatSafeAttemptResponse(attempt, exam) {
    const now = new Date();
    const remainingSeconds = Math.max(
      0,
      Math.floor((new Date(attempt.expiresAt).getTime() - now.getTime()) / 1000)
    );

    // Map questions by ID
    const examQuestionsMap = new Map();
    for (const eq of exam.examQuestions || []) {
      examQuestionsMap.set(eq.questionId, eq);
    }

    // Reconstruct question order from attempt.questionOrder
    const questionIds = Array.isArray(attempt.questionOrder)
      ? attempt.questionOrder
      : (exam.examQuestions || []).map((eq) => eq.questionId);

    const orderedQuestions = [];
    let index = 1;

    for (const qId of questionIds) {
      const eq = examQuestionsMap.get(qId);
      if (!eq || !eq.question) continue;

      const q = eq.question;
      const optionOrderForQ = attempt.optionOrder?.[qId];

      let options = [...(q.options || [])];
      if (Array.isArray(optionOrderForQ)) {
        const optMap = new Map(options.map((opt) => [opt.id, opt]));
        options = optionOrderForQ.map((id) => optMap.get(id)).filter(Boolean);
      } else {
        options.sort((a, b) => a.orderIndex - b.orderIndex);
      }

      orderedQuestions.push({
        id: q.id,
        questionNumber: index++,
        questionText: q.questionText,
        type: q.type,
        marks: eq.marks ?? q.marks,
        negativeMarks: eq.negativeMarks ?? q.negativeMarks,
        options: options.map((opt, optIdx) => ({
          id: opt.id,
          optionText: opt.optionText,
          orderIndex: optIdx + 1,
        })),
        // NOTE: isCorrect and explanation are strictly stripped for exam integrity
      });
    }

    // Map saved answers
    const answersMap = {};
    for (const ans of attempt.answers || []) {
      answersMap[ans.questionId] = {
        selectedOptions: Array.isArray(ans.selectedOptions) ? ans.selectedOptions : [],
        descriptiveAnswer: ans.descriptiveAnswer || '',
        markedForReview: Boolean(ans.markedForReview),
        version: ans.version || 1,
        savedTimestamp: ans.savedTimestamp,
      };
    }

    return {
      attempt: {
        id: attempt.id,
        examId: attempt.examId,
        attemptNumber: attempt.attemptNumber,
        startedAt: attempt.startedAt,
        expiresAt: attempt.expiresAt,
        remainingSeconds,
        isExpired: remainingSeconds <= 0,
        status: attempt.status,
        submissionReason: attempt.submissionReason,
        violationCount: attempt.violationCount || 0,
        isDisqualified: Boolean(attempt.isDisqualified || attempt.status === 'DISQUALIFIED' || attempt.status === 'CANCELLED'),
        disqualifyReason: attempt.disqualifyReason || null,
        disqualifiedAt: attempt.disqualifiedAt || null,
        exam: {
          id: exam.id,
          title: exam.title,
          description: exam.description,
          durationMinutes: exam.durationMinutes,
          totalMarks: exam.totalMarks,
          passingMarks: exam.passingMarks,
          negativeMarking: exam.negativeMarking,
          autoSubmit: exam.autoSubmit,
          course: exam.course,
        },
        questions: orderedQuestions,
        answers: answersMap,
      },
    };
  }

  /**
   * Helper to format standardized submission confirmation
   */
  formatSubmissionConfirmation(attempt) {
    const totalQuestions = attempt.exam?.examQuestions?.length || 0;
    let answeredCount = 0;
    let markedForReviewCount = 0;

    for (const ans of attempt.answers || []) {
      const hasOption = Array.isArray(ans.selectedOptions) && ans.selectedOptions.length > 0;
      const hasText = ans.descriptiveAnswer && ans.descriptiveAnswer.trim().length > 0;
      if (hasOption || hasText) {
        answeredCount++;
      }
      if (ans.markedForReview) {
        markedForReviewCount++;
      }
    }

    const unansweredCount = Math.max(0, totalQuestions - answeredCount);

    return {
      attemptId: attempt.id,
      examId: attempt.examId,
      status: attempt.status,
      submittedAt: attempt.submittedAt || new Date(),
      submissionReason: attempt.submissionReason || 'MANUAL',
      totalQuestions,
      answeredCount,
      unansweredCount,
      markedForReviewCount,
      message: 'Examination submitted successfully',
    };
  }
}

export const attemptService = new AttemptService();
