import { LeadService } from '../services/lead.service.js';
import { DuplicateService } from '../services/duplicate.service.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import {
  validateCreateLeadInput,
  validateUpdateLeadInput,
  validateLeadQueryParams
} from '../validators/lead.validator.js';

export class LeadController {
  static async listLeads(req, res, next) {
    try {
      const queryValidation = validateLeadQueryParams(req.query);
      if (!queryValidation.isValid) {
        return sendError(res, 'Invalid query parameters', queryValidation.errors, 400);
      }

      const result = await LeadService.listLeads(req.user, queryValidation.params);
      return sendSuccess(res, 'Leads retrieved successfully', result, 200);
    } catch (error) {
      next(error);
    }
  }

  static async getLeadById(req, res, next) {
    try {
      const { id } = req.params;
      const lead = await LeadService.getLeadById(id, req.user);
      return sendSuccess(res, 'Lead retrieved successfully', { lead }, 200);
    } catch (error) {
      next(error);
    }
  }

  static async checkDuplicates(req, res, next) {
    try {
      const { email, phone, excludeLeadId } = req.body;
      if (!email && !phone) {
        return sendError(res, 'Either email or phone is required for duplicate checking', null, 400);
      }

      const results = await DuplicateService.checkLeadDuplicates({
        email,
        phone,
        excludeLeadId
      });

      return sendSuccess(res, 'Duplicate check completed', results, 200);
    } catch (error) {
      next(error);
    }
  }

  static async createLead(req, res, next) {
    try {
      const validation = validateCreateLeadInput(req.body);
      if (!validation.isValid) {
        return sendError(res, 'Invalid lead data', validation.errors, 400);
      }

      const forceCreate = req.body.forceCreate === true || req.query.force === 'true';
      const result = await LeadService.createLead(req.body, req.user, { forceCreate });

      return sendSuccess(
        res,
        'Lead created successfully',
        {
          lead: result.lead,
          duplicateWarning: result.duplicateWarning,
          domainMatches: result.domainMatches
        },
        201
      );
    } catch (error) {
      if (error.statusCode === 409 && error.details) {
        return sendError(res, error.message, error.details, 409);
      }
      next(error);
    }
  }

  static async updateLead(req, res, next) {
    try {
      const { id } = req.params;
      const validation = validateUpdateLeadInput(req.body);
      if (!validation.isValid) {
        return sendError(res, 'Invalid update data', validation.errors, 400);
      }

      const lead = await LeadService.updateLead(id, req.body, req.user);
      return sendSuccess(res, 'Lead updated successfully', { lead }, 200);
    } catch (error) {
      next(error);
    }
  }

  static async archiveLead(req, res, next) {
    try {
      const { id } = req.params;
      const result = await LeadService.archiveLead(id, req.user);
      return sendSuccess(res, result.message, { lead: result.lead }, 200);
    } catch (error) {
      next(error);
    }
  }
}

export default LeadController;
