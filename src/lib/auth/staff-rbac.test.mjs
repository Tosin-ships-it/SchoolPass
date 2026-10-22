import test, { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

// Inline test loader for Node ESM:
// Resolves Next.js server module boundaries, path aliases (@/*), and extensionless TypeScript files
const inlineLoaderCode = `
import { pathToFileURL, fileURLToPath } from 'node:url';
import { resolve as pathResolve, dirname } from 'node:path';
import { existsSync } from 'node:fs';

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'next/headers' || specifier === 'next/headers.js') {
    return {
      url: 'data:text/javascript,' + encodeURIComponent(\`
        const cookieJar = new Map();
        export function setTestCookie(k, v) { if (v === null || v === undefined) cookieJar.delete(k); else cookieJar.set(k, v); }
        export function clearTestCookies() { cookieJar.clear(); }
        export async function cookies() {
          return {
            get: (k) => cookieJar.has(k) ? { name: k, value: cookieJar.get(k) } : undefined,
            set: (k, v) => cookieJar.set(k, v),
            delete: (k) => cookieJar.delete(k),
          };
        }
        export async function headers() { return new Headers(); }
      \`),
      shortCircuit: true,
    };
  }
  if (specifier === 'next/cache' || specifier === 'next/cache.js') {
    return {
      url: 'data:text/javascript,' + encodeURIComponent(\`
        export function revalidatePath() {}
        export function revalidateTag() {}
      \`),
      shortCircuit: true,
    };
  }
  if (specifier.startsWith('@/')) {
    const rel = specifier.slice(2);
    const basePath = pathResolve(process.cwd(), 'src', rel);
    if (existsSync(basePath + '.ts')) {
      return nextResolve(pathToFileURL(basePath + '.ts').href, context);
    }
    if (existsSync(basePath + '/index.ts')) {
      return nextResolve(pathToFileURL(basePath + '/index.ts').href, context);
    }
  }
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL) {
    const parentDir = dirname(fileURLToPath(context.parentURL));
    const targetPath = pathResolve(parentDir, specifier);
    if (existsSync(targetPath + '.ts')) {
      return nextResolve(pathToFileURL(targetPath + '.ts').href, context);
    }
    if (existsSync(targetPath + '/index.ts')) {
      return nextResolve(pathToFileURL(targetPath + '/index.ts').href, context);
    }
  }
  return nextResolve(specifier, context);
}
`;

register('data:text/javascript,' + encodeURIComponent(inlineLoaderCode), import.meta.url);

describe('SchoolPass Production Staff RBAC & Session Security Test Suite', async () => {
  // Dynamically load production modules through registered resolution harness
  const headersMock = await import('next/headers');
  const auth = await import('./index.ts');
  const store = await import('./store.ts');
  const crypto = await import('./crypto.ts');
  const { prisma } = await import('../db/index.ts');
  const actions = await import('../../app/(staff)/students/actions.ts');

  const BASE_URL = process.env.TEST_APP_URL || 'http://localhost:3000';
  let isServerRunning = false;

  // Retrieve existing seeded accounts
  let generalStaff = null;
  let frontDeskStaff = null;
  let adminStaff = null;
  let parentUser = null;

  before(async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/session`, { signal: AbortSignal.timeout(1500) });
      if (res.status === 200) {
        isServerRunning = true;
      }
    } catch {
      isServerRunning = false;
    }

    try {
      generalStaff = await prisma.staffUser.findUnique({ where: { email: 'staff@school.ng' } });
      frontDeskStaff = await prisma.staffUser.findUnique({ where: { email: 'frontdesk@school.ng' } });
      adminStaff = await prisma.staffUser.findUnique({ where: { email: 'admin@school.ng' } });
      parentUser = await prisma.parent.findFirst({ where: { emailVerifiedAt: { not: null } } });
    } catch (e) {
      console.warn('Warning: Could not fetch initial accounts from database pooler:', e?.message || e);
    }
  });

  after(async () => {
    headersMock.clearTestCookies();
    await prisma.$disconnect();
  });

  // Helper to establish a live signed session in database and mock cookie jar
  async function withSession(userId, role, callback) {
    const sessionRecord = await prisma.session.create({
      data: {
        userId,
        role,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      },
    });

    const token = crypto.signSessionPayload(sessionRecord.id);
    headersMock.setTestCookie('schoolpass_session', token);

    try {
      await callback(sessionRecord);
    } finally {
      headersMock.clearTestCookies();
      await prisma.session.delete({ where: { id: sessionRecord.id } }).catch(() => {});
    }
  }

  // =========================================================================
  // 1. Direct Production Execution of Authorization Helpers
  // =========================================================================
  describe('1. Direct Production Execution: assertStaffSession', () => {
    it('denies unauthenticated callers with authentication required error', async () => {
      headersMock.clearTestCookies();
      const check = await auth.assertStaffSession();
      assert.strictEqual(check.authorized, false);
      assert.strictEqual(check.error, 'Authentication required.');
    });

    it('denies parent accounts with staff privileges required error', async () => {
      if (!parentUser) return;
      await withSession(parentUser.id, 'parent', async () => {
        const check = await auth.assertStaffSession();
        assert.strictEqual(check.authorized, false);
        assert.strictEqual(check.error, 'Unauthorized. Staff privileges required.');
      });
    });

    it('grants access to General Staff accounts', async () => {
      if (!generalStaff) return;
      await withSession(generalStaff.id, 'staff', async () => {
        const check = await auth.assertStaffSession();
        assert.strictEqual(check.authorized, true);
        assert.strictEqual(check.session.role, 'staff');
      });
    });

    it('grants access to Front Desk Staff accounts', async () => {
      if (!frontDeskStaff) return;
      await withSession(frontDeskStaff.id, 'staff', async () => {
        const check = await auth.assertStaffSession();
        assert.strictEqual(check.authorized, true);
        assert.strictEqual(check.session.role, 'staff');
      });
    });

    it('grants access to Admin accounts', async () => {
      if (!adminStaff) return;
      await withSession(adminStaff.id, 'admin', async () => {
        const check = await auth.assertStaffSession();
        assert.strictEqual(check.authorized, true);
        assert.strictEqual(check.session.role, 'admin');
      });
    });
  });

  describe('2. Direct Production Execution: assertFrontDeskAccess', () => {
    it('denies unauthenticated callers', async () => {
      headersMock.clearTestCookies();
      const check = await auth.assertFrontDeskAccess();
      assert.strictEqual(check.authorized, false);
      assert.strictEqual(check.error, 'Authentication required.');
    });

    it('denies parent accounts', async () => {
      if (!parentUser) return;
      await withSession(parentUser.id, 'parent', async () => {
        const check = await auth.assertFrontDeskAccess();
        assert.strictEqual(check.authorized, false);
        assert.strictEqual(check.error, 'Unauthorized. Staff privileges required.');
      });
    });

    it('denies General Staff (isFrontDesk: false) with specific error', async () => {
      if (!generalStaff) return;
      await withSession(generalStaff.id, 'staff', async () => {
        const check = await auth.assertFrontDeskAccess();
        assert.strictEqual(check.authorized, false);
        assert.strictEqual(check.error, 'Unauthorized. Front-desk permissions required.');
      });
    });

    it('grants access to Front Desk Staff (isFrontDesk: true)', async () => {
      if (!frontDeskStaff) return;
      await withSession(frontDeskStaff.id, 'staff', async () => {
        const check = await auth.assertFrontDeskAccess();
        assert.strictEqual(check.authorized, true);
        assert.strictEqual(check.session.role, 'staff');
      });
    });

    it('grants implicit access to Admin accounts regardless of isFrontDesk flag', async () => {
      if (!adminStaff) return;
      await withSession(adminStaff.id, 'admin', async () => {
        const check = await auth.assertFrontDeskAccess();
        assert.strictEqual(check.authorized, true);
        assert.strictEqual(check.session.role, 'admin');
      });
    });
  });

  describe('3. Direct Production Execution: assertAdminSession', () => {
    it('denies unauthenticated callers', async () => {
      headersMock.clearTestCookies();
      const check = await auth.assertAdminSession();
      assert.strictEqual(check.authorized, false);
      assert.strictEqual(check.error, 'Authentication required.');
    });

    it('denies parent accounts', async () => {
      if (!parentUser) return;
      await withSession(parentUser.id, 'parent', async () => {
        const check = await auth.assertAdminSession();
        assert.strictEqual(check.authorized, false);
        assert.strictEqual(check.error, 'Unauthorized. Admin privileges required.');
      });
    });

    it('denies General Staff callers with admin privileges required error', async () => {
      if (!generalStaff) return;
      await withSession(generalStaff.id, 'staff', async () => {
        const check = await auth.assertAdminSession();
        assert.strictEqual(check.authorized, false);
        assert.strictEqual(check.error, 'Unauthorized. Admin privileges required.');
      });
    });

    it('denies Front Desk Staff callers with admin privileges required error', async () => {
      if (!frontDeskStaff) return;
      await withSession(frontDeskStaff.id, 'staff', async () => {
        const check = await auth.assertAdminSession();
        assert.strictEqual(check.authorized, false);
        assert.strictEqual(check.error, 'Unauthorized. Admin privileges required.');
      });
    });

    it('grants access strictly to Admin accounts', async () => {
      if (!adminStaff) return;
      await withSession(adminStaff.id, 'admin', async () => {
        const check = await auth.assertAdminSession();
        assert.strictEqual(check.authorized, true);
        assert.strictEqual(check.session.role, 'admin');
      });
    });
  });

  // =========================================================================
  // 4. Database-Backed Permission Revocation
  // =========================================================================
  describe('4. Database-Backed Permission Revocation on Production Code', () => {
    it('immediately reflects database-level revocation of isFrontDesk in active sessions', async () => {
      // Create temporary staff member with front-desk permission
      const tempEmail = `temp-frontdesk-${Date.now()}@schoolpass.test`;
      const tempStaff = await prisma.staffUser.create({
        data: {
          name: 'Temporary FrontDesk Staff',
          email: tempEmail,
          passwordHash: await crypto.hashPassword('TempPass2026!'),
          role: 'STAFF',
          isFrontDesk: true,
        },
      });

      try {
        await withSession(tempStaff.id, 'staff', async () => {
          // 1. Initial check: staff has isFrontDesk=true in DB
          const initialCheck = await auth.assertFrontDeskAccess();
          assert.strictEqual(initialCheck.authorized, true, 'Staff with isFrontDesk=true must be authorized');

          // 2. Admin revokes front-desk permission in DB
          await prisma.staffUser.update({
            where: { id: tempStaff.id },
            data: { isFrontDesk: false },
          });

          // 3. Next request in the EXACT SAME session must query DB and deny access immediately
          const postRevocationCheck = await auth.assertFrontDeskAccess();
          assert.strictEqual(
            postRevocationCheck.authorized,
            false,
            'Staff whose front-desk privilege was revoked in DB must be denied immediately'
          );
          assert.strictEqual(
            postRevocationCheck.error,
            'Unauthorized. Front-desk permissions required.'
          );

          // 4. Admin restores front-desk permission in DB
          await prisma.staffUser.update({
            where: { id: tempStaff.id },
            data: { isFrontDesk: true },
          });

          // 5. Subsequent request immediately succeeds
          const restoredCheck = await auth.assertFrontDeskAccess();
          assert.strictEqual(restoredCheck.authorized, true, 'Restored permission must take effect immediately');
        });
      } finally {
        await prisma.staffUser.delete({ where: { id: tempStaff.id } }).catch(() => {});
      }
    });
  });

  // =========================================================================
  // 5. Session Invalidation on Password Update vs. Login Hash Migration
  // =========================================================================
  describe('5. Production Session Invalidation: updateStaffPassword', () => {
    it('invalidates active database sessions upon explicit password change', async () => {
      const tempEmail = `temp-pass-change-${Date.now()}@schoolpass.test`;
      const tempStaff = await prisma.staffUser.create({
        data: {
          name: 'Temp Pass Staff',
          email: tempEmail,
          passwordHash: await crypto.hashPassword('OldPass2026!'),
          role: 'STAFF',
          isFrontDesk: false,
        },
      });

      try {
        const sessionRecord = await prisma.session.create({
          data: {
            userId: tempStaff.id,
            role: 'staff',
            expiresAt: new Date(Date.now() + 3600000),
          },
        });

        const token = crypto.signSessionPayload(sessionRecord.id);
        headersMock.setTestCookie('schoolpass_session', token);

        // Verify session works initially
        const preCheck = await auth.assertStaffSession();
        assert.strictEqual(preCheck.authorized, true);

        // Perform password change using production updateStaffPassword (defaults to invalidateSessions: true)
        const newHash = await crypto.hashPassword('NewPass2026!');
        await store.updateStaffPassword(tempStaff.id, newHash);

        // Verify session was purged from PostgreSQL
        const sessionInDb = await prisma.session.findUnique({ where: { id: sessionRecord.id } });
        assert.strictEqual(sessionInDb, null, 'Active session must be purged from database');

        // Verify next call to assertStaffSession returns unauthenticated
        const postCheck = await auth.assertStaffSession();
        assert.strictEqual(postCheck.authorized, false);
        assert.strictEqual(postCheck.error, 'Authentication required.');
      } finally {
        headersMock.clearTestCookies();
        await prisma.session.deleteMany({ where: { userId: tempStaff.id } }).catch(() => {});
        await prisma.staffUser.delete({ where: { id: tempStaff.id } }).catch(() => {});
      }
    });

    it('preserves active sessions during automatic login hash migration (invalidateSessions: false)', async () => {
      const tempEmail = `temp-login-migrate-${Date.now()}@schoolpass.test`;
      const tempStaff = await prisma.staffUser.create({
        data: {
          name: 'Temp Migration Staff',
          email: tempEmail,
          passwordHash: await crypto.hashPassword('OldPass2026!'),
          role: 'STAFF',
          isFrontDesk: false,
        },
      });

      try {
        const sessionRecord = await prisma.session.create({
          data: {
            userId: tempStaff.id,
            role: 'staff',
            expiresAt: new Date(Date.now() + 3600000),
          },
        });

        const token = crypto.signSessionPayload(sessionRecord.id);
        headersMock.setTestCookie('schoolpass_session', token);

        // Perform hash update with { invalidateSessions: false } (exact call in loginStaff)
        const newHash = await crypto.hashPassword('TrimmedPass2026!');
        await store.updateStaffPassword(tempStaff.id, newHash, { invalidateSessions: false });

        // Verify session STILL exists in PostgreSQL
        const sessionInDb = await prisma.session.findUnique({ where: { id: sessionRecord.id } });
        assert.notStrictEqual(sessionInDb, null, 'Session must NOT be purged during login migration');

        // Verify caller remains authenticated
        const check = await auth.assertStaffSession();
        assert.strictEqual(check.authorized, true, 'Caller must remain authenticated');
      } finally {
        headersMock.clearTestCookies();
        await prisma.session.deleteMany({ where: { userId: tempStaff.id } }).catch(() => {});
        await prisma.staffUser.delete({ where: { id: tempStaff.id } }).catch(() => {});
      }
    });
  });

  // =========================================================================
  // 6. Admin-Only Server Actions Authorization
  // =========================================================================
  describe('6. Production Server Action RBAC: toggleStaffFrontDeskAction', () => {
    it('rejects unauthenticated callers attempting to toggle front-desk permission', async () => {
      if (!generalStaff) return;
      headersMock.clearTestCookies();
      const res = await actions.toggleStaffFrontDeskAction(generalStaff.id, true);
      assert.strictEqual(res.success, false);
      assert.ok(res.error.includes('Authentication required') || res.error.includes('Admin privileges required'));
    });

    it('rejects General Staff callers attempting to toggle front-desk permission', async () => {
      if (!generalStaff) return;
      await withSession(generalStaff.id, 'staff', async () => {
        const res = await actions.toggleStaffFrontDeskAction(generalStaff.id, true);
        assert.strictEqual(res.success, false);
        assert.ok(res.error.includes('Admin privileges required'));
      });
    });

    it('rejects Front Desk Staff callers attempting to toggle front-desk permission', async () => {
      if (!frontDeskStaff || !generalStaff) return;
      await withSession(frontDeskStaff.id, 'staff', async () => {
        const res = await actions.toggleStaffFrontDeskAction(generalStaff.id, true);
        assert.strictEqual(res.success, false);
        assert.ok(res.error.includes('Admin privileges required'));
      });
    });

    it('permits Admin callers to toggle front-desk permission', async () => {
      if (!adminStaff || !generalStaff) return;
      await withSession(adminStaff.id, 'admin', async () => {
        // Toggle to true
        const resTrue = await actions.toggleStaffFrontDeskAction(generalStaff.id, true);
        assert.strictEqual(resTrue.success, true);
        assert.strictEqual(resTrue.staff.isFrontDesk, true);

        // Toggle back to false to restore original state
        const resFalse = await actions.toggleStaffFrontDeskAction(generalStaff.id, false);
        assert.strictEqual(resFalse.success, true);
        assert.strictEqual(resFalse.staff.isFrontDesk, false);
      });
    });
  });

  // =========================================================================
  // 7. Live Server Integration (Shared Staff Layout, Middleware, and Logout)
  // =========================================================================
  describe('7. Live Server Integration Tests (Layout, Middleware, Logout)', () => {
    it('shared staff layout rejects unauthenticated access with 307 redirect to staff-login', async () => {
      if (!isServerRunning) return;
      const res = await fetch(`${BASE_URL}/attendance`, { redirect: 'manual' });
      assert.strictEqual(res.status, 307);
      const location = res.headers.get('location');
      assert.ok(location.includes('/auth/staff-login'));
    });

    it('middleware protects /students with 307 redirect to staff-login', async () => {
      if (!isServerRunning) return;
      const res = await fetch(`${BASE_URL}/students`, { redirect: 'manual' });
      assert.strictEqual(res.status, 307);
      const location = res.headers.get('location');
      assert.ok(location.includes('/auth/staff-login'));
      assert.ok(location.includes('returnUrl=%2Fstudents'));
    });

    it('shared staff layout rejects parent session with redirect to staff-login', async () => {
      if (!isServerRunning || !parentUser) return;
      const session = await prisma.session.create({
        data: { userId: parentUser.id, role: 'parent', expiresAt: new Date(Date.now() + 3600000) },
      });
      const token = crypto.signSessionPayload(session.id);

      try {
        const res = await fetch(`${BASE_URL}/attendance`, {
          headers: { Cookie: `schoolpass_session=${token}` },
        });
        const html = await res.text();
        assert.ok(
          html.includes('Staff &amp; Admin Sign In') || html.includes('staff-login'),
          'Parent session must be redirected away from staff layout to staff login'
        );
        assert.ok(!html.includes('Attendance Dashboard'), 'Attendance dashboard must not be rendered for parents');
      } finally {
        await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      }
    });

    it('general staff session on /students returns HTTP 200 with Access Restricted screen', async () => {
      if (!isServerRunning || !generalStaff) return;
      const session = await prisma.session.create({
        data: { userId: generalStaff.id, role: 'staff', expiresAt: new Date(Date.now() + 3600000) },
      });
      const token = crypto.signSessionPayload(session.id);

      try {
        const res = await fetch(`${BASE_URL}/students`, {
          headers: { Cookie: `schoolpass_session=${token}` },
        });
        assert.strictEqual(res.status, 200);
        const html = await res.text();
        assert.ok(html.includes('Access Restricted'), 'General staff must see Access Restricted');
        assert.ok(!html.includes('Register Prospective Student'), 'Intake manager must not be rendered');
      } finally {
        await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      }
    });

    it('front desk staff session on /students returns HTTP 200 with intake UI and no Admin tab', async () => {
      if (!isServerRunning || !frontDeskStaff) return;
      const session = await prisma.session.create({
        data: { userId: frontDeskStaff.id, role: 'staff', expiresAt: new Date(Date.now() + 3600000) },
      });
      const token = crypto.signSessionPayload(session.id);

      try {
        const res = await fetch(`${BASE_URL}/students`, {
          headers: { Cookie: `schoolpass_session=${token}` },
        });
        assert.strictEqual(res.status, 200);
        const html = await res.text();
        assert.ok(!html.includes('Access Restricted'), 'Front desk staff must not see Access Restricted');
        assert.ok(
          html.includes('Prospective Students Intake') || html.includes('Register Prospective Student'),
          'Intake UI must be rendered'
        );
      } finally {
        await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      }
    });

    it('logout route terminates staff session and redirects to /auth/staff-login', async () => {
      if (!isServerRunning || !generalStaff) return;
      const session = await prisma.session.create({
        data: { userId: generalStaff.id, role: 'staff', expiresAt: new Date(Date.now() + 3600000) },
      });
      const token = crypto.signSessionPayload(session.id);

      const res = await fetch(`${BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          Accept: 'text/html',
          Cookie: `schoolpass_session=${token}`,
        },
        redirect: 'manual',
      });

      assert.strictEqual(res.status, 303);
      const location = res.headers.get('location');
      assert.ok(location.includes('/auth/staff-login'));

      // Check cookie was expired
      const setCookie = res.headers.get('set-cookie');
      assert.ok(setCookie.includes('schoolpass_session='));

      // Verify session was deleted from database
      const dbCheck = await prisma.session.findUnique({ where: { id: session.id } });
      assert.strictEqual(dbCheck, null, 'Session must be deleted from DB upon logout');
    });
  });
});
