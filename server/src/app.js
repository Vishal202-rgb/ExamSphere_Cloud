// ==============================================================================
// ExamSphere – Express Application Setup & Middleware Pipeline
// ==============================================================================

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler } from './middlewares/errorHandler.middleware.js';
import { notFound } from './middlewares/notFound.middleware.js';
import healthRoutes from './modules/health/health.routes.js';

const app = express();

// Security HTTP headers
app.use(helmet());

// CORS configuration
app.use(
  cors({
    origin: [env.CLIENT_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// Request body parsers
app.use(express.json({ limit: '16kb' }));
app.use(express.urlencoded({ extended: true, limit: '16kb' }));
app.use(cookieParser());

// Request logger
if (env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Health and Diagnostic Routes
app.use('/api/v1', healthRoutes);

// 404 handler for undefined routes
app.use(notFound);

// Centralized Error Handling Middleware
app.use(errorHandler);

export default app;
