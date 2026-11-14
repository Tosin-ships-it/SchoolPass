import { cancelAccountDeletion } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return Response.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    const result = await cancelAccountDeletion(email, password);
    if (!result.success) {
      return Response.json({ error: result.error }, { status: 400 });
    }

    return Response.json({
      success: true,
      message: 'Account deletion has been cancelled. Your account has been fully restored.',
    });
  } catch {
    return Response.json({ error: 'An unexpected error occurred. Please try again.' }, { status: 500 });
  }
}
