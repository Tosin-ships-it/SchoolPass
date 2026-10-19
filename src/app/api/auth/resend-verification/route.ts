import {
  resendVerificationEmail,
  isDevStubsEnabled,
  extractClientIp,
  checkIpRateLimit,
  recordIpFailedAttempt,
  createRateLimitResponse,
} from '@/lib/auth';
import { validateJsonBody } from '@/lib/auth/validation';
import { resendVerificationSchema } from '@/lib/auth/schemas';

export async function POST(request: Request) {
  try {
    const ip = extractClientIp(request);
    const rateCheck = checkIpRateLimit(ip, 'auth_resend_verification');
    if (!rateCheck.allowed) {
      return createRateLimitResponse(rateCheck.retryAfterSeconds);
    }

    const validation = await validateJsonBody(request, resendVerificationSchema);
    if (!validation.success) {
      return validation.response;
    }

    // Record request to throttle email dispatch attempts per IP
    recordIpFailedAttempt(ip, 'auth_resend_verification');

    const { email } = validation.data;
    const result = await resendVerificationEmail(email);

    return Response.json({
      success: true,
      message: 'If an unverified account exists, a new verification link has been sent.',
      ...(isDevStubsEnabled() && { verificationToken: result.verificationToken }),
    });
  } catch {
    return Response.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
