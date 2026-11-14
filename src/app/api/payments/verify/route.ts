import { NextRequest, NextResponse } from 'next/server';
import { verifyPaymentTransaction } from '@/lib/payments/api/verify';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const { transactionId, tx_ref } = body;

    if (!transactionId) {
      return NextResponse.json(
        { success: false, error: 'Transaction ID is required.' },
        { status: 400 }
      );
    }

    const result = await verifyPaymentTransaction(transactionId, tx_ref);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Internal server error verifying transaction.' },
      { status: 500 }
    );
  }
}

