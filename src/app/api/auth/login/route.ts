import { loginParent, extractClientIp } from '@/lib/auth';
import { validateJsonBody } from '@/lib/auth/validation';
import { parentLoginSchema } from '@/lib/auth/schemas';

export async function POST(request: Request) {
  try {
    const validation = await validateJsonBody(request, parentLoginSchema);
    if (!validation.success) {
      return validation.response;
    }

    const { email, password } = validation.data;

    const ip = extractClientIp(request);
    const result = await loginParent(email, password, ip);

    if (!result.success) {
      return Response.json(
        { error: result.error, errorCode: result.errorCode },
        { status: result.errorCode === 'RATE_LIMITED' ? 429 : 401 }
      );
    }

    return Response.json({
      success: true,
      message: 'Signed in successfully.',
    });
  } catch {
    return Response.json(
      { error: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}
