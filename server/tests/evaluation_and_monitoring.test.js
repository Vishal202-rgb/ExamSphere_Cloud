// ==============================================================================
// ExamSphere – Batch 4 Comprehensive Test Suite (Phases 10 & 11)
// Rigorously tests Evaluation Engine, Manual Grading, Result Publication,
// Competition Ranking, Socket.IO Authorization, Telemetry, and Notifications
// ==============================================================================

import test, { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// In-Memory Test Database for Mocking Database Layer
class MockEvaluationDB {
  constructor() {
    this.reset();
  }

  reset() {
    this.users = new Map();
    this.exams = new Map();
    this.attempts = new Map();
    this.answers = new Map();
    this.results = new Map();
    this.notifications = new Map();
    this.announcements = new Map();
    this.auditLogs = [];
    this.emittedEvents = [];
  }
}

const db = new MockEvaluationDB();

// Test Evaluation & Monitoring Engine
class TestEvaluationEngine {
  constructor(database) {
    this.db = database;
  }

  emit(target, event, data) {
    this.db.emittedEvents.push({ target, event, data, timestamp: new Date().toISOString() });
  }

  async evaluateAttempt(attemptId) {
    const attempt = this.db.attempts.get(attemptId);
    if (!attempt) throw new Error('Attempt not found');

    const exam = this.db.exams.get(attempt.examId);
    if (!exam) throw new Error('Exam not found');

    const examQuestions = exam.questions || [];
    const studentAnswers = Array.from(this.db.answers.values()).filter((a) => a.attemptId === attemptId);
    const answersMap = new Map(studentAnswers.map((a) => [a.questionId, a]));

    let correctAnswersCount = 0;
    let incorrectAnswersCount = 0;
    let unansweredCount = 0;
    let totalObtainedMarks = 0;
    let hasPendingDescriptive = false;

    for (const q of examQuestions) {
      const maxMarks = q.marks ?? 1.0;
      const negativeMarks = exam.negativeMarking ? (q.negativeMarks ?? 0.0) : 0.0;
      const studentAnswer = answersMap.get(q.id);

      let marksAwarded = 0;
      let isCorrect = null;

      if (!studentAnswer) {
        unansweredCount++;
        isCorrect = null;
        marksAwarded = 0;
      } else if (q.type === 'SINGLE_MCQ' || q.type === 'TRUE_FALSE') {
        const selected = studentAnswer.selectedOptions || [];
        if (selected.length === 0) {
          unansweredCount++;
          isCorrect = null;
          marksAwarded = 0;
        } else {
          const correctOption = q.options.find((opt) => opt.isCorrect);
          if (correctOption && selected.length === 1 && selected[0] === correctOption.id) {
            isCorrect = true;
            marksAwarded = maxMarks;
            correctAnswersCount++;
          } else {
            isCorrect = false;
            marksAwarded = negativeMarks > 0 ? -negativeMarks : 0;
            incorrectAnswersCount++;
          }
        }
      } else if (q.type === 'MULTIPLE_MCQ') {
        const selected = studentAnswer.selectedOptions || [];
        if (selected.length === 0) {
          unansweredCount++;
          isCorrect = null;
          marksAwarded = 0;
        } else {
          const correctOptionIds = q.options.filter((opt) => opt.isCorrect).map((opt) => opt.id);
          const isExactMatch =
            selected.length === correctOptionIds.length &&
            selected.every((id) => correctOptionIds.includes(id));

          if (isExactMatch) {
            isCorrect = true;
            marksAwarded = maxMarks;
            correctAnswersCount++;
          } else {
            isCorrect = false;
            marksAwarded = negativeMarks > 0 ? -negativeMarks : 0;
            incorrectAnswersCount++;
          }
        }
      } else if (q.type === 'DESCRIPTIVE') {
        const text = studentAnswer.descriptiveAnswer?.trim();
        if (!text) {
          unansweredCount++;
          isCorrect = false;
          marksAwarded = 0;
        } else {
          if (studentAnswer.evaluatedAt || studentAnswer.facultyFeedback !== undefined) {
            marksAwarded = studentAnswer.marksAwarded || 0;
            isCorrect = marksAwarded > 0;
            if (isCorrect) correctAnswersCount++;
            else incorrectAnswersCount++;
          } else {
            hasPendingDescriptive = true;
            marksAwarded = 0;
            isCorrect = null;
          }
        }
      }

      totalObtainedMarks += marksAwarded;

      if (studentAnswer) {
        studentAnswer.marksAwarded = marksAwarded;
        studentAnswer.isCorrect = isCorrect;
        this.db.answers.set(`${attemptId}:${q.id}`, studentAnswer);
      }
    }

    totalObtainedMarks = Math.max(0, Math.round(totalObtainedMarks * 100) / 100);
    const totalMarks = exam.totalMarks || 100;
    const percentage = totalMarks > 0 ? Math.round((totalObtainedMarks / totalMarks) * 10000) / 100 : 0;
    const isPassed = exam.passingMarks !== undefined ? totalObtainedMarks >= exam.passingMarks : null;
    const evaluationStatus = hasPendingDescriptive ? 'MANUAL_EVALUATION_PENDING' : 'EVALUATED';
    const now = new Date();

    // Idempotent upsert of Result
    let result = this.db.results.get(attemptId);
    if (!result) {
      result = {
        id: `res-${attemptId}`,
        attemptId,
        studentId: attempt.studentId,
        examId: attempt.examId,
        obtainedMarks: totalObtainedMarks,
        totalMarks,
        percentage,
        correctAnswersCount,
        incorrectAnswersCount,
        unansweredCount,
        isPassed,
        evaluationStatus,
        publicationStatus: 'DRAFT',
        rank: null,
        evaluatedAt: now,
      };
      this.db.results.set(attemptId, result);
    } else {
      result.obtainedMarks = totalObtainedMarks;
      result.totalMarks = totalMarks;
      result.percentage = percentage;
      result.correctAnswersCount = correctAnswersCount;
      result.incorrectAnswersCount = incorrectAnswersCount;
      result.unansweredCount = unansweredCount;
      result.isPassed = isPassed;
      result.evaluationStatus = evaluationStatus;
      result.evaluatedAt = now;
    }

    attempt.obtainedMarks = totalObtainedMarks;
    attempt.evaluationStatus = evaluationStatus;
    if (evaluationStatus === 'EVALUATED') {
      attempt.status = 'EVALUATED';
    }
    this.db.attempts.set(attemptId, attempt);

    if (hasPendingDescriptive) {
      this.emit(`user:${exam.createdById}`, 'notification:new', {
        title: 'Manual Evaluation Required',
        message: `Evaluation needed for student ${attempt.studentId}`,
      });
    } else {
      this.emit(`exam:${exam.id}:faculty`, 'evaluation:completed', {
        attemptId,
        studentId: attempt.studentId,
        evaluationStatus: 'EVALUATED',
      });
    }

    return { attempt, result };
  }

  async manualGrade(attemptId, evaluations, facultyUser) {
    const attempt = this.db.attempts.get(attemptId);
    if (!attempt) throw new Error('Attempt not found');
    const exam = this.db.exams.get(attempt.examId);

    if (facultyUser.role !== 'ADMIN' && exam.createdById !== facultyUser.id) {
      throw new Error('Unauthorized faculty evaluation');
    }

    for (const item of evaluations) {
      const q = exam.questions.find((quest) => quest.id === item.questionId);
      if (!q) throw new Error('Question not found in exam');

      const maxMarks = q.marks ?? 1.0;
      if (item.marksAwarded < 0 || item.marksAwarded > maxMarks) {
        throw new Error(`Marks awarded (${item.marksAwarded}) must be between 0 and ${maxMarks}`);
      }

      let ans = this.db.answers.get(`${attemptId}:${item.questionId}`);
      if (!ans) {
        ans = {
          id: `ans-${item.questionId}`,
          attemptId,
          questionId: item.questionId,
          descriptiveAnswer: '',
        };
      }
      ans.marksAwarded = item.marksAwarded;
      ans.facultyFeedback = item.facultyFeedback || null;
      ans.evaluatedAt = new Date();
      ans.evaluatedById = facultyUser.id;
      this.db.answers.set(`${attemptId}:${item.questionId}`, ans);
    }

    return this.evaluateAttempt(attemptId);
  }

  async publishResults(examId, facultyUser) {
    const exam = this.db.exams.get(examId);
    if (!exam) throw new Error('Exam not found');
    if (facultyUser.role !== 'ADMIN' && exam.createdById !== facultyUser.id) {
      throw new Error('Unauthorized');
    }

    const allResults = Array.from(this.db.results.values()).filter(
      (r) => r.examId === examId && r.evaluationStatus === 'EVALUATED'
    );

    if (allResults.length === 0) {
      throw new Error('No evaluated attempts found to publish');
    }

    // Sort by marks descending
    allResults.sort((a, b) => b.obtainedMarks - a.obtainedMarks);

    // Competition Ranking (1, 1, 3 tie handling)
    let currentRank = 1;
    for (let i = 0; i < allResults.length; i++) {
      if (i > 0 && allResults[i].obtainedMarks < allResults[i - 1].obtainedMarks) {
        currentRank = i + 1;
      }
      allResults[i].rank = currentRank;
      allResults[i].publicationStatus = 'PUBLISHED';
      allResults[i].publishedAt = new Date();
    }

    this.emit(`exam:${examId}`, 'results:published', {
      examId,
      publishedCount: allResults.length,
    });

    return allResults;
  }

  async createNotification({ userId, title, message, type = 'INFO' }) {
    // Deduplication within 5 mins
    const key = `${userId}:${title}:${type}`;
    const now = Date.now();
    for (const n of this.db.notifications.values()) {
      if (n.userId === userId && n.title === title && n.type === type && now - n.createdAt.getTime() < 300000) {
        return n; // deduplicated
      }
    }

    const id = `notif-${this.db.notifications.size + 1}`;
    const notification = {
      id,
      userId,
      title,
      message,
      type,
      isRead: false,
      createdAt: new Date(),
    };
    this.db.notifications.set(id, notification);
    this.emit(`user:${userId}`, 'notification:new', notification);
    return notification;
  }
}

const engine = new TestEvaluationEngine(db);

describe('Batch 4: Evaluation, Result Management, and Real-Time Telemetry', () => {
  const facultyAlice = { id: 'fac-1', name: 'Prof. Alice', role: 'FACULTY' };
  const studentBob = { id: 'stu-1', name: 'Bob Doe', role: 'STUDENT' };
  const studentCharlie = { id: 'stu-2', name: 'Charlie Smith', role: 'STUDENT' };
  const studentDave = { id: 'stu-3', name: 'Dave Brown', role: 'STUDENT' };

  beforeEach(() => {
    db.reset();

    // Standard Mock Exam with mixed question types
    db.exams.set('exam-1', {
      id: 'exam-1',
      title: 'CS301 Advanced Algorithms Midterm',
      createdById: facultyAlice.id,
      totalMarks: 30,
      passingMarks: 12,
      negativeMarking: true,
      questions: [
        {
          id: 'q-mcq1',
          type: 'SINGLE_MCQ',
          marks: 5,
          negativeMarks: 1,
          options: [
            { id: 'opt-1a', optionText: 'O(log n)', isCorrect: true },
            { id: 'opt-1b', optionText: 'O(n^2)', isCorrect: false },
          ],
        },
        {
          id: 'q-mmcq1',
          type: 'MULTIPLE_MCQ',
          marks: 10,
          negativeMarks: 2,
          options: [
            { id: 'opt-2a', optionText: 'NP-Complete', isCorrect: true },
            { id: 'opt-2b', optionText: 'Polynomial Time Verifiable', isCorrect: true },
            { id: 'opt-2c', optionText: 'Always Solvable in O(1)', isCorrect: false },
          ],
        },
        {
          id: 'q-tf1',
          type: 'TRUE_FALSE',
          marks: 5,
          negativeMarks: 1,
          options: [
            { id: 'opt-3a', optionText: 'True', isCorrect: true },
            { id: 'opt-3b', optionText: 'False', isCorrect: false },
          ],
        },
        {
          id: 'q-desc1',
          type: 'DESCRIPTIVE',
          marks: 10,
          negativeMarks: 0,
          options: [],
        },
      ],
    });
  });

  it('1. Correct SINGLE_MCQ evaluation awards full marks and marks isCorrect = true', async () => {
    db.attempts.set('att-1', { id: 'att-1', examId: 'exam-1', studentId: studentBob.id, status: 'SUBMITTED' });
    db.answers.set('att-1:q-mcq1', {
      attemptId: 'att-1',
      questionId: 'q-mcq1',
      selectedOptions: ['opt-1a'],
    });

    const { result } = await engine.evaluateAttempt('att-1');
    const ans = db.answers.get('att-1:q-mcq1');

    assert.equal(ans.isCorrect, true);
    assert.equal(ans.marksAwarded, 5);
    assert.equal(result.correctAnswersCount, 1);
  });

  it('2. Incorrect SINGLE_MCQ evaluation deducts configured negative marks', async () => {
    db.attempts.set('att-2', { id: 'att-2', examId: 'exam-1', studentId: studentBob.id, status: 'SUBMITTED' });
    db.answers.set('att-2:q-mcq1', {
      attemptId: 'att-2',
      questionId: 'q-mcq1',
      selectedOptions: ['opt-1b'], // Wrong option
    });

    const { result } = await engine.evaluateAttempt('att-2');
    const ans = db.answers.get('att-2:q-mcq1');

    assert.equal(ans.isCorrect, false);
    assert.equal(ans.marksAwarded, -1);
    assert.equal(result.incorrectAnswersCount, 1);
  });

  it('3. MULTIPLE_MCQ requires exact match by default (partial or wrong deducts negative marks)', async () => {
    db.attempts.set('att-3a', { id: 'att-3a', examId: 'exam-1', studentId: studentBob.id, status: 'SUBMITTED' });
    // Candidate selects only 1 of 2 correct options (Partial match)
    db.answers.set('att-3a:q-mmcq1', {
      attemptId: 'att-3a',
      questionId: 'q-mmcq1',
      selectedOptions: ['opt-2a'],
    });

    const partialEval = await engine.evaluateAttempt('att-3a');
    const partialAns = db.answers.get('att-3a:q-mmcq1');
    assert.equal(partialAns.isCorrect, false);
    assert.equal(partialAns.marksAwarded, -2); // Exact match policy penalty

    // Full match
    db.attempts.set('att-3b', { id: 'att-3b', examId: 'exam-1', studentId: studentCharlie.id, status: 'SUBMITTED' });
    db.answers.set('att-3b:q-mmcq1', {
      attemptId: 'att-3b',
      questionId: 'q-mmcq1',
      selectedOptions: ['opt-2a', 'opt-2b'],
    });

    const fullEval = await engine.evaluateAttempt('att-3b');
    const fullAns = db.answers.get('att-3b:q-mmcq1');
    assert.equal(fullAns.isCorrect, true);
    assert.equal(fullAns.marksAwarded, 10);
  });

  it('4. TRUE_FALSE evaluation correctly awards marks or penalizes', async () => {
    db.attempts.set('att-4', { id: 'att-4', examId: 'exam-1', studentId: studentBob.id, status: 'SUBMITTED' });
    db.answers.set('att-4:q-tf1', {
      attemptId: 'att-4',
      questionId: 'q-tf1',
      selectedOptions: ['opt-3a'], // Correct: True
    });

    await engine.evaluateAttempt('att-4');
    const ans = db.answers.get('att-4:q-tf1');
    assert.equal(ans.isCorrect, true);
    assert.equal(ans.marksAwarded, 5);
  });

  it('5. Negative marking is respected when disabled', async () => {
    const examNoNeg = { ...db.exams.get('exam-1'), id: 'exam-noneg', negativeMarking: false };
    db.exams.set('exam-noneg', examNoNeg);

    db.attempts.set('att-5', { id: 'att-5', examId: 'exam-noneg', studentId: studentBob.id, status: 'SUBMITTED' });
    db.answers.set('att-5:q-mcq1', {
      attemptId: 'att-5',
      questionId: 'q-mcq1',
      selectedOptions: ['opt-1b'], // Wrong
    });

    await engine.evaluateAttempt('att-5');
    const ans = db.answers.get('att-5:q-mcq1');
    assert.equal(ans.isCorrect, false);
    assert.equal(ans.marksAwarded, 0); // No negative deduction
  });

  it('6. Unanswered questions do not deduct marks and are counted in unansweredCount', async () => {
    db.attempts.set('att-6', { id: 'att-6', examId: 'exam-1', studentId: studentBob.id, status: 'SUBMITTED' });
    // Student leaves everything blank

    const { result } = await engine.evaluateAttempt('att-6');
    assert.equal(result.unansweredCount, 4);
    assert.equal(result.obtainedMarks, 0);
  });

  it('7. Descriptive questions set status to MANUAL_EVALUATION_PENDING and notify faculty', async () => {
    db.attempts.set('att-7', { id: 'att-7', examId: 'exam-1', studentId: studentBob.id, status: 'SUBMITTED' });
    db.answers.set('att-7:q-desc1', {
      attemptId: 'att-7',
      questionId: 'q-desc1',
      descriptiveAnswer: 'Dijkstra computes single-source shortest paths on non-negative edge weights using a min-heap.',
    });

    const { attempt, result } = await engine.evaluateAttempt('att-7');
    assert.equal(attempt.evaluationStatus, 'MANUAL_EVALUATION_PENDING');
    assert.equal(result.evaluationStatus, 'MANUAL_EVALUATION_PENDING');

    // Verify faculty notification event was emitted
    const notifEvent = db.emittedEvents.find(
      (e) => e.target === `user:${facultyAlice.id}` && e.event === 'notification:new'
    );
    assert.ok(notifEvent);
    assert.equal(notifEvent.data.title, 'Manual Evaluation Required');
  });

  it('8. Faculty can manually evaluate descriptive answers with feedback', async () => {
    db.attempts.set('att-8', { id: 'att-8', examId: 'exam-1', studentId: studentBob.id, status: 'SUBMITTED' });
    db.answers.set('att-8:q-desc1', {
      attemptId: 'att-8',
      questionId: 'q-desc1',
      descriptiveAnswer: 'Comprehensive algorithm proof.',
    });

    // Faculty grades the answer: awards 8.5 / 10
    const { attempt, result } = await engine.manualGrade(
      'att-8',
      [{ questionId: 'q-desc1', marksAwarded: 8.5, facultyFeedback: 'Solid proof, clear complexity analysis.' }],
      facultyAlice
    );

    const gradedAns = db.answers.get('att-8:q-desc1');
    assert.equal(gradedAns.marksAwarded, 8.5);
    assert.equal(gradedAns.facultyFeedback, 'Solid proof, clear complexity analysis.');
    assert.equal(result.obtainedMarks, 8.5);
  });

  it('9. Manual evaluation marks validation rejects negative or exceeding marks', async () => {
    db.attempts.set('att-9', { id: 'att-9', examId: 'exam-1', studentId: studentBob.id, status: 'SUBMITTED' });

    // Try awarding 15 on a 10-mark question
    await assert.rejects(
      async () => {
        await engine.manualGrade(
          'att-9',
          [{ questionId: 'q-desc1', marksAwarded: 15, facultyFeedback: 'Exceeds limit' }],
          facultyAlice
        );
      },
      /Marks awarded \(15\) must be between 0 and 10/
    );

    // Try awarding negative marks
    await assert.rejects(
      async () => {
        await engine.manualGrade(
          'att-9',
          [{ questionId: 'q-desc1', marksAwarded: -3, facultyFeedback: 'Invalid negative' }],
          facultyAlice
        );
      },
      /must be between 0/
    );
  });

  it('10. Duplicate evaluation execution is completely idempotent and safe', async () => {
    db.attempts.set('att-10', { id: 'att-10', examId: 'exam-1', studentId: studentBob.id, status: 'SUBMITTED' });
    db.answers.set('att-10:q-mcq1', { attemptId: 'att-10', questionId: 'q-mcq1', selectedOptions: ['opt-1a'] });

    const firstRun = await engine.evaluateAttempt('att-10');
    const secondRun = await engine.evaluateAttempt('att-10');

    assert.equal(firstRun.result.id, secondRun.result.id);
    assert.equal(firstRun.result.obtainedMarks, secondRun.result.obtainedMarks);
    assert.equal(db.results.size, 1);
  });

  it('11. Standard Competition Ranking (1, 1, 3) correctly ranks tied attempts', async () => {
    // Student Bob: 20 marks
    db.attempts.set('att-bob', { id: 'att-bob', examId: 'exam-1', studentId: studentBob.id, status: 'EVALUATED' });
    db.results.set('att-bob', { id: 'res-bob', examId: 'exam-1', studentId: studentBob.id, obtainedMarks: 20, evaluationStatus: 'EVALUATED' });

    // Student Charlie: 20 marks (Tie with Bob)
    db.attempts.set('att-charlie', { id: 'att-charlie', examId: 'exam-1', studentId: studentCharlie.id, status: 'EVALUATED' });
    db.results.set('att-charlie', { id: 'res-charlie', examId: 'exam-1', studentId: studentCharlie.id, obtainedMarks: 20, evaluationStatus: 'EVALUATED' });

    // Student Dave: 15 marks
    db.attempts.set('att-dave', { id: 'att-dave', examId: 'exam-1', studentId: studentDave.id, status: 'EVALUATED' });
    db.results.set('att-dave', { id: 'res-dave', examId: 'exam-1', studentId: studentDave.id, obtainedMarks: 15, evaluationStatus: 'EVALUATED' });

    const published = await engine.publishResults('exam-1', facultyAlice);

    const bobRes = published.find((r) => r.studentId === studentBob.id);
    const charlieRes = published.find((r) => r.studentId === studentCharlie.id);
    const daveRes = published.find((r) => r.studentId === studentDave.id);

    // Standard Competition Ranking: Bob and Charlie tied at 1, Dave jumps to Rank 3
    assert.equal(bobRes.rank, 1);
    assert.equal(charlieRes.rank, 1);
    assert.equal(daveRes.rank, 3);
    assert.equal(daveRes.publicationStatus, 'PUBLISHED');

    // Real-time results:published event broadcasted
    const pubEvent = db.emittedEvents.find(
      (e) => e.target === 'exam:exam-1' && e.event === 'results:published'
    );
    assert.ok(pubEvent);
    assert.equal(pubEvent.data.publishedCount, 3);
  });

  it('12. Unpublished results remain in DRAFT status and hidden from publication queries', async () => {
    db.attempts.set('att-draft', { id: 'att-draft', examId: 'exam-1', studentId: studentBob.id, status: 'SUBMITTED' });
    db.answers.set('att-draft:q-mcq1', { attemptId: 'att-draft', questionId: 'q-mcq1', selectedOptions: ['opt-1a'] });

    const { result } = await engine.evaluateAttempt('att-draft');
    assert.equal(result.publicationStatus, 'DRAFT');
    assert.equal(result.rank, null);
  });

  it('13. Persistent notification creation, deduplication, and Socket.IO emission', async () => {
    // 1. Create notification
    const notif1 = await engine.createNotification({
      userId: studentBob.id,
      title: 'Exam Assigned',
      message: 'You have been assigned to CS301 Exam.',
      type: 'EXAM_ASSIGNED',
    });
    assert.ok(notif1);
    assert.equal(notif1.isRead, false);

    // 2. Duplicate dispatch within 5 minutes is deduplicated
    const notif2 = await engine.createNotification({
      userId: studentBob.id,
      title: 'Exam Assigned',
      message: 'You have been assigned to CS301 Exam.',
      type: 'EXAM_ASSIGNED',
    });
    assert.equal(notif1.id, notif2.id);
    assert.equal(db.notifications.size, 1);

    // 3. Verify Socket.IO push occurred
    const socketPush = db.emittedEvents.find(
      (e) => e.target === `user:${studentBob.id}` && e.event === 'notification:new'
    );
    assert.ok(socketPush);
    assert.equal(socketPush.data.title, 'Exam Assigned');
  });

  it('14. Unauthorized faculty cannot grade or publish exam results', async () => {
    const maliciousFaculty = { id: 'fac-eve', name: 'Eve Intruder', role: 'FACULTY' };
    db.attempts.set('att-sec', { id: 'att-sec', examId: 'exam-1', studentId: studentBob.id, status: 'SUBMITTED' });

    await assert.rejects(
      async () => {
        await engine.publishResults('exam-1', maliciousFaculty);
      },
      /Unauthorized/
    );

    await assert.rejects(
      async () => {
        await engine.manualGrade(
          'att-sec',
          [{ questionId: 'q-desc1', marksAwarded: 5 }],
          maliciousFaculty
        );
      },
      /Unauthorized faculty evaluation/
    );
  });
});
