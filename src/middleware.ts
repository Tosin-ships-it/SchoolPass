import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const SESSION_COOKIE_NAME = 'schoolpass_session';

// Parent routes matching the defined PRD scope
const PARENT_ROUTE_PREFIXES = ['/ask', '/records', '/arrival', '/pay', '/office'];

// Staff routes matching the defined PRD scope
const STAFF_ROUTE_PREFIXES = [
  '/info',
  '/attendance',
  '/arrival-code',
  '/payments',
  '/reports',
  '/settings',
  '/staff-accounts',
  '/guardian-links',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  const isParentRoute = PARENT_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isStaffRoute = STAFF_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  // If visiting protected parent route without session cookie
  if (isParentRoute && !sessionCookie) {
    const loginUrl = new URL('/auth/login', request.url);
    loginUrl.searchParams.set('returnUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If visiting protected staff route without session cookie
  if (isStaffRoute && !sessionCookie) {
    const staffLoginUrl = new URL('/auth/staff-login', request.url);
    staffLoginUrl.searchParams.set('returnUrl', pathname);
    return NextResponse.redirect(staffLoginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/ask/:path*',
    '/records/:path*',
    '/arrival/:path*',
    '/pay/:path*',
    '/office/:path*',
    '/info/:path*',
    '/attendance/:path*',
    '/arrival-code/:path*',
    '/payments/:path*',
    '/reports/:path*',
    '/settings/:path*',
    '/staff-accounts/:path*',
    '/guardian-links/:path*',
  ],
};
