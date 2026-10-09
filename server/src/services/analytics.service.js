import { getPrismaClient } from '../config/prisma.js';
import { ScoringService } from './scoring.service.js';

export class AnalyticsService {
  /**
   * Helper to parse date filter boundaries.
   *
   * @param {string} [range='30d'] - '7d', '30d', '90d', 'month', 'all', 'custom'
   * @param {string} [startDate] - ISO date string for custom range
   * @param {string} [endDate] - ISO date string for custom range
   * @returns {{ start: Date|null, end: Date, label: string }}
   */
  static parseDateRange(range = '30d', startDate, endDate) {
    const end = new Date();
    let start = null;
    let label = 'Last 30 Days';

    switch (range) {
      case '7d':
        start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
        label = 'Last 7 Days';
        break;
      case '30d':
        start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        label = 'Last 30 Days';
        break;
      case '90d':
        start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
        label = 'Last 90 Days';
        break;
      case 'month':
        start = new Date(end.getFullYear(), end.getMonth(), 1);
        label = 'Current Month';
        break;
      case 'all':
        start = null;
        label = 'All Time';
        break;
      case 'custom':
        if (startDate) {
          start = new Date(startDate);
        }
        if (endDate) {
          end.setTime(new Date(endDate).getTime());
        }
        label = 'Custom Range';
        break;
      default:
        start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        label = 'Last 30 Days';
    }

    return { start, end, label };
  }

  /**
   * Helper to build role-scoped Prisma where clauses for leads.
   */
  static getLeadScope(user, dateBounds = null) {
    const where = { isArchived: false };

    if (user.role === 'SALES_REPRESENTATIVE') {
      where.OR = [
        { assignedToId: user.id },
        { assignedToId: null }
      ];
    }

    if (dateBounds && dateBounds.start) {
      where.createdAt = {
        gte: dateBounds.start,
        lte: dateBounds.end
      };
    }

    return where;
  }

  /**
   * Helper to build role-scoped Prisma where clauses for deals.
   */
  static getDealScope(user, dateBounds = null) {
    const where = {};

    if (user.role === 'SALES_REPRESENTATIVE') {
      where.OR = [
        { assignedToId: user.id },
        { assignedToId: null }
      ];
    }

    if (dateBounds && dateBounds.start) {
      where.createdAt = {
        gte: dateBounds.start,
        lte: dateBounds.end
      };
    }

    return where;
  }

  /**
   * Main Overview KPIs (Executive & Team-Level).
   *
   * @param {Object} user - Authenticated user
   * @param {Object} query - { range, startDate, endDate }
   * @returns {Promise<Object>} Aggregated metrics
   */
  static async getOverviewMetrics(user, query = {}) {
    const prisma = getPrismaClient();
    const dateBounds = this.parseDateRange(query.range, query.startDate, query.endDate);

    // 1. Fetch leads in scope
    const leadWhere = this.getLeadScope(user);
    const leads = await prisma.lead.findMany({
      where: leadWhere,
      include: {
        activities: {
          orderBy: { occurredAt: 'desc' },
          take: 1
        }
      }
    });

    // 2. Fetch deals in scope
    const dealWhere = this.getDealScope(user);
    const deals = await prisma.deal.findMany({
      where: dealWhere,
      include: {
        pipelineStage: {
          select: { id: true, name: true, probability: true, order: true }
        }
      }
    });

    // Calculate Lead Metrics
    const totalActiveLeads = leads.length;
    const newLeadsInPeriod = dateBounds.start
      ? leads.filter((l) => new Date(l.createdAt) >= dateBounds.start && new Date(l.createdAt) <= dateBounds.end).length
      : totalActiveLeads;

    const hotLeadsCount = leads.filter((l) => (l.score || 0) >= 70).length;
    const warmLeadsCount = leads.filter((l) => (l.score || 0) >= 40 && (l.score || 0) < 70).length;
    const coldLeadsCount = leads.filter((l) => (l.score || 0) < 40).length;

    let stalledLeadsCount = 0;
    for (const lead of leads) {
      if (lead.status !== 'CONVERTED' && lead.status !== 'LOST') {
        const stalled = ScoringService.detectStalledStatus(lead, lead.activities);
        if (stalled.isStalled) {
          stalledLeadsCount++;
        }
      }
    }

    const convertedLeadsCount = leads.filter((l) => l.status === 'CONVERTED').length;
    const leadConversionRate = totalActiveLeads > 0
      ? Number(((convertedLeadsCount / totalActiveLeads) * 100).toFixed(2))
      : 0;

    // Calculate Deal Metrics
    const openDeals = deals.filter((d) => d.status === 'OPEN');
    const wonDeals = deals.filter((d) => d.status === 'WON');
    const lostDeals = deals.filter((d) => d.status === 'LOST');

    const totalOpenDeals = openDeals.length;
    const totalOpenPipelineValue = openDeals.reduce((sum, d) => sum + Number(d.value || 0), 0);
    const weightedPipelineValue = openDeals.reduce((sum, d) => {
      const prob = d.pipelineStage?.probability ?? 0;
      return sum + (Number(d.value || 0) * (prob / 100));
    }, 0);

    const wonDealsCount = wonDeals.length;
    const wonDealValue = wonDeals.reduce((sum, d) => sum + Number(d.value || 0), 0);
    const lostDealsCount = lostDeals.length;

    const closedDealsCount = wonDealsCount + lostDealsCount;
    const winRate = closedDealsCount > 0
      ? Number(((wonDealsCount / closedDealsCount) * 100).toFixed(2))
      : 0;

    const allPricedDeals = [...openDeals, ...wonDeals];
    const averageDealValue = allPricedDeals.length > 0
      ? Number((allPricedDeals.reduce((sum, d) => sum + Number(d.value || 0), 0) / allPricedDeals.length).toFixed(2))
      : 0;

    // Calculate Sales Cycle (Average days from createdAt to closedAt for closed deals)
    let totalSalesCycleDays = 0;
    let closedWithDatesCount = 0;
    for (const deal of [...wonDeals, ...lostDeals]) {
      if (deal.closedAt && deal.createdAt) {
        const cycleDays = Math.max(0, (new Date(deal.closedAt) - new Date(deal.createdAt)) / (1000 * 60 * 60 * 24));
        totalSalesCycleDays += cycleDays;
        closedWithDatesCount++;
      }
    }
    const averageSalesCycleDays = closedWithDatesCount > 0
      ? Number((totalSalesCycleDays / closedWithDatesCount).toFixed(1))
      : 0;

    return {
      dateRange: dateBounds.label,
      leads: {
        activeLeads: totalActiveLeads,
        totalActiveLeads,
        newLeadsInPeriod,
        hotLeads: hotLeadsCount,
        hotLeadsCount,
        warmLeads: warmLeadsCount,
        warmLeadsCount,
        coldLeads: coldLeadsCount,
        coldLeadsCount,
        stalledLeads: stalledLeadsCount,
        stalledLeadsCount,
        convertedLeadsCount,
        leadConversionRate
      },
      deals: {
        openDeals: totalOpenDeals,
        totalOpenDeals,
        openPipelineValue: Number(totalOpenPipelineValue.toFixed(2)),
        totalOpenPipelineValue: Number(totalOpenPipelineValue.toFixed(2)),
        weightedPipelineValue: Number(weightedPipelineValue.toFixed(2)),
        wonDeals: wonDealsCount,
        wonDealsCount,
        wonDealValue: Number(wonDealValue.toFixed(2)),
        lostDeals: lostDealsCount,
        lostDealsCount,
        winRate,
        avgDealValue: averageDealValue,
        averageDealValue,
        avgSalesCycleDays: averageSalesCycleDays,
        averageSalesCycleDays
      }
    };
  }

  /**
   * Conversion Funnel progression analytics.
   */
  static async getConversionFunnel(user) {
    const prisma = getPrismaClient();
    const leadWhere = this.getLeadScope(user);
    const dealWhere = this.getDealScope(user);

    const [allLeads, allDeals] = await Promise.all([
      prisma.lead.findMany({ where: leadWhere, select: { status: true } }),
      prisma.deal.findMany({ where: dealWhere, select: { status: true } })
    ]);

    const totalLeads = allLeads.length;
    const contacted = allLeads.filter((l) => ['CONTACTED', 'QUALIFIED', 'CONVERTED'].includes(l.status)).length;
    const qualified = allLeads.filter((l) => ['QUALIFIED', 'CONVERTED'].includes(l.status)).length;
    const opportunities = allDeals.length;
    const won = allDeals.filter((d) => d.status === 'WON').length;

    const funnel = [
      {
        stage: 'All Leads',
        step: '1. All Leads',
        count: totalLeads,
        conversionRate: 100,
        rate: 100
      },
      {
        stage: 'Contacted',
        step: '2. Contacted',
        count: contacted,
        conversionRate: totalLeads > 0 ? Number(((contacted / totalLeads) * 100).toFixed(1)) : 0,
        rate: totalLeads > 0 ? Number(((contacted / totalLeads) * 100).toFixed(1)) : 0
      },
      {
        stage: 'Qualified',
        step: '3. Qualified',
        count: qualified,
        conversionRate: totalLeads > 0 ? Number(((qualified / totalLeads) * 100).toFixed(1)) : 0,
        rate: totalLeads > 0 ? Number(((qualified / totalLeads) * 100).toFixed(1)) : 0
      },
      {
        stage: 'Deals Created',
        step: '4. Deals Created',
        count: opportunities,
        conversionRate: totalLeads > 0 ? Number(((opportunities / totalLeads) * 100).toFixed(1)) : 0,
        rate: totalLeads > 0 ? Number(((opportunities / totalLeads) * 100).toFixed(1)) : 0
      },
      {
        stage: 'Deals Won',
        step: '5. Deals Won',
        count: won,
        conversionRate: totalLeads > 0 ? Number(((won / totalLeads) * 100).toFixed(1)) : 0,
        rate: totalLeads > 0 ? Number(((won / totalLeads) * 100).toFixed(1)) : 0
      }
    ];

    return { funnel };
  }

  /**
   * Pipeline Stage distribution (Counts & Volume per stage).
   */
  static async getPipelineDistribution(user) {
    const prisma = getPrismaClient();

    const stages = await prisma.pipelineStage.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: { id: true, name: true, probability: true, order: true }
    });

    const dealWhere = this.getDealScope(user);
    dealWhere.status = 'OPEN';

    const openDeals = await prisma.deal.findMany({
      where: dealWhere,
      select: { pipelineStageId: true, value: true }
    });

    const distribution = stages.map((stage) => {
      const stageDeals = openDeals.filter((d) => d.pipelineStageId === stage.id);
      const count = stageDeals.length;
      const totalValue = stageDeals.reduce((sum, d) => sum + Number(d.value || 0), 0);
      const weightedValue = totalValue * (stage.probability / 100);

      return {
        stageId: stage.id,
        stageName: stage.name,
        order: stage.order,
        probability: stage.probability,
        dealCount: count,
        value: Number(totalValue.toFixed(2)),
        totalValue: Number(totalValue.toFixed(2)),
        weightedValue: Number(weightedValue.toFixed(2))
      };
    });

    return { distribution };
  }

  /**
   * Historical Sales Trends (Monthly aggregation over last 6 months).
   */
  static async getSalesTrends(user) {
    const prisma = getPrismaClient();
    const dealWhere = this.getDealScope(user);

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    dealWhere.createdAt = { gte: sixMonthsAgo };

    const deals = await prisma.deal.findMany({
      where: dealWhere,
      select: { createdAt: true, status: true, value: true, closedAt: true }
    });

    // Bucket into month labels
    const monthBuckets = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString('default', { month: 'short' });
      monthBuckets.push({
        label,
        year: d.getFullYear(),
        month: d.getMonth(),
        createdCount: 0,
        wonCount: 0,
        wonValue: 0,
        lostCount: 0
      });
    }

    deals.forEach((deal) => {
      const createdDate = new Date(deal.createdAt);
      const bucket = monthBuckets.find(
        (b) => b.year === createdDate.getFullYear() && b.month === createdDate.getMonth()
      );

      if (bucket) {
        bucket.createdCount++;
        if (deal.status === 'WON') {
          bucket.wonCount++;
          bucket.wonValue += Number(deal.value || 0);
        } else if (deal.status === 'LOST') {
          bucket.lostCount++;
        }
      }
    });

    const trends = monthBuckets.map((b) => ({
      period: b.label,
      createdDeals: b.createdCount,
      wonDeals: b.wonCount,
      wonValue: Number(b.wonValue.toFixed(2)),
      lostDeals: b.lostCount
    }));

    return { trends };
  }

  /**
   * Lead Source Distribution & Conversion by Channel.
   */
  static async getLeadSourcePerformance(user) {
    const prisma = getPrismaClient();
    const leadWhere = this.getLeadScope(user);

    const leads = await prisma.lead.findMany({
      where: leadWhere,
      select: { source: true, status: true }
    });

    const sourceMap = new Map();

    leads.forEach((l) => {
      const source = l.source || 'Direct / Unspecified';
      if (!sourceMap.has(source)) {
        sourceMap.set(source, { source, total: 0, qualified: 0, converted: 0 });
      }
      const item = sourceMap.get(source);
      item.total++;
      if (['QUALIFIED', 'CONVERTED'].includes(l.status)) {
        item.qualified++;
      }
      if (l.status === 'CONVERTED') {
        item.converted++;
      }
    });

    const sources = Array.from(sourceMap.values()).map((s) => ({
      source: s.source,
      totalLeads: s.total,
      qualifiedCount: s.qualified,
      convertedCount: s.converted,
      conversionRate: s.total > 0 ? Number(((s.converted / s.total) * 100).toFixed(1)) : 0
    }));

    return { sources };
  }

  /**
   * Sales Representative Performance Leaderboard (Managers & Admins).
   */
  static async getSalesRepPerformance(user) {
    const prisma = getPrismaClient();

    // Sales reps only allowed to view their own metrics; Managers/Admins view all
    const userWhere = { isActive: true };
    if (user.role === 'SALES_REPRESENTATIVE') {
      userWhere.id = user.id;
    }

    const reps = await prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: { select: { name: true } },
        assignedLeads: {
          where: { isArchived: false },
          select: { id: true, status: true, score: true }
        },
        assignedDeals: {
          select: { id: true, status: true, value: true }
        }
      }
    });

    const leaderboard = reps
      .filter((r) => r.role?.name === 'SALES_REPRESENTATIVE' || r.assignedDeals.length > 0 || r.assignedLeads.length > 0)
      .map((rep) => {
        const activeLeadsCount = rep.assignedLeads.length;
        const hotLeadsCount = rep.assignedLeads.filter((l) => (l.score || 0) >= 70).length;

        const openDeals = rep.assignedDeals.filter((d) => d.status === 'OPEN');
        const wonDeals = rep.assignedDeals.filter((d) => d.status === 'WON');
        const lostDeals = rep.assignedDeals.filter((d) => d.status === 'LOST');

        const openPipelineValue = openDeals.reduce((sum, d) => sum + Number(d.value || 0), 0);
        const wonDealValue = wonDeals.reduce((sum, d) => sum + Number(d.value || 0), 0);

        const closedCount = wonDeals.length + lostDeals.length;
        const winRate = closedCount > 0 ? Number(((wonDeals.length / closedCount) * 100).toFixed(1)) : 0;

        return {
          repId: rep.id,
          name: `${rep.firstName} ${rep.lastName}`,
          email: rep.email,
          role: rep.role?.name,
          activeLeadsCount,
          hotLeadsCount,
          openDealsCount: openDeals.length,
          openPipelineValue: Number(openPipelineValue.toFixed(2)),
          wonDealsCount: wonDeals.length,
          wonDealValue: Number(wonDealValue.toFixed(2)),
          winRate
        };
      })
      .sort((a, b) => b.wonDealValue - a.wonDealValue || b.openPipelineValue - a.openPipelineValue);

    return { leaderboard };
  }

  /**
   * Personal Sales Representative Workspace.
   * Aggregates personalized tasks, hot leads, stalled opportunities, and active recommendations.
   */
  static async getSalesRepWorkspace(user) {
    const prisma = getPrismaClient();

    const [assignedLeads, openDeals, recommendations, unreadNotificationsCount] = await Promise.all([
      prisma.lead.findMany({
        where: {
          assignedToId: user.id,
          isArchived: false,
          status: { notIn: ['CONVERTED', 'LOST'] }
        },
        include: {
          company: { select: { name: true } },
          activities: { orderBy: { occurredAt: 'desc' }, take: 1 }
        },
        orderBy: { score: 'desc' }
      }),

      prisma.deal.findMany({
        where: {
          assignedToId: user.id,
          status: 'OPEN'
        },
        include: {
          company: { select: { name: true } },
          pipelineStage: { select: { name: true, probability: true } }
        },
        orderBy: [{ expectedCloseDate: 'asc' }, { value: 'desc' }]
      }),

      prisma.recommendation.findMany({
        where: {
          status: 'PENDING',
          OR: [
            { assignedToId: user.id },
            { lead: { assignedToId: user.id } }
          ]
        },
        include: {
          lead: { select: { id: true, firstName: true, lastName: true, score: true } }
        },
        orderBy: [{ confidence: 'desc' }, { createdAt: 'desc' }],
        take: 6
      }),

      prisma.notification.count({
        where: { userId: user.id, isRead: false }
      })
    ]);

    // Separate hot leads and stalled leads
    const hotLeads = assignedLeads.filter((l) => (l.score || 0) >= 70).slice(0, 5);

    const stalledLeads = [];
    for (const lead of assignedLeads) {
      const stalled = ScoringService.detectStalledStatus(lead, lead.activities);
      if (stalled.isStalled) {
        stalledLeads.push({
          ...lead,
          daysSinceLastActivity: stalled.daysSinceLastActivity
        });
      }
    }

    // Deals closing within 14 days
    const now = new Date();
    const twoWeeksLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const closingSoonDeals = openDeals.filter(
      (d) => d.expectedCloseDate && new Date(d.expectedCloseDate) <= twoWeeksLater
    );

    return {
      workspaceUser: {
        id: user.id,
        name: `${user.firstName} ${user.lastName}`,
        role: user.role
      },
      unreadNotificationsCount,
      summary: {
        assignedLeadsCount: assignedLeads.length,
        hotLeadsCount: hotLeads.length,
        stalledLeadsCount: stalledLeads.length,
        openDealsCount: openDeals.length,
        pendingRecommendationsCount: recommendations.length
      },
      hotLeads,
      stalledLeads: stalledLeads.slice(0, 5),
      openDeals: openDeals.slice(0, 5),
      closingSoonDeals,
      pendingRecommendations: recommendations
    };
  }
}

export default AnalyticsService;
