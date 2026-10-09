import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import companyRoutes from './company.routes.js';
import leadRoutes from './lead.routes.js';

const apiRouter = Router();

// Phase 1 Foundation Route
apiRouter.use('/health', healthRoutes);

// Phase 3 Authentication & User Management Routes
apiRouter.use('/auth', authRoutes);
apiRouter.use('/users', userRoutes);

// Phase 4 CRM Core Routes
apiRouter.use('/companies', companyRoutes);
apiRouter.use('/leads', leadRoutes);

// Modular mount points reserved for future phases:
// apiRouter.use('/pipeline', pipelineRoutes);       // Phase 5
// apiRouter.use('/deals', dealRoutes);             // Phase 5
// apiRouter.use('/recommendations', recommendationRoutes); // Phase 7
// apiRouter.use('/ai', aiRoutes);                   // Phase 8
// apiRouter.use('/analytics', analyticsRoutes);     // Phase 9
// apiRouter.use('/notifications', notificationRoutes); // Phase 9

export default apiRouter;
