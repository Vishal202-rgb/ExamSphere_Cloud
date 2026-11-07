// ==============================================================================
// ExamSphere – Socket.IO Server Engine & Event Router
// Authenticated real-time gateway with RBAC room isolation and telemetry
// ==============================================================================

import jwt from 'jsonwebtoken';
import { createAdapter } from '@socket.io/redis-adapter';
import { env } from '../config/env.js';
import { prisma } from '../config/db.js';
import { redis } from '../config/redis.js';
import {
  setIO,
  recordCandidateOnline,
  recordCandidateOffline,
  emitToExamFaculty,
} from './socket.service.js';

export const setupSocketIO = (io) => {
  setIO(io);

  // 1. Conditionally attach Redis Adapter for multi-instance scaling
  try {
    if (redis && (redis.status === 'ready' || redis.status === 'connect')) {
      const pubClient = redis;
      const subClient = pubClient.duplicate();
      io.adapter(createAdapter(pubClient, subClient));
      console.log('⚡ [Socket.IO] Redis adapter integrated for horizontal scaling');
    }
  } catch (err) {
    console.warn('⚠️ [Socket.IO] Redis adapter skipped, running standalone in-memory transport:', err.message);
  }

  // 2. JWT Authentication Middleware for WebSockets
  io.use(async (socket, next) => {
    try {
      // Extract token from handshake auth, authorization header, or cookies
      let token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');

      if (!token && socket.handshake.headers?.cookie) {
        const match = socket.handshake.headers.cookie.match(/accessToken=([^;]+)/);
        if (match) token = match[1];
      }

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
      if (!decoded || !decoded.id) {
        return next(new Error('Invalid token payload'));
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          departmentId: true,
          isActive: true,
        },
      });

      if (!user || !user.isActive) {
        return next(new Error('User account is inactive or not found'));
      }

      socket.user = user;
      next();
    } catch (err) {
      console.warn(`🔒 [Socket.IO Auth Failed] ${socket.id}: ${err.message}`);
      return next(new Error('Authentication failed: ' + err.message));
    }
  });

  // 3. Socket Connection Lifecycle & Events
  io.on('connection', (socket) => {
    const user = socket.user;
    console.log(`🔌 [Socket.IO] Authenticated connection: ${socket.id} (${user.role} - ${user.email})`);

    // Automatically join user's private notification channel
    socket.join(`user:${user.id}`);

    // Track active exams this socket has joined for disconnect cleanup
    const joinedExamRooms = new Set();

    /**
     * Join Examination Room (Students and Faculty)
     */
    socket.on('exam:join', async (data, callback) => {
      try {
        const examId = data?.examId;
        if (!examId) {
          if (callback) callback({ error: 'examId is required' });
          return;
        }

        const exam = await prisma.exam.findUnique({
          where: { id: examId },
          include: {
            course: {
              include: {
                facultyMembers: { select: { facultyId: true } },
              },
            },
          },
        });

        if (!exam) {
          if (callback) callback({ error: 'Examination not found' });
          return;
        }

        // Student Authorization: Must be assigned to this exam
        if (user.role === 'STUDENT') {
          const assignment = await prisma.examAssignment.findUnique({
            where: {
              examId_studentId: { examId, studentId: user.id },
            },
          });

          if (!assignment) {
            if (callback) callback({ error: 'You are not assigned to this examination' });
            return;
          }

          if (assignment.isDisqualified) {
            if (callback) callback({ error: 'You have been disqualified from this examination' });
            return;
          }

          // Join candidate room
          socket.join(`exam:${examId}`);
          joinedExamRooms.add(examId);

          // Update online presence
          recordCandidateOnline(examId, user.id);

          // Notify faculty monitoring dashboard
          emitToExamFaculty(examId, 'candidate:online', {
            examId,
            studentId: user.id,
            studentName: user.name,
            timestamp: new Date().toISOString(),
          });

          if (callback) callback({ success: true, room: `exam:${examId}` });
          return;
        }

        // Faculty Authorization: Must be exam creator or course instructor (or ADMIN)
        if (user.role === 'FACULTY') {
          const isCreator = exam.createdById === user.id;
          const isInstructor = exam.course?.facultyMembers?.some((f) => f.facultyId === user.id);

          if (!isCreator && !isInstructor) {
            if (callback) callback({ error: 'You are not authorized to monitor this examination' });
            return;
          }

          socket.join(`exam:${examId}`);
          socket.join(`exam:${examId}:faculty`);
          joinedExamRooms.add(examId);

          if (callback) callback({ success: true, room: `exam:${examId}` });
          return;
        }

        // Admin has full oversight
        if (user.role === 'ADMIN') {
          socket.join(`exam:${examId}`);
          socket.join(`exam:${examId}:faculty`);
          joinedExamRooms.add(examId);

          if (callback) callback({ success: true, room: `exam:${examId}` });
          return;
        }

        if (callback) callback({ error: 'Unauthorized role' });
      } catch (err) {
        console.error('❌ [Socket exam:join error]:', err);
        if (callback) callback({ error: 'Internal socket error' });
      }
    });

    /**
     * Leave Examination Room
     */
    socket.on('exam:leave', (data) => {
      const examId = data?.examId;
      if (examId) {
        socket.leave(`exam:${examId}`);
        socket.leave(`exam:${examId}:faculty`);
        joinedExamRooms.delete(examId);

        if (user.role === 'STUDENT') {
          recordCandidateOffline(examId, user.id);
          emitToExamFaculty(examId, 'candidate:offline', {
            examId,
            studentId: user.id,
            studentName: user.name,
            timestamp: new Date().toISOString(),
          });
        }
      }
    });

    /**
     * Disconnect Cleanup
     */
    socket.on('disconnect', (reason) => {
      console.log(`🔌 [Socket.IO] Disconnected: ${socket.id} (${user.email}) - reason: ${reason}`);

      if (user.role === 'STUDENT') {
        for (const examId of joinedExamRooms) {
          recordCandidateOffline(examId, user.id);
          emitToExamFaculty(examId, 'candidate:offline', {
            examId,
            studentId: user.id,
            studentName: user.name,
            timestamp: new Date().toISOString(),
          });
        }
      }
    });
  });
};
