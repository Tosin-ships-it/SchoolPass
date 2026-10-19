import {
  requestPasswordReset,
  isDevStubsEnabled,
  extractClientIp,
  checkIpRateLimit,
  recordIpFailedAttempt,
  createRateLimitResponse,
} from '@/lib/auth';
import { validateJsonBody } from '@/lib/auth/validation';
import { forgotPasswordSchema } from '@/lib/auth/schemas';

export async function POST(request: Request) {
  try {
    const ip = extractClientIp(request);
    const rateCheck = checkIpRateLimit(ip, 'auth_forgot_password');
    if (!rateCheck.allowed) {
      return createRateLimitResponse(rateCheck.retryAfterSeconds);
    }

    const validation = await validateJsonBody(request, forgotPasswordSchema);
    if (!validation.success) {
      return validation.response;
    }

    // Record request to throttle email dispatch attempts per IP
    recordIpFailedAttempt(ip, 'auth_forgot_password');

    const { email } = validation.data;
    const result = await requestPasswordReset(email);

    return Response.json({
      success: true,
      message: 'If an account exists with this email address, we have sent instructions to reset your password.',
      ...(isDevStubsEnabled() && { resetToken: result.resetToken }),
    });
  } catch {
    return Response.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
