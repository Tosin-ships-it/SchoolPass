import { NextRequest } from 'next/server';
import { getReceiptData } from '@/lib/payments/api/receipt';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reference: string }> }
): Promise<Response> {
  const { reference } = await params;
  return getReceiptData(reference);
}

