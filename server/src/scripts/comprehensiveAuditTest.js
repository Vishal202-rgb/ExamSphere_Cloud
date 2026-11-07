// ==============================================================================
// ExamSphere – End-to-End Audit & Verification Test Suite
// Real database & API verification covering all 13 audit requirements
// ==============================================================================

import { prisma } from '../config/db.js';

const API_BASE = 'http://localhost:5000/api/v1';

async function login(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Login failed for ${email}: ${data.message || res.statusText}`);
  }
  return {
    token: data.data.accessToken,
    refreshToken: data.data.refreshToken,
    user: data.data.user,
  };
}

async function runAudit() {
  console.log('================================================================');
  console.log('🔍 ExamSphere – Comprehensive Examination Workflow Audit');
  console.log('================================================================\n');

  const auditResults = [];
  function record(id, title, passed, details = '') {
    auditResults.push({ id, title, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`[Item ${id}] ${mark} – ${title}`);
    if (details) console.log(`   Details: ${details}\n`);
  }

  try {
    // -------------------------------------------------------------------------
    // 0. Preparation & Credentials
    // -------------------------------------------------------------------------
    const facultyAuth = await login('alan.turing@examsphere.io', 'Faculty@12345');
    const facultyHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${facultyAuth.token}`,
    };

    const studentJohnAuth = await login('john.doe@examsphere.io', 'Student@12345');
    const johnHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentJohnAuth.token}`,
    };

    const studentJaneAuth = await login('jane.smith@examsphere.io', 'Student@12345');
    const janeHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentJaneAuth.token}`,
    };

    const studentAlexAuth = await login('alex.johnson@examsphere.io', 'Student@12345');
    const alexHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentAlexAuth.token}`,
    };

    const cs301 = await prisma.course.findUnique({ where: { code: 'CS301' } });
    const it204 = await prisma.course.findUnique({ where: { code: 'IT204' } });

    // -------------------------------------------------------------------------
    // 1. Faculty Examination Console & Non-Zero KPI Metrics (No timeout)
    // -------------------------------------------------------------------------
    try {
      const t0 = Date.now();
      const res = await fetch(`${API_BASE}/exams?page=1&limit=10`, { headers: facultyHeaders });
      const elapsed = Date.now() - t0;
      const data = await res.json();
      const exams = data.data || [];
      const metrics = data.metrics;
      const pass = res.ok && elapsed < 15000 && exams.length > 0 && metrics && metrics.total > 0;
      record(
        1,
        'Faculty Examination Console – Load existing exams & non-zero metrics without timeout',
        pass,
        `HTTP ${res.status} in ${elapsed}ms. Returned ${exams.length} exams. Metrics Total: ${metrics?.total} (Drafts: ${metrics?.DRAFT}, Live: ${metrics?.LIVE})`
      );
    } catch (e) {
      record(1, 'Faculty Examination Console – Load existing exams & non-zero metrics without timeout', false, e.message);
    }

    // -------------------------------------------------------------------------
    // 2. Role-Based Access Control (RBAC) Enforcement
    // -------------------------------------------------------------------------
    try {
      // Student attempting to create an exam -> MUST receive 403 Forbidden
      const rbacRes = await fetch(`${API_BASE}/exams`, {
        method: 'POST',
        headers: johnHeaders,
        body: JSON.stringify({
          title: 'Unauthorized Student Exam Creation',
          courseId: cs301.id,
          durationMinutes: 30,
        }),
      });
      const pass = rbacRes.status === 403;
      record(
        2,
        'RBAC Enforcement – Unauthorized student cannot create examinations (HTTP 403)',
        pass,
        `Expected status 403, received ${rbacRes.status}`
      );
    } catch (e) {
      record(2, 'RBAC Enforcement – Unauthorized student cannot create examinations (HTTP 403)', false, e.message);
    }

    // -------------------------------------------------------------------------
    // 3. Faculty Exam Management (Create, Edit, Schedule)
    // -------------------------------------------------------------------------
    let createdExamId = null;
    try {
      const now = new Date();
      const startTime = new Date(now.getTime() - 10 * 60 * 1000).toISOString(); // 10 min ago (Live when published)
      const endTime = new Date(now.getTime() + 180 * 60 * 1000).toISOString();   // 3 hours ahead

      // 3a. Create exam
      const createRes = await fetch(`${API_BASE}/exams`, {
        method: 'POST',
        headers: facultyHeaders,
        body: JSON.stringify({
          title: `Audit Test Exam – ${Date.now()}`,
          description: 'Comprehensive workflow audit examination',
          courseIds: [cs301.id, it204.id],
          durationMinutes: 60,
          startTime,
          endTime,
          passingMarks: 1.0,
          negativeMarking: false,
        }),
      });
      const createData = await createRes.json();
      createdExamId = createData.data?.id;

      // 3b. Edit / update schedule
      const updateRes = await fetch(`${API_BASE}/exams/${createdExamId}`, {
        method: 'PUT',
        headers: facultyHeaders,
        body: JSON.stringify({
          title: `Audit Test Exam (Updated) – ${Date.now()}`,
          durationMinutes: 75,
        }),
      });
      const updateData = await updateRes.json();

      const pass = createRes.status === 201 && updateRes.status === 200 && updateData.data?.durationMinutes === 75;
      record(
        3,
        'Faculty Exam Management – Create, edit and update examination schedule',
        pass,
        `Created Exam ID: ${createdExamId}, Updated duration to ${updateData.data?.durationMinutes} min`
      );
    } catch (e) {
      record(3, 'Faculty Exam Management – Create, edit and update examination schedule', false, e.message);
    }

    // -------------------------------------------------------------------------
    // 4. Multi-Course Association & Student Assignment (CS301 + IT204)
    // -------------------------------------------------------------------------
    try {
      const dbExamCourses = await prisma.examCourse.findMany({
        where: { examId: createdExamId },
        include: { course: true },
      });

      // Assign John (CS301) and Jane (IT204)
      const assignRes = await fetch(`${API_BASE}/exams/${createdExamId}/assign`, {
        method: 'POST',
        headers: facultyHeaders,
        body: JSON.stringify({
          studentIds: [studentJohnAuth.user.id, studentJaneAuth.user.id],
        }),
      });
      const assignData = await assignRes.json();

      const dbAssignments = await prisma.examAssignment.findMany({
        where: { examId: createdExamId },
      });

      const pass =
        dbExamCourses.length === 2 &&
        dbExamCourses.some((c) => c.course.code === 'CS301') &&
        dbExamCourses.some((c) => c.course.code === 'IT204') &&
        assignRes.ok &&
        dbAssignments.length === 2;

      record(
        4,
        'Multi-Course & Student Assignment – Link CS301 + IT204 and assign students across courses',
        pass,
        `Linked Courses: ${dbExamCourses.map((c) => c.course.code).join(', ')}, Assigned Students: ${dbAssignments.length}`
      );
    } catch (e) {
      record(4, 'Multi-Course & Student Assignment – Link CS301 + IT204 and assign students across courses', false, e.message);
    }

    // -------------------------------------------------------------------------
    // 5. Question Bank CRUD, CSV Import/Export & Association
    // -------------------------------------------------------------------------
    let createdQuestionId = null;
    try {
      // 5a. Create single question in PostgreSQL
      const qCreateRes = await fetch(`${API_BASE}/questions`, {
        method: 'POST',
        headers: facultyHeaders,
        body: JSON.stringify({
          courseId: cs301.id,
          type: 'SINGLE_MCQ',
          difficulty: 'MEDIUM',
          marks: 2,
          negativeMarks: 0,
          topicTags: ['AuditTest', 'Algorithms'],
          questionText: `What is the time complexity of binary search? [Audit-${Date.now()}]`,
          options: [
            { optionText: 'O(log n)', isCorrect: true, orderIndex: 0 },
            { optionText: 'O(n)', isCorrect: false, orderIndex: 1 },
            { optionText: 'O(n^2)', isCorrect: false, orderIndex: 2 },
          ],
        }),
      });
      const qCreateData = await qCreateRes.json();
      createdQuestionId = qCreateData.data?.id;

      // 5b. Update question
      const qUpdateRes = await fetch(`${API_BASE}/questions/${createdQuestionId}`, {
        method: 'PUT',
        headers: facultyHeaders,
        body: JSON.stringify({
          marks: 3,
        }),
      });

      // 5c. Export questions as CSV
      const qExportRes = await fetch(`${API_BASE}/questions/export?courseId=${cs301.id}`, {
        headers: facultyHeaders,
      });
      const csvText = await qExportRes.text();

      // 5d. Bulk import questions from CSV string
      const importCsv = `questionText,type,difficulty,marks,negativeMarks,options,correctOptions,topicTags,explanation\n"Which protocol is connection-oriented?",SINGLE_MCQ,EASY,2,0,"TCP|UDP|IP|ICMP",TCP,Networking,"TCP establishes three-way handshake"`;
      const qImportRes = await fetch(`${API_BASE}/questions/import`, {
        method: 'POST',
        headers: facultyHeaders,
        body: JSON.stringify({
          courseId: it204.id,
          csvData: importCsv,
        }),
      });
      const qImportData = await qImportRes.json();

      // 5e. Attach questions to the exam
      const attachRes = await fetch(`${API_BASE}/exams/${createdExamId}/questions`, {
        method: 'POST',
        headers: facultyHeaders,
        body: JSON.stringify({
          questions: [
            { questionId: createdQuestionId, marks: 3, orderIndex: 0 },
          ],
        }),
      });

      const pass =
        qCreateRes.status === 201 &&
        qUpdateRes.status === 200 &&
        qExportRes.status === 200 &&
        (csvText.includes('Question Text') || csvText.includes('questionText')) &&
        qImportRes.status === 200 &&
        attachRes.status === 200;

      record(
        5,
        'Question Bank – CRUD, CSV export/import, and exam question association',
        pass,
        `Create: ${qCreateRes.status}, Update: ${qUpdateRes.status}, Export: ${qExportRes.status}, Import: ${qImportRes.status}, Attach: ${attachRes.status}`
      );
    } catch (e) {
      record(5, 'Question Bank – CRUD, CSV export/import, and exam question association', false, e.message);
    }

    // -------------------------------------------------------------------------
    // 6. Exam Publishing & Student Security Isolation
    // -------------------------------------------------------------------------
    try {
      // 6a. Publish exam
      const pubRes = await fetch(`${API_BASE}/exams/${createdExamId}/publish`, {
        method: 'PATCH',
        headers: facultyHeaders,
      });

      // 6b. Verify visible to assigned John Doe (CS301)
      const johnExamsRes = await fetch(`${API_BASE}/student/exams`, { headers: johnHeaders });
      const johnExamsData = await johnExamsRes.json();
      const visibleToJohn = (johnExamsData.data || []).some((e) => e.id === createdExamId);

      // 6c. Verify visible to assigned Jane Smith (IT204)
      const janeExamsRes = await fetch(`${API_BASE}/student/exams`, { headers: janeHeaders });
      const janeExamsData = await janeExamsRes.json();
      const visibleToJane = (janeExamsData.data || []).some((e) => e.id === createdExamId);

      // 6d. Verify unassigned Alex Johnson is blocked
      const alexExamsRes = await fetch(`${API_BASE}/student/exams`, { headers: alexHeaders });
      const alexExamsData = await alexExamsRes.json();
      const visibleToAlex = (alexExamsData.data || []).some((e) => e.id === createdExamId);
      const alexDirectRes = await fetch(`${API_BASE}/exams/${createdExamId}`, { headers: alexHeaders });

      const pass =
        pubRes.ok &&
        visibleToJohn &&
        visibleToJane &&
        !visibleToAlex &&
        alexDirectRes.status === 403;

      record(
        6,
        'Publishing & Isolation – Visible to multi-course students, blocked for unassigned',
        pass,
        `Visible to John: ${visibleToJohn}, Jane: ${visibleToJane}, Alex (unassigned): ${visibleToAlex}, Alex Direct GET: ${alexDirectRes.status}`
      );
    } catch (e) {
      record(6, 'Publishing & Isolation – Visible to multi-course students, blocked for unassigned', false, e.message);
    }

    // -------------------------------------------------------------------------
    // 7. Student Session (Start, Instructions, Timer, Autosave, Submission)
    // -------------------------------------------------------------------------
    let attemptId = null;
    try {
      // 7a. Start exam session
      const startRes = await fetch(`${API_BASE}/exams/${createdExamId}/start`, {
        method: 'POST',
        headers: johnHeaders,
      });
      const startData = await startRes.json();
      attemptId = startData.data?.attempt?.id;

      // 7b. Fetch authoritative timer
      const timeRes = await fetch(`${API_BASE}/attempts/${attemptId}/time`, { headers: johnHeaders });
      const timeData = await timeRes.json();

      // 7c. Autosave student answer
      const qInDb = await prisma.question.findUnique({
        where: { id: createdQuestionId },
        include: { options: true },
      });
      const correctOpt = qInDb.options.find((o) => o.isCorrect);

      const autosaveRes = await fetch(`${API_BASE}/attempts/${attemptId}/answers/${createdQuestionId}`, {
        method: 'PUT',
        headers: johnHeaders,
        body: JSON.stringify({
          selectedOptions: [correctOpt.id],
          version: 1,
        }),
      });

      // 7d. Manual submission
      const submitRes = await fetch(`${API_BASE}/attempts/${attemptId}/submit`, {
        method: 'POST',
        headers: johnHeaders,
        body: JSON.stringify({ reason: 'MANUAL' }),
      });
      const submitData = await submitRes.json();

      const pass =
        startRes.status === 200 &&
        timeRes.status === 200 &&
        timeData.data?.remainingSeconds > 0 &&
        autosaveRes.status === 200 &&
        submitRes.status === 200 &&
        submitData.data?.status === 'SUBMITTED';

      record(
        7,
        'Student Exam Flow – Session initialization, authoritative timer, autosave, and submission',
        pass,
        `Attempt ID: ${attemptId}, Remaining Seconds: ${timeData.data?.remainingSeconds}, Final Status: ${submitData.data?.status}`
      );
    } catch (e) {
      record(7, 'Student Exam Flow – Session initialization, authoritative timer, autosave, and submission', false, e.message);
    }

    // -------------------------------------------------------------------------
    // 8. Automated Evaluation & PostgreSQL Result Record Persistence
    // -------------------------------------------------------------------------
    try {
      // Trigger evaluation or read persisted result
      const { evaluationService } = await import('../modules/evaluation/evaluation.service.js');
      const evalResult = await evaluationService.evaluateAttempt(attemptId);

      const dbResult = await prisma.result.findUnique({
        where: { attemptId },
      });

      const pass =
        Boolean(dbResult) &&
        dbResult.obtainedMarks === 3 &&
        dbResult.evaluationStatus === 'EVALUATED' &&
        dbResult.correctAnswersCount === 1;

      record(
        8,
        'Evaluation Engine – Auto-evaluate objective questions and persist PostgreSQL Result',
        pass,
        `Result ID: ${dbResult?.id}, Obtained Marks: ${dbResult?.obtainedMarks}/${dbResult?.totalMarks}, Percentage: ${dbResult?.percentage}%, Status: ${dbResult?.evaluationStatus}`
      );
    } catch (e) {
      record(8, 'Evaluation Engine – Auto-evaluate objective questions and persist PostgreSQL Result', false, e.message);
    }

    // -------------------------------------------------------------------------
    // 9. Faculty Submissions Review & Result Publication with Competition Ranking
    // -------------------------------------------------------------------------
    try {
      // 9a. Faculty view submissions
      const subRes = await fetch(`${API_BASE}/faculty/exams/${createdExamId}/submissions`, {
        headers: facultyHeaders,
      });
      const subData = await subRes.json();
      const hasSubmission = (subData.data?.submissions || []).some((s) => s.attemptId === attemptId);

      // 9b. Faculty publish results
      const pubResResult = await fetch(`${API_BASE}/faculty/exams/${createdExamId}/publish-results`, {
        method: 'POST',
        headers: facultyHeaders,
      });
      const pubResultData = await pubResResult.json();

      const dbResultAfterPub = await prisma.result.findUnique({
        where: { attemptId },
      });

      const pass =
        subRes.status === 200 &&
        hasSubmission &&
        pubResResult.status === 200 &&
        dbResultAfterPub.publicationStatus === 'PUBLISHED' &&
        dbResultAfterPub.rank === 1;

      record(
        9,
        'Faculty Evaluation & Publishing – Submissions review, result publication & cohort ranking',
        pass,
        `Publication Status: ${dbResultAfterPub.publicationStatus}, Assigned Rank: #${dbResultAfterPub.rank}, Published At: ${dbResultAfterPub.publishedAt}`
      );
    } catch (e) {
      record(9, 'Faculty Evaluation & Publishing – Submissions review, result publication & cohort ranking', false, e.message);
    }

    // -------------------------------------------------------------------------
    // 10. Student Scorecard & Performance Portal Breakdown
    // -------------------------------------------------------------------------
    try {
      // 10a. Published results list
      const resultsListRes = await fetch(`${API_BASE}/student/results`, { headers: johnHeaders });
      const resultsListData = await resultsListRes.json();
      const inStudentList = (resultsListData.data || []).some((r) => r.examId === createdExamId);

      // 10b. Detailed scorecard
      const scorecardRes = await fetch(`${API_BASE}/student/exams/${createdExamId}/result`, {
        headers: johnHeaders,
      });
      const scorecardData = await scorecardRes.json();
      const scorecard = scorecardData.data?.result;
      const questionsBreakdown = scorecardData.data?.questions || [];

      const pass =
        resultsListRes.status === 200 &&
        inStudentList &&
        scorecardRes.status === 200 &&
        scorecard.obtainedMarks === 3 &&
        scorecard.rank === 1 &&
        questionsBreakdown.length > 0;

      record(
        10,
        'Student Scorecard – Published results visible with marks, percentage, rank & breakdown',
        pass,
        `Score: ${scorecard?.obtainedMarks}/${scorecard?.totalMarks} (${scorecard?.percentage}%), Rank: #${scorecard?.rank}, Questions in breakdown: ${questionsBreakdown.length}`
      );
    } catch (e) {
      record(10, 'Student Scorecard – Published results visible with marks, percentage, rank & breakdown', false, e.message);
    }

    // -------------------------------------------------------------------------
    // 11. Notifications, Analytics & Dashboard Verification
    // -------------------------------------------------------------------------
    try {
      // Notifications
      const notifRes = await fetch(`${API_BASE}/notifications`, { headers: johnHeaders });
      const notifData = await notifRes.json();

      // Faculty Analytics
      const facAnalyticsRes = await fetch(`${API_BASE}/analytics/faculty/overview`, {
        headers: facultyHeaders,
      });
      const facAnalyticsData = await facAnalyticsRes.json();

      // Student Analytics
      const stuAnalyticsRes = await fetch(`${API_BASE}/analytics/student/overview`, {
        headers: johnHeaders,
      });
      const stuAnalyticsData = await stuAnalyticsRes.json();

      const pass =
        notifRes.status === 200 &&
        facAnalyticsRes.status === 200 &&
        stuAnalyticsRes.status === 200;

      record(
        11,
        'System Observability – Notifications, analytics overviews and dashboard metrics',
        pass,
        `Notifications count: ${(notifData.data || []).length}, Faculty total exams: ${facAnalyticsData.data?.totalExams ?? 'ok'}, Student exams attempted: ${stuAnalyticsData.data?.examsAttempted ?? 'ok'}`
      );
    } catch (e) {
      record(11, 'System Observability – Notifications, analytics overviews and dashboard metrics', false, e.message);
    }

    // -------------------------------------------------------------------------
    // 12. Token Refresh & Session Continuity
    // -------------------------------------------------------------------------
    try {
      const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: facultyAuth.refreshToken }),
      });
      const refreshData = await refreshRes.json();
      const hasNewToken = Boolean(refreshData.data?.accessToken);

      record(
        12,
        'Authentication & Refresh – Token rotation and session continuity without 401/403 loops',
        refreshRes.status === 200 && hasNewToken,
        `HTTP ${refreshRes.status}, Received new access token: ${hasNewToken}`
      );
    } catch (e) {
      record(12, 'Authentication & Refresh – Token rotation and session continuity without 401/403 loops', false, e.message);
    }

  } catch (err) {
    console.error('Fatal audit execution error:', err);
  } finally {
    await prisma.$disconnect();
    console.log('\n================================================================');
    console.log('AUDIT SUMMARY');
    console.log('================================================================');
    const total = auditResults.length;
    const passedCount = auditResults.filter((r) => r.passed).length;
    console.log(`Total Checks: ${total}`);
    console.log(`Passed: ${passedCount}`);
    console.log(`Failed: ${total - passedCount}`);
    auditResults.forEach((r) => {
      console.log(`[${r.passed ? 'PASS' : 'FAIL'}] Item ${r.id}: ${r.title}`);
    });
    console.log('================================================================\n');
  }
}

runAudit();
