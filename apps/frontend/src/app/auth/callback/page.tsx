'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { apiGet, apiPost } from '@/lib/api';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    async function handleCallback() {
      // Supabase handles the OAuth code exchange automatically via the URL hash.
      // We just wait for the session to be established, then redirect.
      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        setError('Authentication failed. Please try again.');
        return;
      }

      // Sync user to our database
      await apiPost('/api/auth/sync');

      // Fetch user profile to determine role and redirect
      const profileRes = await apiGet<{
        role: string;
        restaurant: { slug: string } | null;
        kitchenStaff: { restaurantId: string } | null;
      }>('/api/auth/me');

      if (profileRes.success && profileRes.data) {
        const { role, restaurant } = profileRes.data;
        const isAdminLogin = localStorage.getItem('zenthorax-admin-login') === '1';
        localStorage.removeItem('zenthorax-admin-login');

        // Admin login: only allow super_admin role
        if (isAdminLogin && role !== 'super_admin') {
          setError('This account does not have super admin privileges. Please use the restaurant login instead.');
          return;
        }

        // Admin login succeeded
        if (isAdminLogin && role === 'super_admin') {
          router.push('/admin');
          return;
        }

        // Regular login: super admin can use either
        switch (role) {
          case 'super_admin':
            router.push('/admin');
            break;
          case 'kitchen_staff':
            router.push('/kitchen');
            break;
          case 'restaurant_manager':
          default:
            if (restaurant) {
              router.push('/dashboard');
            } else {
              router.push('/onboarding');
            }
            break;
        }
      }
    }

    handleCallback();
  }, [router]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <span className="text-2xl">⚠️</span>
          </div>
          <h1 className="mt-4 text-xl font-bold">Authentication Failed</h1>
          <p className="mt-2 text-muted-foreground">{error}</p>
          <a href="/login" className="mt-4 inline-block text-brand-500 hover:underline">
            Back to login
          </a>
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
