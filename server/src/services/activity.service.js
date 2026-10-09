import { getPrismaClient } from '../config/prisma.js';
import { AuditService } from './audit.service.js';
import { ScoringService } from './scoring.service.js';

export class ActivityService {
  /**
   * List activities for a given lead with authorization checks.
   */
  static async listActivities(leadId, user, { page = 1, limit = 50 } = {}) {
    const prisma = getPrismaClient();

    // Check lead existence
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, assignedToId: true, isArchived: true }
    });

    if (!lead) {
      const error = new Error(`Lead with ID "${leadId}" was not found`);
      error.statusCode = 404;
      throw error;
    }

    // Role-based authorization for Sales Representatives
    if (user.role === 'SALES_REPRESENTATIVE') {
      if (lead.assignedToId && lead.assignedToId !== user.id) {
        const error = new Error('You do not have permission to view activities for this lead');
        error.statusCode = 403;
        throw error;
      }
    }

    const skip = (page - 1) * limit;

    const [activities, total] = await Promise.all([
      prisma.leadActivity.findMany({
        where: { leadId },
        skip,
        take: limit,
        orderBy: { occurredAt: 'desc' },
        include: {
          createdBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true
            }
          }
        }
      }),
      prisma.leadActivity.count({ where: { leadId } })
    ]);

    return {
      activities,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }

  /**
   * Log an activity for a lead with server-enforced actor attribution and audit logging.
   */
  static async createActivity(leadId, data, user) {
    const prisma = getPrismaClient();

    // Verify lead existence
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, assignedToId: true, isArchived: true }
    });

    if (!lead) {
      const error = new Error(`Lead with ID "${leadId}" was not found`);
      error.statusCode = 404;
      throw error;
    }

    if (lead.isArchived) {
      const error = new Error('Cannot log activities on an archived lead');
      error.statusCode = 400;
      throw error;
    }

    // Role-based authorization for Sales Representatives
    if (user.role === 'SALES_REPRESENTATIVE') {
      if (lead.assignedToId && lead.assignedToId !== user.id) {
        const error = new Error('You do not have permission to record activities on this lead');
        error.statusCode = 403;
        throw error;
      }
    }

    const occurredAt = data.occurredAt ? new Date(data.occurredAt) : new Date();

    const activity = await prisma.leadActivity.create({
      data: {
        leadId,
        type: data.type,
        description: data.description ? data.description.trim() : null,
        metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : null,
        occurredAt,
        // Server-side attribution: never trust client for createdById
        createdById: user.id
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        }
      }
    });

    // Immutable Audit Log
    await AuditService.log({
      action: 'LEAD_ACTIVITY_RECORDED',
      entityType: 'LeadActivity',
      entityId: activity.id,
      userId: user.id,
      metadata: {
        leadId,
        activityType: activity.type,
        occurredAt: activity.occurredAt
      }
    });

    // Automatically recalculate lead intelligence & update score/priority
    let intelligence = null;
    try {
      intelligence = await ScoringService.recalculateLeadScore(leadId, user, {
        causalActivityId: activity.id
      });
    } catch (scoringErr) {
      // Log error but do not drop the successfully created activity
      console.error(`[ScoringService] Score recalculation failed for lead ${leadId}:`, scoringErr.message);
    }

    return {
      activity,
      intelligence
    };
  }
}

export default ActivityService;
