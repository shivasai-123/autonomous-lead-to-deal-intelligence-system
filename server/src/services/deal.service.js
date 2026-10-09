import { getPrismaClient } from '../config/prisma.js';
import { AuditService } from './audit.service.js';
import { RecommendationService } from './recommendation.service.js';
import { NotificationService } from './notification.service.js';

export class DealService {
  /**
   * List deals with filtering, search, pagination, and RBAC scoping.
   */
  static async listDeals(user, params) {
    const prisma = getPrismaClient();
    const {
      search,
      status,
      pipelineStageId,
      companyId,
      assignedToId,
      page,
      limit,
      sortBy,
      sortOrder
    } = params;

    const skip = (page - 1) * limit;
    const where = {};

    // RBAC scoping
    if (user.role === 'SALES_REPRESENTATIVE') {
      where.OR = [
        { assignedToId: user.id },
        { assignedToId: null }
      ];
    } else if (assignedToId) {
      where.assignedToId = assignedToId;
    }

    if (status) {
      where.status = status;
    }

    if (pipelineStageId) {
      where.pipelineStageId = pipelineStageId;
    }

    if (companyId) {
      where.companyId = companyId;
    }

    if (search) {
      where.AND = [
        ...(where.AND || []),
        {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } }
          ]
        }
      ];
    }

    const [total, deals] = await Promise.all([
      prisma.deal.count({ where }),
      prisma.deal.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder
        },
        include: {
          pipelineStage: {
            select: {
              id: true,
              name: true,
              order: true,
              probability: true
            }
          },
          company: {
            select: {
              id: true,
              name: true,
              industry: true
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
          lead: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              company: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          },
          _count: {
            select: {
              stageHistory: true
            }
          }
        }
      })
    ]);

    const formattedDeals = deals.map((d) => ({
      ...d,
      value: Number(d.value)
    }));

    return {
      deals: formattedDeals,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get single deal by ID with relations and full chronological stage transition timeline.
   */
  static async getDealById(id, user) {
    const prisma = getPrismaClient();

    const deal = await prisma.deal.findUnique({
      where: { id },
      include: {
        pipelineStage: true,
        company: true,
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true
          }
        },
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            status: true,
            company: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        stageHistory: {
          orderBy: { enteredAt: 'asc' },
          include: {
            fromStage: {
              select: { id: true, name: true, order: true }
            },
            toStage: {
              select: { id: true, name: true, order: true }
            },
            user: {
              select: { id: true, firstName: true, lastName: true, email: true }
            }
          }
        }
      }
    });

    if (!deal) {
      const error = new Error('Deal not found');
      error.statusCode = 404;
      throw error;
    }

    // RBAC access check
    if (user.role === 'SALES_REPRESENTATIVE') {
      if (deal.assignedToId && deal.assignedToId !== user.id) {
        const error = new Error('Access denied: You can only view deals assigned to you or unassigned');
        error.statusCode = 403;
        throw error;
      }
    }

    return {
      ...deal,
      value: Number(deal.value)
    };
  }

  /**
   * Create a new deal with initial stage history and audit record.
   */
  static async createDeal(data, user) {
    const prisma = getPrismaClient();

    // Verify stage exists
    const stage = await prisma.pipelineStage.findUnique({
      where: { id: data.pipelineStageId }
    });
    if (!stage) {
      const error = new Error('Specified pipeline stage does not exist');
      error.statusCode = 400;
      throw error;
    }

    // Verify company if provided
    if (data.companyId) {
      const comp = await prisma.company.findUnique({ where: { id: data.companyId } });
      if (!comp) {
        const error = new Error('Specified company does not exist');
        error.statusCode = 400;
        throw error;
      }
    }

    // Verify lead if provided
    if (data.leadId) {
      const lead = await prisma.lead.findUnique({ where: { id: data.leadId } });
      if (!lead) {
        const error = new Error('Specified lead does not exist');
        error.statusCode = 400;
        throw error;
      }
    }

    // Assignee resolution
    let assignedToId = data.assignedToId;
    if (!assignedToId && user.role === 'SALES_REPRESENTATIVE') {
      assignedToId = user.id;
    } else if (assignedToId) {
      const assignee = await prisma.user.findUnique({ where: { id: assignedToId } });
      if (!assignee) {
        const error = new Error('Specified assignee user does not exist');
        error.statusCode = 400;
        throw error;
      }
    }

    // Determine status from stage
    let status = 'OPEN';
    let closedAt = null;
    if (stage.name === 'Won' || stage.probability === 100) {
      status = 'WON';
      closedAt = new Date();
    } else if (stage.name === 'Lost' || (stage.probability === 0 && stage.name === 'Lost')) {
      status = 'LOST';
      closedAt = new Date();
    }

    const createdDeal = await prisma.$transaction(async (tx) => {
      const deal = await tx.deal.create({
        data: {
          title: data.title.trim(),
          value: parseFloat(data.value),
          currency: data.currency || 'USD',
          expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : null,
          closedAt,
          description: data.description ? data.description.trim() : null,
          status,
          leadId: data.leadId || null,
          companyId: data.companyId || null,
          assignedToId: assignedToId || null,
          pipelineStageId: stage.id
        },
        include: {
          pipelineStage: true,
          company: true,
          assignedTo: {
            select: { id: true, firstName: true, lastName: true, email: true }
          },
          lead: true
        }
      });

      // Record initial stage history entry
      await tx.dealStageHistory.create({
        data: {
          dealId: deal.id,
          fromStageId: null,
          toStageId: stage.id,
          userId: user.id,
          transitionNote: data.transitionNote || 'Initial deal creation'
        }
      });

      return deal;
    });

    await AuditService.log({
      action: 'DEAL_CREATED',
      entityType: 'Deal',
      entityId: createdDeal.id,
      userId: user.id,
      metadata: {
        title: createdDeal.title,
        value: createdDeal.value,
        stage: stage.name,
        status: createdDeal.status
      }
    });

    if (createdDeal.assignedToId) {
      try {
        await NotificationService.createNotification({
          userId: createdDeal.assignedToId,
          type: 'DEAL_STAGE_CHANGED',
          title: 'New Deal Assigned',
          message: `You have been assigned deal "${createdDeal.title}" in stage ${stage.name}.`,
          metadata: {
            dealId: createdDeal.id,
            link: `/deals/${createdDeal.id}`
          }
        });
      } catch (notifErr) {
        console.error(`[DealService] Notification error:`, notifErr.message);
      }
    }

    return {
      ...createdDeal,
      value: Number(createdDeal.value)
    };
  }

  /**
   * Update deal details with RBAC authorization.
   */
  static async updateDeal(id, data, user) {
    const prisma = getPrismaClient();

    const existing = await prisma.deal.findUnique({
      where: { id },
      include: { pipelineStage: true }
    });

    if (!existing) {
      const error = new Error('Deal not found');
      error.statusCode = 404;
      throw error;
    }

    // RBAC: Rep can only update assigned or unassigned deals
    if (user.role === 'SALES_REPRESENTATIVE') {
      if (existing.assignedToId && existing.assignedToId !== user.id) {
        const error = new Error('Access denied: You can only edit deals assigned to you or unassigned');
        error.statusCode = 403;
        throw error;
      }
      // Sales reps cannot reassign deals to other users
      if (data.assignedToId !== undefined && data.assignedToId !== user.id && data.assignedToId !== null) {
        const error = new Error('Only Sales Managers and Admins can reassign deals to other representatives');
        error.statusCode = 403;
        throw error;
      }
    }

    const updateData = {};
    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.value !== undefined) updateData.value = parseFloat(data.value);
    if (data.currency !== undefined) updateData.currency = data.currency;
    if (data.expectedCloseDate !== undefined) {
      updateData.expectedCloseDate = data.expectedCloseDate ? new Date(data.expectedCloseDate) : null;
    }
    if (data.description !== undefined) {
      updateData.description = data.description ? data.description.trim() : null;
    }
    if (data.companyId !== undefined) {
      if (data.companyId) {
        const comp = await prisma.company.findUnique({ where: { id: data.companyId } });
        if (!comp) {
          const error = new Error('Specified company does not exist');
          error.statusCode = 400;
          throw error;
        }
      }
      updateData.companyId = data.companyId || null;
    }
    if (data.assignedToId !== undefined) {
      if (data.assignedToId) {
        const assignee = await prisma.user.findUnique({ where: { id: data.assignedToId } });
        if (!assignee) {
          const error = new Error('Specified assignee user does not exist');
          error.statusCode = 400;
          throw error;
        }
      }
      updateData.assignedToId = data.assignedToId || null;
    }

    const updated = await prisma.deal.update({
      where: { id },
      data: updateData,
      include: {
        pipelineStage: true,
        company: true,
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true }
        },
        lead: true
      }
    });

    await AuditService.log({
      action: 'DEAL_UPDATED',
      entityType: 'Deal',
      entityId: updated.id,
      userId: user.id,
      metadata: { updatedFields: Object.keys(updateData) }
    });

    return {
      ...updated,
      value: Number(updated.value)
    };
  }

  /**
   * Transition deal to a new stage atomically with history tracking and win/loss management.
   */
  static async transitionStage(id, { stageId, transitionNote }, user) {
    const prisma = getPrismaClient();

    const deal = await prisma.deal.findUnique({
      where: { id },
      include: { pipelineStage: true }
    });

    if (!deal) {
      const error = new Error('Deal not found');
      error.statusCode = 404;
      throw error;
    }

    // RBAC: Rep can only move their own or unassigned deals
    if (user.role === 'SALES_REPRESENTATIVE') {
      if (deal.assignedToId && deal.assignedToId !== user.id) {
        const error = new Error('Access denied: You can only transition deals assigned to you or unassigned');
        error.statusCode = 403;
        throw error;
      }
    }

    const targetStage = await prisma.pipelineStage.findUnique({
      where: { id: stageId }
    });

    if (!targetStage) {
      const error = new Error('Destination pipeline stage does not exist');
      error.statusCode = 400;
      throw error;
    }

    // Check if moving to same stage
    if (deal.pipelineStageId === stageId) {
      return this.getDealById(id, user);
    }

    // Status logic
    let newStatus = 'OPEN';
    let closedAt = null;
    let auditAction = 'DEAL_STAGE_CHANGED';

    if (targetStage.name === 'Won' || targetStage.probability === 100) {
      newStatus = 'WON';
      closedAt = new Date();
      auditAction = 'DEAL_WON';
    } else if (targetStage.name === 'Lost' || (targetStage.probability === 0 && targetStage.name === 'Lost')) {
      newStatus = 'LOST';
      closedAt = new Date();
      auditAction = 'DEAL_LOST';
    } else {
      // Transitioning to an open stage.
      // If the deal was previously closed (WON or LOST), only Managers & Admins can reopen it!
      if (deal.status === 'WON' || deal.status === 'LOST') {
        if (user.role === 'SALES_REPRESENTATIVE') {
          const error = new Error('Access denied: Only Sales Managers and Admins can reopen closed deals');
          error.statusCode = 403;
          throw error;
        }
      }
      newStatus = 'OPEN';
      closedAt = null;
      auditAction = 'DEAL_STAGE_CHANGED';
    }

    const updatedDeal = await prisma.$transaction(async (tx) => {
      // 1. Update deal stage and status
      const updated = await tx.deal.update({
        where: { id },
        data: {
          pipelineStageId: targetStage.id,
          status: newStatus,
          closedAt
        },
        include: {
          pipelineStage: true,
          company: true,
          assignedTo: {
            select: { id: true, firstName: true, lastName: true, email: true }
          },
          lead: true,
          stageHistory: {
            orderBy: { enteredAt: 'asc' },
            include: {
              fromStage: { select: { id: true, name: true, order: true } },
              toStage: { select: { id: true, name: true, order: true } },
              user: { select: { id: true, firstName: true, lastName: true, email: true } }
            }
          }
        }
      });

      // 2. Append history entry
      await tx.dealStageHistory.create({
        data: {
          dealId: deal.id,
          fromStageId: deal.pipelineStageId,
          toStageId: targetStage.id,
          userId: user.id,
          transitionNote: transitionNote ? transitionNote.trim() : null
        }
      });

      return updated;
    });

    await AuditService.log({
      action: auditAction,
      entityType: 'Deal',
      entityId: deal.id,
      userId: user.id,
      metadata: {
        fromStageId: deal.pipelineStageId,
        fromStageName: deal.pipelineStage.name,
        toStageId: targetStage.id,
        toStageName: targetStage.name,
        status: newStatus,
        transitionNote: transitionNote || null
      }
    });

    if (deal.assignedToId) {
      try {
        await NotificationService.createNotification({
          userId: deal.assignedToId,
          type: 'DEAL_STAGE_CHANGED',
          title: auditAction === 'DEAL_WON' ? 'Deal Won!' : auditAction === 'DEAL_LOST' ? 'Deal Closed Lost' : 'Deal Stage Transitioned',
          message: `Deal "${deal.title}" moved from ${deal.pipelineStage.name} to ${targetStage.name}${auditAction === 'DEAL_WON' ? ` ($${Number(deal.value).toLocaleString()})` : ''}.`,
          metadata: {
            dealId: deal.id,
            fromStage: deal.pipelineStage.name,
            toStage: targetStage.name,
            status: newStatus,
            link: `/deals/${deal.id}`
          }
        });
      } catch (notifErr) {
        console.error(`[DealService] Notification error:`, notifErr.message);
      }
    }

    // Re-fetch deal with the newly added history item included
    return this.getDealById(id, user);
  }

  /**
   * Convert lead into a commercial opportunity deal.
   * Atomically sets lead status to CONVERTED and links deal.
   */
  static async convertLeadToDeal(leadId, data, user) {
    const prisma = getPrismaClient();

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: { company: true }
    });

    if (!lead) {
      const error = new Error('Lead not found');
      error.statusCode = 404;
      throw error;
    }

    if (lead.isArchived) {
      const error = new Error('Cannot convert an archived lead');
      error.statusCode = 400;
      throw error;
    }

    if (lead.status === 'CONVERTED') {
      const error = new Error('Lead has already been converted to a deal');
      error.statusCode = 400;
      throw error;
    }

    // RBAC: Rep can only convert their own or unassigned leads
    if (user.role === 'SALES_REPRESENTATIVE') {
      if (lead.assignedToId && lead.assignedToId !== user.id) {
        const error = new Error('Access denied: You can only convert leads assigned to you or unassigned');
        error.statusCode = 403;
        throw error;
      }
    }

    // Resolve company
    let companyId = data.companyId || lead.companyId;
    if (!companyId && data.companyName) {
      const existingCompany = await prisma.company.findFirst({
        where: { name: { equals: data.companyName.trim(), mode: 'insensitive' } }
      });
      if (existingCompany) {
        companyId = existingCompany.id;
      } else {
        const newCompany = await prisma.company.create({
          data: { name: data.companyName.trim() }
        });
        companyId = newCompany.id;
      }
    }

    // Resolve target pipeline stage (default to stage order 1 or provided)
    let stage;
    if (data.pipelineStageId) {
      stage = await prisma.pipelineStage.findUnique({ where: { id: data.pipelineStageId } });
      if (!stage) {
        const error = new Error('Specified pipeline stage does not exist');
        error.statusCode = 400;
        throw error;
      }
    } else {
      stage = await prisma.pipelineStage.findFirst({
        where: { isActive: true },
        orderBy: { order: 'asc' }
      });
      if (!stage) {
        const error = new Error('No active pipeline stage found');
        error.statusCode = 500;
        throw error;
      }
    }

    // Resolve assignee
    const assignedToId = data.assignedToId || lead.assignedToId || user.id;

    // Deal title fallback
    const dealTitle = data.title ? data.title.trim() : `${lead.firstName} ${lead.lastName} - Deal`;

    // Determine status from stage
    let dealStatus = 'OPEN';
    let closedAt = null;
    if (stage.name === 'Won' || stage.probability === 100) {
      dealStatus = 'WON';
      closedAt = new Date();
    } else if (stage.name === 'Lost' || (stage.probability === 0 && stage.name === 'Lost')) {
      dealStatus = 'LOST';
      closedAt = new Date();
    }

    const { deal, updatedLead } = await prisma.$transaction(async (tx) => {
      // 1. Update lead status to CONVERTED
      const updatedLead = await tx.lead.update({
        where: { id: lead.id },
        data: {
          status: 'CONVERTED',
          companyId: companyId || lead.companyId
        }
      });

      // 2. Create Deal
      const deal = await tx.deal.create({
        data: {
          title: dealTitle,
          value: parseFloat(data.value),
          currency: data.currency || 'USD',
          expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : null,
          closedAt,
          description: data.description ? data.description.trim() : `Converted from lead ${lead.firstName} ${lead.lastName}`,
          status: dealStatus,
          leadId: lead.id,
          companyId: companyId || null,
          assignedToId: assignedToId || null,
          pipelineStageId: stage.id
        },
        include: {
          pipelineStage: true,
          company: true,
          assignedTo: {
            select: { id: true, firstName: true, lastName: true, email: true }
          },
          lead: true
        }
      });

      // 3. Create initial DealStageHistory
      await tx.dealStageHistory.create({
        data: {
          dealId: deal.id,
          fromStageId: null,
          toStageId: stage.id,
          userId: user.id,
          transitionNote: data.transitionNote || 'Converted from Lead'
        }
      });

      return { deal, updatedLead };
    });

    // Record audit entries
    await Promise.all([
      AuditService.log({
        action: 'LEAD_CONVERTED',
        entityType: 'Lead',
        entityId: lead.id,
        userId: user.id,
        metadata: {
          dealId: deal.id,
          dealTitle: deal.title,
          dealValue: deal.value
        }
      }),
      AuditService.log({
        action: 'DEAL_CREATED',
        entityType: 'Deal',
        entityId: deal.id,
        userId: user.id,
        metadata: {
          leadId: lead.id,
          title: deal.title,
          value: deal.value,
          convertedFromLead: true
        }
      })
    ]);

    // Safely auto-dismiss any pending recommendations for the converted lead
    try {
      await RecommendationService.dismissPendingForLead(lead.id, 'Lead converted to deal', user);
    } catch (recErr) {
      console.error(`[RecommendationService] Failed to dismiss recommendations for converted lead ${lead.id}:`, recErr.message);
    }

    if (deal.assignedToId) {
      try {
        await NotificationService.createNotification({
          userId: deal.assignedToId,
          type: 'DEAL_STAGE_CHANGED',
          title: 'New Deal from Converted Lead',
          message: `Lead ${lead.firstName} ${lead.lastName} converted to Deal "${deal.title}" in stage ${stage.name}.`,
          metadata: {
            dealId: deal.id,
            leadId: lead.id,
            link: `/deals/${deal.id}`
          }
        });
      } catch (notifErr) {
        console.error(`[DealService] Notification error:`, notifErr.message);
      }
    }

    return {
      deal: {
        ...deal,
        value: Number(deal.value)
      },
      lead: updatedLead
    };
  }
}
