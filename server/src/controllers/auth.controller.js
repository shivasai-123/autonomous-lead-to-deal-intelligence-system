import { AuthService } from '../services/auth.service.js';
import { validateRegisterInput, validateLoginInput } from '../validators/auth.validator.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export class AuthController {
  /**
   * POST /api/auth/register
   */
  static async register(req, res, next) {
    try {
      const validation = validateRegisterInput(req.body);
      if (!validation.isValid) {
        return sendError(res, 'Validation failed', validation.errors, 400);
      }

      const result = await AuthService.register(req.body);
      return sendSuccess(res, 'User registered successfully', result, 201);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/login
   */
  static async login(req, res, next) {
    try {
      const validation = validateLoginInput(req.body);
      if (!validation.isValid) {
        return sendError(res, 'Validation failed', validation.errors, 400);
      }

      const result = await AuthService.login(req.body);
      return sendSuccess(res, 'Login successful', result, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/auth/me
   */
  static async getMe(req, res, next) {
    try {
      const user = await AuthService.getCurrentUser(req.user.id);
      return sendSuccess(res, 'User profile retrieved', { user }, 200);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/auth/logout
   */
  static async logout(req, res) {
    // With stateless JWT, client deletes the stored token.
    return sendSuccess(res, 'Logged out successfully', null, 200);
  }
}
