import { handleGetActiveCheckinCode } from '@/lib/arrival/api/active';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handleGetActiveCheckinCode(req);
}
