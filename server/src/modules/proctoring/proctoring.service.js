// ==============================================================================
// ExamSphere – Privacy-Conscious Proctoring Assistance Service
// Records browser integrity telemetry and provides timeline reviews for faculty.
// CRITICAL PRIVACY: Telemetry is auxiliary and NEVER automatically marks misconduct.
// ==============================================================================

import { prisma } from '../../config/db.js';
import { ApiError } from '../../utils/apiError.js';
import { emitToExamFaculty } from '../../socket/socket.service.js';

class ProctoringService {
  /**
   * Record a candidate browser activity telemetry event
   * Authoritative implementation of the Two-Strike Anti-Cheating Policy:
   * - Strike 1: Warning 1/2 recorded and returned
   * - Strike 2: Immediate atomic disqualification in PostgreSQL
   * - Consistent coalescing of departure events (TAB_BLUR, FULLSCREEN_EXIT) within 4s window
   */
  async recordActivityEvent(data, studentUser) {
    const { attemptId, eventType, details = {}, clientTime } = data;

    // 1. Verify attempt ownership & status
    const attempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
      select: {
        id: true,
        examId: true,
        studentId: true,
        status: true,
        expiresAt: true,
        tabSwitchCount: true,
        violationCount: true,
        isDisqualified: true,
        disqualifyReason: true,
      },
    });

    if (!attempt) {
      throw ApiError.notFound('Attempt session not found');
    }

    if (attempt.studentId !== studentUser.id) {
      throw ApiError.forbidden('You are not authorized to record telemetry for this session');
    }

    // If already submitted or evaluated
    if (['SUBMITTED', 'AUTO_SUBMITTED', 'EVALUATED'].includes(attempt.status)) {
      return { status: 'IGNORED', message: 'Attempt has already been submitted' };
    }

    // If already disqualified
    if (attempt.isDisqualified || attempt.status === 'DISQUALIFIED' || attempt.status === 'CANCELLED') {
      return {
        status: 'DISQUALIFIED',
        action: 'DISQUALIFIED',
        isDisqualified: true,
        violationCount: attempt.violationCount,
        disqualifyReason: attempt.disqualifyReason,
        message: 'Attempt has already been disqualified',
      };
    }

    if (attempt.status !== 'IN_PROGRESS') {
      return { status: 'IGNORED', message: 'Attempt is no longer in progress' };
    }

    const eventTimestamp = clientTime ? new Date(clientTime) : new Date();
    const isDepartureViolation = eventType === 'TAB_BLUR' || eventType === 'FULLSCREEN_EXIT';

    // 2. Incident Coalescing / Deduplication check:
    // If departure violation (TAB_BLUR or FULLSCREEN_EXIT), check if ANY departure event was recorded recently (< 4000ms)
    if (isDepartureViolation) {
      const recentDeparture = await prisma.proctoringEvent.findFirst({
        where: {
          attemptId,
          eventType: { in: ['TAB_BLUR', 'FULLSCREEN_EXIT'] },
        },
        orderBy: { serverTime: 'desc' },
      });

      const nowMs = Date.now();
      const lastServerMs = recentDeparture ? new Date(recentDeparture.serverTime).getTime() : 0;
      const serverDiff = Math.abs(nowMs - lastServerMs);

      const clientDiff =
        recentDeparture && clientTime && recentDeparture.clientTime
          ? Math.abs(new Date(clientTime).getTime() - new Date(recentDeparture.clientTime).getTime())
          : Infinity;

      // Coalesce if recorded within 4000ms window on either server or client clock
      const isCoalesced = recentDeparture && (serverDiff < 4000 || clientDiff < 4000);

      if (isCoalesced) {
        // Coalesce: Record the auxiliary event in proctoringEvent for telemetry integrity, but do not increment violationCount
        const event = await prisma.proctoringEvent.create({
          data: {
            attemptId,
            studentId: studentUser.id,
            eventType,
            details: { ...details, coalescedWithRecent: true },
            clientTime: eventTimestamp,
            serverTime: new Date(),
          },
        });

        // Also increment tabSwitchCount if TAB_BLUR (for stats tracking)
        if (eventType === 'TAB_BLUR') {
          await prisma.attempt.update({
            where: { id: attemptId },
            data: { tabSwitchCount: { increment: 1 } },
          });
        }

        return {
          status: 'COOLDOWN',
          action: 'COOLDOWN',
          strike: attempt.violationCount,
          maxStrikes: 2,
          violationCount: attempt.violationCount,
          isDisqualified: attempt.isDisqualified,
          coalesced: true,
          message: attempt.violationCount === 1 
            ? 'Warning 1/2: Leaving the examination window again will disqualify your attempt.' 
            : 'Departure event coalesced with recent incident',
          eventId: event.id,
          eventType,
          serverTime: event.serverTime,
        };
      }

      // 3. New Distinct Departure Incident -> Increment violation count
      const newViolationCount = (attempt.violationCount || 0) + 1;

      // 3a. Persist the event record
      const event = await prisma.proctoringEvent.create({
        data: {
          attemptId,
          studentId: studentUser.id,
          eventType,
          details: { ...details, violationNumber: newViolationCount },
          clientTime: eventTimestamp,
          serverTime: new Date(),
        },
      });

      if (newViolationCount === 1) {
        // Strike 1: Record warning and update PostgreSQL attempt
        const updateData = {
          violationCount: 1,
        };
        if (eventType === 'TAB_BLUR') {
          updateData.tabSwitchCount = { increment: 1 };
        }
        await prisma.attempt.update({
          where: { id: attemptId },
          data: updateData,
        });

        // Audit Log entry
        await prisma.auditLog.create({
          data: {
            userId: studentUser.id,
            action: 'EXAM_VIOLATION_RECORDED',
            resource: 'ATTEMPT',
            resourceId: attemptId,
            metadata: {
              examId: attempt.examId,
              eventType,
              violationCount: 1,
              strike: 1,
              maxStrikes: 2,
              isAutomatic: true,
              details,
            },
          },
        }).catch(() => {});

        // Emit real-time warning telemetry to faculty
        emitToExamFaculty(attempt.examId, 'candidate:violation', {
          attemptId,
          studentId: studentUser.id,
          studentName: studentUser.name,
          eventType,
          violationCount: 1,
          strike: 1,
          maxStrikes: 2,
          details,
          timestamp: event.serverTime.toISOString(),
        });

        return {
          status: 'WARNING',
          action: 'WARNING',
          strike: 1,
          maxStrikes: 2,
          violationCount: 1,
          isDisqualified: false,
          message: 'Warning 1/2: Leaving the examination window again will disqualify your attempt.',
          serverTime: event.serverTime,
          eventId: event.id,
          eventType,
        };
      } else {
        // Strike 2: Second confirmed violation -> Atomic & Irreversible Disqualification in PostgreSQL!
        const reasonText = 'Automatic disqualification: Two strikes integrity policy violated (window/tab departure)';
        await prisma.$transaction(async (tx) => {
          await tx.attempt.update({
            where: { id: attemptId },
            data: {
              violationCount: newViolationCount,
              isDisqualified: true,
              disqualifiedAt: new Date(),
              disqualifyReason: reasonText,
              status: 'DISQUALIFIED',
              submissionReason: 'DISQUALIFIED',
              ...(eventType === 'TAB_BLUR' ? { tabSwitchCount: { increment: 1 } } : {}),
            },
          });

          await tx.examAssignment.updateMany({
            where: {
              examId: attempt.examId,
              studentId: studentUser.id,
            },
            data: {
              isDisqualified: true,
              disqualifyReason: reasonText,
            },
          });

          await tx.auditLog.create({
            data: {
              userId: studentUser.id,
              action: 'EXAM_ATTEMPT_DISQUALIFIED',
              resource: 'ATTEMPT',
              resourceId: attemptId,
              metadata: {
                examId: attempt.examId,
                eventType,
                violationCount: newViolationCount,
                strike: 2,
                maxStrikes: 2,
                isAutomatic: true,
                reason: reasonText,
                timestamp: new Date().toISOString(),
              },
            },
          });
        });

        // Emit real-time disqualification telemetry to faculty
        emitToExamFaculty(attempt.examId, 'candidate:disqualified', {
          attemptId,
          studentId: studentUser.id,
          studentName: studentUser.name,
          eventType,
          violationCount: newViolationCount,
          strike: 2,
          isDisqualified: true,
          isAutomatic: true,
          reason: reasonText,
          timestamp: new Date().toISOString(),
        });

        return {
          status: 'DISQUALIFIED',
          action: 'DISQUALIFIED',
          strike: 2,
          maxStrikes: 2,
          violationCount: newViolationCount,
          isDisqualified: true,
          disqualifyReason: reasonText,
          message: 'Immediate disqualification: Second violation confirmed.',
          serverTime: new Date(),
          eventId: event.id,
          eventType,
        };
      }
    }

    // For non-departure events (e.g. TAB_FOCUS, FULLSCREEN_ENTER, DISCONNECT, RECONNECT, SUSPICIOUS_KEY)
    const recentDuplicate = await prisma.proctoringEvent.findFirst({
      where: {
        attemptId,
        eventType,
        serverTime: { gte: threeSecondsAgo },
      },
    });

    if (recentDuplicate) {
      return { status: 'DEDUPLICATED', message: 'Duplicate event throttled' };
    }

    const event = await prisma.proctoringEvent.create({
      data: {
        attemptId,
        studentId: studentUser.id,
        eventType,
        details,
        clientTime: eventTimestamp,
        serverTime: new Date(),
      },
    });

    emitToExamFaculty(attempt.examId, 'candidate:activity', {
      attemptId,
      studentId: studentUser.id,
      studentName: studentUser.name,
      eventType,
      details,
      timestamp: event.serverTime.toISOString(),
    });

    return {
      status: 'RECORDED',
      eventId: event.id,
      eventType,
      serverTime: event.serverTime,
    };
  }

  /**
   * FACULTY / ADMIN: Get Candidate Activity Timeline & Integrity Metrics
   */
  async getAttemptTimeline(attemptId, facultyUser) {
    const attempt = await prisma.attempt.findUnique({
      where: { id: attemptId },
      include: {
        student: { select: { id: true, name: true, rollNumber: true, email: true } },
        exam: {
          select: {
            id: true,
            title: true,
            createdById: true,
            course: {
              include: { facultyMembers: true },
            },
          },
        },
      },
    });

    if (!attempt) {
      throw ApiError.notFound('Attempt session not found');
    }

    // Authorization check
    if (facultyUser.role !== 'ADMIN') {
      const isCreator = attempt.exam.createdById === facultyUser.id;
      const isInstructor = attempt.exam.course?.facultyMembers?.some(
        (f) => f.facultyId === facultyUser.id
      );
      if (!isCreator && !isInstructor) {
        throw ApiError.forbidden('You are not authorized to view proctoring logs for this candidate');
      }
    }

    // Fetch all recorded activity events and audit logs
    const [events, auditLogs] = await Promise.all([
      prisma.proctoringEvent.findMany({
        where: { attemptId },
        orderBy: { clientTime: 'asc' },
      }),
      prisma.auditLog.findMany({
        where: {
          OR: [
            { resourceId: attemptId },
            { metadata: { path: ['attemptId'], equals: attemptId } },
            { metadata: { path: ['examId'], equals: attempt.examId }, userId: attempt.studentId },
          ],
        },
        orderBy: { timestamp: 'desc' },
      }),
    ]);

    // Compute event metrics
    let tabBlurCount = 0;
    let fullscreenExitCount = 0;
    let disconnectCount = 0;
    let suspiciousKeyCount = 0;

    events.forEach((ev) => {
      switch (ev.eventType) {
        case 'TAB_BLUR':
          tabBlurCount++;
          break;
        case 'FULLSCREEN_EXIT':
          fullscreenExitCount++;
          break;
        case 'DISCONNECT':
          disconnectCount++;
          break;
        case 'SUSPICIOUS_KEY':
          suspiciousKeyCount++;
          break;
        default:
          break;
      }
    });

    const isDisqualified = Boolean(
      attempt.isDisqualified || attempt.status === 'DISQUALIFIED' || attempt.status === 'CANCELLED'
    );
    const isAutomatic = attempt.disqualifyReason?.includes('Automatic') || false;
    const disqualificationType = isDisqualified ? (isAutomatic ? 'AUTOMATIC' : 'MANUAL') : 'NONE';

    // Activity assessment
    let activityFlag = 'Standard activity';
    if (isDisqualified) {
      activityFlag = isAutomatic 
        ? 'Automatically Disqualified (Two-Strike Policy)' 
        : 'Manually Disqualified by Faculty';
    } else if (attempt.violationCount === 1) {
      activityFlag = 'Warning 1/2 Active (First Departure Recorded)';
    } else if (tabBlurCount >= 3 || fullscreenExitCount >= 2) {
      activityFlag = 'Activity flagged for review';
    }

    return {
      candidate: attempt.student,
      attempt: {
        id: attempt.id,
        status: attempt.status,
        startedAt: attempt.startedAt,
        submittedAt: attempt.submittedAt,
        tabSwitchCount: attempt.tabSwitchCount,
        violationCount: attempt.violationCount || 0,
        isDisqualified,
        disqualifiedAt: attempt.disqualifiedAt,
        disqualifyReason: attempt.disqualifyReason,
        disqualificationType,
      },
      summary: {
        tabBlurCount,
        fullscreenExitCount,
        disconnectCount,
        suspiciousKeyCount,
        violationCount: attempt.violationCount || 0,
        isDisqualified,
        disqualificationType,
        disqualifyReason: attempt.disqualifyReason,
        disqualifiedAt: attempt.disqualifiedAt,
        totalEventsCount: events.length,
        activityFlag,
        reviewNotice: isDisqualified
          ? `Disqualification recorded: ${attempt.disqualifyReason || 'Academic integrity policy violation.'}`
          : 'Notice: Automated browser activity events are monitored in real-time under the Two-Strike Anti-Cheating Policy.',
      },
      timeline: events.map((ev) => ({
        id: ev.id,
        eventType: ev.eventType,
        details: ev.details,
        clientTime: ev.clientTime,
        serverTime: ev.serverTime,
      })),
      auditLogs: auditLogs.map((log) => ({
        id: log.id,
        action: log.action,
        timestamp: log.timestamp,
        metadata: log.metadata,
      })),
    };
  }
}

export const proctoringService = new ProctoringService();
