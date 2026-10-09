import { getPrismaClient } from '../config/prisma.js';
import {
  ACTIVITY_WEIGHTS,
  ACTIVITY_CAPS,
  SCORE_BOUNDS,
  STALLED_THRESHOLD_DAYS,
  classifyScore,
  scoreToPriority
} from '../config/scoring.config.js';
import { AuditService } from './audit.service.js';

export class ScoringService {
  /**
   * Calculate deterministic score and structured explanation from an array of lead activities.
   *
   * @param {Array} activities - List of LeadActivity records
   * @returns {Object} Calculated intelligence breakdown
   */
  static calculateScoreFromActivities(activities = []) {
    // Group activities by type
    const grouped = {};
    for (const key of Object.keys(ACTIVITY_WEIGHTS)) {
      grouped[key] = [];
    }

    for (const act of activities) {
      if (grouped[act.type]) {
        grouped[act.type].push(act);
      } else {
        grouped.OTHER.push(act);
      }
    }

    const contributions = [];
    const reasons = [];
    let rawTotal = 0;
    let cappedTotal = 0;

    for (const [type, acts] of Object.entries(grouped)) {
      const count = acts.length;
      if (count === 0) continue;

      const weight = ACTIVITY_WEIGHTS[type] || 0;
      const rawPoints = count * weight;
      const capConfig = ACTIVITY_CAPS[type];
      const maxPoints = capConfig ? capConfig.maxPoints : rawPoints;
      const points = Math.min(rawPoints, maxPoints);
      const isCapped = rawPoints > points;
      const label = capConfig ? capConfig.label : type;

      rawTotal += rawPoints;
      cappedTotal += points;

      contributions.push({
        type,
        label,
        count,
        weight,
        rawPoints,
        points,
        maxPoints,
        isCapped
      });

      if (points > 0) {
        if (isCapped) {
          reasons.push(`${label} (${count}x, capped at ${points} pts)`);
        } else {
          reasons.push(`${label} (${count}x, +${points} pts)`);
        }
      }
    }

    // Clamp score strictly between 0 and 100
    const score = Math.min(SCORE_BOUNDS.MAX, Math.max(SCORE_BOUNDS.MIN, cappedTotal));
    const classification = classifyScore(score);
    const priority = scoreToPriority(score);

    // Human-readable summary
    let summaryText;
    if (score === 0) {
      summaryText = 'Baseline qualification score (0/100). No qualifying engagement activities recorded yet.';
    } else {
      const topReasons = reasons.slice(0, 3).join(', ');
      summaryText = `${classification} engagement (${score}/100, ${priority} priority). Driven by ${topReasons}${reasons.length > 3 ? ` and ${reasons.length - 3} other signals` : ''}.`;
    }

    return {
      score,
      rawTotal,
      cappedTotal,
      classification,
      priority,
      contributions,
      reasons,
      summaryText
    };
  }

  /**
   * Determine whether a lead is stalled based on real database activity timestamps.
   *
   * @param {Object} lead - Lead database record
   * @param {Array} activities - List of LeadActivity records
   * @returns {Object} Stalled status details
   */
  static detectStalledStatus(lead, activities = []) {
    // Exclude archived leads
    if (lead.isArchived) {
      return {
        isStalled: false,
        daysSinceLastActivity: 0,
        lastActivityAt: null,
        stalledThresholdDays: STALLED_THRESHOLD_DAYS,
        reason: 'Archived leads are excluded from stalled tracking'
      };
    }

    // Exclude terminal commercial statuses (CONVERTED, LOST)
    if (lead.status === 'CONVERTED' || lead.status === 'LOST') {
      return {
        isStalled: false,
        daysSinceLastActivity: 0,
        lastActivityAt: null,
        stalledThresholdDays: STALLED_THRESHOLD_DAYS,
        reason: `Lead is in terminal status (${lead.status})`
      };
    }

    let lastActivityAt = null;
    if (activities.length > 0) {
      // Find latest activity date
      const sorted = [...activities].sort(
        (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
      );
      lastActivityAt = sorted[0].occurredAt;
    }

    const referenceDate = lastActivityAt ? new Date(lastActivityAt) : new Date(lead.createdAt);
    const now = new Date();
    const diffMs = Math.max(0, now.getTime() - referenceDate.getTime());
    const daysSinceLastActivity = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    const isStalled = daysSinceLastActivity >= STALLED_THRESHOLD_DAYS;

    return {
      isStalled,
      daysSinceLastActivity,
      lastActivityAt,
      stalledThresholdDays: STALLED_THRESHOLD_DAYS,
      reason: isStalled
        ? `No qualifying activity in ${daysSinceLastActivity} days (threshold: ${STALLED_THRESHOLD_DAYS} days)`
        : `Active within configured ${STALLED_THRESHOLD_DAYS}-day threshold`
    };
  }

  /**
   * Recalculate lead score from all persisted activities, sync priority,
   * write score history if changed, and record audit logs.
   *
   * @param {string} leadId - Target Lead ID
   * @param {Object} user - Authenticated user performing/triggering action
   * @param {Object} options - { causalActivityId, client }
   * @returns {Object} Updated intelligence profile
   */
  static async recalculateLeadScore(leadId, user = null, { causalActivityId = null, client = null } = {}) {
    const prisma = client || getPrismaClient();

    // 1. Fetch lead with all activities and latest score history
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        activities: {
          orderBy: { occurredAt: 'desc' }
        },
        scoreHistory: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    if (!lead) {
      const error = new Error(`Lead with ID "${leadId}" was not found`);
      error.statusCode = 404;
      throw error;
    }

    if (user && user.role === 'SALES_REPRESENTATIVE') {
      if (lead.assignedToId && lead.assignedToId !== user.id) {
        const error = new Error('You do not have permission to recalculate score for this lead');
        error.statusCode = 403;
        throw error;
      }
    }

    // 2. Compute score and stalled metrics
    const calculation = this.calculateScoreFromActivities(lead.activities);
    const stalledInfo = this.detectStalledStatus(lead, lead.activities);

    const oldScore = lead.score;
    const newScore = calculation.score;
    const oldPriority = lead.priority;
    const newPriority = calculation.priority;

    const hasPriorHistory = lead.scoreHistory.length > 0;
    const scoreChanged = oldScore !== newScore;
    const priorityChanged = oldPriority !== newPriority;
    const shouldRecordSnapshot = !hasPriorHistory || scoreChanged;

    let updatedLead = lead;
    let scoreHistoryEntry = null;

    // 3. Atomically update Lead and persist history if score changed or initial
    if (scoreChanged || priorityChanged || shouldRecordSnapshot) {
      const updateData = {
        score: newScore,
        priority: newPriority
      };

      const result = await prisma.$transaction(async (tx) => {
        const uLead = await tx.lead.update({
          where: { id: lead.id },
          data: updateData
        });

        let sEntry = null;
        if (shouldRecordSnapshot) {
          sEntry = await tx.leadScore.create({
            data: {
              leadId: lead.id,
              score: newScore,
              reason: calculation.summaryText,
              sourceActivityId: causalActivityId || null,
              breakdown: {
                components: calculation.contributions,
                previousScore: oldScore,
                newScore,
                classification: calculation.classification,
                priority: newPriority,
                reasons: calculation.reasons
              }
            }
          });
        }

        return { uLead, sEntry };
      });

      updatedLead = result.uLead;
      scoreHistoryEntry = result.sEntry;

      // 4. Record audit logs for meaningful intelligence changes
      if (scoreChanged || priorityChanged) {
        await AuditService.log({
          action: 'LEAD_SCORE_CHANGED',
          entityType: 'Lead',
          entityId: lead.id,
          userId: user?.id || null,
          metadata: {
            oldScore,
            newScore,
            scoreDelta: newScore - oldScore,
            oldPriority,
            newPriority,
            classification: calculation.classification,
            causalActivityId
          }
        });
      }
    }

    return {
      leadId: lead.id,
      score: newScore,
      previousScore: oldScore,
      scoreDelta: newScore - oldScore,
      scoreChanged,
      classification: calculation.classification,
      priority: newPriority,
      priorityChanged,
      isStalled: stalledInfo.isStalled,
      daysSinceLastActivity: stalledInfo.daysSinceLastActivity,
      lastActivityAt: stalledInfo.lastActivityAt,
      stalledThresholdDays: stalledInfo.stalledThresholdDays,
      contributions: calculation.contributions,
      reasons: calculation.reasons,
      summaryText: calculation.summaryText,
      scoreHistoryEntry
    };
  }

  /**
   * Retrieve full explainable intelligence profile for a lead.
   *
   * @param {string} leadId - Lead ID
   * @param {Object} user - Authenticated user context
   * @returns {Object} Intelligence profile
   */
  static async getLeadIntelligence(leadId, user) {
    const prisma = getPrismaClient();

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      include: {
        activities: {
          orderBy: { occurredAt: 'desc' },
          take: 50
        },
        scoreHistory: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });

    if (!lead) {
      const error = new Error(`Lead with ID "${leadId}" was not found`);
      error.statusCode = 404;
      throw error;
    }

    // RBAC: Sales Reps can only view assigned or unassigned leads
    if (user.role === 'SALES_REPRESENTATIVE') {
      if (lead.assignedToId && lead.assignedToId !== user.id) {
        const error = new Error('You do not have permission to view intelligence for this lead');
        error.statusCode = 403;
        throw error;
      }
    }

    const calculation = this.calculateScoreFromActivities(lead.activities);
    const stalledInfo = this.detectStalledStatus(lead, lead.activities);

    const latestHistory = lead.scoreHistory[0] || null;
    const previousHistory = lead.scoreHistory[1] || null;
    const scoreChange = previousHistory ? latestHistory.score - previousHistory.score : 0;

    return {
      leadId: lead.id,
      score: lead.score,
      classification: calculation.classification,
      priority: lead.priority,
      scoreChange,
      isStalled: stalledInfo.isStalled,
      daysSinceLastActivity: stalledInfo.daysSinceLastActivity,
      lastActivityAt: stalledInfo.lastActivityAt,
      stalledThresholdDays: stalledInfo.stalledThresholdDays,
      stalledReason: stalledInfo.reason,
      summaryText: calculation.summaryText,
      contributions: calculation.contributions,
      reasons: calculation.reasons,
      recentHistory: lead.scoreHistory
    };
  }

  /**
   * Batch recalculate intelligence for all active leads.
   * Restricted to ADMIN and SALES_MANAGER.
   *
   * @param {Object} user - Authenticated user (Admin/Manager)
   * @returns {Object} Batch recalculation results
   */
  static async batchRecalculateScores(user) {
    const prisma = getPrismaClient();

    const leads = await prisma.lead.findMany({
      where: { isArchived: false },
      select: { id: true, email: true, score: true, priority: true }
    });

    let updatedCount = 0;
    let unchangedCount = 0;
    const errors = [];

    for (const lead of leads) {
      try {
        const result = await this.recalculateLeadScore(lead.id, user);
        if (result.scoreChanged || result.priorityChanged) {
          updatedCount++;
        } else {
          unchangedCount++;
        }
      } catch (err) {
        errors.push({ leadId: lead.id, error: err.message });
      }
    }

    await AuditService.log({
      action: 'BATCH_SCORES_RECALCULATED',
      entityType: 'System',
      entityId: 'global',
      userId: user.id,
      metadata: {
        totalProcessed: leads.length,
        updatedCount,
        unchangedCount,
        errorCount: errors.length
      }
    });

    return {
      totalProcessed: leads.length,
      updatedCount,
      unchangedCount,
      errorCount: errors.length,
      errors
    };
  }

  /**
   * Retrieve complete chronological score history for a lead.
   *
   * @param {string} leadId - Lead ID
   * @param {Object} user - Authenticated user context
   * @returns {Array} List of LeadScore history entries
   */
  static async getScoreHistory(leadId, user) {
    const prisma = getPrismaClient();

    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { id: true, assignedToId: true }
    });

    if (!lead) {
      const error = new Error(`Lead with ID "${leadId}" was not found`);
      error.statusCode = 404;
      throw error;
    }

    if (user && user.role === 'SALES_REPRESENTATIVE') {
      if (lead.assignedToId && lead.assignedToId !== user.id) {
        const error = new Error('You do not have permission to view score history for this lead');
        error.statusCode = 403;
        throw error;
      }
    }

    const history = await prisma.leadScore.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
      include: {
        sourceActivity: {
          select: {
            id: true,
            type: true,
            description: true,
            occurredAt: true
          }
        }
      }
    });

    return history;
  }
}

export default ScoringService;
