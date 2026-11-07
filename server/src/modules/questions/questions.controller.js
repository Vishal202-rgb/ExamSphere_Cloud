// ==============================================================================
// ExamSphere – Question Bank Controller
// HTTP Handlers for Question Bank API
// ==============================================================================

import { questionService } from './questions.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const createQuestion = asyncHandler(async (req, res) => {
  const question = await questionService.createQuestion(req.body, req.user);
  return res
    .status(201)
    .json(ApiResponse.created(question, 'Question created successfully in question bank'));
});

export const getQuestions = asyncHandler(async (req, res) => {
  const result = await questionService.getQuestions(req.query, req.user);
  return res
    .status(200)
    .json(ApiResponse.success(result.data, 'Questions retrieved successfully', result.pagination));
});

export const getQuestionById = asyncHandler(async (req, res) => {
  const question = await questionService.getQuestionById(req.params.id, req.user);
  return res
    .status(200)
    .json(ApiResponse.success(question, 'Question details retrieved successfully'));
});

export const updateQuestion = asyncHandler(async (req, res) => {
  const updated = await questionService.updateQuestion(req.params.id, req.body, req.user);
  return res
    .status(200)
    .json(ApiResponse.success(updated, 'Question updated successfully'));
});

export const deleteQuestion = asyncHandler(async (req, res) => {
  await questionService.deleteQuestion(req.params.id, req.user);
  return res
    .status(200)
    .json(ApiResponse.success(null, 'Question deleted or archived successfully'));
});

export const bulkImportQuestions = asyncHandler(async (req, res) => {
  let csvContent = '';
  if (req.file) {
    csvContent = req.file.buffer.toString('utf-8');
  } else if (req.body?.csvData) {
    csvContent = req.body.csvData;
  }

  const { courseId } = req.body;
  const result = await questionService.bulkImportQuestions(csvContent, courseId, req.user);

  return res
    .status(200)
    .json(ApiResponse.success(result, `Successfully imported ${result.importedCount} questions`));
});

export const exportQuestions = asyncHandler(async (req, res) => {
  const csv = await questionService.exportQuestionsCSV(req.query, req.user);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="examsphere_question_bank.csv"');
  return res.status(200).send(csv);
});
