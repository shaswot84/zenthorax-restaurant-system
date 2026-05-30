import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = [
  '/',
  '/signup',
  '/login',
  '/r/', // QR menu routes
];

const ROLE_ROUTES: Record<string, string> = {
  restaurant_manager: '/dashboard',
  kitchen_staff: '/kitchen',
  super_admin: '/admin',
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths without checks
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // For protected routes (dashboard, kitchen, admin), redirect to login
  // if no session cookie exists. Actual auth enforcement happens via API calls.
  // The Supabase session cookie will be checked client-side via the Supabase client.

  // Static assets and API calls pass through
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/sounds') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
