// ========================================================
// Phase 9 Executive Dashboard, Analytics, Notifications & UI Polish Verification
// ========================================================

import http from 'http';
import jwt from 'jsonwebtoken';
import { io as ioClient } from 'socket.io-client';
import app from './src/app.js';
import { getPrismaClient, disconnectPrisma } from './src/config/prisma.js';
import { env } from './src/config/environment.js';
import { SocketService } from './src/services/socket.service.js';
import { NotificationService } from './src/services/notification.service.js';

const TEST_PORT = 5009;
const BASE_URL = `http://localhost:${TEST_PORT}/api`;
const SOCKET_URL = `http://localhost:${TEST_PORT}`;

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
  console.log('Starting Phase 9 Executive Dashboard, Analytics & Notification Verification');
  console.log('========================================================\n');

  const server = http.createServer(app);
  SocketService.init(server);

  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`Test HTTP & Socket.IO server running on port ${TEST_PORT}`);

  const prisma = getPrismaClient();

  const createdUserIds = [];
  const createdNotificationIds = [];
  const activeSockets = [];

  try {
    // ----------------------------------------------------
    // TEST 1: Unauthenticated Protection (401)
    // ----------------------------------------------------
    console.log('\n[Test 1] Verifying unauthenticated API protection...');
    const unauthOverview = await request('/analytics/overview');
    assert(unauthOverview.status === 401, 'Unauthenticated /analytics/overview returns 401');

    const unauthFunnel = await request('/analytics/funnel');
    assert(unauthFunnel.status === 401, 'Unauthenticated /analytics/funnel returns 401');

    const unauthNotifs = await request('/analytics/rep-workspace');
    assert(unauthNotifs.status === 401, 'Unauthenticated /analytics/rep-workspace returns 401');

    const unauthListNotifs = await request('/notifications');
    assert(unauthListNotifs.status === 401, 'Unauthenticated /notifications returns 401');

    // ----------------------------------------------------
    // SETUP: Authenticate Personas
    // ----------------------------------------------------
    console.log('\n[Setup] Authenticating test personas...');
    const adminLogin = await request('/auth/login', {
      method: 'POST',
      body: { email: 'dev.admin@example.com', password: 'DevPassword123!' }
    });
    assert(adminLogin.status === 200, 'Admin logged in');
    const adminToken = adminLogin.data?.data?.token || adminLogin.data?.data?.accessToken;

    const managerLogin = await request('/auth/login', {
      method: 'POST',
      body: { email: 'dev.manager@example.com', password: 'DevPassword123!' }
    });
    assert(managerLogin.status === 200, 'Sales Manager logged in');
    const managerToken = managerLogin.data?.data?.token || managerLogin.data?.data?.accessToken;

    const repLogin = await request('/auth/login', {
      method: 'POST',
      body: { email: 'dev.rep@example.com', password: 'DevPassword123!' }
    });
    assert(repLogin.status === 200, 'Primary Sales Rep logged in');
    const repToken = repLogin.data?.data?.token || repLogin.data?.data?.accessToken;
    const repUser = repLogin.data?.data?.user;

    // Create a secondary rep to test user isolation
    const repRole = await prisma.role.findUnique({ where: { name: 'SALES_REPRESENTATIVE' } });
    const rep2 = await prisma.user.create({
      data: {
        email: `rep2.${Date.now()}@example.com`,
        passwordHash: '$2b$10$wT8B1y0y7p.examplePasswordHash...',
        firstName: 'Secondary',
        lastName: 'Rep',
        roleId: repRole.id
      }
    });
    createdUserIds.push(rep2.id);

    const rep2Token = jwt.sign(
      { id: rep2.id, email: rep2.email, role: 'SALES_REPRESENTATIVE' },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // ----------------------------------------------------
    // TEST 2: Executive Overview Metrics & Date Range Filters
    // ----------------------------------------------------
    console.log('\n[Test 2] Verifying Executive Overview metrics and date filtering...');
    const overviewRes = await request('/analytics/overview?range=30d', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(overviewRes.status === 200, 'Admin can fetch /analytics/overview');
    const metrics = overviewRes.data?.data || overviewRes.data?.metrics;
    assert(metrics && metrics.leads && metrics.deals, 'Overview response includes leads and deals metrics');
    assert(typeof metrics.leads.activeLeads === 'number', 'metrics.leads.activeLeads is numeric');
    assert(typeof metrics.deals.openPipelineValue === 'number', 'metrics.deals.openPipelineValue is numeric');
    assert(typeof metrics.deals.weightedPipelineValue === 'number', 'metrics.deals.weightedPipelineValue is numeric');
    assert(typeof metrics.deals.winRate === 'number', 'metrics.deals.winRate is numeric');

    // Test different date ranges
    for (const range of ['7d', '90d', 'month', 'all']) {
      const res = await request(`/analytics/overview?range=${range}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      assert(res.status === 200, `Overview successfully handles range="${range}"`);
    }

    // ----------------------------------------------------
    // TEST 3: Pipeline Math & Invariants
    // ----------------------------------------------------
    console.log('\n[Test 3] Verifying mathematical invariants (winRate, weightedPipeline)...');
    const { wonDeals, lostDeals, winRate, openPipelineValue, weightedPipelineValue } = metrics.deals;
    const denominator = wonDeals + lostDeals;
    const expectedWinRate = denominator > 0 ? Math.round((wonDeals / denominator) * 100 * 10) / 10 : 0;
    assert(winRate === expectedWinRate, `Win rate strictly matches won/(won+lost) (${winRate}% === ${expectedWinRate}%)`);
    assert(weightedPipelineValue <= openPipelineValue, 'Weighted pipeline value <= unweighted open pipeline value');

    // ----------------------------------------------------
    // TEST 4: Conversion Funnel Endpoint
    // ----------------------------------------------------
    console.log('\n[Test 4] Verifying Conversion Funnel endpoint...');
    const funnelRes = await request('/analytics/funnel', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(funnelRes.status === 200, 'Funnel endpoint returns 200');
    const funnel = funnelRes.data?.data?.funnel || funnelRes.data?.funnel;
    assert(Array.isArray(funnel) && funnel.length === 5, 'Funnel returns 5 progressive stages');
    assert(funnel[0].stage === 'All Leads', 'Funnel begins with "All Leads"');
    assert(funnel[4].stage === 'Deals Won', 'Funnel concludes with "Deals Won"');

    // ----------------------------------------------------
    // TEST 5: Pipeline Stage Distribution
    // ----------------------------------------------------
    console.log('\n[Test 5] Verifying Pipeline Stage Distribution...');
    const distRes = await request('/analytics/pipeline-distribution', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(distRes.status === 200, 'Pipeline distribution returns 200');
    const distribution = distRes.data?.data?.distribution || distRes.data?.distribution;
    assert(Array.isArray(distribution), 'Distribution returns an array of stages');
    if (distribution.length > 0) {
      const firstStage = distribution[0];
      assert('stageName' in firstStage && 'dealCount' in firstStage && 'value' in firstStage, 'Stage distribution contains stageName, dealCount, and value');
    }

    // ----------------------------------------------------
    // TEST 6: Sales Trends Endpoint
    // ----------------------------------------------------
    console.log('\n[Test 6] Verifying Historical Sales Trends...');
    const trendsRes = await request('/analytics/trends', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(trendsRes.status === 200, 'Trends endpoint returns 200');
    const trends = trendsRes.data?.data?.trends || trendsRes.data?.trends;
    assert(Array.isArray(trends), 'Trends returns an array of monthly performance');
    assert(trends.length === 6, 'Trends contains exactly 6 trailing months');

    // ----------------------------------------------------
    // TEST 7: Stage Velocity & Duration
    // ----------------------------------------------------
    console.log('\n[Test 7] Verifying Stage Velocity & Duration...');
    const velocityRes = await request('/analytics/stage-velocity', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(velocityRes.status === 200, 'Stage velocity returns 200');
    const stages = velocityRes.data?.data?.stages || velocityRes.data?.data?.stageVelocity || velocityRes.data?.stages;
    assert(Array.isArray(stages), 'Stage velocity returns an array of stages with duration metrics');

    // ----------------------------------------------------
    // TEST 8: Lead Sources Performance
    // ----------------------------------------------------
    console.log('\n[Test 8] Verifying Lead Source Performance...');
    const sourcesRes = await request('/analytics/lead-sources', {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert(sourcesRes.status === 200, 'Lead sources endpoint returns 200');
    const sources = sourcesRes.data?.data?.sources || sourcesRes.data?.sources;
    assert(Array.isArray(sources), 'Lead sources returns source breakdown array');

    // ----------------------------------------------------
    // TEST 9: Rep Performance Leaderboard & RBAC
    // ----------------------------------------------------
    console.log('\n[Test 9] Verifying Rep Performance Leaderboard & RBAC Scoping...');
    const repPerfManager = await request('/analytics/rep-performance', {
      headers: { Authorization: `Bearer ${managerToken}` }
    });
    assert(repPerfManager.status === 200, 'Sales Manager can access Rep Performance leaderboard');
    const repPerf = repPerfManager.data?.data?.performance || repPerfManager.data?.data?.leaderboard || repPerfManager.data?.performance;
    assert(Array.isArray(repPerf), 'Leaderboard returns array of representatives');

    const repPerfForbidden = await request('/analytics/rep-performance', {
      headers: { Authorization: `Bearer ${repToken}` }
    });
    assert(repPerfForbidden.status === 403, 'Sales Representative is forbidden (403) from accessing rep leaderboard');

    // ----------------------------------------------------
    // TEST 10: Sales Rep Workspace Endpoint
    // ----------------------------------------------------
    console.log('\n[Test 10] Verifying Sales Rep Workspace personal workspace...');
    const workspaceRes = await request('/analytics/rep-workspace', {
      headers: { Authorization: `Bearer ${repToken}` }
    });
    assert(workspaceRes.status === 200, 'Sales Rep can access /analytics/rep-workspace');
    const wsData = workspaceRes.data?.data || workspaceRes.data;
    assert(wsData && 'metrics' in wsData && 'hotLeads' in wsData && 'stalledLeads' in wsData && 'dealsClosingSoon' in wsData, 'Workspace contains personal metrics, hot leads, stalled leads, and closing deals');

    // ----------------------------------------------------
    // TEST 11: Notification Creation, Persistence & Scoping
    // ----------------------------------------------------
    console.log('\n[Test 11] Verifying Notification creation, isolation, and read lifecycle...');
    const notif1 = await NotificationService.createNotification({
      userId: repUser.id,
      type: 'LEAD_ASSIGNED',
      title: 'Automated Test Notification 1',
      message: 'Test notification assigned to primary sales rep.',
      metadata: { test: true, link: '/leads/test' }
    });
    createdNotificationIds.push(notif1.id);
    assert(notif1 && notif1.id, 'Notification persisted successfully in database');

    // Fetch notifications for Rep 1
    const notifsRep1 = await request('/notifications', {
      headers: { Authorization: `Bearer ${repToken}` }
    });
    assert(notifsRep1.status === 200, 'Rep 1 can fetch their notifications');
    const rep1List = notifsRep1.data?.data?.notifications || notifsRep1.data?.notifications || [];
    const foundNotif = rep1List.find((n) => n.id === notif1.id);
    assert(Boolean(foundNotif), 'Created notification exists in Rep 1 notification feed');

    // Verify User Isolation: Rep 2 must not see Rep 1 notification
    const notifsRep2 = await request('/notifications', {
      headers: { Authorization: `Bearer ${rep2Token}` }
    });
    assert(notifsRep2.status === 200, 'Rep 2 can fetch notifications');
    const rep2List = notifsRep2.data?.data?.notifications || notifsRep2.data?.notifications || [];
    const leakedNotif = rep2List.find((n) => n.id === notif1.id);
    assert(!leakedNotif, 'Rep 2 does NOT see Rep 1 notification (Strict User Isolation)');

    // Check unread count
    const unreadCountRes = await request('/notifications/unread-count', {
      headers: { Authorization: `Bearer ${repToken}` }
    });
    assert(unreadCountRes.status === 200, 'Unread count endpoint returns 200');
    const rep1Count = unreadCountRes.data?.data?.count ?? unreadCountRes.data?.count;
    assert(rep1Count >= 1, 'Unread count reflects at least 1 unread notification');

    // Mark as read
    const markReadRes = await request(`/notifications/${notif1.id}/read`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${repToken}` }
    });
    assert(markReadRes.status === 200, 'Mark as read returns 200');
    const readNotif = markReadRes.data?.data?.notification || markReadRes.data?.notification;
    assert(readNotif?.isRead === true, 'Notification isRead changed to true');

    // ----------------------------------------------------
    // TEST 12: Notification Deduplication (60s Window)
    // ----------------------------------------------------
    console.log('\n[Test 12] Verifying Notification deduplication within 60s...');
    const duplicateAttempt = await NotificationService.createNotification({
      userId: repUser.id,
      type: 'LEAD_ASSIGNED',
      title: 'Automated Test Notification 1',
      message: 'Duplicate text within deduplication window.',
      metadata: { test: true }
    });
    assert(duplicateAttempt.id === notif1.id, 'Duplicate notification within 60s suppressed (returned existing record)');

    // ----------------------------------------------------
    // TEST 13: Mark All as Read
    // ----------------------------------------------------
    console.log('\n[Test 13] Verifying Mark All as Read...');
    const notif2 = await NotificationService.createNotification({
      userId: repUser.id,
      type: 'RECOMMENDATION_GENERATED',
      title: 'Action Required Test 2',
      message: 'Second notification for bulk read test.'
    });
    createdNotificationIds.push(notif2.id);

    const markAllRes = await request('/notifications/mark-all-read', {
      method: 'POST',
      headers: { Authorization: `Bearer ${repToken}` }
    });
    assert(markAllRes.status === 200, 'Mark all as read returns 200');
    const markAllCount = markAllRes.data?.data?.count ?? markAllRes.data?.count;
    assert(markAllCount >= 1, 'Mark all as read marked at least 1 record');

    const finalUnreadRes = await request('/notifications/unread-count', {
      headers: { Authorization: `Bearer ${repToken}` }
    });
    const finalCount = finalUnreadRes.data?.data?.count ?? finalUnreadRes.data?.count;
    assert(finalCount === 0, 'Unread count is exactly 0 after mark-all-read');

    // ----------------------------------------------------
    // TEST 14: Real-Time Socket.IO Handshake & Room Isolation
    // ----------------------------------------------------
    console.log('\n[Test 14] Verifying Real-Time Socket.IO authentication & private room routing...');

    // 14a: Unauthenticated socket rejected
    await new Promise((resolve) => {
      const socketUnauth = ioClient(SOCKET_URL, {
        auth: { token: 'invalid.jwt.token' },
        transports: ['websocket'],
        reconnection: false
      });
      activeSockets.push(socketUnauth);

      socketUnauth.on('connect_error', (err) => {
        assert(err.message.includes('Authentication') || err.message.includes('token'), 'Socket connection with invalid token rejected by auth middleware');
        socketUnauth.disconnect();
        resolve();
      });

      socketUnauth.on('connect', () => {
        assert(false, 'Unauthenticated socket should NOT connect');
        socketUnauth.disconnect();
        resolve();
      });
    });

    // 14b: Authenticated sockets connect and receive private events
    await new Promise((resolve) => {
      let rep1Received = false;
      let rep2Received = false;

      const socketRep1 = ioClient(SOCKET_URL, {
        auth: { token: repToken },
        transports: ['websocket'],
        reconnection: false
      });
      activeSockets.push(socketRep1);

      const socketRep2 = ioClient(SOCKET_URL, {
        auth: { token: rep2Token },
        transports: ['websocket'],
        reconnection: false
      });
      activeSockets.push(socketRep2);

      let rep1Connected = false;
      let rep2Connected = false;

      const checkBothConnected = () => {
        if (rep1Connected && rep2Connected) {
          // Emit a test event specifically to Rep 1
          SocketService.emitToUser(repUser.id, 'notification:new', {
            title: 'Socket Isolation Test',
            recipient: repUser.id
          });

          // Wait 600ms to verify receipt
          setTimeout(() => {
            assert(rep1Received === true, 'Target user (Rep 1) received real-time socket event in room user:id');
            assert(rep2Received === false, 'Non-target user (Rep 2) did NOT receive Rep 1 private event (Zero Broadcast Leak)');
            resolve();
          }, 600);
        }
      };

      socketRep1.on('connect', () => {
        rep1Connected = true;
        checkBothConnected();
      });

      socketRep2.on('connect', () => {
        rep2Connected = true;
        checkBothConnected();
      });

      socketRep1.on('notification:new', (data) => {
        if (data.title === 'Socket Isolation Test') {
          rep1Received = true;
        }
      });

      socketRep2.on('notification:new', (data) => {
        if (data.title === 'Socket Isolation Test') {
          rep2Received = true;
        }
      });
    });

  } catch (err) {
    console.error('\nVerification encountered unhandled error:', err);
    failed++;
  } finally {
    // Teardown
    console.log('\n[Teardown] Cleaning up test sockets, records, and closing server...');
    for (const s of activeSockets) {
      try { s.disconnect(); } catch {}
    }

    if (createdNotificationIds.length > 0) {
      await prisma.notification.deleteMany({
        where: { id: { in: createdNotificationIds } }
      }).catch(() => {});
    }

    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } }
      }).catch(() => {});
    }

    await new Promise((resolve) => server.close(resolve));
    await disconnectPrisma();
  }

  console.log('\n========================================================');
  console.log(`Phase 9 Verification Summary: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
