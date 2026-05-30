'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { apiGet } from '@/lib/api';

interface AdminStats {
  totalRestaurants: number;
  activeRestaurants: number;
  pendingApprovals: number;
  suspendedRestaurants: number;
  pendingSubscriptions: number;
}

export default function AdminPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    if (!isLoading && !user) { router.push('/login'); return; }
    apiGet<AdminStats>('/api/admin/dashboard/stats').then(res => {
      if (res.success && res.data) setStats(res.data);
    });
  }, [user, isLoading]);

  if (isLoading || !user) return null;

  return (
    <DashboardLayout variant="admin">
      <div>
        <h1 className="text-2xl font-bold">Super Admin</h1>
        <p className="mt-1 text-muted-foreground">Platform overview</p>

        <div className="mt-8 grid gap-6 md:grid-cols-5">
          {[
            { label: 'Total Restaurants', value: stats?.totalRestaurants ?? '-', color: '' },
            { label: 'Active', value: stats?.activeRestaurants ?? '-', color: 'text-green-600' },
            { label: 'Pending Approval', value: stats?.pendingApprovals ?? '-', color: 'text-yellow-600' },
            { label: 'Suspended', value: stats?.suspendedRestaurants ?? '-', color: 'text-red-600' },
            { label: 'Pending Subs', value: stats?.pendingSubscriptions ?? '-', color: 'text-blue-600' },
          ].map(s => (
            <div key={s.label} className="rounded-xl border bg-card p-6">
              <h3 className="text-sm font-medium text-muted-foreground">{s.label}</h3>
              <p className={`mt-2 text-3xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <a href="/admin/restaurants" className="rounded-xl border bg-card p-6 hover:border-brand-300 transition-colors">
            <h3 className="text-lg font-semibold">🏪 Manage Restaurants</h3>
            <p className="mt-2 text-sm text-muted-foreground">Search, view details, suspend or reactivate restaurants</p>
          </a>
          <a href="/admin/subscriptions" className="rounded-xl border bg-card p-6 hover:border-brand-300 transition-colors">
            <h3 className="text-lg font-semibold">🔐 Subscription Requests</h3>
            <p className="mt-2 text-sm text-muted-foreground">Approve or reject pending subscription requests</p>
          </a>
        </div>
      </div>
    </DashboardLayout>
  );
}
