import test, { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { cookies, setTestCookie, clearTestCookies, getTestCookieEntry } from 'next/headers';
import {
  getSession,
  assertStaffSession,
  assertAdminSession,
  assertFrontDeskAccess,
  setSessionCookie,
  clearSessionCookie,
  logout,
  loginStaff,
  loginParent,
  STAFF_INACTIVITY_TIMEOUT_MINUTES,
  STAFF_INACTIVITY_TIMEOUT_MS,
  SESSION_DURATION_DAYS,
  SESSION_COOKIE_NAME,
} from './index.ts';
import {
  signSessionPayload,
  verifySessionPayload,
  hashPassword,
} from './crypto.ts';
import { prisma } from '../db/index.ts';

describe('SchoolPass Staff Session Persistence & Inactivity Timeout Suite', () => {
  // In-memory store to mock Prisma session and user queries deterministically
  const memorySessions = new Map();
  const memoryStaffUsers = new Map();
  const memoryParents = new Map();

  let originalSessionFindUnique;
  let originalSessionDelete;
  let originalSessionDeleteMany;
  let originalSessionCreate;
  let originalSessionUpdate;
  let originalStaffFindUnique;
  let originalParentFindUnique;
  let originalParentStudentFindMany;

  beforeEach(() => {
    clearTestCookies();
    memorySessions.clear();
    memoryStaffUsers.clear();
    memoryParents.clear();

    // Setup seeded mock users
    memoryStaffUsers.set('staff_general_01', {
      id: 'staff_general_01',
      name: 'General Staff',
      email: 'staff@school.ng',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=1$mockhash',
      role: 'STAFF',
      isFrontDesk: false,
    });

    memoryStaffUsers.set('staff_frontdesk_01', {
      id: 'staff_frontdesk_01',
      name: 'Front Desk Officer',
      email: 'frontdesk@school.ng',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=1$mockhash',
      role: 'STAFF',
      isFrontDesk: true,
    });

    memoryStaffUsers.set('admin_01', {
      id: 'admin_01',
      name: 'School Admin',
      email: 'admin@school.ng',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=1$mockhash',
      role: 'ADMIN',
      isFrontDesk: false,
    });

    memoryParents.set('parent_01', {
      id: 'parent_01',
      name: 'Parent User',
      email: 'parent@home.ng',
      passwordHash: '$argon2id$v=19$m=65536,t=3,p=1$mockhash',
      emailVerifiedAt: new Date(),
      isLocked: false,
    });

    // Mock prisma.session operations
    originalSessionFindUnique = prisma.session.findUnique;
    prisma.session.findUnique = async ({ where }) => {
      const item = memorySessions.get(where.id);
      return item ? { ...item } : null;
    };

    originalSessionDelete = prisma.session.delete;
    prisma.session.delete = async ({ where }) => {
      memorySessions.delete(where.id);
      return {};
    };

    originalSessionDeleteMany = prisma.session.deleteMany;
    prisma.session.deleteMany = async ({ where }) => {
      if (where.id) memorySessions.delete(where.id);
      if (where.userId) {
        for (const [id, s] of memorySessions.entries()) {
          if (s.userId === where.userId) memorySessions.delete(id);
        }
      }
      return { count: 1 };
    };

    originalSessionCreate = prisma.session.create;
    prisma.session.create = async ({ data }) => {
      const id = 'sess_' + Math.random().toString(36).slice(2);
      const record = {
        id,
        userId: data.userId,
        role: data.role,
        expiresAt: new Date(data.expiresAt),
        createdAt: new Date(),
      };
      memorySessions.set(id, record);
      return record;
    };

    originalSessionUpdate = prisma.session.update;
    prisma.session.update = async ({ where, data }) => {
      const existing = memorySessions.get(where.id);
      if (existing) {
        if (data.expiresAt) existing.expiresAt = new Date(data.expiresAt);
        memorySessions.set(where.id, existing);
      }
      return existing;
    };

    // Mock prisma.staffUser
    originalStaffFindUnique = prisma.staffUser.findUnique;
    prisma.staffUser.findUnique = async ({ where }) => {
      if (where.id) return memoryStaffUsers.get(where.id) || null;
      if (where.email) {
        for (const s of memoryStaffUsers.values()) {
          if (s.email === where.email) return { ...s };
        }
      }
      return null;
    };

    // Mock prisma.parent
    originalParentFindUnique = prisma.parent.findUnique;
    prisma.parent.findUnique = async ({ where }) => {
      if (where.id) return memoryParents.get(where.id) || null;
      if (where.email) {
        for (const p of memoryParents.values()) {
          if (p.email === where.email) return { ...p };
        }
      }
      return null;
    };

    // Mock prisma.parentStudent
    originalParentStudentFindMany = prisma.parentStudent.findMany;
    prisma.parentStudent.findMany = async () => [];
  });

  afterEach(() => {
    prisma.session.findUnique = originalSessionFindUnique;
    prisma.session.delete = originalSessionDelete;
    prisma.session.deleteMany = originalSessionDeleteMany;
    prisma.session.create = originalSessionCreate;
    prisma.session.update = originalSessionUpdate;
    prisma.staffUser.findUnique = originalStaffFindUnique;
    prisma.parent.findUnique = originalParentFindUnique;
    prisma.parentStudent.findMany = originalParentStudentFindMany;
    clearTestCookies();
  });

  describe('1. Browser-Session Cookie Configuration', () => {
    it('sets a non-persistent session cookie (omits maxAge) for staff accounts', async () => {
      const token = 'test-token-staff';
      await setSessionCookie(token, false);

      const cookieEntry = getTestCookieEntry(SESSION_COOKIE_NAME);
      assert.ok(cookieEntry, 'Cookie must be set in cookie store');
      assert.equal(cookieEntry.value, token);
      assert.equal(cookieEntry.options.httpOnly, true, 'HttpOnly must be true');
      assert.equal(cookieEntry.options.sameSite, 'lax', 'SameSite must be lax');
      assert.equal(cookieEntry.options.path, '/', 'Path must be root');
      assert.equal(
        cookieEntry.options.maxAge,
        undefined,
        'Staff cookie must omit maxAge to be a browser-session cookie'
      );
    });

    it('sets a persistent cookie with 7-day maxAge for parent accounts', async () => {
      const token = 'test-token-parent';
      await setSessionCookie(token, true);

      const cookieEntry = getTestCookieEntry(SESSION_COOKIE_NAME);
      assert.ok(cookieEntry);
      assert.equal(cookieEntry.value, token);
      assert.equal(
        cookieEntry.options.maxAge,
        SESSION_DURATION_DAYS * 24 * 60 * 60,
        'Parent cookie must have 7-day maxAge'
      );
    });
  });

  describe('2. Inactivity Timeout (15 minutes) & Server-Side Enforcement', () => {
    it('configures staff timeout constant strictly to 15 minutes', () => {
      assert.equal(STAFF_INACTIVITY_TIMEOUT_MINUTES, 15);
      assert.equal(STAFF_INACTIVITY_TIMEOUT_MS, 15 * 60 * 1000);
    });

    it('invalidates staff session after 15 minutes of inactivity', async () => {
      // Create session that expired 1 second ago (15 minutes and 1 second of inactivity)
      const expiredSession = {
        id: 'sess_staff_expired',
        userId: 'staff_general_01',
        role: 'staff',
        expiresAt: new Date(Date.now() - 1000),
        createdAt: new Date(Date.now() - 16 * 60 * 1000),
      };
      memorySessions.set(expiredSession.id, expiredSession);

      const token = signSessionPayload(expiredSession.id);
      setTestCookie(SESSION_COOKIE_NAME, token);

      // Verify getSession returns null and cleans up DB record
      const session = await getSession();
      assert.equal(session, null, 'Expired staff session must return null');
      assert.equal(
        memorySessions.has(expiredSession.id),
        false,
        'Expired session must be purged from database'
      );
    });

    it('slides the inactivity window by 15 minutes when staff member is actively interacting', async () => {
      // Create an active staff session with 5 minutes remaining (10 minutes elapsed)
      const initialExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
      const activeSession = {
        id: 'sess_staff_active',
        userId: 'staff_general_01',
        role: 'staff',
        expiresAt: initialExpiresAt,
        createdAt: new Date(Date.now() - 10 * 60 * 1000),
      };
      memorySessions.set(activeSession.id, activeSession);

      const token = signSessionPayload(activeSession.id);
      setTestCookie(SESSION_COOKIE_NAME, token);

      const session = await getSession();
      assert.ok(session, 'Active staff session must resolve');
      assert.equal(session.userId, 'staff_general_01');

      // Check that session expiresAt was refreshed in database
      const updatedInDb = memorySessions.get(activeSession.id);
      const expectedMinExpiresAt = Date.now() + 14 * 60 * 1000;
      assert.ok(
        updatedInDb.expiresAt.getTime() > expectedMinExpiresAt,
        'Active session expiresAt must be extended to 15 minutes from now'
      );
    });
  });

  describe('3. Security Coverage across All Staff Roles', () => {
    it('blocks expired General Staff from assertStaffSession and reports Authentication required', async () => {
      const expiredSession = {
        id: 'sess_general_expired',
        userId: 'staff_general_01',
        role: 'staff',
        expiresAt: new Date(Date.now() - 5000),
        createdAt: new Date(Date.now() - 20 * 60 * 1000),
      };
      memorySessions.set(expiredSession.id, expiredSession);
      setTestCookie(SESSION_COOKIE_NAME, signSessionPayload(expiredSession.id));

      const authResult = await assertStaffSession();
      assert.equal(authResult.authorized, false);
      assert.equal(authResult.error, 'Authentication required.');
    });

    it('blocks expired Front Desk Staff from assertFrontDeskAccess', async () => {
      const expiredSession = {
        id: 'sess_frontdesk_expired',
        userId: 'staff_frontdesk_01',
        role: 'staff',
        expiresAt: new Date(Date.now() - 10000),
        createdAt: new Date(Date.now() - 30 * 60 * 1000),
      };
      memorySessions.set(expiredSession.id, expiredSession);
      setTestCookie(SESSION_COOKIE_NAME, signSessionPayload(expiredSession.id));

      const authResult = await assertFrontDeskAccess();
      assert.equal(authResult.authorized, false);
      assert.equal(authResult.error, 'Authentication required.');
    });

    it('blocks expired Admin from assertAdminSession', async () => {
      const expiredSession = {
        id: 'sess_admin_expired',
        userId: 'admin_01',
        role: 'admin',
        expiresAt: new Date(Date.now() - 2000),
        createdAt: new Date(Date.now() - 25 * 60 * 1000),
      };
      memorySessions.set(expiredSession.id, expiredSession);
      setTestCookie(SESSION_COOKIE_NAME, signSessionPayload(expiredSession.id));

      const authResult = await assertAdminSession();
      assert.equal(authResult.authorized, false);
      assert.equal(authResult.error, 'Authentication required.');
    });

    it('grants access when Admin, Front Desk, and Staff sessions are active within 15 minutes', async () => {
      for (const [id, role] of [
        ['staff_general_01', 'staff'],
        ['staff_frontdesk_01', 'staff'],
        ['admin_01', 'admin'],
      ]) {
        const sess = {
          id: `sess_active_${id}`,
          userId: id,
          role,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
          createdAt: new Date(),
        };
        memorySessions.set(sess.id, sess);
        setTestCookie(SESSION_COOKIE_NAME, signSessionPayload(sess.id));

        const staffAuth = await assertStaffSession();
        assert.equal(staffAuth.authorized, true, `Role ${role} should be authorized`);
      }
    });
  });

  describe('4. Parent Authentication Isolation', () => {
    it('does not apply 15-minute inactivity timeout to parent accounts', async () => {
      // Parent session created 30 minutes ago, valid for 7 days
      const parentSession = {
        id: 'sess_parent_01',
        userId: 'parent_01',
        role: 'parent',
        expiresAt: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000), // 6 days left
        createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 mins ago
      };
      memorySessions.set(parentSession.id, parentSession);
      setTestCookie(SESSION_COOKIE_NAME, signSessionPayload(parentSession.id));

      const session = await getSession();
      assert.ok(session, 'Parent session must remain valid after 30 minutes');
      assert.equal(session.role, 'parent');
      assert.equal(session.userId, 'parent_01');
    });
  });

  describe('5. Browser Reopening & Anti-Restoration', () => {
    it('rejects restored browser session cookie if more than 15 minutes have elapsed since last activity', async () => {
      const sess = {
        id: 'sess_restored_idle',
        userId: 'staff_general_01',
        role: 'staff',
        expiresAt: new Date(Date.now() - 60 * 1000), // Inactive for > 15 minutes
        createdAt: new Date(Date.now() - 40 * 60 * 1000),
      };
      memorySessions.set(sess.id, sess);

      // Browser restored old cookie and presents it to server
      const restoredCookie = signSessionPayload(sess.id);
      setTestCookie(SESSION_COOKIE_NAME, restoredCookie);

      const session = await getSession();
      assert.equal(
        session,
        null,
        'Server must evaluate database record and reject restored expired session'
      );
      assert.equal(memorySessions.has(sess.id), false, 'Expired session must be deleted');
    });
  });

  describe('6. Explicit Sign-Out', () => {
    it('explicit logout invalidates server-side session in database and clears authentication cookie', async () => {
      const activeSession = {
        id: 'sess_logout_test',
        userId: 'staff_general_01',
        role: 'staff',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        createdAt: new Date(),
      };
      memorySessions.set(activeSession.id, activeSession);

      const cookieVal = signSessionPayload(activeSession.id);
      setTestCookie(SESSION_COOKIE_NAME, cookieVal);

      // Perform logout
      const result = await logout(cookieVal);
      assert.equal(result.success, true);
      assert.equal(result.role, 'staff');

      // Verify database record was deleted
      assert.equal(
        memorySessions.has(activeSession.id),
        false,
        'Database session record must be deleted upon logout'
      );

      // Subsequent session check returns null
      const check = await getSession();
      assert.equal(check, null);
    });
  });
});

