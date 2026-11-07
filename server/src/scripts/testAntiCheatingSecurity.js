// ==============================================================================
// ExamSphere – Anti-Cheating and Exam Security Live Integration Verification
// Tests real PostgreSQL persistence, Two-Strike Policy, Coalescing, One-Time Submission,
// and Authorization Rejections.
// ==============================================================================

import { prisma } from '../config/db.js';
import { attemptService } from '../modules/attempts/attempts.service.js';
import { proctoringService } from '../modules/proctoring/proctoring.service.js';

const results = [];

function recordTest(name, passed, details = '') {
  results.push({ name, passed, details });
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${name} ${details ? `(${details})` : ''}`);
}

async function runSecurityTests() {
  console.log('================================================================');
  console.log('Starting Live Exam Security & Anti-Cheating Verification Suite');
  console.log('================================================================\n');

  let testStudent1 = null;
  let testStudent2 = null;
  let facultyUser = null;
  let testCourse = null;
  let testExam = null;
  let testQuestion = null;
  let attempt1 = null;
  let attempt2 = null;

  try {
    // 0. Setup test users, exam, question, assignments in PostgreSQL
    console.log('Setting up test fixtures in PostgreSQL...');

    // Find or create faculty
    facultyUser = await prisma.user.findFirst({
      where: { role: 'FACULTY', isActive: true },
    });
    if (!facultyUser) {
      facultyUser = await prisma.user.create({
        data: {
          email: `test_faculty_${Date.now()}@test.examsphere.com`,
          password: 'dummy_hash',
          name: 'Security Test Faculty',
          role: 'FACULTY',
          isActive: true,
        },
      });
    }

    // Find or create test students
    const timestamp = Date.now();
    testStudent1 = await prisma.user.create({
      data: {
        email: `student1_${timestamp}@test.examsphere.com`,
        password: 'dummy_hash',
        name: 'AntiCheating Student One',
        role: 'STUDENT',
        rollNumber: `SEC1-${timestamp}`,
        isActive: true,
      },
    });

    testStudent2 = await prisma.user.create({
      data: {
        email: `student2_${timestamp}@test.examsphere.com`,
        password: 'dummy_hash',
        name: 'AntiCheating Student Two',
        role: 'STUDENT',
        rollNumber: `SEC2-${timestamp}`,
        isActive: true,
      },
    });

    // Find or create department & course
    let dept = await prisma.department.findFirst();
    if (!dept) {
      dept = await prisma.department.create({
        data: { name: 'Security Dept', code: `SEC_${timestamp}` },
      });
    }

    testCourse = await prisma.course.create({
      data: {
        code: `CS-SEC-${timestamp}`,
        title: 'Exam Security Systems',
        departmentId: dept.id,
        credits: 3,
      },
    });

    await prisma.courseFaculty.create({
      data: {
        courseId: testCourse.id,
        facultyId: facultyUser.id,
        isCoordinator: true,
      },
    });

    // Create question
    testQuestion = await prisma.question.create({
      data: {
        courseId: testCourse.id,
        createdById: facultyUser.id,
        type: 'SINGLE_MCQ',
        questionText: 'What ensures one-time submission and anti-cheating enforcement?',
        marks: 5,
        options: {
          create: [
            { optionText: 'Authoritative server-side attempt status validation', isCorrect: true, orderIndex: 1 },
            { optionText: 'Frontend localstorage check', isCorrect: false, orderIndex: 2 },
          ],
        },
      },
      include: { options: true },
    });

    // Create published active exam
    const now = new Date();
    const startTime = new Date(now.getTime() - 5 * 60 * 1000); // 5 mins ago
    const endTime = new Date(now.getTime() + 120 * 60 * 1000); // 2 hours from now

    testExam = await prisma.exam.create({
      data: {
        title: `Security Test Exam ${timestamp}`,
        description: 'Automated test examination for anti-cheating enforcement',
        courseId: testCourse.id,
        createdById: facultyUser.id,
        durationMinutes: 60,
        totalMarks: 5,
        passingMarks: 2,
        startTime,
        endTime,
        isPublished: true,
        status: 'LIVE',
        maxAttempts: 1,
        allowLateEntry: true,
        examQuestions: {
          create: [
            {
              questionId: testQuestion.id,
              orderIndex: 1,
              marks: 5,
            },
          ],
        },
      },
    });

    // Create exam assignments for both students
    await prisma.examAssignment.createMany({
      data: [
        { examId: testExam.id, studentId: testStudent1.id },
        { examId: testExam.id, studentId: testStudent2.id },
      ],
    });

    console.log('Fixtures established successfully in PostgreSQL.\n');

    // =========================================================================
    // PART 1: NORMAL EXAM START & ACTIVE SESSION RESTORATION
    // =========================================================================
    console.log('--- Part 1: Normal Start & Session Restoration ---');

    // Test 1: Start exam for student 1
    const startRes1 = await attemptService.startExam(testExam.id, testStudent1);
    attempt1 = await prisma.attempt.findUnique({ where: { id: startRes1.attempt.id } });
    recordTest(
      'Normal exam start & active session creation',
      attempt1 &&
        attempt1.status === 'IN_PROGRESS' &&
        attempt1.violationCount === 0 &&
        attempt1.isDisqualified === false,
      `Attempt ID: ${attempt1?.id}, Status: ${attempt1?.status}`
    );

    // Test 2: Restore attempt during active session (simulating page refresh)
    const restoreRes = await attemptService.getAttempt(attempt1.id, testStudent1);
    recordTest(
      'Active session restoration on refresh (reconnect)',
      restoreRes &&
        restoreRes.attempt.id === attempt1.id &&
        restoreRes.attempt.status === 'IN_PROGRESS' &&
        restoreRes.attempt.questions.length > 0,
      `Remaining seconds: ${restoreRes?.attempt?.remainingSeconds}`
    );

    // Test 3: Autosave answer during active session
    const correctOpt = testQuestion.options.find((o) => o.isCorrect);
    const saveRes = await attemptService.autosaveAnswer(
      attempt1.id,
      testQuestion.id,
      { selectedOptions: [correctOpt.id] },
      testStudent1
    );
    recordTest(
      'Autosave answer during active session',
      saveRes && saveRes.status === 'SAVED',
      `Answer status: ${saveRes?.status}`
    );

    // =========================================================================
    // PART 2: ONE-TIME SUBMISSION ENFORCEMENT & API REPLAY BLOCKING
    // =========================================================================
    console.log('\n--- Part 2: One-Time Submission & Replay Blocking ---');

    // Test 4: Submit attempt
    const submitRes = await attemptService.submitAttempt(
      attempt1.id,
      { reason: 'MANUAL' },
      testStudent1
    );
    const submittedAttempt = await prisma.attempt.findUnique({ where: { id: attempt1.id } });
    recordTest(
      'One-time submission permanently sets status to SUBMITTED',
      submittedAttempt &&
        submittedAttempt.status === 'SUBMITTED' &&
        submittedAttempt.submittedAt !== null,
      `Status: ${submittedAttempt?.status}, SubmittedAt: ${submittedAttempt?.submittedAt?.toISOString()}`
    );

    // Test 5: Refresh/re-fetch after submission -> Throws 403 Forbidden
    let resumeRejected = false;
    let resumeErrorMsg = '';
    try {
      await attemptService.getAttempt(attempt1.id, testStudent1);
    } catch (err) {
      resumeRejected = err.statusCode === 403 || err.status === 403;
      resumeErrorMsg = err.message;
    }
    recordTest(
      'Refresh / resume after submission is strictly rejected (403)',
      resumeRejected && resumeErrorMsg.includes('already been submitted and cannot be resumed'),
      `Error: "${resumeErrorMsg}"`
    );

    // Test 6: Answer autosave after submission -> Throws 403 Forbidden
    let editRejected = false;
    let editErrorMsg = '';
    try {
      await attemptService.autosaveAnswer(
        attempt1.id,
        testQuestion.id,
        { selectedOptions: [correctOpt.id] },
        testStudent1
      );
    } catch (err) {
      editRejected = err.statusCode === 403 || err.status === 403;
      editErrorMsg = err.message;
    }
    recordTest(
      'Answer edit after submission is strictly rejected (403)',
      editRejected,
      `Error: "${editErrorMsg}"`
    );

    // Test 7: Duplicate submission / API replay -> Throws 400 Bad Request
    let replayRejected = false;
    let replayErrorMsg = '';
    try {
      await attemptService.submitAttempt(
        attempt1.id,
        { reason: 'MANUAL' },
        testStudent1
      );
    } catch (err) {
      replayRejected = err.statusCode === 400 || err.status === 400;
      replayErrorMsg = err.message;
    }
    recordTest(
      'Duplicate submission / API replay strictly rejected (400)',
      replayRejected && replayErrorMsg.includes('already been submitted and cannot be resubmitted'),
      `Error: "${replayErrorMsg}"`
    );

    // =========================================================================
    // PART 3: SECURE TWO-STRIKE ANTI-CHEATING POLICY & COALESCING
    // =========================================================================
    console.log('\n--- Part 3: Two-Strike Anti-Cheating & Coalescing ---');

    // Test 8: Start exam for student 2
    const startRes2 = await attemptService.startExam(testExam.id, testStudent2);
    attempt2 = await prisma.attempt.findUnique({ where: { id: startRes2.attempt.id } });
    recordTest(
      'Candidate 2 exam start for anti-cheating policy test',
      attempt2 && attempt2.violationCount === 0 && attempt2.isDisqualified === false,
      `Attempt ID: ${attempt2?.id}`
    );

    // Test 9: Strike 1 - First departure event (TAB_BLUR)
    const strike1Res = await proctoringService.recordActivityEvent(
      {
        attemptId: attempt2.id,
        eventType: 'TAB_BLUR',
        clientTime: new Date().toISOString(),
        details: { reason: 'User switched browser tab or focus lost' },
      },
      testStudent2
    );

    const attemptAfterStrike1 = await prisma.attempt.findUnique({ where: { id: attempt2.id } });
    const auditLogsStrike1 = await prisma.auditLog.findMany({
      where: {
        resourceId: attempt2.id,
        action: 'EXAM_VIOLATION_RECORDED',
      },
    });

    recordTest(
      'Strike 1: First departure records warning and increments violationCount to 1',
      strike1Res.status === 'WARNING' &&
        strike1Res.strike === 1 &&
        strike1Res.violationCount === 1 &&
        strike1Res.isDisqualified === false &&
        attemptAfterStrike1.violationCount === 1 &&
        attemptAfterStrike1.isDisqualified === false &&
        auditLogsStrike1.length >= 1,
      `Message: "${strike1Res.message}"`
    );

    // Test 10: Event Coalescing - Rapid second departure within 3.5s cooldown (e.g. FULLSCREEN_EXIT immediately following TAB_BLUR)
    const cooldownRes = await proctoringService.recordActivityEvent(
      {
        attemptId: attempt2.id,
        eventType: 'FULLSCREEN_EXIT',
        clientTime: new Date().toISOString(),
        details: { reason: 'Browser exited fullscreen mode as side-effect of tab switch' },
      },
      testStudent2
    );

    const attemptAfterCooldown = await prisma.attempt.findUnique({ where: { id: attempt2.id } });
    recordTest(
      'Event Coalescing: Rapid departure within cooldown does NOT double-count strike',
      cooldownRes.status === 'COOLDOWN' &&
        cooldownRes.strike === 1 &&
        cooldownRes.violationCount === 1 &&
        attemptAfterCooldown.violationCount === 1 &&
        attemptAfterCooldown.isDisqualified === false,
      `Status: ${cooldownRes.status}, Strikes: ${attemptAfterCooldown.violationCount}`
    );

    // Test 11: Wait beyond 4.0s cooldown window
    console.log('Waiting 4.5s for anti-cheating cooldown window to lapse...');
    await new Promise((resolve) => setTimeout(resolve, 4500));

    // Test 12: Strike 2 - Second confirmed departure after cooldown (FULLSCREEN_EXIT)
    const strike2Res = await proctoringService.recordActivityEvent(
      {
        attemptId: attempt2.id,
        eventType: 'FULLSCREEN_EXIT',
        clientTime: new Date().toISOString(),
        details: { reason: 'Second unpermitted fullscreen exit' },
      },
      testStudent2
    );

    const attemptAfterStrike2 = await prisma.attempt.findUnique({ where: { id: attempt2.id } });
    const assignmentAfterStrike2 = await prisma.examAssignment.findUnique({
      where: {
        examId_studentId: {
          examId: testExam.id,
          studentId: testStudent2.id,
        },
      },
    });
    const auditLogsStrike2 = await prisma.auditLog.findMany({
      where: {
        resourceId: attempt2.id,
        action: 'EXAM_ATTEMPT_DISQUALIFIED',
      },
    });

    recordTest(
      'Strike 2: Second departure immediately and atomically disqualifies attempt',
      strike2Res.status === 'DISQUALIFIED' &&
        strike2Res.strike === 2 &&
        strike2Res.isDisqualified === true &&
        attemptAfterStrike2.status === 'DISQUALIFIED' &&
        attemptAfterStrike2.isDisqualified === true &&
        attemptAfterStrike2.violationCount === 2 &&
        attemptAfterStrike2.disqualifiedAt !== null &&
        assignmentAfterStrike2.isDisqualified === true &&
        auditLogsStrike2.length >= 1,
      `Status: ${attemptAfterStrike2?.status}, Reason: "${attemptAfterStrike2?.disqualifyReason}"`
    );

    // =========================================================================
    // PART 4: DISQUALIFICATION ENFORCEMENT & API BLOCKING
    // =========================================================================
    console.log('\n--- Part 4: Post-Disqualification API Blocking ---');

    // Test 13: Resume rejected after disqualification -> Throws 403 Forbidden
    let resumeDisqRejected = false;
    let resumeDisqError = '';
    try {
      await attemptService.getAttempt(attempt2.id, testStudent2);
    } catch (err) {
      resumeDisqRejected = err.statusCode === 403 || err.status === 403;
      resumeDisqError = err.message;
    }
    recordTest(
      'Resume/reopen after disqualification is strictly rejected (403)',
      resumeDisqRejected && resumeDisqError.includes('disqualified'),
      `Error: "${resumeDisqError}"`
    );

    // Test 14: Answer autosave rejected after disqualification -> Throws 403 Forbidden
    let saveDisqRejected = false;
    let saveDisqError = '';
    try {
      await attemptService.autosaveAnswer(
        attempt2.id,
        testQuestion.id,
        { selectedOptions: [correctOpt.id] },
        testStudent2
      );
    } catch (err) {
      saveDisqRejected = err.statusCode === 403 || err.status === 403;
      saveDisqError = err.message;
    }
    recordTest(
      'Answer autosave after disqualification is strictly rejected (403)',
      saveDisqRejected,
      `Error: "${saveDisqError}"`
    );

    // Test 15: Submission rejected after disqualification -> Throws 403 Forbidden
    let submitDisqRejected = false;
    let submitDisqError = '';
    try {
      await attemptService.submitAttempt(
        attempt2.id,
        { reason: 'MANUAL' },
        testStudent2
      );
    } catch (err) {
      submitDisqRejected = err.statusCode === 403 || err.status === 403;
      submitDisqError = err.message;
    }
    recordTest(
      'Submission after disqualification is strictly rejected (403)',
      submitDisqRejected && submitDisqError.includes('disqualified'),
      `Error: "${submitDisqError}"`
    );

    // =========================================================================
    // PART 5: FACULTY MONITORING & AUDIT HISTORY INSPECTION
    // =========================================================================
    console.log('\n--- Part 5: Faculty Monitoring & Audit Inspection ---');

    // Test 16: Faculty timeline inspection
    const timelineData = await proctoringService.getAttemptTimeline(attempt2.id, facultyUser);
    recordTest(
      'Faculty monitoring timeline returns authoritative metrics & audit logs',
      timelineData &&
        timelineData.attempt.violationCount === 2 &&
        timelineData.attempt.isDisqualified === true &&
        timelineData.summary.disqualificationType === 'AUTOMATIC' &&
        timelineData.summary.fullscreenExitCount >= 1 &&
        timelineData.summary.tabBlurCount >= 1 &&
        timelineData.auditLogs.some((l) => l.action === 'EXAM_ATTEMPT_DISQUALIFIED'),
      `DisqualificationType: ${timelineData?.summary?.disqualificationType}, Events: ${timelineData?.timeline?.length}, AuditLogs: ${timelineData?.auditLogs?.length}`
    );

  } catch (fatalError) {
    console.error('Fatal Test Exception:', fatalError);
    recordTest('Execution Exception', false, fatalError.message);
  } finally {
    // Cleanup created test records to maintain database hygiene
    console.log('\nCleaning up test records from PostgreSQL...');
    try {
      if (attempt1?.id) {
        await prisma.auditLog.deleteMany({ where: { resourceId: attempt1.id } });
        await prisma.answer.deleteMany({ where: { attemptId: attempt1.id } });
        await prisma.attempt.delete({ where: { id: attempt1.id } });
      }
      if (attempt2?.id) {
        await prisma.proctoringEvent.deleteMany({ where: { attemptId: attempt2.id } });
        await prisma.auditLog.deleteMany({ where: { resourceId: attempt2.id } });
        await prisma.answer.deleteMany({ where: { attemptId: attempt2.id } });
        await prisma.attempt.delete({ where: { id: attempt2.id } });
      }
      if (testExam?.id) {
        await prisma.examAssignment.deleteMany({ where: { examId: testExam.id } });
        await prisma.examQuestion.deleteMany({ where: { examId: testExam.id } });
        await prisma.exam.delete({ where: { id: testExam.id } });
      }
      if (testQuestion?.id) {
        await prisma.questionOption.deleteMany({ where: { questionId: testQuestion.id } });
        await prisma.question.delete({ where: { id: testQuestion.id } });
      }
      if (testCourse?.id) {
        await prisma.courseFaculty.deleteMany({ where: { courseId: testCourse.id } });
        await prisma.course.delete({ where: { id: testCourse.id } });
      }
      if (testStudent1?.id) {
        await prisma.user.delete({ where: { id: testStudent1.id } });
      }
      if (testStudent2?.id) {
        await prisma.user.delete({ where: { id: testStudent2.id } });
      }
      console.log('Test records cleaned up successfully.');
    } catch (cleanupErr) {
      console.warn('Cleanup warning:', cleanupErr.message);
    }

    await prisma.$disconnect();
  }

  // Summary Report
  console.log('\n================================================================');
  console.log('Live Verification Results Summary:');
  console.log('================================================================');
  const total = results.length;
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  results.forEach((r, idx) => {
    console.log(`${idx + 1}. [${r.passed ? 'PASS' : 'FAIL'}] ${r.name}`);
  });

  console.log(`\nTOTAL: ${total} | PASSED: ${passed} | FAILED: ${failed}`);
  if (failed === 0) {
    console.log('🎉 ALL INTEGRATION TESTS PASSED AUTHORITATIVELY AGAINST POSTGRESQL');
  } else {
    console.error(`⚠️ ${failed} TEST(S) FAILED`);
    process.exit(1);
  }
}

runSecurityTests();
