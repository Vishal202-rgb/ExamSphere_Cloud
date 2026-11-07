// ==============================================================================
// ExamSphere – Coding Question Management & Assessment Service
// Handles coding problem configuration, sample/hidden test cases isolation,
// code execution via isolated runner, and automated evaluation workflow.
// ==============================================================================

import { prisma } from '../../config/db.js';
import { ApiError } from '../../utils/apiError.js';
import { codeExecutionService } from './execution.service.js';

class CodingService {
  /**
   * Helper: verify faculty course authorization
   */
  async verifyFacultyCourseAccess(courseId, user) {
    if (user.role === 'ADMIN') return true;

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { facultyMembers: true },
    });

    if (!course) {
      throw ApiError.notFound('Course not found');
    }

    const isInstructor = course.facultyMembers?.some((f) => f.facultyId === user.id);
    if (!isInstructor) {
      throw ApiError.forbidden('You are not assigned as an instructor for this course');
    }

    return course;
  }

  /**
   * FACULTY / ADMIN: Create Coding Question with test cases and starter templates
   */
  async createCodingQuestion(data, facultyUser) {
    const {
      questionText,
      courseId,
      difficulty = 'MEDIUM',
      marks = 10.0,
      negativeMarks = 0.0,
      topicTags = [],
      explanation,
      inputFormat,
      outputFormat,
      constraints,
      allowedLanguages = ['javascript', 'python', 'cpp', 'java'],
      starterCode = {
        javascript: '// Complete the solution function\nfunction solution() {\n\n}\n',
        python: '# Complete the solution function\ndef solution():\n    pass\n',
      },
      timeLimitSec = 2.0,
      memoryLimitMb = 256,
      evaluationPolicy = 'ALL_TEST_CASES',
      testCases = [],
    } = data;

    await this.verifyFacultyCourseAccess(courseId, facultyUser);

    if (!testCases || testCases.length === 0) {
      throw ApiError.badRequest('Coding questions must have at least one test case');
    }

    const created = await prisma.$transaction(async (tx) => {
      // 1. Create main Question record
      const question = await tx.question.create({
        data: {
          questionText,
          type: 'CODING',
          difficulty,
          marks: parseFloat(marks),
          negativeMarks: parseFloat(negativeMarks) || 0.0,
          courseId,
          createdById: facultyUser.id,
          topicTags,
          explanation: explanation || null,
        },
      });

      // 2. Create CodingQuestionDetail record
      const detail = await tx.codingQuestionDetail.create({
        data: {
          questionId: question.id,
          inputFormat,
          outputFormat,
          constraints,
          allowedLanguages,
          starterCode,
          timeLimitSec: parseFloat(timeLimitSec),
          memoryLimitMb: parseInt(memoryLimitMb, 10),
          evaluationPolicy,
        },
      });

      // 3. Create test cases
      const testCaseData = testCases.map((tc, idx) => ({
        codingDetailId: detail.id,
        input: tc.input || '',
        expectedOutput: tc.expectedOutput || '',
        isSample: Boolean(tc.isSample),
        explanation: tc.explanation || null,
        weight: parseFloat(tc.weight) || 1.0,
        orderIndex: tc.orderIndex !== undefined ? tc.orderIndex : idx,
      }));

      await tx.codingTestCase.createMany({
        data: testCaseData,
      });

      // 4. Audit Log
      await tx.auditLog.create({
        data: {
          userId: facultyUser.id,
          action: 'CREATE_CODING_QUESTION',
          resource: 'Question',
          resourceId: question.id,
          metadata: {
            courseId,
            testCasesCount: testCases.length,
            sampleCases: testCases.filter((t) => t.isSample).length,
          },
        },
      });

      return question;
    });

    return this.getCodingQuestion(created.id, facultyUser);
  }

  /**
   * FACULTY / ADMIN: Update Coding Question
   */
  async updateCodingQuestion(questionId, data, facultyUser) {
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { codingDetail: true },
    });

    if (!question) {
      throw ApiError.notFound('Coding question not found');
    }

    if (facultyUser.role !== 'ADMIN' && question.createdById !== facultyUser.id) {
      await this.verifyFacultyCourseAccess(question.courseId, facultyUser);
    }

    const {
      questionText,
      difficulty,
      marks,
      negativeMarks,
      topicTags,
      explanation,
      inputFormat,
      outputFormat,
      constraints,
      allowedLanguages,
      starterCode,
      timeLimitSec,
      memoryLimitMb,
      evaluationPolicy,
      testCases,
    } = data;

    await prisma.$transaction(async (tx) => {
      // 1. Update Question
      await tx.question.update({
        where: { id: questionId },
        data: {
          ...(questionText ? { questionText } : {}),
          ...(difficulty ? { difficulty } : {}),
          ...(marks !== undefined ? { marks: parseFloat(marks) } : {}),
          ...(negativeMarks !== undefined ? { negativeMarks: parseFloat(negativeMarks) } : {}),
          ...(topicTags ? { topicTags } : {}),
          ...(explanation !== undefined ? { explanation } : {}),
        },
      });

      // 2. Update CodingQuestionDetail
      const detail = await tx.codingQuestionDetail.upsert({
        where: { questionId },
        create: {
          questionId,
          inputFormat,
          outputFormat,
          constraints,
          allowedLanguages,
          starterCode,
          timeLimitSec: timeLimitSec ? parseFloat(timeLimitSec) : 2.0,
          memoryLimitMb: memoryLimitMb ? parseInt(memoryLimitMb, 10) : 256,
          evaluationPolicy: evaluationPolicy || 'ALL_TEST_CASES',
        },
        update: {
          ...(inputFormat !== undefined ? { inputFormat } : {}),
          ...(outputFormat !== undefined ? { outputFormat } : {}),
          ...(constraints !== undefined ? { constraints } : {}),
          ...(allowedLanguages ? { allowedLanguages } : {}),
          ...(starterCode ? { starterCode } : {}),
          ...(timeLimitSec !== undefined ? { timeLimitSec: parseFloat(timeLimitSec) } : {}),
          ...(memoryLimitMb !== undefined ? { memoryLimitMb: parseInt(memoryLimitMb, 10) } : {}),
          ...(evaluationPolicy ? { evaluationPolicy } : {}),
        },
      });

      // 3. Replace test cases if provided
      if (Array.isArray(testCases) && testCases.length > 0) {
        await tx.codingTestCase.deleteMany({
          where: { codingDetailId: detail.id },
        });

        const testCaseData = testCases.map((tc, idx) => ({
          codingDetailId: detail.id,
          input: tc.input || '',
          expectedOutput: tc.expectedOutput || '',
          isSample: Boolean(tc.isSample),
          explanation: tc.explanation || null,
          weight: parseFloat(tc.weight) || 1.0,
          orderIndex: tc.orderIndex !== undefined ? tc.orderIndex : idx,
        }));

        await tx.codingTestCase.createMany({
          data: testCaseData,
        });
      }

      await tx.auditLog.create({
        data: {
          userId: facultyUser.id,
          action: 'UPDATE_CODING_QUESTION',
          resource: 'Question',
          resourceId: questionId,
        },
      });
    });

    return this.getCodingQuestion(questionId, facultyUser);
  }

  /**
   * Get Coding Question Details
   * CRITICAL SECURITY: Hidden test cases are NEVER exposed to student users!
   */
  async getCodingQuestion(questionId, user) {
    const isStudent = user.role === 'STUDENT';

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        course: { select: { id: true, code: true, title: true } },
        codingDetail: {
          include: {
            testCases: {
              where: isStudent ? { isSample: true } : undefined, // Filter sample only for students
              orderBy: { orderIndex: 'asc' },
              select: {
                id: true,
                input: true,
                expectedOutput: true,
                isSample: true,
                explanation: true,
                weight: true,
                orderIndex: true,
              },
            },
          },
        },
      },
    });

    if (!question) {
      throw ApiError.notFound('Coding question not found');
    }

    return question;
  }

  /**
   * STUDENT: Run code against sample test cases or custom input
   */
  async runSampleCode(data, studentUser) {
    const { questionId, sourceCode, language, customInput, attemptId } = data;

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        codingDetail: {
          include: {
            testCases: {
              where: { isSample: true },
              orderBy: { orderIndex: 'asc' },
            },
          },
        },
      },
    });

    if (!question || !question.codingDetail) {
      throw ApiError.notFound('Coding question or configuration not found');
    }

    const detail = question.codingDetail;
    const timeLimitSec = detail.timeLimitSec || 2.0;
    const memoryLimitMb = detail.memoryLimitMb || 256;

    // Check provider configuration
    if (!codeExecutionService.isConfigured()) {
      return {
        status: 'SETUP_REQUIRED',
        message:
          'Sandboxed code execution provider (Judge0) is not configured. Set JUDGE0_API_URL in server environment variables to enable isolated test execution.',
        isSampleRun: true,
        testResults: [],
      };
    }

    const testResults = [];
    let overallPassed = true;
    let worstStatus = 'ACCEPTED';

    if (customInput !== undefined && customInput !== null) {
      // Run on custom input
      const res = await codeExecutionService.executeTestCase({
        sourceCode,
        language,
        stdin: customInput,
        expectedOutput: '',
        timeLimitSec,
        memoryLimitMb,
      });

      testResults.push({
        testCaseIndex: 1,
        isCustomInput: true,
        input: customInput,
        expectedOutput: '',
        actualOutput: res.actualOutput,
        passed: true,
        status: res.status,
        executionTimeMs: res.executionTimeMs,
        memoryUsedKb: res.memoryUsedKb,
        compileOutput: res.compileOutput,
        errorMessage: res.errorMessage,
      });
      worstStatus = res.status;
    } else {
      // Run against all sample test cases
      for (let i = 0; i < detail.testCases.length; i++) {
        const tc = detail.testCases[i];
        const res = await codeExecutionService.executeTestCase({
          sourceCode,
          language,
          stdin: tc.input,
          expectedOutput: tc.expectedOutput,
          timeLimitSec,
          memoryLimitMb,
        });

        testResults.push({
          testCaseIndex: i + 1,
          isSample: true,
          input: tc.input,
          expectedOutput: tc.expectedOutput,
          actualOutput: res.actualOutput,
          passed: res.passed,
          status: res.status,
          executionTimeMs: res.executionTimeMs,
          memoryUsedKb: res.memoryUsedKb,
          compileOutput: res.compileOutput,
          errorMessage: res.errorMessage,
        });

        if (!res.passed) overallPassed = false;
        if (res.status !== 'ACCEPTED') worstStatus = res.status;
      }
    }

    // Record sample run submission
    const submission = await prisma.codingSubmission.create({
      data: {
        studentId: studentUser.id,
        questionId,
        attemptId: attemptId || null,
        sourceCode,
        language,
        status: worstStatus,
        totalTestCases: testResults.length,
        passedTestCases: testResults.filter((t) => t.passed).length,
        isSampleRun: true,
        executionOutput: testResults,
      },
    });

    return {
      submissionId: submission.id,
      status: worstStatus,
      passed: overallPassed,
      totalTestCases: testResults.length,
      passedTestCases: testResults.filter((t) => t.passed).length,
      testResults,
      isSampleRun: true,
    };
  }

  /**
   * STUDENT: Submit solution for authoritative evaluation against ALL test cases
   * Enforces attempt active check and hides all confidential test case inputs.
   */
  async submitSolution(data, studentUser) {
    const { questionId, sourceCode, language, attemptId, examId } = data;

    // 1. Authoritative Attempt Validation
    if (attemptId) {
      const attempt = await prisma.attempt.findUnique({
        where: { id: attemptId },
      });

      if (!attempt) {
        throw ApiError.notFound('Attempt session not found');
      }

      if (attempt.studentId !== studentUser.id) {
        throw ApiError.forbidden('You are not authorized to submit for this attempt');
      }

      if (attempt.status !== 'IN_PROGRESS') {
        throw ApiError.badRequest(`Cannot submit code. Attempt status is already ${attempt.status}`);
      }

      const now = new Date();
      if (now > attempt.expiresAt) {
        throw ApiError.badRequest('Examination attempt time has expired. Submissions are closed.');
      }
    }

    // 2. Fetch full question and all test cases
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        codingDetail: {
          include: {
            testCases: {
              orderBy: { orderIndex: 'asc' },
            },
          },
        },
      },
    });

    if (!question || !question.codingDetail) {
      throw ApiError.notFound('Coding question or configuration not found');
    }

    const detail = question.codingDetail;
    const timeLimitSec = detail.timeLimitSec || 2.0;
    const memoryLimitMb = detail.memoryLimitMb || 256;
    const allTestCases = detail.testCases;

    // 3. Execution Provider Status Check
    if (!codeExecutionService.isConfigured()) {
      // Save submission as SETUP_REQUIRED
      const submission = await prisma.codingSubmission.create({
        data: {
          studentId: studentUser.id,
          questionId,
          attemptId: attemptId || null,
          examId: examId || null,
          sourceCode,
          language,
          status: 'SETUP_REQUIRED',
          totalTestCases: allTestCases.length,
          passedTestCases: 0,
          marksAwarded: 0,
          errorMessage:
            'Sandboxed code execution provider (Judge0) is not configured. Live execution is unavailable.',
          isSampleRun: false,
        },
      });

      return {
        submissionId: submission.id,
        status: 'SETUP_REQUIRED',
        marksAwarded: 0,
        totalMarks: question.marks,
        message:
          'Sandboxed code execution provider (Judge0) is not configured. Live execution is unavailable.',
        testResults: [],
      };
    }

    // 4. Execute against all test cases
    const detailedResults = [];
    let passedCount = 0;
    let worstStatus = 'ACCEPTED';
    let maxTimeMs = 0;
    let maxMemoryKb = 0;

    for (let i = 0; i < allTestCases.length; i++) {
      const tc = allTestCases[i];
      const res = await codeExecutionService.executeTestCase({
        sourceCode,
        language,
        stdin: tc.input,
        expectedOutput: tc.expectedOutput,
        timeLimitSec,
        memoryLimitMb,
      });

      if (res.passed) passedCount++;
      if (res.status !== 'ACCEPTED' && worstStatus === 'ACCEPTED') {
        worstStatus = res.status;
      }

      maxTimeMs = Math.max(maxTimeMs, res.executionTimeMs || 0);
      maxMemoryKb = Math.max(maxMemoryKb, res.memoryUsedKb || 0);

      detailedResults.push({
        testCaseIndex: i + 1,
        isSample: tc.isSample,
        passed: res.passed,
        status: res.status,
        executionTimeMs: res.executionTimeMs,
        memoryUsedKb: res.memoryUsedKb,
        // Only include confidential input & output for SAMPLE test cases
        input: tc.isSample ? tc.input : null,
        expectedOutput: tc.isSample ? tc.expectedOutput : null,
        actualOutput: tc.isSample ? res.actualOutput : null,
        errorMessage: tc.isSample ? res.errorMessage : (res.status !== 'ACCEPTED' ? res.status : null),
      });
    }

    // 5. Calculate Marks
    let marksAwarded = 0;
    const totalCount = allTestCases.length;

    if (totalCount > 0) {
      if (detail.evaluationPolicy === 'PERCENTAGE') {
        marksAwarded = parseFloat(((passedCount / totalCount) * question.marks).toFixed(2));
      } else {
        // ALL_TEST_CASES
        marksAwarded = passedCount === totalCount ? question.marks : 0.0;
      }
    }

    // 6. Persist Coding Submission
    const submission = await prisma.codingSubmission.create({
      data: {
        studentId: studentUser.id,
        questionId,
        attemptId: attemptId || null,
        examId: examId || null,
        sourceCode,
        language,
        status: worstStatus,
        totalTestCases: totalCount,
        passedTestCases: passedCount,
        marksAwarded,
        executionTimeMs: maxTimeMs,
        memoryUsedKb: maxMemoryKb,
        executionOutput: detailedResults,
        isSampleRun: false,
      },
    });

    // 7. Update Student's Answer in the Attempt session
    if (attemptId) {
      await prisma.answer.upsert({
        where: {
          attemptId_questionId: {
            attemptId,
            questionId,
          },
        },
        create: {
          attemptId,
          questionId,
          descriptiveAnswer: sourceCode,
          marksAwarded,
          isCorrect: passedCount === totalCount,
          savedTimestamp: new Date(),
        },
        update: {
          descriptiveAnswer: sourceCode,
          marksAwarded,
          isCorrect: passedCount === totalCount,
          savedTimestamp: new Date(),
        },
      });
    }

    return {
      submissionId: submission.id,
      status: worstStatus,
      marksAwarded,
      totalMarks: question.marks,
      totalTestCases: totalCount,
      passedTestCases: passedCount,
      executionTimeMs: maxTimeMs,
      memoryUsedKb: maxMemoryKb,
      testResults: detailedResults, // Fully sanitized, hidden inputs masked
    };
  }

  /**
   * Get Submission History for a Question
   */
  async getSubmissionHistory(questionId, user, options = {}) {
    const { attemptId, examId } = options;

    const where = { questionId };
    if (user.role === 'STUDENT') {
      where.studentId = user.id;
    }
    if (attemptId) where.attemptId = attemptId;
    if (examId) where.examId = examId;

    const submissions = await prisma.codingSubmission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        studentId: true,
        language: true,
        status: true,
        totalTestCases: true,
        passedTestCases: true,
        marksAwarded: true,
        executionTimeMs: true,
        memoryUsedKb: true,
        isSampleRun: true,
        createdAt: true,
        student: { select: { name: true, rollNumber: true } },
      },
    });

    return submissions;
  }
}

export const codingService = new CodingService();
