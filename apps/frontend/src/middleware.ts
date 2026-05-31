import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/', '/login', '/signup', '/auth', '/r/', '/admin/login', '/kitchen/login', '/bill/'];

const PROTECTED_PATHS: Record<string, string> = {
  '/dashboard': '/login',
  '/kitchen': '/login',
  '/admin': '/login',
  '/onboarding': '/login',
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths without checks
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Static assets and API calls pass through
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/sounds') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Check for protected paths — look for Supabase session cookie
  for (const [prefix, redirectTo] of Object.entries(PROTECTED_PATHS)) {
    if (pathname.startsWith(prefix)) {
      // Supabase stores session cookies with project-specific names
      // Production: sb-<project-ref>-auth-token, Local: sb-localhost-auth-token
      const hasSession = request.cookies
        .getAll()
        .some((c) => c.name.includes('sb-') && c.name.includes('auth-token'));

      if (!hasSession) {
        const loginUrl = new URL(redirectTo, request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
      }
      break;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
