import { NotificationService } from '../services/notification.service.js';
import { sendSuccess } from '../utils/apiResponse.js';

export class NotificationController {
  /**
   * Get user's notifications with pagination and filtering.
   * GET /api/notifications
   */
  static async getNotifications(req, res, next) {
    try {
      const result = await NotificationService.getNotifications(req.user, req.query);
      return sendSuccess(res, 'Notifications retrieved successfully', result, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get unread notification count.
   * GET /api/notifications/unread-count
   */
  static async getUnreadCount(req, res, next) {
    try {
      const count = await NotificationService.getUnreadCount(req.user);
      return sendSuccess(res, 'Unread notification count retrieved', { unreadCount: count, count }, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Mark a single notification as read.
   * PATCH /api/notifications/:id/read
   */
  static async markAsRead(req, res, next) {
    try {
      const updated = await NotificationService.markAsRead(req.params.id, req.user);
      return sendSuccess(res, 'Notification marked as read', { notification: updated }, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Mark all notifications as read for current user.
   * POST/PATCH /api/notifications/mark-all-read
   */
  static async markAllAsRead(req, res, next) {
    try {
      const updatedCount = await NotificationService.markAllAsRead(req.user);
      return sendSuccess(res, 'All notifications marked as read', { updatedCount, count: updatedCount }, 200);
    } catch (err) {
      next(err);
    }
  }
}

export default NotificationController;
