// ==============================================================================
// ExamSphere – Monitoring Controller
// ==============================================================================

import { monitoringService } from './monitoring.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { z } from 'zod';

const examIdParamSchema = z.object({
  examId: z.string().uuid({ message: 'Valid exam UUID is required' }),
});

const announcementBodySchema = z.object({
  title: z.string().min(2).max(150),
  message: z.string().min(2).max(2000),
});

export const getLiveMonitoring = asyncHandler(async (req, res) => {
  const { examId } = examIdParamSchema.parse(req.params);
  const data = await monitoringService.getLiveMonitoring(examId, req.user);
  return res.status(200).json(ApiResponse.success(data, 'Live monitoring telemetry retrieved'));
});

export const broadcastAnnouncement = asyncHandler(async (req, res) => {
  const { examId } = examIdParamSchema.parse(req.params);
  const body = announcementBodySchema.parse(req.body);

  const data = await monitoringService.createAnnouncement(examId, body, req.user);
  return res.status(201).json(ApiResponse.success(data, 'Announcement broadcasted successfully'));
});

export const getAnnouncements = asyncHandler(async (req, res) => {
  const { examId } = examIdParamSchema.parse(req.params);

  const data = await monitoringService.getExamAnnouncements(examId, req.user);
  return res.status(200).json(ApiResponse.success(data, 'Exam announcements retrieved'));
});
