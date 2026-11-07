import { prisma } from '../config/db.js';

async function seed() {
  const it204 = await prisma.course.findUnique({
    where: { code: 'IT204' },
  });

  if (!it204) {
    console.error('IT204 course not found');
    return;
  }

  const alan = await prisma.user.findUnique({
    where: { email: 'alan.turing@examsphere.io' },
  });

  const jane = await prisma.user.findUnique({
    where: { email: 'jane.smith@examsphere.io' },
  });

  // 1. Ensure Jane Smith is enrolled in IT204
  await prisma.studentEnrollment.upsert({
    where: {
      courseId_studentId: {
        courseId: it204.id,
        studentId: jane.id,
      },
    },
    update: { status: 'ACTIVE' },
    create: {
      courseId: it204.id,
      studentId: jane.id,
      status: 'ACTIVE',
    },
  });
  console.log(`Enrolled ${jane.name} in IT204`);

  // 2. Add sample IT204 questions if none exist
  const existingQuestions = await prisma.question.count({
    where: { courseId: it204.id },
  });

  if (existingQuestions === 0) {
    const q1 = await prisma.question.create({
      data: {
        courseId: it204.id,
        createdById: alan.id,
        questionText: 'Which transport layer protocol provides connection-oriented, reliable byte stream delivery?',
        type: 'SINGLE_MCQ',
        difficulty: 'EASY',
        marks: 2.0,
        negativeMarks: 0.5,
        topicTags: ['Networking', 'TransportLayer', 'TCP'],
        explanation: 'TCP guarantees reliable in-order byte delivery with flow and congestion control.',
        isActive: true,
        options: {
          create: [
            { optionText: 'TCP (Transmission Control Protocol)', isCorrect: true, orderIndex: 0 },
            { optionText: 'UDP (User Datagram Protocol)', isCorrect: false, orderIndex: 1 },
            { optionText: 'ICMP (Internet Control Message Protocol)', isCorrect: false, orderIndex: 2 },
            { optionText: 'IP (Internet Protocol)', isCorrect: false, orderIndex: 3 },
          ],
        },
      },
    });

    const q2 = await prisma.question.create({
      data: {
        courseId: it204.id,
        createdById: alan.id,
        questionText: 'What is the primary function of the Address Resolution Protocol (ARP)?',
        type: 'SINGLE_MCQ',
        difficulty: 'MEDIUM',
        marks: 2.0,
        negativeMarks: 0.5,
        topicTags: ['Networking', 'DataLinkLayer', 'ARP'],
        explanation: 'ARP translates a 32-bit IPv4 address into a 48-bit Ethernet MAC address on a local area network.',
        isActive: true,
        options: {
          create: [
            { optionText: 'Translates an IPv4 address to a hardware MAC address', isCorrect: true, orderIndex: 0 },
            { optionText: 'Resolves domain names to IP addresses', isCorrect: false, orderIndex: 1 },
            { optionText: 'Encrypts payloads at the network boundary', isCorrect: false, orderIndex: 2 },
            { optionText: 'Dynamically assigns IP addresses to hosts', isCorrect: false, orderIndex: 3 },
          ],
        },
      },
    });

    console.log(`Created 2 questions for IT204: ${q1.id}, ${q2.id}`);
  } else {
    console.log(`IT204 already has ${existingQuestions} questions.`);
  }
}

seed()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
