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
  return data.data.accessToken;
}

async function runTests() {
  console.log('================================================================');
  console.log('ExamSphere – End-to-End Test Suite for Multi-Course Exam & QB');
  console.log('================================================================\n');

  const testResults = [];
  function recordResult(scenarioNum, title, passed, details = '') {
    testResults.push({ scenarioNum, title, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`[Scenario ${scenarioNum}] ${mark} – ${title}`);
    if (details) console.log(`   Details: ${details}\n`);
  }

  try {
    // 0. Preparation: Login faculty Dr. Alan Turing
    const facultyToken = await login('alan.turing@examsphere.io', 'Faculty@12345');
    const facultyHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${facultyToken}`,
    };

    const cs301 = await prisma.course.findUnique({ where: { code: 'CS301' } });
    const it204 = await prisma.course.findUnique({ where: { code: 'IT204' } });
    if (!cs301 || !it204) throw new Error('CS301 or IT204 not found in database');

    const now = new Date();
    const startTime = new Date(now.getTime() - 5 * 60 * 1000).toISOString(); // 5 min ago (so it is LIVE immediately)
    const endTime = new Date(now.getTime() + 120 * 60 * 1000).toISOString();  // 2 hours ahead

    // ========================================================================
    // Scenario 1: Create an exam for CS301 only
    // ========================================================================
    try {
      const res1 = await fetch(`${API_BASE}/exams`, {
        method: 'POST',
        headers: facultyHeaders,
        body: JSON.stringify({
          title: `CS301 Midterm Test - ${Date.now()}`,
          courseId: cs301.id,
          durationMinutes: 45,
          startTime,
          endTime,
        }),
      });
      const data1 = await res1.json();
      const exam1 = data1.data;
      const linkedCourses = await prisma.examCourse.findMany({ where: { examId: exam1.id } });
      const pass1 = res1.ok && exam1.courseId === cs301.id && linkedCourses.length === 1 && linkedCourses[0].courseId === cs301.id;
      recordResult(1, 'Create an exam for CS301 only', pass1, `Exam ID: ${exam1.id}, Primary: CS301, Linked Courses: ${linkedCourses.length}`);
    } catch (e) {
      recordResult(1, 'Create an exam for CS301 only', false, e.message);
    }

    // ========================================================================
    // Scenario 2: Create an exam for IT204 only
    // ========================================================================
    try {
      const res2 = await fetch(`${API_BASE}/exams`, {
        method: 'POST',
        headers: facultyHeaders,
        body: JSON.stringify({
          title: `IT204 Network Exam - ${Date.now()}`,
          courseIds: [it204.id],
          durationMinutes: 50,
          startTime,
          endTime,
        }),
      });
      const data2 = await res2.json();
      const exam2 = data2.data;
      const linkedCourses = await prisma.examCourse.findMany({ where: { examId: exam2.id } });
      const pass2 = res2.ok && linkedCourses.length === 1 && linkedCourses[0].courseId === it204.id;
      recordResult(2, 'Create an exam for IT204 only', pass2, `Exam ID: ${exam2.id}, Primary: IT204, Linked Courses: ${linkedCourses.length}`);
    } catch (e) {
      recordResult(2, 'Create an exam for IT204 only', false, e.message);
    }

    // ========================================================================
    // Scenario 3: Create an exam for both CS301 and IT204
    // ========================================================================
    let multiExam = null;
    try {
      const res3 = await fetch(`${API_BASE}/exams`, {
        method: 'POST',
        headers: facultyHeaders,
        body: JSON.stringify({
          title: `CS301 & IT204 Joint Assessment - ${Date.now()}`,
          courseIds: [cs301.id, it204.id],
          durationMinutes: 60,
          startTime,
          endTime,
        }),
      });
      const data3 = await res3.json();
      multiExam = data3.data;
      const linkedCourses = await prisma.examCourse.findMany({
        where: { examId: multiExam.id },
        include: { course: true },
      });
      const pass3 = res3.ok && linkedCourses.length === 2 &&
        linkedCourses.some((c) => c.course.code === 'CS301') &&
        linkedCourses.some((c) => c.course.code === 'IT204');
      recordResult(
        3,
        'Create an exam for both CS301 and IT204',
        pass3,
        `Exam ID: ${multiExam.id}, Linked Courses: ${linkedCourses.map((c) => c.course.code).join(', ')}`
      );
    } catch (e) {
      recordResult(3, 'Create an exam for both CS301 and IT204', false, e.message);
    }

    // ========================================================================
    // Scenario 4: Verify questions from each selected course appear
    // ========================================================================
    let retrievedQuestions = [];
    try {
      const res4 = await fetch(`${API_BASE}/questions?courseIds=${cs301.id},${it204.id}&limit=100`, {
        headers: facultyHeaders,
      });
      const data4 = await res4.json();
      retrievedQuestions = data4.data || [];
      const hasCs301 = retrievedQuestions.some((q) => q.course?.code === 'CS301' || q.courseCode === 'CS301');
      const hasIt204 = retrievedQuestions.some((q) => q.course?.code === 'IT204' || q.courseCode === 'IT204');
      const allHaveCourseCode = retrievedQuestions.every((q) => Boolean(q.courseCode || q.course?.code));
      const pass4 = res4.ok && retrievedQuestions.length >= 2 && hasCs301 && hasIt204 && allHaveCourseCode;
      recordResult(
        4,
        'Verify questions from each selected course appear',
        pass4,
        `Retrieved ${retrievedQuestions.length} questions across CS301 and IT204. Course codes present: ${allHaveCourseCode}`
      );
    } catch (e) {
      recordResult(4, 'Verify questions from each selected course appear', false, e.message);
    }

    // ========================================================================
    // Scenario 5: Attach questions from both courses
    // ========================================================================
    const cs301Q = retrievedQuestions.find((q) => (q.courseCode || q.course?.code) === 'CS301');
    const it204Q = retrievedQuestions.find((q) => (q.courseCode || q.course?.code) === 'IT204');

    try {
      const attachRes = await fetch(`${API_BASE}/exams/${multiExam.id}/questions`, {
        method: 'POST',
        headers: facultyHeaders,
        body: JSON.stringify({
          questionIds: [cs301Q.id, it204Q.id],
          questions: [
            { questionId: cs301Q.id, orderIndex: 0, marks: cs301Q.marks },
            { questionId: it204Q.id, orderIndex: 1, marks: it204Q.marks },
          ],
        }),
      });
      const attachData = await attachRes.json();
      const linkedQuestions = await prisma.examQuestion.findMany({
        where: { examId: multiExam.id },
        include: { question: { include: { course: true } } },
      });
      const expectedTotalMarks = (cs301Q.marks || 1) + (it204Q.marks || 2);
      const pass5 = attachRes.ok && linkedQuestions.length === 2 &&
        linkedQuestions.some((lq) => lq.question.course.code === 'CS301') &&
        linkedQuestions.some((lq) => lq.question.course.code === 'IT204');
      if (!attachRes.ok) {
        console.log('ATTACH ERROR:', attachRes.status, attachData);
      }
      recordResult(
        5,
        'Attach questions from both courses',
        pass5,
        `Attach status: ${attachRes.status}, Linked in DB: ${linkedQuestions.length} (${linkedQuestions.map((lq) => `${lq.question.course.code}: +${lq.marks || lq.question.marks}M`).join(', ')}). Total marks: ${attachData.data?.totalMarks}`
      );
    } catch (e) {
      recordResult(5, 'Attach questions from both courses', false, e.message);
    }

    // ========================================================================
    // Scenario 6: Assign students from both courses
    // ========================================================================
    const john = await prisma.user.findUnique({ where: { email: 'john.doe@examsphere.io' } }); // CS301
    const jane = await prisma.user.findUnique({ where: { email: 'jane.smith@examsphere.io' } }); // IT204
    const alex = await prisma.user.findUnique({ where: { email: 'alex.johnson@examsphere.io' } }); // Keep unassigned

    try {
      // 1. Verify roster API retrieves students with department & course info
      const rosterRes = await fetch(`${API_BASE}/faculty/students?courseIds=${cs301.id},${it204.id}`, {
        headers: facultyHeaders,
      });
      const rosterData = await rosterRes.json();
      const rosterStudents = rosterData.data || [];
      const hasJohn = rosterStudents.some((s) => s.id === john.id);
      const hasJane = rosterStudents.some((s) => s.id === jane.id);

      // 2. Assign John (CS301) and Jane (IT204), leaving Alex unassigned
      const assignRes = await fetch(`${API_BASE}/exams/${multiExam.id}/assign`, {
        method: 'POST',
        headers: facultyHeaders,
        body: JSON.stringify({
          studentIds: [john.id, jane.id],
        }),
      });
      const assignData = await assignRes.json();
      const assignmentsInDb = await prisma.examAssignment.findMany({
        where: { examId: multiExam.id },
      });

      const pass6 = assignRes.ok && assignmentsInDb.length === 2 &&
        assignmentsInDb.some((a) => a.studentId === john.id) &&
        assignmentsInDb.some((a) => a.studentId === jane.id) &&
        !assignmentsInDb.some((a) => a.studentId === alex.id);
      recordResult(
        6,
        'Assign students from both courses',
        pass6,
        `Assigned John Doe (CS301) and Jane Smith (IT204). Alex Johnson unassigned. Roster returned ${rosterStudents.length} candidates.`
      );
    } catch (e) {
      recordResult(6, 'Assign students from both courses', false, e.message);
    }

    // ========================================================================
    // Scenario 7: Publish the exam
    // ========================================================================
    try {
      const pubRes = await fetch(`${API_BASE}/exams/${multiExam.id}/publish`, {
        method: 'PATCH',
        headers: facultyHeaders,
      });
      const pubData = await pubRes.json();
      const publishedExam = await prisma.exam.findUnique({ where: { id: multiExam.id } });
      const pass7 = pubRes.ok && publishedExam.isPublished === true && publishedExam.status === 'LIVE';
      recordResult(
        7,
        'Publish the exam',
        pass7,
        `isPublished: ${publishedExam.isPublished}, status: ${publishedExam.status}`
      );
    } catch (e) {
      recordResult(7, 'Publish the exam', false, e.message);
    }

    // ========================================================================
    // Scenario 8: Login as a CS301 student and verify exam visibility
    // ========================================================================
    try {
      const johnToken = await login('john.doe@examsphere.io', 'Student@12345');
      const johnHeaders = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${johnToken}`,
      };
      const res8 = await fetch(`${API_BASE}/student/exams`, { headers: johnHeaders });
      const data8 = await res8.json();
      const examVisibleToJohn = (data8.data || []).find((e) => e.id === multiExam.id);
      const pass8 = res8.ok && Boolean(examVisibleToJohn) && examVisibleToJohn.isLive === true;
      recordResult(
        8,
        'Login as a CS301 student and verify exam visibility',
        pass8,
        `Exam visible to John Doe: ${Boolean(examVisibleToJohn)}, Title: "${examVisibleToJohn?.title}", CourseCode: ${examVisibleToJohn?.courseCode}`
      );
    } catch (e) {
      recordResult(8, 'Login as a CS301 student and verify exam visibility', false, e.message);
    }

    // ========================================================================
    // Scenario 9: Login as an IT204 student and verify exam visibility
    // ========================================================================
    try {
      const janeToken = await login('jane.smith@examsphere.io', 'Student@12345');
      const janeHeaders = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${janeToken}`,
      };
      const res9 = await fetch(`${API_BASE}/student/exams`, { headers: janeHeaders });
      const data9 = await res9.json();
      const examVisibleToJane = (data9.data || []).find((e) => e.id === multiExam.id);
      const pass9 = res9.ok && Boolean(examVisibleToJane) && examVisibleToJane.isLive === true;
      recordResult(
        9,
        'Login as an IT204 student and verify exam visibility',
        pass9,
        `Exam visible to Jane Smith: ${Boolean(examVisibleToJane)}, Title: "${examVisibleToJane?.title}", CourseCode: ${examVisibleToJane?.courseCode}`
      );
    } catch (e) {
      recordResult(9, 'Login as an IT204 student and verify exam visibility', false, e.message);
    }

    // ========================================================================
    // Scenario 10: Verify an unassigned student cannot access the exam
    // ========================================================================
    try {
      const alexToken = await login('alex.johnson@examsphere.io', 'Student@12345');
      const alexHeaders = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${alexToken}`,
      };

      // In /student/exams list
      const res10List = await fetch(`${API_BASE}/student/exams`, { headers: alexHeaders });
      const data10List = await res10List.json();
      const inList = (data10List.data || []).some((e) => e.id === multiExam.id);

      // Direct access via GET /exams/:id
      const res10Direct = await fetch(`${API_BASE}/exams/${multiExam.id}`, { headers: alexHeaders });

      // Direct start attempt via POST /exams/:id/start
      const res10Start = await fetch(`${API_BASE}/exams/${multiExam.id}/start`, {
        method: 'POST',
        headers: alexHeaders,
      });

      const pass10 = !inList && (res10Direct.status === 403 || res10Direct.status === 404) && res10Start.status === 403;
      recordResult(
        10,
        'Verify an unassigned student cannot access the exam',
        pass10,
        `In List: ${inList}, Direct GET Status: ${res10Direct.status}, Start Status: ${res10Start.status} (403 Forbidden properly enforced)`
      );
    } catch (e) {
      recordResult(10, 'Verify an unassigned student cannot access the exam', false, e.message);
    }

    // ========================================================================
    // Scenario 11: Attempt and submit the exam
    // ========================================================================
    try {
      const johnToken = await login('john.doe@examsphere.io', 'Student@12345');
      const johnHeaders = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${johnToken}`,
      };

      // 1. Start Exam
      const startRes = await fetch(`${API_BASE}/exams/${multiExam.id}/start`, {
        method: 'POST',
        headers: johnHeaders,
      });
      const startData = await startRes.json();
      const attempt = startData.data?.attempt;
      if (!attempt) throw new Error('Attempt could not be started: ' + JSON.stringify(startData));

      // 2. Autosave an answer for question 1
      const q1Options = cs301Q.options || [];
      const correctOpt = q1Options.find((o) => o.isCorrect) || q1Options[0];

      if (correctOpt) {
        await fetch(`${API_BASE}/attempts/${attempt.id}/answers/${cs301Q.id}`, {
          method: 'PUT',
          headers: johnHeaders,
          body: JSON.stringify({
            selectedOptions: [correctOpt.id],
            version: 1,
          }),
        });
      }

      // 3. Submit attempt
      const submitRes = await fetch(`${API_BASE}/attempts/${attempt.id}/submit`, {
        method: 'POST',
        headers: johnHeaders,
        body: JSON.stringify({ reason: 'MANUAL' }),
      });
      const submitData = await submitRes.json();

      const dbAttempt = await prisma.attempt.findUnique({
        where: { id: attempt.id },
        include: { answers: true },
      });

      const pass11 = submitRes.ok && dbAttempt.status === 'SUBMITTED' && dbAttempt.submittedAt !== null;
      recordResult(
        11,
        'Attempt and submit the exam',
        pass11,
        `Attempt ID: ${attempt.id}, Final Status: ${dbAttempt.status}, Answers Recorded: ${dbAttempt.answers.length}`
      );
    } catch (e) {
      recordResult(11, 'Attempt and submit the exam', false, e.message);
    }

    // ========================================================================
    // Scenario 12: Verify all records in Neon PostgreSQL
    // ========================================================================
    try {
      const finalExam = await prisma.exam.findUnique({
        where: { id: multiExam.id },
        include: {
          course: true,
          courses: { include: { course: true } },
          examQuestions: { include: { question: { include: { course: true, options: true } } } },
          assignments: { include: { student: true } },
          attempts: { include: { answers: true } },
        },
      });

      const hasBothCourses = finalExam.courses.length === 2 &&
        finalExam.courses.some((c) => c.course.code === 'CS301') &&
        finalExam.courses.some((c) => c.course.code === 'IT204');
      const hasQuestionsBothCourses = finalExam.examQuestions.some((eq) => eq.question.course.code === 'CS301') &&
        finalExam.examQuestions.some((eq) => eq.question.course.code === 'IT204');
      const hasBothStudents = finalExam.assignments.some((a) => a.student.email === 'john.doe@examsphere.io') &&
        finalExam.assignments.some((a) => a.student.email === 'jane.smith@examsphere.io');
      const hasAttemptsInDb = finalExam.attempts.length > 0;

      const pass12 = Boolean(finalExam) && hasBothCourses && hasQuestionsBothCourses && hasBothStudents && hasAttemptsInDb;
      recordResult(
        12,
        'Verify all records in Neon PostgreSQL',
        pass12,
        `Exam: ${finalExam.id}, Courses: ${finalExam.courses.map((c) => c.course.code).join(' & ')}, Questions: ${finalExam.examQuestions.length}, Assignments: ${finalExam.assignments.length}, Attempts: ${finalExam.attempts.length}`
      );
    } catch (e) {
      recordResult(12, 'Verify all records in Neon PostgreSQL', false, e.message);
    }

  } catch (err) {
    console.error('Fatal error during E2E test execution:', err);
  } finally {
    await prisma.$disconnect();
    console.log('\n================================================================');
    console.log('TEST SUMMARY');
    console.log('================================================================');
    const total = testResults.length;
    const passedCount = testResults.filter((r) => r.passed).length;
    console.log(`Total Scenarios: ${total}`);
    console.log(`Passed: ${passedCount}`);
    console.log(`Failed: ${total - passedCount}`);
    testResults.forEach((r) => {
      console.log(`[${r.passed ? 'PASS' : 'FAIL'}] Scenario ${r.scenarioNum}: ${r.title}`);
    });
    console.log('================================================================\n');
  }
}

runTests();
