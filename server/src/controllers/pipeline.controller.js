import { PipelineService } from '../services/pipeline.service.js';
import { validateReorderStagesInput } from '../validators/pipeline.validator.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export class PipelineController {
  static async listStages(req, res, next) {
    try {
      const stages = await PipelineService.listStages();
      return sendSuccess(res, 'Pipeline stages retrieved successfully', { stages }, 200);
    } catch (error) {
      next(error);
    }
  }

  static async reorderStages(req, res, next) {
    try {
      const validation = validateReorderStagesInput(req.body);
      if (!validation.isValid) {
        return sendError(res, 'Invalid pipeline stage reorder data', validation.errors, 400);
      }

      const stages = await PipelineService.reorderStages(req.body.stageOrders, req.user);
      return sendSuccess(res, 'Pipeline stages reordered successfully', { stages }, 200);
    } catch (error) {
      next(error);
    }
  }

  static async getMetrics(req, res, next) {
    try {
      const metrics = await PipelineService.getPipelineMetrics(req.user);
      return sendSuccess(res, 'Pipeline metrics calculated successfully', metrics, 200);
    } catch (error) {
      next(error);
    }
  }
}
