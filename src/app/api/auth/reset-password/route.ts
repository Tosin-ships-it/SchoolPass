import {
  resetPassword,
  extractClientIp,
  checkIpRateLimit,
  recordIpFailedAttempt,
  createRateLimitResponse,
} from '@/lib/auth';
import { validateJsonBody } from '@/lib/auth/validation';
import { resetPasswordSchema } from '@/lib/auth/schemas';

export async function POST(request: Request) {
  try {
    const ip = extractClientIp(request);
    const rateCheck = checkIpRateLimit(ip, 'auth_reset_password');
    if (!rateCheck.allowed) {
      return createRateLimitResponse(rateCheck.retryAfterSeconds);
    }

    const validation = await validateJsonBody(request, resetPasswordSchema);
    if (!validation.success) {
      recordIpFailedAttempt(ip, 'auth_reset_password');
      return validation.response;
    }

    const { token, password } = validation.data;
    const result = await resetPassword(token, password);
    if (!result.success) {
      recordIpFailedAttempt(ip, 'auth_reset_password');
      return Response.json({ error: result.error }, { status: 400 });
    }

    return Response.json({
      success: true,
      message: 'Password reset successfully. You can now sign in with your new password.',
    });
  } catch {
    return Response.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
