import { getPrismaClient } from '../config/prisma.js';
import { SocketService } from './socket.service.js';
import { logger } from '../utils/logger.js';

export class NotificationService {
  /**
   * Create and persist a notification in PostgreSQL, then emit via Socket.IO.
   * Includes duplicate-prevention within a 60-second window.
   *
   * @param {Object} params
   * @param {string} params.userId - Recipient user UUID
   * @param {string} params.type - NotificationType enum
   * @param {string} params.title - Alert title
   * @param {string} params.message - Alert body
   * @param {Object} [params.metadata] - Optional entity references & links
   * @returns {Promise<Object>} Created notification
   */
  static async createNotification({ userId, type, title, message, metadata = null }) {
    if (!userId) {
      return null;
    }

    const prisma = getPrismaClient();

    try {
      // 1. Deduplication Guard: Check if an identical notification was sent in the last 60 seconds
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
      const existing = await prisma.notification.findFirst({
        where: {
          userId,
          type,
          title,
          createdAt: { gte: oneMinuteAgo }
        }
      });

      if (existing) {
        logger.debug(`[Notification] Skipping duplicate alert for user ${userId}: ${title}`);
        return existing;
      }

      // 2. Persist in database (authoritative record)
      const notification = await prisma.notification.create({
        data: {
          userId,
          type,
          title,
          message,
          metadata: metadata || undefined,
          isRead: false
        }
      });

      logger.info(`[Notification] Created [${type}] for user ${userId}: "${title}"`);

      // 3. Emit real-time event to recipient's private room
      SocketService.emitToUser(userId, 'notification:new', notification);

      // 4. Update unread counter in real-time
      const unreadCount = await prisma.notification.count({
        where: { userId, isRead: false }
      });
      SocketService.emitToUser(userId, 'notification:unread_count', { unreadCount });

      return notification;
    } catch (err) {
      logger.error(`[Notification] Failed to create notification: ${err.message}`);
      return null;
    }
  }

  /**
   * Get paginated notifications for the authenticated user with strict isolation.
   *
   * @param {Object} user - Authenticated user
   * @param {Object} query - Query parameters (page, limit, isRead, type)
   * @returns {Promise<Object>} { notifications, unreadCount, pagination }
   */
  static async getNotifications(user, query = {}) {
    const prisma = getPrismaClient();

    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const where = { userId: user.id };

    if (query.isRead !== undefined && query.isRead !== '') {
      where.isRead = query.isRead === 'true' || query.isRead === true;
    }

    if (query.type) {
      where.type = query.type;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: { userId: user.id, isRead: false }
      })
    ]);

    return {
      notifications,
      unreadCount,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }

  /**
   * Get unread notification count for the authenticated user.
   * @param {Object} user - Authenticated user
   * @returns {Promise<number>} Unread count
   */
  static async getUnreadCount(user) {
    const prisma = getPrismaClient();
    return prisma.notification.count({
      where: { userId: user.id, isRead: false }
    });
  }

  /**
   * Mark a single notification as read, enforcing user ownership.
   *
   * @param {string} notificationId - Notification UUID
   * @param {Object} user - Authenticated user
   * @returns {Promise<Object>} Updated notification
   */
  static async markAsRead(notificationId, user) {
    const prisma = getPrismaClient();

    const notification = await prisma.notification.findUnique({
      where: { id: notificationId }
    });

    if (!notification) {
      const error = new Error('Notification not found');
      error.statusCode = 404;
      throw error;
    }

    if (notification.userId !== user.id) {
      const error = new Error('Access denied: You cannot view or modify another user\'s notification');
      error.statusCode = 403;
      throw error;
    }

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    // Push updated count
    const unreadCount = await prisma.notification.count({
      where: { userId: user.id, isRead: false }
    });
    SocketService.emitToUser(user.id, 'notification:unread_count', { unreadCount });

    return updated;
  }

  /**
   * Mark all unread notifications as read for the authenticated user.
   *
   * @param {Object} user - Authenticated user
   * @returns {Promise<number>} Number of updated notifications
   */
  static async markAllAsRead(user) {
    const prisma = getPrismaClient();

    const result = await prisma.notification.updateMany({
      where: { userId: user.id, isRead: false },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });

    // Push updated count 0
    SocketService.emitToUser(user.id, 'notification:unread_count', { unreadCount: 0 });

    return result.count;
  }
}

export default NotificationService;
