import app from './src/app.js';
import getPrismaClient from './src/config/prisma.js';

const prisma = getPrismaClient();
const TEST_PORT = 5002;

async function runAuthVerification() {
  console.log('🔒 Starting Phase 3 Authentication & Authorization Verification...\n');

  const server = app.listen(TEST_PORT);
  const baseUrl = `http://localhost:${TEST_PORT}/api`;

  try {
    const timestamp = Date.now();
    const testEmail = `new.rep.${timestamp}@example.com`;
    const testPassword = 'SecurePassword123!';

    // ----------------------------------------------------
    // TEST 1: User Registration (POST /api/auth/register)
    // ----------------------------------------------------
    console.log('[1/10] Testing User Registration...');
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Taylor',
        lastName: 'Swift',
        email: testEmail,
        password: testPassword
      })
    });
    const regJson = await regRes.json();
    if (regRes.status !== 201 || !regJson.success || !regJson.data.token) {
      throw new Error(`Registration failed: ${JSON.stringify(regJson)}`);
    }
    if (regJson.data.user.role !== 'SALES_REPRESENTATIVE') {
      throw new Error(`Expected default role SALES_REPRESENTATIVE, got: ${regJson.data.user.role}`);
    }
    if (regJson.data.user.passwordHash) {
      throw new Error('Security violation: passwordHash exposed in registration response!');
    }
    const repToken = regJson.data.token;
    const repUserId = regJson.data.user.id;
    console.log('  ✓ User registered with 201 Created and default role SALES_REPRESENTATIVE');

    // ----------------------------------------------------
    // TEST 2: Duplicate Registration Rejection
    // ----------------------------------------------------
    console.log('\n[2/10] Testing Duplicate Registration Rejection...');
    const dupRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Taylor',
        lastName: 'Swift',
        email: testEmail,
        password: testPassword
      })
    });
    const dupJson = await dupRes.json();
    if (dupRes.status !== 409 || dupJson.success !== false) {
      throw new Error(`Expected 409 Conflict on duplicate registration, got ${dupRes.status}`);
    }
    console.log('  ✓ Duplicate registration correctly rejected with 409 Conflict');

    // ----------------------------------------------------
    // TEST 3: Password Hashing Verification
    // ----------------------------------------------------
    console.log('\n[3/10] Testing Password Hashing Security...');
    const dbUser = await prisma.user.findUnique({ where: { email: testEmail } });
    if (!dbUser || !dbUser.passwordHash.startsWith('$2')) {
      throw new Error('User passwordHash is not a valid bcrypt hash');
    }
    if (dbUser.passwordHash === testPassword) {
      throw new Error('Security failure: Password stored in plaintext!');
    }
    console.log('  ✓ Verified bcrypt hash format ($2a$/$2b$) in PostgreSQL');

    // ----------------------------------------------------
    // TEST 4: User Login (POST /api/auth/login)
    // ----------------------------------------------------
    console.log('\n[4/10] Testing Valid User Login...');
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword
      })
    });
    const loginJson = await loginRes.json();
    if (loginRes.status !== 200 || !loginJson.success || !loginJson.data.token) {
      throw new Error(`Login failed: ${JSON.stringify(loginJson)}`);
    }
    if (loginJson.data.user.passwordHash) {
      throw new Error('Security violation: passwordHash exposed in login response!');
    }
    console.log('  ✓ Login succeeded with 200 OK and valid JWT token');

    // ----------------------------------------------------
    // TEST 5: Invalid Password Rejection
    // ----------------------------------------------------
    console.log('\n[5/10] Testing Invalid Password Rejection...');
    const badPassRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: 'WrongPassword999!'
      })
    });
    const badPassJson = await badPassRes.json();
    if (badPassRes.status !== 401 || badPassJson.success !== false) {
      throw new Error(`Expected 401 Unauthorized on invalid password, got ${badPassRes.status}`);
    }
    console.log('  ✓ Invalid password rejected with 401 Unauthorized');

    // ----------------------------------------------------
    // TEST 6: JWT Verification & Claims
    // ----------------------------------------------------
    console.log('\n[6/10] Testing JWT Structure & Claims...');
    const parts = repToken.split('.');
    if (parts.length !== 3) {
      throw new Error('JWT token does not have 3 parts (header.payload.signature)');
    }
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
    if (!payload.id || payload.email !== testEmail || payload.role !== 'SALES_REPRESENTATIVE') {
      throw new Error(`Invalid claims in token payload: ${JSON.stringify(payload)}`);
    }
    console.log(`  ✓ Verified JWT claims: id, email (${payload.email}), role (${payload.role})`);

    // ----------------------------------------------------
    // TEST 7: Current User Endpoint (GET /api/auth/me)
    // ----------------------------------------------------
    console.log('\n[7/10] Testing Current User Endpoint (GET /api/auth/me)...');
    const meRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${repToken}` }
    });
    const meJson = await meRes.json();
    if (meRes.status !== 200 || !meJson.success || meJson.data.user.id !== repUserId) {
      throw new Error(`/api/auth/me failed: ${JSON.stringify(meJson)}`);
    }
    console.log(`  ✓ /api/auth/me returned authenticated user: ${meJson.data.user.firstName} ${meJson.data.user.lastName}`);

    // ----------------------------------------------------
    // TEST 8: Unauthenticated Access Rejection
    // ----------------------------------------------------
    console.log('\n[8/10] Testing Unauthenticated Access Rejection...');
    const noAuthRes = await fetch(`${baseUrl}/auth/me`);
    const noAuthJson = await noAuthRes.json();
    if (noAuthRes.status !== 401 || noAuthJson.success !== false) {
      throw new Error(`Expected 401 Unauthorized when missing token, got ${noAuthRes.status}`);
    }

    const fakeTokenRes = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: 'Bearer this.is.an.invalid.token' }
    });
    if (fakeTokenRes.status !== 401) {
      throw new Error(`Expected 401 Unauthorized for fake token, got ${fakeTokenRes.status}`);
    }
    console.log('  ✓ Unauthenticated and forged tokens correctly rejected with 401 Unauthorized');

    // ----------------------------------------------------
    // TEST 9: Role-Based Access Rejection (Rep calling Admin endpoint)
    // ----------------------------------------------------
    console.log('\n[9/10] Testing RBAC Rejection (Sales Rep accessing Admin/Manager endpoint)...');
    const forbiddenRes = await fetch(`${baseUrl}/users`, {
      headers: { Authorization: `Bearer ${repToken}` }
    });
    const forbiddenJson = await forbiddenRes.json();
    if (forbiddenRes.status !== 403 || forbiddenJson.success !== false) {
      throw new Error(`Expected 403 Forbidden for Sales Rep accessing /api/users, got ${forbiddenRes.status}`);
    }
    console.log('  ✓ Sales Rep correctly blocked from /api/users with 403 Forbidden');

    // ----------------------------------------------------
    // TEST 10: Authorized Admin Access & User Management
    // ----------------------------------------------------
    console.log('\n[10/10] Testing Authorized Admin Login & User Management...');
    const adminLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'dev.admin@example.com',
        password: 'DevPassword123!'
      })
    });
    const adminLoginJson = await adminLoginRes.json();
    if (adminLoginRes.status !== 200 || !adminLoginJson.data.token) {
      throw new Error(`Admin login failed: ${JSON.stringify(adminLoginJson)}`);
    }
    const adminToken = adminLoginJson.data.token;

    // Admin lists users (GET /api/users)
    const listRes = await fetch(`${baseUrl}/users`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const listJson = await listRes.json();
    if (listRes.status !== 200 || !listJson.data.users || listJson.data.users.length === 0) {
      throw new Error(`Admin failed to list users: ${JSON.stringify(listJson)}`);
    }
    console.log(`  ✓ Admin successfully retrieved ${listJson.data.users.length} users with 200 OK`);

    // Clean up test rep created in test 1
    await prisma.user.delete({ where: { email: testEmail } });
    console.log('  ✓ Cleaned up test user record.');

    console.log('\n🎉 ALL 10 AUTHENTICATION & RBAC VERIFICATION TESTS PASSED!\n');
  } catch (error) {
    console.error('\n❌ Verification Failed:', error);
    process.exitCode = 1;
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

runAuthVerification();
