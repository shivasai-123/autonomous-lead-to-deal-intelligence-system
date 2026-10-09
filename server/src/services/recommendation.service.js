import { getPrismaClient } from '../config/prisma.js';
import {
  RECOMMENDATION_TYPES,
  RECOMMENDATION_STATUSES,
  RECOMMENDATION_RULES,
  FOLLOW_UP_THRESHOLD_DAYS,
  RECOMMENDATION_TTL_DAYS,
  ALLOWED_STATUS_TRANSITIONS
} from '../config/recommendation.config.js';
import { ScoringService } from './scoring.service.js';
import { AuditService } from './audit.service.js';
import { logger } from '../utils/logger.js';

export class RecommendationService {
  /**
   * Pure deterministic rule evaluation against actual CRM lead data, activities, and deals.
   *
   * @param {Object} lead - Full lead object with score and priority
   * @param {Array} activities - Lead activities array
   * @param {Array} deals - Lead deals array
   * @returns {Object|null} Evaluated recommendation object or null
   */
  static evaluateLeadRecommendation(lead, activities = [], deals = []) {
    // Ineligible checks: Archived or terminal commercial status
    if (lead.isArchived) {
      return null;
    }
    if (lead.status === 'CONVERTED' || lead.status === 'LOST') {
      return null;
    }

    // 1. Analyze activities
    const demoRequests = activities.filter((a) => a.type === 'DEMO_REQUEST');
    const pricingViews = activities.filter((a) => a.type === 'PRICING_PAGE_VIEW');
    const meetings = activities.filter((a) => a.type === 'MEETING');
    const calls = activities.filter((a) => a.type === 'CALL');
    const emailReplies = activities.filter((a) => a.type === 'EMAIL_REPLY');
    const directOutreach = activities.filter((a) =>
      ['CALL', 'MEETING', 'EMAIL_REPLY'].includes(a.type)
    );

    // 2. Check stalled status using scoring service logic
    const stalledInfo = ScoringService.detectStalledStatus(lead, activities);

    // 3. Check deals status
    const openDeals = deals.filter((d) => d.status === 'OPEN');
    const hasDemoOrAdvancedDeal = deals.some((d) =>
      ['Demo', 'Proposal', 'Negotiation', 'Won'].includes(d.pipelineStage?.name)
    );

    // ========================================================
    // RULE 1: SCHEDULE_DEMO (Precedence 1 - Highest Action Priority)
    // ========================================================
    if (demoRequests.length > 0) {
      // Find latest demo request
      const latestDemo = [...demoRequests].sort(
        (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
      )[0];

      // Check if a meeting occurred after this demo request
      const meetingAfterDemo = meetings.some(
        (m) => new Date(m.occurredAt).getTime() >= new Date(latestDemo.occurredAt).getTime()
      );

      if (!meetingAfterDemo && !hasDemoOrAdvancedDeal) {
        const demoDateStr = new Date(latestDemo.occurredAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
        return {
          type: RECOMMENDATION_TYPES.SCHEDULE_DEMO,
          title: RECOMMENDATION_RULES.SCHEDULE_DEMO.title,
          explanation: `Lead submitted a product demo request on ${demoDateStr} and has no scheduled demonstration meeting. Promptly book a walkthrough to capitalize on active buying intent.`,
          confidence: 0.95,
          metadata: {
            ruleId: RECOMMENDATION_RULES.SCHEDULE_DEMO.id,
            trigger: 'DEMO_REQUEST',
            demoRequestDate: latestDemo.occurredAt,
            leadScore: lead.score,
            leadPriority: lead.priority
          }
        };
      }
    }

    // Secondary SCHEDULE_DEMO trigger: Hot engagement with pricing interest but no demo
    if (lead.score >= 70 && pricingViews.length >= 1 && meetings.length === 0 && !hasDemoOrAdvancedDeal) {
      return {
        type: RECOMMENDATION_TYPES.SCHEDULE_DEMO,
        title: 'Offer Guided Product Demonstration',
        explanation: `Lead reached HOT engagement (${lead.score}/100) with repeated pricing page views, indicating strong commercial intent without a completed demo. Propose a guided demonstration.`,
        confidence: 0.90,
        metadata: {
          ruleId: RECOMMENDATION_RULES.SCHEDULE_DEMO.id,
          trigger: 'HOT_PRICING_INTEREST',
          leadScore: lead.score,
          pricingViewsCount: pricingViews.length,
          leadPriority: lead.priority
        }
      };
    }

    // ========================================================
    // RULE 2: REVIEW_STALLED_LEAD (Precedence 2)
    // ========================================================
    if (stalledInfo.isStalled) {
      return {
        type: RECOMMENDATION_TYPES.REVIEW_STALLED_LEAD,
        title: RECOMMENDATION_RULES.REVIEW_STALLED_LEAD.title,
        explanation: `No qualifying CRM activities recorded for ${stalledInfo.daysSinceLastActivity} days (exceeds ${stalledInfo.stalledThresholdDays}-day inactivity threshold). Review lead engagement history to launch re-engagement outreach or qualify out.`,
        confidence: 0.90,
        metadata: {
          ruleId: RECOMMENDATION_RULES.REVIEW_STALLED_LEAD.id,
          trigger: 'INACTIVITY_THRESHOLD_EXCEEDED',
          daysSinceLastActivity: stalledInfo.daysSinceLastActivity,
          thresholdDays: stalledInfo.stalledThresholdDays,
          leadScore: lead.score,
          leadPriority: lead.priority
        }
      };
    }

    // ========================================================
    // RULE 3: CONTACT_LEAD (Precedence 3)
    // ========================================================
    if (lead.status === 'NEW' && directOutreach.length === 0) {
      return {
        type: RECOMMENDATION_TYPES.CONTACT_LEAD,
        title: RECOMMENDATION_RULES.CONTACT_NEW_LEAD.title,
        explanation: `New inbound lead received with zero recorded outbound calls, meetings, or direct outreach. Initiate contact via phone or email to introduce solutions and assess qualification.`,
        confidence: 0.85,
        metadata: {
          ruleId: RECOMMENDATION_RULES.CONTACT_NEW_LEAD.id,
          trigger: 'NEW_UNCONTACTED_LEAD',
          leadScore: lead.score,
          leadStatus: lead.status,
          totalActivities: activities.length
        }
      };
    }

    // ========================================================
    // RULE 4: SEND_FOLLOW_UP (Precedence 4)
    // ========================================================
    if (
      ['CONTACTED', 'QUALIFIED'].includes(lead.status) &&
      directOutreach.length > 0 &&
      stalledInfo.daysSinceLastActivity >= FOLLOW_UP_THRESHOLD_DAYS
    ) {
      const lastContactStr = stalledInfo.lastActivityAt
        ? new Date(stalledInfo.lastActivityAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
          })
        : 'earlier outreach';

      return {
        type: RECOMMENDATION_TYPES.SEND_FOLLOW_UP,
        title: RECOMMENDATION_RULES.SEND_FOLLOW_UP.title,
        explanation: `${stalledInfo.daysSinceLastActivity} days have elapsed since the last touchpoint on ${lastContactStr}. Send a follow-up email or make a check-in call to maintain sales momentum.`,
        confidence: 0.80,
        metadata: {
          ruleId: RECOMMENDATION_RULES.SEND_FOLLOW_UP.id,
          trigger: 'FOLLOW_UP_INTERVAL_ELAPSED',
          daysSinceLastActivity: stalledInfo.daysSinceLastActivity,
          lastActivityAt: stalledInfo.lastActivityAt,
          leadScore: lead.score
        }
      };
    }

    // ========================================================
    // RULE 5: OTHER - Convert Lead to Pipeline Deal (Precedence 5)
    // ========================================================
    if (
      (lead.status === 'QUALIFIED' || lead.score >= 70) &&
      openDeals.length === 0
    ) {
      return {
        type: RECOMMENDATION_TYPES.OTHER,
        title: RECOMMENDATION_RULES.CONVERT_TO_DEAL.title,
        explanation: `Lead is qualified with high engagement score (${lead.score}/100) and verified interest, but has no active commercial deal in the pipeline. Convert lead to an open deal to initiate pipeline stage tracking.`,
        confidence: 0.82,
        metadata: {
          ruleId: RECOMMENDATION_RULES.CONVERT_TO_DEAL.id,
          trigger: 'QUALIFIED_WITHOUT_DEAL',
          leadScore: lead.score,
          leadStatus: lead.status,
          hasOpenDeals: false
        }
      };
    }

    return null;
  }

  /**
   * Idempotently evaluate, create, or update the Next-Best-Action recommendation for a lead.
   *
   * @param {string} leadId - Target Lead ID
   * @param {Object|null} user - Authenticated user triggering the action
   * @returns {Object} Result { leadId, recommendation, action }
   */
  static async generateOrUpdateRecommendation(leadId, user = null) {
    const prisma = getPrismaClient();

    // 1. Fetch full lead details with activities, deals, and recommendations
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        activities: { orderBy: { occurredAt: 'desc' } },
        deals: { include: { pipelineStage: true } },
        recommendations: { orderBy: { createdAt: 'desc' } }
      }
    });

    if (!lead) {
      return null;
    }

    // 2. Ineligible lead handling (Archived or Converted/Lost)
    if (lead.isArchived || lead.status === 'CONVERTED' || lead.status === 'LOST') {
      const pendingRecommendations = lead.recommendations.filter(
        (r) => r.status === RECOMMENDATION_STATUSES.PENDING
      );

      if (pendingRecommendations.length > 0) {
        const dismissReason = lead.isArchived
          ? 'Lead was archived'
          : `Lead entered terminal status (${lead.status})`;

        for (const rec of pendingRecommendations) {
          const updatedMeta = {
            ...(rec.metadata || {}),
            autoDismissedAt: new Date().toISOString(),
            autoDismissReason: dismissReason
          };

          await prisma.recommendation.update({
            where: { id: rec.id },
            data: {
              status: RECOMMENDATION_STATUSES.DISMISSED,
              metadata: updatedMeta
            }
          });

          await AuditService.log({
            action: 'RECOMMENDATION_DISMISSED',
            entityType: 'Recommendation',
            entityId: rec.id,
            userId: user?.id || null,
            metadata: {
              leadId: lead.id,
              previousStatus: 'PENDING',
              newStatus: 'DISMISSED',
              reason: dismissReason,
              automated: true
            }
          });
        }
      }

      return { leadId, recommendation: null, eligible: false };
    }

    // 3. Evaluate active rules
    const evaluation = this.evaluateLeadRecommendation(lead, lead.activities, lead.deals);

    const pendingRec = lead.recommendations.find(
      (r) => r.status === RECOMMENDATION_STATUSES.PENDING
    );

    // Case 3a: No recommendation triggered by rules
    if (!evaluation) {
      if (pendingRec) {
        // Obsolete pending recommendation dismissed because conditions resolved
        const updatedMeta = {
          ...(pendingRec.metadata || {}),
          autoDismissedAt: new Date().toISOString(),
          autoDismissReason: 'Conditions resolved by subsequent CRM activity'
        };

        const dismissed = await prisma.recommendation.update({
          where: { id: pendingRec.id },
          data: {
            status: RECOMMENDATION_STATUSES.DISMISSED,
            metadata: updatedMeta
          }
        });

        await AuditService.log({
          action: 'RECOMMENDATION_DISMISSED',
          entityType: 'Recommendation',
          entityId: dismissed.id,
          userId: user?.id || null,
          metadata: {
            leadId: lead.id,
            previousStatus: 'PENDING',
            newStatus: 'DISMISSED',
            reason: 'Conditions resolved',
            automated: true
          }
        });
      }

      return { leadId, recommendation: null, action: 'NONE' };
    }

    // Case 3b: Matching rule is already PENDING (Idempotent update)
    if (
      pendingRec &&
      pendingRec.type === evaluation.type &&
      pendingRec.metadata?.ruleId === evaluation.metadata.ruleId
    ) {
      // Update confidence and explanation if data refreshed, but keep same recommendation ID
      const updated = await prisma.recommendation.update({
        where: { id: pendingRec.id },
        data: {
          title: evaluation.title,
          explanation: evaluation.explanation,
          confidence: evaluation.confidence,
          metadata: {
            ...(pendingRec.metadata || {}),
            ...evaluation.metadata,
            lastEvaluatedAt: new Date().toISOString()
          }
        }
      });

      return { leadId, recommendation: updated, action: 'REUSED_EXISTING' };
    }

    // Case 3c: Different rule triggered -> Supersede old pending recommendation
    if (pendingRec) {
      const updatedOldMeta = {
        ...(pendingRec.metadata || {}),
        supersededBy: evaluation.metadata.ruleId,
        supersededAt: new Date().toISOString()
      };

      await prisma.recommendation.update({
        where: { id: pendingRec.id },
        data: {
          status: RECOMMENDATION_STATUSES.DISMISSED,
          metadata: updatedOldMeta
        }
      });

      await AuditService.log({
        action: 'RECOMMENDATION_DISMISSED',
        entityType: 'Recommendation',
        entityId: pendingRec.id,
        userId: user?.id || null,
        metadata: {
          leadId: lead.id,
          previousStatus: 'PENDING',
          newStatus: 'DISMISSED',
          supersededByRule: evaluation.metadata.ruleId,
          automated: true
        }
      });
    }

    // Create the new recommendation
    const expiresAt = new Date(Date.now() + RECOMMENDATION_TTL_DAYS * 24 * 60 * 60 * 1000);
    const newRecommendation = await prisma.recommendation.create({
      data: {
        leadId: lead.id,
        assignedToId: lead.assignedToId || null,
        type: evaluation.type,
        title: evaluation.title,
        explanation: evaluation.explanation,
        confidence: evaluation.confidence,
        status: RECOMMENDATION_STATUSES.PENDING,
        metadata: {
          ...evaluation.metadata,
          generatedAt: new Date().toISOString(),
          generatedByUserId: user?.id || null
        },
        expiresAt
      },
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            status: true,
            score: true,
            priority: true,
            company: { select: { id: true, name: true } }
          }
        },
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true }
        }
      }
    });

    // Record audit log for generation
    await AuditService.log({
      action: 'RECOMMENDATION_GENERATED',
      entityType: 'Recommendation',
      entityId: newRecommendation.id,
      userId: user?.id || null,
      metadata: {
        leadId: lead.id,
        type: newRecommendation.type,
        ruleId: evaluation.metadata.ruleId,
        confidence: newRecommendation.confidence
      }
    });

    return { leadId, recommendation: newRecommendation, action: 'CREATED' };
  }

  /**
   * List recommendations with RBAC scoping, filtering, search, and pagination.
   *
   * @param {Object} user - Authenticated user
   * @param {Object} query - Query parameters
   * @returns {Object} { data, pagination, metrics }
   */
  static async getRecommendations(user, query = {}) {
    const prisma = getPrismaClient();

    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const where = {};

    // 1. RBAC scoping: Sales Reps can only view recommendations on assigned or unassigned leads
    if (user.role === 'SALES_REPRESENTATIVE') {
      where.OR = [
        { assignedToId: user.id },
        { lead: { assignedToId: user.id } },
        { assignedToId: null, lead: { assignedToId: null } }
      ];
    }

    // Exclude archived leads by default
    where.lead = {
      ...(where.lead || {}),
      isArchived: false
    };

    // 2. Status filter
    if (query.status) {
      if (Array.isArray(query.status)) {
        where.status = { in: query.status };
      } else {
        where.status = query.status;
      }
    }

    // 3. Type filter
    if (query.type) {
      if (Array.isArray(query.type)) {
        where.type = { in: query.type };
      } else {
        where.type = query.type;
      }
    }

    // 4. Lead ID filter
    if (query.leadId) {
      where.leadId = query.leadId;
    }

    // 5. Search text (matches title, explanation, or lead name/company)
    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.AND = [
        {
          OR: [
            { title: { contains: term, mode: 'insensitive' } },
            { explanation: { contains: term, mode: 'insensitive' } },
            { lead: { firstName: { contains: term, mode: 'insensitive' } } },
            { lead: { lastName: { contains: term, mode: 'insensitive' } } },
            { lead: { email: { contains: term, mode: 'insensitive' } } },
            { lead: { company: { name: { contains: term, mode: 'insensitive' } } } }
          ]
        }
      ];
    }

    // Determine sorting
    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
    const orderBy = { [sortBy]: sortOrder };

    const [data, total] = await Promise.all([
      prisma.recommendation.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          lead: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              status: true,
              score: true,
              priority: true,
              company: { select: { id: true, name: true } },
              assignedTo: {
                select: { id: true, firstName: true, lastName: true, email: true }
              }
            }
          },
          assignedTo: {
            select: { id: true, firstName: true, lastName: true, email: true }
          }
        }
      }),
      prisma.recommendation.count({ where })
    ]);

    // Aggregate summary metrics within the user's RBAC scope
    const baseScope = {};
    if (user.role === 'SALES_REPRESENTATIVE') {
      baseScope.OR = [
        { assignedToId: user.id },
        { lead: { assignedToId: user.id } },
        { assignedToId: null, lead: { assignedToId: null } }
      ];
    }
    baseScope.lead = { isArchived: false };

    const [pendingCount, acceptedCount, executedCount, dismissedCount, highConfidenceCount] =
      await Promise.all([
        prisma.recommendation.count({
          where: { ...baseScope, status: RECOMMENDATION_STATUSES.PENDING }
        }),
        prisma.recommendation.count({
          where: { ...baseScope, status: RECOMMENDATION_STATUSES.ACCEPTED }
        }),
        prisma.recommendation.count({
          where: { ...baseScope, status: RECOMMENDATION_STATUSES.EXECUTED }
        }),
        prisma.recommendation.count({
          where: { ...baseScope, status: RECOMMENDATION_STATUSES.DISMISSED }
        }),
        prisma.recommendation.count({
          where: { ...baseScope, status: RECOMMENDATION_STATUSES.PENDING, confidence: { gte: 0.85 } }
        })
      ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      },
      metrics: {
        totalPending: pendingCount,
        totalAccepted: acceptedCount,
        totalExecuted: executedCount,
        totalDismissed: dismissedCount,
        highConfidenceCount
      }
    };
  }

  /**
   * Retrieve a single recommendation by ID with RBAC boundary checks.
   *
   * @param {string} id - Recommendation UUID
   * @param {Object} user - Authenticated user
   * @returns {Object} Recommendation record
   */
  static async getRecommendationById(id, user) {
    const prisma = getPrismaClient();

    const recommendation = await prisma.recommendation.findUnique({
      where: { id },
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            status: true,
            score: true,
            priority: true,
            isArchived: true,
            company: { select: { id: true, name: true } },
            assignedTo: {
              select: { id: true, firstName: true, lastName: true, email: true }
            }
          }
        },
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true }
        }
      }
    });

    if (!recommendation) {
      const error = new Error(`Recommendation with ID "${id}" was not found`);
      error.statusCode = 404;
      throw error;
    }

    // RBAC check for Sales Representatives
    if (user.role === 'SALES_REPRESENTATIVE') {
      const isAssigned =
        recommendation.assignedToId === user.id ||
        recommendation.lead.assignedTo?.id === user.id;
      const isUnassigned =
        !recommendation.assignedToId && !recommendation.lead.assignedTo;

      if (!isAssigned && !isUnassigned) {
        const error = new Error('You do not have permission to view this recommendation');
        error.statusCode = 403;
        throw error;
      }
    }

    return recommendation;
  }

  /**
   * Get all recommendations for a specific lead.
   *
   * @param {string} leadId - Lead UUID
   * @param {Object} user - Authenticated user
   * @returns {Array} List of recommendations
   */
  static async getLeadRecommendations(leadId, user) {
    const prisma = getPrismaClient();

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, assignedToId: true, isArchived: true }
    });

    if (!lead) {
      const error = new Error(`Lead with ID "${leadId}" was not found`);
      error.statusCode = 404;
      throw error;
    }

    // RBAC check
    if (user.role === 'SALES_REPRESENTATIVE') {
      if (lead.assignedToId && lead.assignedToId !== user.id) {
        const error = new Error('You do not have permission to view recommendations for this lead');
        error.statusCode = 403;
        throw error;
      }
    }

    const recommendations = await prisma.recommendation.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
      include: {
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true }
        }
      }
    });

    return recommendations;
  }

  /**
   * Update recommendation status following the validated lifecycle state machine.
   *
   * @param {string} id - Recommendation UUID
   * @param {string} newStatus - 'ACCEPTED' | 'DISMISSED' | 'EXECUTED' | 'PENDING'
   * @param {Object} user - Authenticated user performing the update
   * @param {Object} [details] - Optional note or reason
   * @returns {Object} Updated recommendation
   */
  static async updateRecommendationStatus(id, newStatus, user, { reason = null } = {}) {
    const prisma = getPrismaClient();

    const existing = await this.getRecommendationById(id, user);

    // Validate state machine transition
    const allowedNext = ALLOWED_STATUS_TRANSITIONS[existing.status] || [];
    if (!allowedNext.includes(newStatus)) {
      const error = new Error(
        `Invalid status transition from "${existing.status}" to "${newStatus}". Allowed transitions: [${allowedNext.join(', ')}]`
      );
      error.statusCode = 400;
      throw error;
    }

    // Update metadata with transition history
    const historyEntry = {
      fromStatus: existing.status,
      toStatus: newStatus,
      updatedAt: new Date().toISOString(),
      updatedByUserId: user.id,
      reason: reason ? String(reason).trim() : null
    };

    const statusHistory = Array.isArray(existing.metadata?.statusHistory)
      ? [...existing.metadata.statusHistory, historyEntry]
      : [historyEntry];

    const updatedMetadata = {
      ...(existing.metadata || {}),
      statusHistory,
      lastStatusUpdate: historyEntry
    };

    const updated = await prisma.recommendation.update({
      where: { id },
      data: {
        status: newStatus,
        metadata: updatedMetadata
      },
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            status: true,
            score: true,
            priority: true,
            company: { select: { id: true, name: true } }
          }
        },
        assignedTo: {
          select: { id: true, firstName: true, lastName: true, email: true }
        }
      }
    });

    // Map audit action
    const auditActions = {
      ACCEPTED: 'RECOMMENDATION_ACCEPTED',
      DISMISSED: 'RECOMMENDATION_DISMISSED',
      EXECUTED: 'RECOMMENDATION_EXECUTED',
      PENDING: 'RECOMMENDATION_RESET'
    };

    const action = auditActions[newStatus] || 'RECOMMENDATION_UPDATED';

    await AuditService.log({
      action,
      entityType: 'Recommendation',
      entityId: id,
      userId: user.id,
      metadata: {
        leadId: existing.leadId,
        previousStatus: existing.status,
        newStatus,
        reason
      }
    });

    return updated;
  }

  /**
   * Batch refresh recommendations across all active, non-archived leads in the CRM.
   * Restricted to Admin and Sales Manager roles.
   *
   * @param {Object} user - Authenticated user
   * @returns {Object} Batch execution summary
   */
  static async batchRefreshRecommendations(user) {
    if (user.role === 'SALES_REPRESENTATIVE') {
      const error = new Error('Access denied: Only Admins and Sales Managers can execute batch recommendation refreshes');
      error.statusCode = 403;
      throw error;
    }

    const prisma = getPrismaClient();

    // Query active leads
    const activeLeads = await prisma.lead.findMany({
      where: {
        isArchived: false,
        status: { notIn: ['CONVERTED', 'LOST'] }
      },
      select: { id: true }
    });

    let generatedCount = 0;
    let reusedCount = 0;
    let errorsCount = 0;

    for (const lead of activeLeads) {
      try {
        const result = await this.generateOrUpdateRecommendation(lead.id, user);
        if (result?.action === 'CREATED') generatedCount++;
        if (result?.action === 'REUSED_EXISTING') reusedCount++;
      } catch (err) {
        errorsCount++;
        logger.warn(`Batch recommendation evaluation error on lead ${lead.id}: ${err.message}`);
      }
    }

    await AuditService.log({
      action: 'BATCH_RECOMMENDATIONS_REFRESHED',
      entityType: 'Recommendation',
      entityId: user.id,
      userId: user.id,
      metadata: {
        totalProcessed: activeLeads.length,
        generatedCount,
        reusedCount,
        errorsCount,
        timestamp: new Date().toISOString()
      }
    });

    return {
      success: true,
      totalProcessed: activeLeads.length,
      generatedCount,
      reusedCount,
      errorsCount,
      message: `Batch recommendation evaluation completed across ${activeLeads.length} leads.`
    };
  }

  /**
   * Auto-dismiss any active pending recommendations for a converted or archived lead.
   *
   * @param {string} leadId - Lead UUID
   * @param {string} reason - Dismissal explanation
   * @param {Object} user - Actor
   */
  static async dismissPendingForLead(leadId, reason = 'Lead converted or archived', user = null) {
    const prisma = getPrismaClient();

    const pending = await prisma.recommendation.findMany({
      where: {
        leadId,
        status: RECOMMENDATION_STATUSES.PENDING
      }
    });

    for (const rec of pending) {
      const updatedMeta = {
        ...(rec.metadata || {}),
        autoDismissedAt: new Date().toISOString(),
        autoDismissReason: reason
      };

      await prisma.recommendation.update({
        where: { id: rec.id },
        data: {
          status: RECOMMENDATION_STATUSES.DISMISSED,
          metadata: updatedMeta
        }
      });

      await AuditService.log({
        action: 'RECOMMENDATION_DISMISSED',
        entityType: 'Recommendation',
        entityId: rec.id,
        userId: user?.id || null,
        metadata: {
          leadId,
          previousStatus: 'PENDING',
          newStatus: 'DISMISSED',
          reason,
          automated: true
        }
      });
    }
  }
}

export default RecommendationService;
