import { Router } from 'express';
import { DealController } from '../controllers/deal.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

// All deal routes require authentication
router.use(requireAuth);

// GET /api/deals - List deals with search, filter, pagination, and RBAC scoping
router.get('/', DealController.listDeals);

// POST /api/deals - Create new deal directly
router.post('/', DealController.createDeal);

// POST /api/deals/convert - Convert lead to deal
router.post('/convert', DealController.convertLead);

// GET /api/deals/:id - Get deal detail with stage transition history
router.get('/:id', DealController.getDealById);

// PATCH /api/deals/:id - Update deal details
router.patch('/:id', DealController.updateDeal);

// PATCH /api/deals/:id/stage - Transition deal stage
router.patch('/:id/stage', DealController.transitionStage);

export default router;
