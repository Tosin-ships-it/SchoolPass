import 'server-only';
import { hashPassword } from './crypto';

export interface ParentAccount {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  previousPasswordHashes: string[];
  emailVerifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StaffAccount {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: 'STAFF' | 'ADMIN';
  createdAt: Date;
  updatedAt: Date;
}

export interface VerificationTokenRecord {
  id: string;
  email: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface PasswordResetTokenRecord {
  id: string;
  email: string;
  tokenHash: string;
  expiresAt: Date;
  createdAt: Date;
}

export interface SessionRecord {
  id: string;
  userId: string;
  role: 'parent' | 'staff' | 'admin';
  createdAt: Date;
  expiresAt: Date;
}

export interface ParentStudentLink {
  id: string;
  parentId: string;
  studentId: string;
  studentName: string;
  createdAt: Date;
}

export interface RateLimitEntry {
  key: string;
  attempts: number;
  blockedUntil: number | null;
}

// In-memory persistent store structure for development
interface AuthDataStore {
  parents: Map<string, ParentAccount>;
  staffUsers: Map<string, StaffAccount>;
  verificationTokens: Map<string, VerificationTokenRecord>;
  passwordResetTokens: Map<string, PasswordResetTokenRecord>;
  sessions: Map<string, SessionRecord>;
  parentStudentLinks: Map<string, ParentStudentLink>;
  rateLimits: Map<string, RateLimitEntry>;
  isSeeded: boolean;
}

const globalForAuthStore = globalThis as unknown as {
  __schoolpass_auth_store?: AuthDataStore;
};

function getStore(): AuthDataStore {
  if (!globalForAuthStore.__schoolpass_auth_store) {
    globalForAuthStore.__schoolpass_auth_store = {
      parents: new Map(),
      staffUsers: new Map(),
      verificationTokens: new Map(),
      passwordResetTokens: new Map(),
      sessions: new Map(),
      parentStudentLinks: new Map(),
      rateLimits: new Map(),
      isSeeded: false,
    };
  }
  return globalForAuthStore.__schoolpass_auth_store;
}

/**
 * Initialize default test fixtures for development testing.
 */
export async function ensureSeededStore(): Promise<void> {
  const store = getStore();
  if (store.isSeeded) return;

  const parentPasswordHash = await hashPassword('ParentPass2026!');
  const staffPasswordHash = await hashPassword('StaffPass2026!');
  const adminPasswordHash = await hashPassword('SchoolAdmin2026!');

  // 1. Linked Parent
  const linkedParent: ParentAccount = {
    id: 'parent_cuid_01',
    name: 'Chinedu Okafor',
    email: 'parent.linked@example.com',
    passwordHash: parentPasswordHash,
    previousPasswordHashes: [parentPasswordHash],
    emailVerifiedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  store.parents.set(linkedParent.email, linkedParent);

  // Link to a student (Amina Okafor)
  store.parentStudentLinks.set('link_01', {
    id: 'link_cuid_01',
    parentId: linkedParent.id,
    studentId: 'student_cuid_01',
    studentName: 'Amina Okafor (Primary 4)',
    createdAt: new Date(),
  });

  // 2. Unlinked Parent (verified, no child linked yet)
  const unlinkedParent: ParentAccount = {
    id: 'parent_cuid_02',
    name: 'Zainab Balogun',
    email: 'parent.unlinked@example.com',
    passwordHash: parentPasswordHash,
    previousPasswordHashes: [parentPasswordHash],
    emailVerifiedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  store.parents.set(unlinkedParent.email, unlinkedParent);

  // 3. Unverified Parent (signed up, email pending)
  const unverifiedParent: ParentAccount = {
    id: 'parent_cuid_03',
    name: 'Emeka Nwosu',
    email: 'parent.unverified@example.com',
    passwordHash: parentPasswordHash,
    previousPasswordHashes: [parentPasswordHash],
    emailVerifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  store.parents.set(unverifiedParent.email, unverifiedParent);

  // 4. Staff Member
  const staffMember: StaffAccount = {
    id: 'staff_cuid_01',
    name: 'Grace Adeleke',
    email: 'staff@school.ng',
    passwordHash: staffPasswordHash,
    role: 'STAFF',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  store.staffUsers.set(staffMember.email, staffMember);

  // 5. School Admin / Owner
  const schoolAdmin: StaffAccount = {
    id: 'admin_cuid_01',
    name: 'Dr. Folake Davies',
    email: 'admin@school.ng',
    passwordHash: adminPasswordHash,
    role: 'ADMIN',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  store.staffUsers.set(schoolAdmin.email, schoolAdmin);

  store.isSeeded = true;
}

// Parent Repository
export async function findParentByEmail(email: string): Promise<ParentAccount | null> {
  await ensureSeededStore();
  const store = getStore();
  return store.parents.get(email.toLowerCase().trim()) ?? null;
}

export async function findParentById(id: string): Promise<ParentAccount | null> {
  await ensureSeededStore();
  const store = getStore();
  for (const parent of store.parents.values()) {
    if (parent.id === id) return parent;
  }
  return null;
}

export async function createParent(account: Omit<ParentAccount, 'id' | 'createdAt' | 'updatedAt'>): Promise<ParentAccount> {
  await ensureSeededStore();
  const store = getStore();
  const newId = `parent_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const parent: ParentAccount = {
    ...account,
    id: newId,
    email: account.email.toLowerCase().trim(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  store.parents.set(parent.email, parent);
  return parent;
}

export async function updateParent(id: string, updates: Partial<ParentAccount>): Promise<ParentAccount | null> {
  await ensureSeededStore();
  const parent = await findParentById(id);
  if (!parent) return null;

  const store = getStore();
  const updated: ParentAccount = {
    ...parent,
    ...updates,
    updatedAt: new Date(),
  };
  store.parents.set(updated.email, updated);
  return updated;
}

// Staff Repository
export async function findStaffByEmail(email: string): Promise<StaffAccount | null> {
  await ensureSeededStore();
  const store = getStore();
  return store.staffUsers.get(email.toLowerCase().trim()) ?? null;
}

export async function findStaffById(id: string): Promise<StaffAccount | null> {
  await ensureSeededStore();
  const store = getStore();
  for (const staff of store.staffUsers.values()) {
    if (staff.id === id) return staff;
  }
  return null;
}

// Verification Tokens
export async function saveVerificationToken(email: string, tokenHash: string, expiresAt: Date): Promise<VerificationTokenRecord> {
  await ensureSeededStore();
  const store = getStore();
  const record: VerificationTokenRecord = {
    id: `vt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    email: email.toLowerCase().trim(),
    tokenHash,
    expiresAt,
    createdAt: new Date(),
  };
  store.verificationTokens.set(tokenHash, record);
  return record;
}

export async function findVerificationTokenByHash(tokenHash: string): Promise<VerificationTokenRecord | null> {
  await ensureSeededStore();
  const store = getStore();
  return store.verificationTokens.get(tokenHash) ?? null;
}

export async function deleteVerificationToken(tokenHash: string): Promise<void> {
  await ensureSeededStore();
  const store = getStore();
  store.verificationTokens.delete(tokenHash);
}

// Password Reset Tokens
export async function savePasswordResetToken(email: string, tokenHash: string, expiresAt: Date): Promise<PasswordResetTokenRecord> {
  await ensureSeededStore();
  const store = getStore();
  const record: PasswordResetTokenRecord = {
    id: `prt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    email: email.toLowerCase().trim(),
    tokenHash,
    expiresAt,
    createdAt: new Date(),
  };
  store.passwordResetTokens.set(tokenHash, record);
  return record;
}

export async function findPasswordResetTokenByHash(tokenHash: string): Promise<PasswordResetTokenRecord | null> {
  await ensureSeededStore();
  const store = getStore();
  return store.passwordResetTokens.get(tokenHash) ?? null;
}

export async function deletePasswordResetToken(tokenHash: string): Promise<void> {
  await ensureSeededStore();
  const store = getStore();
  store.passwordResetTokens.delete(tokenHash);
}

// Sessions
export async function createSessionRecord(userId: string, role: 'parent' | 'staff' | 'admin', expiresAt: Date): Promise<SessionRecord> {
  await ensureSeededStore();
  const store = getStore();
  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  const session: SessionRecord = {
    id: sessionId,
    userId,
    role,
    createdAt: new Date(),
    expiresAt,
  };
  store.sessions.set(sessionId, session);
  return session;
}

export async function findSessionRecord(sessionId: string): Promise<SessionRecord | null> {
  await ensureSeededStore();
  const store = getStore();
  const session = store.sessions.get(sessionId);
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    store.sessions.delete(sessionId);
    return null;
  }
  return session;
}

export async function deleteSessionRecord(sessionId: string): Promise<void> {
  await ensureSeededStore();
  const store = getStore();
  store.sessions.delete(sessionId);
}

export async function deleteAllUserSessions(userId: string): Promise<void> {
  await ensureSeededStore();
  const store = getStore();
  for (const [id, session] of store.sessions.entries()) {
    if (session.userId === userId) {
      store.sessions.delete(id);
    }
  }
}

// Parent-Student Links
export async function getParentStudentLinks(parentId: string): Promise<ParentStudentLink[]> {
  await ensureSeededStore();
  const store = getStore();
  const links: ParentStudentLink[] = [];
  for (const link of store.parentStudentLinks.values()) {
    if (link.parentId === parentId) {
      links.push(link);
    }
  }
  return links;
}

export async function isParentLinkedToStudent(parentId: string, studentId: string): Promise<boolean> {
  await ensureSeededStore();
  const store = getStore();
  for (const link of store.parentStudentLinks.values()) {
    if (link.parentId === parentId && link.studentId === studentId) {
      return true;
    }
  }
  return false;
}

// Rate Limiting
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout

export async function checkRateLimit(key: string): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  await ensureSeededStore();
  const store = getStore();
  const now = Date.now();
  const entry = store.rateLimits.get(key);

  if (!entry) {
    return { allowed: true };
  }

  if (entry.blockedUntil && entry.blockedUntil > now) {
    const remainingSec = Math.ceil((entry.blockedUntil - now) / 1000);
    return { allowed: false, retryAfterSeconds: remainingSec };
  }

  if (entry.blockedUntil && entry.blockedUntil <= now) {
    store.rateLimits.delete(key);
    return { allowed: true };
  }

  return { allowed: true };
}

export async function recordFailedAttempt(key: string): Promise<void> {
  await ensureSeededStore();
  const store = getStore();
  const now = Date.now();
  const entry = store.rateLimits.get(key) ?? { key, attempts: 0, blockedUntil: null };

  entry.attempts += 1;
  if (entry.attempts >= MAX_FAILED_ATTEMPTS) {
    entry.blockedUntil = now + LOCKOUT_DURATION_MS;
  }
  store.rateLimits.set(key, entry);
}

export async function resetRateLimit(key: string): Promise<void> {
  await ensureSeededStore();
  const store = getStore();
  store.rateLimits.delete(key);
}
