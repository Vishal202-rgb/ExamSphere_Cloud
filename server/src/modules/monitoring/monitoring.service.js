// ==============================================================================
// ExamSphere – Real-Time Exam Monitoring & Announcements Service
// Provides live candidate telemetries, presence aggregates, and announcements
// ==============================================================================

import { prisma } from '../../config/db.js';
import { ApiError } from '../../utils/apiError.js';
import { emitToExam, getOnlineCandidateIds, isCandidateOnline } from '../../socket/socket.service.js';
import { notificationService } from '../notifications/notifications.service.js';

class MonitoringService {
  /**
   * Verify faculty or admin access to exam monitoring
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
      throw ApiError.forbidden('You are not authorized to monitor this examination');
    }

    return exam;
  }

  /**
   * Get comprehensive live monitoring metrics and candidate roster
   */
  async getLiveMonitoring(examId, facultyUser) {
    const exam = await this.verifyFacultyExamAccess(examId, facultyUser);

    const now = new Date();

    const [assignments, attempts, auditLogs] = await Promise.all([
      prisma.examAssignment.findMany({
        where: { examId },
        include: {
          student: {
            select: {
              id: true,
              name: true,
              email: true,
              rollNumber: true,
              batch: true,
              section: true,
            },
          },
        },
        orderBy: { student: { rollNumber: 'asc' } },
      }),
      prisma.attempt.findMany({
        where: { examId },
        include: {
          student: {
            select: {
              id: true,
              name: true,
              email: true,
              rollNumber: true,
              batch: true,
              section: true,
            },
          },
          result: { select: { obtainedMarks: true, percentage: true, isPassed: true } },
          _count: { select: { answers: true } },
        },
        orderBy: { startedAt: 'desc' },
      }),
      prisma.auditLog.findMany({
        where: {
          resource: 'ATTEMPT',
          action: { in: ['EXAM_ATTEMPT_STARTED', 'EXAM_ATTEMPT_SUBMITTED', 'EXAM_TAB_SWITCH', 'EXAM_VIOLATION_RECORDED', 'EXAM_ATTEMPT_DISQUALIFIED'] },
          metadata: { path: ['examId'], equals: examId },
        },
        include: {
          user: { select: { name: true, rollNumber: true } },
        },
        orderBy: { timestamp: 'desc' },
        take: 25,
      }),
    ]);

    // Aggregate proctoring events by attempt and type
    const attemptIds = attempts.map((a) => a.id);
    const proctoringCounts = attemptIds.length > 0
      ? await prisma.proctoringEvent.groupBy({
          by: ['attemptId', 'eventType'],
          where: { attemptId: { in: attemptIds } },
          _count: { _all: true },
        })
      : [];

    const proctoringMap = new Map();
    for (const row of proctoringCounts) {
      if (!proctoringMap.has(row.attemptId)) {
        proctoringMap.set(row.attemptId, {});
      }
      proctoringMap.get(row.attemptId)[row.eventType] = row._count._all;
    }

    const onlineCandidateIds = new Set(getOnlineCandidateIds(examId));

    // Map latest attempt per student
    const attemptsByStudent = new Map();
    for (const att of attempts) {
      if (!attemptsByStudent.has(att.studentId)) {
        attemptsByStudent.set(att.studentId, att);
      }
    }

    let startedCount = 0;
    let inProgressCount = 0;
    let submittedCount = 0;
    let expiredCount = 0;
    let disqualifiedCount = 0;

    const candidateRoster = assignments.map((a) => {
      const student = a.student;
      const att = attemptsByStudent.get(student.id);
      const isOnline = onlineCandidateIds.has(student.id);

      let status = 'NOT_STARTED';
      let remainingSeconds = null;

      const isDisqualified = Boolean(
        a.isDisqualified || att?.isDisqualified || att?.status === 'DISQUALIFIED' || att?.status === 'CANCELLED'
      );
      const isAutomaticDisqualification = Boolean(
        (att?.disqualifyReason && att.disqualifyReason.includes('Automatic')) ||
        (a.disqualifyReason && a.disqualifyReason.includes('Automatic'))
      );
      const disqualificationType = isDisqualified
        ? isAutomaticDisqualification
          ? 'AUTOMATIC'
          : 'MANUAL'
        : 'NONE';

      if (isDisqualified) {
        disqualifiedCount++;
      }

      if (att) {
        startedCount++;
        status = isDisqualified ? 'DISQUALIFIED' : att.status;

        if (att.status === 'IN_PROGRESS' && !isDisqualified) {
          const expiryTime = new Date(att.expiresAt);
          remainingSeconds = Math.max(0, Math.floor((expiryTime.getTime() - now.getTime()) / 1000));
          if (remainingSeconds > 0) {
            inProgressCount++;
          } else {
            expiredCount++;
            status = 'AUTO_SUBMITTED';
          }
        } else if (['SUBMITTED', 'AUTO_SUBMITTED', 'EVALUATED'].includes(att.status)) {
          submittedCount++;
          if (att.submissionReason === 'AUTO_TIMEOUT') {
            expiredCount++;
          }
        }
      } else if (isDisqualified) {
        status = 'DISQUALIFIED';
      }

      const eventCounts = (att && proctoringMap.get(att.id)) || {};
      const fullscreenExitCount = eventCounts.FULLSCREEN_EXIT || 0;
      const tabBlurCount = eventCounts.TAB_BLUR || att?.tabSwitchCount || 0;

      return {
        studentId: student.id,
        name: student.name,
        email: student.email,
        rollNumber: student.rollNumber || 'N/A',
        batch: student.batch || 'N/A',
        section: student.section || 'N/A',
        isDisqualified,
        disqualificationType,
        disqualifyReason: att?.disqualifyReason || a.disqualifyReason || null,
        disqualifiedAt: att?.disqualifiedAt || null,
        violationCount: att?.violationCount || 0,
        tabSwitchCount: tabBlurCount,
        fullscreenExitCount,
        hasStarted: Boolean(att),
        attemptId: att?.id || null,
        attemptNumber: att?.attemptNumber || null,
        status,
        submissionReason: att?.submissionReason || null,
        startedAt: att?.startedAt || null,
        submittedAt: att?.submittedAt || null,
        expiresAt: att?.expiresAt || null,
        remainingSeconds,
        answersCount: att?._count?.answers || 0,
        isOnline,
        obtainedMarks: att?.result?.obtainedMarks ?? att?.obtainedMarks ?? null,
      };
    });

    const totalAssigned = assignments.length;
    const submissionProgress = totalAssigned > 0 ? Math.round((submittedCount / totalAssigned) * 100) : 0;

    return {
      exam: {
        id: exam.id,
        title: exam.title,
        status: exam.status,
        durationMinutes: exam.durationMinutes,
        startTime: exam.startTime,
        endTime: exam.endTime,
        totalMarks: exam.totalMarks,
        course: exam.course,
      },
      stats: {
        totalAssigned,
        startedCount,
        onlineCount: onlineCandidateIds.size,
        inProgressCount,
        submittedCount,
        expiredCount,
        disqualifiedCount,
        submissionProgress,
      },
      candidates: candidateRoster,
      recentActivity: auditLogs.map((log) => ({
        id: log.id,
        action: log.action,
        user: log.user,
        timestamp: log.timestamp,
        metadata: log.metadata,
      })),
    };
  }

  /**
   * Broadcast an urgent announcement to students in an exam
   */
  async createAnnouncement(examId, { title, message }, facultyUser) {
    const exam = await this.verifyFacultyExamAccess(examId, facultyUser);

    if (!title || !message) {
      throw ApiError.badRequest('Title and message are required for announcements');
    }

    const announcement = await prisma.examAnnouncement.create({
      data: {
        examId,
        senderId: facultyUser.id,
        title: title.trim(),
        message: message.trim(),
      },
      include: {
        sender: { select: { id: true, name: true, email: true } },
      },
    });

    // 1. Emit real-time Socket.IO event to all students connected to exam
    emitToExam(examId, 'announcement:new', {
      id: announcement.id,
      examId,
      examTitle: exam.title,
      sender: announcement.sender,
      title: announcement.title,
      message: announcement.message,
      createdAt: announcement.createdAt,
    });

    // 2. Dispatch persistent notification to all assigned students
    const assignments = await prisma.examAssignment.findMany({
      where: { examId },
      select: { studentId: true },
    });

    const studentIds = assignments.map((a) => a.studentId);
    await notificationService.notifyMany(studentIds, {
      title: `Exam Announcement: ${title.trim()}`,
      message: message.trim(),
      type: 'ANNOUNCEMENT',
      metadata: { examId, announcementId: announcement.id },
    });

    return announcement;
  }

  /**
   * Get announcement history for an exam
   */
  async getExamAnnouncements(examId, user) {
    // Verify user is either student assigned or authorized faculty
    if (user.role === 'STUDENT') {
      const assignment = await prisma.examAssignment.findUnique({
        where: { examId_studentId: { examId, studentId: user.id } },
      });
      if (!assignment) {
        throw ApiError.forbidden('You are not assigned to this examination');
      }
    } else {
      await this.verifyFacultyExamAccess(examId, user);
    }

    return prisma.examAnnouncement.findMany({
      where: { examId },
      include: {
        sender: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const monitoringService = new MonitoringService();
