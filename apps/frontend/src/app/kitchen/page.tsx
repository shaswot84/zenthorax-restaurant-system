'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

export default function KitchenPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <DashboardLayout variant="kitchen">
      <div>
        <h1 className="text-2xl font-bold">Kitchen Display</h1>
        <p className="mt-2 text-muted-foreground">
          Active orders will appear here in real-time.
        </p>
        <div className="mt-8 rounded-xl border bg-card p-12 text-center">
          <p className="text-muted-foreground">No active orders. Waiting for new orders...</p>
        </div>
      </div>
    </DashboardLayout>
  );
}
