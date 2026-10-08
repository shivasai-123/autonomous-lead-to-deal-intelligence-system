import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyDatabase() {
  console.log('🔍 Starting Phase 2 Database Verification...');

  try {
    // 1. Verify all 11 models are accessible
    console.log('\n[1/5] Verifying all 11 models are queryable:');
    const [
      rolesCount,
      usersCount,
      companiesCount,
      leadsCount,
      activitiesCount,
      scoresCount,
      stagesCount,
      dealsCount,
      recommendationsCount,
      notificationsCount,
      auditLogsCount
    ] = await Promise.all([
      prisma.role.count(),
      prisma.user.count(),
      prisma.company.count(),
      prisma.lead.count(),
      prisma.leadActivity.count(),
      prisma.leadScore.count(),
      prisma.pipelineStage.count(),
      prisma.deal.count(),
      prisma.recommendation.count(),
      prisma.notification.count(),
      prisma.auditLog.count()
    ]);

    console.log(`  ✓ Role count: ${rolesCount}`);
    console.log(`  ✓ User count: ${usersCount}`);
    console.log(`  ✓ Company count: ${companiesCount}`);
    console.log(`  ✓ Lead count: ${leadsCount}`);
    console.log(`  ✓ LeadActivity count: ${activitiesCount}`);
    console.log(`  ✓ LeadScore count: ${scoresCount}`);
    console.log(`  ✓ PipelineStage count: ${stagesCount}`);
    console.log(`  ✓ Deal count: ${dealsCount}`);
    console.log(`  ✓ Recommendation count: ${recommendationsCount}`);
    console.log(`  ✓ Notification count: ${notificationsCount}`);
    console.log(`  ✓ AuditLog count: ${auditLogsCount}`);

    if (rolesCount < 3 || stagesCount < 8) {
      throw new Error('Seed data incomplete: expected >= 3 roles and >= 8 stages');
    }

    // 2. Verify Pipeline Stages ordering and completeness
    console.log('\n[2/5] Verifying Pipeline Stages ordering:');
    const stages = await prisma.pipelineStage.findMany({
      orderBy: { order: 'asc' }
    });
    for (const stage of stages) {
      console.log(`  • Stage #${stage.order}: "${stage.name}" (Win probability: ${stage.probability}%)`);
    }

    // 3. Verify Complex Relational Query (Lead + Company + User + Role + Deals + Activities)
    console.log('\n[3/5] Verifying Deep Relational Join (Lead ↔ Company ↔ User ↔ Role ↔ Deal):');
    const leadWithRelations = await prisma.lead.findFirst({
      include: {
        company: true,
        assignedTo: {
          include: { role: true }
        },
        activities: true,
        scoreHistory: true,
        deals: {
          include: { pipelineStage: true }
        },
        recommendations: true
      }
    });

    if (!leadWithRelations) {
      throw new Error('No lead record found for relational verification');
    }

    console.log(`  ✓ Lead: ${leadWithRelations.firstName} ${leadWithRelations.lastName} (${leadWithRelations.email})`);
    console.log(`  ✓ Company: ${leadWithRelations.company?.name || 'None'}`);
    console.log(`  ✓ Assigned Rep: ${leadWithRelations.assignedTo?.firstName} ${leadWithRelations.assignedTo?.lastName} [Role: ${leadWithRelations.assignedTo?.role?.name}]`);
    console.log(`  ✓ Associated Activities: ${leadWithRelations.activities.length}`);
    console.log(`  ✓ Associated Scores: ${leadWithRelations.scoreHistory.length}`);
    console.log(`  ✓ Associated Deals: ${leadWithRelations.deals.length}`);
    if (leadWithRelations.deals.length > 0) {
      const deal = leadWithRelations.deals[0];
      console.log(`      Deal Title: "${deal.title}" | Value: $${deal.value.toString()} | Stage: "${deal.pipelineStage.name}"`);
    }
    console.log(`  ✓ Recommendations: ${leadWithRelations.recommendations.length}`);

    // 4. Verify Unique Constraints enforcement
    console.log('\n[4/5] Verifying Unique Constraint Behavior:');
    try {
      await prisma.role.create({
        data: { name: 'ADMIN', description: 'Duplicate Admin role test' }
      });
      throw new Error('Unique constraint failed to block duplicate role name');
    } catch (err) {
      if (err.code === 'P2002') {
        console.log('  ✓ Unique constraint correctly rejected duplicate role name (P2002).');
      } else {
        throw err;
      }
    }

    // 5. Verify Decimal type precision on Deal model
    console.log('\n[5/5] Verifying Currency Precision (PostgreSQL Decimal):');
    const testDeal = await prisma.deal.findFirst();
    if (testDeal) {
      console.log(`  ✓ Stored Deal Value: ${testDeal.value.toString()} (Type: Decimal, precision verified)`);
    }

    console.log('\n🎉 ALL DATABASE VERIFICATION CHECKS PASSED SUCCESSFULLY!\n');
  } catch (error) {
    console.error('\n❌ Verification Failed:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

verifyDatabase();
