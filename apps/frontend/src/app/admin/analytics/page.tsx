'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { apiGet } from '@/lib/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts';

const COLORS = ['#f97316', '#3b82f6', '#22c55e', '#eab308', '#ef4444', '#8b5cf6'];

export default function AdminAnalyticsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [subData, setSubData] = useState<any>(null);
  const [revData, setRevData] = useState<any[]>([]);
  const [revPlan, setRevPlan] = useState('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [subRes, revRes] = await Promise.all([
      apiGet<any>('/api/admin/analytics/subscriptions'),
      apiGet<any[]>(`/api/admin/analytics/subscription-revenue?plan=${revPlan}`),
    ]);
    if (subRes.success && subRes.data) setSubData(subRes.data);
    if (revRes.success && revRes.data) setRevData(revRes.data);
    setLoading(false);
  }, [revPlan]);

  useEffect(() => { if (!isLoading && !user) { router.push('/login'); return; } if (user) load(); }, [user, isLoading, revPlan]);

  if (isLoading || loading || !user) return null;

  const pkg = subData?.packageBreakdown ?? [];
  const totalSubRevenue = pkg.reduce((s: number, p: any) => s + (p.revenue ?? 0), 0);

  // Status distribution for pie chart
  const statusDist = [
    { name: 'Active', value: subData?.activeSubscriptions ?? 0, color: '#22c55e' },
    { name: 'Grace Period', value: subData?.gracePeriod ?? 0, color: '#eab308' },
    { name: 'Expired', value: subData?.expired ?? 0, color: '#ef4444' },
  ].filter(d => d.value > 0);

  return (
    <DashboardLayout variant="admin">
      <div>
        <h1 className="text-2xl font-bold">Platform Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Subscription-based metrics</p>

        {/* KPI Cards — Row 1 */}
        <div className="mt-6 grid gap-4 md:grid-cols-5">
          {[
            { label: 'Total Restaurants', value: subData?.totalRestaurants ?? 0, color: 'text-gray-700' },
            { label: 'Active Subscriptions', value: subData?.activeSubscriptions ?? 0, color: 'text-green-600' },
            { label: 'Grace Period', value: subData?.gracePeriod ?? 0, color: 'text-yellow-600' },
            { label: 'Expired', value: subData?.expired ?? 0, color: 'text-red-600' },
            { label: 'Sub Revenue', value: `NRS ${totalSubRevenue.toLocaleString()}`, color: 'text-brand-600' },
          ].map(k => (
            <div key={k.label} className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className={`mt-1 text-xl font-bold ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Package Breakdown */}
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Subscription by Package</h2>
            {pkg.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={pkg}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="packageName" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="activeCount" fill="#f97316" name="Active Restaurants" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="revenue" fill="#3b82f6" name="Revenue (NRS)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Status Distribution */}
          <div className="rounded-xl border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Subscription Status</h2>
            {statusDist.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={statusDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }: any) => `${name}: ${value}`}>
                    {statusDist.map((_: any, i: number) => <Cell key={i} fill={statusDist[i]!.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Upcoming Expirations */}
        {subData?.upcomingExpirations?.length > 0 && (
          <div className="mt-6 rounded-xl border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Upcoming Expirations (Next 7 Days)</h2>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {subData.upcomingExpirations.map((e: any, i: number) => (
                <div key={i} className="flex justify-between text-sm border-b py-2">
                  <span className="font-medium">{e.restaurantName}</span>
                  <span className="text-muted-foreground">{e.packageName}</span>
                  <span className="text-red-600 font-medium">{Math.round(e.daysLeft)} days left</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Subscription Revenue Trend — Line Graph */}
        <div className="mt-6 rounded-xl border bg-card p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Subscription Revenue Trend</h2>
            <select value={revPlan} onChange={e => setRevPlan(e.target.value)}
              className="rounded border px-2 py-1 text-xs">
              <option value="all">All Plans</option>
              <option value="1">Monthly</option>
              <option value="3">3-Month</option>
              <option value="6">6-Month</option>
            </select>
          </div>
          {revData.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No revenue data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={revData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `NRS ${v.toLocaleString()}`} />
                <Legend />
                <Line type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={2} dot={{ r: 3 }} name="Revenue" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
