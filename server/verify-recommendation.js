// ========================================================
// Phase 7 Next-Best-Action Recommendation Engine Verification
// ========================================================
// Tests:
// 1. Deterministic Rule Matrix: Unit tests for all rules A-E and rule precedence
// 2. Ineligible lead exclusions: Archived, CONVERTED, and LOST leads
// 3. Authenticated Setup & RBAC roles
// 4. Real-time recommendation generation on activity logging & lead creation
// 5. Idempotent evaluation: duplicate prevention and pending supersession
// 6. Recommendation lifecycle state machine (PENDING -> ACCEPTED -> EXECUTED / DISMISSED)
// 7. Auto-dismissal when lead is converted to a deal or archived
// 8. Querying, filtering, and summary metrics (/api/recommendations)
// 9. Lead-level recommendation endpoints (/api/leads/:id/recommendations)
// 10. RBAC scoping: Sales Rep restricted vs Admin/Manager privileges
// 11. PostgreSQL Audit Trail: RECOMMENDATION_GENERATED, ACCEPTED, DISMISSED, EXECUTED, BATCH_REFRESHED

import http from 'http';
import app from './src/app.js';
import { getPrismaClient, disconnectPrisma } from './src/config/prisma.js';
import {
  RECOMMENDATION_TYPES,
  RECOMMENDATION_STATUSES,
  RECOMMENDATION_RULES,
  RULE_PRECEDENCE,
  ALLOWED_STATUS_TRANSITIONS
} from './src/config/recommendation.config.js';
import { RecommendationService } from './src/services/recommendation.service.js';

const TEST_PORT = 5007;
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
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n========================================================');
  console.log('Starting Phase 7 Next-Best-Action Recommendation Engine Verification');
  console.log('========================================================\n');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`Test server running on port ${TEST_PORT}`);

  const prisma = getPrismaClient();

  const createdLeadIds = [];
  const createdCompanyIds = [];
  const createdDealIds = [];

  try {
    // ========================================================
    // TEST SUITE 1: Deterministic Pure Rule Matrix Unit Tests
    // ========================================================
    console.log('\n--- TEST SUITE 1: Pure Rule Matrix & Precedence Unit Tests ---');

    // Rule 1: SCHEDULE_DEMO from DEMO_REQUEST
    const leadDemoReq = {
      id: 'mock-1',
      status: 'NEW',
      score: 30,
      priority: 'LOW',
      isArchived: false,
      createdAt: new Date()
    };
    const actDemo = [{ type: 'DEMO_REQUEST', occurredAt: new Date() }];
    const evalDemo = RecommendationService.evaluateLeadRecommendation(leadDemoReq, actDemo, []);
    assert(evalDemo !== null, '1.1 Demo request generates recommendation');
    assert(evalDemo.type === RECOMMENDATION_TYPES.SCHEDULE_DEMO, '1.2 Evaluates to SCHEDULE_DEMO type');
    assert(evalDemo.confidence === 0.95, '1.3 Confidence is 0.95 for direct demo request');
    assert(evalDemo.metadata.ruleId === 'RULE_SCHEDULE_DEMO', '1.4 Rule ID is RULE_SCHEDULE_DEMO');

    // Rule 1b: SCHEDULE_DEMO from Hot score + pricing views
    const leadHotPricing = {
      id: 'mock-2',
      status: 'CONTACTED',
      score: 80,
      priority: 'HIGH',
      isArchived: false,
      createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    };
    const actPricing = [
      { type: 'PRICING_PAGE_VIEW', occurredAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) }
    ];
    const evalHotPricing = RecommendationService.evaluateLeadRecommendation(leadHotPricing, actPricing, []);
    assert(evalHotPricing !== null, '1.5 Hot score + pricing view generates recommendation');
    assert(evalHotPricing.type === RECOMMENDATION_TYPES.SCHEDULE_DEMO, '1.6 Type is SCHEDULE_DEMO for hot lead');
    assert(evalHotPricing.confidence === 0.90, '1.7 Confidence is 0.90 for hot pricing interest');

    // Rule 2: REVIEW_STALLED_LEAD (14+ days inactive)
    const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
    const leadStalled = {
      id: 'mock-3',
      status: 'CONTACTED',
      score: 20,
      priority: 'LOW',
      isArchived: false,
      createdAt: twentyDaysAgo
    };
    const actOld = [{ type: 'CALL', occurredAt: twentyDaysAgo }];
    const evalStalled = RecommendationService.evaluateLeadRecommendation(leadStalled, actOld, []);
    assert(evalStalled !== null, '1.8 Inactive lead triggers recommendation');
    assert(evalStalled.type === RECOMMENDATION_TYPES.REVIEW_STALLED_LEAD, '1.9 Type is REVIEW_STALLED_LEAD');
    assert(evalStalled.confidence === 0.90, '1.10 Confidence is 0.90 for stalled lead');
    assert(evalStalled.metadata.daysSinceLastActivity >= 19, '1.11 Metadata contains daysSinceLastActivity');

    // Rule 3: CONTACT_LEAD (New lead with zero contact)
    const leadNew = {
      id: 'mock-4',
      status: 'NEW',
      score: 10,
      priority: 'LOW',
      isArchived: false,
      createdAt: new Date()
    };
    const actPassive = [{ type: 'WEBSITE_VISIT', occurredAt: new Date() }];
    const evalNew = RecommendationService.evaluateLeadRecommendation(leadNew, actPassive, []);
    assert(evalNew !== null, '1.12 New uncontacted lead triggers recommendation');
    assert(evalNew.type === RECOMMENDATION_TYPES.CONTACT_LEAD, '1.13 Type is CONTACT_LEAD');
    assert(evalNew.confidence === 0.85, '1.14 Confidence is 0.85 for new lead');

    // Rule 4: SEND_FOLLOW_UP (Contacted lead with 4 days inactivity)
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
    const leadFollowUp = {
      id: 'mock-5',
      status: 'CONTACTED',
      score: 45,
      priority: 'MEDIUM',
      isArchived: false,
      createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
    };
    const actContacted = [{ type: 'CALL', occurredAt: fourDaysAgo }];
    const evalFollowUp = RecommendationService.evaluateLeadRecommendation(leadFollowUp, actContacted, []);
    assert(evalFollowUp !== null, '1.15 Contacted lead with elapsed interval triggers follow-up');
    assert(evalFollowUp.type === RECOMMENDATION_TYPES.SEND_FOLLOW_UP, '1.16 Type is SEND_FOLLOW_UP');
    assert(evalFollowUp.confidence === 0.80, '1.17 Confidence is 0.80 for follow-up');

    // Rule 5: OTHER - Convert to Deal
    const yesterday = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
    const leadQualified = {
      id: 'mock-6',
      status: 'QUALIFIED',
      score: 75,
      priority: 'HIGH',
      isArchived: false,
      createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
    };
    const actRecent = [
      { type: 'MEETING', occurredAt: yesterday }
    ];
    const evalConvert = RecommendationService.evaluateLeadRecommendation(leadQualified, actRecent, []);
    assert(evalConvert !== null, '1.18 Qualified lead with no deal triggers recommendation');
    assert(evalConvert.type === RECOMMENDATION_TYPES.OTHER, '1.19 Type is OTHER for deal acceleration');
    assert(evalConvert.confidence === 0.82, '1.20 Confidence is 0.82 for deal conversion');

    // Precedence Test: Demo request vs Stalled Lead
    // If a lead hasn't had activity in 20 days BUT logged a demo request today, SCHEDULE_DEMO wins
    const actMixed = [
      { type: 'CALL', occurredAt: twentyDaysAgo },
      { type: 'DEMO_REQUEST', occurredAt: new Date() }
    ];
    const evalPrecedence = RecommendationService.evaluateLeadRecommendation(leadDemoReq, actMixed, []);
    assert(evalPrecedence.type === RECOMMENDATION_TYPES.SCHEDULE_DEMO, '1.21 SCHEDULE_DEMO takes precedence over stalled review');

    // Ineligible leads test
    const leadArchived = { ...leadDemoReq, isArchived: true };
    const evalArchived = RecommendationService.evaluateLeadRecommendation(leadArchived, actDemo, []);
    assert(evalArchived === null, '1.22 Archived lead returns null (excluded)');

    const leadConverted = { ...leadDemoReq, status: 'CONVERTED' };
    const evalConverted = RecommendationService.evaluateLeadRecommendation(leadConverted, actDemo, []);
    assert(evalConverted === null, '1.23 Converted lead returns null (excluded)');

    const leadLost = { ...leadDemoReq, status: 'LOST' };
    const evalLost = RecommendationService.evaluateLeadRecommendation(leadLost, actDemo, []);
    assert(evalLost === null, '1.24 Lost lead returns null (excluded)');

    // ========================================================
    // TEST SUITE 2: Authenticated Setup & Logins
    // ========================================================
    console.log('\n--- TEST SUITE 2: Authenticated Setup & User Logins ---');

    const adminLogin = await request('/auth/login', {
      method: 'POST',
      body: { email: 'dev.admin@example.com', password: 'DevPassword123!' }
    });
    assert(adminLogin.status === 200, '2.1 Admin login successful (200)');
    const adminToken = adminLogin.data.data.token;
    const adminUser = adminLogin.data.data.user;

    const repLogin = await request('/auth/login', {
      method: 'POST',
      body: { email: 'dev.rep@example.com', password: 'DevPassword123!' }
    });
    assert(repLogin.status === 200, '2.2 Sales Rep login successful (200)');
    const repToken = repLogin.data.data.token;
    const repUser = repLogin.data.data.user;

    const managerLogin = await request('/auth/login', {
      method: 'POST',
      body: { email: 'dev.manager@example.com', password: 'DevPassword123!' }
    });
    assert(managerLogin.status === 200, '2.3 Sales Manager login successful (200)');
    const managerToken = managerLogin.data.data.token;

    // Create shared test company
    const compRes = await request('/companies', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        name: `Recommendation Test Corp ${Date.now()}`,
        industry: 'Software',
        website: 'https://recommend-test.example.com'
      }
    });
    assert(compRes.status === 201, '2.4 Test company created');
    const company = compRes.data?.data?.company || compRes.data?.company;
    createdCompanyIds.push(company.id);

    // ========================================================
    // TEST SUITE 3: Real-Time Generation & Idempotency
    // ========================================================
    console.log('\n--- TEST SUITE 3: Real-Time Generation on Activity & Idempotency ---');

    // Create a new lead
    const lead1Res = await request('/leads', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        firstName: 'Sarah',
        lastName: 'Connor',
        email: `sarah.connor.${Date.now()}@example.com`,
        phone: `+1-555-${Math.floor(1000000 + Math.random() * 9000000)}`,
        companyId: company.id,
        assignedToId: repUser.id
      }
    });
    assert(lead1Res.status === 201, '3.1 Lead created');
    const lead1 = lead1Res.data?.data?.lead || lead1Res.data?.lead;
    createdLeadIds.push(lead1.id);

    // Initial recommendation should be generated automatically
    const lead1Recs = await request(`/leads/${lead1.id}/recommendations`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(lead1Recs.status === 200, '3.2 GET /leads/:id/recommendations returns 200');
    const initialRecs = lead1Recs.data.data.recommendations;
    assert(initialRecs.length === 1, '3.3 Lead has 1 initial recommendation');
    assert(initialRecs[0].type === RECOMMENDATION_TYPES.CONTACT_LEAD, '3.4 Initial recommendation is CONTACT_LEAD');
    assert(initialRecs[0].status === 'PENDING', '3.5 Recommendation status is PENDING');

    const firstRecId = initialRecs[0].id;

    // Idempotency: Trigger generation again without data change
    const genAgain = await request(`/leads/${lead1.id}/recommendations/generate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(genAgain.status === 200, '3.6 Force re-evaluation returns 200');
    assert(genAgain.data.data.action === 'REUSED_EXISTING', '3.7 Idempotency: Reused existing recommendation');
    assert(genAgain.data.data.recommendation.id === firstRecId, '3.8 Existing recommendation ID preserved');

    // Log DEMO_REQUEST activity -> Triggers higher precedence SCHEDULE_DEMO
    const actRes = await request(`/leads/${lead1.id}/activities`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        type: 'DEMO_REQUEST',
        description: 'Requested full product walkthrough demo'
      }
    });
    assert(actRes.status === 201, '3.9 Activity DEMO_REQUEST created');
    assert(actRes.data.data.recommendation !== null, '3.10 Activity response includes updated recommendation');
    assert(
      actRes.data.data.recommendation.type === RECOMMENDATION_TYPES.SCHEDULE_DEMO,
      '3.11 Recommendation superseded to SCHEDULE_DEMO'
    );
    assert(actRes.data.data.recommendation.confidence === 0.95, '3.12 Confidence escalated to 0.95');

    // Verify old CONTACT_LEAD was superseded/marked DISMISSED in database
    const oldRec = await prisma.recommendation.findUnique({
      where: { id: firstRecId }
    });
    assert(oldRec.status === 'DISMISSED', '3.13 Prior recommendation automatically superseded to DISMISSED');
    assert(oldRec.metadata?.supersededBy === 'RULE_SCHEDULE_DEMO', '3.14 Superseded metadata recorded');

    // ========================================================
    // TEST SUITE 4: Lifecycle State Machine Transitions
    // ========================================================
    console.log('\n--- TEST SUITE 4: Lifecycle State Machine Transitions ---');

    const currentRec = actRes.data.data.recommendation;

    // Transition 1: PENDING -> ACCEPTED
    const acceptRes = await request(`/recommendations/${currentRec.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${repToken}` },
      body: { status: 'ACCEPTED', reason: 'Sales rep accepted demo task' }
    });
    assert(acceptRes.status === 200, '4.1 PENDING -> ACCEPTED transition successful (200)');
    assert(acceptRes.data.data.recommendation.status === 'ACCEPTED', '4.2 Status updated to ACCEPTED');
    assert(
      acceptRes.data.data.recommendation.metadata?.lastStatusUpdate?.reason === 'Sales rep accepted demo task',
      '4.3 Transition note stored in metadata'
    );

    // Invalid transition: ACCEPTED cannot transition directly to PENDING
    const invalidTrans = await request(`/recommendations/${currentRec.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${repToken}` },
      body: { status: 'PENDING' }
    });
    assert(invalidTrans.status === 400, '4.4 Invalid state transition rejected with 400 Bad Request');

    // Transition 2: ACCEPTED -> EXECUTED
    const executeRes = await request(`/recommendations/${currentRec.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${repToken}` },
      body: { status: 'EXECUTED' }
    });
    assert(executeRes.status === 200, '4.5 ACCEPTED -> EXECUTED transition successful (200)');
    assert(executeRes.data.data.recommendation.status === 'EXECUTED', '4.6 Status updated to EXECUTED');

    // Terminal state: EXECUTED cannot transition to anything
    const postExecTrans = await request(`/recommendations/${currentRec.id}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${repToken}` },
      body: { status: 'DISMISSED' }
    });
    assert(postExecTrans.status === 400, '4.7 Terminal EXECUTED state cannot transition (400 Bad Request)');

    // ========================================================
    // TEST SUITE 5: Automatic Dismissals on Lead Conversion & Archive
    // ========================================================
    console.log('\n--- TEST SUITE 5: Auto-Dismissals on Lead Conversion & Archive ---');

    // Create Lead 2
    const lead2Res = await request('/leads', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        firstName: 'John',
        lastName: 'Vance',
        email: `john.vance.${Date.now()}@example.com`,
        companyId: company.id,
        assignedToId: repUser.id
      }
    });
    assert(lead2Res.status === 201, '5.1 Lead 2 created');
    const lead2 = lead2Res.data?.data?.lead || lead2Res.data?.lead;
    createdLeadIds.push(lead2.id);

    // Verify Lead 2 has pending recommendation
    const lead2Recs = await request(`/leads/${lead2.id}/recommendations`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const lead2Pending = lead2Recs.data?.data?.recommendations?.[0] || lead2Recs.data?.recommendations?.[0];
    assert(lead2Pending.status === 'PENDING', '5.2 Lead 2 has PENDING recommendation');

    // Convert Lead 2 to Deal
    const convertRes = await request(`/leads/${lead2.id}/convert`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        title: `Enterprise Cloud Deal ${Date.now()}`,
        value: 50000,
        currency: 'USD'
      }
    });
    assert(convertRes.status === 201, '5.3 Lead 2 converted to deal (201)');
    const dealObj = convertRes.data?.data?.deal || convertRes.data?.deal;
    createdDealIds.push(dealObj.id);

    // Verify pending recommendation was automatically auto-dismissed
    const postConvertRec = await prisma.recommendation.findUnique({
      where: { id: lead2Pending.id }
    });
    assert(postConvertRec.status === 'DISMISSED', '5.4 Pending recommendation auto-dismissed on deal conversion');
    assert(
      postConvertRec.metadata?.autoDismissReason === 'Lead converted to deal',
      '5.5 Auto-dismiss reason recorded'
    );

    // Create Lead 3
    const lead3Res = await request('/leads', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        firstName: 'Marcus',
        lastName: 'Wright',
        email: `marcus.wright.${Date.now()}@example.com`,
        companyId: company.id
      }
    });
    assert(lead3Res.status === 201, '5.6 Lead 3 created');
    const lead3 = lead3Res.data?.data?.lead || lead3Res.data?.lead;
    createdLeadIds.push(lead3.id);

    const lead3Recs = await request(`/leads/${lead3.id}/recommendations`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const lead3Pending = lead3Recs.data?.data?.recommendations?.[0] || lead3Recs.data?.recommendations?.[0];
    assert(lead3Pending.status === 'PENDING', '5.7 Lead 3 has PENDING recommendation');

    // Archive Lead 3
    const archiveRes = await request(`/leads/${lead3.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(archiveRes.status === 200, '5.8 Lead 3 archived (200)');

    const postArchiveRec = await prisma.recommendation.findUnique({
      where: { id: lead3Pending.id }
    });
    assert(postArchiveRec.status === 'DISMISSED', '5.9 Pending recommendation auto-dismissed on lead archive');

    // ========================================================
    // TEST SUITE 6: Querying, Filtering & Metrics
    // ========================================================
    console.log('\n--- TEST SUITE 6: Querying, Filtering & Summary Metrics ---');

    // Create Lead 4 to ensure active pending item
    const lead4Res = await request('/leads', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        firstName: 'Kyle',
        lastName: 'Reese',
        email: `kyle.reese.${Date.now()}@example.com`,
        companyId: company.id,
        assignedToId: repUser.id
      }
    });
    assert(lead4Res.status === 201, '6.1 Lead 4 created');
    const lead4 = lead4Res.data?.data?.lead || lead4Res.data?.lead;
    createdLeadIds.push(lead4.id);

    // List all recommendations
    const allRecsRes = await request('/recommendations', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(allRecsRes.status === 200, '6.2 GET /recommendations returns 200');
    assert(Array.isArray(allRecsRes.data.data.data), '6.3 Data is an array');
    assert(allRecsRes.data.data.pagination !== undefined, '6.4 Pagination metadata returned');
    assert(allRecsRes.data.data.metrics !== undefined, '6.5 Summary metrics returned');
    assert(typeof allRecsRes.data.data.metrics.totalPending === 'number', '6.6 totalPending numeric metric returned');
    assert(typeof allRecsRes.data.data.metrics.highConfidenceCount === 'number', '6.7 highConfidenceCount returned');

    // Filter by status=PENDING
    const pendingFilterRes = await request('/recommendations?status=PENDING', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(pendingFilterRes.status === 200, '6.8 Status filter returns 200');
    const onlyPending = pendingFilterRes.data.data.data;
    assert(onlyPending.every((r) => r.status === 'PENDING'), '6.9 All returned items have status=PENDING');

    // Search by title or lead name
    const searchRes = await request('/recommendations?search=Kyle', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(searchRes.status === 200, '6.10 Search query returns 200');
    assert(
      searchRes.data.data.data.some((r) => r.lead?.firstName === 'Kyle'),
      '6.11 Search matches Kyle lead contact'
    );

    // ========================================================
    // TEST SUITE 7: RBAC Scoping & Authorization
    // ========================================================
    console.log('\n--- TEST SUITE 7: RBAC Scoping & Permissions ---');

    // Sales Rep can view recommendations for their assigned lead
    const repSelfAccess = await request('/recommendations', {
      headers: { Authorization: `Bearer ${repToken}` }
    });
    assert(repSelfAccess.status === 200, '7.1 Sales Rep successfully queries recommendations (200)');

    // Create a lead assigned to a DIFFERENT user (Admin)
    const adminLeadRes = await request('/leads', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        firstName: 'Private',
        lastName: 'Contact',
        email: `private.contact.${Date.now()}@example.com`,
        companyId: company.id,
        assignedToId: adminUser.id // explicitly assigned to admin
      }
    });
    assert(adminLeadRes.status === 201, '7.2 Private lead created assigned to Admin');
    const privateLead = adminLeadRes.data?.data?.lead || adminLeadRes.data?.lead;
    createdLeadIds.push(privateLead.id);

    // Sales Rep querying specific private lead recommendations should be blocked (403)
    const repBlockedLead = await request(`/leads/${privateLead.id}/recommendations`, {
      headers: { Authorization: `Bearer ${repToken}` }
    });
    assert(repBlockedLead.status === 403, '7.3 Sales Rep blocked (403) from other rep lead recommendations');

    // Sales Rep blocked from Batch Refresh (403)
    const repBatchBlock = await request('/recommendations/batch-refresh', {
      method: 'POST',
      headers: { Authorization: `Bearer ${repToken}` }
    });
    assert(repBatchBlock.status === 403, '7.4 Sales Rep forbidden (403) from batch recalculation');

    // Admin allowed to run Batch Refresh (200)
    const adminBatch = await request('/recommendations/batch-refresh', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(adminBatch.status === 200, '7.5 Admin successfully runs batch recalculation (200)');
    assert(adminBatch.data.data.totalProcessed >= 1, '7.6 Total processed count returned');

    // Sales Manager allowed to run Batch Refresh (200)
    const managerBatch = await request('/recommendations/batch-refresh', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managerToken}` }
    });
    assert(managerBatch.status === 200, '7.7 Sales Manager successfully runs batch recalculation (200)');

    // ========================================================
    // TEST SUITE 8: PostgreSQL Audit Trail Verification
    // ========================================================
    console.log('\n--- TEST SUITE 8: PostgreSQL Audit Trail Verification ---');

    const auditGenerated = await prisma.auditLog.findFirst({
      where: { action: 'RECOMMENDATION_GENERATED' }
    });
    assert(auditGenerated !== null, '8.1 RECOMMENDATION_GENERATED audit log recorded');
    assert(auditGenerated.metadata?.ruleId !== undefined, '8.2 Generated audit log includes ruleId metadata');

    const auditAccepted = await prisma.auditLog.findFirst({
      where: { action: 'RECOMMENDATION_ACCEPTED' }
    });
    assert(auditAccepted !== null, '8.3 RECOMMENDATION_ACCEPTED audit log recorded');

    const auditExecuted = await prisma.auditLog.findFirst({
      where: { action: 'RECOMMENDATION_EXECUTED' }
    });
    assert(auditExecuted !== null, '8.4 RECOMMENDATION_EXECUTED audit log recorded');

    const auditDismissed = await prisma.auditLog.findFirst({
      where: { action: 'RECOMMENDATION_DISMISSED' }
    });
    assert(auditDismissed !== null, '8.5 RECOMMENDATION_DISMISSED audit log recorded');

    const auditBatch = await prisma.auditLog.findFirst({
      where: { action: 'BATCH_RECOMMENDATIONS_REFRESHED' }
    });
    assert(auditBatch !== null, '8.6 BATCH_RECOMMENDATIONS_REFRESHED audit log recorded');

  } catch (error) {
    console.error('Unexpected test exception:', error);
    failed++;
  } finally {
    // Clean up test records
    console.log('\n--- Cleaning up test records ---');
    try {
      if (createdDealIds.length > 0) {
        await prisma.dealStageHistory.deleteMany({
          where: { dealId: { in: createdDealIds } }
        });
        await prisma.deal.deleteMany({
          where: { id: { in: createdDealIds } }
        });
      }
      if (createdLeadIds.length > 0) {
        await prisma.leadActivity.deleteMany({
          where: { leadId: { in: createdLeadIds } }
        });
        await prisma.leadScore.deleteMany({
          where: { leadId: { in: createdLeadIds } }
        });
        await prisma.recommendation.deleteMany({
          where: { leadId: { in: createdLeadIds } }
        });
        await prisma.lead.deleteMany({
          where: { id: { in: createdLeadIds } }
        });
      }
      if (createdCompanyIds.length > 0) {
        await prisma.company.deleteMany({
          where: { id: { in: createdCompanyIds } }
        });
      }
      console.log('Test records successfully cleaned up.');
    } catch (cleanupErr) {
      console.error('Error during cleanup:', cleanupErr.message);
    }

    await new Promise((resolve) => server.close(resolve));
    await disconnectPrisma();
  }

  console.log('\n========================================================');
  console.log(`Phase 7 Verification Results: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
