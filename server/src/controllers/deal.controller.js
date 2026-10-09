import { DealService } from '../services/deal.service.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import {
  validateCreateDealInput,
  validateUpdateDealInput,
  validateDealStageTransitionInput,
  validateConvertLeadInput,
  validateDealQueryParams
} from '../validators/deal.validator.js';

export class DealController {
  static async listDeals(req, res, next) {
    try {
      const queryValidation = validateDealQueryParams(req.query);
      if (!queryValidation.isValid) {
        return sendError(res, 'Invalid query parameters', queryValidation.errors, 400);
      }

      const result = await DealService.listDeals(req.user, queryValidation.params);
      return sendSuccess(res, 'Deals retrieved successfully', result, 200);
    } catch (error) {
      next(error);
    }
  }

  static async getDealById(req, res, next) {
    try {
      const { id } = req.params;
      const deal = await DealService.getDealById(id, req.user);
      return sendSuccess(res, 'Deal retrieved successfully', { deal }, 200);
    } catch (error) {
      next(error);
    }
  }

  static async createDeal(req, res, next) {
    try {
      const validation = validateCreateDealInput(req.body);
      if (!validation.isValid) {
        return sendError(res, 'Invalid deal data', validation.errors, 400);
      }

      const deal = await DealService.createDeal(req.body, req.user);
      return sendSuccess(res, 'Deal created successfully', { deal }, 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateDeal(req, res, next) {
    try {
      const validation = validateUpdateDealInput(req.body);
      if (!validation.isValid) {
        return sendError(res, 'Invalid deal update data', validation.errors, 400);
      }

      const deal = await DealService.updateDeal(req.params.id, req.body, req.user);
      return sendSuccess(res, 'Deal updated successfully', { deal }, 200);
    } catch (error) {
      next(error);
    }
  }

  static async transitionStage(req, res, next) {
    try {
      const validation = validateDealStageTransitionInput(req.body);
      if (!validation.isValid) {
        return sendError(res, 'Invalid stage transition data', validation.errors, 400);
      }

      const deal = await DealService.transitionStage(req.params.id, req.body, req.user);
      return sendSuccess(res, 'Deal stage updated successfully', { deal }, 200);
    } catch (error) {
      next(error);
    }
  }

  static async convertLead(req, res, next) {
    try {
      const leadId = req.params.id || req.body.leadId;
      if (!leadId) {
        return sendError(res, 'leadId is required for lead conversion', { leadId: 'leadId is required' }, 400);
      }

      const validation = validateConvertLeadInput(req.body);
      if (!validation.isValid) {
        return sendError(res, 'Invalid lead conversion data', validation.errors, 400);
      }

      const result = await DealService.convertLeadToDeal(leadId, req.body, req.user);
      return sendSuccess(res, 'Lead successfully converted to deal', result, 201);
    } catch (error) {
      next(error);
    }
  }
}
