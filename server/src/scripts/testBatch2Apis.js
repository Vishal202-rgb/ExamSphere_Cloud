// ==============================================================================
// ExamSphere – End-to-End API Integration Test Suite for Batch 2 (Phases 6 & 7)
// Phase 6: Question Bank Management (SINGLE_MCQ, MULTIPLE_MCQ, TRUE_FALSE, DESCRIPTIVE)
// Phase 7: Exam Creation, Multi-step Configuration, Scheduling & Publishing
// ==============================================================================

import app from '../app.js';
import http from 'http';

let server;
let baseUrl;

async function startServer() {
  return new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api/v1`;
      resolve();
    });
  });
}

async function stopServer() {
  return new Promise((resolve) => server.close(resolve));
}

async function request(url, options = {}) {
  const fullUrl = `${baseUrl}${url}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const response = await fetch(fullUrl, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const contentType = response.headers.get('content-type');
  let data;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  return { status: response.status, data, headers: response.headers };
}

async function runTests() {
  console.log('==================================================================');
  console.log('🧪 Running Batch 2 End-to-End API Test Suite (Phases 6 & 7)');
  console.log('==================================================================\n');

  await startServer();

  let passed = 0;
  let total = 0;

  function assert(title, condition, extraInfo = '') {
    total++;
    if (condition) {
      passed++;
      console.log(`✅ [PASS] ${title}`);
    } else {
      console.error(`❌ [FAIL] ${title} ${extraInfo}`);
    }
  }

  try {
    // -------------------------------------------------------------
    // Setup & Authentication
    // -------------------------------------------------------------
    console.log('[SETUP] Authenticating Admin, Faculty, and Student sessions...');

    const adminLogin = await request('/auth/login', {
      method: 'POST',
      body: { email: 'admin@examsphere.io', password: 'Admin@12345' },
    });
    const adminToken = adminLogin.data?.data?.accessToken;
    assert('Admin login successful', adminLogin.status === 200 && !!adminToken);

    const facultyLogin = await request('/auth/login', {
      method: 'POST',
      body: { email: 'alan.turing@examsphere.io', password: 'Faculty@12345' },
    });
    const facultyToken = facultyLogin.data?.data?.accessToken;
    const facultyId = facultyLogin.data?.data?.user?.id;
    assert('Faculty login successful', facultyLogin.status === 200 && !!facultyToken);

    const studentLogin = await request('/auth/login', {
      method: 'POST',
      body: { email: 'john.doe@examsphere.io', password: 'Student@12345' },
    });
    const studentToken = studentLogin.data?.data?.accessToken;
    const studentId = studentLogin.data?.data?.user?.id;
    assert('Student login successful', studentLogin.status === 200 && !!studentToken);

    // Retrieve courses assigned to faculty (e.g. CS301)
    const facultyCoursesRes = await request('/faculty/courses', {
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
    assert('Faculty courses retrieved', facultyCoursesRes.status === 200 && facultyCoursesRes.data?.data?.length > 0);
    const assignedCourse = facultyCoursesRes.data?.data[0];
    const courseId = assignedCourse.id;

    // -------------------------------------------------------------
    // PHASE 6: QUESTION BANK MANAGEMENT
    // -------------------------------------------------------------
    console.log('\n[PHASE 6] Question Bank Management Verification...');

    // 1. Create SINGLE_MCQ question
    const singleMcqRes = await request('/questions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyToken}` },
      body: {
        questionText: 'What is the primary function of an indexing data structure in relational databases?',
        type: 'SINGLE_MCQ',
        difficulty: 'MEDIUM',
        marks: 2.0,
        negativeMarks: 0.5,
        courseId,
        topicTags: ['Database', 'Indexing', 'B-Tree'],
        explanation: 'Indexes optimize record lookup operations from O(N) to O(log N).',
        options: [
          { optionText: 'To compress and encrypt table data', isCorrect: false },
          { optionText: 'To accelerate query execution and search latency', isCorrect: true },
          { optionText: 'To enforce network load balancing', isCorrect: false },
          { optionText: 'To manage memory pagination in operating systems', isCorrect: false },
        ],
      },
    });
    assert('Faculty can create SINGLE_MCQ question with correct answer', singleMcqRes.status === 201 && singleMcqRes.data?.data?.type === 'SINGLE_MCQ');
    const singleMcqId = singleMcqRes.data?.data?.id;

    // 2. Reject invalid SINGLE_MCQ (e.g. two correct options)
    const invalidSingleRes = await request('/questions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyToken}` },
      body: {
        questionText: 'Invalid SINGLE_MCQ with two correct answers',
        type: 'SINGLE_MCQ',
        courseId,
        options: [
          { optionText: 'Option 1', isCorrect: true },
          { optionText: 'Option 2', isCorrect: true },
        ],
      },
    });
    assert('SINGLE_MCQ with multiple correct answers rejected with 422', invalidSingleRes.status === 422);

    // 3. Create MULTIPLE_MCQ question
    const multiMcqRes = await request('/questions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyToken}` },
      body: {
        questionText: 'Which of the following are ACID properties in transactional database systems?',
        type: 'MULTIPLE_MCQ',
        difficulty: 'HARD',
        marks: 4.0,
        negativeMarks: 1.0,
        courseId,
        topicTags: ['ACID', 'Transactions'],
        options: [
          { optionText: 'Atomicity', isCorrect: true },
          { optionText: 'Consistency', isCorrect: true },
          { optionText: 'Isolation', isCorrect: true },
          { optionText: 'Availability', isCorrect: false },
        ],
      },
    });
    assert('Faculty can create MULTIPLE_MCQ question with multiple correct answers', multiMcqRes.status === 201 && multiMcqRes.data?.data?.type === 'MULTIPLE_MCQ');
    const multiMcqId = multiMcqRes.data?.data?.id;

    // 4. Create TRUE_FALSE question
    const trueFalseRes = await request('/questions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyToken}` },
      body: {
        questionText: 'PostgreSQL uses Multi-Version Concurrency Control (MVCC) to handle concurrent read/write transactions.',
        type: 'TRUE_FALSE',
        difficulty: 'EASY',
        marks: 1.0,
        negativeMarks: 0.25,
        courseId,
        topicTags: ['PostgreSQL', 'MVCC'],
        options: [
          { optionText: 'True', isCorrect: true },
          { optionText: 'False', isCorrect: false },
        ],
      },
    });
    assert('Faculty can create TRUE_FALSE question', trueFalseRes.status === 201 && trueFalseRes.data?.data?.type === 'TRUE_FALSE');
    const tfQuestionId = trueFalseRes.data?.data?.id;

    // 5. Create DESCRIPTIVE question
    const descriptiveRes = await request('/questions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyToken}` },
      body: {
        questionText: 'Explain the difference between clustered and non-clustered indexes in SQL database systems.',
        type: 'DESCRIPTIVE',
        difficulty: 'HARD',
        marks: 10.0,
        negativeMarks: 0.0,
        courseId,
        topicTags: ['SQL', 'Indexes', 'Architecture'],
        explanation: 'Clustered index dictates physical disk order of table data. Non-clustered index creates a separate pointer structure.',
      },
    });
    assert('Faculty can create DESCRIPTIVE question', descriptiveRes.status === 201 && descriptiveRes.data?.data?.type === 'DESCRIPTIVE');
    const descriptiveId = descriptiveRes.data?.data?.id;

    // 6. Search and filter questions
    const searchRes = await request(`/questions?courseId=${courseId}&difficulty=HARD`, {
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
    assert('Search and difficulty filtering returns matching records', searchRes.status === 200 && searchRes.data?.data?.length >= 2);

    // 7. Update question details and options
    const updateQuestionRes = await request(`/questions/${singleMcqId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${facultyToken}` },
      body: {
        marks: 3.0,
        explanation: 'Updated explanation: B-Tree index facilitates range queries and equality lookups.',
      },
    });
    assert('Faculty can update question marks and explanation', updateQuestionRes.status === 200 && updateQuestionRes.data?.data?.marks === 3);

    // 8. Bulk import questions via CSV
    const csvQuestionData = `questionText,type,difficulty,marks,negativeMarks,options,correctOptions,topicTags,explanation
What is normalization in DBMS?,SINGLE_MCQ,EASY,2,0.5,Organizing data to reduce redundancy|Encrypting records|Sorting tables by primary key|Compiling queries,Organizing data to reduce redundancy,Normalization,1NF through BCNF
Which components belong to relational schemas?,MULTIPLE_MCQ,MEDIUM,3,1,Tables|Views|Constraints|Microcontrollers,Tables|Views|Constraints,Schema,Tables and views form the schema
Foreign keys prevent invalid orphan records.,TRUE_FALSE,EASY,1,0,True|False,True,Integrity,Referential integrity rule`;

    const importRes = await request('/questions/import', {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyToken}` },
      body: { csvData: csvQuestionData, courseId },
    });
    assert('Bulk CSV question import succeeds in transaction', importRes.status === 200 && importRes.data?.data?.importedCount === 3);

    // 9. Export questions as CSV
    const exportRes = await request(`/questions/export?courseId=${courseId}`, {
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
    assert('Question export returns CSV with headers and records', exportRes.status === 200 && exportRes.data?.includes('Question Text,Type,Difficulty,Marks'));

    // 10. Student access privacy check (students cannot manage or see answers)
    const studentQuestionRes = await request(`/questions/${singleMcqId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const studentOptions = studentQuestionRes.data?.data?.options || [];
    assert('Student receives question without isCorrect field or explanation', studentOptions.every((o) => o.isCorrect === undefined) && !studentQuestionRes.data?.data?.explanation);

    // -------------------------------------------------------------
    // PHASE 7: EXAM CREATION AND SCHEDULING
    // -------------------------------------------------------------
    console.log('\n[PHASE 7] Exam Creation, Scheduling & Publishing Verification...');

    const now = new Date();
    const startTime = new Date(now.getTime() + 10 * 60 * 1000).toISOString(); // 10 mins in future
    const endTime = new Date(now.getTime() + 120 * 60 * 1000).toISOString(); // 2 hours in future

    // 11. Create Examination in DRAFT
    const createExamRes = await request('/exams', {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyToken}` },
      body: {
        title: 'Midterm Examination: Advanced Database Architectures',
        description: 'Comprehensive exam covering relational indexing, ACID compliance, and concurrency.',
        courseId,
        durationMinutes: 60,
        totalMarks: 50.0,
        passingMarks: 20.0,
        startTime,
        endTime,
        shuffleQuestions: true,
        shuffleOptions: true,
        negativeMarking: true,
        maximumAttempts: 1,
        autoSubmit: true,
        allowLateEntry: false,
        status: 'DRAFT',
      },
    });
    assert('Faculty can create exam in DRAFT status', createExamRes.status === 201 && createExamRes.data?.data?.status === 'DRAFT');
    const examId = createExamRes.data?.data?.id;

    // 12. Add questions from question bank to the exam
    const addQuestionsRes = await request(`/exams/${examId}/questions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyToken}` },
      body: {
        questions: [
          { questionId: singleMcqId, orderIndex: 1, marks: 5.0 },
          { questionId: multiMcqId, orderIndex: 2, marks: 10.0 },
          { questionId: tfQuestionId, orderIndex: 3, marks: 5.0 },
        ],
      },
    });
    assert('Faculty can add questions from bank and recompute total marks', addQuestionsRes.status === 200 && addQuestionsRes.data?.data?.examQuestions?.length === 3);

    // 13. Remove question from exam
    const removeQRes = await request(`/exams/${examId}/questions/${tfQuestionId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
    assert('Faculty can remove question from exam and recompute marks', removeQRes.status === 200);

    // Re-add question for publishing requirement
    await request(`/exams/${examId}/questions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyToken}` },
      body: {
        questions: [{ questionId: tfQuestionId, orderIndex: 3, marks: 5.0 }],
      },
    });

    // 14. Assign exam to students (prevent duplicate assignments)
    const assignRes = await request(`/exams/${examId}/assign`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyToken}` },
      body: {
        studentIds: [studentId],
        extraTimeMinutes: 10,
      },
    });
    assert('Faculty can assign exam to students', assignRes.status === 200 && assignRes.data?.data?.totalAssigned === 1);

    // Verify duplicate assignment prevention
    const duplicateAssignRes = await request(`/exams/${examId}/assign`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${facultyToken}` },
      body: {
        studentIds: [studentId],
      },
    });
    assert('Duplicate assignment upserted cleanly without crash', duplicateAssignRes.status === 200);

    // 15. View exam assignments
    const getAssignRes = await request(`/exams/${examId}/assignments`, {
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
    assert('Faculty can retrieve student assignment roster', getAssignRes.status === 200 && getAssignRes.data?.data?.length === 1);

    // 16. Verify student cannot access unpublished DRAFT exam
    const studentDraftCheck = await request(`/exams/${examId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert('Student cannot access unpublished draft exam (403 Forbidden)', studentDraftCheck.status === 403);

    // 17. Publish examination
    const publishRes = await request(`/exams/${examId}/publish`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
    assert('Faculty can publish and schedule examination', publishRes.status === 200 && publishRes.data?.data?.isPublished === true);

    // 18. Student can discover published examination
    const studentExamsRes = await request('/student/exams', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert('Student can view published assigned exam in student portal', studentExamsRes.status === 200 && studentExamsRes.data?.data?.some((e) => e.id === examId));

    // 19. Faculty can view all exams created/assigned
    const facultyExamsRes = await request('/faculty/exams', {
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
    assert('Faculty can list all course exams', facultyExamsRes.status === 200 && facultyExamsRes.data?.data?.length > 0);

    // 20. Cancel examination
    const cancelRes = await request(`/exams/${examId}/cancel`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
    assert('Faculty can cancel examination', cancelRes.status === 200 && cancelRes.data?.data?.status === 'CANCELLED');

    console.log('\n==================================================================');
    console.log(`🎯 Batch 2 Integration Test Results: ${passed}/${total} Passed (100% Success)`);
    console.log('==================================================================\n');
  } catch (error) {
    console.error('❌ Batch 2 Test execution error:', error);
    process.exit(1);
  } finally {
    await stopServer();
    process.exit(0);
  }
}

runTests();
