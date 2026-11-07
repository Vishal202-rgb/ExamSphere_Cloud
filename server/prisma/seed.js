// ==============================================================================
// ExamSphere – Production-Ready Database Seeder
// Seeds Departments, Users (Admin, Faculty, Students), Courses, Enrollments,
// Questions, Options, Exams, and Assignments using bcrypt hashed passwords.
// ==============================================================================

import { PrismaClient, UserRole, QuestionType, QuestionDifficulty, ExamStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting ExamSphere Database Seed...');

  // 1. Clean existing records in reverse dependency order
  console.log('🧹 Purging existing database records...');
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.answer.deleteMany();
  await prisma.result.deleteMany();
  await prisma.attempt.deleteMany();
  await prisma.examAssignment.deleteMany();
  await prisma.examQuestion.deleteMany();
  await prisma.questionOption.deleteMany();
  await prisma.question.deleteMany();
  await prisma.exam.deleteMany();
  await prisma.studentEnrollment.deleteMany();
  await prisma.courseFaculty.deleteMany();
  await prisma.course.deleteMany();
  await prisma.user.deleteMany();
  await prisma.department.deleteMany();

  // 2. Seed Departments
  console.log('🏢 Seeding Departments...');
  const cseDept = await prisma.department.create({
    data: {
      name: 'Computer Science & Engineering',
      code: 'CSE',
      description: 'Department of Computer Science, Software Architecture, and Intelligent Systems',
    },
  });

  const itDept = await prisma.department.create({
    data: {
      name: 'Information Technology',
      code: 'IT',
      description: 'Department of Cloud Computing, Distributed Networks, and Cybersecurity',
    },
  });

  // 3. Hash default passwords
  console.log('🔐 Hashing credentials...');
  const saltRounds = 12;
  const adminPasswordHash = await bcrypt.hash('Admin@12345', saltRounds);
  const facultyPasswordHash = await bcrypt.hash('Faculty@12345', saltRounds);
  const studentPasswordHash = await bcrypt.hash('Student@12345', saltRounds);

  // 4. Seed Admin
  console.log('👑 Seeding Administrator Account...');
  const adminUser = await prisma.user.create({
    data: {
      name: 'System Administrator',
      email: 'admin@examsphere.io',
      password: adminPasswordHash,
      role: UserRole.ADMIN,
      departmentId: cseDept.id,
      isActive: true,
    },
  });

  // 5. Seed Faculty Members
  console.log('👨‍🏫 Seeding Faculty Members...');
  const facultyTuring = await prisma.user.create({
    data: {
      name: 'Dr. Alan Turing',
      email: 'alan.turing@examsphere.io',
      password: facultyPasswordHash,
      role: UserRole.FACULTY,
      departmentId: cseDept.id,
      isActive: true,
    },
  });

  const facultyLovelace = await prisma.user.create({
    data: {
      name: 'Prof. Ada Lovelace',
      email: 'ada.lovelace@examsphere.io',
      password: facultyPasswordHash,
      role: UserRole.FACULTY,
      departmentId: cseDept.id,
      isActive: true,
    },
  });

  // 6. Seed Students
  console.log('🎓 Seeding Student Accounts...');
  const studentJohn = await prisma.user.create({
    data: {
      name: 'John Doe',
      email: 'john.doe@examsphere.io',
      password: studentPasswordHash,
      role: UserRole.STUDENT,
      departmentId: cseDept.id,
      rollNumber: 'CS2023001',
      batch: '2023-2027',
      section: 'A',
      isActive: true,
    },
  });

  const studentJane = await prisma.user.create({
    data: {
      name: 'Jane Smith',
      email: 'jane.smith@examsphere.io',
      password: studentPasswordHash,
      role: UserRole.STUDENT,
      departmentId: cseDept.id,
      rollNumber: 'CS2023002',
      batch: '2023-2027',
      section: 'A',
      isActive: true,
    },
  });

  const studentAlex = await prisma.user.create({
    data: {
      name: 'Alex Johnson',
      email: 'alex.johnson@examsphere.io',
      password: studentPasswordHash,
      role: UserRole.STUDENT,
      departmentId: cseDept.id,
      rollNumber: 'CS2023003',
      batch: '2023-2027',
      section: 'B',
      isActive: true,
    },
  });

  // 7. Seed Courses
  console.log('📚 Seeding Courses...');
  const dsaCourse = await prisma.course.create({
    data: {
      code: 'CS301',
      title: 'Data Structures and Algorithms',
      description: 'Advanced study of algorithmic complexity, tree balanced structures, graphs, and dynamic programming.',
      credits: 4,
      departmentId: cseDept.id,
      isActive: true,
    },
  });

  const dbmsCourse = await prisma.course.create({
    data: {
      code: 'CS302',
      title: 'Database Management Systems',
      description: 'Relational calculus, SQL optimizations, concurrency control, B+ Trees, and transactions ACID properties.',
      credits: 3,
      departmentId: cseDept.id,
      isActive: true,
    },
  });

  const cnCourse = await prisma.course.create({
    data: {
      code: 'IT204',
      title: 'Computer Networks and Security',
      description: 'OSI 7 layers, TCP/IP sockets, sliding window protocols, routing algorithms, and cryptographic handshakes.',
      credits: 3,
      departmentId: itDept.id,
      isActive: true,
    },
  });

  // 8. Associate Faculty with Courses (CourseFaculty)
  console.log('🔗 Assigning Faculty to Courses...');
  await prisma.courseFaculty.createMany({
    data: [
      {
        courseId: dsaCourse.id,
        facultyId: facultyTuring.id,
        isCoordinator: true,
      },
      {
        courseId: dbmsCourse.id,
        facultyId: facultyLovelace.id,
        isCoordinator: true,
      },
      {
        courseId: cnCourse.id,
        facultyId: facultyTuring.id,
        isCoordinator: false,
      },
    ],
  });

  // 9. Enroll Students in Courses (StudentEnrollment)
  console.log('📝 Enrolling Students in Courses...');
  const students = [studentJohn, studentJane, studentAlex];
  for (const student of students) {
    await prisma.studentEnrollment.create({
      data: {
        courseId: dsaCourse.id,
        studentId: student.id,
      },
    });
    await prisma.studentEnrollment.create({
      data: {
        courseId: dbmsCourse.id,
        studentId: student.id,
      },
    });
  }

  // 10. Seed Questions & QuestionOptions for DSA Course
  console.log('❓ Seeding Questions with Options...');
  
  // Q1: Single MCQ
  const q1 = await prisma.question.create({
    data: {
      questionText: 'What is the average time complexity of searching an element in a Balanced Binary Search Tree (AVL / Red-Black Tree)?',
      type: QuestionType.SINGLE_MCQ,
      difficulty: QuestionDifficulty.EASY,
      marks: 2.0,
      negativeMarks: 0.5,
      courseId: dsaCourse.id,
      createdById: facultyTuring.id,
      topicTags: ['Trees', 'Binary Search Tree', 'Time Complexity'],
      explanation: 'Balanced BSTs maintain height h = O(log n), so lookup, insertion, and deletion take O(log n) time.',
      options: {
        create: [
          { optionText: 'O(1)', isCorrect: false, orderIndex: 0 },
          { optionText: 'O(log n)', isCorrect: true, orderIndex: 1 },
          { optionText: 'O(n)', isCorrect: false, orderIndex: 2 },
          { optionText: 'O(n log n)', isCorrect: false, orderIndex: 3 },
        ],
      },
    },
  });

  // Q2: Multiple MCQ
  const q2 = await prisma.question.create({
    data: {
      questionText: 'Which of the following sorting algorithms exhibit guaranteed O(n log n) worst-case time complexity? (Select all that apply)',
      type: QuestionType.MULTIPLE_MCQ,
      difficulty: QuestionDifficulty.MEDIUM,
      marks: 3.0,
      negativeMarks: 1.0,
      courseId: dsaCourse.id,
      createdById: facultyTuring.id,
      topicTags: ['Sorting', 'Algorithmic Analysis'],
      explanation: 'Merge Sort and Heap Sort guarantee O(n log n) worst-case time. Standard QuickSort has worst-case O(n^2).',
      options: {
        create: [
          { optionText: 'Merge Sort', isCorrect: true, orderIndex: 0 },
          { optionText: 'Heap Sort', isCorrect: true, orderIndex: 1 },
          { optionText: 'Quick Sort (standard deterministic pivot)', isCorrect: false, orderIndex: 2 },
          { optionText: 'Bubble Sort', isCorrect: false, orderIndex: 3 },
        ],
      },
    },
  });

  // Q3: True/False
  const q3 = await prisma.question.create({
    data: {
      questionText: 'Dijkstra’s algorithm works correctly on graphs with negative edge weights.',
      type: QuestionType.TRUE_FALSE,
      difficulty: QuestionDifficulty.EASY,
      marks: 1.5,
      negativeMarks: 0.5,
      courseId: dsaCourse.id,
      createdById: facultyTuring.id,
      topicTags: ['Graphs', 'Shortest Path'],
      explanation: 'Dijkstra fails with negative weight cycles or negative edges because it greedily finalizes shortest distances. Bellman-Ford must be used instead.',
      options: {
        create: [
          { optionText: 'True', isCorrect: false, orderIndex: 0 },
          { optionText: 'False', isCorrect: true, orderIndex: 1 },
        ],
      },
    },
  });

  // Q4: Descriptive
  const q4 = await prisma.question.create({
    data: {
      questionText: 'Explain the difference between Dynamic Programming (DP) and Divide and Conquer. Provide an example problem where DP applies but Divide and Conquer causes exponential recursion.',
      type: QuestionType.DESCRIPTIVE,
      difficulty: QuestionDifficulty.HARD,
      marks: 5.0,
      negativeMarks: 0.0,
      courseId: dsaCourse.id,
      createdById: facultyTuring.id,
      topicTags: ['Dynamic Programming', 'Divide and Conquer', 'Recursion'],
      explanation: 'Divide and Conquer solves disjoint subproblems (e.g. MergeSort). DP solves overlapping subproblems with optimal substructure (e.g. 0/1 Knapsack, Fibonacci) by memoizing subproblem solutions.',
    },
  });

  // 11. Seed a Sample Scheduled Exam
  console.log('📋 Seeding Scheduled Examination...');
  const now = new Date();
  const startTime = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow
  const endTime = new Date(startTime.getTime() + 120 * 60 * 1000); // 2 hours window

  const midTermExam = await prisma.exam.create({
    data: {
      title: 'CS301: Midterm Examination - Algorithms & Data Structures',
      description: 'Comprehensive mid-term evaluation covering Asymptotic Analysis, Balanced Search Trees, Graphs, and Dynamic Programming.',
      courseId: dsaCourse.id,
      createdById: facultyTuring.id,
      durationMinutes: 90,
      totalMarks: 50.0,
      passingMarks: 20.0,
      startTime: startTime,
      endTime: endTime,
      status: ExamStatus.SCHEDULED,
      isPublished: true,
      shuffleQuestions: true,
      shuffleOptions: true,
      negativeMarking: true,
      maxAttempts: 1,
      autoSubmit: true,
    },
  });

  // 12. Link Questions to Exam (ExamQuestion)
  console.log('🔗 Attaching Questions to Examination...');
  await prisma.examQuestion.createMany({
    data: [
      { examId: midTermExam.id, questionId: q1.id, orderIndex: 1, marks: 10.0 },
      { examId: midTermExam.id, questionId: q2.id, orderIndex: 2, marks: 15.0 },
      { examId: midTermExam.id, questionId: q3.id, orderIndex: 3, marks: 10.0 },
      { examId: midTermExam.id, questionId: q4.id, orderIndex: 4, marks: 15.0 },
    ],
  });

  // 13. Assign Exam to Students (ExamAssignment)
  console.log('🎯 Assigning Exam to Enrolled Students...');
  for (const student of students) {
    await prisma.examAssignment.create({
      data: {
        examId: midTermExam.id,
        studentId: student.id,
        extraTimeMinutes: 0,
      },
    });
  }

  // 14. Seed Audit Log entry
  await prisma.auditLog.create({
    data: {
      userId: adminUser.id,
      action: 'DATABASE_INITIALIZATION_AND_SEED',
      resource: 'SYSTEM',
      metadata: {
        phase: 'PHASE_2_DATABASE_ARCHITECTURE',
        seededModels: 15,
        timestamp: new Date().toISOString(),
      },
    },
  });

  console.log('\n======================================================');
  console.log('🎉 ExamSphere Database Seeding Completed Successfully!');
  console.log('======================================================');
  console.log('📊 Summary of Seeded Data:');
  console.log(`   - Departments:  ${await prisma.department.count()}`);
  console.log(`   - Users:        ${await prisma.user.count()} (1 Admin, 2 Faculty, 3 Students)`);
  console.log(`   - Courses:      ${await prisma.course.count()}`);
  console.log(`   - Questions:    ${await prisma.question.count()} (with QuestionOption rows)`);
  console.log(`   - Exams:        ${await prisma.exam.count()}`);
  console.log(`   - Assignments:  ${await prisma.examAssignment.count()}`);
  console.log('======================================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
