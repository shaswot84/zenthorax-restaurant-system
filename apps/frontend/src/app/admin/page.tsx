'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { DashboardLayout } from '@/components/layout/dashboard-layout';

export default function AdminPage() {
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
    <DashboardLayout variant="admin">
      <div>
        <h1 className="text-2xl font-bold">Super Admin</h1>
        <p className="mt-2 text-muted-foreground">Platform management dashboard.</p>

        <div className="mt-8 grid gap-6 md:grid-cols-4">
          <div className="rounded-xl border bg-card p-6">
            <h3 className="text-sm font-medium text-muted-foreground">Total Restaurants</h3>
            <p className="mt-2 text-3xl font-bold">0</p>
          </div>
          <div className="rounded-xl border bg-card p-6">
            <h3 className="text-sm font-medium text-muted-foreground">Active</h3>
            <p className="mt-2 text-3xl font-bold">0</p>
          </div>
          <div className="rounded-xl border bg-card p-6">
            <h3 className="text-sm font-medium text-muted-foreground">Pending Approvals</h3>
            <p className="mt-2 text-3xl font-bold text-yellow-600">0</p>
          </div>
          <div className="rounded-xl border bg-card p-6">
            <h3 className="text-sm font-medium text-muted-foreground">Suspended</h3>
            <p className="mt-2 text-3xl font-bold text-red-600">0</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
