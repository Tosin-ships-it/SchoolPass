import { handleGateCheckin } from '@/lib/arrival/api/checkin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return handleGateCheckin(req);
}
