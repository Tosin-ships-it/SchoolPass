import { NextRequest } from 'next/server';
import { getPortalData } from '@/lib/payments/api/portal';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    return await getPortalData(request);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
