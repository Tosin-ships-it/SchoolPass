import 'server-only';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { generateParentCheckinCode } from '../checkinService';

export async function handleGenerateCheckinCode(req: Request): Promise<Response> {
  try {
    const session = await getSession();
    if (!session || session.role !== 'parent') {
      return Response.json(
        { success: false, error: 'Authentication required. Parent access only.' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { studentId } = body;

    if (!studentId || typeof studentId !== 'string') {
      return Response.json(
        { success: false, error: 'studentId is required.' },
        { status: 400 }
      );
    }

    // Lookup parent details
    const parent = await prisma.parent.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true, name: true },
    });

    if (!parent) {
      return Response.json(
        { success: false, error: 'Parent record not found.' },
        { status: 404 }
      );
    }

    const result = await generateParentCheckinCode({
      parentId: parent.id,
      studentId,
      parentEmail: parent.email,
      parentName: parent.name,
    });

    if (!result.success) {
      return Response.json(
        { success: false, error: result.error || 'Failed to generate check-in code.' },
        { status: 400 }
      );
    }

    return Response.json({ success: true, ...result });
  } catch (err: any) {
    return Response.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
