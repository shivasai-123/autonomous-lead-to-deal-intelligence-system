import { CompanyService } from '../services/company.service.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import {
  validateCreateCompanyInput,
  validateUpdateCompanyInput
} from '../validators/company.validator.js';

export class CompanyController {
  static async listCompanies(req, res, next) {
    try {
      const { search, page, limit, sortBy, sortOrder } = req.query;
      const result = await CompanyService.listCompanies({
        search: search ? String(search).trim() : '',
        page: parseInt(page, 10) || 1,
        limit: parseInt(limit, 10) || 10,
        sortBy: sortBy === 'name' ? 'name' : 'createdAt',
        sortOrder: sortOrder === 'asc' ? 'asc' : 'desc'
      });

      return sendSuccess(res, 'Companies retrieved successfully', result, 200);
    } catch (error) {
      next(error);
    }
  }

  static async getCompanyById(req, res, next) {
    try {
      const { id } = req.params;
      const company = await CompanyService.getCompanyById(id);
      return sendSuccess(res, 'Company details retrieved successfully', { company }, 200);
    } catch (error) {
      next(error);
    }
  }

  static async createCompany(req, res, next) {
    try {
      const validation = validateCreateCompanyInput(req.body);
      if (!validation.isValid) {
        return sendError(res, 'Invalid company data', validation.errors, 400);
      }

      const company = await CompanyService.createCompany(req.body, req.user.id);
      return sendSuccess(res, 'Company created successfully', { company }, 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateCompany(req, res, next) {
    try {
      const { id } = req.params;
      const validation = validateUpdateCompanyInput(req.body);
      if (!validation.isValid) {
        return sendError(res, 'Invalid update data', validation.errors, 400);
      }

      const company = await CompanyService.updateCompany(id, req.body, req.user.id);
      return sendSuccess(res, 'Company updated successfully', { company }, 200);
    } catch (error) {
      next(error);
    }
  }
}

export default CompanyController;
