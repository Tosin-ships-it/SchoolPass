'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import {
  getSession,
  assertFrontDeskAccess,
  assertAdminSession,
  registerIntendingStudent,
  getIntendingStudents,
  setStaffFrontDeskPermission,
  extractClientIp,
  checkIpRateLimit,
  recordIpFailedAttempt,
  type IntendingStudentRecord,
  type StaffAccount,
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

/**
 * Register a new intending student and generate their unique student number.
 * Restricted to authenticated staff with isFrontDesk=true or Admin accounts.
 */
export async function registerIntendingStudentAction(
  payload: IntendingStudentIntakeInput
): Promise<{ success: boolean; student?: IntendingStudentRecord; error?: string }> {
  try {
    const headerList = await headers();
    const ip = extractClientIp(headerList);

    const rateCheck = checkIpRateLimit(ip, 'front_desk_intake');
    if (!rateCheck.allowed) {
      return {
        success: false,
        error: `Too many intake attempts. Please wait ${rateCheck.retryAfterSeconds} seconds before trying again.`,
      };
    }

    const validation = validateActionPayload(payload, intendingStudentIntakeSchema);
    if (!validation.success) {
      recordIpFailedAttempt(ip, 'front_desk_intake');
      return { success: false, error: validation.error };
    }

    const authCheck = await assertFrontDeskAccess();
    if (!authCheck.authorized || !authCheck.session) {
      recordIpFailedAttempt(ip, 'front_desk_intake');
      logEvent({
        level: 'warn',
        event: 'unauthorized_front_desk_intake_attempt',
        actorType: authCheck.session?.role || 'anonymous',
        actorId: authCheck.session?.userId || 'unknown',
        outcome: 'failure',
      });
      return {
        success: false,
        error: authCheck.error || 'Unauthorized. Front-desk privileges required.',
      };
    }

    const intakeResult = await registerIntendingStudent({
      ...validation.data,
      registeredById: authCheck.session.userId,
    });

    if (!intakeResult.success || !intakeResult.student) {
      recordIpFailedAttempt(ip, 'front_desk_intake');
      return {
        success: false,
        error: intakeResult.error || 'Failed to complete registration.',
      };
    }

    // RULES_LOGGING Rule 2: Never log student names, phones, or emails.
    logEvent({
      level: 'info',
      event: 'intending_student_registered',
      actorType: authCheck.session.role,
      actorId: authCheck.session.userId,
      entityType: 'intending_student',
      entityId: intakeResult.student.id,
      outcome: 'success',
    });

    revalidatePath('/students');
    return { success: true, student: intakeResult.student };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : ERROR_STRINGS.GENERIC_RETRY,
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

    const validation = validateActionPayload({ query }, intendingStudentSearchSchema);
    if (!validation.success) {
      return { success: false, error: validation.error };
    }

    const authCheck = await assertFrontDeskAccess();
    if (!authCheck.authorized) {
      return {
        success: false,
        error: authCheck.error || 'Unauthorized. Front-desk privileges required.',
      };
    }

    const students = await getIntendingStudents(validation.data.query ?? undefined);
    return { success: true, students };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : ERROR_STRINGS.GENERIC_RETRY,
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
): Promise<{ success: boolean; staff?: StaffAccount; error?: string }> {
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

    const validation = validateActionPayload({ staffId, isFrontDesk }, staffToggleFrontDeskSchema);
    if (!validation.success) {
      return { success: false, error: validation.error };
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
    });

    revalidatePath('/students');
    revalidatePath('/guardian-links');
    return { success: true, staff: updated };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : ERROR_STRINGS.GENERIC_RETRY,
    };
  }
}
