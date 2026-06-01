'use client';

import { useState, useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { cn } from '@/lib/utils';

interface NavItem {
  label: string;
  href: string;
  icon: string;
  section: string;
}

const RESTAURANT_NAV: NavItem[] = [
  { label: 'Menu', href: '/dashboard/menu', icon: '📋', section: 'General' },
  { label: 'Tables', href: '/dashboard/tables', icon: '🪑', section: 'General' },
  { label: 'Orders', href: '/dashboard/orders', icon: '📦', section: 'Operations' },
  { label: 'Billing', href: '/dashboard/billing', icon: '💳', section: 'Operations' },
  { label: 'Analytics', href: '/dashboard/analytics', icon: '📊', section: 'Analytics' },
  { label: 'Subscription', href: '/dashboard/subscription', icon: '🔐', section: 'Sensitive' },
  { label: 'Staff', href: '/dashboard/staff', icon: '👥', section: 'Sensitive' },
  { label: 'Settings', href: '/dashboard/settings', icon: '⚙️', section: 'Sensitive' },
];

const KITCHEN_NAV: NavItem[] = [
  { label: 'Kitchen Display', href: '/kitchen', icon: '👨‍🍳', section: 'Main' },
];

const ADMIN_NAV: NavItem[] = [
  { label: 'Overview', href: '/admin', icon: '📊', section: 'Main' },
  { label: 'Restaurants', href: '/admin/restaurants', icon: '🏪', section: 'Main' },
  { label: 'Subscriptions', href: '/admin/subscriptions', icon: '🔐', section: 'Main' },
  { label: 'Analytics', href: '/admin/analytics', icon: '📈', section: 'Main' },
  { label: 'Governance', href: '/admin/governance', icon: '⚖️', section: 'Security' },
  { label: 'Audit Logs', href: '/admin/audit', icon: '📝', section: 'Security' },
  { label: 'Passkeys', href: '/admin/security', icon: '🔑', section: 'Security' },
];

export function DashboardLayout({
  children,
  variant = 'restaurant',
}: {
  children: ReactNode;
  variant?: 'restaurant' | 'kitchen' | 'admin';
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, signOut, role } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // Super admin passkey check (skip on verify and security pages)
  useEffect(() => {
    if (variant !== 'admin' || !user || role !== 'super_admin') return;
    if (pathname === '/admin/verify' || pathname === '/admin/security' || pathname === '/admin/login') return;
    const verified = sessionStorage.getItem('zenthorax-passkey-verified');
    if (verified !== '1') router.push('/admin/verify');
  }, [variant, user, role, pathname]);

  const navItems =
    variant === 'kitchen' ? KITCHEN_NAV : variant === 'admin' ? ADMIN_NAV : RESTAURANT_NAV;

  function handleSignOut() {
    // Step 1: Clear ALL app-specific state
    signOut();                                                  // Supabase JWT + in-memory user state
    localStorage.removeItem('zenthorax-role');                 // role selection flag
    localStorage.removeItem('zenthorax-admin-login');          // admin login flag
    localStorage.removeItem('zenthorax-package');              // onboarding package
    localStorage.removeItem('zenthorax-session');              // customer table session
    sessionStorage.removeItem('zenthorax-passkey-verified');   // admin passkey flag

    // Step 2: Sign out of Google.
    // We redirect the full page to accounts.google.com/logout — this is the
    // only way to clear Google's auth cookies (same-origin policy prevents JS
    // from touching accounts.google.com). After Google signs the user out, the
    // browser stays on Google's signed-out confirmation page. The user can
    // close that tab or navigate back to our site manually.
    window.location.href = 'https://accounts.google.com/logout';
  }

  // Group items by section
  const sections = navItems.reduce<Record<string, NavItem[]>>((acc, item) => {
    if (!acc[item.section]) acc[item.section] = [];
    acc[item.section]!.push(item);
    return acc;
  }, {});

  return (
    <div className="flex min-h-screen">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 border-r bg-white transition-transform lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex h-16 items-center gap-2 border-b px-6">
            <span className="text-xl font-bold text-brand-500">Z</span>
            <span className="text-lg font-semibold">Zenthorax</span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4">
            {Object.entries(sections).map(([section, items]) => (
              <div key={section} className="mb-6">
                <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {section}
                </h3>
                <ul className="space-y-1">
                  {items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          pathname === item.href
                            ? 'bg-brand-50 text-brand-600'
                            : 'text-gray-700 hover:bg-gray-100',
                        )}
                      >
                        <span>{item.icon}</span>
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          {/* User footer */}
          <div className="border-t p-4">
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-medium text-brand-600">
                {user?.email?.charAt(0).toUpperCase() ?? '?'}
              </div>
              <div className="flex-1 truncate">
                <p className="text-sm font-medium">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-muted-foreground hover:bg-gray-100"
            >
              Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-x-hidden">
        {/* Top bar (mobile) */}
        <div className="flex h-16 items-center border-b bg-white px-4 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 hover:bg-gray-100"
            aria-label="Open menu"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
          <span className="ml-3 font-semibold">Zenthorax</span>
        </div>

        <div className="p-4 sm:p-6 max-w-full overflow-x-hidden">{children}</div>
      </main>
    </div>
  );
}
