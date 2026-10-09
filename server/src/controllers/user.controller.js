import { UserService } from '../services/user.service.js';
import { validateUpdateStatusInput, validateUpdateRoleInput } from '../validators/user.validator.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export class UserController {
  /**
   * GET /api/users
   */
  static async listUsers(req, res, next) {
    try {
      const result = await UserService.listUsers(req.query);
      return sendSuccess(res, 'Users retrieved successfully', result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/users/:id
   */
  static async getUserById(req, res, next) {
    try {
      const user = await UserService.getUserById(req.params.id);
      return sendSuccess(res, 'User retrieved successfully', { user }, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/users/:id/status
   */
  static async updateUserStatus(req, res, next) {
    try {
      const validation = validateUpdateStatusInput(req.body);
      if (!validation.isValid) {
        return sendError(res, 'Validation failed', validation.errors, 400);
      }

      const updated = await UserService.updateUserStatus(
        req.params.id,
        req.body.isActive,
        req.user.id
      );
      return sendSuccess(res, 'User status updated successfully', { user: updated }, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PATCH /api/users/:id/role
   */
  static async updateUserRole(req, res, next) {
    try {
      const validation = validateUpdateRoleInput(req.body);
      if (!validation.isValid) {
        return sendError(res, 'Validation failed', validation.errors, 400);
      }

      const updated = await UserService.updateUserRole(
        req.params.id,
        req.body.roleName,
        req.user.id
      );
      return sendSuccess(res, 'User role updated successfully', { user: updated }, 200);
    } catch (error) {
      next(error);
    }
  }
}
