import { handleGenerateCheckinCode } from '@/lib/arrival/api/generate';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return handleGenerateCheckinCode(req);
}
