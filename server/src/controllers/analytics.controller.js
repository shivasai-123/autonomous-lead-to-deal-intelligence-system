import { AnalyticsService } from '../services/analytics.service.js';
import { PipelineService } from '../services/pipeline.service.js';
import { sendSuccess } from '../utils/apiResponse.js';

export class AnalyticsController {
  /**
   * Get main executive & overview metrics.
   * GET /api/analytics/overview
   */
  static async getOverview(req, res, next) {
    try {
      const data = await AnalyticsService.getOverviewMetrics(req.user, req.query);
      return sendSuccess(res, 'Analytics overview retrieved successfully', data, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get conversion funnel progression.
   * GET /api/analytics/conversion-funnel
   */
  static async getConversionFunnel(req, res, next) {
    try {
      const data = await AnalyticsService.getConversionFunnel(req.user);
      return sendSuccess(res, 'Conversion funnel retrieved successfully', data, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get deals grouped by pipeline stages.
   * GET /api/analytics/pipeline-distribution
   */
  static async getPipelineDistribution(req, res, next) {
    try {
      const data = await AnalyticsService.getPipelineDistribution(req.user);
      return sendSuccess(res, 'Pipeline distribution retrieved successfully', data, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get historical sales trends over months.
   * GET /api/analytics/sales-trends
   */
  static async getSalesTrends(req, res, next) {
    try {
      const data = await AnalyticsService.getSalesTrends(req.user);
      return sendSuccess(res, 'Sales trends retrieved successfully', data, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get stage velocity duration breakdown.
   * GET /api/analytics/stage-velocity
   */
  static async getStageVelocity(req, res, next) {
    try {
      const metrics = await PipelineService.getPipelineMetrics(req.user);
      return sendSuccess(res, 'Stage velocity retrieved successfully', {
        stageVelocity: metrics.stageVelocity || [],
        stages: metrics.stageVelocity || []
      }, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get lead acquisition source performance.
   * GET /api/analytics/lead-sources
   */
  static async getLeadSourcePerformance(req, res, next) {
    try {
      const data = await AnalyticsService.getLeadSourcePerformance(req.user);
      return sendSuccess(res, 'Lead sources performance retrieved successfully', data, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get sales representative performance leaderboard.
   * GET /api/analytics/sales-performance (or /rep-performance)
   * RBAC: Managers & Admins only; Reps get 403.
   */
  static async getSalesRepPerformance(req, res, next) {
    try {
      if (req.user.role === 'SALES_REPRESENTATIVE') {
        const error = new Error('Access denied: Only Sales Managers and Administrators can view team performance leaderboards');
        error.statusCode = 403;
        throw error;
      }

      const data = await AnalyticsService.getSalesRepPerformance(req.user);
      return sendSuccess(res, 'Sales performance leaderboard retrieved successfully', {
        leaderboard: data.leaderboard || [],
        performance: data.leaderboard || []
      }, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get personalized sales representative workspace.
   * GET /api/analytics/rep-workspace
   */
  static async getSalesRepWorkspace(req, res, next) {
    try {
      const data = await AnalyticsService.getSalesRepWorkspace(req.user);
      return sendSuccess(res, 'Sales rep workspace retrieved successfully', {
        ...data,
        metrics: data.summary,
        dealsClosingSoon: data.closingSoonDeals || [],
        recommendations: data.pendingRecommendations || []
      }, 200);
    } catch (err) {
      next(err);
    }
  }
}

export default AnalyticsController;
