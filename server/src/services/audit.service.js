import { getPrismaClient } from '../config/prisma.js';
import { logger } from '../utils/logger.js';

export class AuditService {
  /**
   * Record an immutable audit log entry in PostgreSQL.
   * Gracefully logs warnings if recording fails to avoid interrupting core transactions.
   *
   * @param {Object} params
   * @param {string} params.action - e.g., 'LEAD_CREATED', 'LEAD_UPDATED', 'LEAD_ARCHIVED', 'COMPANY_CREATED', 'LEAD_ACTIVITY_RECORDED'
   * @param {string} params.entityType - 'Lead' | 'Company' | 'LeadActivity' | 'User'
   * @param {string} params.entityId - Primary key UUID of the entity
   * @param {string|null} [params.userId] - Authenticated actor ID (from req.user.id)
   * @param {Object|null} [params.metadata] - Structured JSON details (previous values, updated fields, IP, etc.)
   */
  static async log({ action, entityType, entityId, userId = null, metadata = null }) {
    try {
      const prisma = getPrismaClient();
      const entry = await prisma.auditLog.create({
        data: {
          action,
          entityType,
          entityId,
          userId: userId || null,
          metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null
        }
      });
      return entry;
    } catch (error) {
      logger.warn(`Failed to record audit log for [${action}] on ${entityType}:${entityId}: ${error.message}`);
      return null;
    }
  }
}

export default AuditService;
