'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, initSupabase } from '@/lib/supabase';
import { apiGet, apiPost } from '@/lib/api';

// Force Supabase client init IMMEDIATELY so detectSessionInUrl works
initSupabase();

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [debug, setDebug] = useState('');

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) {
        setError('Authentication timed out. Please try again.');
        setDebug(`URL: ${window.location.href}`);
      }
    }, 15000);

    async function handleCallback() {
      // Get the session — Supabase client with detectSessionInUrl
      // auto-exchanges the PKCE code in the query string
      const { data } = await supabase.auth.getSession();

      if (!cancelled) {
        if (!data.session) {
          // Try once more after a short delay (Supabase might still be processing)
          await new Promise(r => setTimeout(r, 1000));
          const retry = await supabase.auth.getSession();
          if (!retry.data.session) {
            setError('Authentication failed. No session established.');
            setDebug(`URL: ${window.location.href}`);
            clearTimeout(timeout);
            return;
          }
          // Use retry data
          await processSession(retry.data.session);
        } else {
          await processSession(data.session);
        }
        clearTimeout(timeout);
      }
    }

    async function processSession(session: any) {
      // Sync user to our database
      // Sync user — check for role conflicts
      const syncRes = await apiPost<{ role: string }>('/api/auth/sync');
      if (!syncRes.success && syncRes.error?.code === 'ROLE_CONFLICT') {
        setError(syncRes.error.message);
        return;
      }

      // Fetch user profile
      const profileRes = await apiGet<{
        role: string;
        restaurant: { slug: string } | null;
        kitchenStaff: { restaurantId: string } | null;
      }>('/api/auth/me');

      if (!cancelled && profileRes.success && profileRes.data) {
        const { role, restaurant } = profileRes.data;
        const isAdminLogin = localStorage.getItem('zenthorax-admin-login') === '1';
        const chosenRole = localStorage.getItem('zenthorax-role');
        localStorage.removeItem('zenthorax-admin-login');
        localStorage.removeItem('zenthorax-role');

        if (isAdminLogin && role !== 'super_admin') {
          setError('This account does not have super admin privileges.');
          return;
        }

        if (isAdminLogin && role === 'super_admin') {
          router.push('/admin/verify');
          return;
        }

        // Role was pre-selected (from landing page or kitchen login) — skip role selection
        if (chosenRole === 'kitchen_staff') {
          router.push('/kitchen');
          return;
        }
        if (chosenRole === 'restaurant_manager') {
          if (restaurant) router.push('/dashboard');
          else router.push('/onboarding');
          return;
        }

        // No role pre-selected — use the user's actual role from DB
        switch (role) {
          case 'super_admin':
            router.push('/admin/verify');
            break;
          case 'kitchen_staff':
            router.push('/kitchen');
            break;
          case 'restaurant_manager':
          default:
            if (restaurant) router.push('/dashboard');
            else router.push('/onboarding');
            break;
        }
      }
    }

    handleCallback();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [router]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <span className="text-2xl">⚠️</span>
          </div>
          <h1 className="mt-4 text-xl font-bold">Authentication Failed</h1>
          <p className="mt-2 text-muted-foreground">{error}</p>
          {debug && <p className="mt-2 text-xs text-gray-400 break-all">{debug}</p>}
          <div className="mt-4 space-x-3">
            <a href="/login" className="text-brand-500 hover:underline">Restaurant login</a>
            <span className="text-muted-foreground">|</span>
            <a href="/admin/login" className="text-brand-500 hover:underline">Admin login</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
        <p className="mt-4 text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  );
}
