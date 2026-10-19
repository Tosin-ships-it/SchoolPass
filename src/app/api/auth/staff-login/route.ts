import { loginStaff, extractClientIp } from '@/lib/auth';
import { validateJsonBody } from '@/lib/auth/validation';
import { staffLoginSchema } from '@/lib/auth/schemas';

export async function POST(request: Request) {
  try {
    const validation = await validateJsonBody(request, staffLoginSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { email, password } = validation.data;

    const ip = extractClientIp(request);
    const result = await loginStaff(email, password, ip);

    if (!result.success) {
      return Response.json(
        { error: result.error, errorCode: result.errorCode },
        { status: result.errorCode === 'RATE_LIMITED' ? 429 : 401 }
      );
    }

    return Response.json({
      success: true,
      role: result.role,
      message: 'Staff signed in successfully.',
    });
  } catch {
    return Response.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
