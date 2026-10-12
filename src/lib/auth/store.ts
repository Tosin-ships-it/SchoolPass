import 'server-only';
import { prisma } from '@/lib/db';

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
  blockedUntil: Date | null;
}

/**
 * Backward compatibility no-op for previous in-memory seed hook.
 */
export async function ensureSeededStore(): Promise<void> {
  // Persistence is now backed by PostgreSQL Neon branch.
}

// ==========================================
// Parent Repository
// ==========================================

export async function findParentByEmail(email: string): Promise<ParentAccount | null> {
  const parent = await prisma.parent.findUnique({
    where: { email: email.toLowerCase().trim() },
  });
  return parent;
}

export async function findParentById(id: string): Promise<ParentAccount | null> {
  const parent = await prisma.parent.findUnique({
    where: { id },
  });
  return parent;
}

export async function createParent(account: Omit<ParentAccount, 'id' | 'createdAt' | 'updatedAt'>): Promise<ParentAccount> {
  const parent = await prisma.parent.create({
    data: {
      name: account.name,
      email: account.email.toLowerCase().trim(),
      passwordHash: account.passwordHash,
      previousPasswordHashes: account.previousPasswordHashes ?? [],
      emailVerifiedAt: account.emailVerifiedAt,
    },
  });
  return parent;
}

export async function updateParent(id: string, updates: Partial<ParentAccount>): Promise<ParentAccount | null> {
  try {
    const parent = await prisma.parent.update({
      where: { id },
      data: {
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.email !== undefined && { email: updates.email.toLowerCase().trim() }),
        ...(updates.passwordHash !== undefined && { passwordHash: updates.passwordHash }),
        ...(updates.previousPasswordHashes !== undefined && { previousPasswordHashes: updates.previousPasswordHashes }),
        ...(updates.emailVerifiedAt !== undefined && { emailVerifiedAt: updates.emailVerifiedAt }),
      },
    });
    return parent;
  } catch {
    return null;
  }
}

// ==========================================
// Staff Repository
// ==========================================

export async function findStaffByEmail(email: string): Promise<StaffAccount | null> {
  const staff = await prisma.staffUser.findUnique({
    where: { email: email.toLowerCase().trim() },
  });
  return staff;
}

export async function findStaffById(id: string): Promise<StaffAccount | null> {
  const staff = await prisma.staffUser.findUnique({
    where: { id },
  });
  return staff;
}

// ==========================================
// Verification Tokens
// ==========================================

export async function saveVerificationToken(email: string, tokenHash: string, expiresAt: Date): Promise<VerificationTokenRecord> {
  // Delete any existing token for this email to prevent duplicate pending verification links
  await prisma.verificationToken.deleteMany({
    where: { email: email.toLowerCase().trim() },
  });

  const record = await prisma.verificationToken.create({
    data: {
      email: email.toLowerCase().trim(),
      tokenHash,
      expiresAt,
    },
  });
  return record;
}

export async function findVerificationTokenByHash(tokenHash: string): Promise<VerificationTokenRecord | null> {
  const record = await prisma.verificationToken.findUnique({
    where: { tokenHash },
  });
  return record;
}

export async function deleteVerificationToken(tokenHash: string): Promise<void> {
  await prisma.verificationToken.deleteMany({
    where: { tokenHash },
  });
}

// ==========================================
// Password Reset Tokens
// ==========================================

export async function savePasswordResetToken(email: string, tokenHash: string, expiresAt: Date): Promise<PasswordResetTokenRecord> {
  // Delete any existing token for this email to ensure only the latest reset link is valid
  await prisma.passwordResetToken.deleteMany({
    where: { email: email.toLowerCase().trim() },
  });

  const record = await prisma.passwordResetToken.create({
    data: {
      email: email.toLowerCase().trim(),
      tokenHash,
      expiresAt,
    },
  });
  return record;
}

export async function findPasswordResetTokenByHash(tokenHash: string): Promise<PasswordResetTokenRecord | null> {
  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });
  return record;
}

export async function deletePasswordResetToken(tokenHash: string): Promise<void> {
  await prisma.passwordResetToken.deleteMany({
    where: { tokenHash },
  });
}

// ==========================================
// Sessions
// ==========================================

export async function createSessionRecord(userId: string, role: 'parent' | 'staff' | 'admin', expiresAt: Date): Promise<SessionRecord> {
  const session = await prisma.session.create({
    data: {
      userId,
      role,
      expiresAt,
    },
  });
  return {
    id: session.id,
    userId: session.userId,
    role: session.role as 'parent' | 'staff' | 'admin',
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
  };
}

export async function findSessionRecord(sessionId: string): Promise<SessionRecord | null> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
  });
  if (!session) return null;

  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: sessionId } }).catch(() => {});
    return null;
  }

  return {
    id: session.id,
    userId: session.userId,
    role: session.role as 'parent' | 'staff' | 'admin',
    createdAt: session.createdAt,
    expiresAt: session.expiresAt,
  };
}

export async function deleteSessionRecord(sessionId: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { id: sessionId },
  });
}

export async function deleteAllUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { userId },
  });
}

// ==========================================
// Parent-Student Links
// ==========================================

export async function getParentStudentLinks(parentId: string): Promise<ParentStudentLink[]> {
  const links = await prisma.parentStudent.findMany({
    where: { parentId },
    include: { student: true },
  });

  return links
    .filter(link => link.student.leftAt === null) // Addendum §9.6: Leavers excluded from active parent access
    .map(link => ({
      id: link.id,
      parentId: link.parentId,
      studentId: link.studentId,
      studentName: link.student.name,
      createdAt: link.createdAt,
    }));
}

export async function isParentLinkedToStudent(parentId: string, studentId: string): Promise<boolean> {
  const link = await prisma.parentStudent.findUnique({
    where: {
      parentId_studentId: {
        parentId,
        studentId,
      },
    },
    include: {
      student: true,
    },
  });

  if (!link) return false;
  // Addendum §9.6: Leaver marker — non-null leftAt blocks parent access
  if (link.student.leftAt !== null) return false;

  return true;
}

// ==========================================
// Rate Limiting
// ==========================================

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout

export async function checkRateLimit(key: string): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const now = new Date();
  const entry = await prisma.rateLimit.findUnique({
    where: { key },
  });

  if (!entry) {
    return { allowed: true };
  }

  if (entry.blockedUntil && entry.blockedUntil.getTime() > now.getTime()) {
    const remainingSec = Math.ceil((entry.blockedUntil.getTime() - now.getTime()) / 1000);
    return { allowed: false, retryAfterSeconds: remainingSec };
  }

  if (entry.blockedUntil && entry.blockedUntil.getTime() <= now.getTime()) {
    await prisma.rateLimit.delete({ where: { key } }).catch(() => {});
    return { allowed: true };
  }

  return { allowed: true };
}

export async function recordFailedAttempt(key: string): Promise<void> {
  const now = new Date();
  const entry = await prisma.rateLimit.findUnique({
    where: { key },
  });

  const attempts = (entry?.attempts ?? 0) + 1;
  const blockedUntil = attempts >= MAX_FAILED_ATTEMPTS ? new Date(now.getTime() + LOCKOUT_DURATION_MS) : null;

  await prisma.rateLimit.upsert({
    where: { key },
    create: {
      key,
      attempts,
      blockedUntil,
    },
    update: {
      attempts,
      blockedUntil,
    },
  });
}

export async function resetRateLimit(key: string): Promise<void> {
  await prisma.rateLimit.deleteMany({
    where: { key },
  });
}
