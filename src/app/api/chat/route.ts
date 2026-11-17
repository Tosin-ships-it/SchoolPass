import { getSession } from '@/lib/auth';
import { checkActorRateLimit, checkIpRateLimit, extractClientIp } from '@/lib/auth/rateLimit';
import { handleChatRequest } from '@/lib/ai/api/chat';

export const dynamic = 'force-dynamic';

/**
 * Production requests to /api/chat must require a valid, active parent session cookie.
 * Unauthenticated requests must return 401 Unauthorized.
 * Model requests are rate-limited per parent actor and per IP.
 */
export async function POST(req: Request) {
  const session = await getSession();

  if (!session || session.role !== 'parent') {
    return Response.json(
      {
        success: false,
        error: 'Authentication required. Active parent session required.',
        code: 'UNAUTHORIZED',
      },
      { status: 401 }
    );
  }

  // Rate limit: max 10 model requests per minute per parent
  const actorLimit = checkActorRateLimit(session.userId, 'chat:model', 10, 60 * 1000);
  if (!actorLimit.allowed) {
    const retryAfter = actorLimit.retryAfterSeconds ?? 60;
    return Response.json(
      {
        success: false,
        error: `Too many chat requests. Please wait ${retryAfter} seconds before asking again.`,
        code: 'RATE_LIMITED',
        retryAfterSeconds: retryAfter,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
        },
      }
    );
  }

  // IP-level defense: max 20 chat requests per minute per IP
  const clientIp = extractClientIp(req);
  if (clientIp) {
    const ipLimit = checkIpRateLimit(clientIp, 'chat:ip');
    if (!ipLimit.allowed) {
      const retryAfter = ipLimit.retryAfterSeconds ?? 60;
      return Response.json(
        {
          success: false,
          error: `Too many chat requests from your network. Please try again in ${retryAfter} seconds.`,
          code: 'RATE_LIMITED',
          retryAfterSeconds: retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
          },
        }
      );
    }
  }

  return handleChatRequest(req, {
    parentId: session.userId,
  });
}
