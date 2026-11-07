// ==============================================================================
// ExamSphere – Examination Controller
// HTTP Handlers for Exam Creation and Scheduling
// ==============================================================================

import { examService } from './exams.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const createExam = asyncHandler(async (req, res) => {
  const exam = await examService.createExam(req.body, req.user);
  return res
    .status(201)
    .json(ApiResponse.created(exam, 'Examination created successfully in draft status'));
});

export const getExams = asyncHandler(async (req, res) => {
  const result = await examService.getExams(req.query, req.user);
  return res.status(200).json({
    statusCode: 200,
    success: true,
    message: 'Examinations retrieved successfully',
    data: result.data,
    exams: result.data,
    pagination: result.pagination,
    metrics: result.metrics,
    timestamp: new Date().toISOString(),
  });
});

export const getExamById = asyncHandler(async (req, res) => {
  const exam = await examService.getExamById(req.params.id, req.user);
  return res
    .status(200)
    .json(ApiResponse.success(exam, 'Examination details retrieved successfully'));
});

export const updateExam = asyncHandler(async (req, res) => {
  const updated = await examService.updateExam(req.params.id, req.body, req.user);
  return res
    .status(200)
    .json(ApiResponse.success(updated, 'Examination updated successfully'));
});

export const deleteExam = asyncHandler(async (req, res) => {
  await examService.deleteExam(req.params.id, req.user);
  return res
    .status(200)
    .json(ApiResponse.success(null, 'Examination deleted successfully'));
});

export const publishExam = asyncHandler(async (req, res) => {
  const published = await examService.publishExam(req.params.id, req.user);
  return res
    .status(200)
    .json(ApiResponse.success(published, 'Examination published and scheduled successfully'));
});

export const cancelExam = asyncHandler(async (req, res) => {
  const cancelled = await examService.cancelExam(req.params.id, req.user);
  return res
    .status(200)
    .json(ApiResponse.success(cancelled, 'Examination cancelled successfully'));
});

export const addExamQuestions = asyncHandler(async (req, res) => {
  const updatedExam = await examService.addQuestionsToExam(
    req.params.id,
    req.body.questions,
    req.user
  );
  return res
    .status(200)
    .json(ApiResponse.success(updatedExam, 'Questions successfully added to examination'));
});

export const removeExamQuestion = asyncHandler(async (req, res) => {
  await examService.removeQuestionFromExam(req.params.id, req.params.questionId, req.user);
  return res
    .status(200)
    .json(ApiResponse.success(null, 'Question removed from examination successfully'));
});

export const assignExam = asyncHandler(async (req, res) => {
  const result = await examService.assignExam(req.params.id, req.body, req.user);
  return res
    .status(200)
    .json(ApiResponse.success(result, `Assigned ${result.newlyAssigned} students to examination`));
});

export const getExamAssignments = asyncHandler(async (req, res) => {
  const assignments = await examService.getExamAssignments(req.params.id, req.user);
  return res
    .status(200)
    .json(ApiResponse.success(assignments, 'Exam student assignments retrieved successfully'));
});
