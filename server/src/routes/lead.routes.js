import { Router } from 'express';
import { LeadController } from '../controllers/lead.controller.js';
import { ActivityController } from '../controllers/activity.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';

const router = Router();

// All lead routes require valid user session
router.use(requireAuth);

// GET /api/leads - Filterable, paginated leads list
router.get('/', LeadController.listLeads);

// POST /api/leads/check-duplicates - Check duplicate matches before saving
router.post('/check-duplicates', LeadController.checkDuplicates);

// POST /api/leads - Create lead with duplicate & suspicious detection
router.post('/', LeadController.createLead);

// GET /api/leads/:id - Lead detail with company, rep, and activity timeline
router.get('/:id', LeadController.getLeadById);

// PATCH /api/leads/:id - Update lead information
router.patch('/:id', LeadController.updateLead);

// DELETE /api/leads/:id - Archive lead (ADMIN and SALES_MANAGER only)
router.delete('/:id', requireRole('ADMIN', 'SALES_MANAGER'), LeadController.archiveLead);

// Lead Activities tracking endpoints
// GET /api/leads/:id/activities - Chronological activity history
router.get('/:id/activities', ActivityController.listActivities);

// POST /api/leads/:id/activities - Record new lead engagement event
router.post('/:id/activities', ActivityController.createActivity);

export default router;
