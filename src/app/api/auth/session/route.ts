import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ authenticated: false, session: null });
  }

  return NextResponse.json({
    authenticated: true,
    session: {
      userId: session.userId,
      role: session.role,
      user: session.user,
      isLinked: session.isLinked,
    },
  });
}
