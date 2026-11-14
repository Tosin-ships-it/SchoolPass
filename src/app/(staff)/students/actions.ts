'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import {
  assertFrontDeskAccess,
  assertAdminSession,
  registerIntendingStudent,
  getIntendingStudents,
  setStaffFrontDeskPermission,
  extractClientIp,
  checkIpRateLimit,
  checkActorRateLimit,
  recordIpFailedAttempt,
  runIdempotent,
  extractIntakeYear,
  getConfiguredClasses,
  getConfiguredSessions,
  type IntendingStudentRecord,
  type StaffSummary,
} from '@/lib/auth';
import { validateActionPayload } from '@/lib/auth/validation';
import {
  intendingStudentIntakeSchema,
  intendingStudentSearchSchema,
  staffToggleFrontDeskSchema,
  type IntendingStudentIntakeInput,
} from '@/lib/auth/schemas';
import { logEvent } from '@/lib/logging';
import { ERROR_STRINGS } from '@/lib/errors/strings';

export type IntakeErrorCode =
  | 'validation'
  | 'unauthorized'
  | 'session_expired'
  | 'rate_limited'
  | 'conflict'
  | 'temporary'
  | 'unexpected';

export interface RegisterIntendingStudentActionResult {
  success: boolean;
  student?: IntendingStudentRecord;
  error?: string;
  errorCode?: IntakeErrorCode;
  fieldErrors?: Record<string, string>;
  retryAfterSeconds?: number;
}

/**
 * Register a new intending student and generate their unique student number.
 * Restricted to authenticated staff with isFrontDesk=true or Admin accounts.
 */
export async function registerIntendingStudentAction(
  payload: IntendingStudentIntakeInput
): Promise<RegisterIntendingStudentActionResult> {
  try {
    const headerList = await headers();
    const ip = extractClientIp(headerList);

    const rateCheck = checkIpRateLimit(ip, 'front_desk_intake');
    if (!rateCheck.allowed) {
      logEvent({
        level: 'warn',
        event: 'intending_student_registration_failed',
        actorType: 'anonymous',
        actorId: 'unknown',
        outcome: 'failure',
        details: { reason: 'ip_rate_limited' },
      });
      return {
        success: false,
        error: `Too many intake attempts. Please wait ${rateCheck.retryAfterSeconds} seconds before trying again.`,
        errorCode: 'rate_limited',
        retryAfterSeconds: rateCheck.retryAfterSeconds,
      };
    }

    const authCheck = await assertFrontDeskAccess();
    if (!authCheck.authorized || !authCheck.session) {
      recordIpFailedAttempt(ip, 'front_desk_intake');
      logEvent({
        level: 'warn',
        event: 'intending_student_registration_failed',
        actorType: authCheck.session?.role || 'anonymous',
        actorId: authCheck.session?.userId || 'unknown',
        outcome: 'failure',
        details: { reason: 'unauthorized' },
      });
      return {
        success: false,
        error: authCheck.session
          ? authCheck.error || 'Unauthorized. Front-desk privileges required.'
          : 'Your session has expired. Please sign in again.',
        errorCode: authCheck.session ? 'unauthorized' : 'session_expired',
      };
    }

    const session = authCheck.session;

    const actorRate = checkActorRateLimit(session.userId, 'front_desk_intake', 30, 60_000);
    if (!actorRate.allowed) {
      logEvent({
        level: 'warn',
        event: 'intending_student_registration_failed',
        actorType: session.role,
        actorId: session.userId,
        outcome: 'failure',
        details: { reason: 'rate_limited' },
      });
      return {
        success: false,
        error: `Too many student number requests. Please wait ${actorRate.retryAfterSeconds} seconds before trying again.`,
        errorCode: 'rate_limited',
        retryAfterSeconds: actorRate.retryAfterSeconds,
      };
    }

    const validation = validateActionPayload(payload, intendingStudentIntakeSchema);
    if (!validation.success) {
      recordIpFailedAttempt(ip, 'front_desk_intake');
      logEvent({
        level: 'warn',
        event: 'intending_student_registration_failed',
        actorType: session.role,
        actorId: session.userId,
        outcome: 'failure',
        details: { reason: 'validation' },
      });
      return {
        success: false,
        error: validation.error,
        errorCode: 'validation',
        fieldErrors: validation.fieldErrors,
      };
    }

    const [availableClasses, availableSessions] = await Promise.all([
      getConfiguredClasses(),
      getConfiguredSessions(),
    ]);

    if (availableClasses.length > 0 && !availableClasses.includes(validation.data.intendedClass)) {
      recordIpFailedAttempt(ip, 'front_desk_intake');
      logEvent({
        level: 'warn',
        event: 'intending_student_registration_failed',
        actorType: session.role,
        actorId: session.userId,
        outcome: 'failure',
        details: { reason: 'invalid_class' },
      });
      return {
        success: false,
        error: 'Please select a valid, configured school class.',
        errorCode: 'validation',
        fieldErrors: { intendedClass: 'Please select a valid school class from the list.' },
      };
    }

    if (availableSessions.length > 0 && !availableSessions.includes(validation.data.sessionYear)) {
      recordIpFailedAttempt(ip, 'front_desk_intake');
      logEvent({
        level: 'warn',
        event: 'intending_student_registration_failed',
        actorType: session.role,
        actorId: session.userId,
        outcome: 'failure',
        details: { reason: 'invalid_session' },
      });
      return {
        success: false,
        error: 'Please select a valid, configured academic session.',
        errorCode: 'validation',
        fieldErrors: { sessionYear: 'Please select a valid academic session from the list.' },
      };
    }

    const { submissionId, ...intakeFields } = validation.data;

    const performIntake = () =>
      registerIntendingStudent({
        ...intakeFields,
        registeredById: session.userId,
      });

    const intakeResult = submissionId
      ? await runIdempotent(
          `front_desk_intake:${session.userId}:${submissionId}`,
          performIntake,
          { shouldCache: (result) => result.success }
        )
      : await performIntake();

    if (!intakeResult.success || !intakeResult.student) {
      recordIpFailedAttempt(ip, 'front_desk_intake');
      logEvent({
        level: 'warn',
        event: 'intending_student_registration_failed',
        actorType: session.role,
        actorId: session.userId,
        outcome: 'failure',
        details: { reason: 'allocation_failed' },
      });
      return {
        success: false,
        error: intakeResult.error || 'Unable to generate a student number. Please try again.',
        errorCode:
          intakeResult.errorCode === 'duplicate'
            ? 'conflict'
            : intakeResult.errorCode === 'temporary'
              ? 'temporary'
              : 'unexpected',
      };
    }

    // RULES_LOGGING Rule 2: Never log student names, phones, or emails.
    logEvent({
      level: 'info',
      event: 'intending_student_registered',
      actorType: session.role,
      actorId: session.userId,
      entityType: 'intending_student',
      entityId: intakeResult.student.id,
      outcome: 'success',
      details: {
        studentNumber: intakeResult.student.studentNumber,
        intakeYear: extractIntakeYear(intakeResult.student.sessionYear),
      },
    });

    revalidatePath('/students');
    return { success: true, student: intakeResult.student };
  } catch {
    logEvent({
      level: 'error',
      event: 'intending_student_registration_failed',
      actorType: 'anonymous',
      actorId: 'unknown',
      outcome: 'failure',
      details: { reason: 'unexpected' },
    });
    return {
      success: false,
      error: ERROR_STRINGS.GENERIC_RETRY,
      errorCode: 'unexpected',
    };
  }
}

/**
 * Search/filter intending students.
 */
export async function searchIntendingStudentsAction(
  query?: string
): Promise<{ success: boolean; students?: IntendingStudentRecord[]; error?: string }> {
  try {
    const headerList = await headers();
    const ip = extractClientIp(headerList);

    const rateCheck = checkIpRateLimit(ip, 'front_desk_search');
    if (!rateCheck.allowed) {
      return {
        success: false,
        error: `Too many requests. Please wait ${rateCheck.retryAfterSeconds} seconds.`,
      };
    }

    const authCheck = await assertFrontDeskAccess();
    if (!authCheck.authorized || !authCheck.session) {
      return {
        success: false,
        error: authCheck.error || 'Unauthorized. Front-desk privileges required.',
      };
    }

    const actorRate = checkActorRateLimit(
      authCheck.session.userId,
      'front_desk_search',
      60,
      60_000
    );
    if (!actorRate.allowed) {
      return {
        success: false,
        error: `Too many search requests. Please wait ${actorRate.retryAfterSeconds} seconds.`,
      };
    }

    const validation = validateActionPayload({ query }, intendingStudentSearchSchema);
    if (!validation.success) {
      return { success: false, error: validation.error };
    }

    const students = await getIntendingStudents(validation.data.query ?? undefined);
    return { success: true, students };
  } catch {
    return {
      success: false,
      error: ERROR_STRINGS.GENERIC_RETRY,
    };
  }
}

/**
 * Admin action to grant or revoke front-desk access for a staff member.
 * Strictly restricted to Admin accounts.
 */
export async function toggleStaffFrontDeskAction(
  staffId: string,
  isFrontDesk: boolean
): Promise<{ success: boolean; staff?: StaffSummary; error?: string }> {
  try {
    const headerList = await headers();
    const ip = extractClientIp(headerList);

    const rateCheck = checkIpRateLimit(ip, 'admin_permission_toggle');
    if (!rateCheck.allowed) {
      return {
        success: false,
        error: `Too many attempts. Please wait ${rateCheck.retryAfterSeconds} seconds.`,
      };
    }

    const auth = await assertAdminSession();
    if (!auth.authorized || !auth.session) {
      recordIpFailedAttempt(ip, 'admin_permission_toggle');
      logEvent({
        level: 'warn',
        event: 'unauthorized_permission_toggle_attempt',
        actorType: auth.session?.role || 'anonymous',
        actorId: auth.session?.userId || 'unknown',
        outcome: 'failure',
      });
      return {
        success: false,
        error: auth.error || 'Unauthorized. Admin privileges required to manage front-desk permissions.',
      };
    }

    const validation = validateActionPayload({ staffId, isFrontDesk }, staffToggleFrontDeskSchema);
    if (!validation.success) {
      return { success: false, error: validation.error };
    }

    const updated = await setStaffFrontDeskPermission(validation.data.staffId, validation.data.isFrontDesk);
    if (!updated) {
      return { success: false, error: 'Staff account not found or update failed.' };
    }

    logEvent({
      level: 'info',
      event: 'staff_front_desk_permission_updated',
      actorType: 'admin',
      actorId: auth.session.userId,
      entityType: 'staff_user',
      entityId: updated.id,
      outcome: 'success',
      details: { isFrontDesk: updated.isFrontDesk },
    });

    revalidatePath('/students');
    revalidatePath('/guardian-links');
    return { success: true, staff: updated };
  } catch {
    return {
      success: false,
      error: ERROR_STRINGS.GENERIC_RETRY,
    };
  }
}
