import { Router } from 'express';
import { RecommendationController } from '../controllers/recommendation.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

// All recommendation routes require authentication
router.use(requireAuth);

// GET /api/recommendations - List recommendations with filter, search, metrics, and RBAC
router.get('/', RecommendationController.listRecommendations);

// POST /api/recommendations/batch-refresh - Run batch recalculation (Admin & Manager)
router.post('/batch-refresh', RecommendationController.batchRefreshRecommendations);

// GET /api/recommendations/:id - Single recommendation detail with RBAC
router.get('/:id', RecommendationController.getRecommendationById);

// PATCH /api/recommendations/:id/status - Transition lifecycle status (Accept/Dismiss/Execute)
router.patch('/:id/status', RecommendationController.updateRecommendationStatus);

export default router;
