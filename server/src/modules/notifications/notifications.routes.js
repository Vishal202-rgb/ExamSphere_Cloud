// ==============================================================================
// ExamSphere – Notification Routes
// ==============================================================================

import { Router } from 'express';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from './notifications.controller.js';
import { authenticateUser } from '../../middlewares/auth.middleware.js';

const router = Router();

router.use(authenticateUser);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadCount);
router.patch('/read-all', markAllAsRead);
router.patch('/:id/read', markAsRead);

export default router;
