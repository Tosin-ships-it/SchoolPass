import { getSession, requestAccountDeletion } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'parent') {
      return Response.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const body = await request.json();
    const { password } = body;

    if (!password || typeof password !== 'string') {
      return Response.json({ error: 'Password confirmation is required.' }, { status: 400 });
    }

    const result = await requestAccountDeletion(session.userId, password);
    if (!result.success) {
      return Response.json({ error: result.error }, { status: 400 });
    }

    return Response.json({
      success: true,
      message: 'Your account has been scheduled for deletion. You have a 7-day grace period to restore it.',
      scheduledDeletionAt: result.scheduledDeletionAt,
    });
  } catch {
    return Response.json({ error: 'An unexpected error occurred. Please try again.' }, { status: 500 });
  }
}
