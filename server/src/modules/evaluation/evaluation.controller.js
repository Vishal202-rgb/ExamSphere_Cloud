// ==============================================================================
// ExamSphere – Evaluation Controller
// ==============================================================================

import { evaluationService } from './evaluation.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  examSubmissionsQuerySchema,
  manualEvaluationBodySchema,
  examIdParamSchema,
  attemptIdParamSchema,
} from './evaluation.validation.js';

/**
 * Faculty: List all submissions for an examination
 */
export const getExamSubmissions = asyncHandler(async (req, res) => {
  const { examId } = examIdParamSchema.parse(req.params);
  const query = examSubmissionsQuerySchema.parse(req.query);

  const data = await evaluationService.getExamSubmissions(examId, req.user, query);
  return res.status(200).json(ApiResponse.success(data, 'Submissions retrieved successfully'));
});

/**
 * Faculty: Get complete attempt with answers & correct options for evaluation
 */
export const getAttemptForFaculty = asyncHandler(async (req, res) => {
  const { attemptId } = attemptIdParamSchema.parse(req.params);

  const data = await evaluationService.getAttemptForFaculty(attemptId, req.user);
  return res.status(200).json(ApiResponse.success(data, 'Attempt retrieved for evaluation'));
});

/**
 * Faculty: Manually evaluate descriptive answers
 */
export const evaluateAttemptAnswers = asyncHandler(async (req, res) => {
  const { attemptId } = attemptIdParamSchema.parse(req.params);
  const { evaluations } = manualEvaluationBodySchema.parse(req.body);

  const data = await evaluationService.evaluateDescriptiveAnswers(attemptId, evaluations, req.user);
  return res.status(200).json(ApiResponse.success(data, 'Evaluation scores saved successfully'));
});

/**
 * Faculty: Finalize attempt evaluation
 */
export const finalizeAttempt = asyncHandler(async (req, res) => {
  const { attemptId } = attemptIdParamSchema.parse(req.params);

  const data = await evaluationService.finalizeAttemptEvaluation(attemptId, req.user);
  return res.status(200).json(ApiResponse.success(data, 'Attempt evaluation finalized'));
});

/**
 * Faculty: Publish exam results with competition ranking
 */
export const publishResults = asyncHandler(async (req, res) => {
  const { examId } = examIdParamSchema.parse(req.params);

  const data = await evaluationService.publishResults(examId, req.user);
  return res.status(200).json(ApiResponse.success(data, 'Results ranked and published successfully'));
});

/**
 * Faculty: Export results as CSV
 */
export const exportResults = asyncHandler(async (req, res) => {
  const { examId } = examIdParamSchema.parse(req.params);

  const csv = await evaluationService.exportExamResults(examId, req.user);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="results-${examId}.csv"`);
  return res.status(200).send(csv);
});

/**
 * Student: Get all published results for current student
 */
export const getStudentResults = asyncHandler(async (req, res) => {
  const data = await evaluationService.getStudentPublishedResults(req.user.id);
  return res.status(200).json(ApiResponse.success(data, 'Published results retrieved'));
});

/**
 * Student: Get detailed breakdown for a specific published exam result
 */
export const getStudentExamResult = asyncHandler(async (req, res) => {
  const { examId } = examIdParamSchema.parse(req.params);

  const data = await evaluationService.getStudentExamResultDetails(examId, req.user.id);
  return res.status(200).json(ApiResponse.success(data, 'Examination result details retrieved'));
});
