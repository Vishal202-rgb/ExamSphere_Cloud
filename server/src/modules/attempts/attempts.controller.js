// ==============================================================================
// ExamSphere – Attempts Controller
// HTTP Handlers for Exam Starts, Real-Time Sync, Autosave, and Final Submissions
// ==============================================================================

import { attemptService } from './attempts.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const startExam = asyncHandler(async (req, res) => {
  const examId = req.params.examId || req.params.id;
  const result = await attemptService.startExam(examId, req.user, {
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.headers['user-agent'],
  });

  return res
    .status(200)
    .json(ApiResponse.success(result, 'Examination session initialized successfully'));
});

export const getAttemptTime = asyncHandler(async (req, res) => {
  const result = await attemptService.getAttemptTime(req.params.attemptId, req.user);
  return res
    .status(200)
    .json(ApiResponse.success(result, 'Server examination time synchronized'));
});

export const autosaveAnswer = asyncHandler(async (req, res) => {
  const result = await attemptService.autosaveAnswer(
    req.params.attemptId,
    req.params.questionId,
    req.body,
    req.user
  );

  return res
    .status(200)
    .json(ApiResponse.success(result, 'Answer autosaved successfully'));
});

export const getAttempt = asyncHandler(async (req, res) => {
  const result = await attemptService.getAttempt(req.params.attemptId, req.user);
  return res
    .status(200)
    .json(ApiResponse.success(result, 'Examination attempt recovered successfully'));
});

export const submitAttempt = asyncHandler(async (req, res) => {
  const result = await attemptService.submitAttempt(
    req.params.attemptId,
    req.body,
    req.user
  );

  return res
    .status(200)
    .json(ApiResponse.success(result, 'Examination submitted successfully'));
});
