import 'server-only';
import { cookies } from 'next/headers';
import {
  hashPassword,
  verifyPassword,
  generateSecureToken,
  hashToken,
  signSessionPayload,
  verifySessionPayload,
  validatePasswordStrength,
} from './crypto';
import {
  findParentByEmail,
  findParentById,
  createParent,
  updateParent,
  findStaffByEmail,
  findStaffById,
  updateStaffPassword,
  saveVerificationToken,
  findVerificationTokenByHash,
  deleteVerificationToken,
  savePasswordResetToken,
  findPasswordResetTokenByHash,
  deletePasswordResetToken,
  createSessionRecord,
  findSessionRecord,
  deleteSessionRecord,
  deleteAllUserSessions,
  getParentStudentLinks,
  isParentLinkedToStudent,
  checkRateLimit,
  recordFailedAttempt,
  resetRateLimit,
  createStudentLinkRequest,
  getParentLinkRequests,
  getAllStudentLinkRequests,
  approveStudentLinkRequest,
  rejectStudentLinkRequest,
  getAllParentStudentLinks,
  removeParentStudentLink,
  type ParentAccount,
  type StaffAccount,
  type SessionRecord,
  type ParentStudentLink,
  type StudentLinkRequestRecord,
  type LinkRequestStatus,
} from './store';
import { logEvent } from '@/lib/logging';

export const SESSION_COOKIE_NAME = 'schoolpass_session';
export const SESSION_DURATION_DAYS = 7; // RULES_CONFIG Rule 5: 7 days
export const SESSION_DURATION_MS = SESSION_DURATION_DAYS * 24 * 60 * 60 * 1000;

export interface AuthSession {
  sessionId: string;
  userId: string;
  role: 'parent' | 'staff' | 'admin';
  user: {
    id: string;
    name: string;
    email: string;
  };
  isLinked?: boolean; // For parents: whether they have any linked students
}

// Helper to set session cookie
export async function setSessionCookie(signedSessionToken: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, signedSessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
  });
}

// Helper to clear session cookie
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Get the currently authenticated session from request cookies.
 */
export async function getSession(): Promise<AuthSession | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionCookie) return null;

    const sessionId = verifySessionPayload(sessionCookie);
    if (!sessionId) return null;

    const session = await findSessionRecord(sessionId);
    if (!session) return null;

    if (session.role === 'parent') {
      const parent = await findParentById(session.userId);
      if (!parent || !parent.emailVerifiedAt) return null;

      const links = await getParentStudentLinks(parent.id);
      return {
        sessionId: session.id,
        userId: parent.id,
        role: 'parent',
        user: {
          id: parent.id,
          name: parent.name,
          email: parent.email,
        },
        isLinked: links.length > 0,
      };
    } else {
      const staff = await findStaffById(session.userId);
      if (!staff) return null;

      return {
        sessionId: session.id,
        userId: staff.id,
        role: staff.role.toLowerCase() as 'staff' | 'admin',
        user: {
          id: staff.id,
          name: staff.name,
          email: staff.email,
        },
      };
    }
  } catch {
    return null;
  }
}

/**
 * Parent self-registration (Addendum v6.1 §5.1).
 */
export async function registerParent(params: {
  name: string;
  email: string;
  password: string;
  studentNumber?: string;
}): Promise<{
  success: boolean;
  error?: string;
  verificationToken?: string;
  parentId?: string;
  studentLink?: {
    success: boolean;
    error?: string;
    requestId?: string;
    studentName?: string;
    className?: string;
  };
}> {
  const email = params.email.trim().toLowerCase();
  const name = params.name.trim();

  if (!name || name.length < 2) {
    return { success: false, error: 'Please enter your full name.' };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { success: false, error: 'Please enter a valid email address.' };
  }

  const strengthCheck = validatePasswordStrength(params.password);
  if (!strengthCheck.valid) {
    return { success: false, error: strengthCheck.reason };
  }

  // Check if parent account already exists
  const existing = await findParentByEmail(email);
  if (existing) {
    // Return generic/safe response
    return {
      success: false,
      error: 'An account with this email address already exists. Please sign in or reset your password.',
    };
  }

  const passwordHash = await hashPassword(params.password);
  const parent = await createParent({
    name,
    email,
    passwordHash,
    previousPasswordHashes: [passwordHash],
    emailVerifiedAt: null,
  });

  // Generate email verification token (expires in 24 hours)
  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await saveVerificationToken(email, tokenHash, expiresAt);

  logEvent({
    level: 'info',
    event: 'parent_registered',
    actorType: 'parent',
    actorId: parent.id,
    outcome: 'success',
  });

  // If student number is provided, submit student-linking request immediately
  let studentLink:
    | {
        success: boolean;
        error?: string;
        requestId?: string;
        studentName?: string;
        className?: string;
      }
    | undefined = undefined;

  if (params.studentNumber && params.studentNumber.trim().length > 0) {
    studentLink = await submitStudentLinkRequest(parent.id, params.studentNumber.trim());
  }

  return {
    success: true,
    verificationToken: rawToken,
    parentId: parent.id,
    studentLink,
  };
}

/**
 * Retry student linking request during registration before email verification.
 * Authenticated via the cryptographic verification token issued to the parent.
 */
export async function retryRegistrationStudentLink(params: {
  email: string;
  verificationToken: string;
  studentNumber: string;
}): Promise<{
  success: boolean;
  error?: string;
  requestId?: string;
  studentName?: string;
  className?: string;
}> {
  const email = params.email.trim().toLowerCase();
  const rawToken = params.verificationToken.trim();
  const studentNumber = params.studentNumber.trim();

  if (!email || !rawToken || !studentNumber) {
    return { success: false, error: 'Email, verification token, and student number are required.' };
  }

  const tokenHash = hashToken(rawToken);
  const tokenRecord = await findVerificationTokenByHash(tokenHash);

  if (!tokenRecord || tokenRecord.email.toLowerCase() !== email) {
    return { success: false, error: 'Invalid or expired registration session.' };
  }

  if (tokenRecord.expiresAt.getTime() < Date.now()) {
    return { success: false, error: 'Verification token has expired. Please sign in or request a new link.' };
  }

  const parent = await findParentByEmail(email);
  if (!parent) {
    return { success: false, error: 'Parent account not found.' };
  }

  return submitStudentLinkRequest(parent.id, studentNumber);
}

/**
 * Verify parent email address (Addendum v6.1 §5.1, §5.4).
 */
export async function verifyEmail(token: string): Promise<{ success: boolean; error?: string }> {
  if (!token || token.trim().length === 0) {
    return { success: false, error: 'Invalid or missing verification token.' };
  }

  const tokenHash = hashToken(token.trim());
  const tokenRecord = await findVerificationTokenByHash(tokenHash);

  if (!tokenRecord) {
    return { success: false, error: 'Verification token is invalid or has already been used.' };
  }

  if (tokenRecord.expiresAt.getTime() < Date.now()) {
    await deleteVerificationToken(tokenHash);
    return { success: false, error: 'Verification link has expired. Please request a new one.' };
  }

  const parent = await findParentByEmail(tokenRecord.email);
  if (!parent) {
    await deleteVerificationToken(tokenHash);
    return { success: false, error: 'Account not found.' };
  }

  await updateParent(parent.id, { emailVerifiedAt: new Date() });
  await deleteVerificationToken(tokenHash);

  logEvent({
    level: 'info',
    event: 'parent_email_verified',
    actorType: 'parent',
    actorId: parent.id,
    outcome: 'success',
  });

  return { success: true };
}

/**
 * Resend email verification link.
 */
export async function resendVerificationEmail(email: string): Promise<{ success: boolean; verificationToken?: string }> {
  const normalizedEmail = email.trim().toLowerCase();
  const parent = await findParentByEmail(normalizedEmail);

  if (!parent || parent.emailVerifiedAt) {
    // Return generic success to avoid email enumeration
    return { success: true };
  }

  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await saveVerificationToken(normalizedEmail, tokenHash, expiresAt);

  return { success: true, verificationToken: rawToken };
}

/**
 * Parent login.
 */
export async function loginParent(
  emailInput: string,
  passwordInput: string,
  ip = 'unknown'
): Promise<{ success: boolean; error?: string; errorCode?: string }> {
  const email = emailInput.trim().toLowerCase();
  const rateLimitKey = `login_parent_${ip}_${email}`;

  const rateCheck = await checkRateLimit(rateLimitKey);
  if (!rateCheck.allowed) {
    return {
      success: false,
      error: `Too many failed sign-in attempts. Please try again in ${rateCheck.retryAfterSeconds} seconds.`,
      errorCode: 'RATE_LIMITED',
    };
  }

  const parent = await findParentByEmail(email);
  if (!parent) {
    await recordFailedAttempt(rateLimitKey);
    logEvent({
      level: 'warn',
      event: 'parent_login_failed',
      actorType: 'parent',
      outcome: 'failure',
    });
    return { success: false, error: 'Invalid email or password.' };
  }

  const passwordValid = await verifyPassword(passwordInput, parent.passwordHash);
  if (!passwordValid) {
    await recordFailedAttempt(rateLimitKey);
    logEvent({
      level: 'warn',
      event: 'parent_login_failed',
      actorType: 'parent',
      actorId: parent.id,
      outcome: 'failure',
    });
    return { success: false, error: 'Invalid email or password.' };
  }

  if (!parent.emailVerifiedAt) {
    return {
      success: false,
      error: 'Please verify your email address before signing in. Check your inbox for the verification link.',
      errorCode: 'EMAIL_NOT_VERIFIED',
    };
  }

  await resetRateLimit(rateLimitKey);

  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const session = await createSessionRecord(parent.id, 'parent', expiresAt);
  const signedToken = signSessionPayload(session.id);
  await setSessionCookie(signedToken);

  logEvent({
    level: 'info',
    event: 'parent_login_success',
    actorType: 'parent',
    actorId: parent.id,
    outcome: 'success',
  });

  return { success: true };
}

/**
 * Staff / Admin login.
 */
export async function loginStaff(
  emailInput: string,
  passwordInput: string,
  ip = 'unknown'
): Promise<{ success: boolean; error?: string; role?: 'STAFF' | 'ADMIN' }> {
  const email = emailInput.trim().toLowerCase();
  const rateLimitKey = `login_staff_${ip}_${email}`;

  const rateCheck = await checkRateLimit(rateLimitKey);
  if (!rateCheck.allowed) {
    return {
      success: false,
      error: `Too many failed sign-in attempts. Please try again in ${rateCheck.retryAfterSeconds} seconds.`,
    };
  }

  const staff = await findStaffByEmail(email);
  if (!staff) {
    await recordFailedAttempt(rateLimitKey);
    logEvent({
      level: 'warn',
      event: 'staff_login_failed',
      actorType: 'staff',
      outcome: 'failure',
    });
    return { success: false, error: 'Invalid staff email or password.' };
  }

  const passwordValid = await verifyPassword(passwordInput, staff.passwordHash);
  if (!passwordValid) {
    await recordFailedAttempt(rateLimitKey);
    logEvent({
      level: 'warn',
      event: 'staff_login_failed',
      actorType: 'staff',
      actorId: staff.id,
      outcome: 'failure',
    });
    return { success: false, error: 'Invalid staff email or password.' };
  }

  await resetRateLimit(rateLimitKey);

  const role = staff.role.toLowerCase() as 'staff' | 'admin';
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const session = await createSessionRecord(staff.id, role, expiresAt);
  const signedToken = signSessionPayload(session.id);
  await setSessionCookie(signedToken);

  logEvent({
    level: 'info',
    event: 'staff_login_success',
    actorType: role,
    actorId: staff.id,
    outcome: 'success',
  });

  return { success: true, role: staff.role };
}

/**
 * Request password reset (Addendum §5.4, PRD §8.2: email link only).
 */
export async function requestPasswordReset(emailInput: string): Promise<{
  success: boolean;
  resetToken?: string;
}> {
  const email = emailInput.trim().toLowerCase();
  const parent = await findParentByEmail(email);
  const staff = await findStaffByEmail(email);

  if (!parent && !staff) {
    // Generic response: do not reveal whether account exists
    return { success: true };
  }

  const rawToken = generateSecureToken();
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiry
  await savePasswordResetToken(email, tokenHash, expiresAt);

  logEvent({
    level: 'info',
    event: 'password_reset_requested',
    actorType: parent ? 'parent' : 'staff',
    actorId: parent ? parent.id : staff!.id,
    outcome: 'success',
  });

  return { success: true, resetToken: rawToken };
}

/**
 * Reset password using token (Addendum §5.4: single-use token, invalidates sessions, password reuse check).
 */
export async function resetPassword(
  token: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  if (!token || token.trim().length === 0) {
    return { success: false, error: 'Invalid or missing reset token.' };
  }

  const strengthCheck = validatePasswordStrength(newPassword);
  if (!strengthCheck.valid) {
    return { success: false, error: strengthCheck.reason };
  }

  const tokenHash = hashToken(token.trim());
  const tokenRecord = await findPasswordResetTokenByHash(tokenHash);

  if (!tokenRecord) {
    return { success: false, error: 'Password reset link is invalid or has already been used.' };
  }

  if (tokenRecord.expiresAt.getTime() < Date.now()) {
    await deletePasswordResetToken(tokenHash);
    return { success: false, error: 'Password reset link has expired. Please request a new one.' };
  }

  const parent = await findParentByEmail(tokenRecord.email);
  const staff = await findStaffByEmail(tokenRecord.email);

  if (!parent && !staff) {
    await deletePasswordResetToken(tokenHash);
    return { success: false, error: 'Account not found.' };
  }

  const newHash = await hashPassword(newPassword);

  if (parent) {
    // Check password reuse against previous passwords (RULES_CONFIG Rule 5: last 3 passwords)
    for (const oldHash of (parent.previousPasswordHashes || []).slice(-3)) {
      const isReused = await verifyPassword(newPassword, oldHash);
      if (isReused) {
        return { success: false, error: 'You cannot reuse one of your last 3 passwords.' };
      }
    }

    const updatedPrevious = [...(parent.previousPasswordHashes || []), newHash].slice(-3);
    await updateParent(parent.id, {
      passwordHash: newHash,
      previousPasswordHashes: updatedPrevious,
      // If parent was not verified, resetting password via verified email confirms the email
      emailVerifiedAt: parent.emailVerifiedAt ?? new Date(),
    });
    // Invalidate all active sessions for this user (Addendum §5.4)
    await deleteAllUserSessions(parent.id);
  } else if (staff) {
    const isReused = await verifyPassword(newPassword, staff.passwordHash);
    if (isReused) {
      return { success: false, error: 'You cannot reuse your current password.' };
    }

    await updateStaffPassword(staff.id, newHash);
    await deleteAllUserSessions(staff.id);
  }

  await deletePasswordResetToken(tokenHash);

  logEvent({
    level: 'info',
    event: 'password_reset_completed',
    actorType: parent ? 'parent' : 'staff',
    actorId: parent ? parent.id : staff!.id,
    outcome: 'success',
  });

  return { success: true };
}

/**
 * Logout / Sign out.
 */
export async function logout(): Promise<void> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (sessionCookie) {
      const sessionId = verifySessionPayload(sessionCookie);
      if (sessionId) {
        await deleteSessionRecord(sessionId);
      }
    }
  } catch {
    // Ignore error
  } finally {
    await clearSessionCookie();
  }
}

/**
 * Server-side Parent-to-Student authorization check (RULES_AUTH Rule 2, PRD §16, Addendum §5.3).
 */
export async function checkParentStudentAuthorization(
  parentId: string,
  studentId: string
): Promise<boolean> {
  const isLinked = await isParentLinkedToStudent(parentId, studentId);
  if (!isLinked) {
    // Failed parent-to-student check is logged (RULES_LOGGING Rule 1, RULES_AUTH Rule 9)
    logEvent({
      level: 'warn',
      event: 'parent_student_auth_check_failed',
      actorType: 'parent',
      actorId: parentId,
      entityType: 'student',
      outcome: 'failure',
    });
    return false;
  }
  return true;
}

/**
 * Submit a student number link request by a parent (PRD §5, Addendum §5.1, RULES_AUTH Rule 3).
 * Does not grant immediate access; requires staff review and approval.
 */
export async function submitStudentLinkRequest(
  parentId: string,
  studentNumber: string
): Promise<{
  success: boolean;
  error?: string;
  requestId?: string;
  studentName?: string;
  className?: string;
}> {
  const result = await createStudentLinkRequest(parentId, studentNumber);

  if (result.success && result.studentId) {
    logEvent({
      level: 'info',
      event: 'student_link_requested',
      actorType: 'parent',
      actorId: parentId,
      entityType: 'student',
      entityId: result.studentId,
      outcome: 'success',
    });
  } else {
    logEvent({
      level: 'warn',
      event: 'student_link_request_failed',
      actorType: 'parent',
      actorId: parentId,
      outcome: 'failure',
    });
  }

  return result;
}

/**
 * Get all student link requests for the authenticated parent.
 */
export async function getParentRequests(parentId: string): Promise<StudentLinkRequestRecord[]> {
  return getParentLinkRequests(parentId);
}

/**
 * Get student link requests for Staff & Admin review (RULES_STAFF_UI Rule 1, Rule 2).
 */
export async function getStaffLinkRequests(statusFilter?: LinkRequestStatus): Promise<StudentLinkRequestRecord[]> {
  return getAllStudentLinkRequests(statusFilter);
}

/**
 * Approve a student link request (RULES_AUTH Rule 3, RULES_STAFF_UI Rule 6).
 * Atomically creates ParentStudent link and marks request APPROVED.
 */
export async function approveLinkRequest(
  requestId: string,
  staffId: string
): Promise<{ success: boolean; error?: string }> {
  const result = await approveStudentLinkRequest(requestId, staffId);

  if (result.success && result.studentId) {
    logEvent({
      level: 'info',
      event: 'student_link_approved',
      actorType: 'staff',
      actorId: staffId,
      entityType: 'student',
      entityId: result.studentId,
      outcome: 'success',
    });
  }

  return { success: result.success, error: result.error };
}

/**
 * Reject a student link request (RULES_AUTH Rule 3, RULES_STAFF_UI Rule 6).
 */
export async function rejectLinkRequest(
  requestId: string,
  staffId: string,
  rejectionReason?: string
): Promise<{ success: boolean; error?: string }> {
  const result = await rejectStudentLinkRequest(requestId, staffId, rejectionReason);

  if (result.success && result.studentId) {
    logEvent({
      level: 'info',
      event: 'student_link_rejected',
      actorType: 'staff',
      actorId: staffId,
      entityType: 'student',
      entityId: result.studentId,
      outcome: 'success',
    });
  }

  return { success: result.success, error: result.error };
}

/**
 * List all active guardian-student links for Staff & Admin review.
 */
export async function listAllGuardianLinks() {
  return getAllParentStudentLinks();
}

/**
 * Remove an existing ParentStudent link (RULES_AUTH Rule 4, RULES_STAFF_UI Rule 6).
 */
export async function removeGuardianLink(
  linkId: string,
  staffId: string
): Promise<{ success: boolean; error?: string }> {
  const result = await removeParentStudentLink(linkId);

  if (result.success && result.studentId) {
    logEvent({
      level: 'info',
      event: 'student_link_removed',
      actorType: 'staff',
      actorId: staffId,
      entityType: 'student',
      entityId: result.studentId,
      outcome: 'success',
    });
  }

  return { success: result.success, error: result.error };
}

export { getParentStudentLinks };

export type {
  ParentStudentLink,
  StudentLinkRequestRecord,
  LinkRequestStatus,
};





