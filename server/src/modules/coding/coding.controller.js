// ==============================================================================
// ExamSphere – Coding Assessment Controller Handlers
// ==============================================================================

import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { codingService } from './coding.service.js';

/**
 * FACULTY / ADMIN: Create Coding Question
 */
export const createCodingQuestion = asyncHandler(async (req, res) => {
  const data = await codingService.createCodingQuestion(req.body, req.user);
  return res.status(201).json(ApiResponse.created(data, 'Coding question created successfully'));
});

/**
 * FACULTY / ADMIN: Update Coding Question
 */
export const updateCodingQuestion = asyncHandler(async (req, res) => {
  const { questionId } = req.params;
  const data = await codingService.updateCodingQuestion(questionId, req.body, req.user);
  return res.status(200).json(ApiResponse.success(data, 'Coding question updated successfully'));
});

/**
 * GET Coding Question Details
 * (Students receive ONLY sample test cases; hidden test cases are strictly excluded)
 */
export const getCodingQuestion = asyncHandler(async (req, res) => {
  const { questionId } = req.params;
  const data = await codingService.getCodingQuestion(questionId, req.user);
  return res.status(200).json(ApiResponse.success(data, 'Coding question retrieved successfully'));
});

/**
 * STUDENT: Run Code against sample test cases or custom input
 */
export const runSampleCode = asyncHandler(async (req, res) => {
  const data = await codingService.runSampleCode(req.body, req.user);
  return res.status(200).json(ApiResponse.success(data, 'Code run executed'));
});

/**
 * STUDENT: Submit Solution against all test cases
 */
export const submitSolution = asyncHandler(async (req, res) => {
  const data = await codingService.submitSolution(req.body, req.user);
  return res.status(200).json(ApiResponse.success(data, 'Solution evaluated and recorded'));
});

/**
 * GET Submissions History for Question
 */
export const getSubmissions = asyncHandler(async (req, res) => {
  const { questionId } = req.params;
  const data = await codingService.getSubmissionHistory(questionId, req.user, req.query);
  return res.status(200).json(ApiResponse.success(data, 'Submissions retrieved successfully'));
});
