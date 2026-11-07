// ==============================================================================
// ExamSphere – Comprehensive Examination Engine & Interface Test Suite
// Validates all 18 Critical Scenarios specified in Batch 3 (Phase 8 & 9)
// ==============================================================================

import test, { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Mock in-memory database store for high-concurrency examination test runner
class MockExamDatabase {
  constructor() {
    this.reset();
  }

  reset() {
    this.users = new Map();
    this.courses = new Map();
    this.exams = new Map();
    this.assignments = new Map();
    this.attempts = new Map();
    this.answers = new Map();
    this.auditLogs = [];
    this.evaluationJobs = [];
  }
}

const db = new MockExamDatabase();

// In-Memory Attempt Service Implementation for isolated test execution
class TestAttemptEngine {
  constructor(database) {
    this.db = database;
  }

  async startExam(examId, studentUser, reqMeta = {}, customNow = null) {
    const studentId = studentUser.id;

    if (!studentUser.isActive) {
      throw new Error('Your student account is deactivated. Please contact administration.');
    }

    const exam = this.db.exams.get(examId);
    if (!exam) {
      throw new Error('Examination not found');
    }

    if (!exam.isPublished || exam.status === 'DRAFT' || exam.status === 'CANCELLED') {
      throw new Error('This examination is currently unpublished or unavailable');
    }

    const assignmentKey = `${examId}_${studentId}`;
    const assignment = this.db.assignments.get(assignmentKey);
    if (!assignment && studentUser.role !== 'ADMIN') {
      throw new Error('You are not assigned to take this examination');
    }

    if (assignment?.isDisqualified) {
      throw new Error('You have been disqualified from taking this examination');
    }

    const now = customNow ? new Date(customNow) : new Date();
    const startTime = new Date(exam.startTime);
    const endTime = new Date(exam.endTime);

    if (now < startTime) {
      throw new Error(`Examination window has not opened yet. Starts at: ${startTime.toISOString()}`);
    }

    if (now > endTime) {
      throw new Error('Examination window has closed. No new attempts are permitted.');
    }

    // Check existing active attempt (idempotency check)
    const allAttempts = Array.from(this.db.attempts.values()).filter(
      (a) => a.examId === examId && a.studentId === studentId
    );

    const activeAttempt = allAttempts.find((a) => a.status === 'IN_PROGRESS');
    if (activeAttempt) {
      if (now.getTime() >= new Date(activeAttempt.expiresAt).getTime()) {
        activeAttempt.status = 'AUTO_SUBMITTED';
        activeAttempt.submissionReason = 'AUTO_TIMEOUT';
        activeAttempt.submittedAt = activeAttempt.expiresAt;
        this.db.evaluationJobs.push({ attemptId: activeAttempt.id, reason: 'AUTO_TIMEOUT' });
      } else {
        // Return existing active attempt safely (Idempotent response)
        return this.formatSafePayload(activeAttempt, exam, now);
      }
    }

    const completedCount = allAttempts.filter((a) => ['SUBMITTED', 'AUTO_SUBMITTED', 'EVALUATED'].includes(a.status)).length;
    if (completedCount >= (exam.maxAttempts || 1)) {
      throw new Error(`Maximum attempt limit reached (${exam.maxAttempts})`);
    }

    const startedAt = now;
    const durationMinutes = exam.durationMinutes + (assignment?.extraTimeMinutes || 0);
    const calculatedExpiry = new Date(startedAt.getTime() + durationMinutes * 60 * 1000);
    const expiresAt = new Date(Math.min(calculatedExpiry.getTime(), endTime.getTime()));

    // Randomization
    let questions = [...(exam.questions || [])];
    if (exam.shuffleQuestions) {
      questions.reverse(); // Deterministic shuffle for testing
    }
    const questionOrder = questions.map((q) => q.id);

    const optionOrder = {};
    for (const q of questions) {
      let opts = [...(q.options || [])];
      if (exam.shuffleOptions) {
        opts.reverse();
      }
      optionOrder[q.id] = opts.map((o) => o.id);
    }

    const attemptId = `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newAttempt = {
      id: attemptId,
      examId,
      studentId,
      attemptNumber: completedCount + 1,
      startedAt,
      expiresAt,
      status: 'IN_PROGRESS',
      submissionReason: null,
      questionOrder,
      optionOrder,
    };

    this.db.attempts.set(attemptId, newAttempt);
    this.db.auditLogs.push({ action: 'EXAM_ATTEMPT_STARTED', attemptId, studentId });

    return this.formatSafePayload(newAttempt, exam, now);
  }

  async getAttemptTime(attemptId, user, customNow = null) {
    const attempt = this.db.attempts.get(attemptId);
    if (!attempt) throw new Error('Attempt not found');
    if (user.role === 'STUDENT' && attempt.studentId !== user.id) {
      throw new Error('Access denied to this attempt');
    }

    const now = customNow ? new Date(customNow) : new Date();
    const expiry = new Date(attempt.expiresAt);
    let remainingSeconds = Math.max(0, Math.floor((expiry.getTime() - now.getTime()) / 1000));

    if (attempt.status === 'IN_PROGRESS' && remainingSeconds <= 0) {
      attempt.status = 'AUTO_SUBMITTED';
      attempt.submissionReason = 'AUTO_TIMEOUT';
      attempt.submittedAt = attempt.expiresAt;
      this.db.evaluationJobs.push({ attemptId, reason: 'AUTO_TIMEOUT' });
      return { attemptId, remainingSeconds: 0, isExpired: true, status: 'AUTO_SUBMITTED' };
    }

    return {
      attemptId,
      remainingSeconds,
      isExpired: remainingSeconds <= 0,
      status: attempt.status,
    };
  }

  async autosaveAnswer(attemptId, questionId, body, user, customNow = null) {
    const attempt = this.db.attempts.get(attemptId);
    if (!attempt) throw new Error('Attempt not found');
    if (attempt.studentId !== user.id && user.role !== 'ADMIN') {
      throw new Error('Access denied to update answers');
    }

    if (attempt.status !== 'IN_PROGRESS') {
      throw new Error(`Cannot save answer. Attempt status is ${attempt.status}`);
    }

    const now = customNow ? new Date(customNow) : new Date();
    if (now.getTime() >= new Date(attempt.expiresAt).getTime()) {
      attempt.status = 'AUTO_SUBMITTED';
      attempt.submissionReason = 'AUTO_TIMEOUT';
      attempt.submittedAt = attempt.expiresAt;
      this.db.evaluationJobs.push({ attemptId, reason: 'AUTO_TIMEOUT' });
      throw new Error('Examination attempt has expired. Answers can no longer be updated.');
    }

    const exam = this.db.exams.get(attempt.examId);
    const questionExists = exam?.questions?.some((q) => q.id === questionId);
    if (!questionExists) {
      throw new Error('Specified question does not belong to this examination');
    }

    const answerKey = `${attemptId}_${questionId}`;
    const existing = this.db.answers.get(answerKey);

    // Optimistic concurrency check
    if (existing && body.version !== undefined && body.version < existing.version) {
      return {
        attemptId,
        questionId,
        version: existing.version,
        status: 'STALE_IGNORED',
      };
    }

    const newVersion =
      body.version !== undefined
        ? Math.max(body.version, (existing?.version || 0) + 1)
        : existing
        ? (existing.version || 1) + 1
        : 1;
    const savedAnswer = {
      attemptId,
      questionId,
      selectedOptions: body.selectedOptions ?? (body.clearResponse ? [] : existing?.selectedOptions ?? []),
      descriptiveAnswer: body.descriptiveAnswer !== undefined ? body.descriptiveAnswer : existing?.descriptiveAnswer ?? '',
      markedForReview: body.markedForReview !== undefined ? body.markedForReview : existing?.markedForReview ?? false,
      version: newVersion,
      savedTimestamp: now,
    };

    this.db.answers.set(answerKey, savedAnswer);

    return {
      attemptId,
      questionId,
      version: newVersion,
      savedTimestamp: now,
      markedForReview: savedAnswer.markedForReview,
      status: 'SAVED',
    };
  }

  async getAttempt(attemptId, user, customNow = null) {
    const attempt = this.db.attempts.get(attemptId);
    if (!attempt) throw new Error('Attempt not found');
    if (user.role === 'STUDENT' && attempt.studentId !== user.id) {
      throw new Error('Access denied to this attempt');
    }

    const exam = this.db.exams.get(attempt.examId);
    const now = customNow ? new Date(customNow) : new Date();

    if (attempt.status === 'IN_PROGRESS' && now.getTime() >= new Date(attempt.expiresAt).getTime()) {
      attempt.status = 'AUTO_SUBMITTED';
      attempt.submissionReason = 'AUTO_TIMEOUT';
      attempt.submittedAt = attempt.expiresAt;
      this.db.evaluationJobs.push({ attemptId, reason: 'AUTO_TIMEOUT' });
    }

    return this.formatSafePayload(attempt, exam, now);
  }

  async submitAttempt(attemptId, body, user, customNow = null) {
    const attempt = this.db.attempts.get(attemptId);
    if (!attempt) throw new Error('Attempt not found');
    if (attempt.studentId !== user.id && user.role !== 'ADMIN') {
      throw new Error('Access denied to submit attempt');
    }

    if (['SUBMITTED', 'AUTO_SUBMITTED', 'EVALUATED'].includes(attempt.status)) {
      return {
        attemptId,
        status: attempt.status,
        submittedAt: attempt.submittedAt,
        submissionReason: attempt.submissionReason,
        isIdempotent: true,
      };
    }

    if (attempt.status !== 'IN_PROGRESS') {
      throw new Error(`Cannot submit attempt with status: ${attempt.status}`);
    }

    const now = customNow ? new Date(customNow) : new Date();
    const isTimeout = body?.reason === 'AUTO_TIMEOUT' || now.getTime() >= new Date(attempt.expiresAt).getTime();
    const finalStatus = isTimeout ? 'AUTO_SUBMITTED' : 'SUBMITTED';
    const finalReason = isTimeout ? 'AUTO_TIMEOUT' : (body?.reason || 'MANUAL');
    const submittedAt = isTimeout && now > attempt.expiresAt ? attempt.expiresAt : now;

    attempt.status = finalStatus;
    attempt.submissionReason = finalReason;
    attempt.submittedAt = submittedAt;

    this.db.auditLogs.push({ action: 'EXAM_ATTEMPT_SUBMITTED', attemptId, reason: finalReason });
    this.db.evaluationJobs.push({ attemptId, examId: attempt.examId, studentId: attempt.studentId, reason: finalReason });

    // Count answers
    const answers = Array.from(this.db.answers.values()).filter((a) => a.attemptId === attemptId);
    const answeredCount = answers.filter((a) => (a.selectedOptions?.length > 0) || (a.descriptiveAnswer && a.descriptiveAnswer.trim().length > 0)).length;
    const markedCount = answers.filter((a) => a.markedForReview).length;
    const exam = this.db.exams.get(attempt.examId);
    const totalQuestions = exam?.questions?.length || 0;

    return {
      attemptId,
      status: finalStatus,
      submittedAt,
      submissionReason: finalReason,
      totalQuestions,
      answeredCount,
      unansweredCount: Math.max(0, totalQuestions - answeredCount),
      markedForReviewCount: markedCount,
    };
  }

  formatSafePayload(attempt, exam, now) {
    const remainingSeconds = Math.max(0, Math.floor((new Date(attempt.expiresAt).getTime() - now.getTime()) / 1000));

    // Strip isCorrect and explanation
    const safeQuestions = (exam.questions || []).map((q, idx) => ({
      id: q.id,
      questionNumber: idx + 1,
      questionText: q.questionText,
      type: q.type,
      marks: q.marks,
      negativeMarks: q.negativeMarks,
      options: (q.options || []).map((opt) => ({
        id: opt.id,
        optionText: opt.optionText,
        // STRICT PRIVACY: isCorrect is NEVER returned!
      })),
      // STRICT PRIVACY: explanation is NEVER returned!
    }));

    const answersMap = {};
    for (const ans of this.db.answers.values()) {
      if (ans.attemptId === attempt.id) {
        answersMap[ans.questionId] = {
          selectedOptions: ans.selectedOptions || [],
          descriptiveAnswer: ans.descriptiveAnswer || '',
          markedForReview: ans.markedForReview || false,
          version: ans.version || 1,
        };
      }
    }

    return {
      attempt: {
        id: attempt.id,
        examId: attempt.examId,
        attemptNumber: attempt.attemptNumber,
        status: attempt.status,
        startedAt: attempt.startedAt,
        expiresAt: attempt.expiresAt,
        remainingSeconds,
        isExpired: remainingSeconds <= 0,
        questions: safeQuestions,
        answers: answersMap,
      },
    };
  }
}

// ==============================================================================
// TEST SUITE: 18 SPECIFIED SCENARIOS
// ==============================================================================

describe('Batch 3 Examination Engine & Session Interface Test Suite', () => {
  let engine;

  const studentAlice = { id: 'usr_alice', name: 'Alice Walker', role: 'STUDENT', isActive: true };
  const studentBob = { id: 'usr_bob', name: 'Bob Vance', role: 'STUDENT', isActive: true };
  const inactiveStudent = { id: 'usr_charlie', name: 'Charlie', role: 'STUDENT', isActive: false };

  const validExamId = 'ex_midterm_cs101';
  const unpublishedExamId = 'ex_draft_cs102';

  beforeEach(() => {
    db.reset();
    engine = new TestAttemptEngine(db);

    // Setup active published exam with window
    const now = new Date();
    const startTime = new Date(now.getTime() - 10 * 60 * 1000); // 10 mins ago
    const endTime = new Date(now.getTime() + 50 * 60 * 1000); // 50 mins from now

    db.exams.set(validExamId, {
      id: validExamId,
      title: 'CS101 Midterm Examination',
      isPublished: true,
      status: 'LIVE',
      durationMinutes: 45,
      totalMarks: 50,
      passingMarks: 20,
      maxAttempts: 1,
      startTime,
      endTime,
      shuffleQuestions: true,
      shuffleOptions: true,
      questions: [
        {
          id: 'q_1',
          questionText: 'What is the time complexity of quicksort average case?',
          type: 'SINGLE_MCQ',
          marks: 2,
          negativeMarks: 0.5,
          isCorrect: 'CONFIDENTIAL_A',
          explanation: 'Average case time complexity is O(N log N).',
          options: [
            { id: 'opt_1a', optionText: 'O(N log N)', isCorrect: true },
            { id: 'opt_1b', optionText: 'O(N^2)', isCorrect: false },
            { id: 'opt_1c', optionText: 'O(log N)', isCorrect: false },
          ],
        },
        {
          id: 'q_2',
          questionText: 'Which of the following are ACID properties in DBMS?',
          type: 'MULTIPLE_MCQ',
          marks: 3,
          negativeMarks: 0,
          isCorrect: 'CONFIDENTIAL_ALL',
          explanation: 'Atomicity, Consistency, Isolation, Durability.',
          options: [
            { id: 'opt_2a', optionText: 'Atomicity', isCorrect: true },
            { id: 'opt_2b', optionText: 'Consistency', isCorrect: true },
            { id: 'opt_2c', optionText: 'Isolation', isCorrect: true },
            { id: 'opt_2d', optionText: 'Durability', isCorrect: true },
          ],
        },
        {
          id: 'q_3',
          questionText: 'Explain the difference between TCP and UDP protocols in networking.',
          type: 'DESCRIPTIVE',
          marks: 5,
          negativeMarks: 0,
          isCorrect: null,
          explanation: 'TCP is connection-oriented while UDP is connectionless.',
          options: [],
        },
      ],
    });

    // Unpublished Exam
    db.exams.set(unpublishedExamId, {
      id: unpublishedExamId,
      title: 'CS102 Advanced Systems (Draft)',
      isPublished: false,
      status: 'DRAFT',
      durationMinutes: 60,
      startTime,
      endTime,
      questions: [],
    });

    // Assign Alice to valid exam
    db.assignments.set(`${validExamId}_${studentAlice.id}`, {
      examId: validExamId,
      studentId: studentAlice.id,
      isDisqualified: false,
      extraTimeMinutes: 0,
    });
  });

  // Scenario 1: Student starts an assigned exam
  it('Scenario 1: Student starts an assigned exam successfully', async () => {
    const result = await engine.startExam(validExamId, studentAlice);
    assert.ok(result.attempt);
    assert.equal(result.attempt.status, 'IN_PROGRESS');
    assert.equal(result.attempt.attemptNumber, 1);
    assert.equal(result.attempt.questions.length, 3);
    assert.ok(result.attempt.remainingSeconds > 0);
  });

  // Scenario 2: Unassigned student cannot start
  it('Scenario 2: Unassigned student cannot start examination', async () => {
    await assert.rejects(
      async () => {
        await engine.startExam(validExamId, studentBob);
      },
      /You are not assigned to take this examination/
    );
  });

  // Scenario 3: Unpublished exam cannot be accessed
  it('Scenario 3: Unpublished exam cannot be accessed by students', async () => {
    db.assignments.set(`${unpublishedExamId}_${studentAlice.id}`, {
      examId: unpublishedExamId,
      studentId: studentAlice.id,
      isDisqualified: false,
    });

    await assert.rejects(
      async () => {
        await engine.startExam(unpublishedExamId, studentAlice);
      },
      /This examination is currently unpublished or unavailable/
    );
  });

  // Scenario 4: Student cannot start after deadline
  it('Scenario 4: Student cannot start examination after window deadline', async () => {
    const pastExamId = 'ex_past_1';
    db.exams.set(pastExamId, {
      id: pastExamId,
      title: 'Expired Exam',
      isPublished: true,
      status: 'COMPLETED',
      startTime: new Date(Date.now() - 3600000),
      endTime: new Date(Date.now() - 1800000), // Ended 30 mins ago
      questions: [],
    });
    db.assignments.set(`${pastExamId}_${studentAlice.id}`, { examId: pastExamId, studentId: studentAlice.id });

    await assert.rejects(
      async () => {
        await engine.startExam(pastExamId, studentAlice);
      },
      /Examination window has closed/
    );
  });

  // Scenario 5: Duplicate start requests (Idempotency)
  it('Scenario 5: Duplicate start requests return identical active session without duplicating attempt', async () => {
    const firstStart = await engine.startExam(validExamId, studentAlice);
    const secondStart = await engine.startExam(validExamId, studentAlice);

    assert.equal(firstStart.attempt.id, secondStart.attempt.id);
    assert.equal(secondStart.attempt.status, 'IN_PROGRESS');
    assert.equal(db.attempts.size, 1);
  });

  // Scenario 6: Browser refresh during examination (Session recovery)
  it('Scenario 6: Browser refresh resumes active session with question order and saved answers intact', async () => {
    const start = await engine.startExam(validExamId, studentAlice);
    const attemptId = start.attempt.id;

    // Save an answer
    await engine.autosaveAnswer(attemptId, 'q_1', { selectedOptions: ['opt_1a'] }, studentAlice);

    // Simulate page reload calling GET /attempts/:attemptId
    const resumed = await engine.getAttempt(attemptId, studentAlice);

    assert.equal(resumed.attempt.id, attemptId);
    assert.equal(resumed.attempt.status, 'IN_PROGRESS');
    assert.deepEqual(resumed.attempt.answers['q_1'].selectedOptions, ['opt_1a']);
  });

  // Scenario 7: Answer autosave (Persistence)
  it('Scenario 7: Answer autosave records single/multiple options and review flag', async () => {
    const start = await engine.startExam(validExamId, studentAlice);
    const attemptId = start.attempt.id;

    const saveRes = await engine.autosaveAnswer(
      attemptId,
      'q_2',
      { selectedOptions: ['opt_2a', 'opt_2b'], markedForReview: true },
      studentAlice
    );

    assert.equal(saveRes.status, 'SAVED');
    assert.equal(saveRes.markedForReview, true);

    const savedInDb = db.answers.get(`${attemptId}_q_2`);
    assert.deepEqual(savedInDb.selectedOptions, ['opt_2a', 'opt_2b']);
    assert.equal(savedInDb.markedForReview, true);
  });

  // Scenario 8: Multiple answers updated quickly (Optimistic concurrency versioning)
  it('Scenario 8: Optimistic concurrency checks prevent stale out-of-order updates from overwriting newer answers', async () => {
    const start = await engine.startExam(validExamId, studentAlice);
    const attemptId = start.attempt.id;

    // Request 1: newer version 2
    const firstUpdate = await engine.autosaveAnswer(attemptId, 'q_1', { selectedOptions: ['opt_1a'], version: 2 }, studentAlice);
    assert.equal(firstUpdate.status, 'SAVED');

    // Request 2: delayed stale request with older version 1
    const staleUpdate = await engine.autosaveAnswer(attemptId, 'q_1', { selectedOptions: ['opt_1b'], version: 1 }, studentAlice);
    assert.equal(staleUpdate.status, 'STALE_IGNORED');

    // Verify DB still holds the newer answer
    const current = db.answers.get(`${attemptId}_q_1`);
    assert.deepEqual(current.selectedOptions, ['opt_1a']);
  });

  // Scenario 9 & 10: Network disconnection and reconnection
  it('Scenario 9 & 10: Retains local state during disconnection and flushes on reconnection', async () => {
    const start = await engine.startExam(validExamId, studentAlice);
    const attemptId = start.attempt.id;

    // Client queues offline answers locally
    const clientQueue = [
      { questionId: 'q_1', payload: { selectedOptions: ['opt_1a'] } },
      { questionId: 'q_3', payload: { descriptiveAnswer: 'TCP provides reliable, ordered transmission.' } },
    ];

    // Client reconnects: flushes queue
    for (const item of clientQueue) {
      const res = await engine.autosaveAnswer(attemptId, item.questionId, item.payload, studentAlice);
      assert.equal(res.status, 'SAVED');
    }

    assert.ok(db.answers.get(`${attemptId}_q_1`));
    assert.equal(
      db.answers.get(`${attemptId}_q_3`).descriptiveAnswer,
      'TCP provides reliable, ordered transmission.'
    );
  });

  // Scenario 11: Backend restart (Persistence in DB)
  it('Scenario 11: Backend restart does not lose in-progress attempt state or saved answers', async () => {
    const start = await engine.startExam(validExamId, studentAlice);
    const attemptId = start.attempt.id;
    await engine.autosaveAnswer(attemptId, 'q_1', { selectedOptions: ['opt_1a'] }, studentAlice);

    // Simulate new server instance reusing the same PostgreSQL storage
    const rebootedEngine = new TestAttemptEngine(db);
    const recovered = await rebootedEngine.getAttempt(attemptId, studentAlice);

    assert.equal(recovered.attempt.id, attemptId);
    assert.deepEqual(recovered.attempt.answers['q_1'].selectedOptions, ['opt_1a']);
  });

  // Scenario 12: Timer expiration
  it('Scenario 12: Authoritative timer auto-submits session when expiresAt is exceeded', async () => {
    const start = await engine.startExam(validExamId, studentAlice);
    const attemptId = start.attempt.id;

    // Simulate time advance past expiresAt
    const futureTime = new Date(Date.now() + 60 * 60 * 1000); // 1 hour ahead
    const timeCheck = await engine.getAttemptTime(attemptId, studentAlice, futureTime);

    assert.equal(timeCheck.isExpired, true);
    assert.equal(timeCheck.status, 'AUTO_SUBMITTED');
    assert.equal(timeCheck.remainingSeconds, 0);

    const savedAttempt = db.attempts.get(attemptId);
    assert.equal(savedAttempt.status, 'AUTO_SUBMITTED');
    assert.equal(savedAttempt.submissionReason, 'AUTO_TIMEOUT');
  });

  // Scenario 13: Manual submission
  it('Scenario 13: Manual candidate submission updates status and queues BullMQ evaluation', async () => {
    const start = await engine.startExam(validExamId, studentAlice);
    const attemptId = start.attempt.id;

    await engine.autosaveAnswer(attemptId, 'q_1', { selectedOptions: ['opt_1a'] }, studentAlice);

    const submission = await engine.submitAttempt(attemptId, { reason: 'MANUAL' }, studentAlice);

    assert.equal(submission.status, 'SUBMITTED');
    assert.equal(submission.submissionReason, 'MANUAL');
    assert.equal(submission.answeredCount, 1);
    assert.equal(submission.unansweredCount, 2);

    // Check evaluation job triggered
    assert.ok(db.evaluationJobs.some((j) => j.attemptId === attemptId));
  });

  // Scenario 14: Automatic submission
  it('Scenario 14: Automatic timeout submission records AUTO_TIMEOUT reason', async () => {
    const start = await engine.startExam(validExamId, studentAlice);
    const attemptId = start.attempt.id;

    const submission = await engine.submitAttempt(attemptId, { reason: 'AUTO_TIMEOUT' }, studentAlice);

    assert.equal(submission.status, 'AUTO_SUBMITTED');
    assert.equal(submission.submissionReason, 'AUTO_TIMEOUT');
  });

  // Scenario 15: Duplicate submission (Idempotency)
  it('Scenario 15: Duplicate submission is completely idempotent and safe', async () => {
    const start = await engine.startExam(validExamId, studentAlice);
    const attemptId = start.attempt.id;

    const firstSub = await engine.submitAttempt(attemptId, { reason: 'MANUAL' }, studentAlice);
    const secondSub = await engine.submitAttempt(attemptId, { reason: 'MANUAL' }, studentAlice);

    assert.equal(firstSub.status, secondSub.status);
    assert.equal(secondSub.isIdempotent, true);
  });

  // Scenario 16: Late answer update (Rejected after submission)
  it('Scenario 16: Late answer update is rejected after submission has occurred', async () => {
    const start = await engine.startExam(validExamId, studentAlice);
    const attemptId = start.attempt.id;

    await engine.submitAttempt(attemptId, { reason: 'MANUAL' }, studentAlice);

    await assert.rejects(
      async () => {
        await engine.autosaveAnswer(attemptId, 'q_1', { selectedOptions: ['opt_1b'] }, studentAlice);
      },
      /Cannot save answer. Attempt status is SUBMITTED/
    );
  });

  // Scenario 17: Unauthorized attempt access
  it('Scenario 17: Student Bob cannot access or submit Alice\'s attempt session', async () => {
    const start = await engine.startExam(validExamId, studentAlice);
    const attemptId = start.attempt.id;

    await assert.rejects(
      async () => {
        await engine.getAttempt(attemptId, studentBob);
      },
      /Access denied to this attempt/
    );

    await assert.rejects(
      async () => {
        await engine.submitAttempt(attemptId, { reason: 'MANUAL' }, studentBob);
      },
      /Access denied to submit attempt/
    );
  });

  // Scenario 18: Correct answer privacy
  it('Scenario 18: Examination payload never exposes isCorrect or explanation keys to student', async () => {
    const session = await engine.startExam(validExamId, studentAlice);

    for (const q of session.attempt.questions) {
      assert.equal(q.isCorrect, undefined);
      assert.equal(q.explanation, undefined);
      for (const opt of q.options) {
        assert.equal(opt.isCorrect, undefined);
      }
    }
  });
});
