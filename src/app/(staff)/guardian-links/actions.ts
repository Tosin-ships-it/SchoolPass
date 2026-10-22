'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import {
  getSession,
  approveLinkRequest,
  rejectLinkRequest,
  removeGuardianLink,
  extractClientIp,
  checkIpRateLimit,
  recordIpFailedAttempt,
} from '@/lib/auth';
import { validateActionPayload } from '@/lib/auth/validation';
import {
  staffApproveLinkActionSchema,
  staffRejectLinkActionSchema,
  staffRemoveGuardianLinkActionSchema,
} from '@/lib/auth/schemas';

import { ERROR_STRINGS } from '@/lib/errors/strings';

export async function approveStudentLinkAction(requestId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const headerList = await headers();
    const ip = extractClientIp(headerList);
    const rateCheck = checkIpRateLimit(ip, 'staff_guardian_actions');
    if (!rateCheck.allowed) {
      return { success: false, error: `Too many attempts. Please try again in ${rateCheck.retryAfterSeconds} seconds.` };
    }

    const validation = validateActionPayload({ requestId }, staffApproveLinkActionSchema);
    if (!validation.success) {
      recordIpFailedAttempt(ip, 'staff_guardian_actions');
      return { success: false, error: validation.error };
    }

    const session = await getSession();
    if (!session || (session.role !== 'staff' && session.role !== 'admin')) {
      recordIpFailedAttempt(ip, 'staff_guardian_actions');
      return { success: false, error: 'Unauthorized. Staff privileges required.' };
    }

    const result = await approveLinkRequest(validation.data.requestId, session.userId);
    if (!result.success) {
      recordIpFailedAttempt(ip, 'staff_guardian_actions');
    } else {
      revalidatePath('/guardian-links');
    }
    return result;
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : ERROR_STRINGS.GENERIC_RETRY,
    };
  }
}

export async function rejectStudentLinkAction(
  requestId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const headerList = await headers();
    const ip = extractClientIp(headerList);
    const rateCheck = checkIpRateLimit(ip, 'staff_guardian_actions');
    if (!rateCheck.allowed) {
      return { success: false, error: `Too many attempts. Please try again in ${rateCheck.retryAfterSeconds} seconds.` };
    }

    const validation = validateActionPayload({ requestId, reason }, staffRejectLinkActionSchema);
    if (!validation.success) {
      recordIpFailedAttempt(ip, 'staff_guardian_actions');
      return { success: false, error: validation.error };
    }

    const session = await getSession();
    if (!session || (session.role !== 'staff' && session.role !== 'admin')) {
      recordIpFailedAttempt(ip, 'staff_guardian_actions');
      return { success: false, error: 'Unauthorized. Staff privileges required.' };
    }

    const result = await rejectLinkRequest(
      validation.data.requestId,
      session.userId,
      validation.data.reason || undefined
    );
    if (!result.success) {
      recordIpFailedAttempt(ip, 'staff_guardian_actions');
    } else {
      revalidatePath('/guardian-links');
    }
    return result;
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : ERROR_STRINGS.GENERIC_RETRY,
    };
  }
}

export async function removeGuardianLinkAction(linkId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const headerList = await headers();
    const ip = extractClientIp(headerList);
    const rateCheck = checkIpRateLimit(ip, 'staff_guardian_actions');
    if (!rateCheck.allowed) {
      return { success: false, error: `Too many attempts. Please try again in ${rateCheck.retryAfterSeconds} seconds.` };
    }

    const validation = validateActionPayload({ linkId }, staffRemoveGuardianLinkActionSchema);
    if (!validation.success) {
      recordIpFailedAttempt(ip, 'staff_guardian_actions');
      return { success: false, error: validation.error };
    }

    const session = await getSession();
    if (!session || (session.role !== 'staff' && session.role !== 'admin')) {
      recordIpFailedAttempt(ip, 'staff_guardian_actions');
      return { success: false, error: 'Unauthorized. Staff privileges required.' };
    }

    const result = await removeGuardianLink(validation.data.linkId, session.userId);
    if (!result.success) {
      recordIpFailedAttempt(ip, 'staff_guardian_actions');
    } else {
      revalidatePath('/guardian-links');
    }
    return result;
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : ERROR_STRINGS.GENERIC_RETRY,
    };
  }
}

