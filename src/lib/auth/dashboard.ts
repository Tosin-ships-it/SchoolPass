import type { StudentLinkRequestRecord } from './store';

export type DashboardLinkState =
  | { type: 'LINKED' }
  | { type: 'PENDING_VERIFICATION'; pendingRequests: StudentLinkRequestRecord[] }
  | { type: 'UNLINKED' };

/**
 * Determine the guardian link status for the parent dashboard.
 * - State A (LINKED): Parent has at least one active, approved student link.
 * - State B (PENDING_VERIFICATION): Parent has no active links, but has one or more requests pending staff verification.
 * - State C (UNLINKED): Parent has no active links and no pending requests (e.g. no request yet or rejected).
 */
export function determineDashboardLinkState(
  isLinked: boolean,
  requests: StudentLinkRequestRecord[]
): DashboardLinkState {
  if (isLinked) {
    return { type: 'LINKED' };
  }

  const pendingRequests = requests.filter(req => req.status === 'PENDING');
  if (pendingRequests.length > 0) {
    return {
      type: 'PENDING_VERIFICATION',
      pendingRequests,
    };
  }

  return { type: 'UNLINKED' };
}

/**
 * Determine the link section presentation state for the Records page.
 * - If the parent has active links or pending requests, form title is "Link Another Child".
 * - Only if the parent has no active links and no pending requests is the form titled "Link Your Child".
 */
export function determineRecordsLinkState(
  activeLinksCount: number,
  requests: StudentLinkRequestRecord[]
): {
  formTitle: 'Link Your Child' | 'Link Another Child';
  hasPending: boolean;
  pendingRequests: StudentLinkRequestRecord[];
} {
  const pendingRequests = requests.filter(req => req.status === 'PENDING');
  const hasPending = pendingRequests.length > 0;
  const hasActiveLinks = activeLinksCount > 0;

  return {
    formTitle: hasActiveLinks || hasPending ? 'Link Another Child' : 'Link Your Child',
    hasPending,
    pendingRequests,
  };
}

