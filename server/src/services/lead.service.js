import { getPrismaClient } from '../config/prisma.js';
import { DuplicateService } from './duplicate.service.js';
import { AuditService } from './audit.service.js';
import { classifyScore, STALLED_THRESHOLD_DAYS } from '../config/scoring.config.js';
import { RecommendationService } from './recommendation.service.js';

export class LeadService {
  /**
   * List leads with filtering, search, pagination, and RBAC scoping.
   */
  static async listLeads(user, params) {
    const prisma = getPrismaClient();
    const {
      search,
      status,
      priority,
      classification,
      isStalled,
      companyId,
      assignedToId,
      isArchived,
      page,
      limit,
      sortBy,
      sortOrder
    } = params;

    const skip = (page - 1) * limit;
    const where = {
      isArchived: Boolean(isArchived)
    };

    // RBAC access scoping
    if (user.role === 'SALES_REPRESENTATIVE') {
      // Sales reps can view leads assigned to them or unassigned
      where.OR = [
        { assignedToId: user.id },
        { assignedToId: null }
      ];
    } else if (assignedToId) {
      where.assignedToId = assignedToId;
    }

    // Status filter
    if (status) {
      where.status = status;
    }

    // Priority filter
    if (priority) {
      where.priority = priority;
    }

    // Classification filter (HOT: 70-100, WARM: 40-69, COLD: 0-39)
    if (classification) {
      const upper = String(classification).toUpperCase();
      if (upper === 'HOT') {
        where.score = { gte: 70 };
      } else if (upper === 'WARM') {
        where.score = { gte: 40, lte: 69 };
      } else if (upper === 'COLD') {
        where.score = { lte: 39 };
      }
    }

    // Stalled status filter (Threshold: 14 days)
    if (isStalled !== undefined && isStalled !== null && isStalled !== '') {
      const isStalledBool = String(isStalled).toLowerCase() === 'true';
      const cutoff = new Date(Date.now() - STALLED_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);

      if (isStalledBool) {
        where.isArchived = false;
        where.status = { notIn: ['CONVERTED', 'LOST'] };
        where.activities = { none: { occurredAt: { gte: cutoff } } };
        where.AND = [
          ...(where.AND || []),
          {
            OR: [
              { activities: { some: {} } },
              { createdAt: { lte: cutoff } }
            ]
          }
        ];
      } else {
        where.AND = [
          ...(where.AND || []),
          {
            OR: [
              { status: { in: ['CONVERTED', 'LOST'] } },
              { activities: { some: { occurredAt: { gte: cutoff } } } },
              {
                AND: [
                  { activities: { none: {} } },
                  { createdAt: { gt: cutoff } }
                ]
              }
            ]
          }
        ];
      }
    }

    // Company filter
    if (companyId) {
      where.companyId = companyId;
    }

    // Search query on name and email
    if (search) {
      const searchCondition = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } }
      ];

      if (where.OR) {
        where.AND = [
          { OR: where.OR },
          { OR: searchCondition }
        ];
        delete where.OR;
      } else {
        where.OR = searchCondition;
      }
    }

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          company: {
            select: { id: true, name: true, industry: true }
          },
          assignedTo: {
            select: { id: true, firstName: true, lastName: true, email: true }
          },
          activities: {
            orderBy: { occurredAt: 'desc' },
            take: 1,
            select: { occurredAt: true }
          },
          _count: {
            select: { activities: true, deals: true }
          }
        }
      }),
      prisma.lead.count({ where })
    ]);

    const enrichedLeads = leads.map((l) => {
      const lastActivityAt = l.activities?.[0]?.occurredAt || null;
      const refDate = lastActivityAt ? new Date(lastActivityAt) : new Date(l.createdAt);
      const daysSinceLastActivity = Math.floor(Math.max(0, Date.now() - refDate.getTime()) / (1000 * 60 * 60 * 24));
      const isTerminal = l.status === 'CONVERTED' || l.status === 'LOST';
      const stalled = !l.isArchived && !isTerminal && daysSinceLastActivity >= STALLED_THRESHOLD_DAYS;

      const { activities, ...leadData } = l;
      return {
        ...leadData,
        classification: classifyScore(l.score),
        isStalled: stalled,
        daysSinceLastActivity,
        lastActivityAt
      };
    });

    return {
      leads: enrichedLeads,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }

  /**
   * Retrieve lead by ID with complete relations and RBAC enforcement.
   */
  static async getLeadById(id, user) {
    const prisma = getPrismaClient();

    const lead = await prisma.lead.findUnique({
      where: { id },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            industry: true,
            website: true,
            phone: true,
            email: true,
            city: true,
            country: true
          }
        },
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        activities: {
          orderBy: { occurredAt: 'desc' },
          include: {
            createdBy: {
              select: { id: true, firstName: true, lastName: true, email: true }
            }
          }
        },
        scoreHistory: {
          orderBy: { createdAt: 'desc' },
          take: 5
        },
        deals: {
          select: {
            id: true,
            title: true,
            value: true,
            currency: true,
            status: true,
            pipelineStageId: true
          }
        },
        recommendations: {
          where: { status: 'PENDING' },
          orderBy: { createdAt: 'desc' },
          take: 3
        }
      }
    });

    if (!lead) {
      const error = new Error(`Lead with ID "${id}" was not found`);
      error.statusCode = 404;
      throw error;
    }

    // Role-based authorization
    if (user.role === 'SALES_REPRESENTATIVE') {
      if (lead.assignedToId && lead.assignedToId !== user.id) {
        const error = new Error('You do not have permission to access this lead record');
        error.statusCode = 403;
        throw error;
      }
    }

    return lead;
  }

  /**
   * Create a new lead with duplicate detection, suspicious checks, and audit logging.
   */
  static async createLead(data, user, { forceCreate = false } = {}) {
    const prisma = getPrismaClient();

    const normalizedEmail = DuplicateService.normalizeEmail(data.email);
    const normalizedPhone = DuplicateService.normalizePhone(data.phone);

    // 1. Evaluate duplicate matches
    const duplicateResults = await DuplicateService.checkLeadDuplicates({
      email: normalizedEmail,
      phone: normalizedPhone
    });

    // If duplicate detected and client did not explicitly acknowledge/force create
    if (duplicateResults.isDuplicate && !forceCreate) {
      const error = new Error('Potential duplicate lead detected');
      error.statusCode = 409;
      error.details = {
        isDuplicate: true,
        duplicateMatches: duplicateResults.duplicateMatches,
        domainMatches: duplicateResults.domainMatches,
        reasons: duplicateResults.reasons
      };
      throw error;
    }

    // 2. Evaluate suspicious rules
    const suspiciousCheck = DuplicateService.evaluateSuspiciousRules({
      firstName: data.firstName,
      lastName: data.lastName,
      email: normalizedEmail,
      phone: normalizedPhone
    });

    // 3. Resolve assignment & RBAC permissions
    let finalAssignedToId = data.assignedToId || null;
    if (user.role === 'SALES_REPRESENTATIVE') {
      // Reps can only assign to themselves or leave unassigned
      if (finalAssignedToId && finalAssignedToId !== user.id) {
        const error = new Error('Sales representatives cannot assign leads to other representatives');
        error.statusCode = 403;
        throw error;
      }
      if (!finalAssignedToId) {
        finalAssignedToId = user.id; // Default ownership to creator rep
      }
    } else if (finalAssignedToId) {
      // Validate assignee user exists
      const assignee = await prisma.user.findUnique({
        where: { id: finalAssignedToId }
      });
      if (!assignee || !assignee.isActive) {
        const error = new Error('Assigned user does not exist or is inactive');
        error.statusCode = 400;
        throw error;
      }
    }

    // 4. Validate company exists if provided
    if (data.companyId) {
      const company = await prisma.company.findUnique({
        where: { id: data.companyId }
      });
      if (!company) {
        const error = new Error('Specified company does not exist');
        error.statusCode = 400;
        throw error;
      }
    }

    // 5. Create lead record
    const lead = await prisma.lead.create({
      data: {
        firstName: data.firstName.trim(),
        lastName: data.lastName.trim(),
        email: normalizedEmail,
        phone: data.phone ? data.phone.trim() : null,
        jobTitle: data.jobTitle ? data.jobTitle.trim() : null,
        source: data.source ? data.source.trim() : 'Manual Entry',
        status: data.status || 'NEW',
        priority: data.priority || 'MEDIUM',
        isDuplicate: duplicateResults.isDuplicate,
        isSuspicious: suspiciousCheck.isSuspicious,
        suspiciousReason: suspiciousCheck.reason,
        companyId: data.companyId || null,
        assignedToId: finalAssignedToId
      },
      include: {
        company: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } }
      }
    });

    // 6. Record audit log
    await AuditService.log({
      action: 'LEAD_CREATED',
      entityType: 'Lead',
      entityId: lead.id,
      userId: user.id,
      metadata: {
        email: lead.email,
        companyId: lead.companyId,
        assignedToId: lead.assignedToId,
        isDuplicate: lead.isDuplicate,
        isSuspicious: lead.isSuspicious
      }
    });

    // Safely generate initial Next-Best-Action recommendation for newly created lead
    try {
      await RecommendationService.generateOrUpdateRecommendation(lead.id, user);
    } catch (recErr) {
      console.error(`[RecommendationService] Failed to evaluate recommendation for lead ${lead.id}:`, recErr.message);
    }

    return {
      lead,
      duplicateWarning: duplicateResults.isDuplicate ? duplicateResults : null,
      domainMatches: duplicateResults.domainMatches.length > 0 ? duplicateResults.domainMatches : null
    };
  }

  /**
   * Update lead record with RBAC checks and assignment tracking.
   */
  static async updateLead(id, data, user) {
    const prisma = getPrismaClient();

    const existing = await prisma.lead.findUnique({
      where: { id }
    });

    if (!existing) {
      const error = new Error(`Lead with ID "${id}" was not found`);
      error.statusCode = 404;
      throw error;
    }

    if (existing.isArchived) {
      const error = new Error('Cannot update an archived lead');
      error.statusCode = 400;
      throw error;
    }

    // RBAC: Sales Rep access check
    if (user.role === 'SALES_REPRESENTATIVE') {
      if (existing.assignedToId && existing.assignedToId !== user.id) {
        const error = new Error('You do not have permission to update this lead');
        error.statusCode = 403;
        throw error;
      }
      if (data.assignedToId !== undefined && data.assignedToId !== existing.assignedToId) {
        const error = new Error('Only managers and administrators can reassign leads');
        error.statusCode = 403;
        throw error;
      }
    }

    // Validate new assignee if changing
    if (data.assignedToId !== undefined && data.assignedToId !== null && data.assignedToId !== existing.assignedToId) {
      const assignee = await prisma.user.findUnique({
        where: { id: data.assignedToId }
      });
      if (!assignee || !assignee.isActive) {
        const error = new Error('Assigned user does not exist or is inactive');
        error.statusCode = 400;
        throw error;
      }
    }

    // Validate company if changing
    if (data.companyId !== undefined && data.companyId !== null && data.companyId !== existing.companyId) {
      const company = await prisma.company.findUnique({
        where: { id: data.companyId }
      });
      if (!company) {
        const error = new Error('Specified company does not exist');
        error.statusCode = 400;
        throw error;
      }
    }

    const updatePayload = {};
    if (data.firstName !== undefined) updatePayload.firstName = data.firstName.trim();
    if (data.lastName !== undefined) updatePayload.lastName = data.lastName.trim();
    if (data.email !== undefined) updatePayload.email = DuplicateService.normalizeEmail(data.email);
    if (data.phone !== undefined) updatePayload.phone = data.phone ? data.phone.trim() : null;
    if (data.jobTitle !== undefined) updatePayload.jobTitle = data.jobTitle ? data.jobTitle.trim() : null;
    if (data.source !== undefined) updatePayload.source = data.source ? data.source.trim() : null;
    if (data.status !== undefined) updatePayload.status = data.status;
    if (data.priority !== undefined) updatePayload.priority = data.priority;
    if (data.companyId !== undefined) updatePayload.companyId = data.companyId || null;
    if (data.assignedToId !== undefined) updatePayload.assignedToId = data.assignedToId || null;

    const updated = await prisma.lead.update({
      where: { id },
      data: updatePayload,
      include: {
        company: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } }
      }
    });

    // Check if assignment changed
    if (data.assignedToId !== undefined && data.assignedToId !== existing.assignedToId) {
      await AuditService.log({
        action: 'LEAD_ASSIGNMENT_CHANGED',
        entityType: 'Lead',
        entityId: id,
        userId: user.id,
        metadata: {
          previousAssigneeId: existing.assignedToId,
          newAssigneeId: data.assignedToId
        }
      });
    }

    // General update audit
    await AuditService.log({
      action: 'LEAD_UPDATED',
      entityType: 'Lead',
      entityId: id,
      userId: user.id,
      metadata: {
        updatedFields: Object.keys(updatePayload)
      }
    });

    return updated;
  }

  /**
   * Soft-delete / archive a lead to preserve historical integrity.
   */
  static async archiveLead(id, user) {
    const prisma = getPrismaClient();

    // Only Admin and Sales Manager can archive leads
    if (user.role !== 'ADMIN' && user.role !== 'SALES_MANAGER') {
      const error = new Error('Only administrators and managers have permission to archive leads');
      error.statusCode = 403;
      throw error;
    }

    const existing = await prisma.lead.findUnique({
      where: { id }
    });

    if (!existing) {
      const error = new Error(`Lead with ID "${id}" was not found`);
      error.statusCode = 404;
      throw error;
    }

    if (existing.isArchived) {
      return { message: 'Lead is already archived', lead: existing };
    }

    const archived = await prisma.lead.update({
      where: { id },
      data: { isArchived: true }
    });

    await AuditService.log({
      action: 'LEAD_ARCHIVED',
      entityType: 'Lead',
      entityId: id,
      userId: user.id,
      metadata: { previousStatus: existing.status }
    });

    // Safely dismiss any pending recommendations for archived lead
    try {
      await RecommendationService.dismissPendingForLead(id, 'Lead was archived', user);
    } catch (recErr) {
      console.error(`[RecommendationService] Failed to dismiss recommendations for archived lead ${id}:`, recErr.message);
    }

    return { message: 'Lead successfully archived', lead: archived };
  }
}

export default LeadService;
