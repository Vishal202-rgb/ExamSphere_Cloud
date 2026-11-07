// ==============================================================================
// ExamSphere – Proctoring Telemetry Controller Handlers
// ==============================================================================

import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { proctoringService } from './proctoring.service.js';

/**
 * STUDENT: Record Browser Activity Event
 */
export const recordEvent = asyncHandler(async (req, res) => {
  const data = await proctoringService.recordActivityEvent(req.body, req.user);
  return res.status(200).json(ApiResponse.success(data, 'Telemetry event processed'));
});

/**
 * FACULTY / ADMIN: Get Candidate Activity Timeline
 */
export const getAttemptTimeline = asyncHandler(async (req, res) => {
  const { attemptId } = req.params;
  const data = await proctoringService.getAttemptTimeline(attemptId, req.user);
  return res.status(200).json(ApiResponse.success(data, 'Activity timeline retrieved'));
});
