import { Router } from 'express';
import { UserController } from '../controllers/user.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';

const router = Router();

// All user management routes require valid authentication
router.use(requireAuth);

// Read users: Accessible to ADMIN and SALES_MANAGER
router.get('/', requireRole('ADMIN', 'SALES_MANAGER'), UserController.listUsers);
router.get('/:id', requireRole('ADMIN', 'SALES_MANAGER'), UserController.getUserById);

// Modify user status and role: Strictly restricted to ADMIN
router.patch('/:id/status', requireRole('ADMIN'), UserController.updateUserStatus);
router.patch('/:id/role', requireRole('ADMIN'), UserController.updateUserRole);

export default router;
