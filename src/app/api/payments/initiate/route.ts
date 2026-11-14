import { NextRequest, NextResponse } from 'next/server';
import { initiateOnlinePayment } from '@/lib/payments/api/initiate';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const result = await initiateOnlinePayment(body);

    if (!result.success) {
      const status =
        result.code === 'UNAUTHORIZED'
          ? 401
          : result.code === 'FORBIDDEN'
            ? 403
            : 400;
      return NextResponse.json(result, { status });
    }

    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Internal server error processing payment initiation.' },
      { status: 500 }
    );
  }
}

