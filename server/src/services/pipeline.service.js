import { getPrismaClient } from '../config/prisma.js';
import { AuditService } from './audit.service.js';

export class PipelineService {
  /**
   * List all pipeline stages ordered by order ascending.
   * Includes active deal counts and aggregate value per stage.
   */
  static async listStages() {
    const prisma = getPrismaClient();

    const stages = await prisma.pipelineStage.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      include: {
        deals: {
          select: {
            id: true,
            value: true,
            status: true
          }
        }
      }
    });

    return stages.map((stage) => {
      const dealCount = stage.deals.length;
      const totalValue = stage.deals.reduce((sum, d) => sum + Number(d.value || 0), 0);
      const openDeals = stage.deals.filter((d) => d.status === 'OPEN');
      const openDealCount = openDeals.length;
      const openValue = openDeals.reduce((sum, d) => sum + Number(d.value || 0), 0);

      const { deals, ...stageData } = stage;
      return {
        ...stageData,
        dealCount,
        totalValue: Number(totalValue.toFixed(2)),
        openDealCount,
        openValue: Number(openValue.toFixed(2))
      };
    });
  }

  /**
   * Reorder pipeline stages atomically in a transaction.
   * Restricted to ADMIN and SALES_MANAGER.
   */
  static async reorderStages(stageOrders, user) {
    const prisma = getPrismaClient();

    // Verify all stage IDs exist
    const existingStages = await prisma.pipelineStage.findMany({
      where: {
        id: { in: stageOrders.map((s) => s.id) }
      }
    });

    if (existingStages.length !== stageOrders.length) {
      const error = new Error('One or more stage IDs provided do not exist');
      error.statusCode = 400;
      throw error;
    }

    // Use negative intermediate orders to prevent unique constraint conflicts
    await prisma.$transaction(async (tx) => {
      // Step 1: Set temporary negative order values
      for (let i = 0; i < stageOrders.length; i++) {
        await tx.pipelineStage.update({
          where: { id: stageOrders[i].id },
          data: { order: -(i + 1000) }
        });
      }

      // Step 2: Set target order values
      for (const item of stageOrders) {
        await tx.pipelineStage.update({
          where: { id: item.id },
          data: { order: parseInt(item.order, 10) }
        });
      }
    });

    await AuditService.log({
      action: 'PIPELINE_ORDER_CHANGED',
      entityType: 'PipelineStage',
      entityId: stageOrders[0].id,
      userId: user.id,
      metadata: { stageOrders }
    });

    return this.listStages();
  }

  /**
   * Calculate pipeline analytics and health metrics.
   * Scoped to user's deals if SALES_REPRESENTATIVE.
   */
  static async getPipelineMetrics(user) {
    const prisma = getPrismaClient();

    const where = {};
    if (user.role === 'SALES_REPRESENTATIVE') {
      where.OR = [
        { assignedToId: user.id },
        { assignedToId: null }
      ];
    }

    const deals = await prisma.deal.findMany({
      where,
      include: {
        pipelineStage: {
          select: {
            id: true,
            name: true,
            probability: true,
            order: true
          }
        }
      }
    });

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
    const lostDealsCount = lostDeals.length;
    const closedCount = wonDealsCount + lostDealsCount;
    const winRate = closedCount > 0 ? Number(((wonDealsCount / closedCount) * 100).toFixed(2)) : 0;

    const activeOrWon = [...openDeals, ...wonDeals];
    const totalActiveOrWonValue = activeOrWon.reduce((sum, d) => sum + Number(d.value || 0), 0);
    const averageDealValue = activeOrWon.length > 0
      ? Number((totalActiveOrWonValue / activeOrWon.length).toFixed(2))
      : 0;

    // Stage Velocity calculation from DealStageHistory
    const allStages = await prisma.pipelineStage.findMany({
      where: { isActive: true },
      orderBy: { order: 'asc' },
      select: { id: true, name: true, order: true }
    });

    const historyWhere = {};
    if (user.role === 'SALES_REPRESENTATIVE') {
      historyWhere.deal = {
        OR: [
          { assignedToId: user.id },
          { assignedToId: null }
        ]
      };
    }

    const stageHistory = await prisma.dealStageHistory.findMany({
      where: historyWhere,
      orderBy: { enteredAt: 'asc' },
      include: {
        deal: {
          select: { id: true, status: true, closedAt: true }
        }
      }
    });

    // Group history entries by deal
    const dealHistories = new Map();
    for (const entry of stageHistory) {
      if (!dealHistories.has(entry.dealId)) {
        dealHistories.set(entry.dealId, []);
      }
      dealHistories.get(entry.dealId).push(entry);
    }

    // Accumulate time spent per stage
    const stageDurations = new Map();
    allStages.forEach((s) => {
      stageDurations.set(s.id, { totalDays: 0, count: 0 });
    });

    const now = new Date();

    for (const entries of dealHistories.values()) {
      for (let i = 0; i < entries.length; i++) {
        const current = entries[i];
        const next = entries[i + 1];
        let exitTime;

        if (next) {
          exitTime = new Date(next.enteredAt);
        } else if (current.deal?.status !== 'OPEN' && current.deal?.closedAt) {
          exitTime = new Date(current.deal.closedAt);
        } else {
          exitTime = now;
        }

        const enteredTime = new Date(current.enteredAt);
        const durationDays = Math.max(0, (exitTime - enteredTime) / (1000 * 60 * 60 * 24));

        if (stageDurations.has(current.toStageId)) {
          const stats = stageDurations.get(current.toStageId);
          stats.totalDays += durationDays;
          stats.count += 1;
        }
      }
    }

    const stageVelocity = allStages.map((stage) => {
      const stats = stageDurations.get(stage.id) || { totalDays: 0, count: 0 };
      const avgDays = stats.count > 0 ? Number((stats.totalDays / stats.count).toFixed(1)) : 0;
      return {
        stageId: stage.id,
        stageName: stage.name,
        order: stage.order,
        averageDays: avgDays,
        dealCount: stats.count
      };
    });

    return {
      totalOpenDeals,
      totalOpenPipelineValue: Number(totalOpenPipelineValue.toFixed(2)),
      weightedPipelineValue: Number(weightedPipelineValue.toFixed(2)),
      wonDealsCount,
      lostDealsCount,
      winRate,
      averageDealValue,
      stageVelocity
    };
  }
}
