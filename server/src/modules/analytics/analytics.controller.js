// ==============================================================================
// ExamSphere – Analytics & Reporting Controller Handlers
// ==============================================================================

import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { analyticsService } from './analytics.service.js';
import { reportsService } from './reports.service.js';

/**
 * ADMIN: Get System-wide Analytics Overview & Distribution Charts
 */
export const getAdminOverview = asyncHandler(async (req, res) => {
  const data = await analyticsService.getAdminOverview(req.query);
  return res.status(200).json(ApiResponse.success(data, 'Admin analytics retrieved successfully'));
});

/**
 * FACULTY: Get Authorized Exam Overview & Aggregates
 */
export const getFacultyOverview = asyncHandler(async (req, res) => {
  const data = await analyticsService.getFacultyOverview(req.user, req.query);
  return res.status(200).json(ApiResponse.success(data, 'Faculty analytics retrieved successfully'));
});

/**
 * FACULTY: Get Detailed Exam Analytics (Accuracy, Skipped & Difficult Questions)
 */
export const getFacultyExamAnalytics = asyncHandler(async (req, res) => {
  const { examId } = req.params;
  const data = await analyticsService.getFacultyExamAnalytics(examId, req.user);
  return res.status(200).json(ApiResponse.success(data, 'Exam analytics retrieved successfully'));
});

/**
 * STUDENT: Get Personal Performance Overview
 */
export const getStudentOverview = asyncHandler(async (req, res) => {
  const data = await analyticsService.getStudentOverview(req.user.id);
  return res.status(200).json(ApiResponse.success(data, 'Student analytics retrieved successfully'));
});

/**
 * STUDENT: Get Chronological Performance Progression Trend
 */
export const getStudentPerformanceTrend = asyncHandler(async (req, res) => {
  const data = await analyticsService.getStudentPerformanceTrend(req.user.id);
  return res.status(200).json(ApiResponse.success(data, 'Performance trend retrieved successfully'));
});

/**
 * REPORT: Export Department Summary CSV
 */
export const exportDepartmentSummary = asyncHandler(async (req, res) => {
  const csv = await reportsService.exportDepartmentSummary(req.query.departmentId, req.user);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="department_summary_report.csv"');
  return res.status(200).send(csv);
});

/**
 * REPORT: Export Exam-wise Question Analysis CSV
 */
export const exportExamQuestionAnalysis = asyncHandler(async (req, res) => {
  const { examId } = req.params;
  const csv = await reportsService.exportExamQuestionAnalysis(examId, req.user);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="exam_question_analysis_${examId}.csv"`);
  return res.status(200).send(csv);
});

/**
 * REPORT: Export Faculty Exam Results Summary CSV
 */
export const exportFacultyExamReport = asyncHandler(async (req, res) => {
  const { examId } = req.params;
  const csv = await reportsService.exportFacultyExamReport(examId, req.user);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="exam_results_report_${examId}.csv"`);
  return res.status(200).send(csv);
});

/**
 * REPORT: Export Student Performance Transcript CSV
 */
export const exportStudentPerformance = asyncHandler(async (req, res) => {
  const targetStudentId = req.params.studentId || req.user.id;
  const csv = await reportsService.exportStudentPerformance(targetStudentId, req.user);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="student_performance_transcript.csv"');
  return res.status(200).send(csv);
});
