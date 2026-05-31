'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { apiGet } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#f97316', '#3b82f6', '#22c55e', '#eab308', '#ef4444'];

export default function AdminAnalyticsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (!isLoading && !user) { router.push('/login'); return; }
    apiGet<any>('/api/admin/analytics/platform').then(r => { if (r.success) setStats(r.data); });
  }, [user, isLoading]);

  if (isLoading || !user) return null;

  return (
    <DashboardLayout variant="admin">
      <div>
        <h1 className="text-2xl font-bold">Platform Analytics</h1>

        {/* KPIs */}
        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {[
            { label: 'Total Restaurants', value: stats?.totalRestaurants ?? 0, color: 'text-blue-600' },
            { label: 'Active', value: stats?.activeRestaurants ?? 0, color: 'text-green-600' },
            { label: 'Total Orders', value: stats?.totalOrders ?? 0, color: 'text-brand-600' },
            { label: 'Platform Revenue', value: `NRS ${(stats?.totalRevenue ?? 0).toLocaleString()}`, color: 'text-purple-600' },
          ].map(k => (
            <div key={k.label} className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className={`mt-1 text-xl font-bold ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Top Restaurants */}
        {stats?.topRestaurants?.length > 0 && (
          <div className="mt-6 rounded-xl border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Top Restaurants by Revenue</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.topRestaurants} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `NRS ${v.toLocaleString()}`} />
                <Bar dataKey="revenue" fill="#f97316" radius={[0, 4, 4, 0]} name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
