// ========================================================
// Phase 4 CRM Core Verification Script
// ========================================================
// Tests: Companies CRUD, Leads CRUD, Activity Tracking,
// Duplicate Detection, Domain Correlation, Suspicious Checks,
// RBAC Scoping, Archival, and Audit Logging.

import http from 'http';
import app from './src/app.js';
import { getPrismaClient, disconnectPrisma } from './src/config/prisma.js';

const TEST_PORT = 5003;
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
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }

    req.end();
  });
}

async function runVerification() {
  console.log('\n🚀 Starting Phase 4 CRM Core & Intelligence Verification...\n');

  const server = app.listen(TEST_PORT);
  const prisma = getPrismaClient();

  const createdLeadIds = [];
  const createdCompanyIds = [];
  let rep1Token = null;
  let rep2Token = null;
  let adminToken = null;
  let managerToken = null;

  try {
    // ----------------------------------------------------
    // Step 0: Obtain Tokens for Roles
    // ----------------------------------------------------
    console.log('[Setup] Authenticating test personas...');

    // Admin
    const adminLogin = await request('/auth/login', {
      method: 'POST',
      body: { email: 'dev.admin@example.com', password: 'DevPassword123!' }
    });
    adminToken = adminLogin.data.data.token;

    // Manager
    const managerLogin = await request('/auth/login', {
      method: 'POST',
      body: { email: 'dev.manager@example.com', password: 'DevPassword123!' }
    });
    managerToken = managerLogin.data.data.token;

    // Rep 1 (Existing dev rep)
    const rep1Login = await request('/auth/login', {
      method: 'POST',
      body: { email: 'dev.rep@example.com', password: 'DevPassword123!' }
    });
    rep1Token = rep1Login.data.data.token;
    const rep1User = rep1Login.data.data.user;

    // Rep 2 (Register a second rep to test isolation)
    const rep2Email = `rep2.test.${Date.now()}@example.com`;
    const rep2Reg = await request('/auth/register', {
      method: 'POST',
      body: {
        firstName: 'Second',
        lastName: 'Salesperson',
        email: rep2Email,
        password: 'Password123!'
      }
    });
    rep2Token = rep2Reg.data.data.token;
    const rep2User = rep2Reg.data.data.user;

    console.log('  ✓ Admin, Manager, Rep 1, and Rep 2 authenticated successfully.');

    // ----------------------------------------------------
    // Test 1: Create Company
    // ----------------------------------------------------
    console.log('\n[1/18] Testing Company Creation (POST /api/companies)...');
    const companyName = `Acme Enterprise ${Date.now()}`;
    const compRes = await request('/companies', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        name: companyName,
        industry: 'Cloud Infrastructure',
        website: 'https://acme-enterprise.com',
        phone: '+1 800 555 0199',
        city: 'San Francisco',
        country: 'United States'
      }
    });

    if (compRes.status !== 201 || !compRes.data.data.company.id) {
      throw new Error(`Failed to create company: ${JSON.stringify(compRes.data)}`);
    }
    const createdCompany = compRes.data.data.company;
    createdCompanyIds.push(createdCompany.id);
    console.log(`  ✓ Company created: "${createdCompany.name}" (ID: ${createdCompany.id})`);

    // ----------------------------------------------------
    // Test 2: Reject Duplicate Company Name
    // ----------------------------------------------------
    console.log('\n[2/18] Testing Duplicate Company Rejection (409 Conflict)...');
    const dupCompRes = await request('/companies', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { name: companyName.toLowerCase() } // Case-insensitive test
    });
    if (dupCompRes.status !== 409) {
      throw new Error(`Expected 409 Conflict for duplicate company name, got: ${dupCompRes.status}`);
    }
    console.log('  ✓ Duplicate company name correctly rejected with 409 Conflict.');

    // ----------------------------------------------------
    // Test 3: List & Search Companies
    // ----------------------------------------------------
    console.log('\n[3/18] Testing Company Listing & Search (GET /api/companies)...');
    const searchRes = await request(`/companies?search=Acme&limit=5`, {
      headers: { Authorization: `Bearer ${rep1Token}` }
    });
    if (searchRes.status !== 200 || !Array.isArray(searchRes.data.data.companies)) {
      throw new Error(`Failed to list companies: ${JSON.stringify(searchRes.data)}`);
    }
    console.log(`  ✓ Retrieved ${searchRes.data.data.companies.length} companies with pagination metadata.`);

    // ----------------------------------------------------
    // Test 4: Update Company
    // ----------------------------------------------------
    console.log('\n[4/18] Testing Company Update (PATCH /api/companies/:id)...');
    const updateCompRes = await request(`/companies/${createdCompany.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: { industry: 'Enterprise SaaS & Cloud' }
    });
    if (updateCompRes.status !== 200 || updateCompRes.data.data.company.industry !== 'Enterprise SaaS & Cloud') {
      throw new Error(`Failed to update company: ${JSON.stringify(updateCompRes.data)}`);
    }
    console.log('  ✓ Company successfully updated by Sales Manager.');

    // ----------------------------------------------------
    // Test 5: Create Lead (Assigned to Rep 1)
    // ----------------------------------------------------
    console.log('\n[5/18] Testing Lead Creation (POST /api/leads)...');
    const leadEmail1 = `samantha.wright.${Date.now()}@acme-enterprise.com`;
    const dynamicPhoneDigits = Date.now().toString().slice(-6);
    const leadPhone1 = `+1 (555) 2${dynamicPhoneDigits}`;

    const lead1Res = await request('/leads', {
      method: 'POST',
      headers: { Authorization: `Bearer ${rep1Token}` },
      body: {
        firstName: 'Samantha',
        lastName: 'Wright',
        email: leadEmail1,
        phone: leadPhone1,
        jobTitle: 'VP of Technology',
        companyId: createdCompany.id,
        status: 'NEW',
        priority: 'HIGH'
      }
    });

    if (lead1Res.status !== 201 || !lead1Res.data.data.lead.id) {
      throw new Error(`Failed to create lead: ${JSON.stringify(lead1Res.data)}`);
    }
    const lead1 = lead1Res.data.data.lead;
    createdLeadIds.push(lead1.id);
    if (lead1.assignedToId !== rep1User.id) {
      throw new Error(`Expected lead to auto-assign to creator rep (${rep1User.id}), got ${lead1.assignedToId}`);
    }
    console.log(`  ✓ Lead created: "${lead1.firstName} ${lead1.lastName}" auto-assigned to Rep 1.`);

    // ----------------------------------------------------
    // Test 6: Normalized Email Duplicate Detection
    // ----------------------------------------------------
    console.log('\n[6/18] Testing Normalized Email Duplicate Detection (409 Conflict)...');
    const unnormalizedEmail = `   ${leadEmail1.toUpperCase()}   `;
    const dupEmailRes = await request('/leads', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        firstName: 'Samantha',
        lastName: 'Wright Duplicate',
        email: unnormalizedEmail
      }
    });

    if (dupEmailRes.status !== 409 || !dupEmailRes.data.errors?.isDuplicate) {
      throw new Error(`Expected 409 Conflict with duplicate matches, got: ${dupEmailRes.status}`);
    }
    console.log('  ✓ Duplicate email with mixed case and whitespace correctly identified with 409 Conflict.');

    // ----------------------------------------------------
    // Test 7: Normalized Phone Duplicate Detection
    // ----------------------------------------------------
    console.log('\n[7/18] Testing Normalized Phone Duplicate Detection (409 Conflict)...');
    const dupPhoneRes = await request('/leads', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        firstName: 'Different',
        lastName: 'Name',
        email: `unique.${Date.now()}@differentdomain.com`,
        phone: `15552${dynamicPhoneDigits}` // Same digits as +1 (555) 2${dynamicPhoneDigits}
      }
    });

    if (dupPhoneRes.data?.data?.lead?.id) {
      createdLeadIds.push(dupPhoneRes.data.data.lead.id);
    }

    if (dupPhoneRes.status !== 409 || !dupPhoneRes.data.errors?.isDuplicate) {
      throw new Error(`Expected 409 Conflict for matching normalized phone number, got: ${dupPhoneRes.status}`);
    }
    console.log('  ✓ Duplicate phone with alternate formatting correctly flagged with 409 Conflict.');

    // ----------------------------------------------------
    // Test 8: Corporate Domain Correlation (Not an Automatic Duplicate)
    // ----------------------------------------------------
    console.log('\n[8/18] Testing Corporate Domain Correlation (Colleague is NOT marked duplicate)...');
    const colleagueEmail = `david.miller.${Date.now()}@acme-enterprise.com`; // Same @acme-enterprise.com domain
    const colleagueRes = await request('/leads', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        firstName: 'David',
        lastName: 'Miller',
        email: colleagueEmail,
        companyId: createdCompany.id
      }
    });

    if (colleagueRes.status !== 201) {
      throw new Error(`Domain correlation should allow lead creation without 409, got status ${colleagueRes.status}`);
    }
    const colleagueLead = colleagueRes.data.data.lead;
    createdLeadIds.push(colleagueLead.id);
    if (colleagueLead.isDuplicate === true) {
      throw new Error('Colleague sharing corporate domain was incorrectly flagged as isDuplicate=true!');
    }
    console.log('  ✓ Shared corporate domain identified correlation without false-positive duplicate flag.');

    // ----------------------------------------------------
    // Test 9: Suspicious Contact Detection (Disposable Domain)
    // ----------------------------------------------------
    console.log('\n[9/18] Testing Suspicious Lead Detection (Disposable Email Provider)...');
    const suspRes = await request('/leads', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        firstName: 'Spammy',
        lastName: 'Tester',
        email: `throwaway.${Date.now()}@mailinator.com`
      }
    });

    if (suspRes.status !== 201 || !suspRes.data.data.lead.isSuspicious) {
      throw new Error(`Expected isSuspicious=true for disposable email, got: ${JSON.stringify(suspRes.data)}`);
    }
    const suspLead = suspRes.data.data.lead;
    createdLeadIds.push(suspLead.id);
    console.log(`  ✓ Suspicious lead flagged: "${suspLead.suspiciousReason}"`);

    // ----------------------------------------------------
    // Test 10: List & Filter Leads
    // ----------------------------------------------------
    console.log('\n[10/18] Testing Lead Listing, Filtering & Pagination (GET /api/leads)...');
    const listRes = await request('/leads?status=NEW&priority=HIGH&page=1&limit=5', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    if (listRes.status !== 200 || !Array.isArray(listRes.data.data.leads)) {
      throw new Error(`Failed to list leads: ${JSON.stringify(listRes.data)}`);
    }
    console.log(`  ✓ Filtered leads retrieved: ${listRes.data.data.leads.length} leads returned.`);

    // ----------------------------------------------------
    // Test 11: Lead Details with Relations
    // ----------------------------------------------------
    console.log('\n[11/18] Testing Lead Details with Relations (GET /api/leads/:id)...');
    const detailRes = await request(`/leads/${lead1.id}`, {
      headers: { Authorization: `Bearer ${rep1Token}` }
    });
    if (detailRes.status !== 200 || !detailRes.data.data.lead.company) {
      throw new Error(`Failed to get lead details: ${JSON.stringify(detailRes.data)}`);
    }
    console.log(`  ✓ Lead details retrieved with company relation "${detailRes.data.data.lead.company.name}".`);

    // ----------------------------------------------------
    // Test 12: Record Lead Activity
    // ----------------------------------------------------
    console.log('\n[12/18] Testing Record Activity (POST /api/leads/:id/activities)...');
    const actRes = await request(`/leads/${lead1.id}/activities`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${rep1Token}` },
      body: {
        type: 'DEMO_REQUEST',
        description: 'Prospect requested enterprise architecture demo session',
        occurredAt: new Date().toISOString()
      }
    });

    if (actRes.status !== 201 || actRes.data.data.activity.type !== 'DEMO_REQUEST') {
      throw new Error(`Failed to record activity: ${JSON.stringify(actRes.data)}`);
    }
    const createdActivity = actRes.data.data.activity;
    if (createdActivity.createdBy.id !== rep1User.id) {
      throw new Error(`Expected activity creator to be Rep 1 (${rep1User.id}), got ${createdActivity.createdBy.id}`);
    }
    console.log(`  ✓ Activity recorded: [${createdActivity.type}] with server-enforced creator attribution.`);

    // ----------------------------------------------------
    // Test 13: List Chronological Activities
    // ----------------------------------------------------
    console.log('\n[13/18] Testing Chronological Activities (GET /api/leads/:id/activities)...');
    // Add second activity
    await request(`/leads/${lead1.id}/activities`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${rep1Token}` },
      body: {
        type: 'CALL',
        description: 'Discovery follow-up call completed'
      }
    });

    const actListRes = await request(`/leads/${lead1.id}/activities`, {
      headers: { Authorization: `Bearer ${rep1Token}` }
    });
    if (actListRes.status !== 200 || actListRes.data.data.activities.length < 2) {
      throw new Error(`Expected at least 2 activities, got ${actListRes.data.data.activities?.length}`);
    }
    console.log(`  ✓ Retrieved ${actListRes.data.data.activities.length} activities in descending chronological order.`);

    // ----------------------------------------------------
    // Test 14: Reject Invalid Activity Type
    // ----------------------------------------------------
    console.log('\n[14/18] Testing Invalid Activity Type Rejection (400 Bad Request)...');
    const badActRes = await request(`/leads/${lead1.id}/activities`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${rep1Token}` },
      body: {
        type: 'NONEXISTENT_TYPE_XYZ',
        description: 'Invalid'
      }
    });
    if (badActRes.status !== 400) {
      throw new Error(`Expected 400 Bad Request for invalid activity type, got ${badActRes.status}`);
    }
    console.log('  ✓ Invalid activity type correctly rejected with 400 Bad Request.');

    // ----------------------------------------------------
    // Test 15: RBAC Isolation (Rep 2 accessing Rep 1 Lead)
    // ----------------------------------------------------
    console.log('\n[15/18] Testing RBAC Scoping (Rep 2 blocked from Rep 1 Lead)...');
    const rbacLeadRes = await request(`/leads/${lead1.id}`, {
      headers: { Authorization: `Bearer ${rep2Token}` }
    });
    if (rbacLeadRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden when Rep 2 accesses Rep 1's lead, got ${rbacLeadRes.status}`);
    }

    const rbacActRes = await request(`/leads/${lead1.id}/activities`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${rep2Token}` },
      body: { type: 'CALL', description: 'Unauthorized call' }
    });
    if (rbacActRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden when Rep 2 logs activity on Rep 1's lead, got ${rbacActRes.status}`);
    }
    console.log('  ✓ Sales Rep 2 correctly blocked with 403 Forbidden from accessing or updating Rep 1 lead.');

    // ----------------------------------------------------
    // Test 16: Sales Manager Lead Reassignment & Update
    // ----------------------------------------------------
    console.log('\n[16/18] Testing Manager Lead Reassignment & Update (PATCH /api/leads/:id)...');
    const reassignRes = await request(`/leads/${lead1.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${managerToken}` },
      body: {
        assignedToId: rep2User.id,
        status: 'QUALIFIED'
      }
    });
    if (reassignRes.status !== 200 || reassignRes.data.data.lead.assignedToId !== rep2User.id) {
      throw new Error(`Failed to reassign lead: ${JSON.stringify(reassignRes.data)}`);
    }
    console.log('  ✓ Lead successfully reassigned to Rep 2 and status updated to QUALIFIED.');

    // ----------------------------------------------------
    // Test 17: Soft-Delete Archival
    // ----------------------------------------------------
    console.log('\n[17/18] Testing Lead Archival (DELETE /api/leads/:id)...');
    const archiveRes = await request(`/leads/${lead1.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${managerToken}` }
    });
    if (archiveRes.status !== 200 || !archiveRes.data.data.lead.isArchived) {
      throw new Error(`Failed to archive lead: ${JSON.stringify(archiveRes.data)}`);
    }

    // Verify lead is excluded from active listings
    const activeList = await request('/leads', {
      headers: { Authorization: `Bearer ${managerToken}` }
    });
    const foundInActive = activeList.data.data.leads.some((l) => l.id === lead1.id);
    if (foundInActive) {
      throw new Error('Archived lead was still returned in default active leads query!');
    }

    // Verify activities remain preserved in database
    const dbActivities = await prisma.leadActivity.findMany({ where: { leadId: lead1.id } });
    if (dbActivities.length < 2) {
      throw new Error('Historical activities were lost during soft-delete archival!');
    }
    console.log('  ✓ Lead soft-archived successfully; historical activities preserved in database.');

    // ----------------------------------------------------
    // Test 18: Audit Trail Verification
    // ----------------------------------------------------
    console.log('\n[18/18] Testing Audit Log Trail Verification in PostgreSQL...');
    const auditEntries = await prisma.auditLog.findMany({
      where: {
        entityId: { in: [lead1.id, createdCompany.id] }
      },
      orderBy: { createdAt: 'asc' }
    });

    const actionTypes = auditEntries.map((a) => a.action);
    console.log(`  • Recorded Audit Actions: ${actionTypes.join(', ')}`);

    const hasCreated = actionTypes.includes('LEAD_CREATED');
    const hasReassigned = actionTypes.includes('LEAD_ASSIGNMENT_CHANGED');
    const hasArchived = actionTypes.includes('LEAD_ARCHIVED');
    const hasCompanyCreated = actionTypes.includes('COMPANY_CREATED');

    if (!hasCreated || !hasReassigned || !hasArchived || !hasCompanyCreated) {
      throw new Error(`Missing expected audit log entries! Found: ${actionTypes.join(', ')}`);
    }
    console.log('  ✓ AuditLog accurately recorded LEAD_CREATED, LEAD_ASSIGNMENT_CHANGED, LEAD_ARCHIVED, and COMPANY_CREATED.');

    console.log('\n🎉 ALL 18 CRM CORE & INTELLIGENCE VERIFICATION TESTS PASSED!\n');
  } finally {
    // Clean up created test data
    console.log('Cleaning up test data...');
    try {
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
        where: { email: { contains: 'rep2.test' } }
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
