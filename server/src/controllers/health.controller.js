import { HealthService } from '../services/health.service.js';
import { sendSuccess } from '../utils/apiResponse.js';

export class HealthController {
  static getHealth(req, res, next) {
    try {
      const healthData = HealthService.getHealthStatus();
      return sendSuccess(res, 'CRM API is running', healthData, 200);
    } catch (error) {
      next(error);
    }
  }
}
