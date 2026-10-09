import { RecommendationService } from '../services/recommendation.service.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import {
  validateUpdateStatusInput,
  validateListRecommendationsQuery
} from '../validators/recommendation.validator.js';

export class RecommendationController {
  /**
   * List recommendations with RBAC scoping, filtering, and summary metrics.
   * GET /api/recommendations
   */
  static async listRecommendations(req, res, next) {
    try {
      const validation = validateListRecommendationsQuery(req.query);
      if (!validation.isValid) {
        return sendError(res, 'Invalid query parameters', validation.errors, 400);
      }

      const result = await RecommendationService.getRecommendations(req.user, req.query);
      return sendSuccess(res, 'Recommendations retrieved successfully', result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get single recommendation detail.
   * GET /api/recommendations/:id
   */
  static async getRecommendationById(req, res, next) {
    try {
      const { id } = req.params;
      const recommendation = await RecommendationService.getRecommendationById(id, req.user);
      return sendSuccess(res, 'Recommendation retrieved successfully', { recommendation }, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update recommendation lifecycle status (ACCEPT, DISMISS, EXECUTE).
   * PATCH /api/recommendations/:id/status
   */
  static async updateRecommendationStatus(req, res, next) {
    try {
      const { id } = req.params;
      const validation = validateUpdateStatusInput(req.body);
      if (!validation.isValid) {
        return sendError(res, 'Validation failed', validation.errors, 400);
      }

      const updated = await RecommendationService.updateRecommendationStatus(
        id,
        req.body.status,
        req.user,
        { reason: req.body.reason }
      );

      return sendSuccess(res, `Recommendation marked as ${req.body.status}`, { recommendation: updated }, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Trigger batch recommendation refresh across all active leads (Admin & Sales Manager only).
   * POST /api/recommendations/batch-refresh
   */
  static async batchRefreshRecommendations(req, res, next) {
    try {
      const result = await RecommendationService.batchRefreshRecommendations(req.user);
      return sendSuccess(res, result.message, result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * List all recommendations for a specific lead.
   * GET /api/leads/:id/recommendations
   */
  static async getLeadRecommendations(req, res, next) {
    try {
      const { id } = req.params;
      const recommendations = await RecommendationService.getLeadRecommendations(id, req.user);
      return sendSuccess(res, 'Lead recommendations retrieved successfully', { recommendations }, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Force re-evaluation & generation of recommendation for a specific lead.
   * POST /api/leads/:id/recommendations/generate
   */
  static async generateLeadRecommendation(req, res, next) {
    try {
      const { id } = req.params;
      const result = await RecommendationService.generateOrUpdateRecommendation(id, req.user);
      return sendSuccess(res, 'Lead recommendation evaluated successfully', result, 200);
    } catch (error) {
      next(error);
    }
  }
}

export default RecommendationController;
