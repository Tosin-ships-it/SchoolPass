'use server';

import { revalidatePath } from 'next/cache';
import { getSession, approveLinkRequest, rejectLinkRequest, removeGuardianLink } from '@/lib/auth';

export async function approveStudentLinkAction(requestId: string): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session || (session.role !== 'staff' && session.role !== 'admin')) {
    return { success: false, error: 'Unauthorized. Staff privileges required.' };
  }

  const result = await approveLinkRequest(requestId, session.userId);
  if (result.success) {
    revalidatePath('/guardian-links');
  }
  return result;
}

export async function rejectStudentLinkAction(
  requestId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session || (session.role !== 'staff' && session.role !== 'admin')) {
    return { success: false, error: 'Unauthorized. Staff privileges required.' };
  }

  const result = await rejectLinkRequest(requestId, session.userId, reason);
  if (result.success) {
    revalidatePath('/guardian-links');
  }
  return result;
}

export async function removeGuardianLinkAction(linkId: string): Promise<{ success: boolean; error?: string }> {
  const session = await getSession();
  if (!session || (session.role !== 'staff' && session.role !== 'admin')) {
    return { success: false, error: 'Unauthorized. Staff privileges required.' };
  }

  const result = await removeGuardianLink(linkId, session.userId);
  if (result.success) {
    revalidatePath('/guardian-links');
  }
  return result;
}
