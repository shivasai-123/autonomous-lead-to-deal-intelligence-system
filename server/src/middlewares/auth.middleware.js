import { verifyToken } from '../utils/token.js';
import { sendError } from '../utils/apiResponse.js';
import getPrismaClient from '../config/prisma.js';

const prisma = getPrismaClient();

/**
 * Middleware: Requires a valid Bearer JWT and attaches the authenticated user to req.user.
 */
export async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Authentication required: Missing or malformed Bearer token', null, 401);
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return sendError(res, 'Authentication required: Token not provided', null, 401);
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (jwtError) {
      if (jwtError.name === 'TokenExpiredError') {
        return sendError(res, 'Authentication session expired. Please log in again.', null, 401);
      }
      return sendError(res, 'Invalid authentication token', null, 401);
    }

    // Retrieve active user from database to ensure up-to-date state
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { role: true }
    });

    if (!user) {
      return sendError(res, 'User account no longer exists', null, 401);
    }

    if (!user.isActive) {
      return sendError(res, 'User account has been deactivated. Please contact an administrator.', null, 403);
    }

    // Attach safe user representation to request
    req.user = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role.name,
      roleId: user.roleId,
      isActive: user.isActive
    };

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Middleware: Restricts access to users having at least one of the specified roles.
 * Must be preceded by requireAuth or will execute requireAuth first.
 * @param  {...string} allowedRoles - e.g. 'ADMIN', 'SALES_MANAGER'
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'Authentication required', null, 401);
    }

    if (!allowedRoles.includes(req.user.role)) {
      return sendError(
        res,
        `Access forbidden: Requires one of [${allowedRoles.join(', ')}] permissions`,
        null,
        403
      );
    }

    next();
  };
}
