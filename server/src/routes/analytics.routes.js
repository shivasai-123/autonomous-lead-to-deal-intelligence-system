import { Router } from 'express';
import { AnalyticsController } from '../controllers/analytics.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();

// All analytics routes require authentication
router.use(requireAuth);

// Executive & Overview KPIs
router.get('/overview', AnalyticsController.getOverview);

// Visualizations & Deep Analytics (supporting standard and short aliases)
router.get('/conversion-funnel', AnalyticsController.getConversionFunnel);
router.get('/funnel', AnalyticsController.getConversionFunnel);

router.get('/pipeline-distribution', AnalyticsController.getPipelineDistribution);

router.get('/sales-trends', AnalyticsController.getSalesTrends);
router.get('/trends', AnalyticsController.getSalesTrends);

router.get('/stage-velocity', AnalyticsController.getStageVelocity);
router.get('/lead-sources', AnalyticsController.getLeadSourcePerformance);

router.get('/sales-performance', AnalyticsController.getSalesRepPerformance);
router.get('/rep-performance', AnalyticsController.getSalesRepPerformance);

// Personal Rep Workspace
router.get('/rep-workspace', AnalyticsController.getSalesRepWorkspace);

export default router;
