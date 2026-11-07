// ==============================================================================
// ExamSphere – Verification Script for Question Bank Single MCQ Fix
// ==============================================================================

import app from '../app.js';
import http from 'http';
import { prisma } from '../config/db.js';

async function main() {
  console.log('==================================================================');
  console.log('🧪 Starting Verification: Question Bank Creation API Fix');
  console.log('==================================================================\n');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api/v1`;

  let createdQuestionId = null;

  try {
    // --------------------------------------------------------------------------
    // Step 1: Authenticate as Faculty (Alan Turing)
    // --------------------------------------------------------------------------
    console.log('1️⃣ Authenticating as faculty (alan.turing@examsphere.io)...');
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alan.turing@examsphere.io',
        password: 'Faculty@12345',
      }),
    });
    const loginData = await loginRes.json();
    if (loginRes.status !== 200 || !loginData?.data?.accessToken) {
      throw new Error(`Faculty login failed: ${JSON.stringify(loginData)}`);
    }
    const token = loginData.data.accessToken;
    const facultyUser = loginData.data.user;
    console.log(`   ✅ Logged in successfully as ${facultyUser.name} (${facultyUser.id})`);

    // --------------------------------------------------------------------------
    // Step 2: Retrieve Assigned Courses & Find CS301
    // --------------------------------------------------------------------------
    console.log('\n2️⃣ Fetching assigned courses...');
    const coursesRes = await fetch(`${baseUrl}/faculty/courses`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const coursesData = await coursesRes.json();
    const cs301 = coursesData?.data?.find((c) => c.code === 'CS301');
    if (!cs301) {
      throw new Error('CS301 course not found in faculty assignments');
    }
    console.log(`   ✅ Found assigned course CS301: "${cs301.title}" (ID: ${cs301.id})`);

    // --------------------------------------------------------------------------
    // Step 3: Create Single MCQ Question
    // --------------------------------------------------------------------------
    console.log('\n3️⃣ Submitting Single MCQ Question creation to POST /api/v1/questions...');
    const questionPayload = {
      courseId: cs301.id,
      type: 'SINGLE_MCQ',
      difficulty: 'EASY',
      title: 'What is the Full form of CORS?',
      questionText: 'What is the Full form of CORS?',
      topic: 'WebDev',
      topicTags: ['WebDev'],
      marks: 1,
      negativeMarks: 0,
      explanation: 'Cross-Origin Resource Sharing (CORS) is an HTTP-header based mechanism that allows a server to indicate any origins other than its own from which a browser should permit loading resources.',
      options: [
        { optionText: 'Cross-Origin Resource Sharing', isCorrect: true, orderIndex: 0 },
        { optionText: 'Cross-Origin Request Security', isCorrect: false, orderIndex: 1 },
        { optionText: 'Central Origin Routing System', isCorrect: false, orderIndex: 2 },
        { optionText: 'Client Origin Response Standard', isCorrect: false, orderIndex: 3 },
      ],
    };

    const createRes = await fetch(`${baseUrl}/questions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(questionPayload),
    });
    const createResult = await createRes.json();

    console.log(`   Status: HTTP ${createRes.status}`);
    console.log(`   Response Message: "${createResult.message}"`);
    if (createRes.status !== 201 || !createResult.data?.id) {
      throw new Error(`Question creation failed: ${JSON.stringify(createResult)}`);
    }
    createdQuestionId = createResult.data.id;
    console.log(`   ✅ Question created successfully with ID: ${createdQuestionId}`);

    // --------------------------------------------------------------------------
    // Step 4: Direct Neon PostgreSQL Database Verification
    // --------------------------------------------------------------------------
    console.log('\n4️⃣ Verifying records in Neon PostgreSQL database directly...');
    const dbQuestion = await prisma.question.findUnique({
      where: { id: createdQuestionId },
      include: {
        options: { orderBy: { orderIndex: 'asc' } },
        course: { select: { id: true, code: true, title: true } },
        createdBy: { select: { id: true, name: true, email: true, role: true } },
      },
    });

    if (!dbQuestion) {
      throw new Error(`Question ${createdQuestionId} was not found in database!`);
    }

    console.log('   📄 Database Question Record:');
    console.log(`      - ID: ${dbQuestion.id}`);
    console.log(`      - Question Text: "${dbQuestion.questionText}"`);
    console.log(`      - Type: ${dbQuestion.type}`);
    console.log(`      - Difficulty: ${dbQuestion.difficulty}`);
    console.log(`      - Marks: ${dbQuestion.marks}`);
    console.log(`      - Negative Marks: ${dbQuestion.negativeMarks}`);
    console.log(`      - Topic Tags: ${JSON.stringify(dbQuestion.topicTags)}`);
    console.log(`      - Course Code: ${dbQuestion.course.code} ("${dbQuestion.course.title}")`);
    console.log(`      - Faculty Creator: ${dbQuestion.createdBy.name} (${dbQuestion.createdBy.email})`);

    // Verify Options
    console.log(`   📋 Stored Options Count: ${dbQuestion.options.length}`);
    const correctOptions = dbQuestion.options.filter((o) => o.isCorrect);
    console.log(`      - Correct Options Count: ${correctOptions.length}`);
    dbQuestion.options.forEach((opt, idx) => {
      console.log(`      [${idx}] ${opt.isCorrect ? '✅ (CORRECT)' : '⚪ (INCORRECT)'} ${opt.optionText}`);
    });

    if (dbQuestion.options.length !== 4) {
      throw new Error(`Expected 4 options, found ${dbQuestion.options.length}`);
    }
    if (correctOptions.length !== 1 || correctOptions[0].optionText !== 'Cross-Origin Resource Sharing') {
      throw new Error(`Expected exactly 1 correct option 'Cross-Origin Resource Sharing', found: ${JSON.stringify(correctOptions)}`);
    }
    if (dbQuestion.course.code !== 'CS301') {
      throw new Error(`Expected course code CS301, found: ${dbQuestion.course.code}`);
    }
    if (dbQuestion.createdBy.id !== facultyUser.id) {
      throw new Error(`Expected createdBy ID ${facultyUser.id}, found: ${dbQuestion.createdBy.id}`);
    }
    console.log('   ✅ All database assertions passed perfectly!');

    // --------------------------------------------------------------------------
    // Step 5: Question Bank Retrieval API Verification (GET /api/v1/questions)
    // --------------------------------------------------------------------------
    console.log('\n5️⃣ Retrieving questions from Question Bank API (GET /api/v1/questions)...');
    const getRes = await fetch(`${baseUrl}/questions?courseId=${cs301.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const getResult = await getRes.json();
    console.log(`   Status: HTTP ${getRes.status}`);

    const retrievedList = Array.isArray(getResult.data) ? getResult.data : [];
    const foundQuestion = retrievedList.find((q) => q.id === createdQuestionId);

    if (!foundQuestion) {
      throw new Error(`Created question ID ${createdQuestionId} was not found in GET questions response!`);
    }
    console.log(`   ✅ Created question successfully returned in Question Bank list!`);
    console.log(`      - Found Question Text: "${foundQuestion.questionText || foundQuestion.title}"`);
    console.log(`      - Options Attached: ${foundQuestion.options?.length}`);

    // --------------------------------------------------------------------------
    // Step 6: Edge Case Validation Testing (SuperRefine single MCQ rules)
    // --------------------------------------------------------------------------
    console.log('\n6️⃣ Testing validation safeguards...');

    // A) 0 Correct Options
    const zeroCorrectPayload = {
      courseId: cs301.id,
      type: 'SINGLE_MCQ',
      questionText: 'Test question with zero correct options?',
      options: [
        { optionText: 'Option A', isCorrect: false },
        { optionText: 'Option B', isCorrect: false },
      ],
    };
    const zeroRes = await fetch(`${baseUrl}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(zeroCorrectPayload),
    });
    const zeroData = await zeroRes.json();
    console.log(`   - Zero Correct Options: HTTP ${zeroRes.status} (Expected 422) -> ${zeroData.errors?.[0]?.message}`);
    if (zeroRes.status !== 422) throw new Error('Expected 422 for zero correct options');

    // B) Multiple Correct Options in Single MCQ
    const twoCorrectPayload = {
      courseId: cs301.id,
      type: 'SINGLE_MCQ',
      questionText: 'Test question with two correct options?',
      options: [
        { optionText: 'Option A', isCorrect: true },
        { optionText: 'Option B', isCorrect: true },
      ],
    };
    const twoRes = await fetch(`${baseUrl}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(twoCorrectPayload),
    });
    const twoData = await twoRes.json();
    console.log(`   - Two Correct Options in Single MCQ: HTTP ${twoRes.status} (Expected 422) -> ${twoData.errors?.[0]?.message}`);
    if (twoRes.status !== 422) throw new Error('Expected 422 for multiple correct options in Single MCQ');

    console.log('\n==================================================================');
    console.log('🎉 ALL INTEGRATION & DATABASE VERIFICATION TESTS PASSED SUCCESSFULLY');
    console.log('==================================================================');
  } catch (err) {
    console.error('\n❌ Verification Failed:', err);
    process.exit(1);
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

main();
