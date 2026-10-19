import {
  verifyEmail,
  extractClientIp,
  checkIpRateLimit,
  recordIpFailedAttempt,
  createRateLimitResponse,
} from '@/lib/auth';
import { validateJsonBody } from '@/lib/auth/validation';
import { verifyEmailSchema } from '@/lib/auth/schemas';

export async function POST(request: Request) {
  try {
    const ip = extractClientIp(request);
    const rateCheck = checkIpRateLimit(ip, 'auth_verify_email');
    if (!rateCheck.allowed) {
      return createRateLimitResponse(rateCheck.retryAfterSeconds);
    }

    const validation = await validateJsonBody(request, verifyEmailSchema);
    if (!validation.success) {
      recordIpFailedAttempt(ip, 'auth_verify_email');
      return validation.response;
    }

    const { token } = validation.data;
    const result = await verifyEmail(token);
    if (!result.success) {
      recordIpFailedAttempt(ip, 'auth_verify_email');
      return Response.json({ error: result.error }, { status: 400 });
    }

    return Response.json({
      success: true,
      message: 'Email verified successfully. You can now sign in.',
    });
  } catch {
    return Response.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
