import { ActivityService } from '../services/activity.service.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { validateCreateActivityInput } from '../validators/activity.validator.js';

export class ActivityController {
  static async listActivities(req, res, next) {
    try {
      const { id: leadId } = req.params;
      const { page, limit } = req.query;

      const result = await ActivityService.listActivities(leadId, req.user, {
        page: parseInt(page, 10) || 1,
        limit: parseInt(limit, 10) || 50
      });

      return sendSuccess(res, 'Lead activities retrieved successfully', result, 200);
    } catch (error) {
      next(error);
    }
  }

  static async createActivity(req, res, next) {
    try {
      const { id: leadId } = req.params;
      const validation = validateCreateActivityInput(req.body);

      if (!validation.isValid) {
        return sendError(res, 'Invalid activity data', validation.errors, 400);
      }

      const result = await ActivityService.createActivity(leadId, req.body, req.user);
      const activity = result.activity || result;
      const intelligence = result.intelligence || null;
      return sendSuccess(res, 'Lead activity recorded successfully', { activity, intelligence }, 201);
    } catch (error) {
      next(error);
    }
  }
}

export default ActivityController;
