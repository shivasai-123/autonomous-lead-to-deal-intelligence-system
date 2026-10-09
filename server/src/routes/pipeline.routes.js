import { Router } from 'express';
import { PipelineController } from '../controllers/pipeline.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';

const router = Router();

// All pipeline endpoints require authentication
router.use(requireAuth);

// GET /api/pipeline/stages - List ordered pipeline stages with counts & values
router.get('/stages', PipelineController.listStages);

// PUT & PATCH /api/pipeline/stages/reorder - Reorder pipeline stages (Admin / Manager only)
router.put('/stages/reorder', requireRole('ADMIN', 'SALES_MANAGER'), PipelineController.reorderStages);
router.patch('/stages/reorder', requireRole('ADMIN', 'SALES_MANAGER'), PipelineController.reorderStages);

// GET /api/pipeline/metrics - Pipeline health, velocity, and win/loss analytics
router.get('/metrics', PipelineController.getMetrics);

export default router;
