import getPrismaClient from '../config/prisma.js';
import { formatSafeUser } from './auth.service.js';

const prisma = getPrismaClient();

export class UserService {
  /**
   * List users with optional role filtering and search query.
   */
  static async listUsers({ role, search, page = 1, limit = 50 }) {
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const take = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));
    const skip = (pageNum - 1) * take;

    const where = {};

    if (role) {
      where.role = { name: role };
    }

    if (search && search.trim()) {
      const query = search.trim();
      where.OR = [
        { firstName: { contains: query, mode: 'insensitive' } },
        { lastName: { contains: query, mode: 'insensitive' } },
        { email: { contains: query, mode: 'insensitive' } }
      ];
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { role: true }
      })
    ]);

    return {
      users: users.map(formatSafeUser),
      pagination: {
        total,
        page: pageNum,
        limit: take,
        totalPages: Math.ceil(total / take)
      }
    };
  }

  /**
   * Get user details by ID.
   */
  static async getUserById(id) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: { role: true }
    });

    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    return formatSafeUser(user);
  }

  /**
   * Activate or deactivate a user account.
   */
  static async updateUserStatus(id, isActive, currentAdminId) {
    if (id === currentAdminId && !isActive) {
      const error = new Error('Administrators cannot deactivate their own account');
      error.statusCode = 400;
      throw error;
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive },
      include: { role: true }
    });

    return formatSafeUser(updated);
  }

  /**
   * Change user role.
   */
  static async updateUserRole(id, roleName, currentAdminId) {
    if (id === currentAdminId && roleName !== 'ADMIN') {
      const error = new Error('Administrators cannot demote their own account');
      error.statusCode = 400;
      throw error;
    }

    const targetRole = await prisma.role.findUnique({
      where: { name: roleName }
    });

    if (!targetRole) {
      const error = new Error(`Role '${roleName}' not found`);
      error.statusCode = 404;
      throw error;
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      const error = new Error('User not found');
      error.statusCode = 404;
      throw error;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { roleId: targetRole.id },
      include: { role: true }
    });

    return formatSafeUser(updated);
  }
}
