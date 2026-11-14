import { handleGateCheckin } from '@/lib/arrival/api';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return handleGateCheckin(req);
}
