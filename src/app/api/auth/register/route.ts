import {
  registerParent,
  retryRegistrationStudentLink,
  isDevStubsEnabled,
  extractClientIp,
  checkIpRateLimit,
  recordIpFailedAttempt,
  createRateLimitResponse,
} from '@/lib/auth';
import { validateJsonBody } from '@/lib/auth/validation';
import { parentRegisterSchema, retryRegistrationLinkSchema } from '@/lib/auth/schemas';

export async function POST(request: Request) {
  try {
    const ip = extractClientIp(request);
    const rateCheck = checkIpRateLimit(ip, 'auth_register');
    if (!rateCheck.allowed) {
      return createRateLimitResponse(rateCheck.retryAfterSeconds);
    }

    // Check if this is a retry-linking request
    let isRetryLink = false;
    try {
      const peekBody = await request.clone().json();
      if (
        peekBody &&
        typeof peekBody === 'object' &&
        (peekBody as Record<string, unknown>).action === 'retry-link'
      ) {
        isRetryLink = true;
      }
    } catch {
      // Malformed JSON will be caught and safely returned by validateJsonBody below
    }

    if (isRetryLink) {
      const validation = await validateJsonBody(request, retryRegistrationLinkSchema);
      if (!validation.success) {
        return validation.response;
      }

      const { email, token, studentNumber } = validation.data;
      const retryResult = await retryRegistrationStudentLink({
        email,
        verificationToken: token,
        studentNumber,
      });

      if (!retryResult.success) {
        recordIpFailedAttempt(ip, 'auth_register');
        return Response.json(
          { error: retryResult.error || 'Failed to submit student link request.' },
          { status: 400 }
        );
      }

      return Response.json({
        success: true,
        message: 'Your link request has been submitted and is pending staff approval.',
        studentName: retryResult.studentName,
        className: retryResult.className,
        requestId: retryResult.requestId,
      });
    }

    const validation = await validateJsonBody(request, parentRegisterSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { name, email, password, studentNumber } = validation.data;

    const result = await registerParent({
      name,
      email,
      password,
      studentNumber,
    });

    if (!result.success) {
      recordIpFailedAttempt(ip, 'auth_register');
      return Response.json({ error: result.error }, { status: 400 });
    }

    return Response.json({
      success: true,
      message: 'Registration successful. Please verify your email address.',
      ...(isDevStubsEnabled() && { verificationToken: result.verificationToken }),
      email,
      studentLink: result.studentLink,
    });
  } catch {
    return Response.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const ip = extractClientIp(request);
    const rateCheck = checkIpRateLimit(ip, 'auth_register');
    if (!rateCheck.allowed) {
      return createRateLimitResponse(rateCheck.retryAfterSeconds);
    }

    const validation = await validateJsonBody(request, retryRegistrationLinkSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { email, token, studentNumber } = validation.data;

    const result = await retryRegistrationStudentLink({
      email,
      verificationToken: token,
      studentNumber,
    });

    if (!result.success) {
      recordIpFailedAttempt(ip, 'auth_register');
      return Response.json(
        { error: result.error || 'Failed to submit student link request.' },
        { status: 400 }
      );
    }

    return Response.json({
      success: true,
      message: 'Your link request has been submitted and is pending staff approval.',
      studentName: result.studentName,
      className: result.className,
      requestId: result.requestId,
    });
  } catch {
    return Response.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
