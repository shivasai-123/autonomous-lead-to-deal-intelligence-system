import { Router } from 'express';
import { AIController } from '../controllers/ai.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

// All AI routes require valid user authentication
router.use(requireAuth);

// Configuration options for UI dropdowns
router.get('/options', AIController.getOptions);

// Feature A: AI Executive Summary
router.post('/leads/:id/summary', AIController.generateLeadSummary);

// Feature B: AI Personalized Follow-Up Draft
router.post('/leads/:id/follow-up-draft', AIController.generateFollowUpDraft);

// Feature C: AI Recommendation Explanation
router.post('/recommendations/:id/explanation', AIController.explainRecommendation);

// Feature D: AI Sales Meeting & Discovery Preparation
router.post('/leads/:id/meeting-preparation', AIController.generateMeetingPrep);

export default router;
