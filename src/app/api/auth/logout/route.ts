import { NextRequest, NextResponse } from 'next/server';
import { logout, SESSION_COOKIE_NAME } from '@/lib/auth';

export async function POST(request: NextRequest | Request) {
  let sessionCookie: string | undefined;

  // 1. Extract from NextRequest cookies helper if available
  if ('cookies' in request && typeof request.cookies?.get === 'function') {
    sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  }

  // 2. Fall back to parsing raw Cookie header
  if (!sessionCookie) {
    const cookieHeader = request.headers.get('cookie') || '';
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
    if (match) {
      sessionCookie = decodeURIComponent(match[1]);
    }
  }

  const result = await logout(sessionCookie);

  const acceptHeader = request.headers.get('accept') || '';
  const isJsonRequest = acceptHeader.includes('application/json') && !acceptHeader.includes('text/html');

  // Programmatic/API clients receive JSON response
  if (isJsonRequest) {
    const jsonResponse = NextResponse.json(
      result.success
        ? { success: true, message: 'Signed out successfully.' }
        : { success: false, error: result.error || 'Failed to sign out.' },
      { status: result.success ? 200 : 500 }
    );
    jsonResponse.cookies.delete(SESSION_COOKIE_NAME);
    return jsonResponse;
  }

  // Determine user destination:
  // Primary authority: verified session role returned by server-side logout
  const role = result.role ? String(result.role).trim().toLowerCase() : undefined;
  let isStaff = role === 'staff' || role === 'admin';

  if (!role) {
    // Secondary fallback heuristic if session was already expired/missing
    const referer = request.headers.get('referer') || '';
    const staffRoutes = [
      '/attendance',
      '/guardian-links',
      '/info',
      '/arrival-code',
      '/payments',
      '/reports',
      '/settings',
      '/staff-accounts',
      '/staff',
    ];
    if (staffRoutes.some((route) => referer.includes(route))) {
      isStaff = true;
    }
  }

  const basePath = isStaff ? '/auth/staff-login' : '/auth/login';
  const targetPath = !result.success ? `${basePath}?error=logout_failed` : basePath;

  const redirectResponse = NextResponse.redirect(new URL(targetPath, request.url), 303);
  redirectResponse.cookies.delete(SESSION_COOKIE_NAME);
  return redirectResponse;
}
