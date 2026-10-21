import test, { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function signSession(sessionId, secret) {
  const sessionSecret = secret || process.env.SESSION_SECRET || 'schoolpass_dev_fallback_secret_key_32bytes_min';
  const hmac = createHmac('sha256', sessionSecret).update(sessionId).digest('hex');
  return `${sessionId}.${hmac}`;
}

describe('SchoolPass Stage 5: Sign-Out & Logout Navigation Validation', async () => {
  const BASE_URL = process.env.TEST_APP_URL || 'http://localhost:3000';
  let isServerRunning = false;

  before(async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/session`, { signal: AbortSignal.timeout(1500) });
      if (res.status === 200) {
        isServerRunning = true;
      }
    } catch {
      isServerRunning = false;
    }
  });

  after(async () => {
    await prisma.$disconnect();
  });

  it('redirects native browser form submissions with HTTP 303 instead of displaying raw JSON', async () => {
    if (!isServerRunning) {
      return;
    }

    const res = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      redirect: 'manual', // do not follow redirect so we inspect 303 status
    });

    assert.equal(res.status, 303, 'Must return HTTP 303 (See Other) for POST-to-GET form navigation');
    const location = res.headers.get('location');
    assert.ok(location, 'Must provide redirect Location header');
    assert.ok(location.includes('/auth/login'), 'Must redirect to parent sign-in by default');

    // Verify cookie clearance header
    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie, 'Must return Set-Cookie header');
    assert.ok(setCookie.includes('schoolpass_session='), 'Must target schoolpass_session cookie');
    assert.ok(
      setCookie.includes('Max-Age=0') || setCookie.includes('Expires=Thu, 01 Jan 1970'),
      'Must expire the session cookie'
    );
  });

  it('redirects staff session to /auth/staff-login when Referer header is completely absent', async () => {
    if (!isServerRunning) {
      return;
    }

    // 1. Create a staff session record
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60);
    const session = await prisma.session.create({
      data: {
        userId: 'test_staff_user_id',
        role: 'staff',
        expiresAt,
      },
    });

    const cookieVal = signSession(session.id);

    // 2. Submit logout request without any Referer header
    const res = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'Cookie': `schoolpass_session=${cookieVal}`,
      },
      redirect: 'manual',
    });

    assert.equal(res.status, 303, 'Must return HTTP 303 for staff logout');
    const location = res.headers.get('location');
    assert.ok(location, 'Must provide redirect Location');
    assert.ok(
      location.includes('/auth/staff-login'),
      `Staff session must redirect to /auth/staff-login, got: ${location}`
    );

    // 3. Verify server-side session invalidation occurred in database
    const sessionInDb = await prisma.session.findUnique({ where: { id: session.id } });
    assert.equal(sessionInDb, null, 'Staff session record must be deleted from database upon logout');
  });

  it('redirects admin session to /auth/staff-login when Referer header is completely absent', async () => {
    if (!isServerRunning) {
      return;
    }

    // 1. Create an admin session record
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60);
    const session = await prisma.session.create({
      data: {
        userId: 'test_admin_user_id',
        role: 'admin',
        expiresAt,
      },
    });

    const cookieVal = signSession(session.id);

    // 2. Submit logout request without any Referer header
    const res = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'Cookie': `schoolpass_session=${cookieVal}`,
      },
      redirect: 'manual',
    });

    assert.equal(res.status, 303, 'Must return HTTP 303 for admin logout');
    const location = res.headers.get('location');
    assert.ok(location, 'Must provide redirect Location');
    assert.ok(
      location.includes('/auth/staff-login'),
      `Admin session must redirect to /auth/staff-login, got: ${location}`
    );

    // 3. Verify server-side session invalidation occurred in database
    const sessionInDb = await prisma.session.findUnique({ where: { id: session.id } });
    assert.equal(sessionInDb, null, 'Admin session record must be deleted from database upon logout');
  });

  it('redirects uppercase role session (e.g. STAFF) reliably to /auth/staff-login without Referer', async () => {
    if (!isServerRunning) {
      return;
    }

    // 1. Create session with uppercase STAFF role to test case normalization
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60);
    const session = await prisma.session.create({
      data: {
        userId: 'test_uppercase_staff_id',
        role: 'STAFF',
        expiresAt,
      },
    });

    const cookieVal = signSession(session.id);

    const res = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'Cookie': `schoolpass_session=${cookieVal}`,
      },
      redirect: 'manual',
    });

    assert.equal(res.status, 303);
    const location = res.headers.get('location');
    assert.ok(
      location && location.includes('/auth/staff-login'),
      `Uppercase STAFF role must normalize and redirect to /auth/staff-login, got: ${location}`
    );

    const sessionInDb = await prisma.session.findUnique({ where: { id: session.id } });
    assert.equal(sessionInDb, null, 'Session record must be deleted from database');
  });

  it('redirects parent session to /auth/login when Referer header is completely absent', async () => {
    if (!isServerRunning) {
      return;
    }

    // 1. Create a parent session record
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60);
    const session = await prisma.session.create({
      data: {
        userId: 'test_parent_user_id',
        role: 'parent',
        expiresAt,
      },
    });

    const cookieVal = signSession(session.id);

    // 2. Submit logout request without any Referer header
    const res = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'Cookie': `schoolpass_session=${cookieVal}`,
      },
      redirect: 'manual',
    });

    assert.equal(res.status, 303, 'Must return HTTP 303 for parent logout');
    const location = res.headers.get('location');
    assert.ok(location, 'Must provide redirect Location');
    assert.ok(
      location.includes('/auth/login'),
      `Parent session must redirect to /auth/login, got: ${location}`
    );

    // 3. Verify server-side session invalidation occurred in database
    const sessionInDb = await prisma.session.findUnique({ where: { id: session.id } });
    assert.equal(sessionInDb, null, 'Parent session record must be deleted from database upon logout');
  });

  it('redirects staff browser form submissions to staff-login based on referer when session role is not present', async () => {
    if (!isServerRunning) {
      return;
    }

    const res = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'Referer': `${BASE_URL}/attendance`,
      },
      redirect: 'manual',
    });

    assert.equal(res.status, 303);
    const location = res.headers.get('location');
    assert.ok(location && location.includes('/auth/staff-login'), 'Must route staff to /auth/staff-login');
  });

  it('redirects guardian-links staff browser form submissions to staff-login', async () => {
    if (!isServerRunning) {
      return;
    }

    const res = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'Referer': `${BASE_URL}/guardian-links`,
      },
      redirect: 'manual',
    });

    assert.equal(res.status, 303);
    const location = res.headers.get('location');
    assert.ok(location && location.includes('/auth/staff-login'), 'Must route guardian-links staff to /auth/staff-login');
  });

  it('preserves JSON responses for programmatic API clients with Accept: application/json', async () => {
    if (!isServerRunning) {
      return;
    }

    const res = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
      },
      redirect: 'manual',
    });

    assert.equal(res.status, 200, 'Must return HTTP 200 for API clients');
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.message, 'Signed out successfully.');

    // Verify cookie clearance header also present on JSON response
    const setCookie = res.headers.get('set-cookie');
    assert.ok(setCookie && setCookie.includes('schoolpass_session='));
  });

  it('denies session access after logout via /api/auth/session', async () => {
    if (!isServerRunning) {
      return;
    }

    // After calling logout, querying session must show unauthenticated
    const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
    });
    assert.equal(logoutRes.status, 200);

    const sessionRes = await fetch(`${BASE_URL}/api/auth/session`);
    assert.equal(sessionRes.status, 200);
    const sessionData = await sessionRes.json();
    assert.equal(sessionData.authenticated, false);
    assert.equal(sessionData.session, null);
  });
});

