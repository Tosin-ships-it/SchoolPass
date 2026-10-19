import {
  getSession,
  submitStudentLinkRequest,
  getParentRequests,
  getParentStudentLinks,
  extractClientIp,
  checkIpRateLimit,
  recordIpFailedAttempt,
  createRateLimitResponse,
} from '@/lib/auth';
import { validateJsonBody } from '@/lib/auth/validation';
import { studentLinkRequestSchema } from '@/lib/auth/schemas';

/**
 * GET /api/records/link-requests
 * Retrieve link requests and active links for the authenticated parent.
 */
export async function GET() {
  const session = await getSession();

  if (!session || session.role !== 'parent') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [requests, activeLinks] = await Promise.all([
      getParentRequests(session.userId),
      getParentStudentLinks(session.userId),
    ]);

    return Response.json({
      success: true,
      requests,
      activeLinks,
    });
  } catch {
    return Response.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/records/link-requests
 * Submit a student number link request for staff review.
 */
export async function POST(req: Request) {
  const session = await getSession();

  if (!session || session.role !== 'parent') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const ip = extractClientIp(req);
    const rateCheck = checkIpRateLimit(ip, 'record_link_request');
    if (!rateCheck.allowed) {
      return createRateLimitResponse(rateCheck.retryAfterSeconds);
    }

    const validation = await validateJsonBody(req, studentLinkRequestSchema);
    if (!validation.success) {
      recordIpFailedAttempt(ip, 'record_link_request');
      return validation.response;
    }

    const { studentNumber } = validation.data;

    const result = await submitStudentLinkRequest(session.userId, studentNumber);

    if (!result.success) {
      recordIpFailedAttempt(ip, 'record_link_request');
      return Response.json(
        { error: result.error || 'Failed to submit link request.' },
        { status: 400 }
      );
    }

    return Response.json({
      success: true,
      message: 'Your link request has been submitted and is pending staff approval.',
      requestId: result.requestId,
      studentName: result.studentName,
      className: result.className,
    });
  } catch {
    return Response.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
