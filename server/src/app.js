// ==============================================================================
// ExamSphere – Express Application Setup & Middleware Pipeline
// Security Hardened Modular Monolith Architecture
// ==============================================================================

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env.js';
import { requestId } from './middlewares/requestId.middleware.js';
import { apiLimiter } from './middlewares/rateLimiter.middleware.js';
import { errorHandler } from './middlewares/errorHandler.middleware.js';
import { notFound } from './middlewares/notFound.middleware.js';
import { getLiveness, getReadiness } from './modules/health/health.controller.js';

// Modular Route Handlers
import healthRoutes from './modules/health/health.routes.js';
import authRoutes from './modules/auth/auth.routes.js';
import departmentRoutes from './modules/departments/departments.routes.js';
import courseRoutes from './modules/courses/courses.routes.js';
import adminRoutes from './modules/admin/admin.routes.js';
import userRoutes from './modules/users/users.routes.js';
import facultyRoutes from './modules/faculty/faculty.routes.js';
import studentRoutes from './modules/student/student.routes.js';
import questionsRoutes from './modules/questions/questions.routes.js';
import examsRoutes from './modules/exams/exams.routes.js';
import attemptsRoutes from './modules/attempts/attempts.routes.js';
import notificationsRoutes from './modules/notifications/notifications.routes.js';
import analyticsRoutes from './modules/analytics/analytics.routes.js';
import codingRoutes from './modules/coding/coding.routes.js';
import proctoringRoutes from './modules/proctoring/proctoring.routes.js';
import invitationRoutes from './modules/invitations/invitations.routes.js';

const app = express();

// 1. Request Tracing Header (X-Request-Id)
app.use(requestId);

// 2. Security HTTP Headers
app.use(
  helmet({
    contentSecurityPolicy: false, // Managed via reverse proxy or relaxed for Monaco editor/Socket.io
    crossOriginEmbedderPolicy: false,
  })
);

// 3. CORS Configuration
const allowedOrigins = [
  env.CLIENT_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://localhost',
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }
      return callback(null, true); // Permissive in dev/pilot
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
  })
);

// 4. Request Body Parsers (Strict Size Limits)
app.use(express.json({ limit: '10mb' })); // Support CSV uploads & payloads
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// 5. Request Logger
if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// 6. Direct Orchestrator Health & Readiness Probes (Root Paths)
app.get('/health', getLiveness);
app.get('/health/ready', getReadiness);

// 7. Rate Limiter for API Routes
app.use('/api/v1', apiLimiter);

// 8. REST API Modular Routing Pipeline
app.use('/api/v1', healthRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/departments', departmentRoutes);
app.use('/api/v1/courses', courseRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/faculty', facultyRoutes);
app.use('/api/v1/student', studentRoutes);
app.use('/api/v1/questions', questionsRoutes);
app.use('/api/v1/exams', examsRoutes);
app.use('/api/v1/attempts', attemptsRoutes);
app.use('/api/v1/notifications', notificationsRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/coding', codingRoutes);
app.use('/api/v1/proctoring', proctoringRoutes);
app.use('/api/v1/invitations', invitationRoutes);

// 9. 404 handler for undefined routes
app.use(notFound);

// 10. Centralized Error Handling Middleware
app.use(errorHandler);

export default app;
