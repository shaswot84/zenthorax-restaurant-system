'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { apiGet } from '@/lib/api';

interface RestaurantInfo {
  id: string;
  name: string;
  slug: string;
  status: string;
  subscription: { status: string } | null;
}

export default function DashboardPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null);
  const [loadingRestaurant, setLoadingRestaurant] = useState(true);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    if (user) {
      apiGet<any>('/api/restaurants/mine').then((res) => {
        if (res.success && res.data) {
          setRestaurant(res.data);
        } else {
          router.push('/onboarding');
        }
        setLoadingRestaurant(false);
      });
    }
  }, [user]);

  if (isLoading || loadingRestaurant) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (!user || !restaurant) return null;

  const isPending = restaurant.status === 'pending_approval';

  return (
    <DashboardLayout variant="restaurant">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Welcome back, {user.email}
        </p>

        {isPending && (
          <div className="mt-6 rounded-xl border-2 border-yellow-200 bg-yellow-50 p-6">
            <div className="flex items-center gap-3">
              <span className="text-3xl">⏳</span>
              <div>
                <h2 className="text-lg font-bold text-yellow-800">Waiting for Approval</h2>
                <p className="mt-1 text-sm text-yellow-700">
                  Your restaurant &ldquo;{restaurant.name}&rdquo; has been created and is pending
                  approval from the Zenthorax team. This usually takes 24-48 hours.
                </p>
                <p className="mt-2 text-sm text-yellow-700">
                  You&apos;ll receive an email at {user.email} once approved. Until then, you can
                  browse your dashboard settings.
                </p>
              </div>
            </div>
          </div>
        )}

        {!isPending && (
          <>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              <div className="rounded-xl border bg-card p-6">
                <h3 className="text-sm font-medium text-muted-foreground">Today&apos;s Orders</h3>
                <p className="mt-2 text-3xl font-bold">0</p>
              </div>
              <div className="rounded-xl border bg-card p-6">
                <h3 className="text-sm font-medium text-muted-foreground">Active Tables</h3>
                <p className="mt-2 text-3xl font-bold">0</p>
              </div>
              <div className="rounded-xl border bg-card p-6">
                <h3 className="text-sm font-medium text-muted-foreground">Revenue Today</h3>
                <p className="mt-2 text-3xl font-bold">NRS 0</p>
              </div>
            </div>

            <div className="mt-8 rounded-xl border bg-card p-6">
              <h2 className="text-lg font-semibold">Getting Started</h2>
              <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                <li>1. Add your menu items in <a href="/dashboard/menu" className="text-brand-500 hover:underline">Menu</a></li>
                <li>2. Set up your tables in <a href="/dashboard/tables" className="text-brand-500 hover:underline">Tables</a></li>
                <li>3. Print QR codes and place them on tables</li>
                <li>4. Start taking orders!</li>
              </ul>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
