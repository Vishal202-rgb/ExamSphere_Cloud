// ==============================================================================
// ExamSphere – Enterprise Analytics & Aggregation Service
// Computes real PostgreSQL-backed metrics with resilient Redis caching
// ==============================================================================

import { prisma } from '../../config/db.js';
import { ApiError } from '../../utils/apiError.js';
import { cacheService } from '../../utils/cache.js';

class AnalyticsService {
  /**
   * Helper: verify faculty exam access
   */
  async verifyFacultyExamAccess(examId, user) {
    if (user.role === 'ADMIN') return true;

    const exam = await prisma.exam.findUnique({
      where: { id: examId },
      include: {
        course: {
          include: {
            facultyMembers: true,
          },
        },
      },
    });

    if (!exam) {
      throw ApiError.notFound('Examination not found');
    }

    const isCreator = exam.createdById === user.id;
    const isInstructor = exam.course?.facultyMembers?.some((f) => f.facultyId === user.id);

    if (!isCreator && !isInstructor) {
      throw ApiError.forbidden('You are not authorized to view analytics for this examination');
    }

    return exam;
  }

  /**
   * Helper: retrieve faculty's authorized course and exam IDs
   */
  async getFacultyAuthorizedExamIds(facultyId) {
    const facultyCourses = await prisma.courseFaculty.findMany({
      where: { facultyId },
      select: { courseId: true },
    });

    const courseIds = facultyCourses.map((fc) => fc.courseId);

    const exams = await prisma.exam.findMany({
      where: {
        OR: [{ createdById: facultyId }, { courseId: { in: courseIds } }],
      },
      select: { id: true },
    });

    return exams.map((e) => e.id);
  }

  /**
   * ADMIN: Comprehensive System-wide & Department-level Analytics
   */
  async getAdminOverview(filters = {}) {
    const { startDate, endDate, courseId, batch, section, examId, departmentId } = filters;

    const cacheKey = `analytics:admin:overview:${JSON.stringify(filters)}`;

    return await cacheService.remember(cacheKey, 180, async () => {
      // 1. Build date filter for exams / attempts / results
      const dateFilter = {};
      if (startDate || endDate) {
        dateFilter.createdAt = {};
        if (startDate) dateFilter.createdAt.gte = new Date(startDate);
        if (endDate) dateFilter.createdAt.lte = new Date(endDate);
      }

      // 2. User & Department Totals
      const userWhere = { isActive: true };
      if (departmentId) userWhere.departmentId = departmentId;
      if (batch) userWhere.batch = batch;
      if (section) userWhere.section = section;

      const [totalStudents, totalFaculty, totalCourses] = await Promise.all([
        prisma.user.count({ where: { ...userWhere, role: 'STUDENT' } }),
        prisma.user.count({
          where: { role: 'FACULTY', isActive: true, ...(departmentId ? { departmentId } : {}) },
        }),
        prisma.course.count({
          where: { isActive: true, ...(departmentId ? { departmentId } : {}) },
        }),
      ]);

      // 3. Exam filters
      const examWhere = { ...dateFilter };
      if (courseId) examWhere.courseId = courseId;
      if (examId) examWhere.id = examId;
      if (departmentId) examWhere.course = { departmentId };

      const [totalExams, activeExams, completedExams] = await Promise.all([
        prisma.exam.count({ where: examWhere }),
        prisma.exam.count({ where: { ...examWhere, status: 'LIVE' } }),
        prisma.exam.count({ where: { ...examWhere, status: 'COMPLETED' } }),
      ]);

      // 4. Attempts filter
      const attemptWhere = { ...dateFilter };
      if (examId) {
        attemptWhere.examId = examId;
      } else if (courseId || departmentId) {
        attemptWhere.exam = examWhere;
      }
      if (batch || section) {
        attemptWhere.student = { ...(batch ? { batch } : {}), ...(section ? { section } : {}) };
      }

      const [totalAttempts, completedAttemptsCount, inProgressAttemptsCount, autoSubmittedAttemptsCount] =
        await Promise.all([
          prisma.attempt.count({ where: attemptWhere }),
          prisma.attempt.count({ where: { ...attemptWhere, status: 'SUBMITTED' } }),
          prisma.attempt.count({ where: { ...attemptWhere, status: 'IN_PROGRESS' } }),
          prisma.attempt.count({ where: { ...attemptWhere, status: 'AUTO_SUBMITTED' } }),
        ]);

      // 5. Published Results calculations (Unpublished results are strictly excluded)
      const resultWhere = {
        publicationStatus: 'PUBLISHED',
        ...dateFilter,
      };
      if (examId) {
        resultWhere.examId = examId;
      } else if (courseId || departmentId) {
        resultWhere.exam = examWhere;
      }
      if (batch || section) {
        resultWhere.student = { ...(batch ? { batch } : {}), ...(section ? { section } : {}) };
      }

      const publishedResults = await prisma.result.findMany({
        where: resultWhere,
        select: {
          obtainedMarks: true,
          totalMarks: true,
          percentage: true,
          isPassed: true,
          createdAt: true,
          publishedAt: true,
          exam: { select: { id: true, title: true, courseId: true, course: { select: { title: true, code: true } } } },
          student: { select: { id: true, batch: true, section: true } },
        },
      });

      const totalPublishedResults = publishedResults.length;
      let overallAverageScore = 0;
      let overallPassPercentage = 0;

      if (totalPublishedResults > 0) {
        const totalPct = publishedResults.reduce((sum, r) => sum + r.percentage, 0);
        overallAverageScore = parseFloat((totalPct / totalPublishedResults).toFixed(2));

        const passedCount = publishedResults.filter((r) => r.isPassed === true).length;
        overallPassPercentage = parseFloat(((passedCount / totalPublishedResults) * 100).toFixed(2));
      }

      // Total assignments to calculate participation rate
      const totalAssignments = await prisma.examAssignment.count({
        where: examId ? { examId } : courseId || departmentId ? { exam: examWhere } : {},
      });

      const studentParticipationRate =
        totalAssignments > 0
          ? parseFloat(((totalAttempts / totalAssignments) * 100).toFixed(2))
          : 0;

      // 6. Pass vs Fail Distribution
      const passedCount = publishedResults.filter((r) => r.isPassed === true).length;
      const failedCount = totalPublishedResults - passedCount;
      const passFailDistribution = [
        { name: 'Passed', value: passedCount, color: '#10B981' },
        { name: 'Failed', value: failedCount, color: '#EF4444' },
      ];

      // 7. Student Performance Distribution (Score Brackets)
      const brackets = {
        '90-100%': 0,
        '80-89%': 0,
        '70-79%': 0,
        '60-69%': 0,
        '50-59%': 0,
        '40-49%': 0,
        '<40%': 0,
      };

      publishedResults.forEach((r) => {
        const p = r.percentage;
        if (p >= 90) brackets['90-100%']++;
        else if (p >= 80) brackets['80-89%']++;
        else if (p >= 70) brackets['70-79%']++;
        else if (p >= 60) brackets['60-69%']++;
        else if (p >= 50) brackets['50-59%']++;
        else if (p >= 40) brackets['40-49%']++;
        else brackets['<40%']++;
      });

      const studentPerformanceDistribution = Object.keys(brackets).map((bracket) => ({
        bracket,
        count: brackets[bracket],
      }));

      // 8. Exam Completion Statistics
      const examCompletionStats = [
        { status: 'Completed', count: completedAttemptsCount, color: '#10B981' },
        { status: 'Auto-Submitted', count: autoSubmittedAttemptsCount, color: '#F59E0B' },
        { status: 'In Progress', count: inProgressAttemptsCount, color: '#3B82F6' },
      ];

      // 9. Course-Wise Performance
      const courseMap = {};
      publishedResults.forEach((r) => {
        const cCode = r.exam?.course?.code || 'Unknown';
        const cTitle = r.exam?.course?.title || 'Unknown Course';
        if (!courseMap[cCode]) {
          courseMap[cCode] = {
            courseCode: cCode,
            courseTitle: cTitle,
            totalMarksAccumulated: 0,
            count: 0,
            passCount: 0,
          };
        }
        courseMap[cCode].totalMarksAccumulated += r.percentage;
        courseMap[cCode].count++;
        if (r.isPassed) courseMap[cCode].passCount++;
      });

      const courseWisePerformance = Object.values(courseMap).map((c) => ({
        courseCode: c.courseCode,
        courseTitle: c.courseTitle,
        averagePercentage: parseFloat((c.totalMarksAccumulated / c.count).toFixed(2)),
        totalResults: c.count,
        passPercentage: parseFloat(((c.passCount / c.count) * 100).toFixed(2)),
      }));

      // 10. Batch-Wise Performance
      const batchMap = {};
      publishedResults.forEach((r) => {
        const b = r.student?.batch || 'Unassigned';
        if (!batchMap[b]) {
          batchMap[b] = { batch: b, totalScore: 0, count: 0 };
        }
        batchMap[b].totalScore += r.percentage;
        batchMap[b].count++;
      });

      const batchWisePerformance = Object.values(batchMap).map((b) => ({
        batch: b.batch,
        averageScore: parseFloat((b.totalScore / b.count).toFixed(2)),
        totalStudentsEvaluated: b.count,
      }));

      // 11. Participation & Score Trends over time (Grouped by month or day)
      const attemptsByDate = await prisma.attempt.findMany({
        where: attemptWhere,
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
        take: 500,
      });

      const trendMap = {};
      attemptsByDate.forEach((a) => {
        const dateKey = a.createdAt.toISOString().slice(0, 10);
        if (!trendMap[dateKey]) {
          trendMap[dateKey] = { date: dateKey, attempts: 0, avgMarks: 0, resultCount: 0, totalMarks: 0 };
        }
        trendMap[dateKey].attempts++;
      });

      publishedResults.forEach((r) => {
        const dateKey = (r.publishedAt || r.createdAt).toISOString().slice(0, 10);
        if (!trendMap[dateKey]) {
          trendMap[dateKey] = { date: dateKey, attempts: 0, avgMarks: 0, resultCount: 0, totalMarks: 0 };
        }
        trendMap[dateKey].totalMarks += r.percentage;
        trendMap[dateKey].resultCount++;
      });

      const examParticipationOverTime = Object.values(trendMap)
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((t) => ({
          date: t.date,
          attempts: t.attempts,
          averageMarks: t.resultCount > 0 ? parseFloat((t.totalMarks / t.resultCount).toFixed(2)) : 0,
        }));

      return {
        overview: {
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
          studentParticipationRate,
        },
        charts: {
          examParticipationOverTime,
          passFailDistribution,
          courseWisePerformance,
          batchWisePerformance,
          examCompletionStats,
          studentPerformanceDistribution,
        },
      };
    });
  }

  /**
   * FACULTY: Overview & Performance restricted to authorized courses and exams
   */
  async getFacultyOverview(facultyUser, filters = {}) {
    const authorizedExamIds = await this.getFacultyAuthorizedExamIds(facultyUser.id);

    if (authorizedExamIds.length === 0) {
      return {
        overview: {
          totalExamsCreated: 0,
          totalAssignedStudents: 0,
          examParticipation: 0,
          averageScore: 0,
          highestScore: 0,
          lowestScore: 0,
          passFailRatio: { passed: 0, failed: 0 },
          pendingDescriptiveCount: 0,
        },
        recentExams: [],
        charts: {
          coursePerformance: [],
          passFailDistribution: [],
          scoreDistribution: [],
        },
      };
    }

    const { examId, courseId, batch, startDate, endDate } = filters;
    let targetExamIds = authorizedExamIds;

    if (examId) {
      if (!authorizedExamIds.includes(examId)) {
        throw ApiError.forbidden('You are not authorized to view analytics for this examination');
      }
      targetExamIds = [examId];
    } else if (courseId) {
      const courseExams = await prisma.exam.findMany({
        where: { id: { in: authorizedExamIds }, courseId },
        select: { id: true },
      });
      targetExamIds = courseExams.map((e) => e.id);
    }

    const cacheKey = `analytics:faculty:overview:${facultyUser.id}:${JSON.stringify(filters)}`;

    return await cacheService.remember(cacheKey, 180, async () => {
      const dateFilter = {};
      if (startDate || endDate) {
        dateFilter.createdAt = {};
        if (startDate) dateFilter.createdAt.gte = new Date(startDate);
        if (endDate) dateFilter.createdAt.lte = new Date(endDate);
      }

      // Distinct assigned students
      const assignedCount = await prisma.examAssignment.count({
        where: { examId: { in: targetExamIds } },
      });

      // Total attempts
      const attemptsCount = await prisma.attempt.count({
        where: { examId: { in: targetExamIds }, ...dateFilter },
      });

      const participationRate =
        assignedCount > 0 ? parseFloat(((attemptsCount / assignedCount) * 100).toFixed(2)) : 0;

      // Published results
      const resultWhere = {
        examId: { in: targetExamIds },
        publicationStatus: 'PUBLISHED',
        ...dateFilter,
      };
      if (batch) {
        resultWhere.student = { batch };
      }

      const publishedResults = await prisma.result.findMany({
        where: resultWhere,
        include: {
          exam: { select: { title: true, course: { select: { code: true, title: true } } } },
        },
      });

      let averageScore = 0;
      let highestScore = 0;
      let lowestScore = 0;
      let passedCount = 0;
      let failedCount = 0;

      if (publishedResults.length > 0) {
        const percentages = publishedResults.map((r) => r.percentage);
        const sum = percentages.reduce((acc, p) => acc + p, 0);
        averageScore = parseFloat((sum / publishedResults.length).toFixed(2));
        highestScore = parseFloat(Math.max(...percentages).toFixed(2));
        lowestScore = parseFloat(Math.min(...percentages).toFixed(2));
        passedCount = publishedResults.filter((r) => r.isPassed === true).length;
        failedCount = publishedResults.length - passedCount;
      }

      // Pending descriptive evaluations
      const pendingDescriptiveCount = await prisma.answer.count({
        where: {
          attempt: { examId: { in: targetExamIds } },
          question: { type: 'DESCRIPTIVE' },
          marksAwarded: 0,
          evaluatedAt: null,
        },
      });

      // Score distribution brackets
      const brackets = {
        '90-100%': 0,
        '80-89%': 0,
        '70-79%': 0,
        '60-69%': 0,
        '50-59%': 0,
        '<50%': 0,
      };
      publishedResults.forEach((r) => {
        const p = r.percentage;
        if (p >= 90) brackets['90-100%']++;
        else if (p >= 80) brackets['80-89%']++;
        else if (p >= 70) brackets['70-79%']++;
        else if (p >= 60) brackets['60-69%']++;
        else if (p >= 50) brackets['50-59%']++;
        else brackets['<50%']++;
      });

      const scoreDistribution = Object.keys(brackets).map((bracket) => ({
        bracket,
        count: brackets[bracket],
      }));

      // Recent authorized exams
      const recentExams = await prisma.exam.findMany({
        where: { id: { in: targetExamIds } },
        select: {
          id: true,
          title: true,
          status: true,
          totalMarks: true,
          startTime: true,
          course: { select: { code: true, title: true } },
          _count: { select: { attempts: true, assignments: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 6,
      });

      return {
        overview: {
          totalExamsCreated: targetExamIds.length,
          totalAssignedStudents: assignedCount,
          examParticipation: participationRate,
          averageScore,
          highestScore,
          lowestScore,
          passFailRatio: { passed: passedCount, failed: failedCount },
          pendingDescriptiveCount,
        },
        recentExams,
        charts: {
          passFailDistribution: [
            { name: 'Passed', value: passedCount, color: '#10B981' },
            { name: 'Failed', value: failedCount, color: '#EF4444' },
          ],
          scoreDistribution,
        },
      };
    });
  }

  /**
   * FACULTY: In-depth Exam Analytics (Question Accuracy, Difficulty, Skipped Questions)
   */
  async getFacultyExamAnalytics(examId, facultyUser) {
    await this.verifyFacultyExamAccess(examId, facultyUser);

    const cacheKey = `analytics:faculty:exam:${examId}`;

    return await cacheService.remember(cacheKey, 120, async () => {
      const exam = await prisma.exam.findUnique({
        where: { id: examId },
        include: {
          course: { select: { id: true, code: true, title: true } },
          examQuestions: {
            orderBy: { orderIndex: 'asc' },
            include: {
              question: {
                select: {
                  id: true,
                  questionText: true,
                  type: true,
                  difficulty: true,
                  marks: true,
                  topicTags: true,
                },
              },
            },
          },
        },
      });

      if (!exam) {
        throw ApiError.notFound('Examination not found');
      }

      const [assignedCount, attempts, publishedResults] = await Promise.all([
        prisma.examAssignment.count({ where: { examId } }),
        prisma.attempt.findMany({
          where: { examId },
          include: {
            answers: {
              select: {
                questionId: true,
                isCorrect: true,
                marksAwarded: true,
                selectedOptions: true,
                descriptiveAnswer: true,
              },
            },
          },
        }),
        prisma.result.findMany({
          where: { examId, publicationStatus: 'PUBLISHED' },
          include: {
            student: { select: { id: true, name: true, rollNumber: true, email: true } },
          },
          orderBy: { rank: 'asc' },
        }),
      ]);

      const totalAttempts = attempts.length;
      const completedAttempts = attempts.filter(
        (a) => a.status === 'SUBMITTED' || a.status === 'AUTO_SUBMITTED' || a.status === 'EVALUATED'
      ).length;

      // Score Aggregates
      let avgScore = 0;
      let highestScore = 0;
      let lowestScore = 0;
      let passedCount = 0;
      let failedCount = 0;

      if (publishedResults.length > 0) {
        const percentages = publishedResults.map((r) => r.percentage);
        avgScore = parseFloat((percentages.reduce((a, b) => a + b, 0) / publishedResults.length).toFixed(2));
        highestScore = Math.max(...percentages);
        lowestScore = Math.min(...percentages);
        passedCount = publishedResults.filter((r) => r.isPassed === true).length;
        failedCount = publishedResults.length - passedCount;
      }

      // Question Accuracy & Difficulty computation
      const questionAccuracy = exam.examQuestions.map((eq) => {
        const q = eq.question;
        const qMarks = eq.marks ?? q.marks;

        // Gather all answers for this question across completed attempts
        let answeredCount = 0;
        let correctCount = 0;
        let skippedCount = 0;
        let totalMarksSum = 0;

        attempts.forEach((att) => {
          const ans = att.answers.find((a) => a.questionId === q.id);
          const hasSelectedOption = Array.isArray(ans?.selectedOptions) && ans.selectedOptions.length > 0;
          const hasDescriptive = Boolean(ans?.descriptiveAnswer && ans.descriptiveAnswer.trim().length > 0);

          if (hasSelectedOption || hasDescriptive) {
            answeredCount++;
            if (ans.isCorrect === true) {
              correctCount++;
            }
            totalMarksSum += ans.marksAwarded || 0;
          } else {
            skippedCount++;
          }
        });

        const accuracyRate =
          totalAttempts > 0 ? parseFloat(((correctCount / totalAttempts) * 100).toFixed(2)) : 0;
        const avgMarksAwarded =
          answeredCount > 0 ? parseFloat((totalMarksSum / answeredCount).toFixed(2)) : 0;

        return {
          questionId: q.id,
          orderIndex: eq.orderIndex,
          questionText: q.questionText,
          type: q.type,
          difficulty: q.difficulty,
          configuredMarks: qMarks,
          totalAttempts,
          answeredCount,
          skippedCount,
          correctCount,
          accuracyRate,
          avgMarksAwarded,
        };
      });

      // Frequently skipped questions (top 5 with most skips)
      const frequentlySkippedQuestions = [...questionAccuracy]
        .sort((a, b) => b.skippedCount - a.skippedCount)
        .slice(0, 5);

      // Difficult questions (top 5 with lowest accuracy rate among questions with attempts)
      const difficultQuestions = [...questionAccuracy]
        .sort((a, b) => a.accuracyRate - b.accuracyRate)
        .slice(0, 5);

      // Pending descriptive count for this exam
      const pendingDescriptiveCount = await prisma.answer.count({
        where: {
          attempt: { examId },
          question: { type: 'DESCRIPTIVE' },
          marksAwarded: 0,
          evaluatedAt: null,
        },
      });

      return {
        examDetails: {
          id: exam.id,
          title: exam.title,
          course: exam.course,
          totalMarks: exam.totalMarks,
          passingMarks: exam.passingMarks,
          durationMinutes: exam.durationMinutes,
        },
        participation: {
          assignedStudents: assignedCount,
          totalAttempts,
          completedAttempts,
          participationRate:
            assignedCount > 0 ? parseFloat(((totalAttempts / assignedCount) * 100).toFixed(2)) : 0,
        },
        scoreStats: {
          publishedResultsCount: publishedResults.length,
          averagePercentage: avgScore,
          highestPercentage: highestScore,
          lowestPercentage: lowestScore,
          passedCount,
          failedCount,
          passPercentage:
            publishedResults.length > 0
              ? parseFloat(((passedCount / publishedResults.length) * 100).toFixed(2))
              : 0,
        },
        questionAccuracy,
        frequentlySkippedQuestions,
        difficultQuestions,
        descriptiveEvaluation: {
          pendingCount: pendingDescriptiveCount,
          status: pendingDescriptiveCount === 0 ? 'COMPLETED' : 'PENDING_REVIEW',
        },
      };
    });
  }

  /**
   * STUDENT: Personal Exam Analytics (Strictly Student's Own Published Data)
   */
  async getStudentOverview(studentId) {
    // 1. Fetch student's published results only (Never reveal unpublished results)
    const publishedResults = await prisma.result.findMany({
      where: {
        studentId,
        publicationStatus: 'PUBLISHED',
      },
      include: {
        exam: {
          select: {
            id: true,
            title: true,
            totalMarks: true,
            passingMarks: true,
            course: { select: { id: true, code: true, title: true } },
          },
        },
      },
      orderBy: { publishedAt: 'desc' },
    });

    const totalAttempts = await prisma.attempt.count({
      where: { studentId },
    });

    const completedAttempts = await prisma.attempt.count({
      where: {
        studentId,
        status: { in: ['SUBMITTED', 'AUTO_SUBMITTED', 'EVALUATED'] },
      },
    });

    let averagePercentage = 0;
    let highestScore = 0;
    let lowestScore = 0;
    let passedExamsCount = 0;
    let failedExamsCount = 0;

    let totalCorrectAnswers = 0;
    let totalIncorrectAnswers = 0;
    let totalUnanswered = 0;

    if (publishedResults.length > 0) {
      const percentages = publishedResults.map((r) => r.percentage);
      averagePercentage = parseFloat(
        (percentages.reduce((acc, p) => acc + p, 0) / publishedResults.length).toFixed(2)
      );
      highestScore = parseFloat(Math.max(...percentages).toFixed(2));
      lowestScore = parseFloat(Math.min(...percentages).toFixed(2));
      passedExamsCount = publishedResults.filter((r) => r.isPassed === true).length;
      failedExamsCount = publishedResults.length - passedExamsCount;

      publishedResults.forEach((r) => {
        totalCorrectAnswers += r.correctAnswersCount || 0;
        totalIncorrectAnswers += r.incorrectAnswersCount || 0;
        totalUnanswered += r.unansweredCount || 0;
      });
    }

    // Course / Subject Breakdown
    const courseMap = {};
    publishedResults.forEach((r) => {
      const c = r.exam.course;
      if (!courseMap[c.code]) {
        courseMap[c.code] = {
          courseCode: c.code,
          courseTitle: c.title,
          totalPercentage: 0,
          examsCount: 0,
        };
      }
      courseMap[c.code].totalPercentage += r.percentage;
      courseMap[c.code].examsCount++;
    });

    const subjectPerformance = Object.values(courseMap).map((c) => ({
      courseCode: c.courseCode,
      courseTitle: c.courseTitle,
      averagePercentage: parseFloat((c.totalPercentage / c.examsCount).toFixed(2)),
      examsCount: c.examsCount,
    }));

    // Answer Distribution for Donut / Pie chart
    const answerDistribution = [
      { name: 'Correct', value: totalCorrectAnswers, color: '#10B981' },
      { name: 'Incorrect', value: totalIncorrectAnswers, color: '#EF4444' },
      { name: 'Unanswered', value: totalUnanswered, color: '#9CA3AF' },
    ];

    // Recent results list
    const recentResults = publishedResults.slice(0, 5).map((r) => ({
      id: r.id,
      examId: r.exam.id,
      examTitle: r.exam.title,
      courseCode: r.exam.course.code,
      courseTitle: r.exam.course.title,
      percentage: r.percentage,
      obtainedMarks: r.obtainedMarks,
      totalMarks: r.totalMarks,
      isPassed: r.isPassed,
      rank: r.rank,
      publishedAt: r.publishedAt,
    }));

    return {
      overview: {
        examsAttempted: totalAttempts,
        examsCompleted: completedAttempts,
        publishedResultsCount: publishedResults.length,
        averagePercentage,
        highestScore,
        lowestScore,
        passedExamsCount,
        failedExamsCount,
      },
      answerDistribution,
      subjectPerformance,
      recentResults,
    };
  }

  /**
   * STUDENT: Chronological Performance Trend over time
   */
  async getStudentPerformanceTrend(studentId) {
    const publishedResults = await prisma.result.findMany({
      where: {
        studentId,
        publicationStatus: 'PUBLISHED',
      },
      include: {
        exam: {
          select: {
            title: true,
            course: { select: { code: true } },
          },
        },
      },
      orderBy: { publishedAt: 'asc' },
    });

    return publishedResults.map((r) => ({
      examTitle: r.exam.title,
      courseCode: r.exam.course.code,
      percentage: r.percentage,
      obtainedMarks: r.obtainedMarks,
      totalMarks: r.totalMarks,
      date: (r.publishedAt || r.createdAt).toISOString().slice(0, 10),
    }));
  }

  /**
   * Invalidate cached analytics when results are published, attempts are updated, or exams change
   */
  async invalidateAnalyticsCache() {
    await cacheService.invalidatePattern('analytics:*');
  }
}

export const analyticsService = new AnalyticsService();
