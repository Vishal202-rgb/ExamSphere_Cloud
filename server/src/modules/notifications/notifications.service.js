// ==============================================================================
// ExamSphere – Persistent Notification Service
// Handles database persistence, deduplication, pagination, and real-time Socket.IO dispatch
// ==============================================================================

import { prisma } from '../../config/db.js';
import { emitToUser } from '../../socket/socket.service.js';
import { ApiError } from '../../utils/apiError.js';

class NotificationService {
  /**
   * Create and dispatch a notification safely with deduplication
   */
  async createNotification({ userId, title, message, type = 'INFO', metadata = null, deduplicationKey = null }) {
    if (!userId || !title || !message) return null;

    try {
      // 1. Deduplication window check (prevent duplicate alerts within 5 minutes)
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      const existing = await prisma.notification.findFirst({
        where: {
          userId,
          title,
          type,
          createdAt: { gte: fiveMinutesAgo },
        },
      });

      if (existing) {
        return existing;
      }

      // 2. Persist in PostgreSQL
      const notification = await prisma.notification.create({
        data: {
          userId,
          title,
          message,
          type,
          metadata: metadata ? (typeof metadata === 'object' ? metadata : { info: metadata }) : undefined,
          isRead: false,
        },
      });

      // 3. Emit real-time push to the recipient's authenticated Socket.IO room
      emitToUser(userId, 'notification:new', {
        id: notification.id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        metadata: notification.metadata,
        isRead: notification.isRead,
        createdAt: notification.createdAt,
      });

      return notification;
    } catch (err) {
      console.error(`❌ [Notification Service Error] Failed to create notification for ${userId}:`, err.message);
      return null;
    }
  }

  /**
   * Bulk dispatch notifications to multiple recipients (e.g., all students in an exam)
   */
  async notifyMany(userIds, { title, message, type = 'INFO', metadata = null }) {
    if (!Array.isArray(userIds) || userIds.length === 0) return [];

    const results = [];
    for (const userId of userIds) {
      const res = await this.createNotification({ userId, title, message, type, metadata });
      if (res) results.push(res);
    }
    return results;
  }

  /**
   * Retrieve paginated notifications for the authenticated user
   */
  async getUserNotifications(userId, { page = 1, limit = 20, unreadOnly = false } = {}) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * take;

    const where = { userId };
    if (unreadOnly === true || unreadOnly === 'true') {
      where.isRead = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      notifications,
      unreadCount,
      pagination: {
        page: pageNum,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
        hasNextPage: skip + notifications.length < total,
        hasPrevPage: pageNum > 1,
      },
    };
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(userId) {
    const count = await prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { unreadCount: count };
  }

  /**
   * Mark a single notification as read
   */
  async markAsRead(userId, notificationId) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw ApiError.notFound('Notification not found');
    }

    if (notification.userId !== userId) {
      throw ApiError.forbidden('You are not authorized to modify this notification');
    }

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false },
    });

    emitToUser(userId, 'notification:count_updated', { unreadCount });

    return { notification: updated, unreadCount };
  }

  /**
   * Mark all notifications as read for current user
   */
  async markAllAsRead(userId) {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    emitToUser(userId, 'notification:count_updated', { unreadCount: 0 });

    return { success: true, message: 'All notifications marked as read', unreadCount: 0 };
  }
}

export const notificationService = new NotificationService();
