import { Router } from 'express';
import { NotificationController } from '../controllers/notification.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

// All notification routes require authentication
router.use(requireAuth);

// GET /api/notifications - List notifications with pagination
router.get('/', NotificationController.getNotifications);

// GET /api/notifications/unread-count - Get total unread count
router.get('/unread-count', NotificationController.getUnreadCount);

// POST & PATCH /api/notifications/mark-all-read (and /read-all) - Mark all user notifications as read
router.post('/mark-all-read', NotificationController.markAllAsRead);
router.patch('/mark-all-read', NotificationController.markAllAsRead);
router.post('/read-all', NotificationController.markAllAsRead);
router.patch('/read-all', NotificationController.markAllAsRead);

// PATCH /api/notifications/:id/read - Mark single notification as read
router.patch('/:id/read', NotificationController.markAsRead);

export default router;
