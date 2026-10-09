import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import companyRoutes from './company.routes.js';
import leadRoutes from './lead.routes.js';
import pipelineRoutes from './pipeline.routes.js';
import dealRoutes from './deal.routes.js';
import recommendationRoutes from './recommendation.routes.js';
import aiRoutes from './ai.routes.js';
import analyticsRoutes from './analytics.routes.js';
import notificationRoutes from './notification.routes.js';

const apiRouter = Router();

// Phase 1 Foundation Route
apiRouter.use('/health', healthRoutes);

// Phase 3 Authentication & User Management Routes
apiRouter.use('/auth', authRoutes);
apiRouter.use('/users', userRoutes);

// Phase 4 CRM Core Routes
apiRouter.use('/companies', companyRoutes);
apiRouter.use('/leads', leadRoutes);

// Phase 5 Sales Pipeline & Deal Management Routes
apiRouter.use('/pipeline', pipelineRoutes);
apiRouter.use('/deals', dealRoutes);

// Phase 7 Next-Best-Action Recommendation Routes
apiRouter.use('/recommendations', recommendationRoutes);

// Phase 8 AI Features & Intelligent Sales Assistance Routes
apiRouter.use('/ai', aiRoutes);

// Phase 9 Executive Dashboard, Analytics & Notification Routes
apiRouter.use('/analytics', analyticsRoutes);
apiRouter.use('/notifications', notificationRoutes);

export default apiRouter;
