// ========================================================
// Phase 6 Lead Intelligence, Scoring, Priority & Automation Verification
// ========================================================
// Tests:
// 1. Scoring Engine: Deterministic weights, anti-inflation caps, [0, 100] bounds
// 2. Engagement Classification: HOT (70-100), WARM (40-69), COLD (0-39)
// 3. Priority Synchronization: URGENT (85-100), HIGH (70-84), MEDIUM (40-69), LOW (0-39)
// 4. Stalled Lead Detection: 14-day inactivity threshold, terminal/archived exclusion
// 5. Activity Event Trigger: Real-time recalculation on activity logging
// 6. Score Snapshot History: Structured JSON breakdown, delta tracking, idempotency
// 7. Lead Intelligence API: /api/leads/:id/intelligence
// 8. Score History API: /api/leads/:id/score-history
// 9. Manual & Batch Recalculation APIs with RBAC protection
// 10. Audit Logging: LEAD_SCORE_CHANGED and BATCH_SCORES_RECALCULATED

import http from 'http';
import app from './src/app.js';
import { getPrismaClient, disconnectPrisma } from './src/config/prisma.js';
import {
  ACTIVITY_WEIGHTS,
  ACTIVITY_CAPS,
  SCORE_BOUNDS,
  STALLED_THRESHOLD_DAYS,
  classifyScore,
  scoreToPriority
} from './src/config/scoring.config.js';
import { ScoringService } from './src/services/scoring.service.js';

const TEST_PORT = 5006;
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
        } catch {
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

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  [PASS] ${testName}`);
    passedTests++;
  } else {
    console.error(`  [FAIL] ${testName}`);
    failedTests++;
  }
}

async function runVerification() {
  const prisma = getPrismaClient();
  const server = http.createServer(app);

  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`\nVerification server active on port ${TEST_PORT}\n`);

  const createdLeadIds = [];
  let testCompanyId = null;

  try {
    // -------------------------------------------------------------------------
    // TEST SUITE 1: Deterministic Scoring Math, Caps & Bounds
    // -------------------------------------------------------------------------
    console.log('--- TEST SUITE 1: Scoring Rules, Caps, Bounds & Classification ---');

    // 1.1 Baseline score on empty activities
    const baseline = ScoringService.calculateScoreFromActivities([]);
    assert(baseline.score === 0, '1.1 Baseline score with 0 activities is 0');
    assert(baseline.classification === 'COLD', '1.2 Baseline classification is COLD');
    assert(baseline.priority === 'LOW', '1.3 Baseline priority is LOW');

    // 1.2 Deterministic activity weights test
    const singleDemo = ScoringService.calculateScoreFromActivities([
      { type: 'DEMO_REQUEST' }
    ]);
    assert(singleDemo.score === 25, '1.4 Single DEMO_REQUEST gives exactly 25 points');

    // 1.3 Anti-inflation caps test (e.g. 10x WEBSITE_VISIT: raw 20, cap 10)
    const tenVisits = Array(10).fill({ type: 'WEBSITE_VISIT' });
    const visitsCalc = ScoringService.calculateScoreFromActivities(tenVisits);
    assert(visitsCalc.rawTotal === 20, '1.5 10x WEBSITE_VISIT rawTotal is 20');
    assert(visitsCalc.score === 10, '1.6 10x WEBSITE_VISIT capped score is 10 (cap enforced)');

    const visitContribution = visitsCalc.contributions.find((c) => c.type === 'WEBSITE_VISIT');
    assert(visitContribution?.isCapped === true, '1.7 Contribution marked as isCapped=true');

    // 1.4 Upper bound clamping (score never exceeds 100)
    const massiveActivities = [
      ...Array(5).fill({ type: 'DEMO_REQUEST' }), // capped at 50
      ...Array(5).fill({ type: 'EMAIL_REPLY' }), // capped at 30
      ...Array(5).fill({ type: 'MEETING' }), // capped at 20
      ...Array(5).fill({ type: 'PRICING_PAGE_VIEW' }) // capped at 30
    ];
    const massiveCalc = ScoringService.calculateScoreFromActivities(massiveActivities);
    assert(massiveCalc.rawTotal > 100, '1.8 Raw total exceeds 100 on high commercial activity');
    assert(massiveCalc.score === 100, '1.9 Calculated score is clamped at exactly 100');
    assert(massiveCalc.classification === 'HOT', '1.10 Score 100 classified as HOT');
    assert(massiveCalc.priority === 'URGENT', '1.11 Score 100 mapped to URGENT priority');

    // 1.5 Classification and Priority thresholds
    assert(classifyScore(70) === 'HOT', '1.12 Score 70 classified as HOT');
    assert(classifyScore(69) === 'WARM', '1.13 Score 69 classified as WARM');
    assert(classifyScore(40) === 'WARM', '1.14 Score 40 classified as WARM');
    assert(classifyScore(39) === 'COLD', '1.15 Score 39 classified as COLD');
    assert(scoreToPriority(85) === 'URGENT', '1.16 Score 85 mapped to URGENT priority');
    assert(scoreToPriority(70) === 'HIGH', '1.17 Score 70 mapped to HIGH priority');
    assert(scoreToPriority(40) === 'MEDIUM', '1.18 Score 40 mapped to MEDIUM priority');
    assert(scoreToPriority(39) === 'LOW', '1.19 Score 39 mapped to LOW priority');

    // -------------------------------------------------------------------------
    // TEST SUITE 2: Authentication & User Setup
    // -------------------------------------------------------------------------
    console.log('\n--- TEST SUITE 2: Authenticated Setup ---');

    const adminLogin = await request('/auth/login', {
      method: 'POST',
      body: { email: 'dev.admin@example.com', password: 'DevPassword123!' }
    });
    const adminToken = adminLogin.data?.data?.token;
    const adminUser = adminLogin.data?.data?.user;
    assert(adminLogin.status === 200 && adminToken, '2.1 Admin login successful');

    const repLogin = await request('/auth/login', {
      method: 'POST',
      body: { email: 'dev.rep@example.com', password: 'DevPassword123!' }
    });
    const repToken = repLogin.data?.data?.token;
    const repUser = repLogin.data?.data?.user;
    assert(repLogin.status === 200 && repToken, '2.2 Sales Rep login successful');

    const managerLogin = await request('/auth/login', {
      method: 'POST',
      body: { email: 'dev.manager@example.com', password: 'DevPassword123!' }
    });
    const managerToken = managerLogin.data?.data?.token;
    assert(managerLogin.status === 200 && managerToken, '2.3 Sales Manager login successful');

    // Create a test company
    const companyRes = await request('/companies', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        name: `Test Intelligence Corp ${Date.now()}`,
        domain: `intel-${Date.now()}.com`,
        industry: 'Software'
      }
    });
    assert(companyRes.status === 201, '2.4 Test company created');
    testCompanyId = companyRes.data?.data?.company?.id;

    // -------------------------------------------------------------------------
    // TEST SUITE 3: Lead Creation & Real-Time Activity Recalculation
    // -------------------------------------------------------------------------
    console.log('\n--- TEST SUITE 3: Real-Time Score Recalculation on Activity ---');

    // Create Lead 1 assigned to rep
    const lead1Res = await request('/leads', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: `ada.intel.${Date.now()}@example.com`,
        phone: `+1-555-${Math.floor(100000 + Math.random() * 900000)}`,
        companyId: testCompanyId,
        assignedToId: repUser.id,
        status: 'NEW',
        priority: 'MEDIUM'
      }
    });
    assert(lead1Res.status === 201, '3.1 Lead 1 created');
    const lead1 = lead1Res.data?.data?.lead;
    createdLeadIds.push(lead1.id);

    // Initial score of newly created lead is 0
    assert(lead1.score === 0, '3.2 Initial lead score is 0');

    // Record Activity 1: DEMO_REQUEST (+25 pts)
    const act1Res = await request(`/leads/${lead1.id}/activities`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        type: 'DEMO_REQUEST',
        description: 'Lead requested technical walkthrough of intelligence engine',
        occurredAt: new Date().toISOString()
      }
    });
    assert(act1Res.status === 201, '3.3 Activity 1 (DEMO_REQUEST) created');
    assert(act1Res.data?.data?.intelligence?.score === 25, '3.4 Score immediately updated to 25 pts');
    assert(act1Res.data?.data?.intelligence?.classification === 'COLD', '3.5 25 pts classified as COLD');
    assert(act1Res.data?.data?.intelligence?.priority === 'LOW', '3.6 25 pts priority synced to LOW');

    // Verify Lead record in DB directly
    const lead1DbAfterAct1 = await prisma.lead.findUnique({ where: { id: lead1.id } });
    assert(lead1DbAfterAct1.score === 25, '3.7 Lead.score in database updated to 25');
    assert(lead1DbAfterAct1.priority === 'LOW', '3.8 Lead.priority in database synchronized to LOW');

    // Record Activity 2: PRICING_PAGE_VIEW (+10 pts) -> Total 35
    const act2Res = await request(`/leads/${lead1.id}/activities`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        type: 'PRICING_PAGE_VIEW',
        description: 'Visited pricing table twice',
        occurredAt: new Date().toISOString()
      }
    });
    assert(act2Res.status === 201, '3.9 Activity 2 (PRICING_PAGE_VIEW) recorded');
    assert(act2Res.data?.data?.intelligence?.score === 35, '3.10 Score updated to 35');

    // Record Activity 3: EMAIL_REPLY (+10 pts) -> Total 45 -> WARM & MEDIUM
    const act3Res = await request(`/leads/${lead1.id}/activities`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        type: 'EMAIL_REPLY',
        description: 'Confirmed procurement schedule for Q4',
        occurredAt: new Date().toISOString()
      }
    });
    assert(act3Res.status === 201, '3.11 Activity 3 (EMAIL_REPLY) recorded');
    assert(act3Res.data?.data?.intelligence?.score === 45, '3.12 Score updated to 45 pts');
    assert(act3Res.data?.data?.intelligence?.classification === 'WARM', '3.13 45 pts classified as WARM');
    assert(act3Res.data?.data?.intelligence?.priority === 'MEDIUM', '3.14 Priority synchronized to MEDIUM');

    // Record Activity 4: MEETING (+10 pts), DEMO_REQUEST (+25 pts) -> Total 80 -> HOT & HIGH
    await request(`/leads/${lead1.id}/activities`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        type: 'MEETING',
        description: 'Executive Architecture Review',
        occurredAt: new Date().toISOString()
      }
    });
    const act5Res = await request(`/leads/${lead1.id}/activities`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        type: 'DEMO_REQUEST',
        description: 'Second Deep-Dive Demo',
        occurredAt: new Date().toISOString()
      }
    });
    assert(act5Res.status === 201, '3.15 High intent activities recorded');
    assert(act5Res.data?.data?.intelligence?.score === 80, '3.16 Score escalated to 80 pts');
    assert(act5Res.data?.data?.intelligence?.classification === 'HOT', '3.17 80 pts classified as HOT');
    assert(act5Res.data?.data?.intelligence?.priority === 'HIGH', '3.18 Priority synchronized to HIGH');

    // -------------------------------------------------------------------------
    // TEST SUITE 4: Score Snapshot History, Structured Breakdown & Idempotency
    // -------------------------------------------------------------------------
    console.log('\n--- TEST SUITE 4: Score History & Idempotent Snapshots ---');

    // Query score history endpoint
    const historyRes = await request(`/leads/${lead1.id}/score-history`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(historyRes.status === 200, '4.1 GET /api/leads/:id/score-history returns 200');
    const history = historyRes.data?.data?.history || [];
    assert(history.length >= 4, '4.2 Score history snapshots recorded on each score change');

    // Inspect latest snapshot structured breakdown
    const latestSnapshot = history[0];
    assert(latestSnapshot.score === 80, '4.3 Latest snapshot score is 80');
    assert(latestSnapshot.breakdown !== null, '4.4 Snapshot breakdown JSON is populated');
    assert(latestSnapshot.breakdown?.classification === 'HOT', '4.5 Breakdown contains classification HOT');
    assert(latestSnapshot.breakdown?.priority === 'HIGH', '4.6 Breakdown contains priority HIGH');
    assert(Array.isArray(latestSnapshot.breakdown?.components), '4.7 Breakdown contains components array');

    // Test Idempotency: Trigger recalculate without adding activities
    const preCount = history.length;
    const recalcRes = await request(`/leads/${lead1.id}/recalculate-score`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(recalcRes.status === 200, '4.8 Manual recalculate returns 200');
    assert(recalcRes.data?.data?.scoreChanged === false, '4.9 Recalculate detects scoreChanged = false');

    const historyAfterRecalc = await prisma.leadScore.findMany({ where: { leadId: lead1.id } });
    assert(
      historyAfterRecalc.length === preCount,
      '4.10 Idempotency verified: No duplicate LeadScore created when score did not change'
    );

    // -------------------------------------------------------------------------
    // TEST SUITE 5: Stalled Lead Detection Logic
    // -------------------------------------------------------------------------
    console.log('\n--- TEST SUITE 5: Stalled Status Detection (14-day threshold) ---');

    // 5.1 Lead 1 has activities from today -> NOT stalled
    const lead1IntelRes = await request(`/leads/${lead1.id}/intelligence`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(lead1IntelRes.status === 200, '5.1 GET /leads/:id/intelligence returns 200');
    assert(lead1IntelRes.data?.data?.isStalled === false, '5.2 Active lead with recent activity is NOT stalled');
    assert(lead1IntelRes.data?.data?.daysSinceLastActivity === 0, '5.3 daysSinceLastActivity is 0');

    // 5.2 Create Lead 2 with activity 20 days ago -> IS stalled
    const lead2Res = await request('/leads', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        firstName: 'Charles',
        lastName: 'Babbage',
        email: `charles.${Date.now()}@example.com`,
        status: 'CONTACTED',
        priority: 'MEDIUM'
      }
    });
    const lead2 = lead2Res.data?.data?.lead;
    createdLeadIds.push(lead2.id);

    const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
    // Create activity dated 20 days ago
    await prisma.leadActivity.create({
      data: {
        leadId: lead2.id,
        type: 'CALL',
        description: 'Initial Discovery Call',
        occurredAt: twentyDaysAgo
      }
    });
    // Recalculate lead 2
    await ScoringService.recalculateLeadScore(lead2.id);

    const lead2IntelRes = await request(`/leads/${lead2.id}/intelligence`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(lead2IntelRes.data?.data?.isStalled === true, '5.4 Lead with 20-day-old activity IS stalled');
    assert(lead2IntelRes.data?.data?.daysSinceLastActivity >= 19, '5.5 daysSinceLastActivity is >= 19 days');
    assert(lead2IntelRes.data?.data?.stalledThresholdDays === 14, '5.6 stalledThresholdDays reported as 14');

    // 5.3 Terminal status leads (CONVERTED or LOST) are excluded from stalled tracking
    await prisma.lead.update({
      where: { id: lead2.id },
      data: { status: 'CONVERTED' }
    });
    const lead2TerminalIntel = await ScoringService.getLeadIntelligence(lead2.id, adminUser);
    assert(lead2TerminalIntel.isStalled === false, '5.7 Converted lead is excluded from stalled status');

    await prisma.lead.update({
      where: { id: lead2.id },
      data: { status: 'LOST' }
    });
    const lead2LostIntel = await ScoringService.getLeadIntelligence(lead2.id, adminUser);
    assert(lead2LostIntel.isStalled === false, '5.8 Lost lead is excluded from stalled status');

    // Restore status
    await prisma.lead.update({
      where: { id: lead2.id },
      data: { status: 'CONTACTED' }
    });

    // 5.4 Archived leads are excluded from stalled tracking
    await prisma.lead.update({
      where: { id: lead2.id },
      data: { isArchived: true }
    });
    const lead2ArchivedIntel = await ScoringService.getLeadIntelligence(lead2.id, adminUser);
    assert(lead2ArchivedIntel.isStalled === false, '5.9 Archived lead is excluded from stalled status');

    // Unarchive for further filter testing
    await prisma.lead.update({
      where: { id: lead2.id },
      data: { isArchived: false }
    });

    // -------------------------------------------------------------------------
    // TEST SUITE 6: Leads List Filtering by Classification and Stalled Status
    // -------------------------------------------------------------------------
    console.log('\n--- TEST SUITE 6: Query Filtering (classification & isStalled) ---');

    // Filter by classification=HOT (Lead 1 is HOT with score 80)
    const hotFilterRes = await request('/leads?classification=HOT', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(hotFilterRes.status === 200, '6.1 GET /leads?classification=HOT returns 200');
    const hotLeads = hotFilterRes.data?.data?.leads || [];
    assert(
      hotLeads.some((l) => l.id === lead1.id),
      '6.2 Lead 1 (score 80) is returned in classification=HOT filter'
    );
    assert(
      hotLeads.every((l) => l.score >= 70 && l.classification === 'HOT'),
      '6.3 All returned leads in HOT filter have score >= 70 and classification HOT'
    );

    // Filter by isStalled=true (Lead 2 is stalled)
    const stalledFilterRes = await request('/leads?isStalled=true', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(stalledFilterRes.status === 200, '6.4 GET /leads?isStalled=true returns 200');
    const stalledLeads = stalledFilterRes.data?.data?.leads || [];
    assert(
      stalledLeads.some((l) => l.id === lead2.id),
      '6.5 Lead 2 is returned in isStalled=true filter'
    );
    assert(
      stalledLeads.every((l) => l.isStalled === true),
      '6.6 All returned leads in isStalled=true filter have isStalled === true'
    );

    // Filter by isStalled=false (Lead 1 is active)
    const activeFilterRes = await request('/leads?isStalled=false', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(activeFilterRes.status === 200, '6.7 GET /leads?isStalled=false returns 200');
    const activeLeads = activeFilterRes.data?.data?.leads || [];
    assert(
      activeLeads.some((l) => l.id === lead1.id),
      '6.8 Lead 1 is returned in isStalled=false filter'
    );

    // -------------------------------------------------------------------------
    // TEST SUITE 7: RBAC Access Control for Intelligence & History
    // -------------------------------------------------------------------------
    console.log('\n--- TEST SUITE 7: RBAC Scoping & Permissions ---');

    // Create Lead 3 assigned to Admin (NOT rep)
    const lead3Res = await request('/leads', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        firstName: 'Grace',
        lastName: 'Hopper',
        email: `grace.${Date.now()}@example.com`,
        assignedToId: adminUser.id,
        status: 'NEW',
        priority: 'LOW'
      }
    });
    const lead3 = lead3Res.data?.data?.lead;
    createdLeadIds.push(lead3.id);

    // Rep tries to view intelligence of lead assigned to another user -> 403 Forbidden
    const repForbiddenIntel = await request(`/leads/${lead3.id}/intelligence`, {
      headers: { Authorization: `Bearer ${repToken}` }
    });
    assert(repForbiddenIntel.status === 403, '7.1 Sales Rep blocked (403) from viewing unassigned/other rep intelligence');

    // Rep tries to view score history of lead assigned to another user -> 403 Forbidden
    const repForbiddenHistory = await request(`/leads/${lead3.id}/score-history`, {
      headers: { Authorization: `Bearer ${repToken}` }
    });
    assert(repForbiddenHistory.status === 403, '7.2 Sales Rep blocked (403) from viewing other rep score history');

    // Rep views intelligence of their OWN assigned lead (Lead 1) -> 200 OK
    const repAllowedIntel = await request(`/leads/${lead1.id}/intelligence`, {
      headers: { Authorization: `Bearer ${repToken}` }
    });
    assert(repAllowedIntel.status === 200, '7.3 Sales Rep allowed (200) to view assigned lead intelligence');

    // Rep tries to trigger batch recalculation -> 403 Forbidden
    const repBatchRes = await request('/leads/recalculate-scores', {
      method: 'POST',
      headers: { Authorization: `Bearer ${repToken}` }
    });
    assert(repBatchRes.status === 403, '7.4 Sales Rep forbidden (403) from batch recalculation');

    // -------------------------------------------------------------------------
    // TEST SUITE 8: Batch Recalculation (Admin & Manager)
    // -------------------------------------------------------------------------
    console.log('\n--- TEST SUITE 8: Batch Recalculation API ---');

    // Admin runs batch recalculate
    const adminBatchRes = await request('/leads/recalculate-scores', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(adminBatchRes.status === 200, '8.1 Admin successfully runs POST /leads/recalculate-scores (200)');
    assert(
      typeof adminBatchRes.data?.data?.totalProcessed === 'number',
      '8.2 Batch recalculation returns totalProcessed count'
    );

    // Manager runs batch recalculate
    const managerBatchRes = await request('/leads/recalculate-scores', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` }
    });
    assert(managerBatchRes.status === 200, '8.3 Sales Manager successfully runs batch recalculation (200)');

    // -------------------------------------------------------------------------
    // TEST SUITE 9: PostgreSQL Audit Logging
    // -------------------------------------------------------------------------
    console.log('\n--- TEST SUITE 9: PostgreSQL Audit Trail Verification ---');

    // Check LEAD_SCORE_CHANGED audit log
    const scoreAudit = await prisma.auditLog.findFirst({
      where: {
        action: 'LEAD_SCORE_CHANGED',
        entityId: lead1.id
      },
      orderBy: { createdAt: 'desc' }
    });
    assert(scoreAudit !== null, '9.1 LEAD_SCORE_CHANGED audit log recorded');
    assert(
      scoreAudit?.metadata?.classification !== undefined,
      '9.2 Score change audit log contains classification metadata'
    );
    assert(
      typeof scoreAudit?.metadata?.newScore === 'number',
      '9.3 Score change audit log contains newScore numeric metadata'
    );

    // Check BATCH_SCORES_RECALCULATED audit log
    const batchAudit = await prisma.auditLog.findFirst({
      where: { action: 'BATCH_SCORES_RECALCULATED' },
      orderBy: { createdAt: 'desc' }
    });
    assert(batchAudit !== null, '9.4 BATCH_SCORES_RECALCULATED audit log recorded');
    assert(
      typeof batchAudit?.metadata?.totalProcessed === 'number',
      '9.5 Batch recalculation audit log contains totalProcessed metadata'
    );
  } catch (err) {
    console.error('Unexpected error during verification:', err);
    failedTests++;
  } finally {
    // Cleanup created test records
    console.log('\n--- Cleaning up test records ---');
    try {
      if (createdLeadIds.length > 0) {
        await prisma.leadScore.deleteMany({ where: { leadId: { in: createdLeadIds } } });
        await prisma.leadActivity.deleteMany({ where: { leadId: { in: createdLeadIds } } });
        await prisma.dealStageHistory.deleteMany({
          where: { deal: { leadId: { in: createdLeadIds } } }
        });
        await prisma.deal.deleteMany({ where: { leadId: { in: createdLeadIds } } });
        await prisma.auditLog.deleteMany({ where: { entityId: { in: createdLeadIds } } });
        await prisma.lead.deleteMany({ where: { id: { in: createdLeadIds } } });
      }
      if (testCompanyId) {
        await prisma.company.delete({ where: { id: testCompanyId } }).catch(() => {});
      }
      console.log('Test records successfully cleaned up.');
    } catch (cleanupErr) {
      console.warn('Cleanup warning:', cleanupErr.message);
    }

    server.close();
    await disconnectPrisma();
  }

  console.log('\n========================================================');
  console.log(`Phase 6 Verification Results: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('========================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runVerification();
