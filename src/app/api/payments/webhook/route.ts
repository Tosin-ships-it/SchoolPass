import { NextRequest } from 'next/server';
import { handleFlutterwaveWebhook } from '@/lib/payments/api/webhook';

export async function POST(request: NextRequest): Promise<Response> {
  return handleFlutterwaveWebhook(request);
}

