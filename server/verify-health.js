import app from './src/app.js';

const testPort = 5001;

const server = app.listen(testPort, async () => {
  console.log(`[VERIFY] Test server started on port ${testPort}`);

  try {
    // 1. Test GET /api/health
    const healthRes = await fetch(`http://localhost:${testPort}/api/health`);
    const healthJson = await healthRes.json();
    console.log('[VERIFY] Health endpoint status:', healthRes.status);
    console.log('[VERIFY] Health endpoint response:', JSON.stringify(healthJson, null, 2));

    if (healthRes.status === 200 && healthJson.success === true && healthJson.message === 'CRM API is running') {
      console.log('✅ HEALTH ENDPOINT VERIFIED SUCCESSFULLY!');
    } else {
      console.error('❌ Health endpoint returned unexpected response');
    }

    // 2. Test 404 handler
    const notFoundRes = await fetch(`http://localhost:${testPort}/api/nonexistent`);
    const notFoundJson = await notFoundRes.json();
    console.log('[VERIFY] 404 status:', notFoundRes.status);
    console.log('[VERIFY] 404 response:', JSON.stringify(notFoundJson, null, 2));

    if (notFoundRes.status === 404 && notFoundJson.success === false) {
      console.log('✅ 404 NOT FOUND HANDLER VERIFIED SUCCESSFULLY!');
    } else {
      console.error('❌ 404 handler returned unexpected response');
    }

  } catch (error) {
    console.error('❌ Verification failed with error:', error);
  } finally {
    server.close(() => {
      console.log('[VERIFY] Test server closed cleanly.');
    });
  }
});
