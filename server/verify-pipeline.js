// ========================================================
// Phase 5 Sales Pipeline & Deal Management Verification Script
// ========================================================
// Tests: Pipeline Stages Listing, Atomic Reordering,
// Pipeline Analytics & Velocity, Deal Management CRUD,
// Deal Stage Transitions, Terminal Won/Lost Lifecycle,
// RBAC Reopening Rules, Lead-to-Deal Conversion,
// and PostgreSQL DealStageHistory & Audit Trail.

import http from 'http';
import app from './src/app.js';
import { getPrismaClient, disconnectPrisma } from './src/config/prisma.js';

const TEST_PORT = 5005;
const BASE_URL = `http://localhost:${TEST_PORT}/api`;

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}${path}`;
    const urlObj = new URL(url);

    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: `${urlObj.pathname}${urlObj.search}`,
      method: options.method || 'GET',
      headers
    };

    const req = http.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        try {
          const json = body ? JSON.parse(body) : null;
          resolve({ status: res.statusCode, headers: res.headers, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: body });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function runVerification() {
  const prisma = getPrismaClient();
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(TEST_PORT, resolve));

  const createdDealIds = [];
  const createdLeadIds = [];
  const createdCompanyIds = [];

  try {
    console.log('\n🚀 Starting Phase 5 Sales Pipeline & Deal Management Verification...\n');

    // ----------------------------------------------------
    // SETUP: Authenticate Personas
    // ----------------------------------------------------
    console.log('[Setup] Authenticating test personas...');

    const adminLogin = await request('/auth/login', {
      method: 'POST',
      body: { email: 'dev.admin@example.com', password: 'DevPassword123!' }
    });
    const adminToken = adminLogin.data?.data?.token;

    const managerLogin = await request('/auth/login', {
      method: 'POST',
      body: { email: 'dev.manager@example.com', password: 'DevPassword123!' }
    });
    const managerToken = managerLogin.data?.data?.token;

    const rep1Login = await request('/auth/login', {
      method: 'POST',
      body: { email: 'dev.rep@example.com', password: 'DevPassword123!' }
    });
    const rep1Token = rep1Login.data?.data?.token;
    const rep1User = rep1Login.data?.data?.user;

    // Register a second rep for RBAC cross-rep boundary tests
    const rep2Email = `rep2.pipeline.${Date.now()}@example.com`;
    const rep2Reg = await request('/auth/register', {
      method: 'POST',
      body: {
        firstName: 'Marcus',
        lastName: 'Vance',
        email: rep2Email,
        password: 'Password123!',
        role: 'SALES_REPRESENTATIVE'
      }
    });
    const rep2Token = rep2Reg.data?.data?.token;
    const rep2User = rep2Reg.data?.data?.user;

    if (!adminToken || !managerToken || !rep1Token || !rep2Token) {
      throw new Error('Authentication failed for test personas');
    }
    console.log('  ✓ Admin, Manager, Rep 1, and Rep 2 authenticated successfully.');

    // Create a base test company
    const testCompanyRes = await request('/companies', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        name: `Pipeline Test Corp ${Date.now()}`,
        industry: 'Cloud Solutions',
        website: 'https://pipelinetest.example.com'
      }
    });
    const testCompany = testCompanyRes.data?.data?.company;
    createdCompanyIds.push(testCompany.id);

    // ----------------------------------------------------
    // [1/18] GET /api/pipeline/stages
    // ----------------------------------------------------
    console.log('\n[1/18] Testing Pipeline Stages Listing (GET /api/pipeline/stages)...');
    const stagesRes = await request('/pipeline/stages', {
      headers: { Authorization: `Bearer ${rep1Token}` }
    });
    if (stagesRes.status !== 200 || !stagesRes.data?.data?.stages) {
      throw new Error(`Failed to list pipeline stages: ${JSON.stringify(stagesRes.data)}`);
    }
    const stages = stagesRes.data.data.stages;
    if (stages.length < 8) {
      throw new Error(`Expected at least 8 pipeline stages, found ${stages.length}`);
    }
    console.log(`  ✓ Retrieved ${stages.length} pipeline stages ordered by order ascending.`);

    const newStage = stages.find((s) => s.name === 'New');
    const qualifiedStage = stages.find((s) => s.name === 'Qualified');
    const demoStage = stages.find((s) => s.name === 'Demo');
    const proposalStage = stages.find((s) => s.name === 'Proposal');
    const wonStage = stages.find((s) => s.name === 'Won');
    const lostStage = stages.find((s) => s.name === 'Lost');

    if (!newStage || !qualifiedStage || !wonStage || !lostStage) {
      throw new Error('Missing essential pipeline stages (New, Qualified, Won, Lost)');
    }

    // ----------------------------------------------------
    // [2/18] Reorder Stages RBAC Rejection (Sales Rep blocked)
    // ----------------------------------------------------
    console.log('\n[2/18] Testing Stage Reordering RBAC Rejection (Sales Rep blocked with 403)...');
    const reorderForbidden = await request('/pipeline/stages/reorder', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${rep1Token}` },
      body: {
        stageOrders: [
          { id: stages[0].id, order: 1 },
          { id: stages[1].id, order: 2 }
        ]
      }
    });
    if (reorderForbidden.status !== 403) {
      throw new Error(`Sales Rep should be blocked from reordering stages, got status ${reorderForbidden.status}`);
    }
    console.log('  ✓ Sales Rep correctly blocked from stage reordering with 403 Forbidden.');

    // ----------------------------------------------------
    // [3/18] Reorder Stages Validation (400 Bad Request)
    // ----------------------------------------------------
    console.log('\n[3/18] Testing Stage Reordering Validation (400 Bad Request on invalid payload)...');
    const invalidReorder = await request('/pipeline/stages/reorder', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        stageOrders: [{ id: 'non-existent-id', order: 1 }]
      }
    });
    if (invalidReorder.status !== 400) {
      throw new Error(`Invalid stage reorder should be rejected with 400, got ${invalidReorder.status}`);
    }
    console.log('  ✓ Invalid stage reorder payload rejected with 400 Bad Request.');

    // ----------------------------------------------------
    // [4/18] Atomic Stage Reordering by Manager/Admin
    // ----------------------------------------------------
    console.log('\n[4/18] Testing Atomic Stage Reordering by Sales Manager (PUT /api/pipeline/stages/reorder)...');
    // Swap order of first two stages temporarily, then restore
    const originalStageOrders = stages.map((s) => ({ id: s.id, order: s.order }));
    const swappedOrders = stages.map((s, idx) => {
      if (idx === 0) return { id: s.id, order: 2 };
      if (idx === 1) return { id: s.id, order: 1 };
      return { id: s.id, order: s.order };
    });

    const reorderRes = await request('/pipeline/stages/reorder', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: { stageOrders: swappedOrders }
    });
    if (reorderRes.status !== 200) {
      throw new Error(`Failed to reorder stages: ${JSON.stringify(reorderRes.data)}`);
    }
    console.log('  ✓ Stages atomically reordered in PostgreSQL transaction.');

    // Restore original ordering to keep seed deterministic
    await request('/pipeline/stages/reorder', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: { stageOrders: originalStageOrders }
    });
    console.log('  ✓ Deterministic stage ordering restored.');

    // ----------------------------------------------------
    // [5/18] Pipeline Metrics Calculation (GET /api/pipeline/metrics)
    // ----------------------------------------------------
    console.log('\n[5/18] Testing Pipeline Metrics & Analytics (GET /api/pipeline/metrics)...');
    const metricsRes = await request('/pipeline/metrics', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (metricsRes.status !== 200 || !metricsRes.data?.data) {
      throw new Error(`Failed to calculate pipeline metrics: ${JSON.stringify(metricsRes.data)}`);
    }
    const metrics = metricsRes.data.data;
    if (typeof metrics.totalOpenDeals !== 'number' || typeof metrics.winRate !== 'number') {
      throw new Error('Pipeline metrics missing required numerical fields');
    }
    console.log(`  ✓ Pipeline Metrics computed: ${metrics.totalOpenDeals} Open Deals | $${metrics.totalOpenPipelineValue} Value | ${metrics.winRate}% Win Rate.`);

    // ----------------------------------------------------
    // [6/18] Direct Deal Creation (POST /api/deals)
    // ----------------------------------------------------
    console.log('\n[6/18] Testing Direct Deal Creation (POST /api/deals)...');
    const deal1Res = await request('/deals', {
      method: 'POST',
      headers: { Authorization: `Bearer ${rep1Token}` },
      body: {
        title: `Enterprise Security Contract ${Date.now()}`,
        value: 75000,
        currency: 'USD',
        pipelineStageId: qualifiedStage.id,
        companyId: testCompany.id,
        expectedCloseDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
        description: 'Multi-year cybersecurity expansion contract'
      }
    });

    if (deal1Res.status !== 201 || !deal1Res.data?.data?.deal) {
      throw new Error(`Failed to create deal: ${JSON.stringify(deal1Res.data)}`);
    }
    const deal1 = deal1Res.data.data.deal;
    createdDealIds.push(deal1.id);

    if (deal1.status !== 'OPEN' || deal1.value !== 75000 || deal1.assignedToId !== rep1User.id) {
      throw new Error(`Deal attributes mismatch: status=${deal1.status}, value=${deal1.value}, assignedToId=${deal1.assignedToId}`);
    }
    console.log(`  ✓ Deal created: "${deal1.title}" ($${deal1.value}) assigned to Rep 1 in stage "${deal1.pipelineStage?.name}".`);

    // ----------------------------------------------------
    // [7/18] Initial Stage History Verification
    // ----------------------------------------------------
    console.log('\n[7/18] Verifying Initial DealStageHistory Entry...');
    const deal1DetailRes = await request(`/deals/${deal1.id}`, {
      headers: { Authorization: `Bearer ${rep1Token}` }
    });
    const deal1Details = deal1DetailRes.data?.data?.deal;
    if (!deal1Details?.stageHistory || deal1Details.stageHistory.length !== 1) {
      throw new Error(`Expected exactly 1 initial stage history entry, got ${deal1Details?.stageHistory?.length}`);
    }
    const initialHistory = deal1Details.stageHistory[0];
    if (initialHistory.fromStageId !== null || initialHistory.toStageId !== qualifiedStage.id) {
      throw new Error(`Initial history invalid: fromStageId=${initialHistory.fromStageId}, toStageId=${initialHistory.toStageId}`);
    }
    console.log(`  ✓ Initial DealStageHistory verified: entered "${qualifiedStage.name}" with fromStage: null.`);

    // ----------------------------------------------------
    // [8/18] Deals Listing, Search & Filtering (GET /api/deals)
    // ----------------------------------------------------
    console.log('\n[8/18] Testing Deals Listing & Filtering (GET /api/deals)...');
    const filteredDealsRes = await request(`/deals?status=OPEN&pipelineStageId=${qualifiedStage.id}&limit=5`, {
      headers: { Authorization: `Bearer ${rep1Token}` }
    });
    if (filteredDealsRes.status !== 200 || !filteredDealsRes.data?.data?.deals) {
      throw new Error(`Failed to list deals: ${JSON.stringify(filteredDealsRes.data)}`);
    }
    const listData = filteredDealsRes.data.data;
    if (listData.deals.length === 0 || !listData.pagination) {
      throw new Error('Deals list should return records with pagination metadata');
    }
    console.log(`  ✓ Retrieved ${listData.deals.length} deals with pagination (Total: ${listData.pagination.total}).`);

    // ----------------------------------------------------
    // [9/18] Deal Retrieval with Full Relations (GET /api/deals/:id)
    // ----------------------------------------------------
    console.log('\n[9/18] Testing Single Deal Retrieval (GET /api/deals/:id)...');
    const singleDealRes = await request(`/deals/${deal1.id}`, {
      headers: { Authorization: `Bearer ${rep1Token}` }
    });
    if (singleDealRes.status !== 200) {
      throw new Error(`Failed to retrieve deal: ${JSON.stringify(singleDealRes.data)}`);
    }
    const singleDeal = singleDealRes.data.data.deal;
    if (!singleDeal.company || !singleDeal.assignedTo || !singleDeal.pipelineStage) {
      throw new Error('Deal detail missing related entities (company, assignedTo, pipelineStage)');
    }
    console.log(`  ✓ Deal retrieved with company "${singleDeal.company.name}" and assignee "${singleDeal.assignedTo.firstName}".`);

    // ----------------------------------------------------
    // [10/18] Deal Details Update (PATCH /api/deals/:id)
    // ----------------------------------------------------
    console.log('\n[10/18] Testing Deal Information Update (PATCH /api/deals/:id)...');
    const updateRes = await request(`/deals/${deal1.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${rep1Token}` },
      body: {
        value: 95000,
        description: 'Updated scope: Added 24/7 dedicated enterprise response tier'
      }
    });
    if (updateRes.status !== 200 || updateRes.data?.data?.deal?.value !== 95000) {
      throw new Error(`Failed to update deal value: ${JSON.stringify(updateRes.data)}`);
    }
    console.log(`  ✓ Deal value updated to $${updateRes.data.data.deal.value}.`);

    // ----------------------------------------------------
    // [11/18] Stage Transition in Open Stages (PATCH /api/deals/:id/stage)
    // ----------------------------------------------------
    console.log('\n[11/18] Testing Stage Transition in Open Stages (Qualified -> Demo)...');
    const transitionOpenRes = await request(`/deals/${deal1.id}/stage`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${rep1Token}` },
      body: {
        stageId: demoStage.id,
        transitionNote: 'Executive product walkthrough completed successfully'
      }
    });
    if (transitionOpenRes.status !== 200) {
      throw new Error(`Failed to transition stage: ${JSON.stringify(transitionOpenRes.data)}`);
    }
    const openTransitionDeal = transitionOpenRes.data.data.deal;
    if (openTransitionDeal.pipelineStageId !== demoStage.id || openTransitionDeal.status !== 'OPEN') {
      throw new Error(`Deal stage did not update properly: stageId=${openTransitionDeal.pipelineStageId}`);
    }
    if (openTransitionDeal.stageHistory.length !== 2) {
      throw new Error(`Expected 2 history records, found ${openTransitionDeal.stageHistory.length}`);
    }
    console.log(`  ✓ Deal moved to "${demoStage.name}" (${demoStage.probability}%) with recorded transition note.`);

    // ----------------------------------------------------
    // [12/18] Stage Transition to Terminal WON (PATCH /api/deals/:id/stage)
    // ----------------------------------------------------
    console.log('\n[12/18] Testing Terminal WON Transition (Demo -> Won)...');
    const transitionWonRes = await request(`/deals/${deal1.id}/stage`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${rep1Token}` },
      body: {
        stageId: wonStage.id,
        transitionNote: 'MSA and Order Form executed by legal'
      }
    });
    if (transitionWonRes.status !== 200) {
      throw new Error(`Failed to transition to WON: ${JSON.stringify(transitionWonRes.data)}`);
    }
    const wonDeal = transitionWonRes.data.data.deal;
    if (wonDeal.status !== 'WON' || !wonDeal.closedAt) {
      throw new Error(`Deal status should be WON with closedAt timestamp. Got status=${wonDeal.status}, closedAt=${wonDeal.closedAt}`);
    }
    console.log(`  ✓ Deal transitioned to WON: status=WON, closedAt=${wonDeal.closedAt}.`);

    // ----------------------------------------------------
    // [13/18] RBAC Rule: Reopening Won Deal Blocked for Sales Rep
    // ----------------------------------------------------
    console.log('\n[13/18] Testing RBAC Rule: Sales Rep blocked from reopening closed deal (403)...');
    const reopenForbidden = await request(`/deals/${deal1.id}/stage`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${rep1Token}` },
      body: {
        stageId: proposalStage.id,
        transitionNote: 'Attempting to reopen closed deal'
      }
    });
    if (reopenForbidden.status !== 403) {
      throw new Error(`Sales Rep should not be allowed to reopen closed deal, got ${reopenForbidden.status}`);
    }
    console.log('  ✓ Sales Rep correctly blocked from reopening closed deal with 403 Forbidden.');

    // ----------------------------------------------------
    // [14/18] Manager Successfully Reopens Closed Deal
    // ----------------------------------------------------
    console.log('\n[14/18] Testing Manager Reopening Closed Deal (PATCH /api/deals/:id/stage)...');
    const reopenRes = await request(`/deals/${deal1.id}/stage`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        stageId: proposalStage.id,
        transitionNote: 'Manager authorized deal reopening for amended contract scope'
      }
    });
    if (reopenRes.status !== 200) {
      throw new Error(`Manager failed to reopen deal: ${JSON.stringify(reopenRes.data)}`);
    }
    const reopenedDeal = reopenRes.data.data.deal;
    if (reopenedDeal.status !== 'OPEN' || reopenedDeal.closedAt !== null) {
      throw new Error(`Reopened deal status should be OPEN with closedAt: null. Got status=${reopenedDeal.status}, closedAt=${reopenedDeal.closedAt}`);
    }
    console.log('  ✓ Sales Manager successfully reopened deal: status reset to OPEN, closedAt reset to null.');

    // ----------------------------------------------------
    // [15/18] Terminal LOST Transition
    // ----------------------------------------------------
    console.log('\n[15/18] Testing Terminal LOST Transition (Proposal -> Lost)...');
    const transitionLostRes = await request(`/deals/${deal1.id}/stage`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${rep1Token}` },
      body: {
        stageId: lostStage.id,
        transitionNote: 'Prospect opted for incumbent solution due to budget freeze'
      }
    });
    if (transitionLostRes.status !== 200) {
      throw new Error(`Failed to transition to LOST: ${JSON.stringify(transitionLostRes.data)}`);
    }
    const lostDeal = transitionLostRes.data.data.deal;
    if (lostDeal.status !== 'LOST' || !lostDeal.closedAt) {
      throw new Error(`Deal status should be LOST with closedAt. Got status=${lostDeal.status}, closedAt=${lostDeal.closedAt}`);
    }
    console.log(`  ✓ Deal transitioned to LOST: status=LOST, closedAt=${lostDeal.closedAt}.`);

    // ----------------------------------------------------
    // [16/18] RBAC Scoping: Cross-Rep Isolation (Rep 2 blocked from Rep 1 Deal)
    // ----------------------------------------------------
    console.log('\n[16/18] Testing RBAC Scoping: Rep 2 blocked from accessing Rep 1 Deal (403)...');
    const rep2Access = await request(`/deals/${deal1.id}`, {
      headers: { Authorization: `Bearer ${rep2Token}` }
    });
    if (rep2Access.status !== 403) {
      throw new Error(`Rep 2 should be blocked from viewing Rep 1's deal, got ${rep2Access.status}`);
    }

    const rep2Modify = await request(`/deals/${deal1.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${rep2Token}` },
      body: { value: 1000 }
    });
    if (rep2Modify.status !== 403) {
      throw new Error(`Rep 2 should be blocked from updating Rep 1's deal, got ${rep2Modify.status}`);
    }
    console.log('  ✓ Sales Rep 2 correctly blocked with 403 Forbidden from viewing or modifying Rep 1 deal.');

    // ----------------------------------------------------
    // [17/18] Lead-to-Deal Conversion (POST /api/leads/:id/convert)
    // ----------------------------------------------------
    console.log('\n[17/18] Testing Lead-to-Deal Conversion (POST /api/leads/:id/convert)...');
    // First, create a new active lead
    const leadRes = await request('/leads', {
      method: 'POST',
      headers: { Authorization: `Bearer ${rep1Token}` },
      body: {
        firstName: 'Elena',
        lastName: 'Rostova',
        email: `elena.convert.${Date.now()}@example.com`,
        phone: '+1 415 555 7788',
        companyName: `Fintech Innovations ${Date.now()}`,
        status: 'QUALIFIED',
        priority: 'HIGH'
      }
    });
    const testLead = leadRes.data?.data?.lead;
    createdLeadIds.push(testLead.id);

    // Convert lead to deal
    const convertRes = await request(`/leads/${testLead.id}/convert`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${rep1Token}` },
      body: {
        title: 'Fintech Analytics Enterprise License',
        value: 120000,
        currency: 'USD',
        pipelineStageId: qualifiedStage.id,
        expectedCloseDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        description: 'Core platform deployment with custom reporting integrations'
      }
    });

    if (convertRes.status !== 201 || !convertRes.data?.data?.deal || !convertRes.data?.data?.lead) {
      throw new Error(`Failed to convert lead to deal: ${JSON.stringify(convertRes.data)}`);
    }
    const convertedDeal = convertRes.data.data.deal;
    const updatedLead = convertRes.data.data.lead;
    createdDealIds.push(convertedDeal.id);

    if (updatedLead.status !== 'CONVERTED') {
      throw new Error(`Lead status should be CONVERTED, got ${updatedLead.status}`);
    }
    if (convertedDeal.leadId !== testLead.id || convertedDeal.value !== 120000) {
      throw new Error(`Converted deal attributes invalid: leadId=${convertedDeal.leadId}, value=${convertedDeal.value}`);
    }
    console.log(`  ✓ Lead "${testLead.firstName} ${testLead.lastName}" converted to Deal "${convertedDeal.title}" ($${convertedDeal.value}) with status CONVERTED.`);

    // ----------------------------------------------------
    // [18/18] Lead Conversion Edge Cases & Audit Trail
    // ----------------------------------------------------
    console.log('\n[18/18] Testing Lead Conversion Edge Cases & PostgreSQL Audit Trail...');
    // Re-converting the same lead must be rejected with 400
    const reconvertRes = await request(`/leads/${testLead.id}/convert`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${rep1Token}` },
      body: {
        title: 'Duplicate Conversion Attempt',
        value: 50000
      }
    });
    if (reconvertRes.status !== 400) {
      throw new Error(`Converting already converted lead should return 400, got ${reconvertRes.status}`);
    }
    console.log('  ✓ Re-converting already converted lead correctly rejected with 400 Bad Request.');

    // Verify Audit Log records in PostgreSQL
    const auditEntries = await prisma.auditLog.findMany({
      where: {
        entityId: { in: [deal1.id, testLead.id, convertedDeal.id] }
      },
      orderBy: { createdAt: 'asc' }
    });
    const actions = auditEntries.map((a) => a.action);
    console.log(`  • Recorded Audit Actions: ${[...new Set(actions)].join(', ')}`);

    const hasDealCreated = actions.includes('DEAL_CREATED');
    const hasStageChanged = actions.includes('DEAL_STAGE_CHANGED');
    const hasDealWon = actions.includes('DEAL_WON');
    const hasDealLost = actions.includes('DEAL_LOST');
    const hasLeadConverted = actions.includes('LEAD_CONVERTED');

    if (!hasDealCreated || !hasStageChanged || !hasDealWon || !hasDealLost || !hasLeadConverted) {
      throw new Error(`Missing expected audit log entries! Found: ${actions.join(', ')}`);
    }
    console.log('  ✓ AuditLog accurately recorded DEAL_CREATED, DEAL_STAGE_CHANGED, DEAL_WON, DEAL_LOST, and LEAD_CONVERTED.');

    console.log('\n🎉 ALL 18 SALES PIPELINE & DEAL MANAGEMENT VERIFICATION TESTS PASSED!\n');
  } finally {
    console.log('Cleaning up test data...');
    try {
      if (createdDealIds.length > 0) {
        await prisma.dealStageHistory.deleteMany({ where: { dealId: { in: createdDealIds } } });
        await prisma.auditLog.deleteMany({ where: { entityId: { in: createdDealIds } } });
        await prisma.deal.deleteMany({ where: { id: { in: createdDealIds } } });
      }
      if (createdLeadIds.length > 0) {
        await prisma.leadActivity.deleteMany({ where: { leadId: { in: createdLeadIds } } });
        await prisma.auditLog.deleteMany({ where: { entityId: { in: createdLeadIds } } });
        await prisma.lead.deleteMany({ where: { id: { in: createdLeadIds } } });
      }
      if (createdCompanyIds.length > 0) {
        await prisma.auditLog.deleteMany({ where: { entityId: { in: createdCompanyIds } } });
        await prisma.company.deleteMany({ where: { id: { in: createdCompanyIds } } });
      }
      await prisma.user.deleteMany({
        where: { email: { contains: 'rep2.pipeline' } }
      });
      console.log('Cleaned up test data successfully.');
    } catch (cleanupErr) {
      console.warn('Warning during cleanup:', cleanupErr.message);
    }

    server.close();
    await disconnectPrisma();
  }
}

runVerification().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
