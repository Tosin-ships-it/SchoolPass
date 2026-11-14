import 'server-only';
import { processGateCheckin } from '../checkinService';

export async function handleGateCheckin(req: Request): Promise<Response> {
  try {
    const body = await req.json().catch(() => ({}));
    const { code, method } = body;

    if (!code || typeof code !== 'string') {
      return Response.json(
        { success: false, error: '6-digit check-in code is required.' },
        { status: 400 }
      );
    }

    const result = await processGateCheckin({
      code,
      method: method === 'QR' ? 'QR' : 'MANUAL_CODE',
    });

    if (!result.success) {
      return Response.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return Response.json(result, { status: 200 });
  } catch (err: any) {
    return Response.json(
      { success: false, error: err.message || 'Failed to process check-in.' },
      { status: 500 }
    );
  }
}
