import { AIService } from '../services/ai.service.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import {
  validateFollowUpDraftInput,
  validateMeetingPrepInput
} from '../validators/ai.validator.js';
import {
  SUPPORTED_TONES,
  SUPPORTED_OBJECTIVES,
  SUPPORTED_MEETING_TYPES
} from '../config/ai.config.js';

export class AIController {
  /**
   * Get supported configuration options for AI generators.
   * GET /api/ai/options
   */
  static async getOptions(req, res, next) {
    try {
      return sendSuccess(res, 'AI options retrieved successfully', {
        tones: Object.keys(SUPPORTED_TONES).map((key) => ({ id: key, label: SUPPORTED_TONES[key] })),
        objectives: Object.keys(SUPPORTED_OBJECTIVES).map((key) => ({ id: key, label: SUPPORTED_OBJECTIVES[key] })),
        meetingTypes: Object.keys(SUPPORTED_MEETING_TYPES).map((key) => ({ id: key, label: SUPPORTED_MEETING_TYPES[key] }))
      }, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate grounded AI executive summary for a lead.
   * POST /api/ai/leads/:id/summary
   */
  static async generateLeadSummary(req, res, next) {
    try {
      const { id } = req.params;
      const summary = await AIService.generateLeadSummary(id, req.user);
      return sendSuccess(res, 'AI lead summary generated successfully', { summary }, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate personalized follow-up email draft.
   * POST /api/ai/leads/:id/follow-up-draft
   */
  static async generateFollowUpDraft(req, res, next) {
    try {
      const { id } = req.params;
      const validation = validateFollowUpDraftInput(req.body);
      if (!validation.isValid) {
        return sendError(res, 'Validation failed', validation.errors, 400);
      }

      const draft = await AIService.generateFollowUpDraft(id, req.body, req.user);
      return sendSuccess(res, 'AI follow-up draft generated successfully', { draft }, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate AI explanation for an existing recommendation.
   * POST /api/ai/recommendations/:id/explanation
   */
  static async explainRecommendation(req, res, next) {
    try {
      const { id } = req.params;
      const explanation = await AIService.explainRecommendation(id, req.user);
      return sendSuccess(res, 'AI recommendation explanation generated successfully', { explanation }, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Generate AI meeting and discovery call preparation brief.
   * POST /api/ai/leads/:id/meeting-preparation
   */
  static async generateMeetingPrep(req, res, next) {
    try {
      const { id } = req.params;
      const validation = validateMeetingPrepInput(req.body);
      if (!validation.isValid) {
        return sendError(res, 'Validation failed', validation.errors, 400);
      }

      const prep = await AIService.generateMeetingPrep(id, req.body, req.user);
      return sendSuccess(res, 'AI meeting preparation brief generated successfully', { prep }, 200);
    } catch (error) {
      next(error);
    }
  }
}

export default AIController;
