// ==============================================================================
// ExamSphere – Notification Controller
// ==============================================================================

import { notificationService } from './notifications.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  getNotificationsQuerySchema,
  notificationIdParamSchema,
} from './notifications.validation.js';

export const getNotifications = asyncHandler(async (req, res) => {
  const query = getNotificationsQuerySchema.parse(req.query);
  const data = await notificationService.getUserNotifications(req.user.id, query);
  return res.status(200).json(ApiResponse.success(data, 'Notifications retrieved successfully'));
});

export const getUnreadCount = asyncHandler(async (req, res) => {
  const data = await notificationService.getUnreadCount(req.user.id);
  return res.status(200).json(ApiResponse.success(data, 'Unread count retrieved'));
});

export const markAsRead = asyncHandler(async (req, res) => {
  const { id } = notificationIdParamSchema.parse(req.params);
  const data = await notificationService.markAsRead(req.user.id, id);
  return res.status(200).json(ApiResponse.success(data, 'Notification marked as read'));
});

export const markAllAsRead = asyncHandler(async (req, res) => {
  const data = await notificationService.markAllAsRead(req.user.id);
  return res.status(200).json(ApiResponse.success(data, 'All notifications marked as read'));
});
