import { Router } from 'express';
import { CompanyController } from '../controllers/company.controller.js';
import { requireAuth, requireRole } from '../middlewares/auth.middleware.js';

const router = Router();

// All company operations require authentication
router.use(requireAuth);

// GET /api/companies - Accessible to all roles
router.get('/', CompanyController.listCompanies);

// GET /api/companies/:id - Accessible to all roles
router.get('/:id', CompanyController.getCompanyById);

// POST /api/companies - Accessible to all roles
router.post('/', CompanyController.createCompany);

// PATCH /api/companies/:id - ADMIN and SALES_MANAGER can edit company details
router.patch(
  '/:id',
  requireRole('ADMIN', 'SALES_MANAGER'),
  CompanyController.updateCompany
);

export default router;
