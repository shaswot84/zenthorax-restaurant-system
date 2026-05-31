'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-provider';
import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { apiGet } from '@/lib/api';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Title, Tooltip, Legend, Filler);

const STATUS_COLORS = { Active: '#22c55e', 'Grace Period': '#eab308', Expired: '#ef4444' };

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
  const collectedRevenue = subData?.collectedRevenue ?? 0;
  const totalSubValue = subData?.totalSubscriptionValue ?? 0;

  const statusDist = [
    { name: 'Active', value: subData?.activeSubscriptions ?? 0, color: STATUS_COLORS.Active },
    { name: 'Grace Period', value: subData?.gracePeriod ?? 0, color: STATUS_COLORS['Grace Period'] },
    { name: 'Expired', value: subData?.expired ?? 0, color: STATUS_COLORS.Expired },
  ].filter(d => d.value > 0);

  const packageChart = {
    labels: pkg.map((p: any) => p.packageName),
    datasets: [
      { label: 'Active Restaurants', data: pkg.map((p: any) => p.activeCount), backgroundColor: '#f97316', borderRadius: 4 },
      { label: 'Subscription Value (NRS)', data: pkg.map((p: any) => p.subscriptionValue), backgroundColor: '#3b82f6', borderRadius: 4 },
    ],
  };

  const statusChart = {
    labels: statusDist.map(d => d.name),
    datasets: [{ label: 'Restaurants', data: statusDist.map(d => d.value), backgroundColor: statusDist.map(d => d.color), borderRadius: 4 }],
  };

  const revenueTrendChart = {
    labels: revData.map(d => d.day),
    datasets: [{
      label: 'Subscription Revenue (NRS)', data: revData.map(d => d.revenue),
      borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,0.1)',
      fill: true, tension: 0.3, pointRadius: 3, pointBackgroundColor: '#f97316',
    }],
  };

  return (
    <DashboardLayout variant="admin">
      <div>
        <h1 className="text-2xl font-bold">Platform Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Subscription-based metrics</p>

        <div className="mt-6 grid gap-4 md:grid-cols-6">
          {[
            { label: 'Total Restaurants', value: subData?.totalRestaurants ?? 0, color: 'text-gray-700' },
            { label: 'Active Subs', value: subData?.activeSubscriptions ?? 0, color: 'text-green-600' },
            { label: 'Grace Period', value: subData?.gracePeriod ?? 0, color: 'text-yellow-600' },
            { label: 'Expired', value: subData?.expired ?? 0, color: 'text-red-600' },
            { label: 'Collected Revenue', value: `NRS ${collectedRevenue.toLocaleString()}`, color: 'text-green-600' },
            { label: 'Active Sub Value', value: `NRS ${totalSubValue.toLocaleString()}`, color: 'text-brand-600' },
          ].map(k => (
            <div key={k.label} className="rounded-xl border bg-card p-4">
              <p className="text-xs text-muted-foreground">{k.label}</p>
              <p className={`mt-1 text-xl font-bold ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div className="rounded-xl border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Subscription by Package</h2>
            {pkg.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No data yet.</p>
            ) : (
              <div className="h-[280px]">
                <Bar data={packageChart} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Subscription Status</h2>
            {statusDist.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No data yet.</p>
            ) : (
              <div className="h-[280px]">
                <Bar data={statusChart} options={{ indexAxis: 'y' as const, responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
              </div>
            )}
          </div>
        </div>

        {/* Restaurant Subscription Status — Sorted by remaining periods */}
        {subData?.restaurantStatuses && (
          <div className="mt-6 rounded-xl border bg-card p-6">
            <h2 className="text-lg font-semibold mb-4">Restaurant Subscription Status</h2>
            <div className="space-y-4">
              {/* Active — sorted by soonest expiring */}
              {subData.restaurantStatuses.active?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-green-700 mb-2">
                    🟢 Active ({subData.restaurantStatuses.active.length})
                  </h3>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {subData.restaurantStatuses.active.map((r: any, i: number) => (
                      <div key={i} className="flex justify-between items-center text-sm border-b py-1.5">
                        <span className="font-medium">{r.restaurantName}</span>
                        <span className="text-xs text-muted-foreground">{r.packageName}</span>
                        <span className={`text-xs font-medium ${r.daysRemaining <= 7 ? 'text-red-600' : r.daysRemaining <= 30 ? 'text-yellow-600' : 'text-green-600'}`}>
                          {Math.round(r.daysRemaining)} days left
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Grace Period — sorted by most recently expired */}
              {subData.restaurantStatuses.gracePeriod?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-yellow-700 mb-2">
                    🟡 Grace Period ({subData.restaurantStatuses.gracePeriod.length})
                  </h3>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {subData.restaurantStatuses.gracePeriod.map((r: any, i: number) => (
                      <div key={i} className="flex justify-between items-center text-sm border-b py-1.5">
                        <span className="font-medium">{r.restaurantName}</span>
                        <span className="text-xs text-muted-foreground">{r.packageName}</span>
                        <span className="text-xs font-medium text-yellow-600">
                          Expired {Math.abs(Math.round(r.daysRemaining))}d ago
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* Expired — sorted by longest expired */}
              {subData.restaurantStatuses.expired?.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-red-700 mb-2">
                    🔴 Expired ({subData.restaurantStatuses.expired.length})
                  </h3>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {subData.restaurantStatuses.expired.map((r: any, i: number) => (
                      <div key={i} className="flex justify-between items-center text-sm border-b py-1.5 opacity-60">
                        <span className="font-medium">{r.restaurantName}</span>
                        <span className="text-xs text-muted-foreground">{r.packageName}</span>
                        <span className="text-xs font-medium text-red-500">
                          Expired {Math.abs(Math.round(r.daysRemaining))}d ago
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!subData.restaurantStatuses.active?.length && !subData.restaurantStatuses.gracePeriod?.length && !subData.restaurantStatuses.expired?.length && (
                <p className="text-muted-foreground text-center py-4">No subscription data available.</p>
              )}
            </div>
          </div>
        )}

        <div className="mt-6 rounded-xl border bg-card p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Subscription Revenue Trend</h2>
            <select value={revPlan} onChange={e => setRevPlan(e.target.value)} className="rounded border px-2 py-1 text-xs">
              <option value="all">All Plans</option>
              <option value="1">Monthly</option>
              <option value="3">3-Month</option>
              <option value="6">6-Month</option>
            </select>
          </div>
          {revData.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No revenue data yet.</p>
          ) : (
            <div className="h-[300px]">
              <Line data={revenueTrendChart} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
