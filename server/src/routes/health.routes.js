import { Router } from 'express';
import { HealthController } from '../controllers/health.controller.js';

const router = Router();

// GET /api/health - Health check endpoint
router.get('/', HealthController.getHealth);

export default router;
