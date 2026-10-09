import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // 1. Seed Roles
  const roles = [
    {
      name: 'ADMIN',
      description: 'System administrator with full configuration and user management rights'
    },
    {
      name: 'SALES_MANAGER',
      description: 'Sales leadership overseeing reps, pipeline stages, and deal forecasting'
    },
    {
      name: 'SALES_REPRESENTATIVE',
      description: 'Individual sales contributor managing assigned leads, activities, and deals'
    }
  ];

  console.log('  Seeding Roles...');
  const seededRoles = {};
  for (const roleData of roles) {
    const role = await prisma.role.upsert({
      where: { name: roleData.name },
      update: { description: roleData.description },
      create: roleData
    });
    seededRoles[role.name] = role;
  }
  console.log(`  ✓ ${Object.keys(seededRoles).length} roles seeded.`);

  // 2. Seed Pipeline Stages
  const pipelineStages = [
    { name: 'New', order: 1, probability: 10, isActive: true },
    { name: 'Contacted', order: 2, probability: 20, isActive: true },
    { name: 'Qualified', order: 3, probability: 40, isActive: true },
    { name: 'Demo', order: 4, probability: 60, isActive: true },
    { name: 'Proposal', order: 5, probability: 75, isActive: true },
    { name: 'Negotiation', order: 6, probability: 90, isActive: true },
    { name: 'Won', order: 7, probability: 100, isActive: true },
    { name: 'Lost', order: 8, probability: 0, isActive: true }
  ];

  console.log('  Seeding Pipeline Stages...');
  const seededStages = {};
  for (const stageData of pipelineStages) {
    const stage = await prisma.pipelineStage.upsert({
      where: { order: stageData.order },
      update: {
        name: stageData.name,
        probability: stageData.probability,
        isActive: stageData.isActive
      },
      create: stageData
    });
    seededStages[stage.name] = stage;
  }
  console.log(`  ✓ ${Object.keys(seededStages).length} pipeline stages seeded.`);

  // 3. Development-Only Verification Sample Data
  // (Clearly marked development placeholders to verify foreign key relationships and auth)
  console.log('  Seeding Development Sample Data to verify relationships...');

  // Development password hash (DevPassword123!) - only for local testing
  const devPasswordHash = await bcrypt.hash('DevPassword123!', 10);

  // Seed Admin User (Development only)
  const adminRole = seededRoles['ADMIN'];
  await prisma.user.upsert({
    where: { email: 'dev.admin@example.com' },
    update: { passwordHash: devPasswordHash },
    create: {
      firstName: 'Dev',
      lastName: 'Administrator',
      email: 'dev.admin@example.com',
      passwordHash: devPasswordHash,
      isActive: true,
      roleId: adminRole.id
    }
  });

  // Seed Sales Manager User (Development only)
  const managerRole = seededRoles['SALES_MANAGER'];
  await prisma.user.upsert({
    where: { email: 'dev.manager@example.com' },
    update: { passwordHash: devPasswordHash },
    create: {
      firstName: 'Dev',
      lastName: 'Manager',
      email: 'dev.manager@example.com',
      passwordHash: devPasswordHash,
      isActive: true,
      roleId: managerRole.id
    }
  });

  // Seed Sales Representative User (Development only)
  const repRole = seededRoles['SALES_REPRESENTATIVE'];
  const sampleUser = await prisma.user.upsert({
    where: { email: 'dev.rep@example.com' },
    update: { passwordHash: devPasswordHash },
    create: {
      firstName: 'Alex',
      lastName: 'Morgan',
      email: 'dev.rep@example.com',
      passwordHash: devPasswordHash,
      isActive: true,
      roleId: repRole.id
    }
  });

  // Sample Company
  const sampleCompany = await prisma.company.upsert({
    where: { id: 'c0000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: 'c0000000-0000-0000-0000-000000000001',
      name: 'Apex Global Enterprises',
      industry: 'Software & Technology',
      website: 'https://apex-example.com',
      city: 'San Francisco',
      country: 'United States'
    }
  });

  // Sample Lead
  const sampleLead = await prisma.lead.upsert({
    where: { id: 'l0000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: 'l0000000-0000-0000-0000-000000000001',
      firstName: 'Jordan',
      lastName: 'Taylor',
      email: 'jordan.taylor@apex-example.com',
      jobTitle: 'VP of Operations',
      companyId: sampleCompany.id,
      assignedToId: sampleUser.id,
      source: 'INBOUND_FORM',
      status: 'QUALIFIED',
      priority: 'HIGH',
      score: 65
    }
  });

  // Sample Lead Activity
  const sampleActivity = await prisma.leadActivity.create({
    data: {
      leadId: sampleLead.id,
      createdById: sampleUser.id,
      type: 'DEMO_REQUEST',
      description: 'Submitted demo request from enterprise landing page',
      metadata: { referrer: 'direct', page: '/enterprise-demo' }
    }
  });

  // Sample Lead Score
  await prisma.leadScore.create({
    data: {
      leadId: sampleLead.id,
      score: 65,
      reason: '+65 Inbound demo request from verified corporate domain',
      sourceActivityId: sampleActivity.id
    }
  });

  // Sample Deal
  const qualifiedStage = seededStages['Qualified'];
  await prisma.deal.upsert({
    where: { id: 'd0000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: 'd0000000-0000-0000-0000-000000000001',
      title: 'Apex Operations Platform Contract',
      value: 60000.00,
      currency: 'USD',
      leadId: sampleLead.id,
      companyId: sampleCompany.id,
      assignedToId: sampleUser.id,
      pipelineStageId: qualifiedStage.id,
      description: 'Multi-seat annual SaaS subscription'
    }
  });

  // Sample Recommendation
  await prisma.recommendation.create({
    data: {
      leadId: sampleLead.id,
      assignedToId: sampleUser.id,
      type: 'SCHEDULE_DEMO',
      title: 'Schedule Product Walkthrough Demo',
      explanation: 'High-intent lead with enterprise score above 60. Demo requested 24 hours ago.',
      confidence: 0.92,
      status: 'PENDING'
    }
  });

  // Sample Notification
  await prisma.notification.create({
    data: {
      userId: sampleUser.id,
      type: 'LEAD_ASSIGNED',
      title: 'New High Priority Lead Assigned',
      message: 'Jordan Taylor from Apex Global Enterprises was assigned to you.'
    }
  });

  // Sample Audit Log
  await prisma.auditLog.create({
    data: {
      userId: sampleUser.id,
      action: 'LEAD_QUALIFIED',
      entityType: 'Lead',
      entityId: sampleLead.id,
      metadata: { previousStatus: 'NEW', newStatus: 'QUALIFIED' }
    }
  });

  console.log('  ✓ Development verification sample data created.');
  console.log('✅ Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
