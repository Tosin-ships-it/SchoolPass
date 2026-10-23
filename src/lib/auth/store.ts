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
  isFrontDesk: boolean;
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
  studentNumber?: string;
  className?: string;
  createdAt: Date;
}

export type LinkRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface StudentLinkRequestRecord {
  id: string;
  parentId: string;
  parentName?: string;
  parentEmail?: string;
  studentId: string;
  studentNumber: string;
  studentName: string;
  studentClass: string;
  status: LinkRequestStatus;
  reviewedByStaffId: string | null;
  reviewerName?: string | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
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

export async function updateStaffPassword(
  id: string,
  passwordHash: string,
  options?: { invalidateSessions?: boolean }
): Promise<StaffAccount | null> {
  try {
    const staff = await prisma.staffUser.update({
      where: { id },
      data: { passwordHash },
    });
    if (options?.invalidateSessions !== false) {
      await deleteAllUserSessions(id);
    }
    return staff;
  } catch {
    return null;
  }
}

/**
 * Conditionally rehashes a parent's stored password only if the current database hash
 * still matches the expected old hash that was verified during login.
 * Guarantees that concurrent password changes or resets cannot be overwritten by background migration.
 * Preserves user sessions intact.
 */
export async function conditionallyRehashParentPassword(
  id: string,
  expectedOldHash: string,
  newHash: string
): Promise<boolean> {
  try {
    const result = await prisma.parent.updateMany({
      where: {
        id,
        passwordHash: expectedOldHash,
      },
      data: {
        passwordHash: newHash,
      },
    });
    return result.count > 0;
  } catch {
    return false;
  }
}

/**
 * Conditionally rehashes a staff user's stored password only if the current database hash
 * still matches the expected old hash that was verified during login.
 * Guarantees that concurrent password changes or resets cannot be overwritten by background migration.
 * Explicitly preserves all active staff sessions.
 */
export async function conditionallyRehashStaffPassword(
  id: string,
  expectedOldHash: string,
  newHash: string
): Promise<boolean> {
  try {
    const result = await prisma.staffUser.updateMany({
      where: {
        id,
        passwordHash: expectedOldHash,
      },
      data: {
        passwordHash: newHash,
      },
    });
    return result.count > 0;
  } catch {
    return false;
  }
}

export async function createStaffUser(params: {
  name: string;
  email: string;
  passwordHash: string;
  role?: 'STAFF' | 'ADMIN';
  isFrontDesk?: boolean;
}): Promise<StaffAccount> {
  const staff = await prisma.staffUser.create({
    data: {
      name: params.name.trim(),
      email: params.email.toLowerCase().trim(),
      passwordHash: params.passwordHash,
      role: params.role || 'STAFF',
      isFrontDesk: params.isFrontDesk ?? false,
    },
  });
  return staff;
}

export async function setStaffFrontDeskPermission(
  staffId: string,
  isFrontDesk: boolean
): Promise<StaffAccount | null> {
  try {
    const staff = await prisma.staffUser.update({
      where: { id: staffId },
      data: { isFrontDesk },
    });
    return staff;
  } catch {
    return null;
  }
}

export async function getAllStaffUsers(): Promise<StaffAccount[]> {
  const staffList = await prisma.staffUser.findMany({
    orderBy: { createdAt: 'asc' },
  });
  return staffList;
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
      studentNumber: link.student.studentNumber,
      className: link.student.className,
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

export async function findStudentByNumber(studentNumber: string) {
  const normalized = studentNumber.trim().toUpperCase();
  return prisma.student.findUnique({
    where: { studentNumber: normalized },
  });
}

export async function findStudentById(studentId: string) {
  return prisma.student.findUnique({
    where: { id: studentId },
  });
}

export async function createStudentLinkRequest(
  parentId: string,
  studentNumber: string
): Promise<{
  success: boolean;
  error?: string;
  requestId?: string;
  studentId?: string;
  studentName?: string;
  className?: string;
}> {
  const normalizedNumber = studentNumber.trim().toUpperCase();
  if (!normalizedNumber) {
    return { success: false, error: 'Please enter a student number.' };
  }

  const student = await findStudentByNumber(normalizedNumber);
  if (!student || student.leftAt !== null) {
    return {
      success: false,
      error: 'Student not found with this student number. Please check and try again.',
    };
  }

  // Check if already actively linked
  const isLinked = await isParentLinkedToStudent(parentId, student.id);
  if (isLinked) {
    return {
      success: false,
      error: 'You are already linked to this student.',
    };
  }

  // Check if pending request exists
  const pending = await prisma.studentLinkRequest.findFirst({
    where: {
      parentId,
      studentId: student.id,
      status: 'PENDING',
    },
  });

  if (pending) {
    return {
      success: false,
      error: 'A link request for this student is already pending staff approval.',
    };
  }

  const request = await prisma.studentLinkRequest.create({
    data: {
      parentId,
      studentId: student.id,
      status: 'PENDING',
    },
  });

  return {
    success: true,
    requestId: request.id,
    studentId: student.id,
    studentName: student.name,
    className: student.className,
  };
}

export async function getParentLinkRequests(parentId: string): Promise<StudentLinkRequestRecord[]> {
  const requests = await prisma.studentLinkRequest.findMany({
    where: { parentId },
    include: {
      student: true,
      reviewedByStaff: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return requests.map(r => ({
    id: r.id,
    parentId: r.parentId,
    studentId: r.studentId,
    studentNumber: r.student.studentNumber,
    studentName: r.student.name,
    studentClass: r.student.className,
    status: r.status as LinkRequestStatus,
    reviewedByStaffId: r.reviewedByStaffId,
    reviewerName: r.reviewedByStaff?.name ?? null,
    reviewedAt: r.reviewedAt,
    rejectionReason: r.rejectionReason,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export async function getAllStudentLinkRequests(statusFilter?: LinkRequestStatus): Promise<StudentLinkRequestRecord[]> {
  const requests = await prisma.studentLinkRequest.findMany({
    where: statusFilter ? { status: statusFilter } : undefined,
    include: {
      parent: true,
      student: true,
      reviewedByStaff: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return requests.map(r => ({
    id: r.id,
    parentId: r.parentId,
    parentName: r.parent.name,
    parentEmail: r.parent.email,
    studentId: r.studentId,
    studentNumber: r.student.studentNumber,
    studentName: r.student.name,
    studentClass: r.student.className,
    status: r.status as LinkRequestStatus,
    reviewedByStaffId: r.reviewedByStaffId,
    reviewerName: r.reviewedByStaff?.name ?? null,
    reviewedAt: r.reviewedAt,
    rejectionReason: r.rejectionReason,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export async function approveStudentLinkRequest(
  requestId: string,
  staffId: string
): Promise<{ success: boolean; error?: string; parentId?: string; studentId?: string }> {
  try {
    return await prisma.$transaction(async tx => {
      const request = await tx.studentLinkRequest.findUnique({
        where: { id: requestId },
        include: { student: true },
      });

      if (!request) {
        return { success: false, error: 'Link request not found.' };
      }

      if (request.status !== 'PENDING') {
        return { success: false, error: `Link request has already been ${request.status.toLowerCase()}.` };
      }

      if (request.student.leftAt !== null) {
        return { success: false, error: 'Cannot link a student who is no longer actively enrolled.' };
      }

      // Create ParentStudent link
      await tx.parentStudent.upsert({
        where: {
          parentId_studentId: {
            parentId: request.parentId,
            studentId: request.studentId,
          },
        },
        create: {
          parentId: request.parentId,
          studentId: request.studentId,
        },
        update: {},
      });

      // Update link request
      await tx.studentLinkRequest.update({
        where: { id: requestId },
        data: {
          status: 'APPROVED',
          reviewedByStaffId: staffId,
          reviewedAt: new Date(),
        },
      });

      return {
        success: true,
        parentId: request.parentId,
        studentId: request.studentId,
      };
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to approve link request.';
    return { success: false, error: message };
  }
}

export async function rejectStudentLinkRequest(
  requestId: string,
  staffId: string,
  rejectionReason?: string
): Promise<{ success: boolean; error?: string; parentId?: string; studentId?: string }> {
  try {
    const request = await prisma.studentLinkRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      return { success: false, error: 'Link request not found.' };
    }

    if (request.status !== 'PENDING') {
      return { success: false, error: `Link request has already been ${request.status.toLowerCase()}.` };
    }

    await prisma.studentLinkRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        reviewedByStaffId: staffId,
        reviewedAt: new Date(),
        rejectionReason: rejectionReason?.trim() || null,
      },
    });

    return {
      success: true,
      parentId: request.parentId,
      studentId: request.studentId,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to reject link request.';
    return { success: false, error: message };
  }
}

export async function getAllParentStudentLinks(): Promise<
  Array<{
    id: string;
    parentId: string;
    parentName: string;
    parentEmail: string;
    studentId: string;
    studentNumber: string;
    studentName: string;
    className: string;
    createdAt: Date;
  }>
> {
  const links = await prisma.parentStudent.findMany({
    include: {
      parent: true,
      student: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return links
    .filter(l => l.student.leftAt === null)
    .map(l => ({
      id: l.id,
      parentId: l.parentId,
      parentName: l.parent.name,
      parentEmail: l.parent.email,
      studentId: l.studentId,
      studentNumber: l.student.studentNumber,
      studentName: l.student.name,
      className: l.student.className,
      createdAt: l.createdAt,
    }));
}

export async function removeParentStudentLink(
  linkId: string
): Promise<{ success: boolean; error?: string; parentId?: string; studentId?: string }> {
  try {
    const link = await prisma.parentStudent.findUnique({
      where: { id: linkId },
    });

    if (!link) {
      return { success: false, error: 'Guardian-student link not found.' };
    }

    await prisma.parentStudent.delete({
      where: { id: linkId },
    });

    return {
      success: true,
      parentId: link.parentId,
      studentId: link.studentId,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to remove link.';
    return { success: false, error: message };
  }
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

// ==========================================
// Intending Students & Number Generation (Stage 2)
// ==========================================

export interface IntendingStudentInput {
  name: string;
  intendedClass: string;
  sessionYear: string;
  guardianName?: string | null;
  guardianPhone?: string | null;
  guardianEmail?: string | null;
  notes?: string | null;
  registeredById: string;
}

export interface IntendingStudentRecord {
  id: string;
  studentNumber: string;
  name: string;
  intendedClass: string;
  sessionYear: string;
  guardianName: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
  notes: string | null;
  registeredById: string;
  registeredByName?: string;
  createdAt: Date;
  updatedAt: Date;
}

import { extractIntakeYear, formatStudentNumber } from './numbering';
export { extractIntakeYear, formatStudentNumber };

/**
 * Atomically generate the next available student number and register an intending student.
 * Guarantees race-safety under concurrent intake via PostgreSQL row-level locking on StudentNumberSequence,
 * and verifies collision safety against BOTH intending_students and active students tables.
 */
export async function registerIntendingStudent(
  input: IntendingStudentInput
): Promise<{ success: boolean; student?: IntendingStudentRecord; error?: string }> {
  try {
    const intakeYear = extractIntakeYear(input.sessionYear);
    const db = prisma as any;

    const result = await prisma.$transaction(async (tx) => {
      const txAny = tx as any;
      let candidateNumber = '';
      let acquired = false;
      const MAX_COLLISION_RETRIES = 50;

      for (let attempt = 0; attempt < MAX_COLLISION_RETRIES; attempt++) {
        // Atomic increment of the intake year sequence counter
        const sequence = await txAny.studentNumberSequence.upsert({
          where: { year: intakeYear },
          create: { year: intakeYear, lastValue: 1 },
          update: { lastValue: { increment: 1 } },
        });

        candidateNumber = formatStudentNumber(intakeYear, sequence.lastValue);

        // Check for collisions across BOTH tables:
        // 1. Check intending_students table
        const existingIntending = await txAny.intendingStudent.findUnique({
          where: { studentNumber: candidateNumber },
        });
        if (existingIntending) {
          continue; // Collision detected, advance sequence
        }

        // 2. Check active students table
        const existingActive = await tx.student.findUnique({
          where: { studentNumber: candidateNumber },
        });
        if (existingActive) {
          continue; // Collision detected, advance sequence
        }

        // Identifier is confirmed unique across both namespaces
        acquired = true;
        break;
      }

      if (!acquired) {
        throw new Error('Unable to allocate a unique student number after multiple attempts.');
      }

      const created = await txAny.intendingStudent.create({
        data: {
          studentNumber: candidateNumber,
          name: input.name.trim(),
          intendedClass: input.intendedClass.trim(),
          sessionYear: input.sessionYear.trim(),
          guardianName: input.guardianName?.trim() || null,
          guardianPhone: input.guardianPhone?.trim() || null,
          guardianEmail: input.guardianEmail?.trim()?.toLowerCase() || null,
          notes: input.notes?.trim() || null,
          registeredById: input.registeredById,
        },
        include: {
          registeredBy: {
            select: { name: true },
          },
        },
      });

      return {
        id: created.id,
        studentNumber: created.studentNumber,
        name: created.name,
        intendedClass: created.intendedClass,
        sessionYear: created.sessionYear,
        guardianName: created.guardianName,
        guardianPhone: created.guardianPhone,
        guardianEmail: created.guardianEmail,
        notes: created.notes,
        registeredById: created.registeredById,
        registeredByName: created.registeredBy?.name,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
      } as IntendingStudentRecord;
    });

    return { success: true, student: result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to register intending student.';
    return { success: false, error: message };
  }
}

/**
 * Retrieve intending students with optional text search.
 */
export async function getIntendingStudents(
  searchQuery?: string
): Promise<IntendingStudentRecord[]> {
  const db = prisma as any;
  const where: any = {};

  if (searchQuery && searchQuery.trim().length > 0) {
    const q = searchQuery.trim();
    where.OR = [
      { studentNumber: { contains: q, mode: 'insensitive' } },
      { name: { contains: q, mode: 'insensitive' } },
      { intendedClass: { contains: q, mode: 'insensitive' } },
      { guardianName: { contains: q, mode: 'insensitive' } },
      { guardianPhone: { contains: q, mode: 'insensitive' } },
    ];
  }

  const rows = await db.intendingStudent.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      registeredBy: {
        select: { name: true },
      },
    },
  });

  return rows.map((r: any) => ({
    id: r.id,
    studentNumber: r.studentNumber,
    name: r.name,
    intendedClass: r.intendedClass,
    sessionYear: r.sessionYear,
    guardianName: r.guardianName,
    guardianPhone: r.guardianPhone,
    guardianEmail: r.guardianEmail,
    notes: r.notes,
    registeredById: r.registeredById,
    registeredByName: r.registeredBy?.name,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

/**
 * Find a specific intending student by CUID.
 */
export async function findIntendingStudentById(
  id: string
): Promise<IntendingStudentRecord | null> {
  const db = prisma as any;
  const r = await db.intendingStudent.findUnique({
    where: { id },
    include: {
      registeredBy: {
        select: { name: true },
      },
    },
  });

  if (!r) return null;

  return {
    id: r.id,
    studentNumber: r.studentNumber,
    name: r.name,
    intendedClass: r.intendedClass,
    sessionYear: r.sessionYear,
    guardianName: r.guardianName,
    guardianPhone: r.guardianPhone,
    guardianEmail: r.guardianEmail,
    notes: r.notes,
    registeredById: r.registeredById,
    registeredByName: r.registeredBy?.name,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/**
 * Find an intending student by generated student number (e.g. SP-2026-0001).
 */
export async function findIntendingStudentByNumber(
  studentNumber: string
): Promise<IntendingStudentRecord | null> {
  const db = prisma as any;
  const r = await db.intendingStudent.findUnique({
    where: { studentNumber: studentNumber.trim().toUpperCase() },
    include: {
      registeredBy: {
        select: { name: true },
      },
    },
  });

  if (!r) return null;

  return {
    id: r.id,
    studentNumber: r.studentNumber,
    name: r.name,
    intendedClass: r.intendedClass,
    sessionYear: r.sessionYear,
    guardianName: r.guardianName,
    guardianPhone: r.guardianPhone,
    guardianEmail: r.guardianEmail,
    notes: r.notes,
    registeredById: r.registeredById,
    registeredByName: r.registeredBy?.name,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}
