'use server';

import { revalidatePath } from 'next/cache';
import { assertAdminSession } from '@/lib/auth';
import {
  getAcademicCalendar,
  saveAcademicCalendar,
  type AcademicCalendarSetting,
} from '@/lib/attendance/calendar';

export interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  errors?: string[];
}

/**
 * Fetch the academic calendar setting.
 * Restricted to authenticated Admin users only.
 */
export async function getAcademicCalendarAction(): Promise<ActionResult<AcademicCalendarSetting>> {
  const adminCheck = await assertAdminSession();
  if (!adminCheck.authorized || !adminCheck.session) {
    return {
      success: false,
      errors: [adminCheck.error || 'Unauthorized. Admin privileges required.'],
    };
  }

  try {
    const calendar = await getAcademicCalendar();
    return { success: true, data: calendar };
  } catch {
    return {
      success: false,
      errors: ['Failed to load academic calendar settings.'],
    };
  }
}

/**
 * Save updated academic calendar settings.
 * Restricted to authenticated Admin users only.
 */
export async function saveAcademicCalendarAction(
  calendar: AcademicCalendarSetting
): Promise<ActionResult> {
  const adminCheck = await assertAdminSession();
  if (!adminCheck.authorized || !adminCheck.session) {
    return {
      success: false,
      errors: [adminCheck.error || 'Unauthorized. Admin privileges required.'],
    };
  }

  const adminUserId = adminCheck.session.user?.id || adminCheck.session.userId;
  const result = await saveAcademicCalendar(calendar, adminUserId);
  if (!result.success) {
    return {
      success: false,
      errors: result.errors || ['Validation failed.'],
    };
  }

  // Revalidate staff and admin views dependent on academic calendar
  revalidatePath('/settings');
  revalidatePath('/payments');
  revalidatePath('/attendance');

  return { success: true };
}
