'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { apiGet } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';

const COLORS = ['#f97316', '#3b82f6', '#22c55e', '#eab308', '#ef4444', '#8b5cf6'];

export default function AnalyticsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [restaurant, setRestaurant] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [revenue, setRevenue] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [billStats, setBillStats] = useState<any[]>([]);
  const [period, setPeriod] = useState('daily');

  const load = useCallback(async () => {
    const r = await apiGet<any>('/api/restaurants/mine');
    if (r.success && r.data) {
      setRestaurant(r.data);
      const [s, rev, it, bs] = await Promise.all([
        apiGet<any>(`/api/restaurants/${r.data.id}/analytics/summary`),
        apiGet<any[]>(`/api/restaurants/${r.data.id}/analytics/revenue?period=${period}`),
        apiGet<any[]>(`/api/restaurants/${r.data.id}/analytics/items`),
        apiGet<any[]>(`/api/restaurants/${r.data.id}/analytics/bills`),
      ]);
      if (s.success && s.data) setSummary(s.data);
      if (rev.success && rev.data) setRevenue(rev.data);
      if (it.success && it.data) setItems(it.data);
      if (bs.success && bs.data) setBillStats(bs.data);
    }
  }, [period]);

  useEffect(() => { if (!isLoading && !user) router.push('/login'); else if (user) load(); }, [user, isLoading, period]);

  if (isLoading || !user) return null;

  return (
    <DashboardLayout variant="restaurant">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>

        {/* KPI Cards */}
        <div className="mt-6 grid gap-4 md:grid-cols-5">
          {[
            { label: 'Revenue Today', value: `NRS ${(summary?.revenueToday ?? 0).toLocaleString()}`, color: 'text-green-600' },
            { label: 'Active Orders', value: summary?.activeOrders ?? 0, color: 'text-blue-600' },
            { label: 'Total Revenue', value: `NRS ${(summary?.totalRevenue ?? 0).toLocaleString()}`, color: 'text-brand-600' },
            { label: 'Paid Bills', value: summary?.totalPaidBills ?? 0, color: 'text-purple-600' },
            { label: 'Avg Order', value: `NRS ${(summary?.avgOrderValue ?? 0).toLocaleString()}`, color: 'text-yellow-600' },
          ].map(k => (
            <div key={k.label} className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className={`mt-1 text-xl font-bold ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Revenue Chart */}
        <div className="mt-6 rounded-xl border bg-card p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Revenue Trend</h2>
            <select value={period} onChange={e => setPeriod(e.target.value)}
              className="rounded border px-2 py-1 text-xs">
              <option value="daily">Daily (14d)</option>
              <option value="weekly">Weekly (7d)</option>
              <option value="monthly">Monthly (30d)</option>
            </select>
          </div>
          {revenue.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No revenue data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revenue}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `NRS ${v.toLocaleString()}`} />
                <Line type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={2} dot={{ fill: '#f97316', r: 3 }} name="Revenue" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {/* Top Items */}
          <div className="rounded-xl border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Top Selling Items</h2>
            {items.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={items.slice(0, 6)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => `${v} sold`} />
                  <Bar dataKey="quantity" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Qty Sold" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Bills Breakdown */}
          <div className="rounded-xl border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Bills Breakdown</h2>
            {billStats.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={billStats} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={90} label={({ status, count }: any) => `${status} (${count})`}>
                    {billStats.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
