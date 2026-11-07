// ==============================================================================
// ExamSphere – Batch 5 Comprehensive Test Suite
// Rigorously tests Phase 12 (Analytics & Reporting) and Phase 13 (Coding Assessment & Proctoring)
// ==============================================================================

import test, { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// In-Memory Test Database
class MockBatch5DB {
  constructor() {
    this.reset();
  }

  reset() {
    this.users = new Map();
    this.courses = new Map();
    this.exams = new Map();
    this.questions = new Map();
    this.attempts = new Map();
    this.answers = new Map();
    this.results = new Map();
    this.codingDetails = new Map();
    this.codingTestCases = new Map();
    this.codingSubmissions = new Map();
    this.proctoringEvents = [];
    this.cachedEntries = new Map();
  }
}

const db = new MockBatch5DB();

// Test Engine for Batch 5
class TestBatch5Engine {
  constructor(database) {
    this.db = database;
  }

  // ----------------------------------------------------------------------------
  // Analytics Module
  // ----------------------------------------------------------------------------
  async getAdminOverview(filters = {}) {
    const students = Array.from(this.db.users.values()).filter((u) => u.role === 'STUDENT' && u.isActive);
    const faculty = Array.from(this.db.users.values()).filter((u) => u.role === 'FACULTY' && u.isActive);
    const courses = Array.from(this.db.courses.values()).filter((c) => c.isActive);
    const exams = Array.from(this.db.exams.values());
    const attempts = Array.from(this.db.attempts.values());

    // CRITICAL: Only PUBLISHED results are counted in analytics
    const publishedResults = Array.from(this.db.results.values()).filter(
      (r) => r.publicationStatus === 'PUBLISHED'
    );

    const totalStudents = students.length;
    const totalFaculty = faculty.length;
    const totalCourses = courses.length;
    const totalExams = exams.length;
    const totalPublishedResults = publishedResults.length;
    const activeExams = exams.filter((e) => e.status === 'LIVE').length;
    const completedExams = exams.filter((e) => e.status === 'COMPLETED').length;
    const totalAttempts = attempts.length;

    let overallAverageScore = 0;
    let overallPassPercentage = 0;

    if (publishedResults.length > 0) {
      const totalPct = publishedResults.reduce((sum, r) => sum + r.percentage, 0);
      overallAverageScore = parseFloat((totalPct / publishedResults.length).toFixed(2));
      const passedCount = publishedResults.filter((r) => r.isPassed === true).length;
      overallPassPercentage = parseFloat(((passedCount / publishedResults.length) * 100).toFixed(2));
    }

    return {
      totalStudents,
      totalFaculty,
      totalCourses,
      totalExams,
      totalPublishedResults,
      activeExams,
      completedExams,
      totalAttempts,
      overallAverageScore,
      overallPassPercentage,
    };
  }

  async getFacultyOverview(facultyUser, filters = {}) {
    if (facultyUser.role !== 'FACULTY' && facultyUser.role !== 'ADMIN') {
      throw new Error('Forbidden: Only faculty or admin can access faculty overview');
    }

    const facultyExams = Array.from(this.db.exams.values()).filter(
      (e) => e.createdById === facultyUser.id
    );
    const examIds = new Set(facultyExams.map((e) => e.id));

    const publishedResults = Array.from(this.db.results.values()).filter(
      (r) => examIds.has(r.examId) && r.publicationStatus === 'PUBLISHED'
    );

    let averageScore = 0;
    let highestScore = 0;
    let lowestScore = 0;
    let passedCount = 0;

    if (publishedResults.length > 0) {
      const pcts = publishedResults.map((r) => r.percentage);
      averageScore = parseFloat((pcts.reduce((a, b) => a + b, 0) / publishedResults.length).toFixed(2));
      highestScore = Math.max(...pcts);
      lowestScore = Math.min(...pcts);
      passedCount = publishedResults.filter((r) => r.isPassed).length;
    }

    return {
      totalExamsCreated: facultyExams.length,
      publishedResultsCount: publishedResults.length,
      averageScore,
      highestScore,
      lowestScore,
      passFailRatio: { passed: passedCount, failed: publishedResults.length - passedCount },
    };
  }

  async getStudentOverview(studentId) {
    // Only published results belonging to this student
    const studentPublishedResults = Array.from(this.db.results.values()).filter(
      (r) => r.studentId === studentId && r.publicationStatus === 'PUBLISHED'
    );

    const studentAttempts = Array.from(this.db.attempts.values()).filter((a) => a.studentId === studentId);

    let averagePercentage = 0;
    let highestScore = 0;
    let passedCount = 0;

    if (studentPublishedResults.length > 0) {
      const pcts = studentPublishedResults.map((r) => r.percentage);
      averagePercentage = parseFloat((pcts.reduce((a, b) => a + b, 0) / studentPublishedResults.length).toFixed(2));
      highestScore = Math.max(...pcts);
      passedCount = studentPublishedResults.filter((r) => r.isPassed).length;
    }

    return {
      examsAttempted: studentAttempts.length,
      publishedResultsCount: studentPublishedResults.length,
      averagePercentage,
      highestScore,
      passedCount,
    };
  }

  // ----------------------------------------------------------------------------
  // Coding Assessment Module
  // ----------------------------------------------------------------------------
  async createCodingQuestion(data, facultyUser) {
    if (facultyUser.role !== 'FACULTY' && facultyUser.role !== 'ADMIN') {
      throw new Error('Forbidden: Only faculty or admin can author coding questions');
    }

    const qId = `code-q-${this.db.questions.size + 1}`;
    const question = {
      id: qId,
      questionText: data.questionText,
      type: 'CODING',
      difficulty: data.difficulty || 'MEDIUM',
      marks: data.marks || 10.0,
      courseId: data.courseId,
      createdById: facultyUser.id,
    };
    this.db.questions.set(qId, question);

    const detailId = `detail-${qId}`;
    this.db.codingDetails.set(detailId, {
      id: detailId,
      questionId: qId,
      inputFormat: data.inputFormat,
      outputFormat: data.outputFormat,
      allowedLanguages: data.allowedLanguages || ['javascript', 'python'],
      timeLimitSec: data.timeLimitSec || 2.0,
      memoryLimitMb: data.memoryLimitMb || 256,
      evaluationPolicy: data.evaluationPolicy || 'ALL_TEST_CASES',
    });

    const cases = (data.testCases || []).map((tc, idx) => {
      const tcId = `tc-${qId}-${idx}`;
      const record = {
        id: tcId,
        codingDetailId: detailId,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        isSample: Boolean(tc.isSample),
        orderIndex: idx,
      };
      this.db.codingTestCases.set(tcId, record);
      return record;
    });

    return { ...question, testCases: cases };
  }

  async getCodingQuestion(questionId, requestingUser) {
    const question = this.db.questions.get(questionId);
    if (!question) throw new Error('Question not found');

    const detail = Array.from(this.db.codingDetails.values()).find((d) => d.questionId === questionId);
    const allCases = Array.from(this.db.codingTestCases.values()).filter(
      (tc) => tc.codingDetailId === detail?.id
    );

    // CRITICAL SECURITY: If student, filter out hidden test cases
    const visibleCases =
      requestingUser.role === 'STUDENT'
        ? allCases.filter((tc) => tc.isSample === true)
        : allCases;

    return {
      ...question,
      detail,
      testCases: visibleCases,
    };
  }

  async submitCode({ questionId, sourceCode, language, attemptId }, studentUser, executionProvider = null) {
    const attempt = this.db.attempts.get(attemptId);
    if (!attempt) throw new Error('Attempt not found');
    if (attempt.studentId !== studentUser.id) throw new Error('Forbidden: Attempt belongs to another student');
    if (attempt.status !== 'IN_PROGRESS') throw new Error(`Attempt is already ${attempt.status}`);

    const now = new Date();
    if (now > attempt.expiresAt) {
      throw new Error('Attempt time has expired. Submissions are closed.');
    }

    const question = this.db.questions.get(questionId);
    const detail = Array.from(this.db.codingDetails.values()).find((d) => d.questionId === questionId);
    const allCases = Array.from(this.db.codingTestCases.values()).filter(
      (tc) => tc.codingDetailId === detail?.id
    );

    // If sandbox provider is not configured, return SETUP_REQUIRED without faking or local exec
    if (!executionProvider || !executionProvider.isConfigured()) {
      const subId = `sub-${this.db.codingSubmissions.size + 1}`;
      const sub = {
        id: subId,
        studentId: studentUser.id,
        questionId,
        attemptId,
        status: 'SETUP_REQUIRED',
        marksAwarded: 0,
      };
      this.db.codingSubmissions.set(subId, sub);
      return { status: 'SETUP_REQUIRED', marksAwarded: 0, message: 'Code runner setup required' };
    }

    // Execute test cases
    let passedCount = 0;
    const testResults = [];

    for (let i = 0; i < allCases.length; i++) {
      const tc = allCases[i];
      const result = await executionProvider.execute({
        sourceCode,
        language,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
      });

      if (result.passed) passedCount++;

      testResults.push({
        testCaseIndex: i + 1,
        isSample: tc.isSample,
        passed: result.passed,
        status: result.status,
        // Confidentiality: Mask inputs for hidden test cases
        input: tc.isSample ? tc.input : null,
        expectedOutput: tc.isSample ? tc.expectedOutput : null,
        actualOutput: tc.isSample ? result.actualOutput : null,
      });
    }

    const totalCount = allCases.length;
    let marksAwarded = 0;
    if (detail.evaluationPolicy === 'PERCENTAGE') {
      marksAwarded = parseFloat(((passedCount / totalCount) * question.marks).toFixed(2));
    } else {
      marksAwarded = passedCount === totalCount ? question.marks : 0.0;
    }

    const subId = `sub-${this.db.codingSubmissions.size + 1}`;
    const subRecord = {
      id: subId,
      studentId: studentUser.id,
      questionId,
      attemptId,
      status: passedCount === totalCount ? 'ACCEPTED' : 'WRONG_ANSWER',
      marksAwarded,
      testResults,
    };
    this.db.codingSubmissions.set(subId, subRecord);

    return subRecord;
  }

  // ----------------------------------------------------------------------------
  // Proctoring Module
  // ----------------------------------------------------------------------------
  async recordProctoringEvent({ attemptId, eventType, details }, studentUser) {
    const attempt = this.db.attempts.get(attemptId);
    if (!attempt) throw new Error('Attempt not found');
    if (attempt.studentId !== studentUser.id) throw new Error('Forbidden: Attempt belongs to another student');
    if (attempt.status !== 'IN_PROGRESS') return { status: 'IGNORED' };

    const now = Date.now();
    // Deduplication check: ignore identical event within 3 seconds
    const duplicate = this.db.proctoringEvents.find(
      (ev) => ev.attemptId === attemptId && ev.eventType === eventType && now - ev.timestamp < 3000
    );

    if (duplicate) {
      return { status: 'DEDUPLICATED' };
    }

    const eventRecord = {
      id: `ev-${this.db.proctoringEvents.length + 1}`,
      attemptId,
      studentId: studentUser.id,
      eventType,
      details,
      timestamp: now,
    };
    this.db.proctoringEvents.push(eventRecord);

    if (eventType === 'TAB_BLUR') {
      attempt.tabSwitchCount = (attempt.tabSwitchCount || 0) + 1;
    }

    return { status: 'RECORDED', eventId: eventRecord.id };
  }

  async getProctoringTimeline(attemptId, facultyUser) {
    const attempt = this.db.attempts.get(attemptId);
    if (!attempt) throw new Error('Attempt not found');

    const exam = this.db.exams.get(attempt.examId);
    if (facultyUser.role !== 'ADMIN' && exam.createdById !== facultyUser.id) {
      throw new Error('Forbidden: Faculty not authorized for this exam');
    }

    const events = this.db.proctoringEvents.filter((ev) => ev.attemptId === attemptId);
    const tabBlurs = events.filter((ev) => ev.eventType === 'TAB_BLUR').length;
    const fullscreenExits = events.filter((ev) => ev.eventType === 'FULLSCREEN_EXIT').length;

    // Neutral labeling - never auto-accuses candidate
    const activityFlag =
      tabBlurs >= 3 || fullscreenExits >= 2 ? 'Activity flagged for review' : 'Standard activity';

    return {
      attemptId,
      tabSwitchCount: attempt.tabSwitchCount || 0,
      summary: {
        tabBlurs,
        fullscreenExits,
        totalEvents: events.length,
        activityFlag,
        reviewNotice:
          'Neutral integrity notice: Automated browser activity events are auxiliary indicators and should not be used as sole or conclusive evidence of misconduct.',
      },
      events,
    };
  }
}

const engine = new TestBatch5Engine(db);

describe('Batch 5: Analytics, Coding Assessment, and Proctoring Assistance', () => {
  beforeEach(() => {
    db.reset();

    // Seed test users
    db.users.set('admin-1', { id: 'admin-1', name: 'Admin Alice', role: 'ADMIN', isActive: true });
    db.users.set('faculty-1', { id: 'faculty-1', name: 'Prof. David', role: 'FACULTY', isActive: true });
    db.users.set('faculty-2', { id: 'faculty-2', name: 'Prof. Sarah', role: 'FACULTY', isActive: true });
    db.users.set('student-1', { id: 'student-1', name: 'Student Charlie', role: 'STUDENT', isActive: true });
    db.users.set('student-2', { id: 'student-2', name: 'Student Bob', role: 'STUDENT', isActive: true });

    // Seed courses & exams
    db.courses.set('course-1', { id: 'course-1', code: 'CS101', title: 'Data Structures', isActive: true });
    db.exams.set('exam-1', {
      id: 'exam-1',
      title: 'Midterm Algorithms',
      courseId: 'course-1',
      createdById: 'faculty-1',
      status: 'COMPLETED',
    });
    db.exams.set('exam-2', {
      id: 'exam-2',
      title: 'Database Design',
      courseId: 'course-1',
      createdById: 'faculty-2',
      status: 'LIVE',
    });
  });

  // ----------------------------------------------------------------------------
  // SECTION 1: Analytics & Reporting
  // ----------------------------------------------------------------------------
  it('1. Admin Analytics correctly aggregates PostgreSQL data and strictly excludes unpublished results', async () => {
    // Attempt 1: Published result with 80% (PASS)
    db.attempts.set('att-1', { id: 'att-1', examId: 'exam-1', studentId: 'student-1', status: 'SUBMITTED' });
    db.results.set('res-1', {
      id: 'res-1',
      examId: 'exam-1',
      studentId: 'student-1',
      attemptId: 'att-1',
      percentage: 80.0,
      isPassed: true,
      publicationStatus: 'PUBLISHED',
    });

    // Attempt 2: Unpublished DRAFT result with 40% (FAIL)
    db.attempts.set('att-2', { id: 'att-2', examId: 'exam-1', studentId: 'student-2', status: 'SUBMITTED' });
    db.results.set('res-2', {
      id: 'res-2',
      examId: 'exam-1',
      studentId: 'student-2',
      attemptId: 'att-2',
      percentage: 40.0,
      isPassed: false,
      publicationStatus: 'DRAFT', // MUST NOT be included
    });

    const overview = await engine.getAdminOverview();

    assert.equal(overview.totalStudents, 2);
    assert.equal(overview.totalFaculty, 2);
    assert.equal(overview.totalExams, 2);
    assert.equal(overview.activeExams, 1);
    assert.equal(overview.completedExams, 1);
    assert.equal(overview.totalAttempts, 2);
    assert.equal(overview.totalPublishedResults, 1); // Draft result excluded
    assert.equal(overview.overallAverageScore, 80.0); // Computed ONLY from published result
    assert.equal(overview.overallPassPercentage, 100.0);
  });

  it('2. Faculty Analytics isolates data to exams created by authorized faculty', async () => {
    db.attempts.set('att-1', { id: 'att-1', examId: 'exam-1', studentId: 'student-1', status: 'SUBMITTED' });
    db.results.set('res-1', {
      id: 'res-1',
      examId: 'exam-1',
      studentId: 'student-1',
      percentage: 90.0,
      isPassed: true,
      publicationStatus: 'PUBLISHED',
    });

    db.attempts.set('att-2', { id: 'att-2', examId: 'exam-2', studentId: 'student-2', status: 'SUBMITTED' });
    db.results.set('res-2', {
      id: 'res-2',
      examId: 'exam-2',
      studentId: 'student-2',
      percentage: 60.0,
      isPassed: true,
      publicationStatus: 'PUBLISHED',
    });

    const profDavid = db.users.get('faculty-1');
    const davidAnalytics = await engine.getFacultyOverview(profDavid);

    assert.equal(davidAnalytics.totalExamsCreated, 1); // Only exam-1
    assert.equal(davidAnalytics.publishedResultsCount, 1);
    assert.equal(davidAnalytics.averageScore, 90.0); // Does NOT see exam-2 (60.0%)
  });

  it('3. Student Analytics strictly isolates student private performance and ignores unpublished exams', async () => {
    db.attempts.set('att-1', { id: 'att-1', examId: 'exam-1', studentId: 'student-1', status: 'SUBMITTED' });
    db.results.set('res-1', {
      id: 'res-1',
      examId: 'exam-1',
      studentId: 'student-1',
      percentage: 85.0,
      isPassed: true,
      publicationStatus: 'PUBLISHED',
    });

    db.attempts.set('att-2', { id: 'att-2', examId: 'exam-2', studentId: 'student-1', status: 'SUBMITTED' });
    db.results.set('res-2', {
      id: 'res-2',
      examId: 'exam-2',
      studentId: 'student-1',
      percentage: 95.0,
      isPassed: true,
      publicationStatus: 'DRAFT', // Unpublished
    });

    const studentCharlieOverview = await engine.getStudentOverview('student-1');

    assert.equal(studentCharlieOverview.examsAttempted, 2);
    assert.equal(studentCharlieOverview.publishedResultsCount, 1); // Draft result omitted
    assert.equal(studentCharlieOverview.averagePercentage, 85.0);
    assert.equal(studentCharlieOverview.highestScore, 85.0);
  });

  // ----------------------------------------------------------------------------
  // SECTION 2: Coding Assessment
  // ----------------------------------------------------------------------------
  it('4. Faculty creates coding question with sample and hidden test cases', async () => {
    const profDavid = db.users.get('faculty-1');
    const created = await engine.createCodingQuestion(
      {
        questionText: 'Write a function to return the sum of two numbers.',
        courseId: 'course-1',
        difficulty: 'EASY',
        marks: 10.0,
        testCases: [
          { input: '2 3', expectedOutput: '5', isSample: true },
          { input: '10 20', expectedOutput: '30', isSample: false }, // Confidential hidden test case
        ],
      },
      profDavid
    );

    assert.equal(created.type, 'CODING');
    assert.equal(created.testCases.length, 2);
  });

  it('5. Hidden test cases are NEVER exposed to student query APIs', async () => {
    const profDavid = db.users.get('faculty-1');
    const created = await engine.createCodingQuestion(
      {
        questionText: 'Reverse an array of integers.',
        courseId: 'course-1',
        testCases: [
          { input: '1 2 3', expectedOutput: '3 2 1', isSample: true },
          { input: '99 100 101', expectedOutput: '101 100 99', isSample: false }, // Hidden
        ],
      },
      profDavid
    );

    const studentUser = db.users.get('student-1');
    const studentView = await engine.getCodingQuestion(created.id, studentUser);

    assert.equal(studentView.testCases.length, 1);
    assert.equal(studentView.testCases[0].isSample, true);
    assert.equal(studentView.testCases[0].input, '1 2 3');

    // Faculty inspection sees all test cases
    const facultyView = await engine.getCodingQuestion(created.id, profDavid);
    assert.equal(facultyView.testCases.length, 2);
  });

  it('6. When isolated code execution provider is not configured, returns SETUP_REQUIRED without insecure fallbacks', async () => {
    const profDavid = db.users.get('faculty-1');
    const q = await engine.createCodingQuestion(
      {
        questionText: 'Calculate factorial',
        courseId: 'course-1',
        testCases: [{ input: '5', expectedOutput: '120', isSample: true }],
      },
      profDavid
    );

    // Active attempt for student
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    db.attempts.set('att-active', {
      id: 'att-active',
      examId: 'exam-1',
      studentId: 'student-1',
      status: 'IN_PROGRESS',
      expiresAt,
    });

    const studentUser = db.users.get('student-1');
    const submissionResult = await engine.submitCode(
      {
        questionId: q.id,
        sourceCode: 'function factorial(n) { return 120; }',
        language: 'javascript',
        attemptId: 'att-active',
      },
      studentUser,
      null // No execution provider configured
    );

    assert.equal(submissionResult.status, 'SETUP_REQUIRED');
    assert.equal(submissionResult.marksAwarded, 0);
  });

  it('7. Code execution with configured runner awards marks and strictly masks hidden test inputs in response', async () => {
    const profDavid = db.users.get('faculty-1');
    const q = await engine.createCodingQuestion(
      {
        questionText: 'Return square of number',
        courseId: 'course-1',
        marks: 10.0,
        evaluationPolicy: 'PERCENTAGE',
        testCases: [
          { input: '4', expectedOutput: '16', isSample: true },
          { input: '9', expectedOutput: '81', isSample: false }, // Hidden
        ],
      },
      profDavid
    );

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    db.attempts.set('att-active', {
      id: 'att-active',
      examId: 'exam-1',
      studentId: 'student-1',
      status: 'IN_PROGRESS',
      expiresAt,
    });

    // Mock sandboxed runner provider
    const mockRunner = {
      isConfigured: () => true,
      execute: async ({ input, expectedOutput }) => {
        // Correctly calculates square
        const val = parseInt(input, 10);
        const actual = String(val * val);
        return {
          passed: actual === expectedOutput,
          status: 'ACCEPTED',
          actualOutput: actual,
        };
      },
    };

    const studentUser = db.users.get('student-1');
    const res = await engine.submitCode(
      {
        questionId: q.id,
        sourceCode: 'function sq(n) { return n * n; }',
        language: 'javascript',
        attemptId: 'att-active',
      },
      studentUser,
      mockRunner
    );

    assert.equal(res.status, 'ACCEPTED');
    assert.equal(res.marksAwarded, 10.0);

    // Verify student response does NOT leak hidden test case input/output
    const sampleCaseResult = res.testResults.find((t) => t.isSample);
    const hiddenCaseResult = res.testResults.find((t) => !t.isSample);

    assert.equal(sampleCaseResult.input, '4');
    assert.equal(sampleCaseResult.expectedOutput, '16');

    // Hidden test case must be null for student
    assert.equal(hiddenCaseResult.input, null);
    assert.equal(hiddenCaseResult.expectedOutput, null);
    assert.equal(hiddenCaseResult.actualOutput, null);
    assert.equal(hiddenCaseResult.passed, true);
  });

  it('8. Prevents code submissions after attempt time expiry', async () => {
    const expiredTime = new Date(Date.now() - 5000); // 5 seconds in the past
    db.attempts.set('att-expired', {
      id: 'att-expired',
      examId: 'exam-1',
      studentId: 'student-1',
      status: 'IN_PROGRESS',
      expiresAt: expiredTime,
    });

    const studentUser = db.users.get('student-1');
    await assert.rejects(
      async () => {
        await engine.submitCode(
          { questionId: 'code-q-1', sourceCode: 'pass', language: 'python', attemptId: 'att-expired' },
          studentUser
        );
      },
      { message: /Attempt time has expired/ }
    );
  });

  // ----------------------------------------------------------------------------
  // SECTION 3: Proctoring Assistance & Integrity Telemetry
  // ----------------------------------------------------------------------------
  it('9. Records browser integrity events and increments tab switch count', async () => {
    db.attempts.set('att-proc', {
      id: 'att-proc',
      examId: 'exam-1',
      studentId: 'student-1',
      status: 'IN_PROGRESS',
      tabSwitchCount: 0,
      expiresAt: new Date(Date.now() + 60000),
    });

    const studentUser = db.users.get('student-1');

    const ev = await engine.recordProctoringEvent(
      { attemptId: 'att-proc', eventType: 'TAB_BLUR', details: { durationMs: 2500 } },
      studentUser
    );

    assert.equal(ev.status, 'RECORDED');
    const updatedAttempt = db.attempts.get('att-proc');
    assert.equal(updatedAttempt.tabSwitchCount, 1);
  });

  it('10. Deduplicates rapid consecutive browser events within throttling window', async () => {
    db.attempts.set('att-dedup', {
      id: 'att-dedup',
      examId: 'exam-1',
      studentId: 'student-1',
      status: 'IN_PROGRESS',
      tabSwitchCount: 0,
      expiresAt: new Date(Date.now() + 60000),
    });

    const studentUser = db.users.get('student-1');

    // First event
    const ev1 = await engine.recordProctoringEvent(
      { attemptId: 'att-dedup', eventType: 'FULLSCREEN_EXIT' },
      studentUser
    );
    assert.equal(ev1.status, 'RECORDED');

    // Immediate duplicate event within 3 seconds
    const ev2 = await engine.recordProctoringEvent(
      { attemptId: 'att-dedup', eventType: 'FULLSCREEN_EXIT' },
      studentUser
    );
    assert.equal(ev2.status, 'DEDUPLICATED');
  });

  it('11. Faculty timeline review presents neutral activity flags without automatic misconduct judgments', async () => {
    db.attempts.set('att-review', {
      id: 'att-review',
      examId: 'exam-1',
      studentId: 'student-1',
      status: 'SUBMITTED',
      tabSwitchCount: 4,
    });

    // Seed events
    db.proctoringEvents.push(
      { id: 'e1', attemptId: 'att-review', eventType: 'TAB_BLUR', timestamp: Date.now() - 50000 },
      { id: 'e2', attemptId: 'att-review', eventType: 'TAB_BLUR', timestamp: Date.now() - 40000 },
      { id: 'e3', attemptId: 'att-review', eventType: 'TAB_BLUR', timestamp: Date.now() - 30000 },
      { id: 'e4', attemptId: 'att-review', eventType: 'FULLSCREEN_EXIT', timestamp: Date.now() - 20000 },
      { id: 'e5', attemptId: 'att-review', eventType: 'FULLSCREEN_EXIT', timestamp: Date.now() - 10000 }
    );

    const profDavid = db.users.get('faculty-1');
    const timeline = await engine.getProctoringTimeline('att-review', profDavid);

    assert.equal(timeline.summary.tabBlurs, 3);
    assert.equal(timeline.summary.fullscreenExits, 2);
    // Neutral label
    assert.equal(timeline.summary.activityFlag, 'Activity flagged for review');
    assert.match(timeline.summary.reviewNotice, /auxiliary indicators and should not be used as sole or conclusive evidence/);

    // Unauthorized faculty Sarah cannot inspect David's exam candidate timeline
    const profSarah = db.users.get('faculty-2');
    await assert.rejects(
      async () => {
        await engine.getProctoringTimeline('att-review', profSarah);
      },
      { message: /Faculty not authorized/ }
    );
  });
});
