import { getSessionCookie } from 'better-auth/cookies';
import { type NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3001';

// Forwards API calls to the NestJS backend (keeping auth cookies first-party) and guards the app's pages.
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith('/api/')) {
    return NextResponse.rewrite(new URL(pathname + search, BACKEND_URL));
  }

  // Optimistic check only: the backend validates the session on every API call.
  const hasSession = Boolean(getSessionCookie(request));
  const isAuthPage = pathname.startsWith('/auth');

  if (!hasSession && !isAuthPage) {
    const login = new URL('/auth/login', request.url);
    if (pathname !== '/') login.searchParams.set('redirect', pathname + search);
    return NextResponse.redirect(login);
  }
  if (hasSession && isAuthPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico|jpg|webp)$).*)'],
};
