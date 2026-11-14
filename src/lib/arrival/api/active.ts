import 'server-only';
import { getSession } from '@/lib/auth';
import { getActiveCheckinCode } from '../checkinService';
import { generateQrSvg } from '../qr';

export async function handleGetActiveCheckinCode(req: Request): Promise<Response> {
  try {
    const session = await getSession();
    if (!session || session.role !== 'parent') {
      return Response.json(
        { success: false, error: 'Authentication required. Parent access only.' },
        { status: 401 }
      );
    }

    const url = new URL(req.url);
    const studentId = url.searchParams.get('studentId');

    if (!studentId) {
      return Response.json(
        { success: false, error: 'studentId query parameter is required.' },
        { status: 400 }
      );
    }

    const activeCode = await getActiveCheckinCode(studentId, session.userId);

    if (!activeCode) {
      return Response.json({ success: true, activeCode: null });
    }

    const expiresAt = new Date(activeCode.expiresAt);
    const remainingSeconds = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));

    return Response.json({
      success: true,
      activeCode: {
        code: activeCode.code,
        qrSvg: generateQrSvg(activeCode.code, { size: 160 }),
        studentId: activeCode.studentId,
        studentName: activeCode.studentName,
        studentNumber: activeCode.studentNumber,
        expiresAt: activeCode.expiresAt,
        expiresInSeconds: remainingSeconds,
        dateStr: activeCode.dateStr,
        timeStr: activeCode.timeStr,
        expiresAtStr: activeCode.expiresAtStr,
      },
    });
  } catch (err: any) {
    return Response.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
