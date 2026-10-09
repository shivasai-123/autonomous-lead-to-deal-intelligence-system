import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

// Public Authentication endpoints
router.post('/register', AuthController.register);
router.post('/login', AuthController.login);

// Protected Authentication endpoints
router.get('/me', requireAuth, AuthController.getMe);
router.post('/logout', requireAuth, AuthController.logout);

export default router;
